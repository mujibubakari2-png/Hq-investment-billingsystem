import { JwtPayload } from "./auth";

const NO_TENANT_MATCH = "__NO_TENANT__";

export function getJwtTenantId(user: JwtPayload): string | null {
    return user.tenantId ?? user.tenant_id ?? null;
}

/**
 * Platform admins are legacy/operator accounts with no tenantId.
 * Tenant owners are also SUPER_ADMIN, but they must stay scoped to their tenant.
 */
export function isPlatformSuperAdmin(user: JwtPayload): boolean {
    return user.role === "SUPER_ADMIN" && !getJwtTenantId(user);
}

export function isTenantSuperAdmin(user: JwtPayload): boolean {
    return user.role === "SUPER_ADMIN" && !!getJwtTenantId(user);
}

export function isTenantManager(user: JwtPayload): boolean {
    return user.role === "SUPER_ADMIN" || user.role === "ADMIN";
}

export function canAccessTenant(user: JwtPayload, tenantId?: string | null): boolean {
    if (isPlatformSuperAdmin(user)) return true;
    return !!tenantId && getJwtTenantId(user) === tenantId;
}

export function tenantScopedFilter(user: JwtPayload) {
    if (isPlatformSuperAdmin(user)) return {};
    return { tenantId: getJwtTenantId(user) ?? NO_TENANT_MATCH };
}

/**
 * Reusable tenant isolation helper.
 * Returns a Prisma-compatible filter object that restricts queries to the user's tenant.
 * Tenant-owner SUPER_ADMIN users are tenant-scoped. Only tenantless platform
 * SUPER_ADMIN accounts get an empty filter.
 */
export function getTenantFilter(user: JwtPayload) {
    const tenantId = getJwtTenantId(user);
    const platformSuperAdmin = isPlatformSuperAdmin(user);
    const isSuperAdmin = user.role === "SUPER_ADMIN";
    return {
        isSuperAdmin,
        isPlatformSuperAdmin: platformSuperAdmin,
        isTenantSuperAdmin: isTenantSuperAdmin(user),
        isAdmin: isSuperAdmin || user.role === "ADMIN",
        filter: platformSuperAdmin ? {} : { tenantId: tenantId ?? NO_TENANT_MATCH },
        tenantId,
    };
}

/**
 * Returns the tenantId to assign to a new record.
 * Platform SUPER_ADMIN can optionally specify a tenantId via the request body.
 * Tenant owners and all subordinate users get their own tenantId from the JWT.
 */
export function getAssignTenantId(user: JwtPayload, bodyTenantId?: string | null): string | null {
    if (isPlatformSuperAdmin(user)) {
        return bodyTenantId || null;
    }
    return getJwtTenantId(user);
}
