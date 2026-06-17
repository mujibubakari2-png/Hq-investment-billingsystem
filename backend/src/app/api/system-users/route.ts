import { NextRequest } from "next/server";
import { getTenantClient } from "@/lib/tenantPrisma";
import { hashPassword, jsonResponse, errorResponse } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { toISOSafe } from "@/lib/dateUtils";
import { getJwtTenantId, getTenantFilter, isPlatformSuperAdmin } from "@/lib/tenant";
import { assertTenantCanAddSubUser } from "@/lib/userLimits";
import { writeAuditLog, getIpFromRequest } from "@/lib/auditLog";
import { sendEmail } from "@/lib/email";

/** Generate a random temporary password */
function generateTempPassword(length = 10): string {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
    let pwd = "";
    for (let i = 0; i < length; i++) {
        pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
}

/** Send welcome email to a new sub-user */
async function sendWelcomeEmail(
    email: string,
    fullName: string,
    tempPassword: string,
    role: string,
    companyName: string
) {
    const roleLabel =
        role === "ADMIN" ? "Admin" :
            role === "AGENT" ? "Agent" :
                role === "VIEWER" ? "Viewer" : role;

    const html = `
    <div style="font-family: sans-serif; padding: 24px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px;">
      <h2 style="color: #1a1a2e; margin-bottom: 4px;">Welcome to HQ INVESTMENT</h2>
      <p style="color: #666; margin-top: 0;">Your account has been created under <strong>${companyName}</strong>.</p>
      <p>Hello <strong>${fullName || email}</strong>,</p>
      <p>Your administrator has created an account for you as a <strong>${roleLabel}</strong>.</p>
      <p>Here are your temporary login credentials:</p>
      <div style="background: #f4f4f7; padding: 20px; border-radius: 8px; margin: 16px 0; text-align: center;">
        <div style="margin-bottom: 8px;"><strong>Email:</strong> ${email}</div>
        <div style="font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #6366f1;">${tempPassword}</div>
        <div style="font-size: 12px; color: #999; margin-top: 6px;">Temporary Password</div>
      </div>
      <p style="color: #e11d48; font-weight: 600;">⚠️ Please log in and change your password immediately.</p>
      <p style="font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 12px; margin-top: 24px;">
        If you did not expect this invitation, please contact your administrator.
      </p>
    </div>
  `;

    return sendEmail({
        to: email,
        subject: `Your HQ INVESTMENT account has been created — ${companyName}`,
        text: `Welcome to HQ INVESTMENT. Your temporary password is: ${tempPassword}. Please log in and change it immediately.`,
        html,
    });
}


// GET /api/system-users — list sub-users under this tenant (SUPER_ADMIN only)
export async function GET(req: NextRequest) {

    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const tenantId = getJwtTenantId(userPayload);
        if (!tenantId && !isPlatformSuperAdmin(userPayload)) {
            return errorResponse("Tenant ID missing", 400);
        }

        const { filter: tenantFilter } = getTenantFilter(userPayload);

        // Show all users in the tenant — including SUPER_ADMIN so they can see themselves
        // but sub-users (ADMIN/AGENT/VIEWER) are the primary focus
        const users = await db.user.findMany({
            where: { ...tenantFilter },
            select: {
                id: true,
                username: true,
                fullName: true,
                email: true,
                role: true,
                status: true,
                phone: true,
                lastLogin: true,
                createdAt: true,
                createdById: true,
            },
            orderBy: { createdAt: "asc" },
        });

        // Fetch tenant info for plan name + user limits
        let planName: string | null = null;
        let subUserLimit = 3;
        if (tenantId) {
            const tenant = await db.tenant.findUnique({
                where: { id: tenantId },
                select: { plan: { select: { name: true } } },
            });
            planName = tenant?.plan?.name ?? null;
            const { getSubUserLimitForPlan } = await import("@/lib/userLimits");
            subUserLimit = getSubUserLimitForPlan(planName);
        }

        const subUserCount = users.filter(u => ["ADMIN", "AGENT", "VIEWER"].includes(u.role)).length;

        const mapped = users.map((u) => ({
            id: u.id,
            username: u.username,
            fullName: u.fullName,
            email: u.email,
            role: u.role === "SUPER_ADMIN" ? "Super Admin" : u.role.charAt(0) + u.role.slice(1).toLowerCase(),
            rawRole: u.role,
            status: u.status === "ACTIVE" ? "Active" : "Inactive",
            phone: u.phone,
            lastLogin: toISOSafe(u.lastLogin),
            createdAt: toISOSafe(u.createdAt),
            createdById: u.createdById,
        }));

        return jsonResponse({
            users: mapped,
            meta: {
                subUserCount,
                subUserLimit,
                planName,
            },
        });
    } catch (e) {
        console.error(e);
        return errorResponse("Internal server error", 500);
    }
}

