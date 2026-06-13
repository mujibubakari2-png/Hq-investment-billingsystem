/**
 * Step 2 — Service selection (Hotspot / PPPoE / Both)
 * Step 3 — VPN tunnel configuration
 * FE-001: Extracted from RouterSetupWizard.tsx
 */

import SettingsIcon from '@mui/icons-material/Settings';
import DnsIcon from '@mui/icons-material/Dns';
import WifiIcon from '@mui/icons-material/Wifi';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import LockIcon from '@mui/icons-material/Lock';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { ServiceType, VpnMode, VpnSecret } from './WizardTypes';

// ── Step 2: Services ──────────────────────────────────────────────────────────

interface Step2Props {
    serviceType: ServiceType;
    setServiceType: (v: ServiceType) => void;
    pppoeLocalAddress: string; setPppoeLocalAddress: (v: string) => void;
    pppoePoolStart: string;    setPppoePoolStart:    (v: string) => void;
    pppoePoolEnd: string;      setPppoePoolEnd:      (v: string) => void;
    hotspotLocalAddress: string; setHotspotLocalAddress: (v: string) => void;
    hotspotPoolStart: string;    setHotspotPoolStart:    (v: string) => void;
    hotspotPoolEnd: string;      setHotspotPoolEnd:      (v: string) => void;
    radiusAddress: string;     setRadiusAddress:     (v: string) => void;
    radiusSecret: string;      setRadiusSecret:      (v: string) => void;
}

