import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getPaymentProvider } from "@/lib/payments/registry";
import { formatPhoneTZ } from "@/lib/payments/utils";
import { getJwtTenantId, isPlatformSuperAdmin } from "@/lib/tenant";

export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        const db = getTenantClient(userPayload);
        if (userPayload.role !== "SUPER_ADMIN" || isPlatformSuperAdmin(userPayload)) {
            return errorResponse("Forbidden: Only the tenant Super Admin can renew licenses", 403);
        }

        const tenantId = getJwtTenantId(userPayload);
        if (!tenantId) return errorResponse("Tenant ID missing", 400);

        const body = await req.json();
        const { packageMonths, phoneNumber, amount, invoiceId } = body;

        if (packageMonths === undefined || !amount) {
            return errorResponse("Missing package details", 400);
        }

        const tenant = await db.tenant.findUnique({
            where: { id: tenantId },
            include: { plan: true }
        });

        if (!tenant) return errorResponse("Tenant not found", 404);

        let invoice;
        
        if (invoiceId) {
            invoice = await db.tenantInvoice.findUnique({
                where: { id: invoiceId }
            });
            if (!invoice) return errorResponse("Invoice not found", 404);
            if (invoice.tenantId !== tenant.id) return errorResponse("Forbidden", 403);
        } else {
            // FIX: Avoid duplicating PENDING invoices. Delete any existing PENDING invoice before creating a new one.
            await db.tenantInvoice.deleteMany({
                where: { 
                    tenantId: tenant.id,
                    status: "PENDING",
                    planId: tenant.planId
                }
            });

            // CREATE NEW PENDING INVOICE
            const invoiceNumber = `INV-${new Date().getFullYear()}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
            invoice = await db.tenantInvoice.create({
                data: {
                    invoiceNumber,
                    tenantId: tenant.id,
                    planId: tenant.planId,
                    packageMonths: Number(packageMonths),
                    amount: Number(amount),
                    status: "PENDING",
                    dueDate: new Date(),
                }
            });
        }

        const appUrl = process.env.APP_URL;
        if (!appUrl) {
            return errorResponse("Server payment callback URL is not configured", 500);
        }

        // Dynamically resolve payment provider from environment or DB configuration
        let providerName = "PALMPESA"; // default
        
        // Prefer the configured global PaymentChannel for the platform
        const systemChannel = await db.paymentChannel.findFirst({
            where: { status: "ACTIVE", tenantId: null }
        });
        
        if (systemChannel && systemChannel.provider) {
            providerName = systemChannel.provider;
        } else if (process.env.ZENOPAY_API_KEY) {
            providerName = "ZENOPAY";
        } else if (process.env.HARAKAPAY_API_KEY) {
            providerName = "HARAKAPAY";
        } else if (process.env.MONGIKE_API_KEY) {
            providerName = "MONGIKE";
        }

        const callbackUrl = `${appUrl}/api/payments/${providerName.toLowerCase()}/webhook`;

        try {
            const cleanPhone = formatPhoneTZ(phoneNumber);
            const provider = getPaymentProvider(providerName);

            const result = await provider.initiatePayment({
                amount: invoice.amount,
                phone: cleanPhone,
                reference: invoice.invoiceNumber,
                description: `SaaS License Renewal - ${packageMonths} Month(s)`,
                callbackUrl: callbackUrl,
                buyerName: tenant.name,
                buyerEmail: tenant.email,
            });

            if (result.success) {
                return jsonResponse({
                    success: true,
                    message: "STK push initiated! Please enter your mobile money PIN to complete the transaction.",
                    status: "processing"
                });
            } else {
                return errorResponse(result.message || "Failed to initiate STK Push", 500);
            }
        } catch (paymentErr: any) {
            console.error("STK push error during license renewal:", paymentErr);
            return errorResponse(paymentErr.message || "Payment provider error", 500);
        }

    } catch (error) {
        console.error("License Renew API Error:", error);
        return errorResponse("Internal server error", 500);
    }
}

