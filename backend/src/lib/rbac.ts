/**
 * RBAC — Role-Based Access Control
 *
 * Single source of truth for what each role can do.
 * Import `requireRole` or `requirePermission` in any API route instead of
 * scattering inline `if (user.role !== "SUPER_ADMIN")` checks everywhere.
 */

import { NextRequest } from "next/server";
import { getUserFromRequest, errorResponse, JwtPayload } from "@/lib/auth";

// ─── Role hierarchy ───────────────────────────────────────────────────────────
export type AppRole = "SUPER_ADMIN" | "ADMIN" | "AGENT" | "VIEWER";

// ─── Permission matrix ────────────────────────────────────────────────────────
// Each key is a named capability. Value = roles that are allowed.
//
// ROLE DEFINITIONS (confirmed architecture):
//   SUPER_ADMIN  — Tenant owner. Full access to everything within their tenant.
//   ADMIN        — Tenant manager. Operational access but cannot change billing/settings.
//   AGENT        — Field worker. Can create/manage subscribers and vouchers.
//   VIEWER       — Read-only observer. Cannot create, update, or delete anything.
//
// MT-002 FIX: VIEWER was incorrectly granted write + delete on clients/vouchers.
//   A read-only role must not be able to delete customer records.
//   AGENT retains create/read on clients but loses delete (prevents accidental deletion).
//   Only SUPER_ADMIN and ADMIN can perform destructive operations.
export const PERMISSIONS = {
  // License & billing — SUPER_ADMIN only
  "license:read":         ["SUPER_ADMIN"],
  "license:purchase":     ["SUPER_ADMIN"],
  "license:renew":        ["SUPER_ADMIN"],

  // Payment gateway configuration — SUPER_ADMIN only
  // Sub-users inherit the gateway config set by Super Admin
  "payment-channels:write": ["SUPER_ADMIN"],
  "payment-channels:read":  ["SUPER_ADMIN"],

  // System-wide settings — SUPER_ADMIN only
  "system-settings:write":  ["SUPER_ADMIN"],
  "system-settings:read":   ["SUPER_ADMIN"],

  // User management — SUPER_ADMIN only (creation of sub-users)
  "system-users:write": ["SUPER_ADMIN"],
  "system-users:read":  ["SUPER_ADMIN"],

  // Audit logs — SUPER_ADMIN only
  "audit-logs:read": ["SUPER_ADMIN"],

  // Subscribers / clients
  // MT-002 FIX: VIEWER = read-only (removed write + delete)
  //             AGENT  = create + read only (removed delete — requires manager approval)
  "clients:read":   ["SUPER_ADMIN", "ADMIN", "AGENT", "VIEWER"],
  "clients:write":  ["SUPER_ADMIN", "ADMIN", "AGENT"],          // VIEWER removed
  "clients:delete": ["SUPER_ADMIN", "ADMIN"],                   // VIEWER + AGENT removed

  // Packages
  "packages:read":  ["SUPER_ADMIN", "ADMIN", "AGENT", "VIEWER"],
  "packages:write": ["SUPER_ADMIN", "ADMIN"],

  // Subscriptions — AGENT can activate (their primary job), VIEWER read-only
  "subscriptions:read":   ["SUPER_ADMIN", "ADMIN", "AGENT", "VIEWER"],
  "subscriptions:write":  ["SUPER_ADMIN", "ADMIN", "AGENT"],
  "subscriptions:delete": ["SUPER_ADMIN", "ADMIN"],

  // Vouchers — AGENT can create (their primary tool), VIEWER read-only
  "vouchers:create": ["SUPER_ADMIN", "ADMIN", "AGENT"],         // VIEWER removed
  "vouchers:read":   ["SUPER_ADMIN", "ADMIN", "AGENT", "VIEWER"],
  "vouchers:delete": ["SUPER_ADMIN", "ADMIN"],                  // AGENT + VIEWER removed

  // Transactions — all read, only managers write
  "transactions:read":  ["SUPER_ADMIN", "ADMIN", "AGENT", "VIEWER"],
  "transactions:write": ["SUPER_ADMIN", "ADMIN"],

  // Dashboard & reports — all roles
  "dashboard:read": ["SUPER_ADMIN", "ADMIN", "AGENT", "VIEWER"],
  "reports:read":   ["SUPER_ADMIN", "ADMIN", "AGENT", "VIEWER"],

  // Routers — AGENT can view, only managers configure
  "routers:read":  ["SUPER_ADMIN", "ADMIN", "AGENT", "VIEWER"],
  "routers:write": ["SUPER_ADMIN", "ADMIN"],
  "routers:delete": ["SUPER_ADMIN"],

  // Branding — SUPER_ADMIN only
  "branding:write": ["SUPER_ADMIN"],
  "branding:read":  ["SUPER_ADMIN"],

  // Hotspot — SUPER_ADMIN only for write, ADMIN can read
  "hotspot:write": ["SUPER_ADMIN"],
  "hotspot:read":  ["SUPER_ADMIN", "ADMIN"],

  // VPN — manager-level only
  "vpn:read":  ["SUPER_ADMIN", "ADMIN"],
  "vpn:write": ["SUPER_ADMIN"],

  // Expenses — AGENT can log, managers approve/delete
  "expenses:read":   ["SUPER_ADMIN", "ADMIN", "AGENT", "VIEWER"],
  "expenses:write":  ["SUPER_ADMIN", "ADMIN", "AGENT"],
  "expenses:delete": ["SUPER_ADMIN", "ADMIN"],

  // Equipment — managers only
  "equipment:read":  ["SUPER_ADMIN", "ADMIN", "AGENT", "VIEWER"],
  "equipment:write": ["SUPER_ADMIN", "ADMIN"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function hasPermission(role: string, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission] as readonly string[];
  return allowed.includes(role);
}

export function hasRole(user: JwtPayload, ...roles: AppRole[]): boolean {
  return roles.includes(user.role as AppRole);
}

/**
 * Guard an API route by role.
 * Returns an error Response if the check fails, null if the user passes.
 *
 * Usage:
 *   const guard = requireRole(req, "SUPER_ADMIN");
 *   if (guard) return guard;
 */
export function requireRole(
  req: NextRequest,
  ...roles: AppRole[]
): { user: JwtPayload; error: null } | { user: null; error: Response } {
  const user = getUserFromRequest(req);
  if (!user) {
    return { user: null, error: errorResponse("Unauthorized", 401) };
  }
  if (!roles.includes(user.role as AppRole)) {
    return {
      user: null,
      error: errorResponse(
        `Forbidden: This action requires one of the following roles: ${roles.join(", ")}`,
        403
      ),
    };
  }
  return { user, error: null };
}

/**
 * Guard an API route by named permission.
 *
 * Usage:
 *   const guard = requirePermission(req, "payment-channels:write");
 *   if (guard.error) return guard.error;
 */
export function requirePermission(
  req: NextRequest,
  permission: Permission
): { user: JwtPayload; error: null } | { user: null; error: Response } {
  const user = getUserFromRequest(req);
  if (!user) {
    return { user: null, error: errorResponse("Unauthorized", 401) };
  }
  if (!hasPermission(user.role, permission)) {
    return {
      user: null,
      error: errorResponse(
        `Forbidden: Your role (${user.role}) does not have the "${permission}" permission.`,
        403
      ),
    };
  }
  return { user, error: null };
}
