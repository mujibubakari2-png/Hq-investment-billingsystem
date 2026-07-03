import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimiter";
import { paymentService } from "@/lib/payments/service";
import logger from "@/lib/logger";

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
    const { isSupportedProvider } = await import("@/lib/payments/registry");
    if (!isSupportedProvider(providerName)) {
      return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
    }

    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Explicitly pass tenantId: null for PLATFORM webhooks, and skipTenant to strictly process licenses only
    const result = await paymentService.processWebhook(providerName, headers, rawBody, null, { skipTenant: true });

    if (!result.processed && result.message?.includes("rejected")) {
      return NextResponse.json({ error: result.message }, { status: 401 });
    }

    return NextResponse.json({ message: result.message }, { status: 200 });

  } catch (error: any) {
    logger.error(`[PLATFORM WEBHOOK ERROR] provider: ${resolvedParams?.providerName}`, { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
