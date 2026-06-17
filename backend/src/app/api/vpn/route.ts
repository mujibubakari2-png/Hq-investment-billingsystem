import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { getTenantFilter } from "@/lib/tenant";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { encrypt, decrypt } from "@/lib/encryption";
import { VpnUserCreateSchema } from "@/lib/validators";

// GET /api/vpn – list VPN users (from ppp secrets stored in a table)
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "vpn:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        const { filter: tenantFilter } = getTenantFilter(userPayload);

        const vpnUsers = await db.vpnUser.findMany({
            where: { ...tenantFilter },
            include: { router: { select: { id: true, name: true, host: true } } },
            orderBy: { createdAt: "desc" },
        });

        const result = vpnUsers.map(v => ({
            id: v.id,
            username: v.username,
            fullName: v.fullName || "",
            serverAddress: v.router?.host || "",
            protocol: v.protocol,
            localAddress: v.localAddress || "",
            remoteAddress: v.remoteAddress || "",
            status: v.status,
            routerId: v.routerId,
            routerName: v.router?.name || "—",
            profile: v.profile || "default",
            uptime: v.uptime || "—",
            bytesIn: v.bytesIn || "0 B",
            bytesOut: v.bytesOut || "0 B",
            connectedAt: v.connectedAt ? new Date(v.connectedAt).toLocaleString() : "Never",
            createdAt: new Date(v.createdAt).toLocaleDateString(),
            // VPN-001: Never return the raw or decrypted password to the client
            hasPassword: !!v.password,
        }));

        return jsonResponse(result);
    } catch (e) {
        console.error("VPN list error:", e);
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "vpn:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";

        const body = await req.json() as any;
        const parsed = VpnUserCreateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const { username, password, fullName, protocol, profile, localAddress, remoteAddress, routerId, service } = parsed.data as any;

        // Verify router belongs to user's tenant
        const router = await db.router.findUnique({ where: { id: routerId } });
        if (!router) return errorResponse("Router not found", 404);
        if (!isSuperAdmin && router.tenantId !== userPayload.tenantId) {
            return errorResponse("Forbidden", 403);
        }

        const tenantIdValue = isSuperAdmin ? router.tenantId : userPayload.tenantId;

        // Check for duplicate username within the same tenant
        const existing = await db.vpnUser.findFirst({
            where: { username, tenantId: tenantIdValue }
        });
        if (existing) return errorResponse("VPN username already exists for this tenant", 409);

        const vpnUser = await db.vpnUser.create({
            data: {
                username,
                // VPN-001 FIX: Encrypt password at rest. For WireGuard, 'password' holds
                // the public key which is not a secret, so encryption is safe either way.
                password: encrypt(password) ?? password,
                fullName: fullName || null,
                protocol: protocol || "L2TP",
                profile: profile || "default",
                localAddress: localAddress || null,
                remoteAddress: remoteAddress || null,
                service: service || "l2tp",
                routerId,
                status: "Active",
                tenantId: tenantIdValue,
            },
        });

        // ── 2. Push to MikroTik ──
        try {
            const { getMikroTikService } = await import("@/lib/mikrotik");
            const mt = await getMikroTikService(routerId, userPayload.tenantId);

            if (protocol === "WireGuard") {
                // 1. Push to MikroTik
                let allowedAddress = remoteAddress || "";
                if (allowedAddress && !allowedAddress.includes("/")) {
                    allowedAddress += "/32";
                }

                await mt.createWireGuardPeer({
                    publicKey: password,
                    allowedAddress: allowedAddress || "0.0.0.0/0",
                    comment: `VPN:${username}`,
                });

                // 2. Add Peer to Droplet (Local Server)
                try {
                    const { wireguardManager } = await import("@/lib/wireguard");
                    // 'password' field is being used as the Peer's Public Key
                    await wireguardManager.addPeer(password, remoteAddress || "10.0.0.2");
                } catch (wgErr: any) {
                    console.error("Failed to add peer to Droplet WireGuard:", wgErr);
                    // Don't fail the whole request, but log it
                }
            } else {
                await mt.createVpnUser({
                    name: username,
                    // VPN-001: Decrypt before sending to MikroTik — the router needs plaintext
                    password: decrypt(vpnUser.password) ?? password,
                    service: service || "any",
                    profile: profile || "default",
                    localAddress: localAddress,
                    remoteAddress: remoteAddress,
                });
            }
        } catch (err: any) {
            console.error("Failed to push VPN user to MikroTik:", err);
            // We keep the DB record but warn
            return jsonResponse({ ...vpnUser, warning: "Saved to database but failed to push to router: " + err.message }, 201);
        }

        return jsonResponse(vpnUser, 201);
    } catch (e) {
        console.error("VPN create error:", e);
        return errorResponse("Internal server error", 500);
    }
}

