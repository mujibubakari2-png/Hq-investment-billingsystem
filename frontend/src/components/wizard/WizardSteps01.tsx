/**
 * Step 0 — Download WireGuard script
 * Step 1 — Connection check
 * FE-001: Extracted from RouterSetupWizard.tsx
 */

import FileDownloadIcon from '@mui/icons-material/FileDownload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import CableIcon from '@mui/icons-material/Cable';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { sanitizeMikroTikName } from '../../utils/mikrotikUtils';

// ── Step 0: Download ──────────────────────────────────────────────────────────

interface Step0Props {
    routerName: string;
    wgConfig: any;
}

export function Step0Download({ routerName, wgConfig }: Step0Props) {
    const handleDownload = () => {
        if (!wgConfig) return;
        const subnetAddress = `${wgConfig.routerTunnelIp.split('.').slice(0, 3).join('.')}.0/24`;
        const script = [
            `# WireGuard VPN Setup Script for ${routerName}`,
            `:if ([:len [/interface wireguard find name="wg-hq"]] = 0) do={`,
            `    /interface wireguard add name="wg-hq" listen-port=${wgConfig.listenPort} private-key="${wgConfig.routerPrivateKey}" comment="HQ INVESTMENT VPN Interface"`,
            `} else={`,
            `    /interface wireguard set [find name="wg-hq"] listen-port=${wgConfig.listenPort} private-key="${wgConfig.routerPrivateKey}"`,
            `}`,
            `:if ([:len [/interface wireguard peers find interface="wg-hq" public-key="${wgConfig.serverPublicKey}"]] = 0) do={`,
            `    /interface wireguard peers add interface="wg-hq" public-key="${wgConfig.serverPublicKey}" endpoint-address=${wgConfig.serverEndpoint} endpoint-port=${wgConfig.serverPort} allowed-address=${subnetAddress} persistent-keepalive=25s comment="HQ INVESTMENT ISP Server"`,
            `} else={`,
            `    /interface wireguard peers set [find interface="wg-hq" public-key="${wgConfig.serverPublicKey}"] endpoint-address=${wgConfig.serverEndpoint} endpoint-port=${wgConfig.serverPort} allowed-address=${subnetAddress} persistent-keepalive=25s`,
            `}`,
            `# /24 required for subnet routing — /32 causes server-to-router packet loss`,
            `:foreach addr in=[/ip address find interface="wg-hq"] do={ /ip address remove $addr }`,
            `/ip address add address=${wgConfig.routerTunnelIp}/24 interface="wg-hq" comment="HQ INVESTMENT VPN Address"`,
            `# Firewall Rules for WireGuard`,
            `:if ([:len [/ip firewall filter find comment="Dummy HQ Rule"]] = 0) do={ /ip firewall filter add chain=input action=passthrough comment="Dummy HQ Rule" }`,
            `:if ([:len [/ip firewall filter find where comment="Allow WireGuard - HQ INVESTMENT"]] = 0) do={`,
            `    /ip firewall filter add place-before=0 chain=input action=accept protocol=udp dst-port=${wgConfig.listenPort} comment="Allow WireGuard - HQ INVESTMENT"`,
            `}`,
            `:if ([:len [/ip firewall filter find where comment="Allow API/Winbox from VPN - HQ INVESTMENT"]] = 0) do={`,
            `    /ip firewall filter add place-before=0 chain=input action=accept protocol=tcp dst-port=80,8291 src-address=${subnetAddress} comment="Allow API/Winbox from VPN - HQ INVESTMENT"`,
            `}`,
            `:if ([:len [/ip firewall filter find where comment="Allow RADIUS CoA from VPN - HQ INVESTMENT"]] = 0) do={`,
            `    /ip firewall filter add place-before=0 chain=input action=accept protocol=udp dst-port=3799 src-address=${subnetAddress} comment="Allow RADIUS CoA from VPN - HQ INVESTMENT"`,
            `}`,
            `:if ([:len [/ip firewall filter find where comment="Allow Established - HQ INVESTMENT"]] = 0) do={`,
            `    /ip firewall filter add place-before=0 chain=input connection-state=established,related action=accept comment="Allow Established - HQ INVESTMENT"`,
            `}`,
            `:if ([:len [/ip firewall filter find where comment="Allow Ping - HQ INVESTMENT"]] = 0) do={`,
            `    /ip firewall filter add place-before=0 chain=input protocol=icmp action=accept comment="Allow Ping - HQ INVESTMENT"`,
            `}`,
            `/ip firewall filter remove [find comment="Dummy HQ Rule"]`,
            `:if ([:len [/ip firewall filter find where comment="Drop WAN input - HQ INVESTMENT"]] = 0) do={`,
            `    /ip firewall filter add chain=input in-interface=ether1 action=drop comment="Drop WAN input - HQ INVESTMENT"`,
            `}`,
        ].join('\n');
        const blob = new Blob([script], { type: 'application/octet-stream' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${sanitizeMikroTikName(routerName)}_ovpn_setup.rsc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const safeName = sanitizeMikroTikName(routerName);
    return (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <DownloadIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
            <h2 style={{ marginBottom: 6 }}>Download Initial VPN Setup</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Download and import the VPN configuration script</p>

            <div style={{ maxWidth: 500, margin: '0 auto', padding: 30, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                <InsertDriveFileIcon style={{ fontSize: 48, color: 'var(--text-secondary)', marginBottom: 12 }} />
                <h3 style={{ marginBottom: 4 }}>WireGuard Setup Script</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>
                    Configure WireGuard VPN to connect and register your router
                </p>
                <button className="btn" disabled={!wgConfig} onClick={handleDownload}
                    style={{ background: wgConfig ? '#16a34a' : '#9ca3af', color: '#fff', fontWeight: 600, padding: '10px 24px', borderRadius: 'var(--radius-sm)' }}>
                    <FileDownloadIcon fontSize="small" />
                    {wgConfig ? ` Download ${safeName}_ovpn_setup.rsc` : ' Loading VPN Config...'}
                </button>
            </div>

            <div style={{ maxWidth: 500, margin: '24px auto 0', padding: 20, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <InfoOutlinedIcon style={{ fontSize: 18, color: '#1d4ed8' }} />
                    <strong style={{ fontSize: '0.9rem' }}>Instructions:</strong>
                </div>
                <ol style={{ paddingLeft: 20, margin: 0, fontSize: '0.85rem', color: '#374151', lineHeight: 1.8 }}>
                    <li>Download the RSC file using the button above</li>
                    <li>Connect to your MikroTik router via Winbox</li>
                    <li>Go to <strong>Files</strong> and drag the RSC file to upload it</li>
                    <li>Open <strong>Terminal</strong> and run: <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>/import {safeName}_ovpn_setup.rsc</code></li>
                    <li>Wait for the import to complete</li>
                    <li>Click "Next" when the script has finished</li>
                </ol>
            </div>
        </div>
    );
}

// ── Step 1: Connection ────────────────────────────────────────────────────────

interface Step1Props {
    connectionStatus: 'checking' | 'online' | 'offline';
    connectionError: string | null;
    routerData: any;
    onRetry: () => void;
    onNext: () => void;
    onBack: () => void;
}

export function Step1Connection({ connectionStatus, connectionError, routerData, onRetry, onNext, onBack }: Step1Props) {
    return (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <CableIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
            <h2 style={{ marginBottom: 6 }}>Router Connection Status</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Monitoring router connection to our VPN network</p>

            <div style={{ maxWidth: 500, margin: '0 auto', padding: 40, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                {connectionStatus === 'checking' ? (
                    <>
                        <RefreshIcon className="spin" style={{ fontSize: 56, color: 'var(--primary)', marginBottom: 16 }} />
                        <h3 style={{ color: 'var(--primary)', marginBottom: 6 }}>Checking Connection...</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Please wait while we verify the VPN tunnel status</p>
                    </>
                ) : connectionStatus === 'online' ? (
                    <>
                        <CheckCircleIcon style={{ fontSize: 56, color: '#16a34a', marginBottom: 16 }} />
                        <h3 style={{ color: '#16a34a', marginBottom: 6 }}>Router is Online!</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>VPN connection established successfully</p>
                        <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 24px', borderRadius: 'var(--radius-sm)', marginTop: 24 }} onClick={onNext}>
                            Continue to Service Selection <ArrowForwardIcon fontSize="small" />
                        </button>
                    </>
                ) : (
                    <>
                        <CancelIcon style={{ fontSize: 56, color: 'var(--danger)', marginBottom: 16 }} />
                        <h3 style={{ color: 'var(--danger)', marginBottom: 6 }}>Router is Offline</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
                            {connectionError || 'Could not establish connection to the router.'}
                            {routerData?.host?.startsWith('10.') && (
                                <div style={{ marginTop: 12, padding: 10, background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 6, color: '#c53030', fontSize: '0.82rem', textAlign: 'left' }}>
                                    <strong>VPN Hint:</strong> This router uses a private IP ({routerData.host}).
                                    Ensure your <strong>WireGuard</strong> or <strong>OpenVPN</strong> tunnel is connected on the router.
                                </div>
                            )}
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={onRetry}><RefreshIcon fontSize="small" /> Try Again</button>
                            <button className="btn btn-secondary" onClick={onBack}><ArrowBackIcon fontSize="small" /> Check Instructions</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
