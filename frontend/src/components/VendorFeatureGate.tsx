/**
 * VendorFeatureGate
 *
 * VENDOR-ADAPTER-FE-002: Conditionally render UI based on router capabilities.
 *
 * Usage:
 *   <VendorFeatureGate router={router} feature="pppoe">
 *     <PPPoETab />
 *   </VendorFeatureGate>
 *
 * If the router doesn't support the feature, renders a friendly message
 * instead of the children.
 */

import React from 'react';
import type { Router } from '../types';
import { hasCapability, getVendorLabel } from '../utils/RouterCapabilities';

interface VendorFeatureGateProps {
    router: Router;
    feature: string;
    children: React.ReactNode;
    /**
     * Custom fallback — shown when the vendor doesn't support the feature.
     * Defaults to a friendly "Not supported by {Vendor}" message.
     */
    fallback?: React.ReactNode;
    /**
     * If true, renders nothing (no fallback) when unsupported.
     * Useful for hiding entire tabs or buttons silently.
     */
    silent?: boolean;
}

export function VendorFeatureGate({
    router,
    feature,
    children,
    fallback,
    silent = false,
}: VendorFeatureGateProps) {
    if (hasCapability(router, feature)) {
        return <>{children}</>;
    }

    if (silent) return null;

    if (fallback !== undefined) {
        return <>{fallback}</>;
    }

    const vendorName = getVendorLabel(router.vendor ?? router.type);
    const featureLabel = feature.charAt(0).toUpperCase() + feature.slice(1);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 24px',
            borderRadius: 12,
            background: 'var(--bg-muted, #f9fafb)',
            border: '1.5px dashed var(--border-light, #e5e7eb)',
            gap: 10,
            textAlign: 'center',
        }}>
            <span style={{ fontSize: '1.8rem' }}>🚫</span>
            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary, #111827)' }}>
                {featureLabel} Not Supported
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #6b7280)', maxWidth: 320 }}>
                {vendorName} does not support {featureLabel} management via this platform.
                Configure it directly from the vendor's management console.
            </div>
        </div>
    );
}

export default VendorFeatureGate;
