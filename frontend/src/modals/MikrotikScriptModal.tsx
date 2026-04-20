import { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { Router } from '../types';

interface MikrotikScriptModalProps {
    router: Router;
    onClose: () => void;
}

export default function MikrotikScriptModal({ router, onClose }: MikrotikScriptModalProps) {
    const [copied, setCopied] = useState(false);

    const routerIdCode = `MYR-${router.id.padStart(3, '0')}VBHBC`;

    const mikrotikScript = `# ═══════════════════════════════════════════════════════════════
# HQINVESTMENT ISP Billing - MikroTik Auto-Configuration Script
# Router: ${router.name}
# ID: ${routerIdCode}
# Generated: ${new Date().toISOString().split('T')[0]}
# ═══════════════════════════════════════════════════════════════

# ── 1. System Identity ────────────────────────────────────────
/system identity set name="${router.name}"

# ── 2. Hotspot Server Setup ───────────────────────────────────
:if ([:len [/ip hotspot profile find name="hsprof-${router.name}"]] = 0) do={
    /ip hotspot profile add name="hsprof-${router.name}" hotspot-address=192.168.88.1 dns-name="${router.name.toLowerCase().replace(/\s+/g, '-')}.hotspot" \\
        html-directory=hotspot login-by=http-chap,http-pap,cookie,mac-cookie \\
        http-cookie-lifetime=3d
}

:if ([:len [/ip pool find name="hs-pool-${router.name}"]] = 0) do={
    /ip pool add name="hs-pool-${router.name}" ranges=192.168.88.2-192.168.88.254
}

:if ([:len [/ip hotspot find name="hotspot-${router.name}"]] = 0) do={
    /ip hotspot add name="hotspot-${router.name}" interface=ether2 address-pool="hs-pool-${router.name}" \\
        profile="hsprof-${router.name}" disabled=no
}

# ── 3. DHCP Server ───────────────────────────────────────────
:if ([:len [/ip address find address="192.168.88.1/24"]] = 0) do={
    /ip address add address=192.168.88.1/24 interface=ether2
}

:if ([:len [/ip dhcp-server network find address="192.168.88.0/24"]] = 0) do={
    /ip dhcp-server network add address=192.168.88.0/24 gateway=192.168.88.1 dns-server=8.8.8.8,1.1.1.1
}

:if ([:len [/ip dhcp-server find name="dhcp-${router.name}"]] = 0) do={
    /ip dhcp-server add name="dhcp-${router.name}" interface=ether2 address-pool="hs-pool-${router.name}" disabled=no
}

# ── 4. NAT (Masquerade) ──────────────────────────────────────
:if ([:len [/ip firewall nat find action=masquerade chain=srcnat out-interface=ether1]] = 0) do={
    /ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade
}

# ── 5. DNS Settings ──────────────────────────────────────────
/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes

# ── 6. Firewall Rules ────────────────────────────────────────
/ip firewall filter
add chain=input protocol=tcp dst-port=8291 action=accept comment="Allow Winbox"
add chain=input protocol=tcp dst-port=80,443 action=accept comment="Allow Web"
add chain=input protocol=udp dst-port=53,67 action=accept comment="Allow DNS & DHCP"
add chain=input protocol=icmp action=accept comment="Allow Ping"
add chain=input connection-state=established,related action=accept
add chain=input action=drop comment="Drop all other input"

# ── 7. RADIUS Client (HQInvestment ISP Billing) ───────────────────────
/radius
add service=hotspot address=${window.location.hostname} secret=hqinvestment-radius-secret \\
    authentication-port=1812 accounting-port=1813

/ip hotspot profile set "hsprof-${router.name}" use-radius=yes radius-accounting=yes

# ── 8. Walled Garden (Allow billing portal) ──────────────────
/ip hotspot walled-garden
add dst-host="*.${window.location.hostname}" action=allow comment="Billing Portal"

# ── 9. System Scheduler (Auto-sync with HQInvestment) ───────────────────
/system scheduler
add name="billing-sync" interval=5m on-event="/tool fetch url=\\"${(import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '')}/api/sync/${routerIdCode}\\" mode=https" \\
    start-time=startup

# ── 10. Logging ──────────────────────────────────────────────
/system logging
add topics=hotspot action=memory
add topics=radius action=memory

# ═══════════════════════════════════════════════════════════════
# ✅ Script Complete! Router "${router.name}" is configured.
# ═══════════════════════════════════════════════════════════════`;

    const handleCopy = () => {
        navigator.clipboard.writeText(mikrotikScript);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleDownload = () => {
        const blob = new Blob([mikrotikScript], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mikrotik-script-${router.name.toLowerCase().replace(/\s+/g, '-')}.rsc`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 750, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)', color: '#fff',
                    padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <DescriptionIcon />
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>MikroTik Configuration Script</div>
                            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>{router.name} — {routerIdCode}</div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 6, padding: '6px 8px' }}>
                        <CloseIcon fontSize="small" />
                    </button>
                </div>

                {/* Info Banner */}
                <div style={{
                    background: '#eef2ff', padding: '10px 24px', fontSize: '0.82rem', color: '#4338ca',
                    display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #c7d2fe',
                }}>
                    <CheckCircleIcon style={{ fontSize: 16 }} />
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
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 24px', borderTop: '1px solid var(--border-light)', gap: 8,
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        💡 Run in MikroTik → System → Terminal
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
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