export function Step2Services(p: Step2Props) {
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
            <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Select which services you want to configure</p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, maxWidth: 750, margin: '0 auto' }}>
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

            {/* IP & RADIUS config */}
            <div style={{ maxWidth: 750, margin: '30px auto 0', textAlign: 'left', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 24, background: '#f8fafc' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SettingsIcon style={{ fontSize: 18, color: 'var(--primary)' }} /> IP &amp; RADIUS Configuration
                </h3>
                <div className="grid-2 gap-20">
                    {(p.serviceType === 'pppoe' || p.serviceType === 'both') && (
                        <div style={{ background: '#fff', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 12, color: '#0d9488' }}>PPPoE Network Settings</div>
                            <div className="form-group"><label className="form-label">Local Gateway Address</label>
                                <input className="form-input" value={p.pppoeLocalAddress} onChange={e => p.setPppoeLocalAddress(e.target.value)} placeholder="Auto-filled from VPN IP" />
                            </div>
                            <div className="grid-2 gap-10">
                                <div className="form-group"><label className="form-label">Pool Start</label><input className="form-input" value={p.pppoePoolStart} onChange={e => p.setPppoePoolStart(e.target.value)} placeholder="Auto-filled from VPN IP" /></div>
                                <div className="form-group"><label className="form-label">Pool End</label><input className="form-input" value={p.pppoePoolEnd} onChange={e => p.setPppoePoolEnd(e.target.value)} placeholder="Auto-filled from VPN IP" /></div>
                            </div>
                        </div>
                    )}
                    {(p.serviceType === 'hotspot' || p.serviceType === 'both') && (
                        <div style={{ background: '#fff', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 12, color: '#0d9488' }}>Hotspot Network Settings</div>
                            <div className="form-group"><label className="form-label">Hotspot Gateway Address</label>
                                <input className="form-input" value={p.hotspotLocalAddress} onChange={e => p.setHotspotLocalAddress(e.target.value)} placeholder="Auto-filled from VPN IP" />
                            </div>
                            <div className="grid-2 gap-10">
                                <div className="form-group"><label className="form-label">Pool Start</label><input className="form-input" value={p.hotspotPoolStart} onChange={e => p.setHotspotPoolStart(e.target.value)} placeholder="Auto-filled from VPN IP" /></div>
                                <div className="form-group"><label className="form-label">Pool End</label><input className="form-input" value={p.hotspotPoolEnd} onChange={e => p.setHotspotPoolEnd(e.target.value)} placeholder="Auto-filled from VPN IP" /></div>
                            </div>
                        </div>
                    )}
                    <div style={{ background: '#fff', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', gridColumn: p.serviceType === 'both' ? 'span 2' : 'auto' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 12, color: '#4338ca' }}>RADIUS Server Settings</div>
                        <div className="grid-2 gap-10">
                            <div className="form-group"><label className="form-label">RADIUS Server IP/Host</label>
                                <input className="form-input" value={p.radiusAddress} onChange={e => p.setRadiusAddress(e.target.value)} placeholder="Server IP" />
                                <div className="form-hint">Address of your billing server</div>
                            </div>
                            <div className="form-group"><label className="form-label">RADIUS Shared Secret</label>
                                <input className="form-input" value={p.radiusSecret} onChange={e => p.setRadiusSecret(e.target.value)} placeholder="Secret key" />
                                <div className="form-hint">Must match server configuration</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Step 3: VPN Configuration ─────────────────────────────────────────────────

interface Step3Props {
    vpnEnabled: boolean;      setVpnEnabled:      (v: boolean) => void;
    vpnMode: VpnMode;         setVpnMode:         (v: VpnMode) => void;
    vpnProtocol: string;      setVpnProtocol:     (v: string) => void;
    vpnPoolStart: string;     setVpnPoolStart:    (v: string) => void;
    vpnPoolEnd: string;       setVpnPoolEnd:      (v: string) => void;
    vpnDns: string;           setVpnDns:          (v: string) => void;
    ipsecSecret: string;      setIpsecSecret:     (v: string) => void;
    vpnSecrets: VpnSecret[];
    showAddVpnSecret: boolean; setShowAddVpnSecret: (v: boolean) => void;
    vpnForm: VpnSecret;       setVpnForm:          (v: VpnSecret) => void;
    onAddSecret: () => void;
    onRemoveSecret: (i: number) => void;
}

export function Step3Vpn(p: Step3Props) {
    return (
        <div style={{ padding: '20px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <VpnKeyIcon style={{ fontSize: 56, color: '#7c3aed', marginBottom: 12 }} />
                <h2 style={{ marginBottom: 6 }}>VPN Tunnel Configuration</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Configure VPN server and secrets on this router</p>
            </div>

            <div style={{ maxWidth: 700, margin: '0 auto' }}>
                {/* Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', marginBottom: 16, background: 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <VpnKeyIcon style={{ color: '#7c3aed' }} />
                        <div>
                            <div style={{ fontWeight: 600 }}>Enable VPN Server</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Configure VPN server on this MikroTik</div>
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

                    {/* VPN Server Settings */}
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 16 }}>
                        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <SettingsIcon style={{ fontSize: 16 }} /> VPN Server Settings
                        </div>
                        <div style={{ padding: 20 }}>
                            <div className="grid-2 gap-16">
                                <div className="form-group"><label className="form-label">VPN Protocol</label>
                                    <select className="form-select" value={p.vpnProtocol} onChange={e => p.setVpnProtocol(e.target.value)}>
                                        <option value="L2TP">L2TP/IPsec</option><option value="PPTP">PPTP</option><option value="SSTP">SSTP</option><option value="OpenVPN">OpenVPN</option>
                                    </select>
                                    <div className="form-hint">L2TP/IPsec recommended for security</div>
                                </div>
                                <div className="form-group"><label className="form-label">IPsec Pre-Shared Key</label>
                                    <input className="form-input" type="password" value={p.ipsecSecret} onChange={e => p.setIpsecSecret(e.target.value)} />
                                    <div className="form-hint">Shared secret for IPsec authentication</div>
                                </div>
                                <div className="form-group"><label className="form-label">IP Pool Start</label><input className="form-input" value={p.vpnPoolStart} onChange={e => p.setVpnPoolStart(e.target.value)} placeholder="10.0.0.2" /></div>
                                <div className="form-group"><label className="form-label">IP Pool End</label><input className="form-input" value={p.vpnPoolEnd} onChange={e => p.setVpnPoolEnd(e.target.value)} placeholder="10.0.0.254" /></div>
                                <div className="form-group"><label className="form-label">DNS Server</label><input className="form-input" value={p.vpnDns} onChange={e => p.setVpnDns(e.target.value)} placeholder="8.8.8.8" /></div>
                            </div>
                        </div>
                    </div>

                    {/* VPN Secrets */}
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <LockIcon style={{ fontSize: 16 }} /> PPP Secrets (VPN Users)
                                <span style={{ background: '#7c3aed', color: '#fff', padding: '1px 8px', borderRadius: 10, fontSize: '0.75rem' }}>{p.vpnSecrets.length}</span>
                            </div>
                            <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '0.8rem' }} onClick={() => p.setShowAddVpnSecret(true)}>
                                <AddIcon style={{ fontSize: 14 }} /> Add Secret
                            </button>
                        </div>
                        <div style={{ padding: 16 }}>
                            {p.vpnSecrets.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
                                    <VpnKeyIcon style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }} />
                                    <div style={{ fontSize: '0.88rem' }}>No VPN secrets added yet</div>
                                    <div style={{ fontSize: '0.78rem', marginTop: 4 }}>Click "Add Secret" to create VPN user credentials</div>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                {['USERNAME','PROTOCOL','PROFILE','LOCAL IP','REMOTE IP',''].map(h => (
                                                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {p.vpnSecrets.map((s, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>{s.username}</td>
                                                    <td style={{ padding: '10px 12px' }}><span style={{ background: '#7c3aed22', color: '#7c3aed', padding: '2px 8px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600 }}>{s.protocol}</span></td>
                                                    <td style={{ padding: '10px 12px' }}>{s.profile}</td>
                                                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.localAddress || 'Auto'}</td>
                                                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.remoteAddress || 'Auto'}</td>
                                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                        <button className="btn-icon delete" onClick={() => p.onRemoveSecret(i)} title="Remove"><DeleteIcon style={{ fontSize: 16 }} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Add Secret Form */}
                    {p.showAddVpnSecret && (
                        <div style={{ marginTop: 16, border: '2px solid #7c3aed33', borderRadius: 'var(--radius-md)', padding: 20, background: '#faf5ff' }}>
                            <div style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}><AddIcon style={{ fontSize: 16, color: '#7c3aed' }} /> New VPN Secret</div>
                            <div className="grid-2 gap-12">
                                <div className="form-group"><label className="form-label">Username <span className="required">*</span></label>
                                    <input className="form-input" placeholder="vpn-user01" value={p.vpnForm.username} onChange={e => p.setVpnForm({ ...p.vpnForm, username: e.target.value })} />
                                </div>
                                <div className="form-group"><label className="form-label">Password <span className="required">*</span></label>
                                    <input className="form-input" type="password" placeholder="Strong password" value={p.vpnForm.password} onChange={e => p.setVpnForm({ ...p.vpnForm, password: e.target.value })} />
                                </div>
                                <div className="form-group"><label className="form-label">Profile</label>
                                    <select className="form-select" value={p.vpnForm.profile} onChange={e => p.setVpnForm({ ...p.vpnForm, profile: e.target.value })}>
                                        <option value="default">default</option><option value="default-encryption">default-encryption</option>
                                    </select>
                                </div>
                                <div className="form-group"><label className="form-label">Protocol</label>
                                    <select className="form-select" value={p.vpnForm.protocol} onChange={e => p.setVpnForm({ ...p.vpnForm, protocol: e.target.value })}>
                                        <option value="L2TP">L2TP/IPsec</option><option value="PPTP">PPTP</option><option value="SSTP">SSTP</option><option value="OpenVPN">OpenVPN</option>
                                    </select>
                                </div>
                                <div className="form-group"><label className="form-label">Local Address</label><input className="form-input" placeholder="Auto-assign" value={p.vpnForm.localAddress} onChange={e => p.setVpnForm({ ...p.vpnForm, localAddress: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Remote Address</label><input className="form-input" placeholder="Auto-assign" value={p.vpnForm.remoteAddress} onChange={e => p.setVpnForm({ ...p.vpnForm, remoteAddress: e.target.value })} /></div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                <button className="btn btn-secondary" onClick={() => p.setShowAddVpnSecret(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={p.onAddSecret}><AddIcon fontSize="small" /> Add Secret</button>
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: 16, padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <InfoOutlinedIcon style={{ fontSize: 18, color: '#1d4ed8', marginTop: 2 }} />
                        <div style={{ fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.6 }}>
                            <strong>VPN Configuration Notes:</strong><br />
                            • VPN secrets will be pushed to MikroTik as PPP Secrets during config generation<br />
                            • {p.vpnProtocol === 'L2TP' ? 'L2TP server with IPsec encryption will be enabled' : `${p.vpnProtocol} server will be enabled`}<br />
                            • IP Pool: {p.vpnPoolStart} – {p.vpnPoolEnd}
                        </div>
                    </div>
                </>)}
            </div>
        </div>
    );
}
