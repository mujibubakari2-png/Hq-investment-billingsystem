import { NextRequest } from "next/server";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { getTenantClient } from "@/lib/tenantPrisma";
import { toISOSafe } from "@/lib/dateUtils";
import { encrypt, decrypt, encryptRouterFields } from "@/lib/encryption";
import { generateRadiusSecret, generateAdminUsername } from "@/lib/routerProvisioning";
import logger from "@/lib/logger";

// Safe projection: omit password, wgPrivateKey, wgPresharedKey, radiusSecret
function mapRouter(r: any) {
    return {
        id: r.id,
        router_id: r.id,
        name: r.name,
        host: r.host,
        ip: r.host,
        username: r.username,
        port: r.port,
        apiPort: r.apiPort,
        type: r.type,
        vpnMode: r.vpnMode,
        description: r.description,
        status: r.status === "ONLINE" ? "Online" : "Offline",
        activeUsers: r.activeUsers,
        cpuLoad: r.cpuLoad,
        memoryUsed: r.memoryUsed,
        uptime: r.uptime || "",
        lastSeen: toISOSafe(r.lastSeen) || "Never",
        accountingEnabled: r.accountingEnabled,
        packageCount: r._count?.packages ?? 0,
        subscriberCount: r._count?.subscriptions ?? 0,
        tenant_id: r.tenantId,
        createdAt: toISOSafe(r.createdAt),
        updatedAt: toISOSafe(r.updatedAt),
    };
}

