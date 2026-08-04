/**
 * Step 2 — Service selection (Hotspot / PPPoE / Both)
 * Step 3 — VPN tunnel configuration
 * FE-001: Extracted from RouterSetupWizard.tsx
 * BUG-003 FIX: Added RADIUS settings section (address + secret) that was
 *   passed as props but never rendered — users could not view or correct them.
 */

import { useState } from 'react';
import SettingsIcon from '@mui/icons-material/Settings';
import DnsIcon from '@mui/icons-material/Dns';
import WifiIcon from '@mui/icons-material/Wifi';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { ServiceType, VpnMode } from './WizardTypes';

// ── Step 2: Services ──────────────────────────────────────────────────────────

interface Step2Props {
    serviceType: ServiceType;
    setServiceType: (v: ServiceType) => void;
    pppoeLocalAddress: string; setPppoeLocalAddress: (v: string) => void;
    pppoePoolStart: string; setPppoePoolStart: (v: string) => void;
    pppoePoolEnd: string; setPppoePoolEnd: (v: string) => void;
    hotspotLocalAddress: string; setHotspotLocalAddress: (v: string) => void;
    hotspotPoolStart: string; setHotspotPoolStart: (v: string) => void;
    hotspotPoolEnd: string; setHotspotPoolEnd: (v: string) => void;
    radiusAddress: string; setRadiusAddress: (v: string) => void;
    radiusSecret: string; setRadiusSecret: (v: string) => void;
}

