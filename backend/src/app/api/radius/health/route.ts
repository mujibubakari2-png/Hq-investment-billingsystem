import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { getTenantFilter } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac";
import { backfillRadiusAccountingTenants } from "@/lib/radiusTenant";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// GET /api/radius/health — check FreeRADIUS service status
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "radius:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        const globalDb = getTenantClient(null);

        const { filter } = getTenantFilter(userPayload);
        await backfillRadiusAccountingTenants(globalDb);

        // ── 1. Database checks ────────────────────────────────────────────────
        const [radcheckCount, nasCount, activeSessionCount, radreplyCount, unmappedActiveSessionCount] = await Promise.all([
            db.radCheck.count({ where: { ...filter } }),
            db.radiusNas.count({ where: { ...filter } }),
            db.radAcct.count({ where: { acctstoptime: null, ...filter } }),
            db.radReply.count({ where: { ...filter } }),
            globalDb.radAcct.count({ where: { acctstoptime: null, tenantId: null } }),
        ]);

        // ── 2. FreeRADIUS process check (server-side) ─────────────────────────
        let freeradiusRunning = false;
        let freeradiusError: string | null = null;

        try {
            const { stdout } = await execAsync(
                "systemctl is-active freeradius 2>/dev/null || echo 'inactive'",
                { timeout: 3000 }
            );
            freeradiusRunning = stdout.trim() === "active";
        } catch {
            freeradiusError = "Cannot check FreeRADIUS status (not a Linux systemd environment or insufficient permissions)";
        }

        // ── 3. Port check — is 1812/1813 open? ───────────────────────────────
        let port1812Open = false;
        let port1813Open = false;

        try {
            const { stdout: ss1812 } = await execAsync(
                "ss -ulnp 2>/dev/null | grep ':1812' | wc -l",
                { timeout: 3000 }
            );
            port1812Open = parseInt(ss1812.trim() || "0") > 0;

            const { stdout: ss1813 } = await execAsync(
                "ss -ulnp 2>/dev/null | grep ':1813' | wc -l",
                { timeout: 3000 }
            );
            port1813Open = parseInt(ss1813.trim() || "0") > 0;
        } catch {
            // Non-blocking — may not be available on all environments
        }

        // ── 4. NAS config warnings ────────────────────────────────────────────
        const warnings: string[] = [];

        if (nasCount === 0) {
            warnings.push(
                "No NAS clients registered. Go to RADIUS → NAS Clients and add your MikroTik router IP and shared secret."
            );
        }

        if (!freeradiusRunning && !freeradiusError) {
            warnings.push(
                "FreeRADIUS service is not running. SSH into the server and run: sudo bash backend/scripts/setup-freeradius.sh"
            );
        }

        if (radcheckCount === 0) {
            warnings.push(
                "No RADIUS users (radcheck entries) found. Create subscriptions or vouchers to populate credentials."
            );
        }

        if (radreplyCount === 0 && radcheckCount > 0) {
            warnings.push(
                "CRITICAL: No radreply entries found. MikroTik requires Session-Timeout in radreply to grant access. " +
                "Re-activate subscriptions or run syncRadiusUser() to populate radreply."
            );
        }

        if (!port1812Open && freeradiusRunning) {
            warnings.push(
                "Port 1812 (UDP) does not appear to be listening. Check: sudo ss -ulnp | grep 1812"
            );
        }

        if (unmappedActiveSessionCount > 0) {
            warnings.push(
                `${unmappedActiveSessionCount} active RADIUS accounting session(s) are not mapped to any tenant. ` +
                "Add the MikroTik NAS IP under RADIUS NAS Clients or ensure router host/wgTunnelIp matches NAS-IP-Address."
            );
        }

        // ── 5. Build status ───────────────────────────────────────────────────
        const overallStatus =
            freeradiusRunning && nasCount > 0 && radcheckCount > 0
                ? "healthy"
                : warnings.length > 0
                    ? "warning"
                    : "unknown";

        return jsonResponse({
            status: overallStatus,
            freeradius: {
                running: freeradiusRunning,
                port1812: port1812Open,
                port1813: port1813Open,
                error: freeradiusError,
            },
            database: {
                radcheckUsers: radcheckCount,
                radreplyEntries: radreplyCount,
                nasClients: nasCount,
                activeSessions: activeSessionCount,
                unmappedActiveSessions: unmappedActiveSessionCount,
            },
            warnings,
            fixCommand: freeradiusRunning
                ? null
                : "sudo bash backend/scripts/setup-freeradius.sh",
            mikrotikGuide: {
                step1_radius: "RADIUS → Add: Service=hotspot, Address=10.0.0.1 (WireGuard IP), Auth-Port=1812, Acct-Port=1813, Timeout=3000, Secret=<your_secret>",
                step2_hotspot: "IP → Hotspot → Servers → your server → RADIUS tab: enable 'Use RADIUS' and 'RADIUS Accounting'",
                step3_pppoe: "PPP → Profiles → your profile → General tab: set 'Use RADIUS' = yes",
                step4_timeout: "IMPORTANT: Set RADIUS Timeout to at least 3000ms in MikroTik to avoid 'RADIUS not respond' errors",
                secret: "Must match RADIUS_NAS_SECRET in your .env and in clients.conf on the Droplet",
            },
        });
    } catch (e) {
        console.error("RADIUS health check error:", e);
        return errorResponse("Internal server error", 500);
    }
}
