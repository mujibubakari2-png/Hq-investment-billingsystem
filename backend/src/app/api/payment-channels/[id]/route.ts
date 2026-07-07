import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { encryptPaymentChannelFields } from "@/lib/encryption";
import { PaymentChannelUpdateSchema } from "@/lib/validators";
import { canAccessTenant } from "@/lib/tenant";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "payment-channels:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const body = await req.json();

        const parsed = PaymentChannelUpdateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const data = parsed.data;
        const existing = await db.paymentChannel.findUnique({ where: { id } });
        if (!existing) return errorResponse("Payment channel not found", 404);
        if (!canAccessTenant(userPayload, existing.tenantId)) {
            return errorResponse("Payment channel not found", 404);
        }

        const encryptedFields = encryptPaymentChannelFields({
            apiKey: data.apiKey ?? body.apiKey,
            apiSecret: data.apiSecret ?? body.apiSecret,
            webhookSecret: data.webhookSecret ?? body.webhookSecret,
        });

        const channel = await db.paymentChannel.update({
            where: { id },
            data: {
                name: data.name ?? body.name,
                provider: data.provider ?? body.provider,
                accountNumber: data.accountNumber ?? body.accountNumber,
                ...encryptedFields,
                status: data.status ?? body.status,
                config: data.config ?? body.config,
            },
        });

        if (channel.tenantId && existing.provider !== channel.provider) {
            await db.tenantPaymentGateway.updateMany({
                where: { tenantId: channel.tenantId, provider: existing.provider },
                data: { enabled: false, status: "INACTIVE" },
            });
        }

        if (channel.tenantId) {
            await db.tenantPaymentGateway.upsert({
                where: {
                    tenantId_provider: {
                        tenantId: channel.tenantId,
                        provider: channel.provider,
                    },
                },
                update: {
                    name: channel.name,
                    enabled: channel.status === "ACTIVE",
                    status: channel.status,
                    config: channel.config ?? undefined,
                },
                create: {
                    tenantId: channel.tenantId,
                    provider: channel.provider,
                    name: channel.name,
                    enabled: channel.status === "ACTIVE",
                    status: channel.status,
                    config: channel.config ?? undefined,
                },
            });
        }

        return jsonResponse(channel);
    } catch {
        return errorResponse("Internal server error", 500);
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "payment-channels:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const existing = await db.paymentChannel.findUnique({ where: { id } });
        if (!existing) return errorResponse("Payment channel not found", 404);
        if (!canAccessTenant(userPayload, existing.tenantId)) {
            return errorResponse("Payment channel not found", 404);
        }

        await db.paymentChannel.delete({ where: { id } });
        if (existing.tenantId) {
            await db.tenantPaymentGateway.updateMany({
                where: { tenantId: existing.tenantId, provider: existing.provider },
                data: { enabled: false, status: "INACTIVE" },
            });
        }
        return jsonResponse({ message: "Payment channel deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
