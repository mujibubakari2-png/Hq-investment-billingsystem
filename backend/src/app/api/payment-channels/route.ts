import { NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { encryptPaymentChannelFields, decryptPaymentChannelFields } from "@/lib/encryption";
import { getJwtTenantId, getTenantFilter, isPlatformSuperAdmin } from "@/lib/tenant";

// ── Validation schema (API-001) ───────────────────────────────────────────────
const PROVIDERS = ["PALMPESA", "ZENOPAY", "MONGIKE", "HARAKAPAY", "CASH", "BANK_TRANSFER", "OTHER"] as const;
const ENVIRONMENTS = ["sandbox", "live"] as const;
const STATUSES = ["ACTIVE", "INACTIVE"] as const;

const createChannelSchema = z.object({
    name: z.string().min(2, { message: "Name must be at least 2 characters" }).max(100),
    provider: z.enum(PROVIDERS, { message: "Invalid provider" }),
    accountNumber: z.string().max(50).optional().nullable(),
    apiKey: z.string().max(500).optional().nullable(),
    apiSecret: z.string().max(500).optional().nullable(),
    webhookSecret: z.string().max(500).optional().nullable(),
    environment: z.enum(ENVIRONMENTS).default("sandbox"),
    status: z.enum(STATUSES).default("ACTIVE"),
    tenantId: z.string().optional().nullable(),
    config: z.record(z.string(), z.unknown()).optional().nullable(),
});

// MOD-003: Mask a sensitive field so only the last 4 chars are visible.
function maskField(value: string | null | undefined): string | null {
    if (!value) return null;
    if (value.length <= 4) return "****";
    return `****${value.slice(-4)}`;
}

// GET /api/payment-channels
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const platformAdmin = isPlatformSuperAdmin(userPayload);
        const { filter: tenantFilter } = getTenantFilter(userPayload);

        const channels = await prisma.paymentChannel.findMany({
            where: { ...tenantFilter },
            orderBy: { createdAt: "desc" },
            include: platformAdmin ? { tenant: { select: { id: true, name: true } } } : undefined,
        });

        const mapped = channels.map((ch: any) => {
            const decrypted = decryptPaymentChannelFields(ch);
            return {
                id: ch.id,
                name: ch.name,
                provider: ch.provider,
                accountNumber: ch.accountNumber,
                status: ch.status === "ACTIVE" ? "Active" : "Inactive",
                environment: ch.environment,
                createdAt: ch.createdAt.toLocaleDateString("en-US", {
                    timeZone: "Africa/Dar_es_Salaam", month: "short", day: "numeric", year: "numeric",
                }),
                // MOD-003: Return masked values only
                apiKey: maskField(decrypted.apiKey),
                apiSecret: maskField(decrypted.apiSecret),
                webhookSecret: maskField(decrypted.webhookSecret),
                hasApiKey: !!decrypted.apiKey,
                hasApiSecret: !!decrypted.apiSecret,
                hasWebhookSecret: !!decrypted.webhookSecret,
                tenantId: platformAdmin ? ch.tenantId : undefined,
                tenantName: platformAdmin ? ch.tenant?.name : undefined,
            };
        });

        return jsonResponse(mapped);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/payment-channels
export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        if (userPayload.role !== "SUPER_ADMIN") {
            return errorResponse("Forbidden: Only the tenant Super Admin can manage payment channels", 403);
        }

        const body = await req.json();

        // API-001: Validate all input fields
        const parsed = createChannelSchema.safeParse(body);
        if (!parsed.success) {
            const messages = parsed.error.issues.map((e: any) => e.message).join(", ");
            return errorResponse(messages, 400);
        }
        const data = parsed.data;

        const platformAdmin = isPlatformSuperAdmin(userPayload);
        const tenantIdValue = platformAdmin
            ? (data.tenantId || body.tenant_id || null)
            : getJwtTenantId(userPayload);

        if (!tenantIdValue && !platformAdmin) {
            return errorResponse("Tenant ID missing", 400);
        }

        // MT-002: Validate tenantId exists before creating
        if (tenantIdValue) {
            const tenantExists = await prisma.tenant.findUnique({ where: { id: tenantIdValue }, select: { id: true } });
            if (!tenantExists) {
                return errorResponse(`Tenant not found: ${tenantIdValue}`, 404);
            }
        }

        // MOD-002: Encrypt sensitive credentials before writing to DB
        const encryptedFields = encryptPaymentChannelFields({
            apiKey: data.apiKey,
            apiSecret: data.apiSecret,
            webhookSecret: data.webhookSecret,
        });

        const channel = await prisma.paymentChannel.create({
            data: {
                name: data.name,
                provider: data.provider,
                accountNumber: data.accountNumber ?? null,
                environment: data.environment,
                status: data.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
                // config field: pass undefined if null to avoid InputJsonValue type issues
                ...(data.config ? { config: data.config as any } : {}),
                tenantId: tenantIdValue,
                ...encryptedFields,
            },
        });

        if (tenantIdValue) {
            await prisma.tenantPaymentGateway.upsert({
                where: {
                    tenantId_provider: {
                        tenantId: tenantIdValue,
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
                    tenantId: tenantIdValue,
                    provider: channel.provider,
                    name: channel.name,
                    enabled: channel.status === "ACTIVE",
                    status: channel.status,
                    config: channel.config ?? undefined,
                },
            });
        }

        return jsonResponse({
            id: channel.id,
            name: channel.name,
            provider: channel.provider,
            accountNumber: channel.accountNumber,
            status: channel.status,
            environment: channel.environment,
            createdAt: channel.createdAt,
            tenantId: channel.tenantId,
            hasApiKey: !!channel.apiKey,
            hasApiSecret: !!channel.apiSecret,
            hasWebhookSecret: !!channel.webhookSecret,
        }, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
