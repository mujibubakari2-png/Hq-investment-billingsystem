import { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SendIcon from '@mui/icons-material/Send';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import SyncIcon from '@mui/icons-material/Sync';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { routersApi } from '../api/client';
import type { Router } from '../types';
import RouterIcon from '@mui/icons-material/Router';

interface WireGuardConfigModalProps {
    router: Router;
    onClose: () => void;
}

interface WgConfig {
    routerId: string;
    routerName: string;
    routerHost: string;
    enabled: boolean;
    configuredAt: string | null;
    routerPrivateKey: string;
    routerPublicKey: string;
    serverPublicKey: string;
    presharedKey: string;
    routerTunnelIp: string;
    serverTunnelIp: string;
    listenPort: number;
    serverEndpoint: string;
    serverPort: number;
}

export default function WireGuardConfigModal({ router, onClose }: WireGuardConfigModalProps) {
    const [copied, setCopied] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'server' | 'client'>('server');
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<WgConfig | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [actionResult, setActionResult] = useState<{ success: boolean; message: string } | null>(null);

    // Fetch persisted WireGuard config from the backend
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                setLoading(true);
                const data = await routersApi.wireguard.getConfig(router.id);
                setConfig((data as unknown) as WgConfig);
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to load WireGuard configuration';
                setError(errorMessage);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, [router.id]);

    if (loading) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal" style={{ maxWidth: 500, padding: 40, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <SyncIcon style={{ fontSize: 48, color: '#15803d', animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: 16, fontWeight: 600 }}>Loading WireGuard Configuration...</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Generating persistent keys for {router.name}</p>
                </div>
            </div>
        );
    }

    if (error || !config) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal" style={{ maxWidth: 500, padding: 30 }} onClick={e => e.stopPropagation()}>
                    <div style={{ textAlign: 'center' }}>
                        <WarningAmberIcon style={{ fontSize: 48, color: '#dc2626' }} />
                        <p style={{ fontWeight: 600, marginTop: 12, color: '#dc2626' }}>Failed to Load Config</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{error}</p>
                        <button className="btn btn-secondary" onClick={onClose} style={{ marginTop: 16 }}>Close</button>
                    </div>
                </div>
            </div>
        );
    }

    // Hardcode the known good subnet to bypass Droplet misconfiguration
    const subnetAddress = "10.0.0.0/24";
    const HARDCODED_SERVER_PUBKEY = "b7ADpdTy6UooXmb7Ve+PgGeXjGFLVFXqsuz32dYNaxA=";

    // Build MikroTik server script with CORRECT syntax (single backslash for line continuation)
    const serverConfig = `# ============================================
# WireGuard VPN Configuration
# ============================================
# Router: ${config.routerName}
# Device ID: ${config.routerId}
# VPN IP: ${config.routerTunnelIp}
# Generated: ${new Date().toLocaleString()}
# ============================================

# ============================================
# STEP 1: Create Management User
# ============================================
/user add name=admin_kenge password="${router.password || 'admin'}" group=full comment="Management User - DO NOT DELETE"

# ============================================
# STEP 2: Set Router Identity
# ============================================
/system identity set name="${config.routerName}"

# ============================================
# STEP 3: WireGuard Interface
# ============================================
/interface wireguard add \\
    name=wg-kenge \\
    listen-port=${config.listenPort} \\
    private-key="${config.routerPrivateKey}" \\
    comment="Kenge VPN Interface"

# ============================================
# STEP 4: WireGuard Peer
# ============================================
/interface wireguard peers add \\
    interface=wg-kenge \\
    public-key="${HARDCODED_SERVER_PUBKEY}" \\
    endpoint-address=${config.serverEndpoint} \\
    endpoint-port=${config.serverPort} \\
    allowed-address=${subnetAddress} \\
    persistent-keepalive=25s \\
    comment="Kenge ISP Server"

# ============================================
# STEP 5: IP Address
# ============================================
/ip address add address=${config.routerTunnelIp.replace("10.200", "10.0")}/24 interface=wg-kenge comment="VPN Address"

# ============================================
# STEP 6: Route
# ============================================
/ip route add dst-address=${subnetAddress} gateway=wg-kenge comment="VPN Route"

# ============================================
# STEP 7: Firewall
# ============================================
/ip firewall filter add chain=input action=accept protocol=udp dst-port=${config.listenPort} comment="Allow WireGuard VPN"
/ip firewall filter add chain=forward action=accept in-interface=wg-kenge comment="Allow VPN Traffic"
/ip firewall filter add chain=forward action=accept out-interface=wg-kenge comment="Allow VPN Return Traffic"

# ============================================
# STEP 8: DNS
# ============================================
/ip dns set servers=8.8.8.8,8.8.4.4 allow-remote-requests=yes

# ============================================
# Configuration Complete!
# ============================================
# Management Credentials:
# - Username: admin_kenge
# - Password: ${router.password || 'admin'}
#
# VPN Configuration:
# - VPN IP: ${config.routerTunnelIp.replace("10.200", "10.0")}
# - Endpoint: ${config.serverEndpoint}:${config.serverPort}
# - Interface: wg-kenge
# - Listen Port: ${config.listenPort}
#
# IMPORTANT: Save these credentials securely!
# ============================================`;

    // Client config for the HQInvestment ISP server
    const clientConfig = `# ═══════════════════════════════════════════════════════════════
# WireGuard Client Config — Kenge ISP Server
# For Router: ${config.routerName} (${config.routerId})
# Keys are PERSISTENT — install this on the Kenge VPN server
# ═══════════════════════════════════════════════════════════════

[Interface]
# Kenge ISP Server side
PrivateKey = <SERVER_PRIVATE_KEY>
Address = 10.0.0.1/24
DNS = 8.8.8.8, 1.1.1.1

[Peer]
# Router: ${config.routerName}
PublicKey = ${config.routerPublicKey}
PresharedKey = ${config.presharedKey}
AllowedIPs = ${subnetAddress}, ${config.routerHost}/32
Endpoint = ${config.routerHost}:${config.listenPort}
PersistentKeepalive = 25`;

    const handleCopy = (text: string, label: string) => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
        } else {
            // Fallback for HTTP environments (like testing via Droplet IP)
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
            document.body.removeChild(textArea);
        }
        setCopied(label);
        setTimeout(() => setCopied(null), 2500);
    };

    const handleDownload = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleAction = async (action: 'activate' | 'deactivate' | 'push-config') => {
        setActionLoading(action);
        setActionResult(null);
        try {
            let result;
            if (action === 'activate') result = await routersApi.wireguard.activate(router.id);
            else if (action === 'deactivate') result = await routersApi.wireguard.deactivate(router.id);
            else result = await routersApi.wireguard.pushConfig(router.id);

            const resultObj = (result as unknown) as Record<string, unknown>;
            const success = typeof resultObj.success === 'boolean' ? (resultObj.success as boolean) : false;
            const message = typeof resultObj.message === 'string' ? (resultObj.message as string) : 'Action completed';
            setActionResult({ success, message });
            if (success) {
                if (config) {
                    setConfig({ ...config, enabled: action !== 'deactivate', configuredAt: new Date().toISOString() });
                }
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Action failed';
            setActionResult({ success: false, message: errorMessage });
        } finally {
            setActionLoading(null);
        }
    };

    const activeConfig = activeTab === 'server' ? serverConfig : clientConfig;
    const activeLabel = activeTab === 'server' ? 'Server (MikroTik)' : 'Client (Kenge)';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 780, maxHeight: '94vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)', color: '#fff',
                    padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <VpnLockIcon />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>WireGuard VPN Configuration</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>
                                {router.name} — {router.host}
                                {config.enabled && <span style={{ marginLeft: 8, background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem' }}>✅ ACTIVE</span>}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 6, padding: '6px 8px' }}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                {/* Status + Action Buttons */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 24px', background: config.enabled ? '#f0fdf4' : '#fef3c7',
                    borderBottom: '1px solid var(--border-light)', gap: 8, flexWrap: 'wrap',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: config.enabled ? '#16a34a' : '#d97706',
                            boxShadow: config.enabled ? '0 0 6px #16a34a' : 'none',
                        }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: config.enabled ? '#15803d' : '#92400e' }}>
                            {config.enabled
                                ? `WireGuard Active — Connected via tunnel ${config.routerTunnelIp}`
                                : 'WireGuard Not Configured — Paste script or auto-push'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {!config.enabled ? (
                            <>
                                <button
                                    className="btn"
                                    style={{ background: '#15803d', color: '#fff', fontWeight: 600, fontSize: '0.78rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4 }}
                                    onClick={() => handleAction('push-config')}
                                    disabled={actionLoading !== null}
                                >
                                    {actionLoading === 'push-config' ? <SyncIcon style={{ fontSize: 14, animation: 'spin 1s linear infinite' }} /> : <SendIcon style={{ fontSize: 14 }} />}
                                    Auto-Push to Router
                                </button>
                                <button
                                    className="btn"
                                    style={{ background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.78rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4 }}
                                    onClick={() => handleAction('activate')}
                                    disabled={actionLoading !== null}
                                >
                                    {actionLoading === 'activate' ? <SyncIcon style={{ fontSize: 14, animation: 'spin 1s linear infinite' }} /> : <CheckCircleIcon style={{ fontSize: 14 }} />}
                                    I Pasted It — Activate
                                </button>
                            </>
                        ) : (
                            <button
                                className="btn"
                                style={{ background: '#dc2626', color: '#fff', fontWeight: 600, fontSize: '0.78rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 4 }}
                                onClick={() => handleAction('deactivate')}
                                disabled={actionLoading !== null}
                            >
                                {actionLoading === 'deactivate' ? <SyncIcon style={{ fontSize: 14, animation: 'spin 1s linear infinite' }} /> : <PowerSettingsNewIcon style={{ fontSize: 14 }} />}
                                Deactivate
                            </button>
                        )}
                    </div>
                </div>

                {/* Action Result */}
                {actionResult && (
                    <div style={{
                        padding: '8px 24px', fontSize: '0.82rem', fontWeight: 500,
                        background: actionResult.success ? '#dcfce7' : '#fee2e2',
                        color: actionResult.success ? '#166534' : '#dc2626',
                        display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        {actionResult.success ? <CheckCircleIcon style={{ fontSize: 14 }} /> : <WarningAmberIcon style={{ fontSize: 14 }} />}
                        {actionResult.message}
                    </div>
                )}

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)' }}>
                    <button
                        onClick={() => setActiveTab('server')}
                        style={{
                            flex: 1, padding: '12px 16px', border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: '0.85rem',
                            background: activeTab === 'server' ? '#f0fdf4' : 'transparent',
                            color: activeTab === 'server' ? '#15803d' : 'var(--text-secondary)',
                            borderBottom: activeTab === 'server' ? '2px solid #15803d' : '2px solid transparent',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                            <RouterIcon style={{ fontSize: 18 }} /> Server Config (MikroTik)
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('client')}
                        style={{
                            flex: 1, padding: '12px 16px', border: 'none', cursor: 'pointer',
                            fontWeight: 600, fontSize: '0.85rem',
                            background: activeTab === 'client' ? '#f0fdf4' : 'transparent',
                            color: activeTab === 'client' ? '#15803d' : 'var(--text-secondary)',
                            borderBottom: activeTab === 'client' ? '2px solid #15803d' : '2px solid transparent',
                        }}
                    >
                        🌐 Client Config (Kenge Server)
                    </button>
                </div>

                {/* Key Info Bar */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12,
                    padding: '12px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border-light)',
                }}>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Tunnel Address</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>{activeTab === 'server' ? config.routerTunnelIp.replace("10.200", "10.0") : "10.0.0.1"}/24</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Listen Port</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>{config.listenPort}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Server Endpoint</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>{config.serverEndpoint}:{config.serverPort}</div>
                    </div>
                </div>

                {/* Config Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
                    <pre style={{
                        background: '#1e1e2e', color: '#a6e3a1',
                        padding: 20, borderRadius: 10, fontSize: '0.78rem',
                        lineHeight: 1.6, fontFamily: "'Fira Code', 'Consolas', monospace",
                        overflow: 'auto', marginTop: 16, whiteSpace: 'pre-wrap',
                        border: '1px solid #313244',
                    }}>
                        {activeConfig}
                    </pre>
                </div>

                {/* Info Note */}
                <div style={{
                    background: '#f0fdf4', padding: '10px 24px', fontSize: '0.8rem', color: '#15803d',
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                    <InfoOutlinedIcon style={{ fontSize: 16, marginTop: 2, flexShrink: 0 }} />
                    <div>
                        {activeTab === 'server'
                            ? <>
                                <strong>Option 1:</strong> Click "Auto-Push to Router" to configure automatically via API.<br />
                                <strong>Option 2:</strong> Copy and paste this script into MikroTik Terminal, then click "I Pasted It — Activate".<br />
                                The system will switch to the WireGuard tunnel IP ({config.routerTunnelIp.replace("10.200", "10.0")}) for all future API connections.
                            </>
                            : 'Install this config on your Kenge VPN server to complete the tunnel. Replace <SERVER_PRIVATE_KEY> with your actual server private key.'
                        }
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
                    padding: '14px 24px', borderTop: '1px solid var(--border-light)', gap: 8,
                }}>
                    <button className="btn btn-secondary" onClick={() => handleCopy(activeConfig, activeLabel)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {copied === activeLabel ? <CheckCircleIcon style={{ fontSize: 16, color: '#16a34a' }} /> : <ContentCopyIcon style={{ fontSize: 16 }} />}
                        {copied === activeLabel ? 'Copied!' : `Copy ${activeTab === 'server' ? 'Script' : 'Config'}`}
                    </button>
                    <button className="btn" style={{ background: '#15803d', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => handleDownload(
                            activeConfig,
                            activeTab === 'server'
                                ? `wg-server-${router.name.toLowerCase().replace(/\s+/g, '-')}.rsc`
                                : `wg-client-${router.name.toLowerCase().replace(/\s+/g, '-')}.conf`
                        )}
                    >
                        <DownloadIcon style={{ fontSize: 16 }} />
                        Download {activeTab === 'server' ? '.rsc' : '.conf'}
                    </button>
                </div>
            </div>
        </div>
    );
}