// POST /api/system-users — create a sub-user under this tenant (SUPER_ADMIN only)
export async function POST(req: NextRequest) {

    try {
        const guard = requireRole(req, "SUPER_ADMIN");
        if (guard.error) return guard.error;
        const userPayload = guard.user;
        const db = getTenantClient(userPayload);

        const platformAdmin = isPlatformSuperAdmin(userPayload);
        const body = await req.json();

        if (!body.username || !body.email) {
            return errorResponse("Username and email are required");
        }

        const existing = await db.user.findFirst({
            where: { OR: [{ username: body.username }, { email: body.email }] },
        });
        if (existing) return errorResponse("Username or email already exists", 409);

        const roleMap: Record<string, "SUPER_ADMIN" | "ADMIN" | "AGENT" | "VIEWER"> = {
            "Super Admin": "SUPER_ADMIN",
            "Admin": "ADMIN",
            "Agent": "AGENT",
            "Viewer": "VIEWER",
        };

        const assignedRole = roleMap[body.role] || "AGENT";

        // Prevent creating another SUPER_ADMIN — each tenant has exactly one
        if (assignedRole === "SUPER_ADMIN") {
            return errorResponse(
                "Each tenant has exactly one Super Admin owner. Create Admin, Agent, or Viewer users here.",
                403
            );
        }

        const requestedTenantId = body.tenantId || body.tenant_id;
        const tenantId = platformAdmin ? requestedTenantId : getJwtTenantId(userPayload);
        if (!tenantId) {
            return errorResponse("Tenant ID is required to create a sub-user", 400);
        }

        await assertTenantCanAddSubUser(tenantId);

        // Always generate a secure temp password — ignore whatever was in body.password
        const tempPassword = generateTempPassword(12);

        // Fetch tenant name for the welcome email
        const tenant = await db.tenant.findUnique({
            where: { id: tenantId },
            select: { name: true },
        });
        const companyName = tenant?.name || "Your Organisation";

        const user = await db.user.create({
            data: {
                username: body.username,
                fullName: body.fullName || null,
                email: body.email,
                password: await hashPassword(tempPassword),
                phone: body.phone || null,
                role: assignedRole,
                tenantId: tenantId,
                createdById: userPayload.userId,
            },
            select: {
                id: true, username: true, email: true, fullName: true,
                role: true, status: true, tenantId: true, createdById: true,
            },
        });

        // Write audit log (non-blocking)
        writeAuditLog({
            tenantId,
            userId: userPayload.userId,
            action: "CREATE_USER",
            resource: "User",
            resourceId: user.id,
            details: { role: assignedRole, username: body.username, email: body.email },
            ipAddress: getIpFromRequest(req),
        });

        // Send welcome email with temp password (non-blocking — don't fail if email fails)
        sendWelcomeEmail(
            body.email,
            body.fullName || body.username,
            tempPassword,
            assignedRole,
            companyName
        ).catch(err => console.warn("[SYSTEM-USERS] Welcome email failed:", err?.message));

        return jsonResponse({
            ...user,
            message: `User created. A welcome email with login credentials has been sent to ${body.email}.`,
        }, 201);
    } catch (e: any) {
        console.error("[SYSTEM-USERS] POST error:", e);
        return errorResponse(e?.message || "Internal server error", 500);
    }
}
