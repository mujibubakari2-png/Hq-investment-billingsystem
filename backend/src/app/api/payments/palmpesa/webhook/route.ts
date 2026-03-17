import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { errorResponse, jsonResponse } from "@/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        // Example payload from PalmPesa
        const {
            TransactionId, // e.g. "PXX123456"
            AccountReference, // This is the invoiceNumber
            Amount,
            ResultCode, // "0" for success
            ResultDesc
        } = body;

        if (ResultCode !== "0") {
            console.log("PalmPesa payment failed:", ResultDesc);
            return jsonResponse({ message: "Acknowledged failure" });
        }

        // Find the invoice
        const invoice = await prisma.tenantInvoice.findUnique({
            where: { invoiceNumber: AccountReference }
        });

        if (!invoice) {
            return errorResponse("Invoice not found", 404);
        }

        if (invoice.status === "PAID") {
            return jsonResponse({ message: "Already paid" });
        }

        // Run updates inside a transaction
        await prisma.$transaction(async (tx) => {
            // 1. Update invoice status
            await tx.tenantInvoice.update({
                where: { id: invoice.id },
                data: { status: "PAID" }
            });

            // 2. Create payment record
            // Determine payment method if PalmPesa provides it, else default to PALMPESA
            await tx.tenantPayment.create({
                data: {
                    invoiceId: invoice.id,
                    tenantId: invoice.tenantId,
                    amount: Number(Amount),
                    transactionId: TransactionId,
                    status: "COMPLETED",
                    paymentMethod: "PALMPESA" 
                }
            });

            // 3. Activate the Tenant
            await tx.tenant.update({
                where: { id: invoice.tenantId },
                data: { status: "ACTIVE" }
            });
        });

        return jsonResponse({ message: "Webhook processed successfully" });

    } catch (e) {
        console.error("PALMPESA WEBHOOK ERROR:", e);
        return errorResponse("Internal server error", 500);
    }
}
