import { useState, useEffect, useMemo } from 'react';
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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { Router } from '../types';
import { routersApi, type WireGuardConfig } from '../api';

interface RemoteAccessModalProps {
    router: Router;
    onClose: () => void;
}

// ── Port Resolution Logic ─────────────────────────────────────────────────────
//
// RouterOS has THREE different port categories:
//   • API Ports:    8728 (plaintext), 8729 (SSL)   — for router scripting / Prisma
//   • WinBox Port:  8291                            — for WinBox GUI app ONLY
//   • WebFig Ports: 80 (HTTP),  443 (HTTPS)        — for browser-based management
//
// The DB `port` field stores the API port (8728/8729).
// The DB `apiPort` field stores an override for the REST API port.
// We must map these correctly — NEVER pass 8728 to WinBox or WebFig.
//
function resolveWebFig(port?: number, apiPort?: number): { port: number; scheme: 'http' | 'https' } {
    const p = apiPort || port;
    // Map RouterOS API ports to their HTTP equivalents
    if (!p || p === 8728 || p === 80) return { port: 80, scheme: 'http' };
    if (p === 8729 || p === 443) return { port: 443, scheme: 'https' };
    // Custom port — preserve it; use https only for 443
    return { port: p, scheme: p === 443 ? 'https' : 'http' };
}

// WinBox always uses port 8291. The API port (8728/8729) is irrelevant here.
const WINBOX_PORT = 8291;

