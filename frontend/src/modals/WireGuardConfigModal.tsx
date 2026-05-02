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
import { PUBLIC_API_BASE } from '../utils/config';
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
    tunnelActive: boolean;
    lastHandshakeSeconds: number | null;
    tunnelStatusMessage: string;
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

    // Compute subnet from tunnel IP dynamically
    const subnetPrefix = config.routerTunnelIp.split('.').slice(0, 3).join('.');
    const subnetAddress = `${subnetPrefix}.0/24`;
    // Always use the server public key returned from the backend (dynamically fetched via wg show)
    const serverPubKey = config.serverPublicKey;

    const restPort = router.apiPort || (router.port === 8728 || router.port === 8729 ? 80 : router.port) || 80;

    // Build MikroTik server script with CORRECT syntax
    const safeRouterName = config.routerName.replace(/\\s+/g, '-');
    const safeRouterNameLower = config.routerName.toLowerCase().replace(/\\s+/g, '-');

    const apiHost = new URL(PUBLIC_API_BASE).hostname;

    const serverConfig = `# ============================================
# Kenge Complete Router Setup Script
# ============================================
# Router: ${config.routerName}
# Device ID: ${config.routerId}
# VPN IP: ${config.routerTunnelIp}
# Generated: ${new Date().toLocaleString()}
# ============================================

:global lanBridge "bridge-lan";
:global wanInterface "ether1";

# ============================================
# STEP 1: Set Router Identity, User & Clean DNS
# ============================================
/system identity set name="${config.routerName}"
:if ([:len [/user find name="admin"]] > 0) do={ /user set [find name="admin"] name="${router.username || 'admin'}" password="${router.password || ''}" } else={ :if ([:len [/user find name="${router.username || 'admin'}"]] > 0) do={ /user set [find name="${router.username || 'admin'}"] password="${router.password || ''}" } }
/ip dns set servers=8.8.8.8,8.8.4.4 allow-remote-requests=yes
/system ntp client set enabled=yes
:if ([:len [/system ntp client servers find where address="pool.ntp.org"]] = 0) do={ /system ntp client servers add address=pool.ntp.org }

# ============================================
# STEP 2: Bridge (No ports added - add manually)
# ============================================
:local existingBridge [/interface bridge find name="bridge"];
:if ([:len $existingBridge] > 0) do={
    :set lanBridge "bridge";
} else={
    :if ([:len [/interface bridge find name=$lanBridge]] = 0) do={
        /interface bridge add name=$lanBridge comment="Kenge LAN Bridge - Hotspot & PPPoE"
    }
}

# ============================================
# STEP 3: IP Pools & LAN Address
# ============================================
:if ([:len [/ip address find address="10.116.0.2/24"]] = 0) do={
    /ip address add address=10.116.0.2/24 interface=$lanBridge comment="Kenge Hotspot LAN"
}
:if ([:len [/ip pool find name="hs-pool-${safeRouterName}"]] = 0) do={
    /ip pool add name="hs-pool-${safeRouterName}" ranges=10.116.0.3-10.116.0.254
}
:if ([:len [/ip pool find name="pppoe-pool-${safeRouterName}"]] = 0) do={
    /ip pool add name="pppoe-pool-${safeRouterName}" ranges=10.116.0.3-10.116.0.254
}

# ============================================
# STEP 4: DHCP Server & Hotspot Setup
# ============================================
:if ([:len [/ip dhcp-server network find address="10.116.0.0/24"]] = 0) do={
    /ip dhcp-server network add address=10.116.0.0/24 gateway=10.116.0.2 dns-server=10.116.0.2
}
:if ([:len [/ip dhcp-server find interface=$lanBridge]] = 0) do={
    /ip dhcp-server add address-pool="hs-pool-${safeRouterName}" disabled=no interface=$lanBridge name="dhcp-${safeRouterName}"
}
:if ([:len [/ip hotspot profile find name="hsprof-${safeRouterNameLower}"]] = 0) do={
    /ip hotspot profile add hotspot-address=10.116.0.2 dns-name="${safeRouterNameLower}.hotspot" html-directory=hotspot login-by=http-chap,http-pap,cookie,mac-cookie http-cookie-lifetime=3d name="hsprof-${safeRouterNameLower}" use-radius=yes radius-accounting=yes
}
:if ([:len [/ip hotspot find name="hotspot-${safeRouterName}"]] = 0) do={
    /ip hotspot add address-pool="hs-pool-${safeRouterName}" disabled=no interface=$lanBridge name="hotspot-${safeRouterName}" profile="hsprof-${safeRouterNameLower}"
}

# ============================================
# STEP 5: PPPoE Server Setup
# ============================================
:if ([:len [/ppp profile find name="pppoe-profile-${safeRouterName}"]] = 0) do={
    /ppp profile add name="pppoe-profile-${safeRouterName}" local-address=10.116.0.2 remote-address="pppoe-pool-${safeRouterName}" dns-server=8.8.8.8,1.1.1.1 use-encryption=yes use-radius=yes
}
:if ([:len [/interface pppoe-server server find service-name="pppoe-svc-${safeRouterName}"]] = 0) do={
    /interface pppoe-server server add disabled=no interface=$lanBridge default-profile="pppoe-profile-${safeRouterName}" service-name="pppoe-svc-${safeRouterName}"
}

# ============================================
# STEP 6: WireGuard VPN Configuration
# ============================================
:if ([:len [/interface wireguard find name="wg-kenge"]] = 0) do={
    /interface wireguard add name="wg-kenge" listen-port=${config.listenPort} private-key="${config.routerPrivateKey}" comment="Kenge VPN Interface"
}
:if ([:len [/interface wireguard peers find interface="wg-kenge" public-key="${serverPubKey}"]] = 0) do={
    /interface wireguard peers add interface="wg-kenge" public-key="${serverPubKey}" endpoint-address=${config.serverEndpoint} endpoint-port=${config.serverPort} allowed-address=${subnetAddress} persistent-keepalive=25s comment="Kenge ISP Server"
}
:if ([:len [/ip address find address="${config.routerTunnelIp}/24"]] = 0) do={
    /ip address add address=${config.routerTunnelIp}/24 interface="wg-kenge" comment="VPN Address"
}
:if ([:len [/ip route find dst-address="${subnetAddress}"]] = 0) do={
    /ip route add dst-address=${subnetAddress} gateway="wg-kenge" comment="VPN Route"
}

# ============================================
# STEP 7: Firewall & NAT
# ============================================
:if ([:len [/ip firewall nat find action=masquerade chain=srcnat out-interface=$wanInterface]] = 0) do={
    /ip firewall nat add chain=srcnat out-interface=$wanInterface action=masquerade comment="NAT for Internet - Kenge"
}

# Add WireGuard to LAN list so default firewall doesn't block it
:if ([:len [/interface list find name=LAN]] = 0) do={ /interface list add name=LAN }
:if ([:len [/interface list member find list=LAN interface="wg-kenge"]] = 0) do={
    /interface list member add list=LAN interface="wg-kenge"
}

# We add our custom input rules at the TOP to prevent being dropped by default rules
/ip firewall filter
:if ([:len [find where comment="Allow WireGuard - Kenge"]] = 0) do={
    add place-before=0 chain=input action=accept protocol=udp dst-port=${config.listenPort} comment="Allow WireGuard - Kenge"
}
:if ([:len [find where comment="Allow API/Winbox from VPN - Kenge"]] = 0) do={
    add place-before=0 chain=input action=accept protocol=tcp dst-port=${restPort},8291 src-address=${subnetAddress} comment="Allow API/Winbox from VPN - Kenge"
}

# ============================================
# STEP 8: RADIUS & Walled Garden
# ============================================
:if ([:len [/radius find address="\${apiHost}"]] = 0) do={
    /radius add service=hotspot,ppp address="\${apiHost}" secret="hqinvestment-radius-secret" authentication-port=1812 accounting-port=1813 timeout=3s
}

/ip hotspot walled-garden ip
:if ([:len [find dst-address="\${apiHost}"]] = 0) do={ add action=accept dst-address="\${apiHost}" comment="Billing Portal IP" }
:if ([:len [find dst-port=8291]] = 0) do={ add action=accept dst-port=8291 protocol=tcp comment="Allow Winbox Management" }
:if ([:len [find dst-port=8728]] = 0) do={ add action=accept dst-port=8728,8729 protocol=tcp comment="Allow API Management" }
:if ([:len [find dst-port=80]] = 0) do={ add action=accept dst-port=80,443 protocol=tcp comment="Allow Web Management" }

# ============================================
# STEP 9: System Scheduler (Auto-sync)
# ============================================
/system scheduler
:if ([:len [find name="billing-sync"]] > 0) do={ remove [find name="billing-sync"] }
add name="billing-sync" interval=5m on-event="/tool fetch url=\\"${PUBLIC_API_BASE}/api/sync/${config.routerId}\\"" start-time=startup

# ============================================
# Configuration Complete!
# ============================================
# VPN Configuration:
# - Router VPN IP : ${config.routerTunnelIp}
# - Server VPN IP : ${config.serverTunnelIp}
# - Server Endpoint: ${config.serverEndpoint}:${config.serverPort}
# - Interface      : wg-kenge
# - Listen Port    : ${config.listenPort}
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
                    padding: '10px 24px', background: config.tunnelActive ? '#f0fdf4' : config.enabled ? '#fff7ed' : '#fef3c7',
                    borderBottom: '1px solid var(--border-light)', gap: 8, flexWrap: 'wrap',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: config.tunnelActive ? '#16a34a' : config.enabled ? '#ea580c' : '#d97706',
                            boxShadow: config.tunnelActive ? '0 0 6px #16a34a' : 'none',
                        }} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: config.tunnelActive ? '#15803d' : config.enabled ? '#c2410c' : '#92400e' }}>
                            {config.tunnelStatusMessage || (config.enabled
                                ? `WireGuard Active — Connected via tunnel ${config.routerTunnelIp}`
                                : 'WireGuard Not Configured — Paste script or auto-push')}
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
                        <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>{activeTab === 'server' ? config.routerTunnelIp : "10.0.0.1"}/24</div>
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
                                The system will switch to the WireGuard tunnel IP ({config.routerTunnelIp}) for all future API connections.
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
