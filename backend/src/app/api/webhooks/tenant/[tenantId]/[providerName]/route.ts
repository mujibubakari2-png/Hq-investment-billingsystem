import { NextRequest, NextResponse } from "next/server";
import { PaymentService } from "@/lib/payments/service";
import { checkRateLimit } from "@/lib/rateLimiter";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; providerName: string }> }
) {
  let p: any = {};
  try {
    p = await params;
    const rateLimitRes = await checkRateLimit(req);
    if (rateLimitRes) return rateLimitRes;

    const { tenantId, providerName } = p;
    
    const rawBody = await req.text();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = {};
    }
    
    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    const paymentService = new PaymentService();
    // processWebhook handles DB PaymentChannel lookup, signature verification via decrypted secret,
    // and subsequent subscription updates strictly scoped to the tenant.
    const result = await paymentService.processWebhook(providerName, headers, rawBody, tenantId);

    if (result.processed) {
      return NextResponse.json({ message: result.message }, { status: 200 });
    } else {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
  } catch (error: any) {
    console.error(`[TENANT WEBHOOK ERROR] tenant: ${p.tenantId}, provider: ${p.providerName}`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
