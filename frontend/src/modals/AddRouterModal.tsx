import { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SecurityIcon from '@mui/icons-material/Security';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RouterIcon from '@mui/icons-material/Router';

interface AddRouterModalProps {
    onClose: () => void;
    onSave?: (data: any) => void;
    initialData?: any;
}

export default function AddRouterModal({ onClose, onSave, initialData }: AddRouterModalProps) {
    const [routerName, setRouterName] = useState(initialData?.name || '');
    const [host, setHost] = useState(initialData?.host || '');
    const [apiPort, setApiPort] = useState(initialData?.apiPort?.toString() || initialData?.port?.toString() || '8728');
    const [username, setUsername] = useState(initialData?.username || 'admin');
    const [accessCode, setAccessCode] = useState(initialData?.password || initialData?.accessCode || '');
    const [showAccessCode, setShowAccessCode] = useState(false);
    const [vpnMode, setVpnMode] = useState<'hybrid' | 'wireguard' | 'openvpn'>(initialData?.vpnMode || 'hybrid');
    const [description, setDescription] = useState(initialData?.description || '');

    const handleSave = () => {
        if (!routerName || !host) {
            alert('Router name and IP address are required');
            return;
        }
        if (onSave) onSave({ routerName, host, apiPort, username, accessCode, vpnMode, description });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 620, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                    padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderRadius: '12px 12px 0 0',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <RouterIcon style={{ color: '#fff', fontSize: 26 }} />
                        <div>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>{initialData ? 'Edit Router' : 'Add New Router'}</div>
                            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.78rem' }}>Configure MikroTik RouterOS connection</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff' }}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                <div className="modal-body" style={{ padding: '20px 24px' }}>
                    {/* Connection Details Section */}
                    <div style={{
                        background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                        padding: 16, marginBottom: 18,
                    }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                            🔌 Router Connection Details
                        </div>

                        {/* Router Name */}
                        <div className="form-group" style={{ marginBottom: 12 }}>
                            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
                                Router Name <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., Router-Branch-01"
                                value={routerName}
                                onChange={e => setRouterName(e.target.value)}
                            />
                        </div>

                        {/* IP Address + Port */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 12 }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.82rem' }}>
                                    Router IP Address <span className="required">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g., 192.168.88.1"
                                    value={host}
                                    onChange={e => setHost(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.82rem' }}>API Port</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="8728"
                                    value={apiPort}
                                    onChange={e => setApiPort(e.target.value)}
                                    style={{ width: 90 }}
                                />
                            </div>
                        </div>

                        {/* Username + Password */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.82rem' }}>API Username</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="admin"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.82rem' }}>Access Code / API Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showAccessCode ? 'text' : 'password'}
                                        className="form-input"
                                        placeholder="Router password"
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
                            </div>
                        </div>

                        <div className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: '0.75rem' }}>
                            <InfoOutlinedIcon style={{ fontSize: 13 }} /> RouterOS REST API must be enabled on your MikroTik (IP → Services → www-ssl or api)
                        </div>
                    </div>

                    {/* VPN Configuration Mode */}
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            🔒 VPN Configuration Mode <span className="required">*</span>
                        </label>

                        {/* Hybrid Mode */}
                        <div
                            onClick={() => setVpnMode('hybrid')}
                            style={{
                                border: vpnMode === 'hybrid' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 10, cursor: 'pointer',
                                background: vpnMode === 'hybrid' ? '#fef2f2' : '#fff', transition: 'all 0.2s',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ width: 16, height: 16, borderRadius: '50%', border: vpnMode === 'hybrid' ? '5px solid var(--primary)' : '2px solid var(--border)', flexShrink: 0, marginTop: 2 }} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <SecurityIcon style={{ fontSize: 16, color: vpnMode === 'hybrid' ? 'var(--primary)' : 'var(--text-secondary)' }} />
                                        <strong style={{ fontSize: '0.88rem' }}>Hybrid Mode</strong>
                                        <span style={{ background: '#16a34a', color: '#fff', padding: '1px 8px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 600 }}>Recommended</span>
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        WireGuard (fast VPN) + OpenVPN (management access)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* WireGuard & OpenVPN */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div
                                onClick={() => setVpnMode('wireguard')}
                                style={{
                                    border: vpnMode === 'wireguard' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)', padding: 12, cursor: 'pointer',
                                    background: vpnMode === 'wireguard' ? '#fef2f2' : '#fff', transition: 'all 0.2s',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: vpnMode === 'wireguard' ? '5px solid var(--primary)' : '2px solid var(--border)', flexShrink: 0, marginTop: 2 }} />
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                            <VpnLockIcon style={{ fontSize: 14, color: 'var(--info)' }} />
                                            <strong style={{ fontSize: '0.82rem' }}>WireGuard Only</strong>
                                        </div>
                                        <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Fast & modern VPN</div>
                                    </div>
                                </div>
                            </div>

                            <div
                                onClick={() => setVpnMode('openvpn')}
                                style={{
                                    border: vpnMode === 'openvpn' ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)', padding: 12, cursor: 'pointer',
                                    background: vpnMode === 'openvpn' ? '#fef2f2' : '#fff', transition: 'all 0.2s',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: vpnMode === 'openvpn' ? '5px solid var(--primary)' : '2px solid var(--border)', flexShrink: 0, marginTop: 2 }} />
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                            <VpnLockIcon style={{ fontSize: 14, color: 'var(--primary)' }} />
                                            <strong style={{ fontSize: '0.82rem' }}>OpenVPN Only</strong>
                                        </div>
                                        <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Traditional, compatible</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">📝 Description (Optional)</label>
                        <textarea
                            className="form-input"
                            placeholder="e.g., Branch office router at Dar es Salaam"
                            rows={2}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            style={{ resize: 'vertical' }}
                        />
                    </div>

                    {/* Info banner */}
                    <div style={{
                        background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 'var(--radius-sm)',
                        padding: '10px 14px', fontSize: '0.78rem', color: '#92400e', lineHeight: 1.5,
                        display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}>
                        <WarningAmberIcon style={{ fontSize: 16, flexShrink: 0, marginTop: 2, color: '#d97706' }} />
                        <span>
                            <strong>Tip:</strong> After adding the router, click "Test Connection" to verify the API connection. Ensure RouterOS REST API or API service is enabled on your MikroTik.
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div className="modal-footer" style={{ borderTop: '1px solid var(--border-light)', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={onClose}>
                        <CloseIcon fontSize="small" /> Cancel
                    </button>
                    <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600 }} onClick={handleSave} disabled={!routerName || !host}>
                        <CheckIcon fontSize="small" /> {initialData ? 'Save Changes' : 'Create Router'}
                    </button>
                </div>
            </div>
        </div>
    );
}
