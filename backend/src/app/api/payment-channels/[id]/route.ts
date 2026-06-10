import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { encryptPaymentChannelFields } from "@/lib/encryption";
import { canAccessTenant } from "@/lib/tenant";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        if (userPayload.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Only the tenant Super Admin can manage payment channels", 403);
        }

        const { id } = await params;
        const body = await req.json();
        const existing = await prisma.paymentChannel.findUnique({ where: { id } });
        if (!existing) return errorResponse("Payment channel not found", 404);
        if (!canAccessTenant(userPayload, existing.tenantId)) {
            return errorResponse("Forbidden", 403);
        }

        const encryptedFields = encryptPaymentChannelFields({
            apiKey: body.apiKey,
            apiSecret: body.apiSecret,
            webhookSecret: body.webhookSecret,
        });

        const channel = await prisma.paymentChannel.update({
            where: { id },
            data: {
                name: body.name,
                provider: body.provider,
                accountNumber: body.accountNumber,
                ...encryptedFields,
                status: body.status === "Inactive" ? "INACTIVE" : body.status === "Active" ? "ACTIVE" : undefined,
                config: body.config,
            },
        });

        if (channel.tenantId) {
            await prisma.tenantPaymentGateway.upsert({
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
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);
        if (userPayload.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Only the tenant Super Admin can manage payment channels", 403);
        }

        const { id } = await params;
        const existing = await prisma.paymentChannel.findUnique({ where: { id } });
        if (!existing) return errorResponse("Payment channel not found", 404);
        if (!canAccessTenant(userPayload, existing.tenantId)) {
            return errorResponse("Forbidden", 403);
        }

        await prisma.paymentChannel.delete({ where: { id } });
        if (existing.tenantId) {
            await prisma.tenantPaymentGateway.updateMany({
                where: { tenantId: existing.tenantId, provider: existing.provider },
                data: { enabled: false, status: "INACTIVE" },
            });
        }
        return jsonResponse({ message: "Payment channel deleted" });
    } catch {
        return errorResponse("Internal server error", 500);
    }
}
