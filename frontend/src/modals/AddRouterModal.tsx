import { useState, type ReactNode } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SecurityIcon from '@mui/icons-material/Security';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import ShieldIcon from '@mui/icons-material/Shield';
import AddTaskIcon from '@mui/icons-material/AddTask';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditIcon from '@mui/icons-material/Edit';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RouterIcon from '@mui/icons-material/Router';
import LanIcon from '@mui/icons-material/Lan';
import PersonIcon from '@mui/icons-material/Person';
import type { Router } from '../types';

interface AddRouterModalProps {
    onClose: () => void;
    onSave?: (data: Partial<Router>) => void;
    initialData?: Partial<Router>;
}

const VPN_OPTIONS: readonly VpnCard[] = [
    {
        value: 'hybrid',
        label: 'Hybrid',
        badge: 'Recommended',
        icon: <AddTaskIcon style={{ fontSize: 20, color: '#16a34a' }} />,
        color: '#16a34a',
        bg: '#f0fdf4',
        border: '#bbf7d0',
        description: 'WireGuard + OpenVPN — best performance with easy management access.',
    },
    {
        value: 'wireguard',
        label: 'WireGuard',
        icon: <VpnLockIcon style={{ fontSize: 20, color: '#2563eb' }} />,
        color: '#2563eb',
        bg: '#eff6ff',
        border: '#bfdbfe',
        description: 'Fast & modern. Lightweight, low latency VPN tunnel.',
    },
    {
        value: 'openvpn',
        label: 'OpenVPN',
        icon: <ShieldIcon style={{ fontSize: 20, color: '#7c3aed' }} />,
        color: '#7c3aed',
        bg: '#f5f3ff',
        border: '#ddd6fe',
        description: 'Traditional VPN with wide compatibility and port forwarding.',
    },
];

type VpnCard = {
    value: 'hybrid' | 'wireguard' | 'openvpn';
    label: string;
    icon: ReactNode;
    color: string;
    bg: string;
    border: string;
    description: string;
    badge?: string;
};

type VpnMode = 'hybrid' | 'wireguard' | 'openvpn';

