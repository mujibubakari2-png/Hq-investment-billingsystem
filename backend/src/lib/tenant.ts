import { JwtPayload } from "./auth";

/**
 * Reusable tenant isolation helper.
 * Returns a Prisma-compatible filter object that restricts queries to the user's tenant.
 * SUPER_ADMIN users get an empty filter (access to all tenants).
 */
export function getTenantFilter(user: JwtPayload) {
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    return {
        isSuperAdmin,
        isAdmin: isSuperAdmin || user.role === "ADMIN",
        filter: isSuperAdmin ? {} : { tenantId: user.tenantId },
        tenantId: user.tenantId || null,
    };
}

/**
 * Returns the tenantId to assign to a new record.
 * SUPER_ADMIN can optionally specify a tenantId via the request body.
 * All other users get their own tenantId from the JWT.
 */
export function getAssignTenantId(user: JwtPayload, bodyTenantId?: string | null): string | null {
    if (user.role === "SUPER_ADMIN") {
        return bodyTenantId || null;
    }
    return user.tenantId || null;
}
