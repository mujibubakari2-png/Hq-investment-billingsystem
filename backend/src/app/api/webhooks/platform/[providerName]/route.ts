import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimiter";
import { paymentService } from "@/lib/payments/service";

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
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const result = await paymentService.processWebhook(providerName, headers, rawBody);

    if (!result.processed && result.message?.includes("rejected")) {
      return NextResponse.json({ error: result.message }, { status: 401 });
    }

    return NextResponse.json({ message: result.message }, { status: 200 });

  } catch (error: any) {
    console.error(`[PLATFORM WEBHOOK ERROR] provider: ${resolvedParams?.providerName}`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
