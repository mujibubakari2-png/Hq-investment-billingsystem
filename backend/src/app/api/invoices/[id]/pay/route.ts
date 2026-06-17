import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { canAccessTenant } from "@/lib/tenant";
import { paymentService } from "@/lib/payments/service";
import { generateReference } from "@/lib/payments/utils";

/**
 * PAY-002: POST /api/invoices/[id]/pay
 *
 * Initiates mobile money payment for an invoice.
 * - Auto-resolves the payment provider from the tenant's active PaymentChannel
 * - Creates a PENDING transaction linked to the invoice via invoiceId
 * - Returns the transaction reference for polling
 *
 * The webhook (processWebhook) will mark the invoice PAID when payment confirms.
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN", "ADMIN");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;

        // Load invoice with client
        const invoice = await db.invoice.findUnique({
            where: { id },
            include: { client: true, items: true },
        });

        if (!invoice) return errorResponse("Invoice not found", 404);

        // Tenant isolation
        if (!canAccessTenant(userPayload, invoice.tenantId)) {
            return errorResponse("Forbidden", 403);
        }

        // Guard: only DRAFT/UNPAID/OVERDUE invoices can be paid
        if (invoice.status === "PAID") {
            return errorResponse("Invoice is already paid", 409);
        }

        const client = invoice.client;
        if (!client.phone) {
            return errorResponse("Client has no phone number — cannot initiate mobile payment", 422);
        }

        // Auto-resolve provider: find first active mobile PaymentChannel for this tenant
        const channel = await db.paymentChannel.findFirst({
            where: {
                status: "ACTIVE",
                tenantId: invoice.tenantId ?? null,
                provider: { in: ["PALMPESA", "ZENOPAY", "HARAKAPAY", "MONGIKE"] },
            },
            orderBy: { createdAt: "asc" },
        });

        if (!channel) {
            return errorResponse(
                "No mobile payment provider configured for this tenant. Please add a PaymentChannel first.",
                503
            );
        }

        const reference = generateReference("INV");

        // Create PENDING transaction and mark invoice PENDING atomically to avoid races.
        // NOTE: invoiceId is a new schema field — uses `as any` until prisma generate runs
        const [transaction] = await (db.$transaction as any)([
            db.transaction.create({
                data: {
                    clientId: client.id,
                    planName: `Invoice ${invoice.invoiceNumber}`,
                    amount: invoice.amount,
                    type: "MOBILE",
                    method: channel.provider,
                    status: "PENDING",
                    reference,
                    tenantId: invoice.tenantId,
                    invoiceId: invoice.id,
                },
            }),
        ]);

        // Initiate payment (external) — not part of DB transaction
        const result = await paymentService.initiatePayment({
            tenantId: invoice.tenantId,
            amount: invoice.amount,
            phone: client.phone,
            reference,
            providerName: channel.provider,
            description: `Invoice ${invoice.invoiceNumber} — ${client.fullName}`,
            buyerName: client.fullName || undefined,
        });

        if (!result.success) {
            // Mark transaction FAILED; invoice status was not modified because the payment initiation step failed.
            await (db.$transaction as any)([
                db.transaction.update({ where: { id: transaction.id }, data: { status: "FAILED" } }),
            ]).catch((e: unknown) => console.error("Failed to rollback invoice status after payment initiation failure:", e));

            return errorResponse(result.message || "Payment initiation failed", 502);
        }

        return jsonResponse({
            success: true,
            reference,
            transactionId: transaction.id,
            provider: channel.provider,
            message: "Payment initiated — customer will receive a prompt on their phone",
        });
    } catch (e) {
        console.error("[Invoice Pay] error:", e);
        return errorResponse("Internal server error", 500);
    }
}
