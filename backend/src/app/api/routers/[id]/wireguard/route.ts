import { NextRequest } from "next/server";

export const maxDuration = 30; // push-config now enqueues a BullMQ job and returns in <1s

import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { canAccessTenant } from "@/lib/tenant";
import { getMikroTikService, sanitizeMikroTikName } from "@/lib/mikrotik";
import { wireguardManager } from "@/lib/wireguard";
import { encryptRouterFields, decryptRouterFields } from "@/lib/encryption";
import { generateRadiusSecret } from "@/lib/routerProvisioning";
import { normalizeWizardScriptInputs } from "@/lib/routerWizardScriptBuilder";
import { enqueuePushConfig, getJobStatus } from "@/lib/queue";
import { exec } from "child_process";
import { promisify } from "util";
import logger from "@/lib/logger";
import { checkWireGuardReachability } from "@/lib/wireguardConnectivity";
const execAsync = promisify(exec);

async function getRouterWgFields(db: ReturnType<typeof getTenantClient>, routerId: string) {
    const router = await db.router.findFirst({
        where: { id: routerId },
        select: {
            wgPrivateKey: true,
            wgPublicKey: true,
            wgPeerPublicKey: true,
            wgPresharedKey: true,
            wgTunnelIp: true,
            wgServerEndpoint: true,
            wgListenPort: true,
            wgEnabled: true,
            wgConfiguredAt: true,
            host: true,
            name: true,
            id: true,
            tenantId: true,
            port: true,
            apiPort: true,
            password: true,
            username: true,
            radiusSecret: true,
        },
    });
    return router ? decryptRouterFields(router) : null;
}

async function updateRouterWgFields(db: ReturnType<typeof getTenantClient>, routerId: string, data: Record<string, any>) {
    const sanitizedData = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined)
    );
    if (Object.keys(sanitizedData).length === 0) return;
    const encryptedData = encryptRouterFields(sanitizedData);
    await db.router.update({
        where: { id: routerId },
        data: encryptedData,
    });
}

