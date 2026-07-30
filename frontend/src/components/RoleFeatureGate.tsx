/**
 * RoleFeatureGate
 *
 * ENTERPRISE-005: Gate UI features behind user roles.
 *
 * Use alongside VendorFeatureGate — vendor gating controls WHAT a router supports,
 * role gating controls WHO can access it.
 *
 * Role hierarchy (highest → lowest):
 *   PLATFORM_SUPER_ADMIN > SUPER_ADMIN > ADMIN > ENGINEER > NOC > VIEWER
 *
 * Usage:
 *   // Show provisioning button only to ADMIN+
 *   <RoleFeatureGate minRole="ADMIN">
 *     <ProvisionButton />
 *   </RoleFeatureGate>
 *
 *   // Show WireGuard config only to SUPER_ADMIN or PLATFORM_SUPER_ADMIN
 *   <RoleFeatureGate roles={['SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN']}>
 *     <WireGuardConfig />
 *   </RoleFeatureGate>
 *
 *   // Silent hide (no message shown)
 *   <RoleFeatureGate minRole="ENGINEER" silent>
 *     <DiagnosticsPanel />
 *   </RoleFeatureGate>
 */

import React from 'react';
import authStore from '../stores/authStore';

// ── Role Hierarchy ─────────────────────────────────────────────────────────────

export type AppRole =
    | 'PLATFORM_SUPER_ADMIN'
    | 'SUPER_ADMIN'
    | 'ADMIN'
    | 'ENGINEER'
    | 'NOC'
    | 'VIEWER';

const ROLE_LEVEL: Record<string, number> = {
    PLATFORM_SUPER_ADMIN: 100,
    SUPER_ADMIN:          80,
    ADMIN:                60,
    ENGINEER:             40,
    NOC:                  20,
    VIEWER:               10,
};

function getRoleLevel(role?: string | null): number {
    return ROLE_LEVEL[role ?? ''] ?? 0;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface RoleFeatureGateProps {
    children: React.ReactNode;
    /**
     * Allow access if user role is at least this level.
     * e.g. minRole="ADMIN" allows ADMIN, SUPER_ADMIN, PLATFORM_SUPER_ADMIN
     */
    minRole?: AppRole;
    /**
     * Allow access for specific roles only (whitelist).
     * Takes precedence over minRole if both are provided.
     */
    roles?: AppRole[];
    /**
     * If true, renders nothing when access is denied (no error message shown).
     * Use for hiding buttons/tabs silently.
     */
    silent?: boolean;
    /**
     * Custom fallback shown when access is denied.
     * Defaults to a styled "Access Restricted" card.
     */
    fallback?: React.ReactNode;
    /**
     * Feature label shown in the access-denied message.
     * Defaults to "This feature".
     */
    featureLabel?: string;
}

// ── Access Check ───────────────────────────────────────────────────────────────

export function canAccessRole(userRole: string | null | undefined, opts: { minRole?: AppRole; roles?: AppRole[] }): boolean {
    const { minRole, roles } = opts;

    if (roles && roles.length > 0) {
        return roles.includes((userRole ?? '') as AppRole);
    }

    if (minRole) {
        return getRoleLevel(userRole) >= getRoleLevel(minRole);
    }

    // No restriction specified — allow everyone
    return true;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function RoleFeatureGate({
    children,
    minRole,
    roles,
    silent = false,
    fallback,
    featureLabel = 'This feature',
}: RoleFeatureGateProps) {
    const userRole = authStore.getState?.()?.user?.role ?? null;
    const allowed = canAccessRole(userRole, { minRole, roles });

    if (allowed) return <>{children}</>;

    if (silent) return null;

    if (fallback !== undefined) return <>{fallback}</>;

    const requiredLabel = minRole
        ? `${minRole} or higher`
        : roles?.join(' or ') ?? 'a higher role';

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '28px 20px',
            borderRadius: 12,
            background: '#fefce8',
            border: '1.5px dashed #fbbf24',
            gap: 8,
            textAlign: 'center',
        }}>
            <span style={{ fontSize: '1.6rem' }}>🔒</span>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#92400e' }}>
                Access Restricted
            </div>
            <div style={{ fontSize: '0.78rem', color: '#b45309', maxWidth: 300 }}>
                {featureLabel} requires <strong>{requiredLabel}</strong> access.
                Contact your system administrator to request access.
            </div>
        </div>
    );
}

export default RoleFeatureGate;
