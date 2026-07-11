import { useState, useEffect } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LanguageIcon from '@mui/icons-material/Language';
import RouterIcon from '@mui/icons-material/Router';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SyncIcon from '@mui/icons-material/Sync';
import LockIcon from '@mui/icons-material/Lock';
import type { Router } from '../types';
import { routersApi, type WireGuardConfig } from '../api';

interface RemoteAccessModalProps {
    router: Router;
    onClose: () => void;
}

export default function RemoteAccessModal({ router, onClose }: RemoteAccessModalProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [wgStatus, setWgStatus] = useState<WireGuardConfig | null>(null);
    const [loadingWg, setLoadingWg] = useState(true);
    const [copied, setCopied] = useState('');

    // Fetch live WireGuard / VPN status on open
    useEffect(() => {
        let cancelled = false;
        const fetchStatus = async () => {
            setLoadingWg(true);
            try {
                const res = await routersApi.wireguard.getConfig(router.id);
                if (!cancelled) setWgStatus(res);
            } catch {
                if (!cancelled) setWgStatus(null);
            } finally {
                if (!cancelled) setLoadingWg(false);
            }
        };
        fetchStatus();
        return () => { cancelled = true; };
    }, [router.id]);

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(''), 2000);
    };

    // Tunnel IP is the address Winbox should connect to via VPN
    const tunnelHost = wgStatus?.routerTunnelIp || router.host;

    // Prefer explicit management ports when available: `apiPort` (Web/API) then `port` (legacy).
    const mgmtPort = router.apiPort || router.port || undefined;

    const hostWithPort = (host: string, port?: number) => port ? `${host}:${port}` : host;

    const winboxPort = router.port || 8291; // Winbox default 8291 if not specified
    const safeUser = encodeURIComponent(router.username || 'admin');
    const safePass = encodeURIComponent(router.password || '');
    const winboxUrl = `winbox://${safeUser}:${safePass}@${hostWithPort(tunnelHost, winboxPort)}`;

    const isHttps = mgmtPort === 443;
    const webFigUrl = `${isHttps ? 'https' : 'http'}://${hostWithPort(tunnelHost, mgmtPort)}`;

    const isTunnelActive = wgStatus?.tunnelActive === true;
    const isTunnelConfigured = wgStatus?.enabled === true;

    const HandshakeAgo = () => {
        if (!wgStatus?.lastHandshakeSeconds) return null;
        const s = wgStatus.lastHandshakeSeconds;
        const display = s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
        return <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 8 }}>Last handshake: {display}</span>;
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <RouterIcon style={{ color: '#be185d', flexShrink: 0 }} />
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Remote Access — {router.name}
                        </h2>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon /></button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* ── VPN Tunnel Status ── */}
                    <div style={{
                        border: `1px solid ${isTunnelActive ? '#bbf7d0' : isTunnelConfigured ? '#fde68a' : '#fecaca'}`,
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 16px',
                        background: isTunnelActive ? '#f0fdf4' : isTunnelConfigured ? '#fffbeb' : '#fef2f2',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}>
                        {loadingWg ? (
                            <SyncIcon style={{ fontSize: 22, color: '#9ca3af', animation: 'spin 1s linear infinite' }} />
                        ) : isTunnelActive ? (
                            <CheckCircleIcon style={{ fontSize: 22, color: '#16a34a', flexShrink: 0 }} />
                        ) : (
                            <ErrorIcon style={{ fontSize: 22, color: isTunnelConfigured ? '#d97706' : '#dc2626', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: isTunnelActive ? '#15803d' : isTunnelConfigured ? '#92400e' : '#991b1b' }}>
                                {loadingWg ? 'Checking VPN tunnel status…' : isTunnelActive ? '🔒 VPN Tunnel Active — Secure Remote Access Available' : isTunnelConfigured ? '⚠️ VPN Configured but Not Connected' : '❌ VPN Not Configured'}
                            </div>
                            {!loadingWg && (
                                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>
                                    {wgStatus?.tunnelStatusMessage || 'Could not retrieve VPN status.'}
                                    {isTunnelActive && <HandshakeAgo />}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Direct Winbox via VPN (Primary action) ── */}
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--bg-surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <RouterIcon style={{ color: '#be185d', fontSize: 20 }} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#831843' }}>Winbox — Direct Remote Access</h3>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    Connect through the secure VPN tunnel — no physical access needed
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: 10 }}>
                            {/* Tunnel IP */}
                            <InfoRow
                                label="VPN Tunnel IP (Connect To)"
                                value={tunnelHost}
                                mono
                                onCopy={() => handleCopy(tunnelHost, 'ip')}
                                copied={copied === 'ip'}
                                highlight={isTunnelActive}
                            />
                            {/* Login */}
                            <InfoRow
                                label="Login"
                                value={router.username || 'admin'}
                                mono
                                onCopy={() => handleCopy(router.username || 'admin', 'user')}
                                copied={copied === 'user'}
                            />
                            {/* Password */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>Password</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.88rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {showPassword ? (router.password || '') : '••••••••'}
                                        <button onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-secondary)' }}>
                                            {showPassword ? <VisibilityOffIcon style={{ fontSize: 15 }} /> : <VisibilityIcon style={{ fontSize: 15 }} />}
                                        </button>
                                    </div>
                                </div>
                                <button className="btn-icon" onClick={() => handleCopy(router.password || '', 'pass')}>
                                    {copied === 'pass' ? <CheckCircleIcon style={{ fontSize: 16, color: '#16a34a' }} /> : <ContentCopyIcon style={{ fontSize: 16 }} />}
                                </button>
                            </div>
                        </div>

                        {/* Launch Winbox Button */}
                        <div style={{ marginTop: 14 }}>
                            {isTunnelActive ? (
                                <a
                                    href={winboxUrl}
                                    className="btn"
                                    style={{
                                        background: 'linear-gradient(135deg, #be185d, #9f1239)',
                                        color: '#fff',
                                        textDecoration: 'none',
                                        width: '100%',
                                        justifyContent: 'center',
                                        display: 'flex',
                                        gap: 8,
                                        fontWeight: 600,
                                        padding: '10px 0',
                                    }}
                                >
                                    <RouterIcon style={{ fontSize: 18 }} />
                                    Launch Winbox (via VPN Tunnel)
                                </a>
                            ) : (
                                <div style={{ background: '#f1f5f9', borderRadius: 8, padding: '10px 14px', textAlign: 'center', color: '#64748b', fontSize: '0.83rem' }}>
                                    <LockIcon style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 6 }} />
                                    {isTunnelConfigured
                                        ? 'VPN tunnel is not active yet. Ensure WireGuard is running on the router.'
                                        : 'VPN not configured. Go to Router Setup Wizard → WireGuard tab to activate VPN first.'}
                                </div>
                            )}
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                                Requires Winbox v3+ installed and <code>winbox://</code> protocol registered on your PC
                            </div>
                        </div>
                    </div>

                    {/* ── WebFig Browser Access via VPN ── */}
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--bg-surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <LanguageIcon style={{ color: '#4338ca', fontSize: 20 }} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#1e1b4b' }}>WebFig — Browser Management</h3>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Access full router config via web browser (VPN required)</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#334155', wordBreak: 'break-all' }}>
                                {webFigUrl}
                            </div>
                            {isTunnelActive ? (
                                <a
                                    href={webFigUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm"
                                    style={{ background: '#4338ca', color: '#fff', textDecoration: 'none', padding: '6px 12px', fontSize: '0.8rem', flexShrink: 0 }}
                                >
                                    Open WebFig
                                </a>
                            ) : (
                                <span style={{ fontSize: '0.78rem', color: '#9ca3af', flexShrink: 0 }}>VPN required</span>
                            )}
                        </div>
                    </div>

                    {/* ── Connection Guide ── */}
                    {!isTunnelActive && (
                        <div style={{ border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', padding: '12px 16px', background: '#eff6ff' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e40af', marginBottom: 8 }}>📋 How to Enable Remote Access</div>
                            <ol style={{ margin: 0, paddingLeft: 20, fontSize: '0.82rem', color: '#1e3a8a', lineHeight: 1.7 }}>
                                <li>Go to <strong>Routers page</strong> → click ⚙️ on this router</li>
                                <li>Open <strong>Router Setup Wizard</strong> → WireGuard VPN tab</li>
                                <li>Click <strong>"Activate VPN"</strong> then <strong>"Push Config to Router"</strong></li>
                                <li>Wait ~30 seconds for the tunnel to establish</li>
                                <li>Come back here — the Winbox launch button will be enabled</li>
                            </ol>
                        </div>
                    )}
                </div>
            </div>
            {/* Spin animation */}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ── Helper: Info Row ──────────────────────────────────────────────────────────

function InfoRow({
    label, value, mono, onCopy, copied, highlight,
}: {
    label: string; value: string; mono?: boolean; onCopy: () => void; copied?: boolean; highlight?: boolean;
}) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: highlight ? '#f0fdf4' : '#f8fafc',
            border: `1px solid ${highlight ? '#bbf7d0' : 'var(--border-light)'}`,
            padding: '10px 14px', borderRadius: 'var(--radius-sm)',
        }}>
            <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: mono ? 'monospace' : 'inherit', fontSize: '0.88rem', color: highlight ? '#15803d' : '#334155', fontWeight: highlight ? 600 : 400 }}>
                    {value}
                </div>
            </div>
            <button className="btn-icon" onClick={onCopy} title="Copy">
                {copied ? <CheckCircleIcon style={{ fontSize: 16, color: '#16a34a' }} /> : <ContentCopyIcon style={{ fontSize: 16 }} />}
            </button>
        </div>
    );
}
