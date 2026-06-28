import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { buildCallbackUrl, formatPhoneTZ } from "@/lib/payments/utils";
import { paymentService } from "@/lib/payments/service";
import { getJwtTenantId, isPlatformSuperAdmin } from "@/lib/tenant";

export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "license:renew");
        if (guard.error) return guard.error;
        const userPayload = guard.user;

        if (isPlatformSuperAdmin(userPayload)) {
            return errorResponse("Forbidden: Only the tenant Super Admin can renew licenses", 403);
        }

        const db = getTenantClient(userPayload);
        const tenantId = getJwtTenantId(userPayload);
        if (!tenantId) return errorResponse("Tenant ID missing", 400);

        const body = await req.json();
        const { packageMonths, phoneNumber, invoiceId } = body;

        // packageMonths must be a non-negative integer.
        // When invoiceId is provided, packageMonths=0 means "use the invoice's existing months".
        // When creating a new invoice, packageMonths must be >= 1.
        const requestedMonths = Number(packageMonths);
        if (packageMonths === undefined || isNaN(requestedMonths) || requestedMonths < 0) {
            return errorResponse("Missing or invalid package months", 400);
        }
        if (!invoiceId && requestedMonths < 1) {
            return errorResponse("packageMonths must be at least 1 when creating a new invoice", 400);
        }

        const tenant = await db.tenant.findUnique({
            where: { id: tenantId },
            include: { plan: true },
        });

        if (!tenant) return errorResponse("Tenant not found", 404);

        let invoice;

        if (invoiceId) {
            invoice = await db.tenantInvoice.findUnique({
                where: { id: invoiceId },
            });
            if (!invoice) return errorResponse("Invoice not found", 404);
            if (invoice.tenantId !== tenant.id) return errorResponse("Forbidden", 403);

            // Use invoice's existing packageMonths when caller passes 0
            const effectiveMonths = requestedMonths > 0 ? requestedMonths : (invoice.packageMonths ?? 1);
            const expectedAmount = tenant.plan ? tenant.plan.price * effectiveMonths : invoice.amount;

            // If the plan changed or the amount changed, update the invoice
            if (invoice.amount !== expectedAmount || invoice.planId !== tenant.planId || effectiveMonths !== invoice.packageMonths) {
                invoice = await db.tenantInvoice.update({
                    where: { id: invoice.id },
                    data: {
                        amount: expectedAmount,
                        planId: tenant.planId,
                        packageMonths: effectiveMonths
                    }
                });
            }
        } else {
            await db.tenantInvoice.deleteMany({
                where: {
                    tenantId: tenant.id,
                    status: "PENDING",
                },
            });

            const expectedAmount = tenant.plan ? tenant.plan.price * requestedMonths : 0;

            const invoiceNumber = `INV-${new Date().getFullYear()}-${randomUUID()
                .replace(/-/g, "")
                .slice(0, 8)
                .toUpperCase()}`;

            invoice = await db.tenantInvoice.create({
                data: {
                    invoiceNumber,
                    tenantId: tenant.id,
                    planId: tenant.planId,
                    packageMonths: requestedMonths,
                    amount: expectedAmount,
                    status: "PENDING",
                    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
                },
            });
        }

        const appUrl = process.env.APP_URL;
        if (!appUrl) {
            return errorResponse("Server payment callback URL is not configured", 500);
        }

        let providerName = "PALMPESA";
        const unscopedDb = getTenantClient(null);
        const systemChannel = await unscopedDb.paymentChannel.findFirst({
            where: { status: "ACTIVE", tenantId: null },
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

        // FIX: Correct callback URL path.
        // Previously pointed to /api/payments/{provider}/webhook (deprecated/removed endpoint).
        // All provider webhooks are handled at /api/webhooks/{provider}.
        const callbackUrl = buildCallbackUrl(providerName, req, appUrl);

        try {
            const cleanPhone = formatPhoneTZ(phoneNumber);

            const result = await paymentService.initiatePayment({
                tenantId: null,
                amount: invoice.amount,
                phone: cleanPhone,
                reference: invoice.invoiceNumber,
                description: `SaaS License Renewal - ${packageMonths} Month(s)`,
                callbackUrl,
                buyerName: tenant.name,
                buyerEmail: tenant.email,
                providerName,
                paymentContext: 'LICENSE',
            });

            if (result.success) {
                return jsonResponse(
                    {
                        success: true,
                        message: "Please enter your mobile money PIN to complete the transaction.",
                        status: "processing",
                    },
                    200
                );
            }

            const isGatewayIssue =
                result.status === "EMPTY" ||
                result.status === "UNKNOWN" ||
                result.status?.startsWith("HTTP_") ||
                /HTTP\s+\d{3}/i.test(result.message || "") ||
                /unknown response format|response body was empty/i.test(result.message || "");
            const httpStatus = isGatewayIssue ? 502 : 500;
            return errorResponse(
                result.message || "Failed to initiate STK Push",
                httpStatus,
                result.code || (isGatewayIssue ? "PALMPESA_GATEWAY" : "PALMPESA_FAILED"),
                result.status ? `Provider status: ${result.status}` : undefined
            );
        } catch (paymentErr: any) {
            console.error("STK push error during license renewal:", paymentErr);
            return errorResponse(paymentErr.message || "Payment provider error", 502, "PALMPESA_GATEWAY", "Provider request failed");
        }
    } catch (error) {
        console.error("License Renew API Error:", error);
        return errorResponse("Internal server error", 500);
    }
}
