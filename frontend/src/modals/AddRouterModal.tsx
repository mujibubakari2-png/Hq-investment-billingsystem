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
    const [status, setStatus] = useState<'Online' | 'Offline'>(initialData?.status === 'Online' ? 'Online' : 'Offline');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [host, setHost] = useState(initialData?.host || "0.0.0.0");
    const [username, setUsername] = useState(initialData?.username || "admin");
    const [port, setPort] = useState<number | undefined>(initialData?.port || undefined);
    const [apiPort, setApiPort] = useState<number | undefined>(initialData?.apiPort || undefined);

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
            host: host,
            username: username,
            port: port,
            apiPort: apiPort,
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1100, backdropFilter: 'blur(4px)', background: 'var(--bg-modal-overlay)'
        }}>
            <div className="modal" style={{
                maxWidth: 600, width: '95%', maxHeight: '92vh', overflow: 'auto',
                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                backdropFilter: 'var(--glass-blur)',
                display: 'flex', flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-light)', background: 'transparent'
                }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Add Router</h2>
                    <button onClick={onClose} style={{
                        background: 'var(--bg-hover)', border: 'none', borderRadius: '50%',
                        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-secondary)', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                <div style={{ padding: '28px' }}>
                    {/* Access Code */}
                    <div className="form-group" style={{ marginBottom: 24 }}>
                        <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', marginBottom: 8 }}>
                            <EditIcon style={{ fontSize: 18, color: 'var(--primary)' }} /> Access Code <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showAccessCode ? 'text' : 'password'}
                                className="form-input"
                                placeholder="Enter access code"
                                value={accessCode}
                                onChange={e => setAccessCode(e.target.value)}
                                style={{
                                    paddingRight: 50, height: 52, fontSize: '1rem',
                                    background: 'var(--bg-input)', border: '1.5px solid var(--border)',
                                    borderRadius: 'var(--radius-sm)', transition: 'all 0.2s'
                                }}
                            />
                            <button
                                type="button"
                                style={{
                                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                    border: 'none', background: 'var(--bg-hover)', borderRadius: 8,
                                    padding: '6px 10px', cursor: 'pointer', color: 'var(--text-secondary)',
                                    display: 'flex', alignItems: 'center', transition: 'all 0.2s'
                                }}
                                onClick={() => setShowAccessCode(!showAccessCode)}
                            >
                                {showAccessCode ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                            </button>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8 }}>
                            <InfoOutlinedIcon style={{ fontSize: 15 }} /> Default access code is required to add new routers
                        </div>
                    </div>

                    {/* Router Name */}
                    <div className="form-group" style={{ marginBottom: 28 }}>
                        <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', marginBottom: 8 }}>
                            <SecurityIcon style={{ fontSize: 18, color: 'var(--primary)' }} /> Router Name <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="e.g., Router-Branch-01"
                            value={routerName}
                            onChange={e => setRouterName(e.target.value)}
                            style={{
                                height: 52, fontSize: '1rem',
                                background: 'var(--bg-input)', border: '1.5px solid var(--border)',
                                borderRadius: 'var(--radius-sm)', transition: 'all 0.2s'
                            }}
                        />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8 }}>
                            <InfoOutlinedIcon style={{ fontSize: 15 }} /> 3-30 characters, alphanumeric with - and _ only
                        </div>
                    </div>

                    {/* VPN Configuration Mode */}
                    <div className="form-group" style={{ marginBottom: 28 }}>
                        <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', marginBottom: 16 }}>
                            <ShieldIcon style={{ fontSize: 18, color: 'var(--primary)' }} /> VPN Configuration Mode <span style={{ color: 'var(--danger)' }}>*</span>
                        </label>

                        {/* Hybrid Mode Selection */}
                        <div
                            onClick={() => setVpnMode('hybrid')}
                            style={{
                                border: vpnMode === 'hybrid' ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                                borderRadius: 'var(--radius)', padding: 20, marginBottom: 16, cursor: 'pointer',
                                background: vpnMode === 'hybrid' ? 'var(--primary-light)' : 'var(--bg-input)', position: 'relative',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: vpnMode === 'hybrid' ? 'scale(1.01)' : 'scale(1)',
                                boxShadow: vpnMode === 'hybrid' ? 'var(--shadow-md)' : 'none'
                            }}
                        >
                            <div style={{ position: 'absolute', top: 20, left: 20 }}>
                                <div style={{
                                    width: 20, height: 20, borderRadius: '50%',
                                    border: vpnMode === 'hybrid' ? `6px solid var(--primary)` : '2.5px solid var(--border)',
                                    background: '#fff', transition: 'all 0.3s'
                                }} />
                            </div>
                            <div style={{ paddingLeft: 36 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10, background: 'var(--secondary-light)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <AddTaskIcon style={{ color: 'var(--secondary)', fontSize: 20 }} />
                                    </div>
                                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>Hybrid Mode</strong>
                                    <span style={{
                                        background: 'var(--secondary)', color: '#fff', padding: '3px 12px',
                                        borderRadius: 20, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px'
                                    }}>Recommended</span>
                                </div>
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                    <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <CheckIcon style={{ fontSize: 16, color: 'var(--secondary)' }} /> <span>WireGuard: Primary VPN for all customer traffic (fast & efficient)</span>
                                    </li>
                                    <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <CheckIcon style={{ fontSize: 16, color: 'var(--secondary)' }} /> <span>OpenVPN: Management tunnel with port forwarding (Winbox/WebFig)</span>
                                    </li>
                                </ul>
                                <div style={{
                                    marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6,
                                    background: 'var(--secondary-light)', color: 'var(--secondary)', padding: '4px 12px', borderRadius: 8,
                                    fontSize: '0.75rem', fontWeight: 700, border: '1px solid var(--border-light)'
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
                                    border: vpnMode === 'wireguard' ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                                    borderRadius: 'var(--radius)', padding: 18, cursor: 'pointer',
                                    background: vpnMode === 'wireguard' ? 'var(--primary-light)' : 'var(--bg-input)', position: 'relative',
                                    transition: 'all 0.3s', transform: vpnMode === 'wireguard' ? 'scale(1.02)' : 'scale(1)',
                                    boxShadow: vpnMode === 'wireguard' ? 'var(--shadow)' : 'none'
                                }}
                            >
                                <div style={{ position: 'absolute', top: 18, left: 18 }}>
                                    <div style={{
                                        width: 18, height: 18, borderRadius: '50%',
                                        border: vpnMode === 'wireguard' ? `5px solid var(--primary)` : '2.5px solid var(--border)',
                                        background: '#fff'
                                    }} />
                                </div>
                                <div style={{ paddingLeft: 30 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                        <VpnLockIcon style={{ color: 'var(--info)', fontSize: 20 }} />
                                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>WireGuard Only</strong>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                        Fast & modern protocol<br />Lightweight VPN<br />Direct IP access
                                    </div>
                                </div>
                            </div>

                            {/* OpenVPN Only */}
                            <div
                                onClick={() => setVpnMode('openvpn')}
                                style={{
                                    border: vpnMode === 'openvpn' ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                                    borderRadius: 'var(--radius)', padding: 18, cursor: 'pointer',
                                    background: vpnMode === 'openvpn' ? 'var(--primary-light)' : 'var(--bg-input)', position: 'relative',
                                    transition: 'all 0.3s', transform: vpnMode === 'openvpn' ? 'scale(1.02)' : 'scale(1)',
                                    boxShadow: vpnMode === 'openvpn' ? 'var(--shadow)' : 'none'
                                }}
                            >
                                <div style={{ position: 'absolute', top: 18, left: 18 }}>
                                    <div style={{
                                        width: 18, height: 18, borderRadius: '50%',
                                        border: vpnMode === 'openvpn' ? `5px solid var(--primary)` : '2.5px solid var(--border)',
                                        background: '#fff'
                                    }} />
                                </div>
                                <div style={{ paddingLeft: 30 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                        <ShieldIcon style={{ color: 'var(--danger)', fontSize: 20 }} />
                                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>OpenVPN Only</strong>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                        Traditional VPN<br />Port forwarding<br />Wide compatibility
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Hybrid Info Banner */}
                        <div style={{
                            marginTop: 20, padding: 16, borderRadius: 12, background: 'var(--info-light)',
                            border: '1px solid var(--border-light)', display: 'flex', alignItems: 'flex-start', gap: 10,
                            animation: 'fadeIn 0.3s ease-out'
                        }}>
                            <InfoOutlinedIcon style={{ color: 'var(--info)', fontSize: 20, marginTop: 1 }} />
                            <div style={{ fontSize: '0.82rem', color: 'var(--info)', lineHeight: 1.6, fontWeight: 500 }}>
                                <strong>{vpnMode === 'hybrid' ? 'Hybrid Mode' : vpnMode === 'wireguard' ? 'WireGuard' : 'OpenVPN'}:</strong> {
                                    vpnMode === 'hybrid'
                                        ? 'Uses WireGuard for customer traffic and OpenVPN for management access. Optimal performance with convenient remote management.'
                                        : vpnMode === 'wireguard'
                                            ? 'Best for high-speed connectivity and lower resource usage. Modern and efficient.'
                                            : 'Best for compatibility and easy management features across any network.'
                                }
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="form-group" style={{ marginBottom: 28 }}>
                        <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                            📝 Description (Optional)
                        </label>
                        <textarea
                            className="form-input"
                            placeholder="Brief description or location of this router"
                            rows={3}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            style={{
                                padding: 14, resize: 'none', background: 'var(--bg-input)',
                                border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>

                    {/* Advanced Settings Toggle */}
                    <div style={{ marginBottom: 20 }}>
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            style={{
                                background: 'transparent', border: 'none', color: 'var(--primary)',
                                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6, padding: 0
                            }}
                        >
                            {showAdvanced ? '− Hide Advanced Settings' : '+ Show Advanced Settings (Host, User & Port)'}
                        </button>

                        {showAdvanced && (
                            <div style={{
                                marginTop: 16, padding: 20, background: 'var(--bg-input)',
                                border: '1.5px solid var(--border)', borderRadius: 'var(--radius)',
                                animation: 'fadeIn 0.3s ease-out'
                            }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8, display: 'block' }}>
                                            Router IP / Host Address
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="e.g., 10.116.0.2"
                                            value={host}
                                            onChange={e => setHost(e.target.value)}
                                            style={{ height: 44, fontSize: '0.9rem' }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8, display: 'block' }}>
                                            API Username
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="admin"
                                            value={username}
                                            onChange={e => setUsername(e.target.value)}
                                            style={{ height: 44, fontSize: '0.9rem' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8, display: 'block' }}>
                                            API Port (Optional)
                                        </label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="e.g., 8728"
                                            value={apiPort || ''}
                                            onChange={e => {
                                                const val = e.target.value ? parseInt(e.target.value) : undefined;
                                                setApiPort(val);
                                                setPort(val);
                                            }}
                                            style={{ height: 44, fontSize: '0.9rem' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', paddingTop: 20 }}>
                                        Leave blank for defaults.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Initial Status */}
                    <div className="form-group" style={{ marginBottom: 28 }}>
                        <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', marginBottom: 16 }}>
                            <PowerSettingsNewIcon style={{ fontSize: 18, color: 'var(--primary)' }} /> Initial Status
                        </label>
                        <div style={{ display: 'flex', gap: 32 }}>
                            <div
                                onClick={() => setStatus('Online')}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                                <div style={{
                                    width: 20, height: 20, borderRadius: '50%',
                                    border: status === 'Online' ? `6px solid var(--secondary)` : '2.5px solid var(--border)',
                                    background: '#fff', transition: 'all 0.2s'
                                }} />
                                <span style={{ fontSize: '1rem', fontWeight: 600, color: status === 'Online' ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <CheckIcon style={{ fontSize: 18, color: 'var(--secondary)' }} /> Enable
                                </span>
                            </div>
                            <div
                                onClick={() => setStatus('Offline')}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                                <div style={{
                                    width: 20, height: 20, borderRadius: '50%',
                                    border: status === 'Offline' ? `6px solid var(--danger)` : '2.5px solid var(--border)',
                                    background: '#fff', transition: 'all 0.2s'
                                }} />
                                <span style={{ fontSize: '1rem', fontWeight: 600, color: status === 'Offline' ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <CloseIcon style={{ fontSize: 18, color: 'var(--danger)' }} /> Disable
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Note Box */}
                    <div style={{
                        background: 'var(--warning-light)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)',
                        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.02)'
                    }}>
                        <WarningAmberIcon style={{ color: 'var(--warning)', fontSize: 24 }} />
                        <div style={{ fontSize: '0.85rem', color: 'var(--warning)', fontWeight: 600, lineHeight: 1.5 }}>
                            <strong>Note:</strong> After creation, you'll receive setup instructions and configuration files. Make sure to save all credentials securely.
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '24px 28px', background: 'var(--bg-hover)', borderTop: '1px solid var(--border-light)',
                    display: 'flex', justifyContent: 'flex-end', gap: 16
                }}>
                    <button
                        className="btn btn-secondary"
                        onClick={onClose}
                        style={{ background: 'var(--bg-card)', padding: '0 28px', height: 48, borderRadius: 'var(--radius-sm)' }}
                    >
                        ✕ Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        style={{
                            padding: '0 32px', height: 48,
                            fontWeight: 800, borderRadius: 'var(--radius-sm)',
                            display: 'flex', alignItems: 'center', gap: 10,
                            boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.4)'
                        }}
                        disabled={!routerName || !accessCode}
                    >
                        <AddTaskIcon style={{ fontSize: 20 }} /> Create Router
                    </button>
                </div>
            </div>
        </div>
    );
}