// ── GET /api/routers/[id]/wireguard — Get or generate WireGuard config ──────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const router = await getRouterWgFields(db, id);
        if (!router) return errorResponse("Router not found", 404);

        if (!canAccessTenant(userPayload, router.tenantId)) {
            return errorResponse("Unauthorized to access this router", 403);
        }

        let wgPrivateKey = router.wgPrivateKey;
        let wgPublicKey = router.wgPublicKey;
        let wgPeerPublicKey = router.wgPeerPublicKey;
        let wgPresharedKey = router.wgPresharedKey;
        let tunnelIp = router.wgTunnelIp;

        const configuredServerPublicKey = process.env.WG_SERVER_PUBLIC_KEY;

        const wgServerIp = await wireguardManager.getServerIp();
        const subnetPrefix = wgServerIp.split('.').slice(0, 3).join('.'); // e.g. "10.0.0"

        // M4 FIX: Tunnel IP assignment uses a Redis distributed lock to prevent
        // race conditions. Without a lock, two simultaneous GET requests (e.g. two
        // admins opening the WireGuard config page at the same time) can both read
        // the same usedIps list and be assigned the same tunnel IP.
        //
        // Mechanism: Redis SET NX EX (set-if-not-exists with expiry).
        //   - Only one process acquires the lock at a time.
        //   - Lock expires automatically after 10s to prevent deadlocks.
        //   - Loser waits 300ms and retries once before proceeding without lock
        //     (fail-open: better to have a minor collision risk than a broken UI).
        if (!tunnelIp || !tunnelIp.startsWith(`${subnetPrefix}.`)) {
            let lockAcquired = false;
            const lockKey = `hq:wg:ip-lock:${subnetPrefix}`;
            const lockVal = `${id}:${Date.now()}`;

            try {
                const { getRedisClient } = await import('@/lib/cache');
                const redis = getRedisClient();
                if (redis) {
                    // Try to acquire lock (NX = only if not exists, EX = expire in 10s)
                    const result = await redis.set(lockKey, lockVal, 'EX', 10, 'NX');
                    lockAcquired = result === 'OK';
                    if (!lockAcquired) {
                        // Another process holds the lock — wait briefly and try once more
                        await new Promise(r => setTimeout(r, 300));
                        const retry = await redis.set(lockKey, lockVal, 'EX', 10, 'NX');
                        lockAcquired = retry === 'OK';
                    }
                }
            } catch {
                // Redis unavailable — continue without lock (fail-open)
            }

            try {
                // WG-PEER-ID-001: cross-tenant lookup is required here — wg0 is a
                // single shared interface, so an IP taken by ANY tenant's router
                // must be treated as used, not just this tenant's rows.
                const globalDbForIp = getTenantClient(null);
                const allWgRouters = await globalDbForIp.router.findMany({
                    where: { id: { not: id }, wgTunnelIp: { not: null } },
                    select: { wgTunnelIp: true }
                });
                const usedIps = new Set(allWgRouters.map(r => r.wgTunnelIp));

                // WG-PEER-ID-001: also check the live kernel state on wg0, not just
                // the DB, so a candidate IP already held by an orphaned/undeleted
                // peer (DB drift) is skipped too instead of being reassigned and
                // silently stealing it from whatever peer currently has it.
                try {
                    const livePeers = await wireguardManager.listPeers();
                    for (const peer of livePeers) {
                        if (peer.allowedIps && peer.allowedIps !== '(none)') {
                            for (const cidr of peer.allowedIps.split(',')) {
                                usedIps.add(cidr.trim().replace(/\/(32|24)/, ''));
                            }
                        }
                    }
                } catch {
                    // wg not reachable — proceed with DB-only view (unique constraint
                    // at the DB layer is still the final safety net)
                }

                // Find first free IP from 200 to 250
                let nextIp = 200;
                while (usedIps.has(`${subnetPrefix}.${nextIp}`) && nextIp < 250) {
                    nextIp++;
                }
                if (usedIps.has(`${subnetPrefix}.${nextIp}`)) {
                    return errorResponse("No free WireGuard tunnel IPs available in this subnet (200-250 all in use). Contact platform support.", 409);
                }
                tunnelIp = `${subnetPrefix}.${nextIp}`;
                await updateRouterWgFields(db, id, { wgTunnelIp: tunnelIp });
            } finally {
                // Always release the lock
                if (lockAcquired) {
                    try {
                        const { getRedisClient } = await import('@/lib/cache');
                        const redis = getRedisClient();
                        if (redis) {
                            const current = await redis.get(lockKey);
                            // Only delete if we still own the lock (not expired + re-acquired by someone else)
                            if (current === lockVal) await redis.del(lockKey);
                        }
                    } catch { /* best-effort release */ }
                }
            }
        }

        if (!wgPrivateKey) {
            // Keys are now generated exclusively at router creation time.
            // Legacy routers without keys must be re-created or migrated.
            logger.warn(`Router ${id} is missing WireGuard keys. Keys should be generated at creation time.`);
        }

        // Always ensure the peer public key is correct, even if keys were already generated
        const realServerPubKey = await wireguardManager.getServerPublicKey();
        const currentServerPublicKey = realServerPubKey || configuredServerPublicKey;
        if (!currentServerPublicKey) {
            return errorResponse("WireGuard server public key is not configured", 500);
        }

        if (wgPeerPublicKey !== currentServerPublicKey) {
            wgPeerPublicKey = currentServerPublicKey;
            await updateRouterWgFields(db, id, { wgPeerPublicKey });
        }

        const serverTunnelIp = wgServerIp; // Use actual interface IP
        const listenPort = router.wgListenPort || 51820;

        // Resolve the public WireGuard endpoint from the configured values.
        // Prefer an explicit router setting, then WG_SERVER_ENDPOINT, then APP_URL/host, and finally the public IP env.
        const requestHost = req.headers.get("host")?.split(":")[0] || "localhost";
        const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
        let resolvedEndpoint = router.wgServerEndpoint || process.env.WG_SERVER_ENDPOINT || "";

        if (!resolvedEndpoint && appUrl) {
            try {
                resolvedEndpoint = new URL(appUrl).hostname;
            } catch {
                resolvedEndpoint = appUrl.replace(/^https?:\/\//, '').split('/')[0];
            }
        }

        if (!resolvedEndpoint) {
            resolvedEndpoint = process.env.SERVER_PUBLIC_IP || requestHost || "vpn.billing-system.local";
        }

        const serverEndpoint = resolvedEndpoint;
        const serverPort = parseInt(process.env.WG_SERVER_PORT || "51820");

        // Live tunnel status — check if the MikroTik peer has an active WireGuard handshake
        let tunnelActive = false;
        let lastHandshakeSeconds: number | null = null;
        try {
            const peers = await wireguardManager.listPeers();
            const peer = peers.find(p => p.publicKey === wgPublicKey);
            if (peer && peer.latestHandshake && peer.latestHandshake !== '0') {
                const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(peer.latestHandshake);
                lastHandshakeSeconds = ageSeconds;
                tunnelActive = ageSeconds < 180; // active if handshake < 3 minutes ago
            }
        } catch {
            // wg not available or no peers — not fatal
        }

        return jsonResponse({
            routerId: id,
            routerName: router.name,
            routerHost: router.host,
            enabled: router.wgEnabled || false,
            configuredAt: router.wgConfiguredAt,

            routerPrivateKey: wgPrivateKey,
            routerPublicKey: wgPublicKey,
            serverPublicKey: wgPeerPublicKey,
            presharedKey: wgPresharedKey,

            routerTunnelIp: tunnelIp,
            serverTunnelIp,
            listenPort,
            serverEndpoint,
            serverPort,

            // Live tunnel health
            tunnelActive,
            lastHandshakeSeconds,
            tunnelStatusMessage: (() => {
                if (tunnelActive) {
                    const age = lastHandshakeSeconds!;
                    const display = age < 60 ? `${age}s` : age < 3600 ? `${Math.floor(age / 60)}m` : `${Math.floor(age / 3600)}h`;
                    return `Secure tunnel active — last handshake ${display} ago. WinBox and WebFig are accessible via VPN.`;
                }
                if (lastHandshakeSeconds !== null) {
                    const age = lastHandshakeSeconds;
                    const display = age < 60 ? `${age}s` : age < 3600 ? `${Math.floor(age / 60)}m` : `${Math.floor(age / 3600)}h`;
                    return `Last handshake was ${display} ago (>3 min). MikroTik may have disconnected. Check WireGuard on the router.`;
                }
                if (router.wgEnabled) {
                    return `Tunnel configured but no handshake detected yet. On MikroTik: open WireGuard peers list and verify the server endpoint (${serverEndpoint}:${serverPort}) is reachable. Ensure UDP port ${serverPort} is open on the VPS firewall.`;
                }
                return `WireGuard not yet activated. Use Setup Wizard → WireGuard tab to push the config to this router.`;
            })(),
        });
    } catch (err: any) {
        logger.error("WireGuard config error:", { error: err instanceof Error ? err.message : String(err) });
        return errorResponse("Failed to get WireGuard config", 500);
    }
}

