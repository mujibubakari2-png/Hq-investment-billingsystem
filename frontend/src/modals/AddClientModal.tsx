import { useState, useEffect } from 'react';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import KeyIcon from '@mui/icons-material/Key';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import { generatePassword, generateUsername } from '../utils/formatters';
import { clientsApi } from '../api';
import { getPhoneError } from '../utils/validators';

interface AddClientModalProps {
    onClose: () => void;
    onSave?: (data: Record<string, unknown>) => void;
}

export default function AddClientModal({ onClose, onSave }: AddClientModalProps) {
    const [username] = useState(generateUsername());
    const [fullName, setFullName] = useState('');
    const [accountType, setAccountType] = useState('Personal');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [autoGenPassword, setAutoGenPassword] = useState(true);
    const [loginPassword, setLoginPassword] = useState(generatePassword());
    const [enablePPPoE, setEnablePPPoE] = useState(false);
    const [pppoePassword, setPppoePassword] = useState('');
    const [activateNow, setActivateNow] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // ESC key handler
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleRefreshPassword = () => {
        setLoginPassword(generatePassword());
    };

    const phoneError = getPhoneError(phoneNumber);

    // Send data directly to API instead of relying on parent callback
    const handleSave = async () => {
        if (!fullName) return;
        setLoading(true);
        setError('');
        try {
            await clientsApi.create({
                username,
                fullName,
                email: email || undefined,
                phone: phoneNumber || undefined,
                accountType: accountType === 'Hotspot' ? 'PERSONAL' : accountType.toUpperCase(),
                serviceType: accountType === 'Hotspot' ? 'HOTSPOT' : (enablePPPoE ? 'PPPOE' : 'HOTSPOT'),
                password: loginPassword,
                status: activateNow ? 'ACTIVE' : 'INACTIVE',
            });
            onSave?.({}); // notify parent to refresh list
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to create client');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon">
                            <PersonAddIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Add New Client</div>
                            <div className="modal-subtitle">Create a new customer account</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                {/* Body */}
                <div className="modal-body">
                    {/* Error display */}
                    {error && (
                        <div style={{
                            background: '#fee2e2', color: '#dc2626', padding: '10px 14px',
                            borderRadius: 8, marginBottom: 16, fontSize: '0.82rem', fontWeight: 500,
                            border: '1px solid #fecaca'
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Client Information */}
                    <div className="form-section-title">
                        <SettingsIcon fontSize="small" /> Client Information
                    </div>

                    <div className="form-row-3">
                        <div className="form-group">
                            <label className="form-label">
                                Username <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={username}
                                readOnly
                            />
                            <div className="form-hint">Unique identifier for login</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">
                                Full Name <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Enter client's full name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                            <div className="form-hint">Client's complete name</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">
                                Account Type <span className="required">*</span>
                            </label>
                            <select
                                className="form-select"
                                value={accountType}
                                onChange={(e) => setAccountType(e.target.value)}
                            >
                                <option value="Personal">Personal</option>
                                <option value="Business">Business</option>
                                <option value="Hotspot">Hotspot</option>
                            </select>
                            <div className="form-hint">Billing type and plans</div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="client@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <div className="form-hint">For notifications and resets</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone Number</label>
                            <div className="phone-input">
                                <span className="phone-prefix">255</span>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Phone number"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                />
                            </div>
                            {/* Phone validation error */}
                            {phoneError
                                ? <div className="form-hint" style={{ color: 'var(--danger)' }}>{phoneError}</div>
                                : <div className="form-hint">For SMS notifications</div>
                            }
                        </div>
                    </div>

                    {/* Password Configuration */}
                    <div className="form-section-title">
                        <KeyIcon fontSize="small" /> Password Configuration
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Login Password</label>
                            <div className="toggle" onClick={() => setAutoGenPassword(!autoGenPassword)}>
                                <div className={`toggle-switch ${autoGenPassword ? 'active' : ''}`} />
                                <span className="toggle-label">Auto-generate password</span>
                            </div>
                            <div className="password-field" style={{ marginTop: 10 }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    readOnly={autoGenPassword}
                                />
                                <button className="password-refresh-btn" onClick={handleRefreshPassword}>
                                    <RefreshIcon fontSize="small" />
                                </button>
                            </div>
                            <div className="form-hint">For customer portal login</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">PPPoE Password (Optional)</label>
                            <div className="toggle" onClick={() => setEnablePPPoE(!enablePPPoE)}>
                                <div className={`toggle-switch ${enablePPPoE ? 'active' : ''}`} />
                                <span className="toggle-label">Enable separate PPPoE password</span>
                            </div>
                            <div className="password-field" style={{ marginTop: 10 }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder=""
                                    value={pppoePassword}
                                    onChange={(e) => setPppoePassword(e.target.value)}
                                    disabled={!enablePPPoE}
                                />
                                <button className="password-refresh-btn" disabled={!enablePPPoE}>
                                    <RefreshIcon fontSize="small" />
                                </button>
                            </div>
                            <div className="form-hint">For PPPoE connection (uses login password if empty)</div>
                        </div>
                    </div>

                    {/* Service Activation */}
                    <div className="form-section-title">
                        <PowerSettingsNewIcon fontSize="small" /> Service Activation
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div className="toggle" onClick={() => setActivateNow(!activateNow)}>
                            <div className={`toggle-switch ${activateNow ? 'active' : ''}`} />
                            <span className="toggle-label">Activate Now</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <div className="modal-footer-left">
                        Fields marked with <span style={{ color: 'var(--primary)' }}>*</span> are required
                    </div>
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={loading || !fullName || !!phoneError}>
                            <CheckIcon fontSize="small" /> {loading ? 'Creating...' : 'Create Client'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
