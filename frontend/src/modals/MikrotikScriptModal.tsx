import { useState, useEffect } from 'react';
import { sanitizeMikroTikName } from '../utils/mikrotikUtils';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SyncIcon from '@mui/icons-material/Sync';
import type { Router } from '../types';
import { routersApi } from '../api/networkApi';

interface MikrotikScriptModalProps {
    router: Router;
    onClose: () => void;
}

export default function MikrotikScriptModal({ router, onClose }: MikrotikScriptModalProps) {
    const [copied, setCopied] = useState(false);
    const [script, setScript] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch script from the server-side endpoint — secrets never leave the server.
    // This replaces the legacy client-side generateMikrotikScript() which required
    // router.radiusSecret (and router.password) to be present in browser state.
    useEffect(() => {
        setLoading(true);
        setError(null);
        routersApi.getScript(router.id)
            .then((text: string) => { setScript(text); })
            .catch((err: any) => {
                setError(err?.message || String(err) || 'Failed to generate script. Ensure LAN IP, Gateway, Pool ranges, and DNS are configured on this router first.');
                setScript(null);
            })
            .finally(() => setLoading(false));
    }, [router.id]);


    const handleCopy = () => {
        if (!script) return;
        navigator.clipboard.writeText(script);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleDownload = () => {
        if (!script) return;
        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mikrotik-script-${sanitizeMikroTikName(router.name)}.rsc`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 750 }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="modal-header" style={{
                    background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)', color: '#fff',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <DescriptionIcon style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>MikroTik Configuration Script</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{router.name}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="modal-close" style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                {/* Info Banner */}
                <div style={{
                    background: '#eef2ff', padding: '10px 16px', fontSize: '0.82rem', color: '#4338ca',
                    display: 'flex', alignItems: 'flex-start', gap: 8, borderBottom: '1px solid #c7d2fe', flexWrap: 'wrap',
                }}>
                    <CheckCircleIcon style={{ fontSize: 16, flexShrink: 0, marginTop: 2 }} />
                    <span>This script auto-configures your MikroTik router for HQ INVESTMENT ISP billing. Paste into <strong>Terminal</strong> or upload as <strong>.rsc</strong> file.</span>
                </div>

                {/* Script Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af', fontSize: '0.82rem', marginTop: 24 }}>
                            <SyncIcon style={{ fontSize: 18, animation: 'spin 1s linear infinite' }} /> Generating script on server…
                        </div>
                    ) : error ? (
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '14px 16px', marginTop: 16, fontSize: '0.82rem', color: '#dc2626' }}>
                            {error}
                        </div>
                    ) : (
                        <pre style={{
                            background: '#1e1e2e', color: '#cdd6f4',
                            padding: 20, borderRadius: 10, fontSize: '0.78rem',
                            lineHeight: 1.6, fontFamily: "'Fira Code', 'Consolas', monospace",
                            overflow: 'auto', marginTop: 16, whiteSpace: 'pre-wrap',
                            border: '1px solid #313244',
                        }}>
                            {script}
                        </pre>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <div className="modal-footer-left" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        💡 Run in MikroTik → System → Terminal
                    </div>
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={handleCopy} disabled={!script || loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {copied ? <CheckCircleIcon style={{ fontSize: 16, color: '#16a34a' }} /> : <ContentCopyIcon style={{ fontSize: 16 }} />}
                            {copied ? 'Copied!' : 'Copy Script'}
                        </button>
                        <button className="btn" style={{ background: '#4338ca', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleDownload} disabled={!script || loading}>
                            <DownloadIcon style={{ fontSize: 16 }} /> Download .rsc
                        </button>
                    </div>
                </div>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
