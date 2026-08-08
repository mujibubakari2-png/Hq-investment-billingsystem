import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { requireRole } from "@/lib/rbac";
import { errorResponse, jsonResponse } from "@/lib/auth";
import type { Prisma } from "@/generated/prisma";
import logger from "@/lib/logger";

// GET /api/super-admin/cms/contacts
export async function GET(req: NextRequest) {
  try {
    const guard = requireRole(req, "SUPER_ADMIN");
    if (guard.error) return guard.error;
    if (guard.user.tenantId) return errorResponse("Access denied", 403, "NOT_PLATFORM_ADMIN");

    const db = getTenantClient(null);
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    const where: Prisma.ContactMessageWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      db.contactMessage.count({ where }),
      db.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    ]);

    return jsonResponse({ success: true, data, meta: { total, page, totalPages: Math.ceil(total / limit) } });
  } catch (e) {
    logger.error("Super Admin GET Contacts Error:", { error: e instanceof Error ? e.message : String(e) });
    return errorResponse("Internal server error", 500);
  }
}
