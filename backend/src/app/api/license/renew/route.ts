import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

const PALMPESA_API_URL = process.env.PALMPESA_API_URL || "https://api.palmpesa.com/v1/payments/stk-push";
const PALMPESA_API_KEY = process.env.PALMPESA_API_KEY;

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
            const invoiceNumber = `INV-${new Date().getFullYear()}-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
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

        const appUrl = process.env.APP_URL;
        if (!appUrl) {
            return errorResponse("Server payment callback URL is not configured", 500);
        }

        const stkPayload = {
            PhoneNumber: phoneNumber,
            Amount: invoice.amount,
            AccountReference: invoice.invoiceNumber,
            TransactionDesc: `SaaS License Renewal - ${packageMonths} Month(s)`,
            CallbackUrl: `${appUrl}/api/payments/palmpesa/webhook`,
        };

        // In a real production deployment with credentials:
        /*
        if (!PALMPESA_API_KEY) {
            return errorResponse("PalmPesa API key is not configured", 500);
        }
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
