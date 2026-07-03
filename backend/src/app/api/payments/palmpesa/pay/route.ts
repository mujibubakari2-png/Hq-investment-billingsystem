import logger from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

/**
 * [DEPRECATED — CRITICAL-2 FIX]
 *
 * This route previously used the global platform environment variable PALMPESA_API_KEY
 * to initiate payments against tenant-scoped invoices (tenantInvoiceId).
 *
 * This is a payment credential isolation violation:
 *   - Platform credentials (tenantId=null) MUST only be used for License payments.
 *   - Tenant credentials (tenantId=<value>) MUST only be used for Hotspot/PPPoE payments.
 *
 * All payment flows are now handled through the correct, isolated endpoints:
 *   - License / SaaS Renewal : POST /api/license/renew      (uses platform paymentChannel)
 *   - Hotspot / PPPoE        : POST /api/payments/initiate  (uses tenant paymentChannel)
 *
 * This endpoint is permanently removed. Any integration pointing here must be updated.
 */
export async function POST(_req: NextRequest) {
    console.error(
        "[DEPRECATED] POST /api/payments/palmpesa/pay was called. " +
        "This endpoint is permanently removed due to a payment credential isolation violation. " +
        "Use /api/license/renew for SaaS license payments or /api/payments/initiate for customer payments."
    );
    return NextResponse.json(
        {
            error: "Endpoint permanently removed.",
            reason: "Payment credential isolation violation — platform credentials cannot be used for tenant payments.",
            license_payments: "POST /api/license/renew",
            customer_payments: "POST /api/payments/initiate",
        },
        { status: 410 }
    );
}
