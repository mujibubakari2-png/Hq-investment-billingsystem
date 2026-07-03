import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RouterIcon from '@mui/icons-material/Router';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import SettingsIcon from '@mui/icons-material/Settings';
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
    // FIX (was broken): "Download Script" used to call generateMikrotikScript()
    // directly with only routerName/username/password — that function REQUIRES
    // lanIp/lanGateway/hotspotPoolRange/pppoePoolRange/dns and throws when they
    // are missing, so this button threw an error on every single click. The
    // only place that safely collects all required fields and generates a
    // secure script (VPN-scoped firewall, real RADIUS secret, TLS cert) is the
    // Router Setup Wizard, so we route there instead of generating inline.
    onOpenWizard?: (router: Router) => void;
}

export default function RouterDetailModal({ router, onClose, onDelete, onOpenWizard }: RouterDetailModalProps) {
    const navigate = useNavigate();
    const [showWireGuard, setShowWireGuard] = useState(false);

    const openWizard = () => {
        if (onOpenWizard) {
            onOpenWizard(router);
        } else {
            // Fallback for any caller that doesn't wire onOpenWizard: navigate to
            // the dedicated wizard route instead of silently doing nothing.
            onClose();
            navigate(`/router-setup/${router.id}`);
        }
    };
    if (showWireGuard) {
        return <WireGuardConfigModal router={router} onClose={() => setShowWireGuard(false)} />;
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
                {/* Green Header */}
                <div className="modal-header" style={{ background: '#16a34a', color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <RouterIcon fontSize="small" style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{router.name}</span>
                    </div>
                    <button onClick={onClose} className="modal-close" style={{ color: '#fff', background: 'rgba(255,255,255,0.15)' }}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                <div style={{ padding: 20 }}>
                    {/* Router Info */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        flexWrap: 'wrap', gap: 8,
                        padding: '12px 16px', background: '#f8fafc', borderRadius: 'var(--radius-sm)',
                        marginBottom: 20,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <RouterIcon style={{ color: '#d97706', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{router.name}</span>
                        </div>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '4px 12px', borderRadius: 20,
                            background: router.status === 'Online' ? '#d1fae5' : '#fee2e2',
                            color: router.status === 'Online' ? '#065f46' : '#dc2626',
                            fontWeight: 500, fontSize: '0.8rem', flexShrink: 0,
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
                                flexWrap: 'wrap', gap: 8
                            }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                                <strong style={{ ...(row.mono ? { fontFamily: 'monospace' } : {}), wordBreak: 'break-all', textAlign: 'right' }}>{row.value}</strong>
                            </div>
                        ))}
                    </div>

                    {/* VPN Configuration */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}>
                            <VpnLockIcon style={{ fontSize: 16 }} /> VPN CONFIGURATION
                        </div>
                        <div className="responsive-grid-2" style={{ gap: 8 }}>
                            <button className="btn" style={{
                                background: '#fef3c7', color: '#d97706', fontWeight: 600, border: '1px solid #fbbf24',
                                padding: '10px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }} onClick={() => setShowWireGuard(true)}>
                                <VpnLockIcon fontSize="small" /> WireGuard
                            </button>
                            <button className="btn" style={{
                                background: '#eef2ff', color: '#4338ca', fontWeight: 600, border: '1px solid #c7d2fe',
                                padding: '10px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }} onClick={openWizard}>
                                <SettingsIcon fontSize="small" /> Setup Wizard / Script
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
