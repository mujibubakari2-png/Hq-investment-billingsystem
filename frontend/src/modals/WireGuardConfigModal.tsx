import { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { Router } from '../types';

interface WireGuardConfigModalProps {
    router: Router;
    onClose: () => void;
}

function generateKey(length: number = 44): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result + '=';
}

export default function WireGuardConfigModal({ router, onClose }: WireGuardConfigModalProps) {
    const [copied, setCopied] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'server' | 'client'>('server');

    const routerIdCode = `MYR-${router.id.padStart(3, '0')}VBHBC`;

    // Generate deterministic-looking keys based on router name
    const serverPrivKey = generateKey();
    const serverPubKey = generateKey();
    const clientPrivKey = generateKey();
    const clientPubKey = generateKey();
    const presharedKey = generateKey();

    const serverConfig = `# ═══════════════════════════════════════════════════════════════
# WireGuard Server Config — MikroTik RouterOS
# Router: ${router.name} (${routerIdCode})
# IP: ${router.host}
# Generated: ${new Date().toISOString().split('T')[0]}
# ═══════════════════════════════════════════════════════════════

# ── 1. Create WireGuard Interface ─────────────────────────────
/interface wireguard
add name=wg-kenge listen-port=13231 private-key="${serverPrivKey}"
# Public Key: ${serverPubKey}

# ── 2. Assign IP to WireGuard Interface ───────────────────────
/ip address
add address=10.200.0.1/24 interface=wg-kenge network=10.200.0.0

# ── 3. Add Peer (Kenge Server) ────────────────────────────────
/interface wireguard peers
add interface=wg-kenge \\
    public-key="${clientPubKey}" \\
    preshared-key="${presharedKey}" \\
    allowed-address=10.200.0.0/24 \\
    endpoint-address=vpn.hqinvestment.co.tz \\
    endpoint-port=51820 \\
    persistent-keepalive=25s \\
    comment="Kenge ISP Server"

# ── 4. Firewall Rules (Allow WireGuard) ───────────────────────
/ip firewall filter
add chain=input protocol=udp dst-port=13231 action=accept \\
    comment="Allow WireGuard"
add chain=forward in-interface=wg-kenge action=accept \\
    comment="Allow WG traffic"
add chain=forward out-interface=wg-kenge action=accept \\
    comment="Allow WG return traffic"

# ── 5. NAT for WireGuard Tunnel ───────────────────────────────
/ip firewall nat
add chain=srcnat out-interface=wg-kenge action=masquerade \\
    comment="NAT WireGuard traffic"

# ── 6. Routes ────────────────────────────────────────────────
/ip route
add dst-address=10.200.0.0/24 gateway=wg-kenge \\
    comment="WireGuard subnet route"

# ═══════════════════════════════════════════════════════════════
# ✅ WireGuard configured for "${router.name}"
# Server Endpoint: ${router.host}:13231
# Tunnel Address: 10.200.0.1/24
# ═══════════════════════════════════════════════════════════════`;

    const clientConfig = `# ═══════════════════════════════════════════════════════════════
# WireGuard Client Config — Kenge ISP Server
# For Router: ${router.name} (${routerIdCode})
# Generated: ${new Date().toISOString().split('T')[0]}
# ═══════════════════════════════════════════════════════════════

[Interface]
# Kenge ISP Server side
PrivateKey = ${clientPrivKey}
Address = 10.200.0.2/24
DNS = 8.8.8.8, 1.1.1.1

[Peer]
# Router: ${router.name}
PublicKey = ${serverPubKey}
PresharedKey = ${presharedKey}
AllowedIPs = 10.200.0.0/24, 10.10.0.0/24
Endpoint = ${router.host}:13231
PersistentKeepalive = 25`;

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
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

    const activeConfig = activeTab === 'server' ? serverConfig : clientConfig;
    const activeLabel = activeTab === 'server' ? 'Server (MikroTik)' : 'Client (Kenge)';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 750, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)', color: '#fff',
                    padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <VpnLockIcon />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>WireGuard VPN Configuration</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>{router.name} — {router.host}</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 6, padding: '6px 8px' }}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

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
                        🖥️ Server Config (MikroTik)
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
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                    padding: '12px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border-light)',
                }}>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Tunnel Address</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>10.200.0.{activeTab === 'server' ? '1' : '2'}/24</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Endpoint</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>{router.host}:13231</div>
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
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <InfoOutlinedIcon style={{ fontSize: 16 }} />
                    {activeTab === 'server'
                        ? 'Paste this script into MikroTik Terminal to configure WireGuard VPN.'
                        : 'Use this config on your Kenge server to connect to this router via WireGuard.'
                    }
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
