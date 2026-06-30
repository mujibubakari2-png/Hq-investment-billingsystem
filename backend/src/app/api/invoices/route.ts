import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { getTenantFilter } from "@/lib/tenant";
import { jsonResponse, errorResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { toISOSafe, parseSafeDate } from "@/lib/dateUtils";
import { InvoiceCreateSchema } from "@/lib/validators";

// GET /api/invoices
export async function GET(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN", "ADMIN");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);
        const { filter: tenantFilter } = getTenantFilter(userPayload);

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status") || "";
        const search = searchParams.get("search") || "";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { ...tenantFilter };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { invoiceNumber: { contains: search, mode: "insensitive" } },
                { client: { username: { contains: search, mode: "insensitive" } } },
            ];
        }

        const invoices = await db.invoice.findMany({
            where,
            include: { client: { select: { username: true, fullName: true } }, items: true },
            orderBy: { createdAt: "desc" },
        });

        const mapped = invoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            client: inv.client ? { username: inv.client.username, fullName: inv.client.fullName } : null,
            amount: inv.amount,
            status: inv.status,
            dueDate: inv.dueDate ? toISOSafe(inv.dueDate) : null,
            items: (inv.items || []).map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, total: it.total })),
            createdAt: toISOSafe(inv.createdAt),
        }));

        return jsonResponse(mapped);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/invoices
export async function POST(req: NextRequest) {
    try {
        const guard = requireRole(req, "SUPER_ADMIN", "ADMIN");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const isSuperAdmin = userPayload.role === "SUPER_ADMIN";
        const body = await req.json() as any;
        const parsed = InvoiceCreateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const data = parsed.data;

        let invoiceTenantId = userPayload.tenantId ?? null;

        // API-002 FIX: Validate that clientId belongs to the requesting tenant.
        if (data.clientId) {
            const client = await db.client.findUnique({ where: { id: data.clientId } });
            if (!client) return errorResponse("Client not found", 404);
            if (!isSuperAdmin && client.tenantId !== userPayload.tenantId) {
                return errorResponse("Forbidden: client does not belong to your tenant", 403);
            }
            if (isSuperAdmin && data.tenantId && data.tenantId !== client.tenantId) {
                return errorResponse("Forbidden: tenantId does not match invoice client", 403);
            }
            invoiceTenantId = client.tenantId;
        } else if (isSuperAdmin) {
            if (!data.tenantId) {
                return errorResponse("tenantId is required when creating an invoice without a client", 400);
            }
            const tenant = await db.tenant.findUnique({ where: { id: data.tenantId } });
            if (!tenant) return errorResponse("Tenant not found", 404);
            invoiceTenantId = data.tenantId;
        }

        const invoiceData: any = {
            invoiceNumber: data.invoiceNumber || `INV-${Date.now()}`,
            amount: data.amount,
            status: (data.status || "DRAFT") as any,
            dueDate: parseSafeDate(data.dueDate) || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            issuedDate: parseSafeDate(data.issuedDate) || new Date(),
            tenantId: invoiceTenantId,
            items: {
                create: (data.items || []).map((item: { description: string; quantity: number; unitPrice: number; total: number }) => ({
                    description: item.description,
                    quantity: parseInt(String(item.quantity)),
                    unitPrice: parseFloat(String(item.unitPrice)),
                    total: parseFloat(String(item.total)),
                    tenantId: invoiceTenantId,
                })),
            },
        };

        if (data.clientId) {
            invoiceData.clientId = data.clientId;
        }

        const invoice = await db.invoice.create({
            data: invoiceData,
            include: { items: true },
        });

        return jsonResponse(invoice, 201);
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}