export default function RemoteAccessModal({ router, onClose }: RemoteAccessModalProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [wgStatus, setWgStatus] = useState<WireGuardConfig | null>(null);
    const [loadingWg, setLoadingWg] = useState(true);
    const [wgError, setWgError] = useState('');
    const [copied, setCopied] = useState('');

    // Electron Desktop App State
    const [isDesktop] = useState(!!window.mikrotikApi);
    const [desktopStatus, setDesktopStatus] = useState<'idle' | 'checking' | 'downloading' | 'launching' | 'error'>('idle');
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [desktopError, setDesktopError] = useState('');

    // ── Computed values (must come BEFORE any function that uses them) ──────
    const tunnelHost = wgStatus?.routerTunnelIp || router.host;
    const directHost = router.host;
    const username = router.username || 'admin';
    const password = router.password || '';

    const safeUser = encodeURIComponent(username);
    const safePass = encodeURIComponent(password);

    const { port: webFigPort, scheme: webFigScheme } = useMemo(
        () => resolveWebFig(router.port, router.apiPort),
        [router.port, router.apiPort]
    );

    // Winbox URL via VPN tunnel (or direct if no WG)
    const winboxVpnUrl   = `winbox://${safeUser}:${safePass}@${tunnelHost}:${WINBOX_PORT}`;
    const winboxDirectUrl = `winbox://${safeUser}:${safePass}@${directHost}:${WINBOX_PORT}`;

    // WebFig URL via VPN tunnel
    const webFigVpnUrl   = `${webFigScheme}://${tunnelHost}:${webFigPort}`;
    const webFigDirectUrl = `${webFigScheme}://${directHost}:${webFigPort}`;

    const isTunnelActive     = wgStatus?.tunnelActive === true;
    const isTunnelConfigured = wgStatus?.enabled === true;
    const hasTunnelIp        = !!(wgStatus?.routerTunnelIp);

    // ── Electron download progress listener ──────────────────────────────────
    useEffect(() => {
        if (isDesktop) {
            window.mikrotikApi?.onDownloadProgress((progress) => setDownloadProgress(progress));
        }
    }, [isDesktop]);

    // ── Electron one-click connect handler ───────────────────────────────────
    const handleDesktopLaunch = async (useVpn: boolean) => {
        setDesktopError('');
        const ip   = useVpn ? tunnelHost : directHost;
        const user = username;

        try {
            setDesktopStatus('checking');
            const installed = await window.mikrotikApi!.checkWinBoxInstalled();

            if (!installed) {
                setDesktopStatus('downloading');
                const dlRes = await window.mikrotikApi!.downloadWinBox('64');
                if (!dlRes.success) throw new Error(dlRes.error);
            }

            setDesktopStatus('launching');
            // Pass password so WinBox logs in automatically. The IPC handler
            // also stores it in the OS keychain for future sessions.
            const launchRes = await window.mikrotikApi!.launchWinBox(ip, user, password || undefined);
            if (!launchRes.success) throw new Error(launchRes.error);

            setTimeout(() => setDesktopStatus('idle'), 2000);
        } catch (error: any) {
            setDesktopStatus('error');
            setDesktopError(error.message);
        }
    };


    // ── Fetch live WireGuard / VPN status on open ────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const fetchStatus = async () => {
            setLoadingWg(true);
            setWgError('');
            try {
                const res = await routersApi.wireguard.getConfig(router.id);
                if (!cancelled) setWgStatus(res);
            } catch (e: any) {
                if (!cancelled) {
                    setWgStatus(null);
                    setWgError(e?.message || 'Failed to fetch VPN status');
                }
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

    const HandshakeAgo = () => {
        if (!wgStatus?.lastHandshakeSeconds) return null;
        const s = wgStatus.lastHandshakeSeconds;
        const display = s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
        return <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: 8 }}>Last handshake: {display}</span>;
    };

    // ── Render helper: Winbox Connect Button ─────────────────────────────────
    const WinboxButton = ({ useVpn }: { useVpn: boolean }) => {
        const href = useVpn ? winboxVpnUrl : winboxDirectUrl;
        const label = useVpn ? 'Launch Winbox via VPN Tunnel' : 'Launch Winbox (Direct IP)';

        if (isDesktop) {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <button
                        onClick={() => handleDesktopLaunch(useVpn)}
                        disabled={desktopStatus === 'checking' || desktopStatus === 'downloading'}
                        className="btn"
                        style={{
                            background: useVpn
                                ? 'linear-gradient(135deg, #be185d, #9f1239)'
                                : 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                            color: '#fff',
                            border: 'none',
                            width: '100%',
                            justifyContent: 'center',
                            display: 'flex',
                            gap: 8,
                            fontWeight: 600,
                            padding: '10px 0',
                            cursor: desktopStatus === 'downloading' ? 'wait' : 'pointer',
                        }}
                    >
                        <RouterIcon style={{ fontSize: 18 }} />
                        {desktopStatus === 'downloading' ? `Downloading WinBox (${downloadProgress}%)...`
                            : desktopStatus === 'launching' ? 'Launching WinBox...'
                                : label}
                    </button>
                    {desktopStatus === 'error' && (
                        <div style={{ fontSize: '0.8rem', color: '#dc2626', textAlign: 'center' }}>
                            ❌ {desktopError}
                        </div>
                    )}
                </div>
            );
        }

        // Web browser — use winbox:// URI scheme
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a
                    href={href}
                    className="btn"
                    style={{
                        background: useVpn
                            ? 'linear-gradient(135deg, #be185d, #9f1239)'
                            : 'linear-gradient(135deg, #1d4ed8, #1e40af)',
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
                    {label}
                </a>
                {/* Copy fallback for when winbox:// protocol not registered */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Or copy the address:
                    </span>
                    <button
                        className="btn-icon"
                        onClick={() => handleCopy(useVpn ? tunnelHost : directHost, useVpn ? 'vpn-ip' : 'direct-ip')}
                        title="Copy IP to paste into WinBox manually"
                        style={{ fontSize: '0.72rem', display: 'flex', gap: 4, alignItems: 'center', color: 'var(--text-secondary)' }}
                    >
                        {copied === (useVpn ? 'vpn-ip' : 'direct-ip')
                            ? <CheckCircleIcon style={{ fontSize: 13, color: '#16a34a' }} />
                            : <ContentCopyIcon style={{ fontSize: 13 }} />}
                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                            {useVpn ? tunnelHost : directHost}:{WINBOX_PORT}
                        </span>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
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
                        border: `1px solid ${isTunnelActive ? '#bbf7d0' : isTunnelConfigured ? '#fde68a' : '#e2e8f0'}`,
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 16px',
                        background: isTunnelActive ? '#f0fdf4' : isTunnelConfigured ? '#fffbeb' : '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}>
                        {loadingWg ? (
                            <SyncIcon style={{ fontSize: 22, color: '#9ca3af', animation: 'spin 1s linear infinite' }} />
                        ) : isTunnelActive ? (
                            <CheckCircleIcon style={{ fontSize: 22, color: '#16a34a', flexShrink: 0 }} />
                        ) : isTunnelConfigured ? (
                            <ErrorIcon style={{ fontSize: 22, color: '#d97706', flexShrink: 0 }} />
                        ) : (
                            <LockIcon style={{ fontSize: 22, color: '#94a3b8', flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontWeight: 600, fontSize: '0.85rem',
                                color: isTunnelActive ? '#15803d' : isTunnelConfigured ? '#92400e' : '#64748b'
                            }}>
                                {loadingWg ? 'Checking VPN tunnel status…'
                                    : wgError ? `⚠️ Could not load VPN status`
                                        : isTunnelActive ? '🔒 VPN Tunnel Active — Secure Remote Access Available'
                                            : isTunnelConfigured ? '⚠️ VPN Configured — Tunnel not yet connected'
                                                : '🔓 VPN Not Configured — Direct IP access only'}
                            </div>
                            {!loadingWg && (
                                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>
                                    {wgError || wgStatus?.tunnelStatusMessage || 'Could not retrieve VPN status.'}
                                    {isTunnelActive && <HandshakeAgo />}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Credentials Section ── */}
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--bg-surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <RouterIcon style={{ color: '#be185d', fontSize: 20 }} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#831843' }}>Router Credentials</h3>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    Use these to log in to Winbox or WebFig
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                            <InfoRow
                                label="Router IP / VPN Tunnel IP"
                                value={hasTunnelIp ? `${tunnelHost} (via VPN) · ${directHost} (direct)` : directHost}
                                mono
                                onCopy={() => handleCopy(tunnelHost, 'ip')}
                                copied={copied === 'ip'}
                                highlight={isTunnelActive}
                            />
                            <InfoRow
                                label="Username"
                                value={username}
                                mono
                                onCopy={() => handleCopy(username, 'user')}
                                copied={copied === 'user'}
                            />
                            {/* Password */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                <div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>Password</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.88rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {showPassword ? (password || '(not stored)') : (password ? '••••••••' : '(not stored)')}
                                        {password && (
                                            <button onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-secondary)' }}>
                                                {showPassword ? <VisibilityOffIcon style={{ fontSize: 15 }} /> : <VisibilityIcon style={{ fontSize: 15 }} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {password && (
                                    <button className="btn-icon" onClick={() => handleCopy(password, 'pass')}>
                                        {copied === 'pass' ? <CheckCircleIcon style={{ fontSize: 16, color: '#16a34a' }} /> : <ContentCopyIcon style={{ fontSize: 16 }} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── WinBox Section ── */}
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--bg-surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>🔧 Winbox Connection</div>
                            <span style={{ fontSize: '0.72rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 6px', color: '#64748b' }}>
                                Port {WINBOX_PORT}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {/* Primary: VPN connection */}
                            {(isTunnelActive || isTunnelConfigured) && hasTunnelIp && (
                                <div>
                                    {!isTunnelActive && (
                                        <div style={{ fontSize: '0.78rem', color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', marginBottom: 8 }}>
                                            ⚠️ VPN tunnel may not be active. Try connecting — if it fails, check WireGuard on the router.
                                        </div>
                                    )}
                                    <WinboxButton useVpn={true} />
                                </div>
                            )}

                            {/* Secondary: Direct IP connection */}
                            <div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 6 }}>
                                    {(isTunnelActive || isTunnelConfigured) ? 'Or connect directly (if router has a public IP):' : 'Connect directly via public IP:'}
                                </div>
                                <WinboxButton useVpn={false} />
                            </div>
                        </div>

                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
                            Requires Winbox v3+ installed and <code>winbox://</code> protocol registered on your PC
                        </div>
                    </div>

                    {/* ── WebFig Section ── */}
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 16, background: 'var(--bg-surface)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <LanguageIcon style={{ color: '#4338ca', fontSize: 20 }} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#1e1b4b' }}>WebFig — Browser Management</h3>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Access full router config via web browser</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {/* VPN URL */}
                            {hasTunnelIp && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>Via VPN Tunnel:</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#334155', wordBreak: 'break-all', flex: 1, marginRight: 8 }}>
                                        {webFigVpnUrl}
                                    </div>
                                    <a
                                        href={webFigVpnUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-sm"
                                        style={{ background: '#4338ca', color: '#fff', textDecoration: 'none', padding: '6px 12px', fontSize: '0.8rem', flexShrink: 0, display: 'flex', gap: 4, alignItems: 'center' }}
                                    >
                                        Open <OpenInNewIcon style={{ fontSize: 13 }} />
                                    </a>
                                </div>
                            )}

                            {/* Direct URL */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2 }}>Direct IP:</div>
                                <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#334155', wordBreak: 'break-all', flex: 1, marginRight: 8 }}>
                                    {webFigDirectUrl}
                                </div>
                                <a
                                    href={webFigDirectUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm"
                                    style={{ background: '#334155', color: '#fff', textDecoration: 'none', padding: '6px 12px', fontSize: '0.8rem', flexShrink: 0, display: 'flex', gap: 4, alignItems: 'center' }}
                                >
                                    Open <OpenInNewIcon style={{ fontSize: 13 }} />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* ── Connection Guide (only when VPN not configured) ── */}
                    {!isTunnelConfigured && !loadingWg && (
                        <div style={{ border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', padding: '12px 16px', background: '#eff6ff' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e40af', marginBottom: 8 }}>📋 Enable Secure VPN Remote Access</div>
                            <ol style={{ margin: 0, paddingLeft: 20, fontSize: '0.82rem', color: '#1e3a8a', lineHeight: 1.7 }}>
                                <li>Go to <strong>Routers page</strong> → click ⚙️ on this router</li>
                                <li>Open <strong>Router Setup Wizard</strong> → WireGuard VPN tab</li>
                                <li>Click <strong>"Activate VPN"</strong> then <strong>"Push Config to Router"</strong></li>
                                <li>Wait ~30 seconds for the tunnel to establish</li>
                                <li>Come back here — the VPN tunnel button will be enabled</li>
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