export default function AddRouterModal({ onClose, onSave, initialData }: AddRouterModalProps) {
    const [routerName, setRouterName] = useState(initialData?.name || '');
    const [accessCode, setAccessCode] = useState(initialData?.password || '');
    const [showAccessCode, setShowAccessCode] = useState(false);
    const [vpnMode, setVpnMode] = useState<VpnMode>((initialData?.vpnMode as VpnMode) || 'hybrid');
    const [description, setDescription] = useState(initialData?.description || '');
    const [status, setStatus] = useState<'Online' | 'Offline'>(initialData?.status === 'Online' ? 'Online' : 'Offline');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [host, setHost] = useState(initialData?.host || '0.0.0.0');
    const [username, setUsername] = useState(initialData?.username || 'admin');
    const [port, setPort] = useState<number | undefined>(initialData?.port || undefined);
    const [apiPort, setApiPort] = useState<number | undefined>(initialData?.apiPort || undefined);

    const isEdit = !!initialData?.id;

    const handleSave = () => {
        if (!routerName || (!accessCode && !isEdit)) {
            alert('Router name and access code are required');
            return;
        }
        if (onSave) onSave({ name: routerName, password: accessCode, vpnMode, description, status, host, username, port, apiPort });
    };

    const selectedVpn = VPN_OPTIONS.find(v => v.value === vpnMode)!;

    return (
        <div className="modal-overlay" onClick={onClose}>
            {/* Responsive overrides for mobile */}
            <style>{`
                .add-router-body { padding: 24px 28px; }
                .add-router-footer { padding: 14px 28px; }
                .add-router-vpn-grid { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); }
                .add-router-footer-inner { flex-direction: row; align-items: center; }
                .add-router-warn { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                @media (max-width: 560px) {
                    .add-router-body { padding: 16px 14px; }
                    .add-router-footer { padding: 12px 14px; }
                    .add-router-vpn-grid { grid-template-columns: 1fr !important; }
                    .add-router-footer-inner { flex-direction: column !important; align-items: stretch !important; }
                    .add-router-footer-inner .add-router-buttons { justify-content: stretch; }
                    .add-router-footer-inner .add-router-buttons button { flex: 1; }
                    .add-router-warn { white-space: normal; }
                }
            `}</style>
            <div
                className="modal"
                style={{ maxWidth: 600, width: '96vw', maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ── */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    color: '#fff',
                    padding: '18px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <RouterIcon style={{ fontSize: 22 }} />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{isEdit ? 'Edit Router' : 'Add New Router'}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.65, marginTop: 2 }}>
                                {isEdit ? `Editing: ${initialData?.name}` : 'Connect a new MikroTik router to this system'}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="add-router-body" style={{ overflowY: 'auto', flex: 1 }}>

                    {/* ── Row 1: Name + Access Code (2 columns on desktop) ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 24 }}>

                        {/* Router Name */}
                        <div>
                            <label style={labelStyle}>
                                <SecurityIcon style={{ fontSize: 16, color: 'var(--primary)' }} />
                                Router Name <span style={{ color: 'var(--danger)' }}>*</span>
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., Router-Moshi-01"
                                value={routerName}
                                onChange={e => setRouterName(e.target.value)}
                                style={inputStyle}
                            />
                            <div style={hintStyle}><InfoOutlinedIcon style={{ fontSize: 13 }} /> 3–30 chars, alphanumeric with - and _</div>
                        </div>

                        {/* Access Code */}
                        <div>
                            <label style={labelStyle}>
                                <EditIcon style={{ fontSize: 16, color: 'var(--primary)' }} />
                                Access Code {!isEdit && <span style={{ color: 'var(--danger)' }}>*</span>}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showAccessCode ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder={isEdit ? 'Leave blank to keep current' : 'Enter router password'}
                                    value={accessCode}
                                    onChange={e => setAccessCode(e.target.value)}
                                    style={{ ...inputStyle, paddingRight: 48 }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowAccessCode(v => !v)}
                                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4 }}
                                >
                                    {showAccessCode ? <VisibilityOffIcon style={{ fontSize: 18 }} /> : <VisibilityIcon style={{ fontSize: 18 }} />}
                                </button>
                            </div>
                            <div style={hintStyle}><InfoOutlinedIcon style={{ fontSize: 13 }} /> Default MikroTik admin password</div>
                        </div>
                    </div>

                    {/* ── VPN Mode (3 cards in a row on desktop) ── */}
                    <div style={{ marginBottom: 24 }}>
                        <label style={{ ...labelStyle, marginBottom: 12 }}>
                            <ShieldIcon style={{ fontSize: 16, color: 'var(--primary)' }} />
                            VPN Configuration Mode <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <div className="add-router-vpn-grid" style={{ display: 'grid', gap: 12 }}>
                            {VPN_OPTIONS.map(opt => {
                                const isSelected = vpnMode === opt.value;
                                return (
                                    <div
                                        key={opt.value}
                                        onClick={() => setVpnMode(opt.value)}
                                        style={{
                                            border: `2px solid ${isSelected ? opt.color : 'var(--border-light)'}`,
                                            borderRadius: 'var(--radius-md)',
                                            padding: '14px 16px',
                                            cursor: 'pointer',
                                            background: isSelected ? opt.bg : 'var(--bg-surface)',
                                            transition: 'all 0.2s',
                                            position: 'relative',
                                        }}
                                    >
                                        {/* Selected indicator */}
                                        <div style={{
                                            position: 'absolute', top: 12, right: 12,
                                            width: 18, height: 18, borderRadius: '50%',
                                            border: `2px solid ${isSelected ? opt.color : 'var(--border)'}`,
                                            background: isSelected ? opt.color : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.2s',
                                        }}>
                                            {isSelected && <CheckIcon style={{ fontSize: 12, color: '#fff' }} />}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            {opt.icon}
                                            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: isSelected ? opt.color : 'var(--text-primary)' }}>{opt.label}</span>
                                            {opt.badge && (
                                                <span style={{ fontSize: '0.62rem', fontWeight: 800, background: opt.color, color: '#fff', padding: '2px 7px', borderRadius: 10, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
                                                    {opt.badge}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{opt.description}</div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Info hint for selected mode */}
                        <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: selectedVpn.bg, border: `1px solid ${selectedVpn.border}`, fontSize: '0.78rem', color: selectedVpn.color, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <InfoOutlinedIcon style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }} />
                            <span>
                                <strong>{selectedVpn.label}:</strong>{' '}
                                {vpnMode === 'hybrid'
                                    ? 'Uses WireGuard for customer traffic and OpenVPN for management (Winbox/WebFig). Optimal performance with convenient remote management.'
                                    : vpnMode === 'wireguard'
                                        ? 'Best for high-speed connectivity and lower resource usage. Modern cryptography with minimal overhead.'
                                        : 'Best for compatibility and easy management features across any network environment.'}
                            </span>
                        </div>
                    </div>

                    {/* ── Row 2: Description + Status ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 20 }}>

                        {/* Description */}
                        <div>
                            <label style={labelStyle}>📝 Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></label>
                            <textarea
                                className="form-input"
                                placeholder="Location, notes, or purpose of this router"
                                rows={3}
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                style={{ padding: 12, resize: 'none', fontSize: '0.88rem', background: 'var(--bg-input)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                            />
                        </div>

                        {/* Initial Status */}
                        <div>
                            <label style={labelStyle}>
                                <PowerSettingsNewIcon style={{ fontSize: 16, color: 'var(--primary)' }} />
                                Initial Status
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                                {(['Online', 'Offline'] as const).map(s => {
                                    const isActive = status === s;
                                    const color = s === 'Online' ? '#16a34a' : '#dc2626';
                                    const bg = s === 'Online' ? '#f0fdf4' : '#fef2f2';
                                    return (
                                        <div
                                            key={s}
                                            onClick={() => setStatus(s)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: `1.5px solid ${isActive ? color : 'var(--border-light)'}`, background: isActive ? bg : 'var(--bg-surface)', transition: 'all 0.18s' }}
                                        >
                                            <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${isActive ? color : 'var(--border)'}`, background: isActive ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {isActive && <CheckIcon style={{ fontSize: 11, color: '#fff' }} />}
                                            </div>
                                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: isActive ? color : 'var(--text-secondary)' }}>
                                                {s === 'Online' ? '🟢 Enable (Online)' : '🔴 Disable (Offline)'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ── Advanced Settings ── */}
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 16, marginBottom: 4 }}>
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(v => !v)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
                        >
                            <LanIcon style={{ fontSize: 16 }} />
                            {showAdvanced ? '− Hide Advanced Settings' : '+ Show Advanced Settings (Host, API User & Ports)'}
                        </button>

                        {showAdvanced && (
                            <div style={{ marginTop: 16, padding: '20px 20px', background: 'var(--bg-input)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', animation: 'fadeIn 0.2s ease' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 16 }}>

                                    {/* Host */}
                                    <div>
                                        <label style={{ ...labelStyle, fontSize: '0.78rem', marginBottom: 6 }}>
                                            <RouterIcon style={{ fontSize: 14 }} /> Router IP / Host
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="e.g. 196.216.1.10"
                                            value={host}
                                            onChange={e => setHost(e.target.value)}
                                            style={{ height: 42, fontSize: '0.85rem' }}
                                        />
                                    </div>

                                    {/* Username */}
                                    <div>
                                        <label style={{ ...labelStyle, fontSize: '0.78rem', marginBottom: 6 }}>
                                            <PersonIcon style={{ fontSize: 14 }} /> API Username
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="admin"
                                            value={username}
                                            onChange={e => setUsername(e.target.value)}
                                            style={{ height: 42, fontSize: '0.85rem' }}
                                        />
                                    </div>

                                    {/* API Port */}
                                    <div>
                                        <label style={{ ...labelStyle, fontSize: '0.78rem', marginBottom: 6 }}>
                                            API Port
                                        </label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="8728"
                                            value={apiPort || ''}
                                            onChange={e => setApiPort(e.target.value ? parseInt(e.target.value) : undefined)}
                                            style={{ height: 42, fontSize: '0.85rem' }}
                                        />
                                        <div style={hintStyle}>RouterOS API default</div>
                                    </div>

                                    {/* Winbox Port */}
                                    <div>
                                        <label style={{ ...labelStyle, fontSize: '0.78rem', marginBottom: 6 }}>
                                            WinBox Port
                                        </label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="8291"
                                            value={port || ''}
                                            onChange={e => setPort(e.target.value ? parseInt(e.target.value) : undefined)}
                                            style={{ height: 42, fontSize: '0.85rem' }}
                                        />
                                        <div style={hintStyle}>WinBox default port</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="add-router-footer" style={{ borderTop: '1px solid var(--border-light)', flexShrink: 0, background: 'var(--bg-surface)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
                    <div className="add-router-footer-inner" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>

                        {/* Warning note */}
                        <div className="add-router-warn" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', flex: 1, minWidth: 0 }}>
                            <WarningAmberIcon style={{ fontSize: 15, flexShrink: 0, color: '#d97706' }} />
                            <span>After creation, open <strong>⚙️ Setup Wizard</strong> to push config to the router.</span>
                        </div>

                        {/* Buttons */}
                        <div className="add-router-buttons" style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
                            <button className="btn btn-secondary" onClick={onClose} style={{ padding: '9px 20px' }}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={!routerName || (!accessCode && !isEdit)}
                                style={{ padding: '9px 24px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff' }}
                            >
                                <AddTaskIcon style={{ fontSize: 18 }} />
                                {isEdit ? 'Save Changes' : 'Create Router'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Style constants ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontWeight: 700,
    fontSize: '0.82rem',
    color: 'var(--text-primary)',
    marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
    height: 46,
    fontSize: '0.92rem',
    background: 'var(--bg-input)',
    border: '1.5px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
};

const hintStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    marginTop: 5,
};
