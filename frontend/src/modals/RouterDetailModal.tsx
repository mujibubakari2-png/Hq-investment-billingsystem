import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RouterIcon from '@mui/icons-material/Router';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import DownloadIcon from '@mui/icons-material/Download';
import LoginIcon from '@mui/icons-material/Login';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import MemoryIcon from '@mui/icons-material/Memory';
import SpeedIcon from '@mui/icons-material/Speed';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PeopleIcon from '@mui/icons-material/People';
import LanIcon from '@mui/icons-material/Lan';
import SyncIcon from '@mui/icons-material/Sync';
import WireGuardConfigModal from './WireGuardConfigModal';
import { getPublicApiBase } from '../utils/config';
import { routersApi } from '../api';
import type { Router } from '../types';
import { formatDateTime } from '../utils/formatters';
import { sanitizeMikroTikName } from '../utils/mikrotikUtils';
import { generateMikrotikScript } from '../utils/mikrotikScriptGenerator';

interface RouterDetailModalProps {
    router: Router;
    onClose: () => void;
    onDelete?: (router: Router) => void;
}

interface WgStatus {
    tunnelActive: boolean;
    tunnelStatusMessage: string;
    routerTunnelIp: string;
    serverTunnelIp: string;
    lastHandshakeSeconds: number | null;
    enabled: boolean;
}

function GaugeBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
    const pct = Math.min(Math.round((value / max) * 100), 100);
    return (
        <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
        </div>
    );
}

