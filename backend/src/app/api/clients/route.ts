import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { jsonResponse, errorResponse, getUserFromRequest } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { toISOSafe } from "@/lib/dateUtils";
import { ClientCreateSchema } from "@/lib/validators";
import logger from "@/lib/logger";
import crypto from "crypto";

// GET /api/clients - List all clients
export async function GET(req: NextRequest) {
    try {
        const guard = requirePermission(req, "clients:read");
        if (guard.error) return guard.error;
        const userPayload = guard.user;

        const db = getTenantClient(userPayload);
        const tenantFilter = { tenantId: userPayload.tenantId };

        const { searchParams } = new URL(req.url);
        const search      = searchParams.get("search")      || "";
        const status      = searchParams.get("status")      || "";
        const serviceType = searchParams.get("serviceType") || "";
        const page        = Math.max(1, parseInt(searchParams.get("page")  || "1"));
        const limit       = Math.min(1000, Math.max(1, parseInt(searchParams.get("limit") || "50")));
        const skip        = (page - 1) * limit;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = { ...tenantFilter };
        if (search) {
            where.OR = [
                { username: { contains: search, mode: "insensitive" } },
                { fullName: { contains: search, mode: "insensitive" } },
                { phone:    { contains: search, mode: "insensitive" } },
            ];
        }
        if (status)      where.status      = status;
        if (serviceType) where.serviceType = serviceType;

        const [clients, total] = await Promise.all([
            db.client.findMany({
                where,
                include: {
                    subscriptions: {
                        where: { status: "ACTIVE" },
                        include: {
                            package: { select: { id: true, name: true, type: true } },
                            // HIGH-SEC FIX: Use select instead of include to avoid returning
                            // router.password, wgPrivateKey, radiusSecret to the frontend.
                            router: { select: { id: true, name: true, status: true } },
                        },
                        take: 1,
                        orderBy: { createdAt: "desc" },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            db.client.count({ where }),
        ]);

        const mapped = clients.map((c: {
            id: string;
            username: string;
            fullName: string;
            phone: string | null;
            email: string | null;
            serviceType: string;
            status: string;
            accountType: string;
            createdAt: Date;
            device: string | null;
            macAddress: string | null;
            subscriptions: { package: { name: string } | null; router: { name: string } | null }[];
        }) => {
            const activeSub = c.subscriptions[0];
            return {
                id:          c.id,
                username:    c.username,
                fullName:    c.fullName,
                phone:       c.phone || "",
                email:       c.email,
                serviceType: c.serviceType === "HOTSPOT" ? "Hotspot" : "PPPoE",
                status:      c.status.charAt(0) + c.status.slice(1).toLowerCase(),
                accountType: c.accountType === "PERSONAL" ? "Personal" : "Business",
                createdOn:   toISOSafe(c.createdAt),
                plan:        activeSub?.package?.name,
                router:      activeSub?.router?.name,
                device:      c.device,
                macAddress:  c.macAddress,
            };
        });

        // Support raw-list response for legacy consumers and test suites
        const isRawList    = req.headers.get("x-response-type") === "raw-list" || searchParams.get("raw") === "true";
        const isImplicitRaw = !searchParams.get("limit") && !searchParams.get("page");

        if (isRawList || isImplicitRaw) {
            return jsonResponse(mapped);
        }

        return jsonResponse({ data: mapped, total, page, limit });
    } catch (e) {
        logger.error("[clients] GET failed", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/clients - Create a new client
export async function POST(req: NextRequest) {
    try {
        const body   = await req.json();
        const parsed = ClientCreateSchema.safeParse(body);
        if (!parsed.success) {
            const msg = parsed.error.issues.map((e: any) => `${e.path.join(".")}: ${e.message}`).join("; ");
            return errorResponse(`Invalid request body: ${msg}`, 400);
        }
        const { username: bodyUsername, fullName, phone, email, serviceType } = parsed.data;
        const planId = body.planId || body.plan_id || body.plan;

        if (!fullName) return errorResponse("Full name is required");

        // HIGH-SEC FIX: Math.random() → crypto.randomBytes() for username suffix.
        // Math.random() is NOT a CSPRNG — the random suffix is predictable and guessable.
        const username = body.username || body.user_name || phone || email?.split("@")[0]
            || `user_${crypto.randomBytes(4).toString("hex")}`;
        if (!username) return errorResponse("Username is required");

        if (username.includes(" ")) {
            return errorResponse("Username cannot contain spaces");
        }

        // Validate phone if provided
        if (phone && !/^\+?[0-9\s-]{7,15}$/.test(phone)) {
            return errorResponse("Invalid phone number format");
        }

        // Validate email if provided
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return errorResponse("Invalid email format");
        }

        const guard = requirePermission(req, "clients:write");
        if (guard.error) return guard.error;
        const userPayload = guard.user;

        const db = getTenantClient(userPayload);

        // Always use token's tenantId — SUPER_ADMIN should use /api/admin/clients for cross-tenant ops
        const tenantIdValue = userPayload.tenantId;

        if (!tenantIdValue) {
            return errorResponse("Tenant ID is required", 400);
        }

        const existing = await db.client.findFirst({ where: { username, tenantId: tenantIdValue } });
        if (existing) {
            return errorResponse("Username already exists", 409);
        }

        const tenant = await db.tenant.findUnique({
            where: { id: tenantIdValue },
            include: { plan: true, clients: { select: { id: true, serviceType: true } } },
        });

        if (tenant) {
            const pppoeClientsCount   = tenant.clients.filter(c => c.serviceType === "PPPOE").length;
            const hotspotClientsCount = tenant.clients.filter(c => c.serviceType === "HOTSPOT").length;
            const requestedServiceType = body.serviceType || body.service_type || "HOTSPOT";

            if (requestedServiceType === "PPPOE" && pppoeClientsCount >= tenant.plan.pppoeLimit) {
                return errorResponse(`PPPoE client limit reached. Your plan allows up to ${tenant.plan.pppoeLimit} PPPoE clients.`, 403);
            }
            if (requestedServiceType === "HOTSPOT" && tenant.plan.hotspotLimit !== null && hotspotClientsCount >= tenant.plan.hotspotLimit) {
                return errorResponse(`Hotspot client limit reached. Your plan allows up to ${tenant.plan.hotspotLimit} Hotspot clients.`, 403);
            }
        }

        const clientData = {
            username,
            fullName,
            phone,
            email,
            serviceType:  body.serviceType  || body.service_type  || "HOTSPOT",
            status:       body.status        || "ACTIVE",
            accountType:  body.accountType   || body.account_type  || "PERSONAL",
            macAddress:   body.macAddress    || body.mac_address    || body.mac,
            device:       body.device,
            tenantId:     tenantIdValue,
        };

        const client = await db.client.create({ data: clientData });

        return jsonResponse({
            id:          client.id,
            client_id:   client.id,          // Alias for legacy consumers
            username:    client.username,
            fullName:    client.fullName,
            tenantId:    client.tenantId,
            tenant_id:   client.tenantId,    // Alias for legacy consumers
            status:      client.status,
            serviceType: client.serviceType,
        }, 201);
    } catch (e) {
        logger.error("[clients] POST failed", { error: e instanceof Error ? e.message : String(e) });
        return errorResponse("Internal server error", 500);
    }
}
