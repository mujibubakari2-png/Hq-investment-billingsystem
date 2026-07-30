/**
 * RouterCapabilityMatrix
 *
 * VENDOR-ADAPTER-FE-004: Live capability grid shown in RouterDetailModal.
 *
 * Fixed to check BOTH:
 *   1. `capabilities` JSON object (from discoverCapabilities() — most accurate)
 *   2. `supportedFeatures` string array (from API — fallback)
 *
 * This prevents false "Not Supported" for features that ARE supported but whose
 * supportedFeatures array is out of date or empty.
 */

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { RouterVendorBadge } from './RouterVendorBadge';

export interface RouterCapabilities {
    vendor: string;
    firmwareVersion?: string | null;
    architecture?: string | null;
    apiType?: string | null;
    supportedFeatures: string[];
    /** Live capabilities JSON from discoverCapabilities() */
    capabilities?: Record<string, boolean> | string | null;
}

interface Props {
    capabilities: RouterCapabilities;
}

const ALL_FEATURES = [
    { id: 'pppoe',    name: 'PPPoE Server' },
    { id: 'hotspot',  name: 'Hotspot Server' },
    { id: 'dhcp',     name: 'DHCP Server' },
    { id: 'firewall', name: 'Firewall Rules' },
    { id: 'queue',    name: 'Traffic Queues' },
    { id: 'vlan',     name: 'VLAN Management' },
    { id: 'radius',   name: 'RADIUS Auth' },
    { id: 'wireguard',name: 'WireGuard VPN' },
    { id: 'backup',   name: 'Remote Backup' },
    { id: 'bridge',   name: 'Bridge / LAN' },
    { id: 'dns',      name: 'DNS Server' },
    { id: 'ipv6',     name: 'IPv6' },
];

function checkFeature(feature: string, caps: RouterCapabilities): boolean {
    // 1. Check live capabilities JSON first (most accurate)
    if (caps.capabilities && typeof caps.capabilities === 'object') {
        const obj = caps.capabilities as Record<string, boolean>;
        if (feature in obj) return obj[feature] === true;
        // Also check legacy key names (queues vs queue, vlans vs vlan)
        if (feature === 'queue' && 'queues' in obj) return obj['queues'] === true;
        if (feature === 'vlan' && 'vlans' in obj) return obj['vlans'] === true;
    }
    // 2. Fallback to supportedFeatures array
    if (caps.supportedFeatures?.length) {
        return caps.supportedFeatures.includes(feature)
            || (feature === 'queue' && caps.supportedFeatures.includes('queues'))
            || (feature === 'vlan' && caps.supportedFeatures.includes('vlans'));
    }
    return false;
}

export default function RouterCapabilityMatrix({ capabilities }: Props) {
    if (!capabilities) return null;

    const discovered = capabilities.supportedFeatures?.length > 0 ||
        (capabilities.capabilities && typeof capabilities.capabilities === 'object' &&
            Object.keys(capabilities.capabilities).length > 0);

    return (
        <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            marginTop: '15px'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, borderBottom: '1px solid var(--border-light)', paddingBottom: 10 }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                    Router Capabilities
                </h3>
                {!discovered && (
                    <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600, background: '#fef9c3', padding: '2px 8px', borderRadius: 20 }}>
                        ⚠ Not yet discovered — showing defaults
                    </span>
                )}
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                <RouterVendorBadge vendor={capabilities.vendor} firmwareVersion={capabilities.firmwareVersion} showVersion size="md" />
                {capabilities.apiType && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                        API: {capabilities.apiType}
                    </span>
                )}
                {capabilities.architecture && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                        {capabilities.architecture}
                    </span>
                )}
            </div>

            {/* Feature grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {ALL_FEATURES.map(feature => {
                    const isSupported = checkFeature(feature.id, capabilities);
                    return (
                        <div key={feature.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '7px 10px',
                            background: isSupported ? '#f0fdf4' : '#f9fafb',
                            border: `1px solid ${isSupported ? '#bbf7d0' : '#e5e7eb'}`,
                            borderRadius: 8,
                        }}>
                            {isSupported
                                ? <CheckCircleIcon style={{ color: '#16a34a', fontSize: 16, flexShrink: 0 }} />
                                : <CancelIcon style={{ color: '#d1d5db', fontSize: 16, flexShrink: 0 }} />
                            }
                            <span style={{
                                fontSize: '0.78rem',
                                fontWeight: 500,
                                color: isSupported ? '#15803d' : '#9ca3af',
                            }}>
                                {feature.name}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