export default function RouterDetailModal({ router, onClose, onDelete }: RouterDetailModalProps) {
    const navigate = useNavigate();
    const [showWireGuard, setShowWireGuard] = useState(false);
    const [wgStatus, setWgStatus] = useState<WgStatus | null>(null);
    const [loadingWg, setLoadingWg] = useState(true);

    useEffect(() => {
        let cancelled = false;
        routersApi.wireguard.getConfig(router.id)
            .then((res: any) => { if (!cancelled) setWgStatus(res); })
            .catch(() => { if (!cancelled) setWgStatus(null); })
            .finally(() => { if (!cancelled) setLoadingWg(false); });
        return () => { cancelled = true; };
    }, [router.id]);

    const downloadScript = () => {
        const routerIdCode = `MYR-${router.id.padStart(3, '0')}VBHBC`;
        const safeRouterName = sanitizeMikroTikName(router.name);
        const publicApiBase = getPublicApiBase();
        const apiHost = publicApiBase.startsWith('http')
            ? new URL(publicApiBase).hostname
            : window.location.hostname;
        const script = generateMikrotikScript({
            routerName: router.name,
            routerUsername: router.username,
            routerPassword: router.password,
            routerId: routerIdCode,
            apiHost,
            publicApiBase,
            isWireGuard: false,
        });
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

    const isOnline = router.status === 'Online';
    const cpuColor = (router.cpuLoad || 0) > 80 ? '#ef4444' : (router.cpuLoad || 0) > 50 ? '#f59e0b' : '#22c55e';
    const memColor = (router.memoryUsed || 0) > 80 ? '#ef4444' : (router.memoryUsed || 0) > 60 ? '#f59e0b' : '#3b82f6';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                style={{ maxWidth: 680, width: '95vw' }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div className="modal-header" style={{
                    background: isOnline
                        ? 'linear-gradient(135deg, #16a34a, #15803d)'
                        : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                    color: '#fff',
                    padding: '14px 20px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <RouterIcon style={{ fontSize: 22 }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{router.name}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <LanIcon style={{ fontSize: 13 }} />
                                {router.host}
                                <span style={{ opacity: 0.6 }}>•</span>
                                {isOnline ? '🟢 Online' : '🔴 Offline'}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="modal-close" style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                <div style={{ padding: '20px 24px', overflowY: 'auto', maxHeight: 'calc(90vh - 80px)' }}>

                    {/* ── Live Stats Row ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
                        <StatCard icon={<SpeedIcon style={{ color: cpuColor, fontSize: 22 }} />} label="CPU Load" value={`${router.cpuLoad || 0}%`}>
                            <GaugeBar value={router.cpuLoad || 0} color={cpuColor} />
                        </StatCard>
                        <StatCard icon={<MemoryIcon style={{ color: memColor, fontSize: 22 }} />} label="Memory Used" value={`${router.memoryUsed || 0}%`}>
                            <GaugeBar value={router.memoryUsed || 0} color={memColor} />
                        </StatCard>
                        <StatCard icon={<PeopleIcon style={{ color: '#6366f1', fontSize: 22 }} />} label="Active Users" value={String(router.activeUsers || 0)} />
                        <StatCard icon={<AccessTimeIcon style={{ color: '#0891b2', fontSize: 22 }} />} label="Uptime" value={router.uptime || 'N/A'} small />
                    </div>

                    {/* ── Two Column Layout (PC) ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>

                        {/* LEFT: Router Info */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid var(--border-light)', fontWeight: 600, fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                                Router Information
                            </div>
                            {([
                                { label: 'IP Address', value: router.host, mono: true },
                                { label: 'API Port', value: router.port ? String(router.port) : '—', mono: true },
                                { label: 'Router Type', value: router.type || 'RouterOS', mono: false },
                                { label: 'Last Seen', value: formatDateTime(router.lastSeen), mono: false },
                                { label: 'Description', value: (router as any).description || '—', mono: false },
                            ]).map(row => (
                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid var(--border-light)', fontSize: '0.82rem', gap: 8, alignItems: 'flex-start' }}>
                                    <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{row.label}</span>
                                    <strong style={{ ...(row.mono ? { fontFamily: 'monospace', fontSize: '0.8rem' } : {}), wordBreak: 'break-all', textAlign: 'right' }}>{row.value}</strong>
                                </div>
                            ))}
                        </div>

                        {/* RIGHT: VPN / WireGuard Status */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid var(--border-light)', fontWeight: 600, fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <VpnLockIcon style={{ fontSize: 14, color: '#6366f1' }} /> WireGuard VPN Status
                            </div>
                            <div style={{ padding: 14 }}>
                                {loadingWg ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af', fontSize: '0.82rem' }}>
                                        <SyncIcon style={{ fontSize: 18, animation: 'spin 1s linear infinite' }} /> Checking VPN status…
                                    </div>
                                ) : wgStatus ? (
                                    <>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                                            padding: '8px 12px', borderRadius: 8,
                                            background: wgStatus.tunnelActive ? '#f0fdf4' : wgStatus.enabled ? '#fffbeb' : '#f1f5f9',
                                            border: `1px solid ${wgStatus.tunnelActive ? '#bbf7d0' : wgStatus.enabled ? '#fde68a' : '#e2e8f0'}`,
                                        }}>
                                            {wgStatus.tunnelActive
                                                ? <CheckCircleIcon style={{ color: '#16a34a', fontSize: 18, flexShrink: 0 }} />
                                                : <CancelIcon style={{ color: wgStatus.enabled ? '#d97706' : '#94a3b8', fontSize: 18, flexShrink: 0 }} />}
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: wgStatus.tunnelActive ? '#15803d' : wgStatus.enabled ? '#92400e' : '#475569' }}>
                                                {wgStatus.tunnelActive ? 'Tunnel Active' : wgStatus.enabled ? 'Configured — Not Connected' : 'VPN Not Configured'}
                                            </span>
                                        </div>
                                        {[
                                            { label: 'Router Tunnel IP', value: wgStatus.routerTunnelIp || '—', mono: true },
                                            { label: 'Server Tunnel IP', value: wgStatus.serverTunnelIp || '—', mono: true },
                                            { label: 'Status', value: wgStatus.tunnelActive && wgStatus.lastHandshakeSeconds != null
                                                ? `Handshake ${wgStatus.lastHandshakeSeconds}s ago`
                                                : wgStatus.tunnelStatusMessage?.slice(0, 48) || '—', mono: false },
                                        ].map(row => (
                                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.8rem', gap: 8 }}>
                                                <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{row.label}</span>
                                                <strong style={{ ...(row.mono ? { fontFamily: 'monospace' } : {}), wordBreak: 'break-all', textAlign: 'right', fontSize: '0.78rem' }}>{row.value}</strong>
                                            </div>
                                        ))}
                                    </>
                                ) : (
                                    <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>VPN status unavailable</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Action Buttons Grid ── */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                            Configuration &amp; Management
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                            <ActionBtn
                                icon={<VpnLockIcon fontSize="small" />}
                                label="WireGuard VPN"
                                desc="Configure VPN tunnel"
                                color="#6366f1"
                                bg="#eef2ff"
                                border="#c7d2fe"
                                onClick={() => setShowWireGuard(true)}
                            />
                            <ActionBtn
                                icon={<DownloadIcon fontSize="small" />}
                                label="Download Script"
                                desc="MikroTik .rsc setup"
                                color="#0891b2"
                                bg="#ecfeff"
                                border="#a5f3fc"
                                onClick={downloadScript}
                            />
                            <ActionBtn
                                icon={<LoginIcon fontSize="small" />}
                                label="Login Page"
                                desc="Hotspot customizer"
                                color="#16a34a"
                                bg="#f0fdf4"
                                border="#86efac"
                                onClick={() => { onClose(); navigate('/hotspot-customizer'); }}
                            />
                        </div>
                    </div>

                    {/* ── Danger Zone ── */}
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <WarningAmberIcon style={{ fontSize: 14 }} /> Danger Zone
                        </div>
                        <button
                            style={{ background: '#fef2f2', color: '#dc2626', fontWeight: 600, border: '1px solid #fecaca', padding: '10px 18px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fee2e2')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#fef2f2')}
                            onClick={() => { if (onDelete) { onClose(); onDelete(router); } }}
                        >
                            <DeleteIcon fontSize="small" /> Delete Router
                        </button>
                    </div>
                </div>

                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, small = false, children }: {
    icon: React.ReactNode; label: string; value: string; small?: boolean; children?: React.ReactNode;
}) {
    return (
        <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 14px', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {icon}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: small ? '0.78rem' : '1.1rem', color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
            {children}
        </div>
    );
}

function ActionBtn({ icon, label, desc, color, bg, border, onClick }: {
    icon: React.ReactNode; label: string; desc: string; color: string; bg: string; border: string; onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%' }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.96)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
        >
            <span style={{ marginTop: 2, flexShrink: 0 }}>{icon}</span>
            <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{label}</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.7, marginTop: 2 }}>{desc}</div>
            </div>
        </button>
    );
}
