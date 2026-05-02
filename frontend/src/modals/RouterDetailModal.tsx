import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RouterIcon from '@mui/icons-material/Router';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import LoginIcon from '@mui/icons-material/Login';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WireGuardConfigModal from './WireGuardConfigModal';
import { PUBLIC_API_BASE } from '../utils/config';
import type { Router } from '../types';
import { formatDateTime } from '../utils/formatters';

interface RouterDetailModalProps {
    router: Router;
    onClose: () => void;
    onDelete?: (router: Router) => void;
}

export default function RouterDetailModal({ router, onClose, onDelete }: RouterDetailModalProps) {
    const navigate = useNavigate();
    const [showWireGuard, setShowWireGuard] = useState(false);

    const downloadScript = () => {
        const routerIdCode = `MYR-${router.id.padStart(3, '0')}VBHBC`;
        const safeRouterName = router.name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').toLowerCase();
        const displayRouterName = router.name.replace(/"/g, '\\"');

        // Extract the actual backend/RADIUS IP or domain from PUBLIC_API_BASE
        const apiHost = new URL(PUBLIC_API_BASE).hostname;

        const script = `# ═══════════════════════════════════════════════════════════════
# HQINVESTMENT ISP Billing - MikroTik Auto-Configuration Script
# Router: ${router.name}
# ID: ${routerIdCode}
# Generated: ${new Date().toISOString().split('T')[0]}
# ═══════════════════════════════════════════════════════════════

:global lanBridge "bridge-lan";
:global wanInterface "ether1";

# ── 1. System Identity & User ────────────────────────────────────────
/system identity set name="${displayRouterName}"
:if ([:len [/user find name="admin"]] > 0) do={ /user set [find name="admin"] name="${router.username || 'admin'}" password="${router.password || ''}" } else={ :if ([:len [/user find name="${router.username || 'admin'}"]] > 0) do={ /user set [find name="${router.username || 'admin'}"] password="${router.password || ''}" } }

# ── 2. Bridge Setup ─────────────────────────────────────────────
# Check if default bridge exists, use it instead
:local existingBridge [/interface bridge find name="bridge"];
:if ([:len $existingBridge] > 0) do={
    :set lanBridge "bridge";
} else={
    :if ([:len [/interface bridge find name=$lanBridge]] = 0) do={
        /interface bridge add name=$lanBridge comment="LAN Bridge - Hotspot & PPPoE"
        # Add default ports if they aren't in another bridge
        :foreach iface in=[/interface ethernet find name!="ether1"] do={
            :local ifaceName [/interface get $iface name];
            :if ([:len [/interface bridge port find interface=$ifaceName]] = 0) do={
                /interface bridge port add bridge=$lanBridge interface=$ifaceName
            }
        }
    }
}

# ── 3. Hotspot Server Setup ───────────────────────────────────
:if ([:len [/ip hotspot profile find name="hsprof-${safeRouterName}"]] = 0) do={
    /ip hotspot profile add name="hsprof-${safeRouterName}" hotspot-address=10.116.0.2 dns-name="${safeRouterName}.hotspot" \\
        html-directory=hotspot login-by=http-chap,http-pap,cookie,mac-cookie \\
        http-cookie-lifetime=3d use-radius=yes radius-accounting=yes
}

:if ([:len [/ip pool find name="hs-pool-${safeRouterName}"]] = 0) do={
    /ip pool add name="hs-pool-${safeRouterName}" ranges=10.116.0.3-10.116.0.254
}

:if ([:len [/ip hotspot find name="hotspot-${safeRouterName}"]] = 0) do={
    :if ([:len [/ip hotspot find interface=$lanBridge]] = 0) do={
        /ip hotspot add name="hotspot-${safeRouterName}" interface=$lanBridge address-pool="hs-pool-${safeRouterName}" \\
            profile="hsprof-${safeRouterName}" disabled=no
    } else={
        /ip hotspot set [find interface=$lanBridge] profile="hsprof-${safeRouterName}"
    }
}

# ── 4. PPPoE Server Setup ─────────────────────────────────────
:if ([:len [/ip pool find name="pppoe-pool-${safeRouterName}"]] = 0) do={
    /ip pool add name="pppoe-pool-${safeRouterName}" ranges=10.116.0.3-10.116.0.254
}

:if ([:len [/ppp profile find name="pppoe-profile-${safeRouterName}"]] = 0) do={
    /ppp profile add name="pppoe-profile-${safeRouterName}" local-address=10.116.0.2 remote-address="pppoe-pool-${safeRouterName}" dns-server=8.8.8.8,1.1.1.1 use-encryption=yes use-radius=yes
}

:if ([:len [/interface pppoe-server server find service-name="pppoe-svc-${safeRouterName}"]] = 0) do={
    /interface pppoe-server server add service-name="pppoe-svc-${safeRouterName}" interface=$lanBridge default-profile="pppoe-profile-${safeRouterName}" disabled=no
}

# ── 5. DHCP Server ───────────────────────────────────────────
:if ([:len [/ip address find address="10.116.0.2/24"]] = 0) do={
    /ip address add address=10.116.0.2/24 interface=$lanBridge
}

:if ([:len [/ip dhcp-server network find address="10.116.0.0/24"]] = 0) do={
    /ip dhcp-server network add address=10.116.0.0/24 gateway=10.116.0.2 dns-server=10.116.0.2,8.8.8.8
}

:if ([:len [/ip dhcp-server find interface=$lanBridge]] = 0) do={
    /ip dhcp-server add name="dhcp-${safeRouterName}" interface=$lanBridge address-pool="hs-pool-${safeRouterName}" disabled=no
}

# ── 6. NAT (Masquerade) ──────────────────────────────────────
:if ([:len [/ip firewall nat find action=masquerade]] = 0) do={
    /ip firewall nat add chain=srcnat out-interface=$wanInterface action=masquerade comment="Masquerade for internet"
}

# ── 7. DNS Settings ──────────────────────────────────────────
/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes

# ── 8. Firewall Rules ────────────────────────────────────────
/ip firewall filter
add chain=input protocol=tcp dst-port=8291 action=accept comment="Allow Winbox"
add chain=input protocol=tcp dst-port=80,443 action=accept comment="Allow Web"
add chain=input protocol=tcp dst-port=8728,8729 action=accept comment="Allow API"
add chain=input protocol=udp dst-port=53,67 action=accept comment="Allow DNS & DHCP"
add chain=input protocol=icmp action=accept comment="Allow Ping"
add chain=input connection-state=established,related action=accept

add chain=forward action=accept connection-state=established,related comment="Allow established forward"
add chain=forward in-interface=$lanBridge action=accept comment="Allow LAN to WAN"

# ── 9. RADIUS Client (HQInvestment ISP Billing) ───────────────────────
:if ([:len [/radius find address="${apiHost}"]] = 0) do={
    /radius add service=hotspot,ppp address="${apiHost}" secret="hqinvestment-radius-secret" \\
        authentication-port=1812 accounting-port=1813 timeout=3s
}

# ── 10. Walled Garden (Allow billing portal & Mgmt) ───────────
:if ([:len [/ip hotspot walled-garden find dst-host="${apiHost}"]] = 0) do={
    /ip hotspot walled-garden add dst-host="${apiHost}" action=allow comment="Billing Portal"
}
:if ([:len [/ip hotspot walled-garden ip find dst-address="${apiHost}"]] = 0) do={
    /ip hotspot walled-garden ip add dst-address="${apiHost}" action=accept comment="Billing Portal IP"
}

# Unblock Management Ports so network admin is not locked out!
/ip hotspot walled-garden ip
add action=accept dst-port=8291 protocol=tcp comment="Allow Winbox Management"
add action=accept dst-port=8728,8729 protocol=tcp comment="Allow API Management"
add action=accept dst-port=80,443 protocol=tcp comment="Allow Web Management"

# ── 11. System Scheduler (Auto-sync with HQInvestment) ───────────────────
/system scheduler
:if ([:len [find name="billing-sync"]] > 0) do={ remove [find name="billing-sync"] }
add name="billing-sync" interval=5m on-event="/tool fetch url=\\"${PUBLIC_API_BASE}/api/sync/${routerIdCode}\\"" \\
    start-time=startup

# ── 12. Logging ──────────────────────────────────────────────
/system logging
:if ([:len [/system logging find topics=hotspot]] = 0) do={ add topics=hotspot action=memory }
:if ([:len [/system logging find topics=radius]] = 0) do={ add topics=radius action=memory }
:if ([:len [/system logging find topics=pppoe]] = 0) do={ add topics=pppoe action=memory }

# ═══════════════════════════════════════════════════════════════
# ✅ Script Complete! Router "${router.name}" is configured.
# Both Hotspot & PPPoE servers are set up.
# ═══════════════════════════════════════════════════════════════`;
        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mikrotik-script-${safeRouterName}.rsc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
    if (showWireGuard) {
        return <WireGuardConfigModal router={router} onClose={() => setShowWireGuard(false)} />;
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                {/* Green Header */}
                <div style={{
                    background: '#16a34a', color: '#fff', padding: '14px 20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RouterIcon fontSize="small" />
                        <span style={{ fontWeight: 700, fontSize: '1rem' }}>{router.name}</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                <div style={{ padding: 20 }}>
                    {/* Router Info */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', background: '#f8fafc', borderRadius: 'var(--radius-sm)',
                        marginBottom: 20,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <RouterIcon style={{ color: '#d97706' }} />
                            <span style={{ fontWeight: 600 }}>{router.name}</span>
                        </div>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '4px 12px', borderRadius: 20,
                            background: router.status === 'Online' ? '#d1fae5' : '#fee2e2',
                            color: router.status === 'Online' ? '#065f46' : '#dc2626',
                            fontWeight: 500, fontSize: '0.8rem',
                        }}>
                            <CheckCircleIcon style={{ fontSize: 14 }} />
                            {router.status === 'Online' ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>

                    {/* Router Details */}
                    <div style={{
                        marginBottom: 20, borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-light)', overflow: 'hidden',
                    }}>
                        {([
                            { label: 'IP Address', value: router.host, mono: true },
                            { label: 'API Port', value: router.port ? String(router.port) : '—', mono: true },
                            { label: 'Type', value: router.type || 'RouterOS', mono: false },
                            { label: 'Active Users', value: String(router.activeUsers || 0), mono: false },
                            { label: 'CPU Load', value: `${router.cpuLoad || 0}%`, mono: false },
                            { label: 'Uptime', value: router.uptime || 'N/A', mono: false },
                            { label: 'Last Seen', value: formatDateTime(router.lastSeen), mono: false },
                            { label: 'Description', value: router.description || '—', mono: false },
                        ]).map(row => (
                            <div key={row.label} style={{
                                display: 'flex', justifyContent: 'space-between', padding: '8px 14px',
                                borderBottom: '1px solid var(--border-light)', fontSize: '0.83rem',
                            }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                                <strong style={row.mono ? { fontFamily: 'monospace' } : undefined}>{row.value}</strong>
                            </div>
                        ))}
                    </div>

                    {/* VPN Configuration */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                            <VpnLockIcon style={{ fontSize: 16 }} /> VPN CONFIGURATION
                        </div>
                        <div className="grid-2 gap-8">
                            <button className="btn" style={{
                                background: '#fef3c7', color: '#d97706', fontWeight: 600, border: '1px solid #fbbf24',
                                padding: '10px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }} onClick={() => setShowWireGuard(true)}>
                                <VpnLockIcon fontSize="small" /> WireGuard
                            </button>
                            <button className="btn" style={{
                                background: '#eef2ff', color: '#4338ca', fontWeight: 600, border: '1px solid #c7d2fe',
                                padding: '10px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }} onClick={downloadScript}>
                                <DownloadIcon fontSize="small" /> Download Script
                            </button>
                        </div>
                    </div>

                    {/* Management */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: '#d97706', fontWeight: 600, fontSize: '0.85rem' }}>
                            <EditIcon style={{ fontSize: 16 }} /> MANAGEMENT
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                            <button className="btn" style={{
                                background: '#ecfdf5', color: '#16a34a', fontWeight: 600, border: '1px solid #86efac',
                                padding: '10px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }} onClick={() => { onClose(); navigate('/hotspot-customizer'); }}>
                                <LoginIcon fontSize="small" /> Login Page Customizer
                            </button>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: '#dc2626', fontWeight: 600, fontSize: '0.85rem' }}>
                            <WarningAmberIcon style={{ fontSize: 16 }} /> DANGER ZONE
                        </div>
                        <button className="btn" style={{
                            background: '#fef2f2', color: '#dc2626', fontWeight: 600, border: '1px solid #fecaca',
                            padding: '10px 16px', borderRadius: 'var(--radius-sm)', width: '100%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }} onClick={() => { if (onDelete) { onClose(); onDelete(router); } }}>
                            <DeleteIcon fontSize="small" /> Delete Router
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
