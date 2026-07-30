/**
 * RouterStatusBadge
 *
 * VENDOR-ADAPTER-FE-003: Compound status badge for router health + provisioning.
 *
 * Shows:
 *   - Online/Offline (connection status)
 *   - Health status (HEALTHY, DEGRADED, UNREACHABLE)
 *   - Provisioning status (PROVISIONED, IN_PROGRESS, FAILED, etc.)
 */

import React from 'react';
import type { Router } from '../types';
import { getHealthColor, getProvisioningLabel, getProvisioningColor } from '../utils/RouterCapabilities';

interface RouterStatusBadgeProps {
    router: Router;
    /** Show only the online/offline pill, not health/provisioning details */
    simple?: boolean;
    style?: React.CSSProperties;
}

export function RouterStatusBadge({ router, simple = false, style }: RouterStatusBadgeProps) {
    const isOnline = router.status === 'Online';

    const onlineBadge = (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: '0.75rem',
            fontWeight: 600,
            background: isOnline ? '#d1fae5' : '#fee2e2',
            color: isOnline ? '#065f46' : '#dc2626',
            border: `1px solid ${isOnline ? '#6ee7b7' : '#fca5a5'}`,
            ...style,
        }}>
            <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isOnline ? '#16a34a' : '#dc2626',
                animation: isOnline ? 'pulse 2s infinite' : undefined,
            }} />
            {isOnline ? 'Connected' : 'Offline'}
        </span>
    );

    if (simple) return onlineBadge;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {onlineBadge}
            {router.healthStatus && router.healthStatus !== 'HEALTHY' && (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 20,
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    background: '#fff7ed',
                    color: getHealthColor(router.healthStatus),
                    border: `1px solid ${getHealthColor(router.healthStatus)}33`,
                }}>
                    ⚠ {router.healthStatus}
                </span>
            )}
            {router.provisioningStatus && (
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    borderRadius: 20,
                    fontSize: '0.68rem',
                    fontWeight: 500,
                    background: '#f9fafb',
                    color: getProvisioningColor(router.provisioningStatus),
                    border: '1px solid #e5e7eb',
                }}>
                    {router.provisioningStatus === 'IN_PROGRESS' && (
                        <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                    )}
                    {getProvisioningLabel(router.provisioningStatus)}
                </span>
            )}
        </div>
    );
}

export default RouterStatusBadge;
