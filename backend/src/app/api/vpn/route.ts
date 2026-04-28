import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/vpn – list VPN users (from ppp secrets stored in a table)
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const tenantFilter = isSuperAdmin ? {} : { tenantId: userPayload.tenantId };

        const vpnUsers = await prisma.vpnUser.findMany({
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
        }));

        return jsonResponse(result);
    } catch (e) {
        console.error("VPN list error:", e);
        return errorResponse("Internal server error", 500);
    }
}

export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";

        const body = await req.json();
        const { username, password, fullName, protocol, profile, localAddress, remoteAddress, routerId, service } = body;

        if (!username || !password || !routerId) {
            return errorResponse("Username, password, and routerId are required", 400);
        }

        // Verify router belongs to user's tenant
        const router = await prisma.router.findUnique({ where: { id: routerId } });
        if (!router) return errorResponse("Router not found", 404);
        if (!isSuperAdmin && router.tenantId !== userPayload.tenantId) {
            return errorResponse("Forbidden", 403);
        }

        const tenantIdValue = isSuperAdmin ? router.tenantId : userPayload.tenantId;

        // Check for duplicate username within the same tenant
        const existing = await prisma.vpnUser.findFirst({ 
            where: { username, tenantId: tenantIdValue } 
        });
        if (existing) return errorResponse("VPN username already exists for this tenant", 409);

        const vpnUser = await prisma.vpnUser.create({
            data: {
                username,
                password,
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
                    password: password,
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
