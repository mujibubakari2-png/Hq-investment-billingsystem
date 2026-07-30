/**
 * RouterVendorBadge — Vendor chip with colour coding and version info.
 *
 * Used in router list rows and detail modals to immediately identify
 * which vendor adapter is in use, avoiding accidental MikroTik-only UI.
 */

import React from 'react';
import RouterIcon from '@mui/icons-material/Router';
import WifiIcon from '@mui/icons-material/Wifi';
import SettingsInputAntennaIcon from '@mui/icons-material/SettingsInputAntenna';

interface RouterVendorBadgeProps {
    vendor?: string | null;
    firmwareVersion?: string | null;
    style?: React.CSSProperties;
    showVersion?: boolean;
    size?: 'sm' | 'md';
}

interface VendorMeta {
    label: string;
    bg: string;
    color: string;
    borderColor: string;
    icon: React.ReactNode;
}

function getVendorMeta(vendor?: string | null): VendorMeta {
    const v = (vendor ?? 'mikrotik').toLowerCase();
    if (v.includes('omada')) {
        return {
            label: 'Omada',
            bg: 'linear-gradient(135deg,#fff7ed,#fed7aa)',
            color: '#c2410c',
            borderColor: '#fed7aa',
            icon: <SettingsInputAntennaIcon style={{ fontSize: 11 }} />,
        };
    }
    if (v.includes('unifi') || v.includes('ubiquiti')) {
        return {
            label: 'UniFi',
            bg: 'linear-gradient(135deg,#f5f3ff,#ddd6fe)',
            color: '#6d28d9',
            borderColor: '#c4b5fd',
            icon: <WifiIcon style={{ fontSize: 11 }} />,
        };
    }
    if (v === 'tplink' || v.includes('tp-link') || v.includes('tp link')) {
        return {
            label: 'TP-Link',
            bg: 'linear-gradient(135deg,#f0fdfa,#99f6e4)',
            color: '#0f766e',
            borderColor: '#99f6e4',
            icon: <RouterIcon style={{ fontSize: 11 }} />,
        };
    }
    // Default MikroTik
    return {
        label: 'MikroTik',
        bg: 'linear-gradient(135deg,#eff6ff,#bfdbfe)',
        color: '#1d4ed8',
        borderColor: '#bfdbfe',
        icon: <RouterIcon style={{ fontSize: 11 }} />,
    };
}

export function RouterVendorBadge({
    vendor,
    firmwareVersion,
    style,
    showVersion = false,
    size = 'sm',
}: RouterVendorBadgeProps) {
    const meta = getVendorMeta(vendor);
    const fontSize = size === 'md' ? '0.78rem' : '0.68rem';
    const padding = size === 'md' ? '4px 10px' : '2px 8px';

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding,
                borderRadius: 20,
                fontSize,
                fontWeight: 700,
                background: meta.bg,
                color: meta.color,
                border: `1px solid ${meta.borderColor}`,
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
                ...style,
            }}
        >
            {meta.icon}
            {meta.label}
            {showVersion && firmwareVersion && (
                <span style={{ opacity: 0.7, fontWeight: 400, marginLeft: 2 }}>
                    v{firmwareVersion}
                </span>
            )}
        </span>
    );
}

export default RouterVendorBadge;
