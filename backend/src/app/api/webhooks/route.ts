import { NextResponse, NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimiter';

// [DEPRECATED] Legacy Webhook Handler for Gateways
// Replaced by /api/webhooks/tenant/[tenantId]/[providerName]

export async function POST(req: NextRequest) {
    try {
        const rateLimitRes = await checkRateLimit(req);
        if (rateLimitRes) return rateLimitRes;

        console.error("[DEPRECATED] Webhook hit disabled legacy route /api/webhooks. Rejecting with 410.");

        // Return 410 Gone to signal the provider that this URL is permanently removed.
        // Providers will typically alert the merchant to update their Webhook URL.
        return NextResponse.json(
            { error: "Endpoint deprecated. Update webhook URL to /api/webhooks/tenant/[tenantId]/[providerName]" },
            { status: 410 }
        );
    } catch (error: any) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
