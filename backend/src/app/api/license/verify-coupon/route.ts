import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { paymentService } from "@/lib/payments/service";
import { getJwtTenantId } from "@/lib/tenant";
import logger from "@/lib/logger";

export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "license:renew");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const tenantId = getJwtTenantId(userPayload);
        if (!tenantId) return errorResponse("Tenant ID missing", 400);

        const body = await req.json();
        const { couponCode } = body;

        if (!couponCode || typeof couponCode !== 'string') {
            return errorResponse("Please provide a valid reference or coupon code.", 400);
        }

        const globalDb = getTenantClient(null);

        // 1. Check if it's an exact Invoice Number or Provider Reference
        const invoice = await globalDb.tenantInvoice.findFirst({
            where: {
                tenantId: tenantId,
                OR: [
                    { invoiceNumber: couponCode },
                    { providerRef: couponCode }
                ]
            },
            include: { payments: true }
        });

        let targetPayment = invoice?.payments?.[0];

        // 2. Or check if it matches a tenantPayment transactionId
        if (!invoice && !targetPayment) {
            targetPayment = await globalDb.tenantPayment.findFirst({
                where: {
                    tenantId: tenantId,
                    transactionId: couponCode
                }
            }) as any;
        }

        if (invoice || targetPayment) {
            const providerRef = targetPayment?.transactionId || invoice?.providerRef;
            const providerParam = targetPayment?.paymentMethod || 'ZENOPAY'; // Default fallback

            if (targetPayment?.status === 'COMPLETED' || invoice?.status === 'PAID') {
                return jsonResponse({
                    success: true,
                    message: "Payment already verified and account is active."
                });
            }

            if (providerRef) {
                try {
                    const liveStatus = await paymentService.checkStatus(
                        providerParam,
                        providerRef,
                        null
                    );

                    const raw = String(liveStatus.status ?? "").toUpperCase();

                    if (raw === "COMPLETED" || raw === "PAID") {
                        const completion = await paymentService.completeLicenseInvoiceFromStatus(
                            invoice?.invoiceNumber || (targetPayment as any).invoiceId,
                            providerRef,
                            liveStatus.amount
                        );
                        
                        if (completion.completed) {
                            return jsonResponse({
                                success: true,
                                message: "Payment verified successfully. Your account is now active!"
                            });
                        }
                    }
                    
                    return errorResponse(`Payment status is currently: ${raw}. Please try again later or contact support.`, 400);
                } catch (pollErr) {
                    logger.warn("[LICENSE/VERIFY-COUPON] Live provider poll failed:", { error: pollErr instanceof Error ? pollErr.message : String(pollErr) });
                    return errorResponse("Failed to verify payment with provider. Please try again.", 502);
                }
            } else {
                return errorResponse("Could not find a valid payment provider reference to verify.", 404);
            }
        }

        // 3. Fallback for actual discount coupons (future implementation)
        return errorResponse("Invalid Reference or Coupon Code.", 400);

    } catch (error) {
        logger.error("Verify Coupon/Reference Error:", { error: error instanceof Error ? error.message : String(error) });
        return errorResponse("Internal server error", 500);
    }
}
