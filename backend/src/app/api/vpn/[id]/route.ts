import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";

// DELETE /api/vpn/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userPayload = getUserFromRequest(req);
        if (!userPayload) return errorResponse("Unauthorized", 401);

        const { id } = await params;
        await prisma.vpnUser.delete({ where: { id } });
        return jsonResponse({ message: "VPN user deleted" });
    } catch (e) {
        console.error("VPN delete error:", e);
        return errorResponse("Internal server error", 500);
    }
}
