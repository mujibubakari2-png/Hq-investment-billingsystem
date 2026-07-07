import { useState } from 'react';
import { generateMikrotikScript } from '../utils/mikrotikScriptGenerator';
import { sanitizeMikroTikName } from '../utils/mikrotikUtils';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { getPublicApiBase } from '../utils/config';
import type { Router } from '../types';

interface MikrotikScriptModalProps {
    router: Router;
    onClose: () => void;
}

export default function MikrotikScriptModal({ router, onClose }: MikrotikScriptModalProps) {
    const [copied, setCopied] = useState(false);

    // Generate router ID code - handle both numeric IDs and UUIDs
    const generateRouterIdCode = (id: string): string => {
        // If it's a numeric ID, pad it; if it's a UUID, use first 8 chars
        const numericId = parseInt(id, 10);
        if (!isNaN(numericId)) {
            return `MYR-${String(numericId).padStart(3, '0')}VBHBC`;
        }
        // For UUIDs or other formats, extract alphanumeric prefix
        const prefix = id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
        return `MYR-${prefix}VBHBC`;
    };

    const routerIdCode = generateRouterIdCode(router.id);

    const publicApiBase = getPublicApiBase();

    // Extract hostname from the resolved base URL for RADIUS / walled-garden
    const apiHost = publicApiBase.startsWith('http')
        ? new URL(publicApiBase).hostname
        : window.location.hostname;

    // Safely generate the MikroTik script. The generator throws when
    // required LAN/pool/DNS fields are missing; catch and surface a
    // friendly message instead of letting the modal crash.
    let mikrotikScript = '';
    let generationError: string | null = null;
    try {
        mikrotikScript = generateMikrotikScript({
            routerName: router.name,
            routerUsername: router.username,
            routerPassword: router.password,
            routerId: routerIdCode,
            apiHost,
            publicApiBase,
            isWireGuard: false,
            lanIp: router.lanIp,
            lanGateway: router.lanGateway,
            hotspotPoolRange: router.hotspotPoolRange,
            pppoePoolRange: router.pppoePoolRange,
            dns: router.dns,
            radiusSecret: router.radiusSecret,
        });
    } catch (err: any) {
        generationError = err?.message || String(err);
        mikrotikScript = `/* ${generationError} */`;
    }

    const handleCopy = () => {
        if (generationError) { alert(generationError); return; }
        navigator.clipboard.writeText(mikrotikScript);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleDownload = () => {
        if (generationError) { alert(generationError); return; }
        const blob = new Blob([mikrotikScript], { type: 'text/plain' });
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
                            <div style={{ fontSize: '0.8rem', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{router.name} — {routerIdCode}</div>
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
                    <span>This script auto-configures your MikroTik router for HQInvestment ISP billing. Paste into <strong>Terminal</strong> or upload as <strong>.rsc</strong> file.</span>
                </div>

                {/* Script Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 16px' }}>
                    <pre style={{
                        background: '#1e1e2e', color: '#cdd6f4',
                        padding: 20, borderRadius: 10, fontSize: '0.78rem',
                        lineHeight: 1.6, fontFamily: "'Fira Code', 'Consolas', monospace",
                        overflow: 'auto', marginTop: 16, whiteSpace: 'pre-wrap',
                        border: '1px solid #313244',
                    }}>
                        {mikrotikScript}
                    </pre>
                </div>

                {/* Footer */}
                <div className="modal-footer">
                    <div className="modal-footer-left" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        💡 Run in MikroTik → System → Terminal
                    </div>
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {copied ? <CheckCircleIcon style={{ fontSize: 16, color: '#16a34a' }} /> : <ContentCopyIcon style={{ fontSize: 16 }} />}
                            {copied ? 'Copied!' : 'Copy Script'}
                        </button>
                        <button className="btn" style={{ background: '#4338ca', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleDownload}>
                            <DownloadIcon style={{ fontSize: 16 }} /> Download .rsc
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
