import { useState, useEffect } from 'react';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { generatePassword } from '../utils/formatters';
import { getPhoneError } from '../utils/validators';
import { useAuth } from '../stores/authStore';

interface AddSystemUserModalProps {
    onClose: () => void;
    onSave?: (data: object) => void;
}

export default function AddSystemUserModal({ onClose, onSave }: AddSystemUserModalProps) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState('Agent');
    const [password, setPassword] = useState(generatePassword());
    const [showPass, setShowPass] = useState(false);
    const [active, setActive] = useState(true);
    const [loading, setLoading] = useState(false);

    //  Get current user to check if they're a SUPER_ADMIN
    const { user: currentUser } = useAuth();

    // ESC key handler
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const phoneError = getPhoneError(phone);

    const handleSave = () => {
        setLoading(true);
        if (onSave) onSave({ username, email, phone, role, password, status: active ? 'Active' : 'Inactive' });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon">
                            <AdminPanelSettingsIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Add System User</div>
                            <div className="modal-subtitle">Create an administrator or agent account</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Username <span className="required">*</span></label>
                            <input type="text" className="form-input" placeholder="e.g., agent_john" value={username} onChange={e => setUsername(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Role <span className="required">*</span></label>
                            <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                                {/* Only show Super Admin option to existing SUPER_ADMIN users */}
                                {currentUser?.role === 'SUPER_ADMIN' && <option>Super Admin</option>}
                                <option>Admin</option>
                                <option>Agent</option>
                                <option>Viewer</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Email <span className="required">*</span></label>
                            <input type="email" className="form-input" placeholder="user@company.com" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone Number</label>
                            <input type="text" className="form-input" placeholder="255XXXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} />
                            {/* Phone validation */}
                            {phoneError && <div className="form-hint" style={{ color: 'var(--danger)' }}>{phoneError}</div>}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password <span className="required">*</span></label>
                        <div className="password-field">
                            <input
                                type={showPass ? 'text' : 'password'}
                                className="form-input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <button className="password-refresh-btn" onClick={() => setShowPass(!showPass)}>
                                {showPass ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                            </button>
                            <button className="password-refresh-btn" onClick={() => setPassword(generatePassword())} title="Generate new password">
                                <RefreshIcon fontSize="small" />
                            </button>
                        </div>
                        <div className="form-hint">Minimum 8 characters</div>
                    </div>

                    <div className="form-group">
                        <div className="toggle" onClick={() => setActive(!active)}>
                            <div className={`toggle-switch ${active ? 'active' : ''}`} />
                            <span className="toggle-label">Account Active</span>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left">Fields marked with <span style={{ color: 'var(--primary)' }}>*</span> are required</div>
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={loading || !username || !email || !password || !!phoneError}>
                            <CheckIcon fontSize="small" /> {loading ? 'Creating...' : 'Create User'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
