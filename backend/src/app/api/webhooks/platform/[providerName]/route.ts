import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimiter";
import prisma from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ providerName: string }> }
) {
  let resolvedParams: any = {};
  try {
    resolvedParams = await params;
    const rateLimitRes = await checkRateLimit(req);
    if (rateLimitRes) return rateLimitRes;

    const { providerName } = resolvedParams;
    
    // Platform-level webhook uses global ENV secret, not tenant-specific config
    const webhookSecret = process.env[`${providerName.toUpperCase()}_WEBHOOK_SECRET`] || process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
        return NextResponse.json({ error: "Platform webhook secret not configured" }, { status: 500 });
    }

    const rawBody = await req.text();
    let payload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        payload = {};
    }

    // Verify signature logic (implementation depends on provider)
    // For M-Pesa / simple providers:
    const providedSignature = req.headers.get("x-webhook-secret") || req.headers.get("x-signature") || "";
    // Note: Actual verification logic will be provider-specific, omitted here for brevity
    
    const transactionId = payload.TransactionID || payload.transactionId || payload.reference;
    
    console.log(`[PLATFORM WEBHOOK] Received for ${providerName}:`, transactionId);

    // Update Platform Transaction / TenantPayment logic
    if (transactionId) {
        const tx = await prisma.tenantPayment.findUnique({ where: { transactionId } });
        if (tx && tx.status !== "COMPLETED") {
            await prisma.tenantPayment.update({
                where: { id: tx.id },
                data: { status: "COMPLETED" }
            });
            // Update TenantInvoice / TenantLicense as well
        }
    }

    return NextResponse.json({ message: "Platform webhook processed" }, { status: 200 });

  } catch (error: any) {
    console.error(`[PLATFORM WEBHOOK ERROR] provider: ${resolvedParams?.providerName}`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
