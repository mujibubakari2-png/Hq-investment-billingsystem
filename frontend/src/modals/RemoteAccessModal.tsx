import { useState } from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LanguageIcon from '@mui/icons-material/Language';
import RouterIcon from '@mui/icons-material/Router';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import type { Router } from '../types';

interface RemoteAccessModalProps {
    router: Router;
    onClose: () => void;
}

export default function RemoteAccessModal({ router, onClose }: RemoteAccessModalProps) {
    const [showPassword, setShowPassword] = useState(false);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Remote Access - {router.name}</h2>
                    <button className="btn-icon" onClick={onClose}><CloseIcon /></button>
                </div>
                <div className="modal-body">
                    <div style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Use the credentials below to access your Mikrotik router remotely.
                    </div>

                    {/* WebFig Access */}
                    <div style={{
                        border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                        padding: 16, marginBottom: 16, background: 'var(--bg-surface)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <LanguageIcon style={{ color: '#4338ca', fontSize: 18 }} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem', color: '#1e1b4b' }}>WebFig (HTTP)</h3>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Access router configuration via web browser</div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                            <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#334155' }}>
                                http://{router.host}
                            </div>
                            <a href={`http://${router.host}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ background: '#4338ca', color: '#fff', textDecoration: 'none', padding: '6px 12px', fontSize: '0.8rem' }}>
                                Open WebFig
                            </a>
                        </div>
                    </div>

                    {/* Winbox Access */}
                    <div style={{
                        border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                        padding: 16, background: 'var(--bg-surface)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <RouterIcon style={{ color: '#be185d', fontSize: 18 }} />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1rem', color: '#831843' }}>Winbox Access</h3>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Connect using the desktop application</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Connect To (IP/Host)</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#334155' }}>{router.host}</div>
                                </div>
                                <button className="btn-icon" onClick={() => handleCopy(router.host)}><ContentCopyIcon style={{ fontSize: 16 }} /></button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Login</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#334155' }}>{router.username || 'admin'}</div>
                                </div>
                                <button className="btn-icon" onClick={() => handleCopy(router.username || 'admin')}><ContentCopyIcon style={{ fontSize: 16 }} /></button>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Password</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: '#334155', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {showPassword ? (router.password || '') : '••••••••'}
                                        <button
                                            onClick={() => setShowPassword(!showPassword)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-secondary)' }}
                                            title={showPassword ? "Hide Password" : "Show Password"}
                                        >
                                            {showPassword ? <VisibilityOffIcon style={{ fontSize: 16 }} /> : <VisibilityIcon style={{ fontSize: 16 }} />}
                                        </button>
                                    </div>
                                </div>
                                <button className="btn-icon" onClick={() => handleCopy(router.password || '')}><ContentCopyIcon style={{ fontSize: 16 }} /></button>
                            </div>
                        </div>

                        <div style={{ marginTop: 12, textAlign: 'center' }}>
                            <a href={`winbox://${router.username || 'admin'}:${router.password || ''}@${router.host}`} className="btn" style={{ background: '#be185d', color: '#fff', textDecoration: 'none', width: '100%', justifyContent: 'center', display: 'flex' }}>
                                Launch Winbox App
                            </a>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                                Note: This requires Winbox to be installed and associated with the winbox:// protocol.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
