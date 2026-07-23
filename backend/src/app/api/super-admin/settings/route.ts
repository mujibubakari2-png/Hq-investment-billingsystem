import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { errorResponse, jsonResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import logger from "@/lib/logger";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";

/**
 * GET  /api/super-admin/settings    — get platform-wide settings
 * POST /api/super-admin/settings    — upsert platform-wide settings
 *
 * ── PRIVACY BOUNDARY ──────────────────────────────────────────────────────────
 * Platform settings are system settings with tenantId = null.
 * This endpoint ONLY reads/writes settings where tenantId IS NULL.
 * Tenant-specific settings are completely inaccessible here.
 * ──────────────────────────────────────────────────────────────────────────────
 */

// Platform-level setting keys allowed in this endpoint
const PLATFORM_SETTING_KEYS = [
    // Payment gateways for receiving license payments
    "platform_harakapay_api_key",
    "platform_harakapay_secret",
    "platform_harakapay_callback_url",
    "platform_zenopay_account",
    "platform_zenopay_api_key",
    "platform_zenopay_callback_url",
    "platform_palmpesa_account",
    "platform_palmpesa_api_key",
    "platform_palmpesa_secret",
    "platform_palmpesa_callback_url",
    // SMS gateway for platform-to-tenant notifications
    "platform_sms_api_key",
    "platform_sms_sender_id",
    "platform_sms_provider",
    // Email SMTP
    "platform_smtp_host",
    "platform_smtp_port",
    "platform_smtp_user",
    "platform_smtp_password",
    "platform_smtp_from_name",
    "platform_smtp_from_email",
    // General platform settings
    "platform_name",
    "platform_support_email",
    "platform_support_phone",
    "platform_trial_days",
    "platform_currency",
    "platform_timezone",
];

export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);

        // Only fetch platform-level settings (tenantId = null)
        const settings = await db.systemSetting.findMany({
            where: {
                tenantId: null,
                key: { in: PLATFORM_SETTING_KEYS },
            },
        });

        // Mask sensitive values before sending
        const masked = settings.map((s) => ({
            id: s.id,
            key: s.key,
            group: s.group,
            value: s.key.toLowerCase().includes("password") ||
                s.key.toLowerCase().includes("secret") ||
                s.key.toLowerCase().includes("api_key")
                ? "••••••••••••"  // Mask sensitive values
                : s.value,
        }));

        return jsonResponse({ data: masked });
    } catch (e) {
        logger.error("Super Admin GET Settings Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

        const db = getTenantClient(null);
        const body = await req.json();
        const { settings } = body as { settings: Array<{ key: string; value: string; group?: string }> };

        if (!Array.isArray(settings) || settings.length === 0) {
            return errorResponse("settings array is required", 400);
        }

        // Validate all keys are allowed platform setting keys
        const invalidKeys = settings.filter((s) => !PLATFORM_SETTING_KEYS.includes(s.key));
        if (invalidKeys.length > 0) {
            return errorResponse(
                `Invalid setting keys: ${invalidKeys.map((k) => k.key).join(", ")}`,
                400,
                "INVALID_SETTING_KEYS"
            );
        }

        // Upsert each setting
        const upserted = await Promise.all(
            settings.map((s) =>
                db.systemSetting.upsert({
                    where: { key_tenantId: { key: s.key, tenantId: null as unknown as string } },
                    update: { value: s.value, group: s.group || "platform" },
                    create: {
                        key: s.key,
                        value: s.value,
                        group: s.group || "platform",
                        tenantId: null, // Always null for platform settings
                    },
                })
            )
        );

        await writeAuditLog({
            tenantId: "platform",
            userId: guard.user.userId,
            action: "PLATFORM_UPDATE_SETTINGS",
            resource: "SystemSetting",
            details: {
                updatedKeys: settings.map((s) => s.key),
                count: settings.length,
            },
            ipAddress: getIpFromRequest(req),
        }).catch(() => {});

        return jsonResponse({
            message: `${upserted.length} platform setting(s) updated.`,
            count: upserted.length,
        });
    } catch (e) {
        logger.error("Super Admin POST Settings Error:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
