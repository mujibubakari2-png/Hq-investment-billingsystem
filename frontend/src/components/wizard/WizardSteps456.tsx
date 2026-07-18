/**
 * Step 4 — Interface selection
 * Step 5 — Generate RSC config
 * Step 6 — Verify setup
 * FE-001: Extracted from RouterSetupWizard.tsx
 */

import CableIcon from '@mui/icons-material/Cable';
import DescriptionIcon from '@mui/icons-material/Description';
import VerifiedIcon from '@mui/icons-material/Verified';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ListIcon from '@mui/icons-material/List';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WifiIcon from '@mui/icons-material/Wifi';
import DnsIcon from '@mui/icons-material/Dns';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SettingsIcon from '@mui/icons-material/Settings';
import { sanitizeMikroTikName } from '../../utils/mikrotikUtils';
import type { EthernetInterface, ServiceType, VpnMode, VerifyStatus } from './WizardTypes';

// ── Step 4: Interfaces ────────────────────────────────────────────────────────

interface Step4Props {
    routerName: string;
    interfaces: EthernetInterface[];
    loadingInterfaces: boolean;
    selectedInterfaces: string[];
    onToggleInterface: (name: string) => void;
    onRefresh: () => void;
}

export function Step4Interfaces({ routerName, interfaces, loadingInterfaces, selectedInterfaces, onToggleInterface, onRefresh }: Step4Props) {
    return (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <CableIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
            <h2 style={{ marginBottom: 6 }}>Select Network Interfaces</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Choose ethernet ports for your services</p>

            <div style={{ maxWidth: 650, margin: '0 auto 20px', padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <WarningAmberIcon style={{ color: '#d97706', fontSize: 20, marginTop: 2 }} />
                <div style={{ fontSize: '0.85rem', color: '#b45309' }}>
                    <strong>Important:</strong> Do NOT select the interface that provides your router's Internet connection (usually <strong>ether1</strong> or your WAN port). Adding it to the service bridge will disconnect your router from the internet!
                </div>
            </div>

            <div style={{ maxWidth: 650, margin: '0 auto', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>🌐 Available Ethernet Interfaces</div>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={onRefresh}>
                        <RefreshIcon fontSize="inherit" /> Refresh
                    </button>
                </div>

                {loadingInterfaces ? (
                    <div style={{ textAlign: 'center', padding: 40, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                        <RefreshIcon className="spin" style={{ color: 'var(--primary)', marginBottom: 10 }} />
                        <p style={{ color: 'var(--text-secondary)' }}>Fetching interfaces from {routerName}...</p>
                    </div>
                ) : interfaces.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                        <WarningAmberIcon style={{ color: '#d97706', fontSize: 32, marginBottom: 10 }} />
                        <p style={{ color: 'var(--text-secondary)' }}>No ethernet interfaces found. Please check connection.</p>
                    </div>
                ) : (
                    <div className="grid-2 gap-12">
                        {interfaces.map(iface => (
                            <div key={iface.name} onClick={() => onToggleInterface(iface.name)} style={{
                                border: selectedInterfaces.includes(iface.name) ? '2px solid #0d9488' : '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)', padding: '14px 16px', cursor: 'pointer',
                                background: selectedInterfaces.includes(iface.name) ? '#f0fdfa' : '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <input type="checkbox" checked={selectedInterfaces.includes(iface.name)} onChange={() => onToggleInterface(iface.name)} style={{ width: 16, height: 16 }} />
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{iface.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{iface.type} - {iface.mac}</div>
                                    </div>
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: iface.status === 'Up' ? '#16a34a' : '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    ⊙ {iface.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ marginTop: 20, padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <InfoOutlinedIcon style={{ fontSize: 18, color: '#1d4ed8', marginTop: 2 }} />
                    <div style={{ fontSize: '0.85rem', color: '#1e40af' }}>
                        <strong>Bridge Information:</strong><br />
                        A bridge will be created and selected interfaces will be added as ports.
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Step 5: Generate ──────────────────────────────────────────────────────────

interface Step5Props {
    routerName: string;
    serviceType: ServiceType;
    selectedInterfaces: string[];
    vpnEnabled: boolean;
    hotspotLocalAddress: string;
    pppoeLocalAddress: string;
    configGenerated: boolean;
    showPreview: boolean;
    setShowPreview: (v: boolean) => void;
    getGeneratedScript: () => string;
    onDownload: () => void;
}

export function Step5Generate(p: Step5Props) {
    const safeName = sanitizeMikroTikName(p.routerName);
    return (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <DescriptionIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
            <h2 style={{ marginBottom: 6 }}>Generate Configuration</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Create RSC configuration file</p>

            {/* Summary */}
            <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'left', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, color: '#0d9488' }}>Configuration Summary</div>
                <div style={{ padding: 20 }}>
                    <div className="grid-2 gap-16" style={{ marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <SettingsIcon style={{ fontSize: 14 }} /> Service Type:
                            </div>
                            <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <DnsIcon style={{ fontSize: 16 }} />
                                {p.serviceType === 'pppoe' ? 'PPPoE Server Only' : p.serviceType === 'hotspot' ? 'Hotspot Only' : 'Both Services'}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Selected Interfaces:</div>
                            <div style={{ fontWeight: 500 }}>{p.selectedInterfaces.length > 0 ? p.selectedInterfaces.join(', ') : 'None selected'}</div>
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>Bridge Configuration:</div>
                        <div style={{ fontSize: '0.82rem', color: '#0d9488' }}>
                            Bridge will be created for{' '}
                            {p.serviceType === 'pppoe' ? 'PPPoE server' : p.serviceType === 'hotspot' ? 'Hotspot server' : 'PPPoE & Hotspot servers'}{' '}
                            with selected interfaces.
                        </div>
                    </div>
                </div>
            </div>

            {/* Download card */}
            <div style={{ maxWidth: 600, margin: '24px auto', padding: 30, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                <RocketLaunchIcon style={{ fontSize: 48, color: 'var(--text-secondary)', marginBottom: 12 }} />
                <h3 style={{ marginBottom: 6 }}>Ready to Generate Configuration</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>Click to create your custom RSC configuration file</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button className="btn" style={{ background: '#3b82f6', color: '#fff', fontWeight: 600, padding: '10px 24px' }} onClick={() => p.setShowPreview(!p.showPreview)}>
                        <ListIcon fontSize="small" /> {p.showPreview ? 'Hide Preview' : 'Preview Script'}
                    </button>
                    <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 24px' }} onClick={p.onDownload}>
                        <FileDownloadIcon fontSize="small" /> Generate &amp; Download
                    </button>
                </div>

                {p.showPreview && (
                    <div style={{ marginTop: 20, textAlign: 'left', background: '#1e293b', borderRadius: 'var(--radius-md)', padding: '16px', overflowX: 'auto' }}>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Script Preview</div>
                        {(!p.hotspotLocalAddress || !p.pppoeLocalAddress) ? (
                            <div style={{ color: '#f87171', fontSize: '0.85rem', padding: '12px 0' }}>⚠️ VPN IP not loaded yet. Please wait for WireGuard config to finish loading.</div>
                        ) : (
                            <pre style={{ margin: 0, color: '#e2e8f0', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                                {p.getGeneratedScript()}
                            </pre>
                        )}
                    </div>
                )}

                {p.configGenerated && (
                    <div style={{ marginTop: 12, color: '#16a34a', fontWeight: 500, fontSize: '0.85rem' }}>✅ Configuration generated and downloaded!</div>
                )}
            </div>

            <div style={{ maxWidth: 600, margin: '0 auto 16px', padding: 20, background: '#ecfeff', border: '1px solid #67e8f9', borderRadius: 'var(--radius-sm)', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <InfoOutlinedIcon style={{ fontSize: 18, color: '#0f766e' }} />
                    <strong style={{ fontSize: '0.9rem' }}>Why this order matters</strong>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#115e59', lineHeight: 1.7 }}>
                    The generated script intentionally places the “drop unauthenticated LAN forward” rule after the walled-garden rules. That keeps the hotspot login portal reachable so customers can still open the login page, pay, and authenticate.
                </div>
            </div>

            <div style={{ maxWidth: 600, margin: '0 auto', padding: 20, background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 'var(--radius-sm)', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <WarningAmberIcon style={{ fontSize: 18, color: '#d97706' }} />
                    <strong style={{ fontSize: '0.9rem' }}>Next Steps:</strong>
                </div>
                <ol style={{ paddingLeft: 20, margin: 0, fontSize: '0.85rem', color: '#374151', lineHeight: 1.8 }}>
                    <li>Download the generated RSC file</li>
                    <li>Upload it to your MikroTik router via Winbox Files</li>
                    <li>Import it using Terminal: <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, color: 'var(--primary)' }}>/import {safeName}_config.rsc</code></li>
                    <li>Wait for import completion (1-2 minutes)</li>
                    <li>Click "Next" to verify the configuration</li>
                </ol>
            </div>
        </div>
    );
}

// ── Step 6: Verify ────────────────────────────────────────────────────────────

interface Step6Props {
    routerName: string;
    serviceType: ServiceType;
    vpnEnabled: boolean;
    vpnMode: VpnMode;
    serviceVerifyStatus: VerifyStatus;
    vpnVerifyStatus: VerifyStatus;
    onGoBack: () => void;
    onFinish: () => void;
}

export function Step6Verify(p: Step6Props) {
    const svcIcon = p.serviceType === 'hotspot'
        ? <WifiIcon style={{ fontSize: 16 }} />
        : p.serviceType === 'both'
            ? <DeviceHubIcon style={{ fontSize: 16 }} />
            : <DnsIcon style={{ fontSize: 16 }} />;

    const svcLabel = p.serviceType === 'pppoe' ? 'PPPoE Server Status'
        : p.serviceType === 'hotspot' ? 'Hotspot Server Status'
            : 'PPPoE & Hotspot Status';

    const overallChecking = p.serviceVerifyStatus === 'checking' || (p.vpnEnabled && p.vpnVerifyStatus === 'checking');
    const overallFailed = p.serviceVerifyStatus === 'failed' || (p.vpnEnabled && p.vpnVerifyStatus === 'failed');
    const overallSuccess = p.serviceVerifyStatus === 'success' && (!p.vpnEnabled || p.vpnVerifyStatus === 'success');

    return (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <VerifiedIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
            <h2 style={{ marginBottom: 6 }}>Configuration Status Verification</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Verifying service configuration</p>

            <div style={{ display: 'grid', gridTemplateColumns: p.vpnEnabled ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr', gap: 16, maxWidth: 650, margin: '0 auto 24px' }}>
                {/* Service check */}
                <div style={{ textAlign: 'left', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {svcIcon}{svcLabel}
                    </div>
                    <div style={{ padding: 20, textAlign: 'center' }}>
                        {p.serviceVerifyStatus === 'checking' ? (
                            <><RefreshIcon className="spin" style={{ fontSize: 40, color: 'var(--primary)', marginBottom: 8 }} />
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Checking {p.serviceType === 'both' ? 'PPPoE & Hotspot' : p.serviceType} service...</div></>
                        ) : p.serviceVerifyStatus === 'failed' ? (
                            <><CancelIcon style={{ fontSize: 40, color: '#dc2626', marginBottom: 8 }} />
                                <div style={{ color: '#dc2626', fontWeight: 600, marginBottom: 4 }}>Configuration Failed</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Services not found on router</div></>
                        ) : (
                            <><CheckCircleIcon style={{ fontSize: 40, color: '#16a34a', marginBottom: 8 }} />
                                <div style={{ color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>Configuration Successful</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Services are running</div></>
                        )}
                    </div>
                </div>

                {/* VPN check */}
                {p.vpnEnabled && (
                    <div style={{ textAlign: 'left', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <VpnKeyIcon style={{ fontSize: 16 }} /> VPN Server Status
                        </div>
                        <div style={{ padding: 20, textAlign: 'center' }}>
                            {p.vpnVerifyStatus === 'checking' ? (
                                <><RefreshIcon className="spin" style={{ fontSize: 40, color: '#7c3aed', marginBottom: 8 }} />
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Checking VPN ({p.vpnMode}) status...</div></>
                            ) : p.vpnVerifyStatus === 'failed' ? (
                                <><CancelIcon style={{ fontSize: 40, color: '#d97706', marginBottom: 8 }} />
                                    <div style={{ color: '#d97706', fontWeight: 600, marginBottom: 4 }}>Pending Setup</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.vpnMode === 'wireguard' ? 'WireGuard' : p.vpnMode === 'openvpn' ? 'OpenVPN' : 'Hybrid VPN'} server not yet active</div></>
                            ) : (
                                <><CheckCircleIcon style={{ fontSize: 40, color: '#16a34a', marginBottom: 8 }} />
                                    <div style={{ color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>VPN Active</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.vpnMode === 'wireguard' ? 'WireGuard' : p.vpnMode === 'openvpn' ? 'OpenVPN' : 'Hybrid'} tunnel is active</div></>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Overall result */}
            <div style={{ maxWidth: 600, margin: '0 auto', padding: 30, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                {overallChecking ? (
                    <>
                        <RefreshIcon className="spin" style={{ fontSize: 48, color: 'var(--primary)', marginBottom: 12 }} />
                        <h3 style={{ color: 'var(--primary)', marginBottom: 16 }}>Verifying Configuration</h3>
                        <p style={{ color: '#374151', fontSize: '0.9rem', margin: '8px 0 20px' }}>
                            Please wait while we verify the router configuration...
                        </p>
                    </>
                ) : overallFailed ? (
                    <>
                        <CancelIcon style={{ fontSize: 48, color: '#dc2626', marginBottom: 12 }} />
                        <h3 style={{ color: '#dc2626', marginBottom: 16 }}>Configuration Failed</h3>
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontSize: '0.85rem', color: '#b91c1c', marginBottom: 20 }}>
                            {p.serviceVerifyStatus === 'failed' ? (
                                p.serviceType === 'hotspot' ? 'Hotspot configuration failed. Please check your RSC file import and try again.'
                                : p.serviceType === 'pppoe' ? 'PPPoE configuration failed. Please check your RSC file import and try again.'
                                : 'Both Hotspot and PPPoE configurations failed. Please check your RSC file import and try again.'
                            ) : p.vpnEnabled && p.vpnVerifyStatus === 'failed' ? (
                                'VPN configuration failed. Please check your setup and try again.'
                            ) : (
                                'Configuration failed. Please check your setup and try again.'
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={p.onGoBack}><ArrowBackIcon fontSize="small" /> Go Back and Try Again</button>
                            <button className="btn btn-secondary" onClick={p.onFinish}><ListIcon fontSize="small" /> Back to Router List</button>
                        </div>
                    </>
                ) : overallSuccess ? (
                    <>
                        <CheckCircleIcon style={{ fontSize: 48, color: '#16a34a', marginBottom: 12 }} />
                        <h3 style={{ color: '#16a34a' }}>All Systems Go!</h3>
                        <p style={{ color: '#374151', fontSize: '0.9rem', margin: '8px 0 20px' }}>
                            Router <strong>{p.routerName}</strong> is fully configured and connected.
                            {p.vpnEnabled && ` VPN tunnel (${p.vpnMode}) is active.`}
                        </p>
                        <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 24px' }} onClick={p.onFinish}>
                            Go to Routers Dashboard
                        </button>
                    </>
                ) : (
                    <>
                        <RefreshIcon className="spin" style={{ fontSize: 48, color: 'var(--primary)', marginBottom: 12 }} />
                        <h3 style={{ color: 'var(--primary)', marginBottom: 16 }}>Checking Status...</h3>
                    </>
                )}
            </div>
        </div>
    );
}
