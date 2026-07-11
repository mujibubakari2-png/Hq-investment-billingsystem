/**
 * RouterDiagnosticsModal
 * A live diagnostic checklist for MikroTik routers based on the 20-cause RCA.
 */

import { useState, useEffect, useCallback } from 'react';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SyncIcon from '@mui/icons-material/Sync';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import BugReportIcon from '@mui/icons-material/BugReport';
import type { Router } from '../types';
import { routersApi } from '../api';

interface DiagnosticCheck {
    id: string;
    category: string;
    label: string;
    description: string;
    status: 'pass' | 'fail' | 'warn' | 'unknown';
    detail?: string;
    fixCommand?: string;
}

interface RouterDiagnosticsModalProps {
    router: Router;
    onClose: () => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
    Bridge:   { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
    DHCP:     { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    Firewall: { bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
    Wireless: { bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' },
    Hotspot:  { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
    RADIUS:   { bg: '#fdf4ff', color: '#86198f', border: '#f0abfc' },
    Logging:  { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
    Network:  { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' },
};

function StatusIcon({ status }: { status: DiagnosticCheck['status'] }) {
    if (status === 'pass')    return <CheckCircleIcon style={{ fontSize: 18, color: '#16a34a' }} />;
    if (status === 'fail')    return <CancelIcon      style={{ fontSize: 18, color: '#dc2626' }} />;
    if (status === 'warn')    return <HelpOutlineIcon style={{ fontSize: 18, color: '#d97706' }} />;
    return <SyncIcon style={{ fontSize: 18, color: '#9ca3af', animation: 'spin 1s linear infinite' }} />;
}

function buildDiagnostics(data: Record<string, unknown>): DiagnosticCheck[] {
    const has = (k: string) => Boolean(data[k]);
    const val = (k: string) => data[k] as string | undefined;

    return [
        // -- BRIDGE ------------------------------------------------
        { id: 'bridge-exists', category: 'Bridge', label: 'Bridge interface exists',
          description: 'A LAN bridge must exist for DHCP and hotspot to function.',
          status: has('bridge') ? 'pass' : 'fail',
          detail: has('bridge') ? `Bridge: ${val('bridge')}` : 'No bridge found on router.',
          fixCommand: ':if ([:len [/interface bridge find]] = 0) do={ /interface bridge add name=bridge-lan protocol-mode=none arp=enabled vlan-filtering=no comment="HQInvestment LAN" }' },

        { id: 'bridge-arp', category: 'Bridge', label: 'Bridge ARP mode = enabled',
          description: 'reply-only ARP blocks dynamic DHCP leases from working.',
          status: val('bridgeArp') === 'enabled' ? 'pass' : val('bridgeArp') ? 'fail' : 'unknown',
          detail: val('bridgeArp') ? `ARP mode: ${val('bridgeArp')}` : 'Could not determine ARP mode.',
          fixCommand: '/interface bridge set [find] arp=enabled' },

        { id: 'bridge-stp', category: 'Bridge', label: 'STP disabled (protocol-mode=none)',
          description: 'STP blocks ports for 30-50 seconds — clients time out before getting IP.',
          status: val('bridgeStp') === 'none' ? 'pass' : val('bridgeStp') ? 'fail' : 'unknown',
          detail: val('bridgeStp') ? `STP mode: ${val('bridgeStp')}` : 'Unknown STP state.',
          fixCommand: '/interface bridge set [find] protocol-mode=none' },

        { id: 'bridge-vlan', category: 'Bridge', label: 'VLAN filtering disabled',
          description: 'VLAN filtering drops untagged client traffic silently.',
          status: val('vlanFiltering') === 'no' ? 'pass' : val('vlanFiltering') === 'yes' ? 'fail' : 'unknown',
          detail: val('vlanFiltering') ? `VLAN filtering: ${val('vlanFiltering')}` : 'Unknown.',
          fixCommand: '/interface bridge set [find] vlan-filtering=no' },

        { id: 'wlan-in-bridge', category: 'Bridge', label: 'wlan1 is a bridge port member',
          description: 'wlan1 not in bridge = WiFi clients cannot reach DHCP.',
          status: has('wlanInBridge') ? 'pass' : 'fail',
          detail: has('wlanInBridge') ? 'wlan1 is in bridge ?' : 'wlan1 NOT a bridge port member.',
          fixCommand: ':if ([:len [/interface bridge port find where interface=wlan1]] = 0) do={\n    /interface bridge port add interface=wlan1 bridge=[/interface bridge get [find] name] edge=yes\n}' },

        { id: 'wlan-bridge-mode', category: 'Bridge', label: 'wlan1 bridge-mode=enabled',
          description: 'Client isolation active when bridge-mode disabled — blocks DHCP broadcasts.',
          status: val('wlanBridgeMode') === 'enabled' ? 'pass' : val('wlanBridgeMode') ? 'fail' : 'unknown',
          detail: val('wlanBridgeMode') ? `bridge-mode: ${val('wlanBridgeMode')}` : 'Unknown.',
          fixCommand: '/interface wireless set [find default-name=wlan1] bridge-mode=enabled' },

        // -- DHCP --------------------------------------------------
        { id: 'dhcp-server', category: 'DHCP', label: 'DHCP server running',
          description: 'No DHCP server = "Couldn\'t get IP address" on all clients.',
          status: has('dhcpRunning') ? 'pass' : 'fail',
          detail: has('dhcpRunning') ? 'DHCP server enabled ?' : 'DHCP server not found or disabled.',
          fixCommand: '/ip dhcp-server enable [find disabled=yes]' },

        { id: 'dhcp-network', category: 'DHCP', label: 'DHCP network gateway configured',
          description: 'Without gateway in DHCP network, clients cannot route traffic.',
          status: has('dhcpGateway') ? 'pass' : 'fail',
          detail: has('dhcpGateway') ? `Gateway: ${val('dhcpGateway')}` : 'No DHCP network gateway found.',
          fixCommand: '/ip dhcp-server network print\n/ip dhcp-server network set [find] gateway=<bridge-IP> dns-server=8.8.8.8,1.1.1.1' },

        { id: 'dhcp-pool', category: 'DHCP', label: 'IP pool not exhausted',
          description: 'Exhausted pool = new clients get "Couldn\'t get IP address".',
          status: val('poolExhausted') === 'no' ? 'pass' : val('poolExhausted') === 'yes' ? 'fail' : 'unknown',
          detail: val('poolExhausted') === 'yes' ? '?? IP pool is FULL!' : 'Pool has free addresses.',
          fixCommand: '/ip pool set [find] ranges=192.168.88.10-192.168.88.250\n/ip dhcp-server set [find] lease-time=1h' },

        // -- FIREWALL ----------------------------------------------
        { id: 'nat-masquerade', category: 'Firewall', label: 'NAT masquerade rule exists',
          description: 'Without NAT, client traffic cannot reach the internet.',
          status: has('natMasquerade') ? 'pass' : 'fail',
          detail: has('natMasquerade') ? 'Masquerade rule found ?' : 'No srcnat masquerade rule.',
          fixCommand: ':if ([:len [/ip firewall nat find action=masquerade]] = 0) do={\n    /ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade\n}' },

        { id: 'dhcp-firewall-accept', category: 'Firewall', label: 'DHCP UDP 67/68 allowed (before drops)',
          description: 'Drop rule before DHCP accept silently discards all DHCP packets.',
          status: has('dhcpFirewallAccept') ? 'pass' : 'warn',
          detail: has('dhcpFirewallAccept') ? 'DHCP accept rule found ?' : 'No explicit DHCP accept rule found.',
          fixCommand: ':if ([:len [/ip firewall filter find where comment="Allow DHCP input - HQInvestment"]] = 0) do={\n    /ip firewall filter add place-before=0 chain=input protocol=udp dst-port=67,68 action=accept comment="Allow DHCP input - HQInvestment"\n}' },

        { id: 'mss-clamp', category: 'Firewall', label: 'MSS clamping (mangle) rule exists',
          description: 'Without MSS clamping, HTTPS/large downloads silently fail on PPPoE/WAN.',
          status: has('mssClamp') ? 'pass' : 'warn',
          detail: has('mssClamp') ? 'MSS clamp rule found ?' : 'No MSS clamp — HTTPS issues may occur.',
          fixCommand: ':if ([:len [/ip firewall mangle find where comment="MSS Clamp - HQInvestment"]] = 0) do={\n    /ip firewall mangle add chain=forward protocol=tcp tcp-flags=syn action=change-mss new-mss=clamp-to-pmtu passthrough=yes comment="MSS Clamp - HQInvestment"\n}' },

        // -- WIRELESS ----------------------------------------------
        { id: 'wlan-enabled', category: 'Wireless', label: 'wlan1 interface is enabled',
          description: 'Disabled wlan1 = no WiFi clients can connect.',
          status: val('wlanEnabled') === 'no' ? 'fail' : val('wlanEnabled') === 'yes' ? 'pass' : 'unknown',
          detail: val('wlanEnabled') ? `wlan1 disabled: ${val('wlanEnabled')}` : 'Unknown.',
          fixCommand: '/interface wireless enable [find default-name=wlan1]' },

        { id: 'wlan-security', category: 'Wireless', label: 'Wireless security profile configured',
          description: 'Missing WPA2 profile causes 4-way handshake failure — clients disconnect at L2.',
          status: has('wlanSecProfile') ? 'pass' : 'warn',
          detail: has('wlanSecProfile') ? `Security profile: ${val('wlanSecProfile')}` : 'No custom security profile.',
          fixCommand: ':if ([:len [/interface wireless security-profiles find name="hq-wifi-sec"]] = 0) do={\n    /interface wireless security-profiles add name="hq-wifi-sec" mode=dynamic-keys authentication-types=wpa2-psk wpa2-pre-shared-key="ChangeMe2026!"\n}\n/interface wireless set [find default-name=wlan1] security-profile="hq-wifi-sec"' },

        // -- HOTSPOT -----------------------------------------------
        { id: 'hotspot-server', category: 'Hotspot', label: 'Hotspot server enabled',
          description: 'Disabled hotspot = no clients can authenticate through billing.',
          status: has('hotspotEnabled') ? 'pass' : 'fail',
          detail: has('hotspotEnabled') ? 'Hotspot enabled ?' : 'Hotspot server not found or disabled.',
          fixCommand: '/ip hotspot enable [find disabled=yes]' },

        { id: 'hotspot-ip-binding', category: 'Hotspot', label: 'No blocked IP bindings',
          description: 'A "blocked" IP binding prevents that client MAC from getting any IP.',
          status: val('blockedBindings') === '0' ? 'pass' : val('blockedBindings') ? 'warn' : 'unknown',
          detail: val('blockedBindings') && val('blockedBindings') !== '0' ? `?? ${val('blockedBindings')} blocked IP bindings!` : 'No blocked bindings.',
          fixCommand: '/ip hotspot ip-binding print where type=blocked\n/ip hotspot ip-binding remove [find type=blocked]' },

        // -- RADIUS ------------------------------------------------
        { id: 'radius-reachable', category: 'RADIUS', label: 'RADIUS server reachable',
          description: 'Unreachable RADIUS = all clients fail auth causing rapid connect/disconnect loops.',
          status: val('radiusStatus') === 'reachable' ? 'pass' : val('radiusStatus') ? 'fail' : 'unknown',
          detail: val('radiusStatus') ? `RADIUS: ${val('radiusStatus')}` : 'RADIUS status unknown.',
          fixCommand: '/radius print\n/radius monitor [find]\n/tool ping [/radius get [find] address] count=4' },

        // -- LOGGING -----------------------------------------------
        { id: 'logging-dhcp', category: 'Logging', label: 'DHCP logging enabled',
          description: 'Without DHCP logs, "no IP" issues cannot be diagnosed.',
          status: has('logDhcp') ? 'pass' : 'warn',
          detail: has('logDhcp') ? 'DHCP logging active ?' : 'DHCP logging not enabled.',
          fixCommand: ':if ([:len [/system logging find topics=dhcp]] = 0) do={ /system logging add topics=dhcp action=memory }' },

        { id: 'logging-wireless', category: 'Logging', label: 'Wireless logging enabled',
          description: 'Wireless logs reveal L2 disconnect reasons.',
          status: has('logWireless') ? 'pass' : 'warn',
          detail: has('logWireless') ? 'Wireless logging active ?' : 'Wireless logging not enabled.',
          fixCommand: ':if ([:len [/system logging find topics=wireless]] = 0) do={ /system logging add topics=wireless action=memory }' },

        // -- NETWORK -----------------------------------------------
        { id: 'default-route', category: 'Network', label: 'Default route (0.0.0.0/0) exists',
          description: 'Without a default route, no internet traffic is possible.',
          status: has('defaultRoute') ? 'pass' : 'fail',
          detail: has('defaultRoute') ? `Default route via ${val('defaultGateway')}` : 'No default route found!',
          fixCommand: '/ip route add dst-address=0.0.0.0/0 gateway=<ISP-GATEWAY-IP>' },

        { id: 'dns-configured', category: 'Network', label: 'DNS servers configured',
          description: 'Missing DNS = clients get IP but cannot resolve domains.',
          status: has('dnsConfigured') ? 'pass' : 'warn',
          detail: has('dnsConfigured') ? `DNS: ${val('dnsServers')}` : 'No DNS servers configured.',
          fixCommand: '/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes\n/ip dhcp-server network set [find] dns-server=8.8.8.8,1.1.1.1' },
    ];
}

export default function RouterDiagnosticsModal({ router, onClose }: RouterDiagnosticsModalProps) {
    const [checks, setChecks]     = useState<DiagnosticCheck[]>([]);
    const [loading, setLoading]   = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const runDiagnostics = useCallback(async () => {
        setLoading(true);
        try {
            const connResult = await routersApi.testConnection(router.id) as {
                success?: boolean;
                diagnostics?: Record<string, unknown>;
            };
            const raw: Record<string, unknown> = { ...(connResult?.diagnostics || {}) };
            if (connResult?.success) raw['connected'] = true;
            setChecks(buildDiagnostics(raw));
        } catch {
            setChecks(buildDiagnostics({}));
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => { void runDiagnostics(); }, [runDiagnostics]);

    const handleCopy = (id: string, cmd: string) => {
        navigator.clipboard.writeText(cmd).catch(() => {});
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const categories    = [...new Set(checks.map(c => c.category))];
    const visibleChecks = activeCategory ? checks.filter(c => c.category === activeCategory) : checks;
    const failCount     = checks.filter(c => c.status === 'fail').length;
    const warnCount     = checks.filter(c => c.status === 'warn').length;
    const passCount     = checks.filter(c => c.status === 'pass').length;
    const unknownCount  = checks.filter(c => c.status === 'unknown').length;

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16,
        }}>
            <div style={{
                background: '#fff', borderRadius: 16, width: '100%', maxWidth: 820,
                maxHeight: '92vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 80px rgba(0,0,0,0.25)',
            }}>
                {/* -- Header ------------------------------------------- */}
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <BugReportIcon style={{ color: '#fff', fontSize: 20 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111' }}>Router Diagnostics</div>
                        <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{router.name} — {router.host}</div>
                    </div>
                    {!loading && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {failCount > 0    && <span style={{ padding: '3px 10px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontSize: '0.72rem', fontWeight: 700 }}>? {failCount} Failed</span>}
                            {warnCount > 0    && <span style={{ padding: '3px 10px', borderRadius: 20, background: '#fef3c7', color: '#d97706', fontSize: '0.72rem', fontWeight: 700 }}>?? {warnCount} Warn</span>}
                            {passCount > 0    && <span style={{ padding: '3px 10px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', fontSize: '0.72rem', fontWeight: 700 }}>? {passCount} Pass</span>}
                            {unknownCount > 0 && <span style={{ padding: '3px 10px', borderRadius: 20, background: '#f8fafc', color: '#64748b', fontSize: '0.72rem', fontWeight: 700 }}>? {unknownCount}</span>}
                        </div>
                    )}
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}>
                        <CloseIcon style={{ fontSize: 18, color: '#64748b' }} />
                    </button>
                </div>

                {/* -- Category tabs ------------------------------------ */}
                <div style={{ padding: '10px 24px 0', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9' }}>
                    <button onClick={() => setActiveCategory(null)} style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: 'none', marginBottom: 10, background: !activeCategory ? '#1e293b' : '#f1f5f9', color: !activeCategory ? '#fff' : '#475569' }}>All</button>
                    {categories.map(cat => {
                        const s = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Network'];
                        const isActive = activeCategory === cat;
                        const catFails = checks.filter(c => c.category === cat && c.status === 'fail').length;
                        return (
                            <button key={cat} onClick={() => setActiveCategory(isActive ? null : cat)} style={{ padding: '5px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', marginBottom: 10, border: `1px solid ${isActive ? s.color : s.border}`, background: isActive ? s.color : s.bg, color: isActive ? '#fff' : s.color }}>
                                {cat}{catFails > 0 && <span style={{ marginLeft: 5, background: '#dc2626', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: '0.65rem' }}>{catFails}</span>}
                            </button>
                        );
                    })}
                    <button onClick={runDiagnostics} disabled={loading} style={{ marginLeft: 'auto', marginBottom: 10, padding: '5px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <SyncIcon style={{ fontSize: 13, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        {loading ? 'Checking...' : 'Re-run'}
                    </button>
                </div>

                {/* -- Checks list -------------------------------------- */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 24px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
                            <SyncIcon style={{ fontSize: 32, animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                            <div style={{ fontSize: '0.9rem' }}>Running diagnostic checks...</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {visibleChecks.map(check => {
                                const catStyle = CATEGORY_COLORS[check.category] || CATEGORY_COLORS['Network'];
                                const isFail = check.status === 'fail';
                                const isWarn = check.status === 'warn';
                                return (
                                    <div key={check.id} style={{ border: `1px solid ${isFail ? '#fecaca' : isWarn ? '#fde68a' : '#f1f5f9'}`, borderRadius: 10, padding: '12px 16px', background: isFail ? '#fff5f5' : isWarn ? '#fffbeb' : '#fafafa' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                            <div style={{ paddingTop: 1, flexShrink: 0 }}><StatusIcon status={check.status} /></div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>{check.label}</span>
                                                    <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: '0.65rem', fontWeight: 600, background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}` }}>{check.category}</span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{check.description}</div>
                                                {check.detail && (
                                                    <div style={{ marginTop: 6, fontSize: '0.72rem', fontFamily: 'monospace', color: isFail ? '#dc2626' : isWarn ? '#d97706' : '#16a34a', fontWeight: 600 }}>{check.detail}</div>
                                                )}
                                                {check.fixCommand && (isFail || isWarn) && (
                                                    <div style={{ marginTop: 8 }}>
                                                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fix Command (RouterOS CLI)</div>
                                                        <div style={{ position: 'relative', background: '#1e293b', borderRadius: 6, padding: '8px 44px 8px 12px', fontFamily: 'monospace', fontSize: '0.7rem', color: '#86efac', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                            {check.fixCommand}
                                                            <button onClick={() => handleCopy(check.id, check.fixCommand!)} style={{ position: 'absolute', top: 6, right: 6, background: copiedId === check.id ? '#16a34a' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer', color: '#fff', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 3, transition: 'all 0.15s' }} title="Copy">
                                                                <ContentCopyIcon style={{ fontSize: 11 }} />
                                                                {copiedId === check.id ? 'Copied!' : 'Copy'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* -- Footer ------------------------------------------- */}
                <div style={{ padding: '12px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa', borderRadius: '0 0 16px 16px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        ?? Run fix commands in <strong>WinBox Terminal</strong> or <strong>SSH</strong>. Re-run after applying.
                    </div>
                    <button onClick={onClose} style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>Close</button>
                </div>
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
