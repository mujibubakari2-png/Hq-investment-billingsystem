import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/vpn – list VPN users (from ppp secrets stored in a table)
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const vpnUsers = await prisma.vpnUser.findMany({
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

// POST /api/vpn – create VPN user
export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const body = await req.json();
        const { username, password, fullName, protocol, profile, localAddress, remoteAddress, routerId, service } = body;

        if (!username || !password || !routerId) {
            return errorResponse("Username, password, and routerId are required", 400);
        }

        // Check for duplicate username
        const existing = await prisma.vpnUser.findUnique({ where: { username } });
        if (existing) return errorResponse("VPN username already exists", 409);

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
            },
        });

        return jsonResponse(vpnUser, 201);
    } catch (e) {
        console.error("VPN create error:", e);
        return errorResponse("Internal server error", 500);
    }
}
