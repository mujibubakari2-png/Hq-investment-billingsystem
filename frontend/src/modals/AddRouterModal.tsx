import { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SecurityIcon from '@mui/icons-material/Security';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface AddRouterModalProps {
    onClose: () => void;
    onSave?: (data: object) => void;
}

export default function AddRouterModal({ onClose, onSave }: AddRouterModalProps) {
    const [accessCode, setAccessCode] = useState('');
    const [showAccessCode, setShowAccessCode] = useState(false);
    const [routerName, setRouterName] = useState('');
    const [vpnMode, setVpnMode] = useState<'hybrid' | 'wireguard' | 'openvpn'>('hybrid');
    const [description, setDescription] = useState('');
    const [initialStatus, setInitialStatus] = useState<'enable' | 'disable'>('enable');

    const handleSave = () => {
        if (onSave) onSave({ accessCode, routerName, vpnMode, description, initialStatus });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 600, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <div className="modal-header-left">
                        <div className="modal-title" style={{ fontSize: '1.2rem' }}>Add Router</div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body" style={{ padding: '20px 24px' }}>
                    {/* Access Code */}
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            🔑 Access Code <span className="required">*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showAccessCode ? 'text' : 'password'}
                                className="form-input"
                                placeholder="Enter access code"
                                value={accessCode}
                                onChange={e => setAccessCode(e.target.value)}
                            />
                            <button
                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                onClick={() => setShowAccessCode(!showAccessCode)}
                            >
                                {showAccessCode ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                            </button>
                        </div>
                        <div className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <InfoOutlinedIcon style={{ fontSize: 14 }} /> Default access code is required to add new routers
                        </div>
                    </div>

                    {/* Router Name */}
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            🖥️ Router Name <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g., Router-Branch-01"
                            value={routerName}
                            onChange={e => setRouterName(e.target.value)}
                        />
                        <div className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                            <InfoOutlinedIcon style={{ fontSize: 14 }} /> 3-30 characters, alphanumeric with - and _ only
                        </div>
                    </div>

                    {/* VPN Configuration Mode */}
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            🔒 VPN Configuration Mode <span className="required">*</span>
                        </label>

                        {/* Hybrid Mode - Recommended */}
                        <div
                            onClick={() => setVpnMode('hybrid')}
                            style={{
                                border: vpnMode === 'hybrid' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                padding: 16,
                                marginBottom: 10,
                                cursor: 'pointer',
                                background: vpnMode === 'hybrid' ? '#fef2f2' : '#fff',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ width: 18, height: 18, borderRadius: '50%', border: vpnMode === 'hybrid' ? '5px solid var(--primary)' : '2px solid var(--border)', flexShrink: 0, marginTop: 2 }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <SecurityIcon style={{ fontSize: 18, color: vpnMode === 'hybrid' ? 'var(--primary)' : 'var(--text-secondary)' }} />
                                        <strong>Hybrid Mode</strong>
                                        <span style={{ background: '#16a34a', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600 }}>Recommended</span>
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        <div>✅ <strong>WireGuard:</strong> Primary VPN for all customer traffic (fast & efficient)</div>
                                        <div>✅ <strong>OpenVPN:</strong> Management tunnel with port forwarding (Winbox/WebFig)</div>
                                    </div>
                                    <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#d97706', fontWeight: 500 }}>✨ Best of both worlds</div>
                                </div>
                            </div>
                        </div>

                        {/* WireGuard & OpenVPN side by side */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div
                                onClick={() => setVpnMode('wireguard')}
                                style={{
                                    border: vpnMode === 'wireguard' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 14,
                                    cursor: 'pointer',
                                    background: vpnMode === 'wireguard' ? '#fef2f2' : '#fff',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: vpnMode === 'wireguard' ? '5px solid var(--primary)' : '2px solid var(--border)', flexShrink: 0, marginTop: 2 }} />
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                            <VpnLockIcon style={{ fontSize: 16, color: 'var(--info)' }} />
                                            <strong style={{ fontSize: '0.9rem' }}>WireGuard Only</strong>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            Fast & modern protocol<br />
                                            Lightweight VPN<br />
                                            Direct IP access
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
                                onClick={() => setVpnMode('openvpn')}
                                style={{
                                    border: vpnMode === 'openvpn' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: 14,
                                    cursor: 'pointer',
                                    background: vpnMode === 'openvpn' ? '#fef2f2' : '#fff',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: vpnMode === 'openvpn' ? '5px solid var(--primary)' : '2px solid var(--border)', flexShrink: 0, marginTop: 2 }} />
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                            <VpnLockIcon style={{ fontSize: 16, color: 'var(--primary)' }} />
                                            <strong style={{ fontSize: '0.9rem' }}>OpenVPN Only</strong>
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            Traditional VPN<br />
                                            Port forwarding<br />
                                            Wide compatibility
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Info banner */}
                        <div style={{
                            background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 'var(--radius-sm)',
                            padding: '10px 14px', marginTop: 12, fontSize: '0.8rem', color: '#1d4ed8', lineHeight: 1.5,
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                        }}>
                            <InfoOutlinedIcon style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }} />
                            <span>
                                <strong>Hybrid Mode:</strong> Uses WireGuard for all customer VPN traffic (fast performance) and OpenVPN for management access with port forwarding (easy remote access to Winbox/WebFig). This provides optimal performance while maintaining convenient management access.
                            </span>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">📝 Description (Optional)</label>
                        <textarea
                            className="form-input"
                            placeholder="Brief description or location of this router"
                            rows={3}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            style={{ resize: 'vertical' }}
                        />
                    </div>

                    {/* Initial Status */}
                    <div className="form-group" style={{ marginBottom: 12 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            ⚙️ Initial Status
                        </label>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <div style={{
                                    width: 16, height: 16, borderRadius: '50%',
                                    border: initialStatus === 'enable' ? '5px solid var(--primary)' : '2px solid var(--border)',
                                }} onClick={() => setInitialStatus('enable')} />
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a', fontWeight: 500 }}>
                                    <CheckIcon style={{ fontSize: 16 }} /> Enable
                                </span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                <div style={{
                                    width: 16, height: 16, borderRadius: '50%',
                                    border: initialStatus === 'disable' ? '5px solid var(--primary)' : '2px solid var(--border)',
                                }} onClick={() => setInitialStatus('disable')} />
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontWeight: 500 }}>
                                    <CloseIcon style={{ fontSize: 16 }} /> Disable
                                </span>
                            </label>
                        </div>
                        <div className="form-hint" style={{ marginTop: 4 }}>
                            <InfoOutlinedIcon style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 4 }} />
                            You can enable the router after initial setup
                        </div>
                    </div>

                    {/* Warning Note */}
                    <div style={{
                        background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 'var(--radius-sm)',
                        padding: '10px 14px', fontSize: '0.8rem', color: '#92400e', lineHeight: 1.5,
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}>
                        <WarningAmberIcon style={{ fontSize: 16, flexShrink: 0, marginTop: 2, color: '#d97706' }} />
                        <span>
                            <strong>Note:</strong> After creation, you'll receive setup instructions and configuration files. Make sure to save all credentials securely.
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={onClose}>
                        <CloseIcon fontSize="small" /> Cancel
                    </button>
                    <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600 }} onClick={handleSave} disabled={!accessCode || !routerName}>
                        <CheckIcon fontSize="small" /> Create Router
                    </button>
                </div>
            </div>
        </div>
    );
}
