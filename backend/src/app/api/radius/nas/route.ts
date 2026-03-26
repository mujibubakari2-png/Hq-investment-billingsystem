import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// GET /api/radius/nas – list NAS clients
export async function GET(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const nasList = await prisma.radiusNas.findMany({
            orderBy: { createdAt: "desc" },
        });

        const result = nasList.map(n => ({
            id: n.id,
            nasName: n.nasName,
            shortName: n.shortName || "",
            type: n.type,
            ports: n.ports,
            secret: n.secret,
            server: n.server || "",
            description: n.description || "",
            createdAt: new Date(n.createdAt).toLocaleDateString(),
        }));

        return jsonResponse(result);
    } catch (e) {
        console.error("NAS list error:", e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/radius/nas – create NAS client
export async function POST(req: NextRequest) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const body = await req.json();
        const { nasName, shortName, type, ports, secret, server, description } = body;

        if (!nasName || !secret) {
            return errorResponse("NAS name and secret are required", 400);
        }

        const nas = await prisma.radiusNas.create({
            data: {
                nasName,
                shortName: shortName || null,
                type: type || "other",
                ports: ports || 0,
                secret,
                server: server || null,
                description: description || null,
            },
        });

        return jsonResponse(nas, 201);
    } catch (e) {
        console.error("NAS create error:", e);
        return errorResponse("Internal server error", 500);
    }
}
