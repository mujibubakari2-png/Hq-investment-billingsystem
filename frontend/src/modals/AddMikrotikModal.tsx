import { useState } from 'react';
import RouterIcon from '@mui/icons-material/Router';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

interface AddMikrotikModalProps {
    onClose: () => void;
    onSave?: (data: object) => void;
}

export default function AddMikrotikModal({ onClose, onSave }: AddMikrotikModalProps) {
    const [name, setName] = useState('');
    const [host, setHost] = useState('');
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [port, setPort] = useState('8728');
    const [showPass, setShowPass] = useState(false);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

    const handleTest = () => {
        setTestStatus('testing');
        setTimeout(() => setTestStatus('success'), 1500);
    };

    const handleSave = () => {
        if (onSave) onSave({ name, host, username, password, port: Number(port) });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon">
                            <RouterIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Add MikroTik Router</div>
                            <div className="modal-subtitle">Connect a new MikroTik device</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">Router Name <span className="required">*</span></label>
                        <input type="text" className="form-input" placeholder="e.g., MAIN-ROUTER-01" value={name} onChange={e => setName(e.target.value)} />
                        <div className="form-hint">Friendly name to identify this router</div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">IP Address / Host <span className="required">*</span></label>
                            <input type="text" className="form-input" placeholder="192.168.88.1" value={host} onChange={e => setHost(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">API Port</label>
                            <input type="number" className="form-input" value={port} onChange={e => setPort(e.target.value)} />
                            <div className="form-hint">Default: 8728 (unencrypted), 8729 (SSL)</div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Username <span className="required">*</span></label>
                            <input type="text" className="form-input" placeholder="admin" value={username} onChange={e => setUsername(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password <span className="required">*</span></label>
                            <div className="password-field">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="Router password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                                <button className="password-refresh-btn" onClick={() => setShowPass(!showPass)}>
                                    {showPass ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {testStatus !== 'idle' && (
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-sm)',
                            marginTop: 8,
                            background: testStatus === 'success' ? 'var(--secondary-light)' : testStatus === 'failed' ? 'var(--danger-light)' : 'var(--info-light)',
                            color: testStatus === 'success' ? 'var(--secondary)' : testStatus === 'failed' ? 'var(--danger)' : 'var(--info)',
                            fontSize: '0.85rem',
                        }}>
                            {testStatus === 'testing' && '⏳ Testing connection...'}
                            {testStatus === 'success' && '✓ Connection successful!'}
                            {testStatus === 'failed' && '✗ Connection failed. Check credentials.'}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left">
                        <button className="btn btn-secondary" onClick={handleTest} disabled={!host || testStatus === 'testing'}>
                            Test Connection
                        </button>
                    </div>
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={!name || !host || !username || !password}>
                            <CheckIcon fontSize="small" /> Add Router
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