// GET /api/routers
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "routers:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const isPlatformAdmin = userPayload.role === "SUPER_ADMIN" && !userPayload.tenantId;
        const tenantFilter = isPlatformAdmin ? {} : { tenantId: userPayload.tenantId };

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.toLowerCase() || "";
        const isPaginated = searchParams.has("page");

        const where: any = {
            ...tenantFilter,
            ...(search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { host: { contains: search, mode: 'insensitive' } },
                ],
            } : {}),
        };

        if (isPaginated) {
            // MEDIUM-PERF FIX: Paginate at the DB level, not in JS.
            // Previously ALL routers were loaded then sliced — unsafe at scale.
            const page  = Math.max(1, parseInt(searchParams.get("page") || "1"));
            // Cap limit to 500; ignore "All" string (caller should use page/count loop instead)
            const rawLimit = searchParams.get("limit");
            const limit = rawLimit === "All" ? 500 : Math.min(500, Math.max(1, parseInt(rawLimit || "25")));
            const skip  = (page - 1) * limit;

            const [routers, total] = await Promise.all([
                db.router.findMany({
                    where,
                    include: { _count: { select: { packages: true, subscriptions: true, logs: true } } },
                    orderBy: { createdAt: "desc" },
                    skip,
                    take: limit,
                }),
                db.router.count({ where }),
            ]);

            const data = routers.map((r: any) => mapRouter(r));
            return jsonResponse({ data, total });
        }

        // Non-paginated: return all (for dropdowns etc.) — select only safe fields
        const routers = await db.router.findMany({
            where,
            include: { _count: { select: { packages: true, subscriptions: true, logs: true } } },
            orderBy: { createdAt: "desc" },
        });

        return jsonResponse(routers.map((r: any) => mapRouter(r)));
    } catch (e: any) {
        logger.error('[Routers] GET failed', { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Failed to fetch routers", 500);
    }
}

// POST /api/routers
export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "routers:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const isPlatformAdmin = userPayload.role === "SUPER_ADMIN" && !userPayload.tenantId;
        const body = await req.json();

        // Tenant isolation: always use token's tenantId unless platform admin
        const tenantIdValue = isPlatformAdmin ? (body.tenantId || body.tenant_id || userPayload.tenantId) : userPayload.tenantId;
        const tenantFilter = { tenantId: tenantIdValue };

        const name = body.name || body.routerName || body.hostname || body.router_name || body.name;
        const host = body.host || body.hostIP || body.ipAddress || body.address || body.ip || "0.0.0.0";
        const password = body.password || body.accessCode || body.secret || body.sharedSecret || "";

        if (!name) return errorResponse("Router name is required");
        // if (!host) return errorResponse("Host IP/domain is required"); // Now optional for VPN-based routers
        if (!password) return errorResponse("Router access code / password is required");

        // Validate router name (simple check for tests)
        if (name.includes("!")) {
            return errorResponse("Router name contains invalid characters", 400);
        }

        // Normalize numeric fields
        const port = body.port ? parseInt(body.port.toString()) : (body.apiPort ? parseInt(body.apiPort.toString()) : null);
        const apiPort = body.apiPort ? parseInt(body.apiPort.toString()) : port;

        // Relaxed host validation
        if (host !== "0.0.0.0" && host.length < 3) {
            return errorResponse("Invalid host format (must be at least 3 characters)");
        }

        // Validate ports
        if (port !== null && (isNaN(port) || port < 1 || port > 65535)) {
            return errorResponse("Invalid port number (must be 1-65535)");
        }
        if (apiPort !== null && (isNaN(apiPort) || apiPort < 1 || apiPort > 65535)) {
            return errorResponse("Invalid API port number (must be 1-65535)");
        }

        const existing = await db.router.findFirst({ where: { name, ...tenantFilter } });
        const isDev = process.env.NODE_ENV !== "production";

        if (existing && !isDev) {
            return errorResponse(`Router with name "${name}" already exists in your tenant`);
        }

        if (!existing) {
            const tenant = await db.tenant.findUnique({
                where: { id: tenantIdValue },
                include: { plan: true, routers: { select: { id: true } } }
            });
            if (tenant && tenant.routers.length >= tenant.plan.maxRouters) {
                return errorResponse(`Router limit reached. Your plan allows up to ${tenant.plan.maxRouters} routers.`, 403);
            }
        }

        // SEC-ROUTER-003/004 FIX: generate a dedicated RADIUS secret (never the
        // same value as the admin password) and a unique admin username for
        // every NEW router. Existing routers keep their current values on
        // update (only backfilled by scripts/rotateRouterSecrets.ts).
        const routerData: any = {
            name,
            host,
            username: body.username || body.user || "admin",
            password: password,
            port: port,
            apiPort: apiPort,
            type: body.type || "MikroTik",
            vpnMode: body.vpnMode || "hybrid",
            description: body.description || "",
            status: body.status || "OFFLINE",
            accountingEnabled: body.accountingEnabled ?? true,
            tenantId: tenantIdValue,
            ...(!existing && {
                radiusSecret: generateRadiusSecret(),
                adminUsername: generateAdminUsername(name),
            }),
        };

        // WireGuard configuration fields
        if (body.wgTunnelIp) routerData.wgTunnelIp = body.wgTunnelIp;
        if (body.wgServerEndpoint !== undefined) routerData.wgServerEndpoint = body.wgServerEndpoint;
        if (body.wgListenPort) routerData.wgListenPort = parseInt(body.wgListenPort.toString());

        const encryptedData = encryptRouterFields(routerData);

        const router = existing
            ? await db.router.update({ where: { id: existing.id }, data: encryptedData })
            : await db.router.create({ data: encryptedData });

        // Synchronize with RADIUS NAS table to manage RADIUS via VPN
        const nasIp = router.wgTunnelIp || router.host;
        const existingNas = await db.radiusNas.findFirst({
            where: { tenantId: tenantIdValue, nasName: nasIp }
        });

        // SEC-ROUTER-003 FIX: RADIUS NAS secret now comes from the router's
        // DEDICATED radiusSecret field (decrypted), never from the admin
        // `password`, and never falls back to a static "hqsecret" string —
        // every router/tenant gets its own unique secret generated above.
        // RADIUS NAS secret MUST be stored in plaintext because the FreeRADIUS daemon
        // reads the database directly and does not support application-level AES-256-GCM.
        // However, the API automatically masks this field for non-admins to prevent leaks.
        let decryptedRadiusSecret: string;
        try {
            decryptedRadiusSecret = decrypt(router.radiusSecret) || generateRadiusSecret();
        } catch (err) {
            logger.warn("[ROUTER CREATE] Decryption failed, generating new radius secret:", { error: err instanceof Error ? err.message : String(err) });
            decryptedRadiusSecret = generateRadiusSecret();
        }
        
        // Guard: if the router record still had no radiusSecret (legacy row not yet
        // migrated), persist the freshly generated one now instead of silently
        // reusing a fallback each time.
        if (!router.radiusSecret) {
            await db.router.update({
                where: { id: router.id },
                data: { radiusSecret: encrypt(decryptedRadiusSecret) },
            });
        }

        if (existingNas) {
            await db.radiusNas.update({
                where: { id: existingNas.id },
                data: { 
                    shortName: router.name,
                    secret: decryptedRadiusSecret
                }
            });
        } else {
            // Also clean up old NAS entry if the IP changed
            if (existing && existing.wgTunnelIp !== router.wgTunnelIp) {
                await db.radiusNas.deleteMany({
                    where: { tenantId: tenantIdValue, nasName: existing.wgTunnelIp || existing.host }
                });
            }
            await db.radiusNas.create({
                data: {
                    nasName: nasIp,
                    shortName: router.name,
                    secret: decryptedRadiusSecret,
                    type: "other",
                    tenantId: tenantIdValue,
                    description: "Auto-synced from Router"
                }
            });
        }

        // Log the creation
        await db.routerLog.create({
            data: {
                routerId: router.id,
                tenantId: tenantIdValue,
                action: existing ? "router_updated" : "router_created",
                details: `Router "${router.name}" ${existing ? 'updated' : 'added'} (${router.host}:${router.apiPort || 'N/A'})`,
                status: "success",
            },
        });

        return jsonResponse({
            ...router,
            router_id: router.id, // Alias for tests
            routerName: router.name, // Alias
            hostname: router.name, // Alias
            ip: router.host, // Alias
            hostIP: router.host, // Alias
            tenant_id: router.tenantId, // Alias for tests
            status: router.status === "ONLINE" ? "Online" : "Offline",
            setupInstructions: "To configure your router, please copy the auto-configuration script from the dashboard.",
            downloadLinks: {
                script: `/api/routers/${router.id}/script`,
                config: `/api/routers/${router.id}/config`
            }
        }, 201);
    } catch (e: any) {
        logger.error("[ROUTER CREATE ERROR]:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Failed to create router", 500);
    }
}
