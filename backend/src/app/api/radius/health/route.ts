import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { getTenantFilter } from "@/lib/tenant";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// GET /api/radius/health — check FreeRADIUS service status
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { filter } = getTenantFilter(userPayload);

        // ── 1. Database checks ────────────────────────────────────────────────
        const [radcheckCount, nasCount, activeSessionCount] = await Promise.all([
            prisma.radCheck.count({ where: { ...filter } }),
            prisma.radiusNas.count({ where: { ...filter } }),
            prisma.radAcct.count({ where: { acctstoptime: null, ...filter } }),
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
            const { stdout: ssOut } = await execAsync(
                "ss -ulnp 2>/dev/null | grep -E ':181[23]' | wc -l",
                { timeout: 3000 }
            );
            const portCount = parseInt(ssOut.trim() || "0");
            port1812Open = portCount >= 1;
            port1813Open = portCount >= 2;
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
                "No RADIUS users (radcheck entries) found. Create subscriptions or RADIUS users to populate credentials."
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
                nasClients: nasCount,
                activeSessions: activeSessionCount,
            },
            warnings,
            fixCommand: freeradiusRunning
                ? null
                : "sudo bash backend/scripts/setup-freeradius.sh",
            mikrotikGuide: {
                radiusAddress: "10.0.0.1  (WireGuard IP) or your Droplet public IP",
                authPort: 1812,
                acctPort: 1813,
                secret: "Must match the 'secret' field in your NAS client entry",
                hotspotSettings:
                    "IP → Hotspot → Servers → your server → RADIUS tab: enable 'Use RADIUS' and 'RADIUS Accounting'",
            },
        });
    } catch (e) {
        console.error("RADIUS health check error:", e);
        return errorResponse("Internal server error", 500);
    }
}
