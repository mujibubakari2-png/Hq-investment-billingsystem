import { useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { PUBLIC_API_BASE } from '../utils/config';
import type { Router } from '../types';

interface MikrotikScriptModalProps {
    router: Router;
    onClose: () => void;
}

export default function MikrotikScriptModal({ router, onClose }: MikrotikScriptModalProps) {
    const [copied, setCopied] = useState(false);

    // Sanitize router name for use in RouterOS scripts (remove special chars that could break scripts)
    const sanitizeForScript = (name: string): string => {
        return name.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').toLowerCase();
    };

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
    const safeRouterName = sanitizeForScript(router.name);
    const displayRouterName = router.name.replace(/"/g, '\\"'); // Escape quotes for display

    const mikrotikScript = `# ═══════════════════════════════════════════════════════════════
# HQINVESTMENT ISP Billing - MikroTik Auto-Configuration Script
# Router: ${router.name}
# ID: ${routerIdCode}
# Generated: ${new Date().toISOString().split('T')[0]}
# ═══════════════════════════════════════════════════════════════

# ── 1. System Identity ────────────────────────────────────────
/system identity set name="${displayRouterName}"

# ── 2. Hotspot Server Setup ───────────────────────────────────
:if ([:len [/ip hotspot profile find name="hsprof-${safeRouterName}"]] = 0) do={
    /ip hotspot profile add name="hsprof-${safeRouterName}" hotspot-address=10.116.0.2 dns-name="${safeRouterName}.hotspot" \\
        html-directory=hotspot login-by=http-chap,http-pap,cookie,mac-cookie \\
        http-cookie-lifetime=3d
}

:if ([:len [/ip pool find name="hs-pool-${safeRouterName}"]] = 0) do={
    /ip pool add name="hs-pool-${safeRouterName}" ranges=10.116.0.3-10.116.0.254
}

:if ([:len [/ip hotspot find name="hotspot-${safeRouterName}"]] = 0) do={
    /ip hotspot add name="hotspot-${safeRouterName}" interface=ether2 address-pool="hs-pool-${safeRouterName}" \\
        profile="hsprof-${safeRouterName}" disabled=no
}

# Ensure ALL existing hotspots use this new profile so the login page works everywhere
/ip hotspot set [find] profile="hsprof-${safeRouterName}"

# ── 3. PPPoE Server Setup ─────────────────────────────────────
:if ([:len [/ip pool find name="pppoe-pool-${safeRouterName}"]] = 0) do={
    /ip pool add name="pppoe-pool-${safeRouterName}" ranges=10.116.0.3-10.116.0.254
}

:if ([:len [/ppp profile find name="pppoe-profile-${safeRouterName}"]] = 0) do={
    /ppp profile add name="pppoe-profile-${safeRouterName}" local-address=10.116.0.2 remote-address="pppoe-pool-${safeRouterName}" dns-server=8.8.8.8,1.1.1.1 use-encryption=yes
}

:if ([:len [/interface pppoe-server server find service-name="pppoe-svc-${safeRouterName}"]] = 0) do={
    /interface pppoe-server server add service-name="pppoe-svc-${safeRouterName}" interface=ether1 default-profile="pppoe-profile-${safeRouterName}" disabled=no
}

# ── 4. DHCP Server ───────────────────────────────────────────
:if ([:len [/ip address find address="10.116.0.2/24"]] = 0) do={
    /ip address add address=10.116.0.2/24 interface=ether2
}

:if ([:len [/ip dhcp-server network find address="10.116.0.0/24"]] = 0) do={
    /ip dhcp-server network add address=10.116.0.0/24 gateway=10.116.0.2 dns-server=10.116.0.2
}

:if ([:len [/ip dhcp-server find name="dhcp-${safeRouterName}"]] = 0) do={
    /ip dhcp-server add name="dhcp-${safeRouterName}" interface=ether2 address-pool="hs-pool-${safeRouterName}" disabled=no
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
add chain=input protocol=tcp dst-port=80 action=accept comment="Allow RouterOS API (HTTP)"
add chain=input protocol=tcp dst-port=443 action=accept comment="Allow RouterOS API (HTTPS)"
add chain=input action=drop comment="Drop all other input"

# ── 8. RADIUS Client (HQInvestment ISP Billing) ───────────────────────
/radius
add service=hotspot,ppp address=${window.location.hostname} secret=hqinvestment-radius-secret \\
    authentication-port=1812 accounting-port=1813

/ip hotspot profile set "hsprof-${safeRouterName}" use-radius=yes radius-accounting=yes
/ppp profile set "pppoe-profile-${safeRouterName}" use-radius=yes

# ── 9. Walled Garden (Allow billing portal) ──────────────────
/ip hotspot walled-garden
add dst-host="${window.location.hostname}" action=allow comment="Billing Portal"
/ip hotspot walled-garden ip
add dst-address="${window.location.hostname}" action=accept comment="Billing Portal IP"

# ── 10. System Scheduler (Auto-sync with HQInvestment) ───────────────────
/system scheduler
:if ([:len [find name="billing-sync"]] > 0) do={ remove [find name="billing-sync"] }
add name="billing-sync" interval=5m on-event="/tool fetch url=\\"${PUBLIC_API_BASE}/api/sync/${routerIdCode}\\"" \\
    start-time=startup

# ── 11. Logging ──────────────────────────────────────────────
/system logging
add topics=hotspot action=memory
add topics=radius action=memory
add topics=pppoe action=memory

# ═══════════════════════════════════════════════════════════════
# ✅ Script Complete! Router "${router.name}" is configured.
# Both Hotspot & PPPoE servers are set up.
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
