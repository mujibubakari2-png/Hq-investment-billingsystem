import { useState, useEffect } from 'react';
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
import WifiIcon from '@mui/icons-material/Wifi';
import DnsIcon from '@mui/icons-material/Dns';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import WireGuardConfigModal from './WireGuardConfigModal';
import type { Router } from '../types';
import { formatDateTime } from '../utils/formatters';
import { routersApi } from '../api/client';

interface RouterDetailModalProps {
    router: Router;
    onClose: () => void;
    onDelete?: (router: Router) => void;
}

type Tab = 'info' | 'hotspot' | 'pppoe' | 'vpn';

export default function RouterDetailModal({ router, onClose, onDelete }: RouterDetailModalProps) {
    const navigate = useNavigate();
    const [showWireGuard, setShowWireGuard] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>('info');

    // Hotspot users
    const [hotspotUsers, setHotspotUsers] = useState<any[]>([]);
    const [loadingHotspot, setLoadingHotspot] = useState(false);
    const [hotspotError, setHotspotError] = useState<string | null>(null);

    // PPPoE users
    const [pppoeUsers, setPppoeUsers] = useState<any[]>([]);
    const [loadingPppoe, setLoadingPppoe] = useState(false);
    const [pppoeError, setPppoeError] = useState<string | null>(null);

    const fetchHotspotUsers = async () => {
        setLoadingHotspot(true);
        setHotspotError(null);
        try {
            const data = await routersApi.hotspot.list(router.id);
            setHotspotUsers(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setHotspotError(err.message || 'Failed to load hotspot users');
        } finally {
            setLoadingHotspot(false);
        }
    };

    const fetchPppoeUsers = async () => {
        setLoadingPppoe(true);
        setPppoeError(null);
        try {
            const data = await routersApi.pppoe.list(router.id);
            setPppoeUsers(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setPppoeError(err.message || 'Failed to load PPPoE users');
        } finally {
            setLoadingPppoe(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'hotspot') fetchHotspotUsers();
        if (activeTab === 'pppoe') fetchPppoeUsers();
    }, [activeTab]);

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
    /ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=8.8.8.8,1.1.1.1
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
add chain=input protocol=udp dst-port=53,67 action=accept comment="Allow DNS & DHCP"
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
add dst-host="*.${window.location.hostname}" action=allow comment="Billing Portal"

# ── 10. Logging ──────────────────────────────────────────────
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

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'info', label: 'Info', icon: <RouterIcon style={{ fontSize: 14 }} /> },
        { id: 'hotspot', label: 'Hotspot Users', icon: <WifiIcon style={{ fontSize: 14 }} /> },
        { id: 'pppoe', label: 'PPPoE Users', icon: <DnsIcon style={{ fontSize: 14 }} /> },
        { id: 'vpn', label: 'VPN / Scripts', icon: <VpnLockIcon style={{ fontSize: 14 }} /> },
    ];

    const renderUserTable = (
        users: any[],
        loading: boolean,
        error: string | null,
        type: 'hotspot' | 'pppoe',
        onRefresh: () => void
    ) => {
        const columns = type === 'hotspot'
            ? ['Username', 'IP Address', 'MAC', 'Uptime', 'Status']
            : ['Username', 'IP Address', 'Profile', 'Uptime', 'Status'];

        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.85rem', color: type === 'hotspot' ? '#0d9488' : '#7c3aed' }}>
                        {type === 'hotspot' ? <WifiIcon style={{ fontSize: 16 }} /> : <DnsIcon style={{ fontSize: 16 }} />}
                        {type === 'hotspot' ? 'Active Hotspot Users' : 'Active PPPoE Users'}
                        <span style={{ background: type === 'hotspot' ? '#ccfbf1' : '#ede9fe', color: type === 'hotspot' ? '#0d9488' : '#7c3aed', padding: '1px 8px', borderRadius: 10, fontSize: '0.72rem' }}>
                            {loading ? '...' : users.length}
                        </span>
                    </div>
                    <button onClick={onRefresh} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <RefreshIcon style={{ fontSize: 13 }} /> Refresh
                    </button>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <RefreshIcon style={{ fontSize: 28, animation: 'spin 1s linear infinite', marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                        Loading {type === 'hotspot' ? 'hotspot' : 'PPPoE'} users...
                    </div>
                ) : error ? (
                    <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: '0.82rem' }}>
                        <strong>⚠️ Error:</strong> {error}
                        <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#9b1c1c' }}>
                            Make sure the router is online and the MikroTik API (port 80) is accessible.
                        </div>
                    </div>
                ) : users.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                        <PersonIcon style={{ fontSize: 36, marginBottom: 8, opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                        <div style={{ fontSize: '0.85rem' }}>No active {type === 'hotspot' ? 'hotspot' : 'PPPoE'} users</div>
                        <div style={{ fontSize: '0.75rem', marginTop: 4 }}>Users will appear here when connected to this router</div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                                    {columns.map(col => (
                                        <th key={col} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <PersonIcon style={{ fontSize: 14, color: type === 'hotspot' ? '#0d9488' : '#7c3aed' }} />
                                                {u.name || u.username || u['.id'] || '—'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                                            {u.address || u['caller-id'] || u.ip || '—'}
                                        </td>
                                        <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                            {type === 'hotspot'
                                                ? (u['mac-address'] || u.mac || '—')
                                                : (u.profile || u.service || '—')}
                                        </td>
                                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                                            {u.uptime || '—'}
                                        </td>
                                        <td style={{ padding: '8px 10px' }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 600,
                                                background: '#d1fae5', color: '#065f46',
                                            }}>
                                                Active
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 600, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ background: '#16a34a', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RouterIcon fontSize="small" />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{router.name}</div>
                            <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                                {router.host} · {router.status === 'Online' ? '🟢 Connected' : '🔴 Offline'}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', background: '#f8fafc', flexShrink: 0 }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                                padding: '10px 6px', border: 'none', borderBottom: activeTab === tab.id ? '2px solid #16a34a' : '2px solid transparent',
                                background: 'transparent', cursor: 'pointer', fontSize: '0.78rem', fontWeight: activeTab === tab.id ? 700 : 500,
                                color: activeTab === tab.id ? '#16a34a' : 'var(--text-secondary)',
                                transition: 'all 0.15s',
                            }}
                        >
                            {tab.icon}
                            <span style={{ whiteSpace: 'nowrap' }}>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>

                    {/* INFO TAB */}
                    {activeTab === 'info' && (
                        <div>
                            <div style={{ marginBottom: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                                {([
                                    { label: 'IP Address', value: router.host, mono: true },
                                    { label: 'API Port', value: router.port ? String(router.port) : '—', mono: true },
                                    { label: 'Type', value: router.type || 'RouterOS', mono: false },
                                    { label: 'Active Users', value: String(router.activeUsers || 0), mono: false },
                                    { label: 'CPU Load', value: `${router.cpuLoad || 0}%`, mono: false },
                                    { label: 'Memory Used', value: `${router.memoryUsed || 0}%`, mono: false },
                                    { label: 'Uptime', value: router.uptime || 'N/A', mono: false },
                                    { label: 'Last Seen', value: formatDateTime(router.lastSeen), mono: false },
                                    { label: 'Description', value: router.description || '—', mono: false },
                                ] as { label: string; value: string; mono: boolean }[]).map(row => (
                                    <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--border-light)', fontSize: '0.83rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                                        <strong style={row.mono ? { fontFamily: 'monospace' } : undefined}>{row.value}</strong>
                                    </div>
                                ))}
                            </div>

                            {/* Login Page Customizer */}
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#0d9488', fontWeight: 600, fontSize: '0.85rem' }}>
                                    <LoginIcon style={{ fontSize: 16 }} /> HOTSPOT MANAGEMENT
                                </div>
                                <button className="btn" style={{ background: '#ecfdf5', color: '#16a34a', fontWeight: 600, border: '1px solid #86efac', padding: '10px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}
                                    onClick={() => { onClose(); navigate(`/hotspot-customizer?routerId=${router.id}`); }}>
                                    <WifiIcon fontSize="small" /> Hotspot Login Page Customizer
                                </button>
                            </div>

                            {/* Danger Zone */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#dc2626', fontWeight: 600, fontSize: '0.85rem' }}>
                                    <WarningAmberIcon style={{ fontSize: 16 }} /> DANGER ZONE
                                </div>
                                <button className="btn" style={{ background: '#fef2f2', color: '#dc2626', fontWeight: 600, border: '1px solid #fecaca', padding: '10px 16px', borderRadius: 'var(--radius-sm)', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                    onClick={() => { if (onDelete) { onClose(); onDelete(router); } }}>
                                    <DeleteIcon fontSize="small" /> Delete Router
                                </button>
                            </div>
                        </div>
                    )}

                    {/* HOTSPOT TAB */}
                    {activeTab === 'hotspot' && renderUserTable(hotspotUsers, loadingHotspot, hotspotError, 'hotspot', fetchHotspotUsers)}

                    {/* PPPOE TAB */}
                    {activeTab === 'pppoe' && renderUserTable(pppoeUsers, loadingPppoe, pppoeError, 'pppoe', fetchPppoeUsers)}

                    {/* VPN / SCRIPTS TAB */}
                    {activeTab === 'vpn' && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                                <VpnLockIcon style={{ fontSize: 16 }} /> VPN CONFIGURATION
                            </div>
                            <div className="grid-2 gap-8" style={{ marginBottom: 16 }}>
                                <button className="btn" style={{ background: '#fef3c7', color: '#d97706', fontWeight: 600, border: '1px solid #fbbf24', padding: '10px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                    onClick={() => setShowWireGuard(true)}>
                                    <VpnLockIcon fontSize="small" /> WireGuard Config
                                </button>
                                <button className="btn" style={{ background: '#eef2ff', color: '#4338ca', fontWeight: 600, border: '1px solid #c7d2fe', padding: '10px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                    onClick={downloadScript}>
                                    <DownloadIcon fontSize="small" /> Download .rsc
                                </button>
                            </div>

                            <div style={{ background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 8, padding: 14, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>📋 Setup Instructions</div>
                                <ol style={{ paddingLeft: 18, margin: 0 }}>
                                    <li>Download the <strong>.rsc</strong> script above</li>
                                    <li>Open <strong>Winbox</strong> → Files → drag and drop the .rsc file</li>
                                    <li>Open <strong>Terminal</strong> and run: <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 3 }}>/import mikrotik-script-{router.name.toLowerCase().replace(/\s+/g, '-')}.rsc</code></li>
                                    <li>The script configures Hotspot + PPPoE + RADIUS automatically</li>
                                </ol>
                            </div>

                            <div style={{ marginTop: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#d97706', fontWeight: 600, fontSize: '0.85rem' }}>
                                    <EditIcon style={{ fontSize: 16 }} /> MANAGEMENT
                                </div>
                                <button className="btn" style={{ background: '#ecfdf5', color: '#16a34a', fontWeight: 600, border: '1px solid #86efac', padding: '10px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%' }}
                                    onClick={() => { onClose(); navigate(`/hotspot-customizer?routerId=${router.id}`); }}>
                                    <WifiIcon fontSize="small" /> Open Hotspot Login Customizer
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
