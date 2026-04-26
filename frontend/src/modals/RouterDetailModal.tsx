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
        const script = `# ═══════════════════════════════════════════════════════════════
# HQINVESTMENT ISP Billing - MikroTik Auto-Configuration Script
# Router: ${router.name}
# ID: ${routerIdCode}
# Generated: ${new Date().toISOString().split('T')[0]}
# ═══════════════════════════════════════════════════════════════

# ── 1. System Identity ────────────────────────────────────────
/system identity set name="${router.name}"

# ── 2. Hotspot Server Setup ───────────────────────────────────
:if ([:len [/ip hotspot profile find name="hsprof-${router.name}"]] = 0) do={
    /ip hotspot profile add name="hsprof-${router.name}" hotspot-address=192.168.88.1 dns-name="${router.name.toLowerCase().replace(/\s+/g, '-')}.hotspot" \\
        html-directory=hotspot login-by=http-chap,http-pap,cookie,mac-cookie \\
        http-cookie-lifetime=3d
}

:if ([:len [/ip pool find name="hs-pool-${router.name}"]] = 0) do={
    /ip pool add name="hs-pool-${router.name}" ranges=192.168.88.2-192.168.88.254
}

:if ([:len [/ip hotspot find name="hotspot-${router.name}"]] = 0) do={
    /ip hotspot add name="hotspot-${router.name}" interface=ether2 address-pool="hs-pool-${router.name}" \\
        profile="hsprof-${router.name}" disabled=no
}

# ── 3. PPPoE Server Setup ─────────────────────────────────────
:if ([:len [/ip pool find name="pppoe-pool-${router.name}"]] = 0) do={
    /ip pool add name="pppoe-pool-${router.name}" ranges=10.10.10.2-10.10.10.254
}

:if ([:len [/ppp profile find name="pppoe-profile-${router.name}"]] = 0) do={
    /ppp profile add name="pppoe-profile-${router.name}" local-address=10.10.10.1 remote-address="pppoe-pool-${router.name}" dns-server=8.8.8.8,1.1.1.1 use-encryption=yes
}

:if ([:len [/interface pppoe-server server find service-name="pppoe-svc-${router.name}"]] = 0) do={
    /interface pppoe-server server add service-name="pppoe-svc-${router.name}" interface=ether1 default-profile="pppoe-profile-${router.name}" disabled=no
}

# ── 4. DHCP Server ───────────────────────────────────────────
:if ([:len [/ip address find address="192.168.88.1/24"]] = 0) do={
    /ip address add address=192.168.88.1/24 interface=ether2
}

:if ([:len [/ip dhcp-server network find address="192.168.88.0/24"]] = 0) do={
    /ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=192.168.88.1
}

:if ([:len [/ip dhcp-server find name="dhcp-${router.name}"]] = 0) do={
    /ip dhcp-server add name="dhcp-${router.name}" interface=ether2 address-pool="hs-pool-${router.name}" disabled=no
}

# ── 5. NAT (Masquerade) ──────────────────────────────────────
:if ([:len [/ip firewall nat find action=masquerade chain=srcnat out-interface=ether1]] = 0) do={
    /ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade
}

# ── 6. DNS Settings ──────────────────────────────────────────
/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes

# ── 7. Firewall Rules ────────────────────────────────────────
/ip firewall filter
add chain=input protocol=tcp dst-port=8291 action=accept comment="Allow Winbox"
add chain=input protocol=tcp dst-port=80,443 action=accept comment="Allow Web"
add chain=input protocol=udp dst-port=53,67,20561 action=accept comment="Allow DNS, DHCP & MAC Winbox"
add chain=input protocol=icmp action=accept comment="Allow Ping"
add chain=input connection-state=established,related action=accept
add chain=input action=drop comment="Drop all other input"

# ── 8. RADIUS Client (HQInvestment ISP Billing) ───────────────────────
/radius
add service=hotspot,ppp address=${window.location.hostname} secret=hqinvestment-radius-secret \\
    authentication-port=1812 accounting-port=1813

/ip hotspot profile set "hsprof-${router.name}" use-radius=yes radius-accounting=yes
/ppp profile set "pppoe-profile-${router.name}" use-radius=yes

# ── 9. Walled Garden (Allow billing portal) ──────────────────
/ip hotspot walled-garden
add dst-host="${window.location.hostname}" action=allow comment="Billing Portal"
/ip hotspot walled-garden ip
add dst-address="${window.location.hostname}" action=accept comment="Billing Portal IP"

# ── 10. System Scheduler (Auto-sync with HQInvestment) ───────────────────
/system scheduler
add name="billing-sync" interval=5m on-event="/tool fetch url=\\"${(import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '')}/api/sync/${routerIdCode}\\" mode=https" \\
    start-time=startup

# ── 11. Logging ──────────────────────────────────────────────
/system logging
add topics=hotspot action=memory
add topics=radius action=memory
add topics=pppoe action=memory

# ═══════════════════════════════════════════════════════════════
# ✅ Script Complete! Router "${router.name}" is configured.
# Both Hotspot & PPPoE servers are set up.
# ═══════════════════════════════════════════════════════════════`;
        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mikrotik-script-${router.name.toLowerCase().replace(/\s+/g, '-')}.rsc`;
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
