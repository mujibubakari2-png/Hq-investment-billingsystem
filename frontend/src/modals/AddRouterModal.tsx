import { useState } from 'react';
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
import type { Router } from '../types';

interface AddRouterModalProps {
    onClose: () => void;
    onSave?: (data: Partial<Router>) => void;
    initialData?: Partial<Router>;
}

export default function AddRouterModal({ onClose, onSave, initialData }: AddRouterModalProps) {
    const [routerName, setRouterName] = useState(initialData?.name || '');
    const [accessCode, setAccessCode] = useState(initialData?.password || '');
    const [showAccessCode, setShowAccessCode] = useState(false);
    const [vpnMode, setVpnMode] = useState<'hybrid' | 'wireguard' | 'openvpn'>(
        (initialData?.vpnMode as 'hybrid' | 'wireguard' | 'openvpn') || 'hybrid'
    );
    const [description, setDescription] = useState(initialData?.description || '');
    const [status, setStatus] = useState<'ONLINE' | 'OFFLINE'>(initialData?.status === 'Online' ? 'ONLINE' : 'OFFLINE');

    const handleSave = () => {
        if (!routerName || !accessCode) {
            alert('Router name and access code are required');
            return;
        }
        if (onSave) onSave({
            name: routerName,
            password: accessCode,
            vpnMode,
            description,
            status,
            host: initialData?.host || "0.0.0.0", // Default for new routers
            username: initialData?.username || "admin",
            port: initialData?.port || 8728,
            apiPort: initialData?.apiPort || 8728,
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
            <div className="modal" style={{ 
                maxWidth: 580, width: '95%', maxHeight: '95vh', overflow: 'auto',
                borderRadius: 16, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255,255,255,0.1)'
            }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{
                    padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: '1px solid #f1f5f9', background: '#fff'
                }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Add Router</h2>
                    <button onClick={onClose} style={{ 
                        background: '#f8fafc', border: 'none', borderRadius: '50%', 
                        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#64748b', transition: 'all 0.2s'
                    }}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                <div style={{ padding: '24px' }}>
                    {/* Access Code */}
                    <div className="form-group" style={{ marginBottom: 20 }}>
                        <label className="form-label" style={{ fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <EditIcon style={{ fontSize: 16 }} /> Access Code <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showAccessCode ? 'text' : 'password'}
                                className="form-input"
                                placeholder="Enter access code"
                                value={accessCode}
                                onChange={e => setAccessCode(e.target.value)}
                                style={{ paddingRight: 45, height: 48, fontSize: '0.95rem' }}
                            />
                            <button
                                type="button"
                                style={{ 
                                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', 
                                    border: '1px solid #e2e8f0', background: '#fff', borderRadius: 6,
                                    padding: '4px 8px', cursor: 'pointer', color: '#64748b',
                                    display: 'flex', alignItems: 'center'
                                }}
                                onClick={() => setShowAccessCode(!showAccessCode)}
                            >
                                {showAccessCode ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                            </button>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <InfoOutlinedIcon style={{ fontSize: 14 }} /> Default access code is required to add new routers
                        </div>
                    </div>

                    {/* Router Name */}
                    <div className="form-group" style={{ marginBottom: 24 }}>
                        <label className="form-label" style={{ fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <SecurityIcon style={{ fontSize: 16 }} /> Router Name <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g., Router-Branch-01"
                            value={routerName}
                            onChange={e => setRouterName(e.target.value)}
                            style={{ height: 48, fontSize: '0.95rem' }}
                        />
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <InfoOutlinedIcon style={{ fontSize: 14 }} /> 3-30 characters, alphanumeric with - and _ only
                        </div>
                    </div>

                    {/* VPN Configuration Mode */}
                    <div className="form-group" style={{ marginBottom: 24 }}>
                        <label className="form-label" style={{ fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                            <ShieldIcon style={{ fontSize: 16 }} /> VPN Configuration Mode <span style={{ color: '#ef4444' }}>*</span>
                        </label>

                        {/* Hybrid Mode Selection */}
                        <div 
                            onClick={() => setVpnMode('hybrid')}
                            style={{
                                border: vpnMode === 'hybrid' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                borderRadius: 12, padding: 16, marginBottom: 16, cursor: 'pointer',
                                background: vpnMode === 'hybrid' ? '#eff6ff' : '#fff', position: 'relative',
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        >
                            <div style={{ position: 'absolute', top: 16, left: 16 }}>
                                <div style={{ 
                                    width: 18, height: 18, borderRadius: '50%', 
                                    border: vpnMode === 'hybrid' ? '6px solid #3b82f6' : '2px solid #cbd5e1',
                                    background: '#fff'
                                }} />
                            </div>
                            <div style={{ paddingLeft: 32 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    <div style={{ 
                                        width: 32, height: 32, borderRadius: 8, background: '#dcfce7', 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                    }}>
                                        <AddTaskIcon style={{ color: '#16a34a', fontSize: 18 }} />
                                    </div>
                                    <strong style={{ fontSize: '1rem', color: '#1e293b' }}>Hybrid Mode</strong>
                                    <span style={{ 
                                        background: '#22c55e', color: '#fff', padding: '2px 10px', 
                                        borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 
                                    }}>Recommended</span>
                                </div>
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>
                                    <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <CheckIcon style={{ fontSize: 14, color: '#22c55e' }} /> WireGuard: Primary VPN for all customer traffic (fast & efficient)
                                    </li>
                                    <li style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <CheckIcon style={{ fontSize: 14, color: '#22c55e' }} /> OpenVPN: Management tunnel with port forwarding (Winbox/WebFig)
                                    </li>
                                </ul>
                                <div style={{ 
                                    marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4,
                                    background: '#f0fdf4', color: '#16a34a', padding: '2px 8px', borderRadius: 6,
                                    fontSize: '0.72rem', fontWeight: 600, border: '1px solid #dcfce7'
                                }}>
                                    ⭐ Best of both worlds
                                </div>
                            </div>
                        </div>

                        {/* Split Options */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            {/* WireGuard Only */}
                            <div 
                                onClick={() => setVpnMode('wireguard')}
                                style={{
                                    border: vpnMode === 'wireguard' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                    borderRadius: 12, padding: 16, cursor: 'pointer',
                                    background: vpnMode === 'wireguard' ? '#eff6ff' : '#fff', position: 'relative',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ position: 'absolute', top: 16, left: 16 }}>
                                    <div style={{ 
                                        width: 16, height: 16, borderRadius: '50%', 
                                        border: vpnMode === 'wireguard' ? '5px solid #3b82f6' : '2px solid #cbd5e1',
                                        background: '#fff'
                                    }} />
                                </div>
                                <div style={{ paddingLeft: 28 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <VpnLockIcon style={{ color: '#3b82f6', fontSize: 18 }} />
                                        <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>WireGuard Only</strong>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                                        Fast & modern protocol<br/>Lightweight VPN<br/>Direct IP access
                                    </div>
                                </div>
                            </div>

                            {/* OpenVPN Only */}
                            <div 
                                onClick={() => setVpnMode('openvpn')}
                                style={{
                                    border: vpnMode === 'openvpn' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                    borderRadius: 12, padding: 16, cursor: 'pointer',
                                    background: vpnMode === 'openvpn' ? '#eff6ff' : '#fff', position: 'relative',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ position: 'absolute', top: 16, left: 16 }}>
                                    <div style={{ 
                                        width: 16, height: 16, borderRadius: '50%', 
                                        border: vpnMode === 'openvpn' ? '5px solid #3b82f6' : '2px solid #cbd5e1',
                                        background: '#fff'
                                    }} />
                                </div>
                                <div style={{ paddingLeft: 28 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <ShieldIcon style={{ color: '#ef4444', fontSize: 18 }} />
                                        <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>OpenVPN Only</strong>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
                                        Traditional VPN<br/>Port forwarding<br/>Wide compatibility
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Hybrid Info Banner */}
                        <div style={{ 
                            marginTop: 16, padding: 12, borderRadius: 10, background: '#f0f9ff',
                            border: '1px solid #e0f2fe', display: 'flex', alignItems: 'flex-start', gap: 8
                        }}>
                            <InfoOutlinedIcon style={{ color: '#0ea5e9', fontSize: 18, marginTop: 1 }} />
                            <div style={{ fontSize: '0.75rem', color: '#0369a1', lineHeight: 1.5 }}>
                                <strong>{vpnMode === 'hybrid' ? 'Hybrid Mode' : vpnMode === 'wireguard' ? 'WireGuard' : 'OpenVPN'}:</strong> {
                                    vpnMode === 'hybrid' 
                                    ? 'Uses WireGuard for all customer VPN traffic (fast performance) and OpenVPN for management access with port forwarding (easy remote access to Winbox/WebFig). This provides optimal performance while maintaining convenient management access.'
                                    : vpnMode === 'wireguard'
                                    ? 'Best for high-speed connectivity and lower resource usage. Great for modern setups.'
                                    : 'Best for compatibility across different networks and easy management features.'
                                }
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="form-group" style={{ marginBottom: 24 }}>
                        <label className="form-label" style={{ fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                            📝 Description (Optional)
                        </label>
                        <textarea
                            className="form-input"
                            placeholder="Brief description or location of this router"
                            rows={3}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            style={{ padding: 12, resize: 'none' }}
                        />
                    </div>

                    {/* Initial Status */}
                    <div className="form-group" style={{ marginBottom: 24 }}>
                        <label className="form-label" style={{ fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                            <PowerSettingsNewIcon style={{ fontSize: 16 }} /> Initial Status
                        </label>
                        <div style={{ display: 'flex', gap: 24 }}>
                            <div 
                                onClick={() => setStatus('ONLINE')}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                            >
                                <div style={{ 
                                    width: 18, height: 18, borderRadius: '50%', 
                                    border: status === 'ONLINE' ? '6px solid #22c55e' : '2px solid #cbd5e1',
                                    background: '#fff'
                                }} />
                                <span style={{ fontSize: '0.9rem', color: status === 'ONLINE' ? '#1e293b' : '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <CheckIcon style={{ fontSize: 16, color: '#22c55e' }} /> Enable
                                </span>
                            </div>
                            <div 
                                onClick={() => setStatus('OFFLINE')}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                            >
                                <div style={{ 
                                    width: 18, height: 18, borderRadius: '50%', 
                                    border: status === 'OFFLINE' ? '6px solid #ef4444' : '2px solid #cbd5e1',
                                    background: '#fff'
                                }} />
                                <span style={{ fontSize: '0.9rem', color: status === 'OFFLINE' ? '#1e293b' : '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <CloseIcon style={{ fontSize: 16, color: '#ef4444' }} /> Disable
                                </span>
                            </div>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <InfoOutlinedIcon style={{ fontSize: 14 }} /> You can enable the router after initial setup
                        </div>
                    </div>

                    {/* Note Box */}
                    <div style={{ 
                        background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12,
                        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10
                    }}>
                        <WarningAmberIcon style={{ color: '#d97706', fontSize: 20 }} />
                        <div style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 500 }}>
                            <strong>Note:</strong> After creation, you'll receive setup instructions and configuration files. Make sure to save all credentials securely.
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ 
                    padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9',
                    display: 'flex', justifyContent: 'flex-end', gap: 12
                }}>
                    <button 
                        className="btn btn-secondary" 
                        onClick={onClose}
                        style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#475569', padding: '0 24px', height: 44 }}
                    >
                        ✕ Cancel
                    </button>
                    <button 
                        className="btn" 
                        onClick={handleSave}
                        style={{ 
                            background: '#22c55e', color: '#fff', padding: '0 24px', height: 44, 
                            fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 6px -1px rgba(34, 197, 94, 0.2)'
                        }}
                        disabled={!routerName || !accessCode}
                    >
                        <AddTaskIcon style={{ fontSize: 18 }} /> Create Router
                    </button>
                </div>
            </div>
        </div>
    );
}

