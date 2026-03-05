import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { jsonResponse, errorResponse } from "@/lib/auth";

// GET /api/settings
export async function GET() {
    try {
        const settings = await prisma.systemSetting.findMany();
        const mapped: Record<string, string> = {};
        settings.forEach((s) => {
            mapped[s.key] = s.value;
        });
        return jsonResponse(mapped);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// PUT /api/settings - update settings (accepts key-value pairs)
export async function PUT(req: NextRequest) {
    try {
        const body = await req.json();

        for (const [key, value] of Object.entries(body)) {
            await prisma.systemSetting.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) },
            });
        }

        return jsonResponse({ message: "Settings updated" });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
