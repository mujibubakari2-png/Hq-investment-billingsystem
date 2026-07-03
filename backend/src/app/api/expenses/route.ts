import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { parseSafeDate, toISOSafe } from "@/lib/dateUtils";
import { ExpenseCreateSchema } from "@/lib/validators";
import { getAssignTenantId, getTenantFilter } from "@/lib/tenant";
import logger from "@/lib/logger";

// GET /api/expenses
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "expenses:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const { filter: tenantFilter } = getTenantFilter(userPayload);

        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category") || "";
        const search   = searchParams.get("search")   || "";
        const page     = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const limit    = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100")));
        const skip     = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { ...tenantFilter };
        if (category) where.category = category;
        if (search) {
            where.OR = [
                { description: { contains: search, mode: "insensitive" } },
                { reference: { contains: search, mode: "insensitive" } },
            ];
        }

        const [expenses, total] = await Promise.all([
            db.expense.findMany({
                where,
                include: { createdBy: { select: { username: true } }, tenant: { select: { name: true } } },
                orderBy: { date: "desc" },
                skip,
                take: limit,
            }),
            db.expense.count({ where }),
        ]);

        const mapped = expenses.map((e: {
            id: string;
            category: string;
            description: string;
            amount: number;
            date: Date;
            reference: string | null;
            createdBy: { username: string };
            tenant?: { name: string } | null;
        }) => ({
            id: e.id,
            category: e.category,
            description: e.description,
            amount: e.amount,
            date: toISOSafe(e.date),
            reference: e.reference,
            createdBy: e.createdBy.username,
            tenantName: e.tenant?.name ?? null,
        }));

        return jsonResponse({ data: mapped, total, page, limit });
    } catch (e) {
        logger.error("[route] error", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/expenses
export async function POST(req: NextRequest) {
    try {
        const guard = requirePermission(req, "expenses:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const body = await req.json();
        const parsed = ExpenseCreateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const { category, description, amount, date, reference, receipt } = parsed.data;

        let createdById: string | undefined = userPayload.userId;
        if (!createdById) {
            const tenantIdForLookup = getAssignTenantId(userPayload, body.tenantId ?? null);
            const admin = await db.user.findFirst({
                where: {
                    role: { in: ["ADMIN", "SUPER_ADMIN"] },
                    ...(tenantIdForLookup ? { tenantId: tenantIdForLookup } : {})
                }
            });
            createdById = admin?.id;
        }

        if (!createdById) {
            return errorResponse("Creator user ID is required");
        }

        const creatorId = createdById;
        const tenantIdValue = getAssignTenantId(userPayload, body.tenantId ?? null);

        const expense = await db.expense.create({
            data: {
                category,
                description,
                amount,
                date: parseSafeDate(date as any) || new Date(),
                reference,
                receipt,
                createdById: creatorId,
                tenantId: tenantIdValue
            },
        });

        return jsonResponse({
            ...expense,
            amount_value: expense.amount, // Alias
            created_by: expense.createdById, // Alias
        }, 201);
    } catch (e) {
        logger.error("EXPENSE POST ERROR:", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

