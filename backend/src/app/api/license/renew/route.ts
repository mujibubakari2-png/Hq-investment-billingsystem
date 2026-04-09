import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

const PALMPESA_API_URL = process.env.PALMPESA_API_URL || "https://api.palmpesa.com/v1/payments/stk-push";
const PALMPESA_API_KEY = process.env.PALMPESA_API_KEY || "demo_key";

export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const tenantId = userPayload.tenantId;
        if (!tenantId) return errorResponse("Tenant ID missing", 400);

        const body = await req.json();
        const { packageMonths, phoneNumber, amount, invoiceId } = body;

        if (packageMonths === undefined || !amount) {
            return errorResponse("Missing package details", 400);
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { plan: true }
        });

        if (!tenant) return errorResponse("Tenant not found", 404);

        let invoice;
        
        if (invoiceId) {
            invoice = await prisma.tenantInvoice.findUnique({
                where: { id: invoiceId }
            });
            if (!invoice) return errorResponse("Invoice not found", 404);
        } else {
            // CREATE PENDING INVOICE
            const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
            invoice = await prisma.tenantInvoice.create({
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

        const stkPayload = {
            PhoneNumber: phoneNumber,
            Amount: invoice.amount,
            AccountReference: invoice.invoiceNumber,
            TransactionDesc: `SaaS License Renewal - ${packageMonths} Month(s)`,
            CallbackUrl: `${process.env.APP_URL || 'https://api.kenge.com'}/api/payments/palmpesa/webhook`,
        };

        // In a real production deployment with credentials:
        /*
        const response = await fetch(PALMPESA_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${PALMPESA_API_KEY}`
            },
            body: JSON.stringify(stkPayload)
        });
        const result = await response.json();
        */

        // For local development mockup of successful STK push initiation:
        const result = {
            ResponseCode: "0",
            CheckoutRequestID: `ws_CO_${Date.now()}`
        };

        if (result.ResponseCode === "0") {
            return jsonResponse({
                success: true,
                message: "Please enter your M-Pesa pin to complete the transaction.",
                status: "processing"
            });
        } else {
            return errorResponse("Failed to initiate STK Push", 500);
        }

    } catch (error) {
        console.error("License Renew API Error:", error);
        return errorResponse("Internal server error", 500);
    }
}