export function Step2Services(p: Step2Props) {
    const [showSecret, setShowSecret] = useState(false);
    const [showRadiusSection, setShowRadiusSection] = useState(false);

    const svcOptions: { key: ServiceType; label: string; desc: string; icon: React.ReactNode; detail: string }[] = [
        {
            key: 'pppoe', label: 'PPPoE Server Only',
            desc: 'Configure PPPoE server for client connections',
            icon: <DnsIcon style={{ fontSize: 40, color: 'var(--text-secondary)', marginBottom: 12 }} />,
            detail: `PPPoE bridge\n${p.pppoeLocalAddress ? p.pppoeLocalAddress.split('.').slice(0, 3).join('.') + '.x' : 'VPN subnet'}\nPPPoE service`,
        },
        {
            key: 'hotspot', label: 'Hotspot Only',
            desc: 'Configure WiFi hotspot with login portal',
            icon: <WifiIcon style={{ fontSize: 40, color: 'var(--text-secondary)', marginBottom: 12 }} />,
            detail: `Hotspot bridge\n${p.hotspotLocalAddress ? p.hotspotLocalAddress.split('.').slice(0, 3).join('.') + '.x' : 'VPN subnet'}\nlogin portal`,
        },
        {
            key: 'both', label: 'Both Services',
            desc: 'Configure both PPPoE and Hotspot',
            icon: <DeviceHubIcon style={{ fontSize: 40, color: 'var(--text-secondary)', marginBottom: 12 }} />,
            detail: `Shared bridge\nPPPoE: ${p.pppoeLocalAddress ? p.pppoeLocalAddress.split('.').slice(0, 3).join('.') + '.x' : 'VPN subnet'}\nHotspot: ${p.hotspotLocalAddress ? p.hotspotLocalAddress.split('.').slice(0, 3).join('.') + '.x' : 'VPN subnet'}`,
        },
    ];

    return (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <SettingsIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
            <h2 style={{ marginBottom: 6 }}>Choose Services to Configure</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Select which services you want to configure on this router</p>

            {/* Service type cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, maxWidth: 750, margin: '0 auto 32px' }}>
                {svcOptions.map(svc => (
                    <div key={svc.key} onClick={() => p.setServiceType(svc.key)} style={{
                        border: p.serviceType === svc.key ? '2px solid #0d9488' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)', padding: 20, cursor: 'pointer',
                        background: p.serviceType === svc.key ? '#f0fdfa' : '#fff',
                        transition: 'all 0.2s', textAlign: 'center',
                    }}>
                        {svc.icon}
                        <h4 style={{ marginBottom: 4 }}>{svc.label}</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>{svc.desc}</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
                            <div style={{ width: 16, height: 16, borderRadius: '50%', border: p.serviceType === svc.key ? '5px solid #0d9488' : '2px solid var(--border)' }} />
                            <span style={{ fontSize: '0.82rem', fontWeight: 500, color: p.serviceType === svc.key ? '#0d9488' : 'var(--text-secondary)' }}>Select {svc.label.split(' ')[0]}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{svc.detail}</div>
                    </div>
                ))}
            </div>

            {/* ── BUG-003 FIX: RADIUS Settings Section ────────────────────── */}
            <div style={{ maxWidth: 750, margin: '0 auto', textAlign: 'left' }}>
                {/* Collapsible toggle header */}
                <button
                    onClick={() => setShowRadiusSection(!showRadiusSection)}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 18px',
                        border: '1px solid var(--border-light)',
                        borderRadius: showRadiusSection ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
                        background: showRadiusSection ? '#f0fdf4' : '#f9fafb',
                        cursor: 'pointer', transition: 'all 0.2s', outline: 'none',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <LockIcon style={{ fontSize: 18, color: '#0d9488' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
                            RADIUS Authentication Settings
                        </span>
                        {p.radiusSecret ? (
                            <span style={{ background: '#dcfce7', color: '#166534', padding: '1px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600 }}>
                                ✓ Configured
                            </span>
                        ) : (
                            <span style={{ background: '#fef9c3', color: '#854d0e', padding: '1px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600 }}>
                                ⚠ Not set
                            </span>
                        )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#6b7280', display: 'inline-block', transform: showRadiusSection ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                </button>

                {showRadiusSection && (
                    <div style={{
                        border: '1px solid var(--border-light)', borderTop: 'none',
                        borderRadius: '0 0 var(--radius-md) var(--radius-md)',
                        padding: 20, background: '#fff',
                    }}>
                        {/* Info note */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', marginBottom: 20 }}>
                            <InfoOutlinedIcon style={{ fontSize: 18, color: '#1d4ed8', marginTop: 2, flexShrink: 0 }} />
                            <div style={{ fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.6 }}>
                                <strong>Auto-configured:</strong> These values were generated automatically by the server and saved to your router.
                                They are pre-filled here for reference. <strong>Only edit if you know what you're doing</strong> — changing the RADIUS secret
                                here updates the generated RSC file but <em>not</em> the FreeRADIUS NAS table automatically.
                                Use <strong>Auto-Push</strong> to apply all changes to the router at once.
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            {/* RADIUS Server Address */}
                            <div>
                                <label htmlFor="radius-address-input" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                                    RADIUS Server Address
                                </label>
                                <input
                                    id="radius-address-input"
                                    type="text"
                                    value={p.radiusAddress}
                                    onChange={e => p.setRadiusAddress(e.target.value)}
                                    placeholder="e.g. 10.0.0.1"
                                    style={{
                                        width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontFamily: 'monospace',
                                        background: '#f9fafb', boxSizing: 'border-box',
                                    }}
                                />
                                <p style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 4, marginBottom: 0 }}>
                                    VPN tunnel IP of the billing server (serverTunnelIp)
                                </p>
                            </div>

                            {/* RADIUS Shared Secret */}
                            <div>
                                <label htmlFor="radius-secret-input" style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                                    RADIUS Shared Secret
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        id="radius-secret-input"
                                        type={showSecret ? 'text' : 'password'}
                                        value={p.radiusSecret}
                                        onChange={e => p.setRadiusSecret(e.target.value)}
                                        placeholder="Auto-generated by server"
                                        style={{
                                            width: '100%', padding: '9px 40px 9px 12px',
                                            border: `1px solid ${!p.radiusSecret ? '#f59e0b' : 'var(--border)'}`,
                                            borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontFamily: 'monospace',
                                            background: '#f9fafb', boxSizing: 'border-box',
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSecret(!showSecret)}
                                        title={showSecret ? 'Hide secret' : 'Show secret'}
                                        style={{
                                            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                            color: '#6b7280', display: 'flex', alignItems: 'center',
                                        }}
                                    >
                                        {showSecret
                                            ? <VisibilityOffIcon style={{ fontSize: 18 }} />
                                            : <VisibilityIcon style={{ fontSize: 18 }} />
                                        }
                                    </button>
                                </div>
                                {!p.radiusSecret ? (
                                    <p style={{ fontSize: '0.72rem', color: '#d97706', marginTop: 4, marginBottom: 0 }}>
                                        ⚠ Missing — Auto-Push itatengeneza moja kwa moja
                                    </p>
                                ) : (
                                    <p style={{ fontSize: '0.72rem', color: '#16a34a', marginTop: 4, marginBottom: 0 }}>
                                        ✓ Secret imewekwa ({p.radiusSecret.length} chars)
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Footer note */}
                        <div style={{ marginTop: 16, padding: '10px 14px', background: '#f9fafb', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <VpnKeyIcon style={{ fontSize: 16, color: '#0d9488' }} />
                            <span style={{ fontSize: '0.8rem', color: '#374151' }}>
                                Mipangilio hii itawekwa kwenye RSC config na kutumwa kwa MikroTik kupitia Auto-Push (Step 5).
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


// ── Step 3: VPN Configuration ─────────────────────────────────────────────────

interface Step3Props {
    vpnEnabled: boolean; setVpnEnabled: (v: boolean) => void;
    vpnMode: VpnMode; setVpnMode: (v: VpnMode) => void;
}

export function Step3Vpn(p: Step3Props) {
    return (
        <div style={{ padding: '20px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <VpnKeyIcon style={{ fontSize: 56, color: '#7c3aed', marginBottom: 12 }} />
                <h2 style={{ marginBottom: 6 }}>VPN Tunnel Configuration</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Configure the WireGuard management tunnel for this router</p>
            </div>

            <div style={{ maxWidth: 700, margin: '0 auto' }}>
                {/* Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', marginBottom: 16, background: 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <VpnKeyIcon style={{ color: '#7c3aed' }} />
                        <div>
                            <div style={{ fontWeight: 600 }}>Enable VPN Management Tunnel</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Connect this router securely to the billing server via WireGuard</div>
                        </div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 26 }}>
                        <input type="checkbox" checked={p.vpnEnabled} onChange={e => p.setVpnEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                        <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, borderRadius: 26, background: p.vpnEnabled ? '#7c3aed' : '#ccc', transition: '0.3s' }}>
                            <span style={{ position: 'absolute', height: 20, width: 20, left: p.vpnEnabled ? 24 : 4, bottom: 3, background: '#fff', borderRadius: '50%', transition: '0.3s' }} />
                        </span>
                    </label>
                </div>

                {p.vpnEnabled && (<>
                    {/* VPN Mode */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>🔒 VPN Mode</div>
                        {[
                            { key: 'hybrid' as VpnMode, label: 'Hybrid Mode', badge: 'Recommended', desc: 'WireGuard (fast VPN) + OpenVPN (management access)' },
                        ].map(opt => (
                            <div key={opt.key} onClick={() => p.setVpnMode(opt.key)} style={{ border: p.vpnMode === opt.key ? '2px solid #7c3aed' : '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 10, cursor: 'pointer', background: p.vpnMode === opt.key ? '#faf5ff' : '#fff', transition: 'all 0.2s' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: p.vpnMode === opt.key ? '5px solid #7c3aed' : '2px solid var(--border)', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <strong>{opt.label}</strong>
                                            {opt.badge && <span style={{ background: '#16a34a', color: '#fff', padding: '1px 8px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 600 }}>{opt.badge}</span>}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{opt.desc}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                            {(['wireguard', 'openvpn'] as VpnMode[]).map(m => (
                                <div key={m} onClick={() => p.setVpnMode(m)} style={{ border: p.vpnMode === m ? '2px solid #7c3aed' : '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, cursor: 'pointer', background: p.vpnMode === m ? '#faf5ff' : '#fff', transition: 'all 0.2s' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 14, height: 14, borderRadius: '50%', border: p.vpnMode === m ? '5px solid #7c3aed' : '2px solid var(--border)', flexShrink: 0 }} />
                                        <div>
                                            <strong style={{ fontSize: '0.85rem' }}>{m === 'wireguard' ? 'WireGuard Only' : 'OpenVPN Only'}</strong>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m === 'wireguard' ? 'Fast & modern VPN' : 'Traditional, compatible'}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Info note */}
                    <div style={{ marginTop: 8, padding: '12px 16px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <VpnKeyIcon style={{ fontSize: 18, color: '#7c3aed', marginTop: 2 }} />
                        <div style={{ fontSize: '0.82rem', color: '#5b21b6', lineHeight: 1.6 }}>
                            <strong>WireGuard Tunnel Note:</strong><br />
                            The VPN tunnel allows the billing server to manage this router securely. WireGuard keys and peer configuration are generated automatically when you set up the router in the system. RADIUS handles all subscriber authentication — no manual PPP secrets are needed here.
                        </div>
                    </div>
                </>)}
            </div>
        </div>
    );
}