// ── POST /api/routers/[id]/wireguard — Activate WireGuard & configure ──────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const guard = requirePermission(req, "routers:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { id } = await params;
        const body = await req.json();
        const action = body.action || "activate";
        const lanPorts: string[] = normalizeWizardScriptInputs({ selectedInterfaces: Array.isArray(body.lanPorts) ? body.lanPorts : [] }).selectedInterfaces;

        const router = await getRouterWgFields(db, id);
        if (!router) return errorResponse("Router not found", 404);

        if (!canAccessTenant(userPayload, router.tenantId)) {
            return errorResponse("Unauthorized to modify this router", 403);
        }

        if (action === "deactivate") {
            try {
                if (router.wgPublicKey) {
                    await wireguardManager.removePeer(router.wgPublicKey);
                }
            } catch (err) {
                logger.error("Failed to remove wireguard peer:", { error: err instanceof Error ? err.message : String(err) });
            }

            await updateRouterWgFields(db, id, { wgEnabled: false });

            await db.routerLog.create({
                data: {
                    routerId: id,
                    action: "wireguard_deactivated",
                    details: `WireGuard VPN deactivated for ${router.name}`,
                    status: "success",
                },
            });

            return jsonResponse({ success: true, message: "WireGuard deactivated" });
        }

        // reset-host: restore the router's host back to its original public IP so it's reachable again
        if (action === "reset-host") {
            const newHost = body.host;
            if (!newHost) return errorResponse("Provide the original public IP as 'host' in the request body", 400);

            await updateRouterWgFields(db, id, { host: newHost });
            // Also update via Prisma so it's reflected everywhere
            await db.router.update({ where: { id }, data: { host: newHost, status: "OFFLINE" } });

            await db.routerLog.create({
                data: {
                    routerId: id,
                    action: "wireguard_host_reset",
                    details: `Router host reset to ${newHost} by Admin ID: ${userPayload.userId}. WireGuard tunnel was unreachable.`,
                    status: "success",
                },
            });

            return jsonResponse({
                success: true,
                message: `Router host reset to ${newHost}. You can now test the connection using the original IP.`,
            });
        }

        // Ensure keys exist
        if (!router.wgPrivateKey || !router.wgPublicKey) {
            return errorResponse("WireGuard keys not generated. Open config first.", 400);
        }

        const wgServerIp = await wireguardManager.getServerIp();
        const subnetPrefix = wgServerIp.split('.').slice(0, 3).join('.');

        let tunnelIp = router.wgTunnelIp;
        if (!tunnelIp || !tunnelIp.startsWith(`${subnetPrefix}.`)) {
            tunnelIp = `${subnetPrefix}.200`; // Fallback
        }

        // ── READ LAN CONFIG FROM DB (canonical source) ───────────────────────
        // Root cause fix for "missing metadata" bug: push-config was IGNORING
        // the DB fields (lanIp, lanGateway, etc.) and deriving its own values
        // from the VPN tunnel IP. Now we prefer DB values and fall back to
        // VPN-derived values only when the DB has no entry yet.
        const tunnelParts = tunnelIp.split('.');
        const vpnDerivedPrefix = `${tunnelParts[0]}.10.${tunnelParts[2] || '0'}`; // e.g. "10.10.0"

        // Read the full router record for LAN metadata (getRouterWgFields only selects WG fields)
        const routerFull = await (async () => {
            try { return await db.router.findUnique({ where: { id } }); } catch { return null; }
        })();
        const dbLanGateway   = routerFull?.lanGateway as string | null;
        const dbLanIp        = routerFull?.lanIp as string | null;
        const dbHsPool       = routerFull?.hotspotPoolRange as string | null;
        const dbPpoePool     = routerFull?.pppoePoolRange as string | null;
        const dbDns          = routerFull?.dns as string | null;

        const lanGateway = dbLanGateway || `${vpnDerivedPrefix}.1`;
        const lanCidr    = dbLanIp     || `${lanGateway}/24`;
        const lanNetwork = `${lanGateway.split('.').slice(0,3).join('.')}.0/24`;
        const lanPoolStart = `${lanGateway.split('.').slice(0,3).join('.')}.10`;
        const lanPoolEnd   = `${lanGateway.split('.').slice(0,3).join('.')}.254`;
        const listenPort = router.wgListenPort || 51820;

        // Resolve the public WireGuard endpoint from the configured values.
        // Prefer an explicit router setting, then WG_SERVER_ENDPOINT, then APP_URL/host, and finally the public IP env.
        const requestHost = req.headers.get("host")?.split(":")[0] || "localhost";
        const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
        let resolvedEndpoint = router.wgServerEndpoint || process.env.WG_SERVER_ENDPOINT || "";

        if (!resolvedEndpoint && appUrl) {
            try {
                resolvedEndpoint = new URL(appUrl).hostname;
            } catch {
                resolvedEndpoint = appUrl.replace(/^https?:\/\//, '').split('/')[0];
            }
        }

        if (!resolvedEndpoint) {
            resolvedEndpoint = process.env.SERVER_PUBLIC_IP || requestHost || "vpn.billing-system.local";
        }

        const serverEndpoint = resolvedEndpoint;
        const serverPort = parseInt(process.env.WG_SERVER_PORT || "51820");

        // ── ASYNC PUSH-CONFIG: enqueue to BullMQ worker ─────────────────────
        // Root cause fix for 504 Gateway Timeout:
        // The original synchronous HTTP handler executed ~50 sequential MikroTik
        // REST API calls. When DROP WAN fired mid-loop, it killed the server's WAN
        // connection, causing ~16 subsequent calls to each time out at 8s = 128s,
        // which exceeded nginx's proxy_read_timeout (120s) → 504.
        //
        // Fix: return a jobId immediately (~<1s) and let the BullMQ worker execute
        // the provisioning pipeline without any HTTP timeout constraints.
        // The worker runs executePushConfig from pushConfigExecutor.ts which has
        // the phased firewall fix (ACCEPT first, connectivity check, DROP last,
        // rollback on unreachable).
        if (action === "push-config") {
            let jobId: string;
            try {
                jobId = await enqueuePushConfig(
                    id,
                    userPayload.tenantId ?? null,
                    {
                        lanPorts,
                        serverEndpoint,
                        serverPort,
                    }
                );
            } catch (err: any) {
                logger.error("[wireguard/push-config] Failed to enqueue job", { routerId: id, error: err.message });
                return errorResponse("Failed to queue Auto-Push job: " + err.message, 500);
            }

            try {
                await db.routerLog.create({
                    data: {
                        routerId: id,
                        action: "push_config_queued",
                        details: `Auto-Push job queued by ${userPayload.role} (${userPayload.userId}). Job ID: ${jobId}`,
                        status: "success",
                    },
                });
            } catch { /* non-fatal audit failure */ }

            return jsonResponse({
                success: true,
                jobId,
                status: "QUEUED",
                message: "Auto-Push job queued. Your router will be provisioned in the background.",
                pollUrl: `/api/routers/${id}/wireguard/job/${jobId}`,
            });
        }




        // Default: manual activate (user pasted the script on MikroTik)
        try {
            // Aggressive Cleanup: Remove any peer that is not actively registered in the DB
            //
            // CRITICAL FIX (WG-TENANT-WIPE-001): This lookup MUST be cross-tenant/unscoped.
            // The WireGuard server (wg0) has no concept of "tenant" — a single physical
            // interface holds peers for every tenant's routers system-wide. The previous
            // code used the tenant-scoped `db` (getTenantClient(userPayload)) to build
            // `validKeys`, which only ever contained THIS tenant's routers. Every other
            // tenant's router — even one with a perfectly healthy, currently-connected
            // handshake — was invisible to that query and therefore got its peer entry
            // DESTROYED below, every single time ANY tenant clicked "Activate" for their
            // own router. That is very likely why activation "keeps failing" even when the
            // MikroTik-side firewall is clean: another tenant's activation attempt (or an
            // earlier one on this same platform) may have wiped this router's peer moments
            // after it registered a handshake.
            const globalDb = getTenantClient(null);
            const allValidRouters = await globalDb.router.findMany({
                where: { wgPublicKey: { not: null } },
                select: { wgPublicKey: true }
            });
            const validKeys = new Set(allValidRouters.map(r => r.wgPublicKey));

            const allPeers = await wireguardManager.listPeers();
            for (const peer of allPeers) {
                // Keep the current router being activated
                if (peer.publicKey === router.wgPublicKey) continue;

                // If peer is not in the database, OR it has lost its allowed IP, destroy it
                if (!validKeys.has(peer.publicKey) || peer.allowedIps === "(none)") {
                    await wireguardManager.removePeer(peer.publicKey);
                }
            }

            await wireguardManager.addPeer(router.wgPublicKey, tunnelIp, router.wgPresharedKey || undefined);
        } catch (err: any) {
            logger.error("Failed to add peer:", { error: err instanceof Error ? err.message : String(err) });
            return errorResponse("Failed to add peer to server", 500);
        }

        // Wait briefly for MikroTik to initiate the WireGuard handshake.
        // FIX-504: Reduced from 8s → 4s. The 8s blocking wait inside a Next.js
        // API route was reliably causing 504 timeouts from the reverse proxy.
        // The user can trigger verification again from Step 6 of the wizard.
        await new Promise(resolve => setTimeout(resolve, 4000));
        const peerConnected = router.wgPublicKey
            ? await wireguardManager.checkPeerHandshake(router.wgPublicKey).catch(() => false)
            : false;

        const activateData: Record<string, any> = {
            wgEnabled: true,
            wgConfiguredAt: new Date(),
        };

        let pingResult = "Ping not attempted";
        let responseMessage: string;

        if (peerConnected) {
            // Only switch host to tunnel IP once tunnel is actually confirmed.
            // ICMP may be blocked by the router or runtime, so the handshake remains the
            // authoritative success signal and ping output is reported separately.
            activateData.host = tunnelIp;
            const connectivity = await checkWireGuardReachability(tunnelIp);
            pingResult = connectivity.output;
            responseMessage = connectivity.ok
                ? `WireGuard tunnel established! Router is now accessible via tunnel IP ${tunnelIp}.\n\nPing result:\n${pingResult.substring(0, 180)}`
                : `WireGuard tunnel established! Router is reachable through the WireGuard handshake, and the tunnel is active on ${tunnelIp}. ICMP ping did not succeed.\n\nCommon causes:\n• WireGuard IP assigned as /32 instead of /24 (no subnet route — replies exit via WAN). Fix: re-run push-config or set /24 manually.\n• MikroTik firewall INPUT chain dropping ICMP from wg-hq.\n• REST API (www/www-ssl service) not enabled on the router.\n\n${pingResult.substring(0, 220)}`;
            logger.info(`[WireGuard] Activate: peer ${tunnelIp} connected via handshake. Switching host to tunnel IP.`, {
                connectivityReason: connectivity.reason,
            });
        } else {
            // Handshake not confirmed — keep original host to preserve connectivity
            logger.warn(`[WireGuard] Activate: peer ${tunnelIp} has NOT completed a WireGuard handshake. Keeping original host IP to preserve connectivity.`);
            responseMessage = `WireGuard peer registered on server, but MikroTik has NOT connected yet (no handshake).\n\nTo fix:\n1. Verify the config was pasted correctly on MikroTik.\n2. Check UDP port ${listenPort} is open on MikroTik (firewall rule must be above any DROP rule).\n3. Run on Droplet: sudo wg show wg0\n4. Once the MikroTik peer appears with a handshake, click Activate again.`;
        }

        await updateRouterWgFields(db, id, activateData);

        await db.routerLog.create({
            data: {
                routerId: id,
                action: "wireguard_activated",
                details: `WireGuard activation for ${router.name}. Tunnel ${peerConnected ? 'verified — host switched to ' + tunnelIp : 'NOT yet connected — original host preserved'}.`,
                status: "success",
            },
        });

        return jsonResponse({
            success: peerConnected,
            tunnelVerified: peerConnected,
            message: responseMessage,
        });
    } catch (err: any) {
        logger.error("WireGuard activate error:", { error: err instanceof Error ? err.message : String(err) });
        return errorResponse("Failed to activate WireGuard", 500);
    }
}
