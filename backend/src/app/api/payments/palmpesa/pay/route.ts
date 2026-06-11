import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse, getUserFromRequest } from "@/lib/auth";

// Environment variables or settings for PalmPesa API
const PALMPESA_BASE_URL = process.env.PALMPESA_API_URL;
const PALMPESA_API_URL = PALMPESA_BASE_URL
  ? (PALMPESA_BASE_URL.endsWith("/payments/stk-push")
    ? PALMPESA_BASE_URL
    : `${PALMPESA_BASE_URL}/payments/stk-push`)
  : undefined;
const PALMPESA_API_KEY = process.env.PALMPESA_API_KEY;

export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        if (userPayload.role !== "SUPER_ADMIN" && userPayload.role !== "ADMIN") {
            return errorResponse("Forbidden: Admin access required", 403);
        }

        const body = await req.json();
        const { tenantInvoiceId, phone } = body;

        if (!tenantInvoiceId || !phone) {
            return errorResponse("Missing tenantInvoiceId or phone", 400);
        }

        const invoice = await prisma.tenantInvoice.findUnique({
            where: { id: tenantInvoiceId },
            include: { tenant: true }
        });

        if (!invoice) {
            return errorResponse("Invoice not found", 404);
        }
        if (userPayload.role !== "SUPER_ADMIN" && invoice.tenantId !== userPayload.tenantId) {
            return errorResponse("Forbidden", 403);
        }

        if (invoice.status === "PAID") {
            return errorResponse("Invoice is already paid", 400);
        }

        // Mock PalmPesa API STK push request
        const appUrl = process.env.APP_URL;
        if (!appUrl) {
            return errorResponse("Server payment callback URL is not configured", 500);
        }

        const stkPayload = {
            PhoneNumber: phone,
            Amount: invoice.amount,
            AccountReference: invoice.invoiceNumber,
            TransactionDesc: `Payment for SaaS Plan ${invoice.planId}`,
            CallbackUrl: `${appUrl}/api/payments/palmpesa/webhook`,
        };

        if (!PALMPESA_API_URL) {
            return errorResponse("PalmPesa API URL is not configured", 500);
        }
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

        if (result.ResponseCode === "0") {
            return jsonResponse({
                message: "STK Push initiated successfully",
                checkoutRequestId: result.CheckoutRequestID,
                status: "processing"
            });
        } else {
            return errorResponse("Failed to initiate STK Push", 500);
        }

    } catch (e) {
        console.error("PALMPESA PAY ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
