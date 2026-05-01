import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import CableIcon from '@mui/icons-material/Cable';
import DescriptionIcon from '@mui/icons-material/Description';
import VerifiedIcon from '@mui/icons-material/Verified';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WifiIcon from '@mui/icons-material/Wifi';
import DnsIcon from '@mui/icons-material/Dns';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RefreshIcon from '@mui/icons-material/Refresh';
import ListIcon from '@mui/icons-material/List';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LockIcon from '@mui/icons-material/Lock';
import { routersApi, vpnApi } from '../api/client';
import { PUBLIC_API_BASE } from '../utils/config';

const steps = [
    { label: 'Download', sub: 'OVPN Script', icon: <DownloadIcon /> },
    { label: 'Connection', sub: 'Verify Online', icon: <CableIcon /> },
    { label: 'Services', sub: 'Choose Setup', icon: <SettingsIcon /> },
    { label: 'VPN', sub: 'Tunnel Config', icon: <VpnKeyIcon /> },
    { label: 'Interfaces', sub: 'Select Ports', icon: <CableIcon /> },
    { label: 'Generate', sub: 'Create Config', icon: <DescriptionIcon /> },
    { label: 'Verify', sub: 'Check Status', icon: <VerifiedIcon /> },
];

interface EthernetInterface {
    name: string;
    type: string;
    mac: string;
    status: 'Up' | 'Down';
}

interface VpnSecret {
    id?: string;
    username: string;
    password: string;
    protocol: string;
    profile: string;
    localAddress: string;
    remoteAddress: string;
}

interface RouterSetupWizardProps {
    router?: any;
    onClose?: () => void;
}

export default function RouterSetupWizard({ router: routerProp, onClose }: RouterSetupWizardProps = {}) {
    const { id: paramId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [routerData, setRouterData] = useState<any>(routerProp || null);

    const routerId = routerProp?.id || paramId;

    const [interfaces, setInterfaces] = useState<EthernetInterface[]>([]);
    const [loadingInterfaces, setLoadingInterfaces] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const checkConnection = async () => {
        if (!routerId) return;
        setConnectionStatus('checking');
        setConnectionError(null);
        try {
            const res = await routersApi.testConnection(routerId);
            if (res.success) {
                setConnectionStatus('online');
            } else {
                setConnectionStatus('offline');
                setConnectionError(res.message);
            }
        } catch (err: any) {
            setConnectionStatus('offline');
            setConnectionError(err.message || 'Failed to connect');
        }
    };

    const fetchInterfaces = async () => {
        if (!routerId) return;
        setLoadingInterfaces(true);
        try {
            const data = await routersApi.listInterfaces(routerId);
            setInterfaces(data);
        } catch (err) {
            console.error('Failed to fetch interfaces:', err);
        } finally {
            setLoadingInterfaces(false);
        }
    };

    useEffect(() => {
        if (!routerData && routerId) {
            routersApi.get(routerId).then(data => setRouterData(data)).catch(console.error);
        }
    }, [routerId]);

    // Perform check when entering specific steps
    useEffect(() => {
        if (currentStep === 1) {
            checkConnection();
        }
        if (currentStep === 4) {
            fetchInterfaces();
        }
        if (currentStep === 6) {
            // Verification step - test connection again
            setVerifyStatus('checking');
            if (routerId) {
                routersApi.testConnection(routerId)
                    .then(res => setVerifyStatus(res.success ? 'success' : 'failed'))
                    .catch(() => setVerifyStatus('failed'));
            } else {
                setVerifyStatus('failed');
            }
        }
    }, [currentStep]);

    const routerName = routerData?.name || 'Loading...';

    // Step 3 state
    const [serviceType, setServiceType] = useState<'pppoe' | 'hotspot' | 'both'>('pppoe');

    // Step 4 (VPN) state
    const [vpnEnabled, setVpnEnabled] = useState(true);
    const [vpnMode, setVpnMode] = useState<'hybrid' | 'wireguard' | 'openvpn'>('hybrid');
    const [vpnProtocol, setVpnProtocol] = useState('L2TP');
    const [vpnSecrets, setVpnSecrets] = useState<VpnSecret[]>([]);
    const [showAddVpnSecret, setShowAddVpnSecret] = useState(false);
    const [vpnForm, setVpnForm] = useState<VpnSecret>({
        username: '', password: '', protocol: 'L2TP',
        profile: 'default', localAddress: '', remoteAddress: '',
    });
    const [vpnPoolStart, setVpnPoolStart] = useState('10.0.0.2');
    const [vpnPoolEnd, setVpnPoolEnd] = useState('10.0.0.254');
    const [vpnDns, setVpnDns] = useState('8.8.8.8');
    const [ipsecSecret, setIpsecSecret] = useState('MyISPVpnKey2024!');

    // PPPoE & Hotspot IP Settings
    const [pppoeLocalAddress, setPppoeLocalAddress] = useState('10.116.0.2');
    const [pppoePoolStart, setPppoePoolStart] = useState('10.116.0.3');
    const [pppoePoolEnd, setPppoePoolEnd] = useState('10.116.0.254');

    const [hotspotLocalAddress, setHotspotLocalAddress] = useState('10.116.0.2');
    const [hotspotPoolStart, setHotspotPoolStart] = useState('10.116.0.3');
    const [hotspotPoolEnd, setHotspotPoolEnd] = useState('10.116.0.254');

    // ALWAYS use PUBLIC_API_BASE in production. Fallback to import.meta.env.BASE_URL if provided.
    const apiHost = PUBLIC_API_BASE && PUBLIC_API_BASE.startsWith('http')
        ? new URL(PUBLIC_API_BASE).hostname
        : (import.meta.env?.BASE_URL ? new URL(import.meta.env.BASE_URL).hostname : '' );

    const [radiusAddress, setRadiusAddress] = useState(apiHost || '127.0.0.1');
    const [radiusSecret, setRadiusSecret] = useState('hqinvestment-radius-secret');

    const addVpnSecret = () => {
        if (!vpnForm.username || !vpnForm.password) {
            alert('Username and Password are required.'); return;
        }
        setVpnSecrets(prev => [...prev, { ...vpnForm, id: Date.now().toString() }]);
        setVpnForm({ username: '', password: '', protocol: vpnProtocol, profile: 'default', localAddress: '', remoteAddress: '' });
        setShowAddVpnSecret(false);
    };

    const removeVpnSecret = (idx: number) => {
        setVpnSecrets(prev => prev.filter((_, i) => i !== idx));
    };

    // Step 5 state
    const [selectedInterfaces, setSelectedInterfaces] = useState<string[]>([]);

    // Step 6 state
    const [configGenerated, setConfigGenerated] = useState(false);

    // Step 7 state
    const [verifyStatus, setVerifyStatus] = useState<'checking' | 'success' | 'failed'>('failed');

    const handleNext = () => {
        if (currentStep === 1 && connectionStatus !== 'online') {
            alert('Please wait for connection check or ensure router is online.');
            return;
        }
        if (currentStep === 4 && selectedInterfaces.length === 0) {
            alert('Please select at least one interface.');
            return;
        }

        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            if (vpnEnabled && vpnSecrets.length > 0 && routerId) {
                vpnSecrets.forEach(s => {
                    vpnApi.create({
                        username: s.username,
                        password: s.password,
                        protocol: s.protocol,
                        profile: s.profile,
                        localAddress: s.localAddress,
                        remoteAddress: s.remoteAddress,
                        routerId: routerId,
                        service: s.protocol.toLowerCase(),
                    }).catch(console.error);
                });
            }
            if (onClose) { onClose(); } else { navigate('/mikrotiks'); }
        }
    };

    const [showPreview, setShowPreview] = useState(false);

    const handlePrev = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1);
    };

    const getGeneratedScript = () => {
        const hotspotNetwork = hotspotLocalAddress.split('.').slice(0, 3).join('.') + '.0/24';
        const hotspotCidr = `${hotspotLocalAddress}/24`;
        const lines: string[] = [
            `# RSC Configuration for ${routerName}`,
            `# Generated: ${new Date().toISOString()}`,
            `# Service: ${serviceType === 'pppoe' ? 'PPPoE' : serviceType === 'hotspot' ? 'Hotspot' : 'PPPoE + Hotspot'}`,
            `# VPN Mode: ${vpnEnabled ? vpnMode : 'Disabled'}`,
            '',
            '# ===== Management Safety (prevent Winbox MAC timeout) =====',
            '/tool mac-server set allowed-interface-list=all',
            '/tool mac-server mac-winbox set allowed-interface-list=all',
            '/ip neighbor discovery-settings set discover-interface-list=all',
            '',
            '# ===== Bridge Setup =====',
        ];
        if (selectedInterfaces.length > 0) {
            lines.push(
                ':local targetBridge "radiax_bridge"',
                `:if ([:len [/interface bridge find where name=$targetBridge]] = 0) do={`,
                `  :if ([:len [/interface bridge find where name="bridge"]] > 0) do={`,
                `    :set targetBridge "bridge"`,
                `  } else={`,
                `    /interface bridge add name=$targetBridge comment="HQ Investment Bridge"`,
                `  }`,
                `} else={`,
                `  /interface bridge set [/interface bridge find where name=$targetBridge] comment="HQ Investment Bridge"`,
                `}`
            );
            selectedInterfaces.forEach(iface => {
                lines.push(
                    `:local existingBridgePort [/interface bridge port find where interface="${iface}"]`,
                    `:if ([:len $existingBridgePort] > 0) do={`,
                    `  :local existingBridge [/interface bridge port get $existingBridgePort bridge]`,
                    `  :if ($existingBridge != $targetBridge) do={`,
                    `    :set targetBridge $existingBridge`,
                    `  }`,
                    `} else={`,
                    `  /interface bridge port add bridge=$targetBridge interface=${iface}`,
                    `}`
                );
            });
        }
        if (serviceType === 'pppoe' || serviceType === 'both') {
            lines.push(
                '',
                '# ===== PPPoE Server Configuration =====',
                `:if ([:len [/ip pool find where name="pppoe-pool"]] = 0) do={`,
                `  /ip pool add name=pppoe-pool ranges=${pppoePoolStart}-${pppoePoolEnd}`,
                `} else={`,
                `  /ip pool set [/ip pool find where name="pppoe-pool"] ranges=${pppoePoolStart}-${pppoePoolEnd}`,
                `}`,
                `:if ([:len [/ppp profile find where name="radiax-pppoe"]] = 0) do={`,
                `  /ppp profile add name=radiax-pppoe local-address=${pppoeLocalAddress} remote-address=pppoe-pool dns-server=8.8.8.8,1.1.1.1 use-encryption=yes change-tcp-mss=yes`,
                `} else={`,
                `  /ppp profile set [/ppp profile find where name="radiax-pppoe"] local-address=${pppoeLocalAddress} remote-address=pppoe-pool dns-server=8.8.8.8,1.1.1.1 use-encryption=yes change-tcp-mss=yes`,
                `}`,
                `:if ([:len [/interface pppoe-server server find where service-name="pppoe-service"]] = 0) do={`,
                `  /interface pppoe-server server add service-name=pppoe-service interface=$targetBridge default-profile=radiax-pppoe authentication=pap,chap,mschap1,mschap2 disabled=no`,
                `} else={`,
                `  /interface pppoe-server server set [/interface pppoe-server server find where service-name="pppoe-service"] interface=$targetBridge default-profile=radiax-pppoe authentication=pap,chap,mschap1,mschap2 disabled=no`,
                `}`,
            );
        }
        if (serviceType === 'hotspot' || serviceType === 'both') {
            lines.push(
                '',
                '# ===== Hotspot Server Configuration =====',
                `:if ([:len [/ip pool find where name="hotspot-pool"]] = 0) do={`,
                `  /ip pool add name=hotspot-pool ranges=${hotspotPoolStart}-${hotspotPoolEnd}`,
                `} else={`,
                `  /ip pool set [/ip pool find where name="hotspot-pool"] ranges=${hotspotPoolStart}-${hotspotPoolEnd}`,
                `}`,
                `:if ([:len [/ip address find where address="${hotspotCidr}"]] = 0) do={`,
                `  /ip address add address=${hotspotCidr} interface=$targetBridge`,
                `}`,
                `:if ([:len [/ip dhcp-server network find where address="${hotspotNetwork}"]] = 0) do={`,
                `  /ip dhcp-server network add address=${hotspotNetwork} gateway=${hotspotLocalAddress} dns-server=${hotspotLocalAddress}`,
                `} else={`,
                `  /ip dhcp-server network set [/ip dhcp-server network find where address="${hotspotNetwork}"] gateway=${hotspotLocalAddress} dns-server=${hotspotLocalAddress}`,
                `}`,
                `:if ([:len [/ip dhcp-server find where name="dhcp-hotspot"]] = 0) do={`,
                `  /ip dhcp-server add name=dhcp-hotspot interface=$targetBridge address-pool=hotspot-pool authoritative=after-2sec-delay disabled=no`,
                `} else={`,
                `  /ip dhcp-server set [/ip dhcp-server find where name="dhcp-hotspot"] interface=$targetBridge address-pool=hotspot-pool authoritative=after-2sec-delay disabled=no`,
                `}`,
                `:if ([:len [/ip hotspot profile find where name="hq-hotspot"]] = 0) do={`,
                `  /ip hotspot profile add name=hq-hotspot hotspot-address=${hotspotLocalAddress} dns-name=login.spot login-by=http-chap,http-pap,cookie,mac-cookie html-directory=hotspot http-cookie-lifetime=3d`,
                `} else={`,
                `  /ip hotspot profile set [/ip hotspot profile find where name="hq-hotspot"] hotspot-address=${hotspotLocalAddress} dns-name=login.spot login-by=http-chap,http-pap,cookie,mac-cookie html-directory=hotspot http-cookie-lifetime=3d`,
                `}`,
                `:if ([:len [/ip hotspot find where name="hotspot1"]] = 0) do={`,
                `  /ip hotspot add name=hotspot1 interface=$targetBridge address-pool=hotspot-pool profile=hq-hotspot disabled=no`,
                `} else={`,
                `  /ip hotspot set [/ip hotspot find where name="hotspot1"] interface=$targetBridge address-pool=hotspot-pool profile=hq-hotspot disabled=no`,
                `}`,
                '', '# --- Hotspot Login Page (HTML Template) ---',
                `# NOTE: Upload your custom hotspot HTML files separately.`,
                `# 1. Go to Hotspot Customizer in the billing system and download the ZIP`,
                `# 2. Extract the ZIP and upload all files to the MikroTik Files section (in the 'flash/hotspot' folder to survive reboots)`
            );
        }
        if (vpnEnabled) {
            lines.push('', `# ===== VPN Setup (${vpnMode}) =====`,
                `:if ([:len [/ip pool find where name="vpn-pool"]] = 0) do={ /ip pool add name=vpn-pool ranges=${vpnPoolStart}-${vpnPoolEnd} } else={ /ip pool set [/ip pool find where name="vpn-pool"] ranges=${vpnPoolStart}-${vpnPoolEnd} }`,
                `/ip dns set servers=${vpnDns}`,
            );
            if (vpnMode === 'hybrid' || vpnMode === 'openvpn') {
                lines.push('/interface ovpn-server server set enabled=yes certificate=none auth=sha1,md5 cipher=aes128-cbc,aes192-cbc,aes256-cbc default-profile=default');
            }
            if (vpnMode === 'hybrid' || vpnMode === 'wireguard') {
                const wgAddress = '10.0.0.2'; // First router usually gets .2
                const dropletIp = apiHost;
                lines.push(
                    `:if ([:len [/interface wireguard find where name="wireguard1"]] = 0) do={ /interface wireguard add listen-port=13231 name=wireguard1 }`,
                    `:if ([:len [/ip address find where address="${wgAddress}/24" interface="wireguard1"]] = 0) do={ /ip address add address=${wgAddress}/24 interface=wireguard1 }`,
                    `:if ([:len [/interface wireguard peers find where comment="HQ-VPN-Server"]] = 0) do={ /interface wireguard peers add allowed-address=0.0.0.0/0 endpoint-address=${dropletIp} endpoint-port=51820 interface=wireguard1 public-key="b7ADpdTy6UooXmb7Ve+PgGeXjGFLVFXqsuz32dYNaxA=" persistent-keepalive=25s comment="HQ-VPN-Server" }`
                );
            }
            if (vpnMode === 'openvpn' || vpnMode === 'hybrid') {
                lines.push(
                    `:if ([:len [/ip ipsec peer find where secret="${ipsecSecret}"]] = 0) do={ /ip ipsec peer add address=0.0.0.0/0 exchange-mode=main secret="${ipsecSecret}" }`,
                    `/interface l2tp-server server set enabled=yes default-profile=default use-ipsec=yes ipsec-secret="${ipsecSecret}"`
                );
            }
            vpnSecrets.forEach(s => {
                const localAddr = s.localAddress ? ` local-address=${s.localAddress}` : '';
                const remoteAddr = s.remoteAddress ? ` remote-address=${s.remoteAddress}` : '';
                lines.push(
                    `:if ([:len [/ppp secret find where name="${s.username}"]] = 0) do={`,
                    `  /ppp secret add name=${s.username} password=${s.password} service=${s.protocol.toLowerCase()} profile=${s.profile}${localAddr}${remoteAddr}`,
                    `} else={`,
                    `  /ppp secret set [/ppp secret find where name="${s.username}"] password=${s.password} service=${s.protocol.toLowerCase()} profile=${s.profile}${localAddr}${remoteAddr}`,
                    `}`
                );
            });
        }
        lines.push('', '# ===== RADIUS Client =====',
            `:if ([:len [/radius find where address="${radiusAddress}"]] = 0) do={`,
            `  /radius add service=hotspot,ppp address=${radiusAddress} secret=${radiusSecret} authentication-port=1812 accounting-port=1813 timeout=3s`,
            `} else={`,
            `  /radius set [/radius find where address="${radiusAddress}"] service=hotspot,ppp secret=${radiusSecret} authentication-port=1812 accounting-port=1813 timeout=3s`,
            `}`,
            ':if ([:len [/ip hotspot profile find where name="hq-hotspot"]] > 0) do={ /ip hotspot profile set [/ip hotspot profile find where name="hq-hotspot"] use-radius=yes radius-accounting=yes }',
            ':if ([:len [/ppp profile find where name="radiax-pppoe"]] > 0) do={ /ppp profile set [/ppp profile find where name="radiax-pppoe"] use-radius=yes }',
            '', '# ===== Walled Garden =====',
            `:if ([:len [/ip hotspot walled-garden find where dst-host="${apiHost}"]] = 0) do={ /ip hotspot walled-garden add dst-host="${apiHost}" action=allow comment="Billing Portal" }`,
            `:if ([:len [/ip hotspot walled-garden ip find where dst-address="${apiHost}"]] = 0) do={ /ip hotspot walled-garden ip add dst-address="${apiHost}" action=accept comment="Billing Portal IP" }`,
            '', '# Configuration complete', '');

        return lines.join('\n');
    };

    const toggleInterface = (name: string) => {
        setSelectedInterfaces(prev =>
            prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
        );
    };

    const getNextButtonLabel = () => {
        switch (currentStep) {
            case 0: return 'Next: Check Connection';
            case 1: return 'Continue to Service Selection';
            case 2: return 'Next: VPN Configuration';
            case 3: return 'Next: Select Interfaces';
            case 4: return 'Next: Generate Config';
            case 5: return 'Next: Verify Setup';
            case 6: return 'Finish Setup';
            default: return 'Next';
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            /* ───────── STEP 0 : Download ───────── */
            case 0:
                return (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <DownloadIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
                        <h2 style={{ marginBottom: 6 }}>Download OpenVPN Configuration</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Download and import the OpenVPN configuration script</p>

                        <div style={{
                            maxWidth: 500, margin: '0 auto', padding: 30,
                            border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-surface)',
                        }}>
                            <InsertDriveFileIcon style={{ fontSize: 48, color: 'var(--text-secondary)', marginBottom: 12 }} />
                            <h3 style={{ marginBottom: 4 }}>OpenVPN Setup Script</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>
                                Configure VPN connection and register your router
                            </p>
                            <button className="btn"
                                onClick={() => {
                                    const vpnUser = routerData?.username || (routerName ? routerName.toLowerCase().replace(/\s+/g, '') : 'vpn');
                                    const vpnPass = routerData?.password || 'secret';
                                    const scriptContent = `# OpenVPN Setup Script for ${routerName}\n:if ([:len [/interface ovpn-client find where name="ovpn-out1"]] = 0) do={ /interface ovpn-client add name=ovpn-out1 connect-to=${apiHost} user=${vpnUser} password=${vpnPass} } else={ /interface ovpn-client set [/interface ovpn-client find where name="ovpn-out1"] connect-to=${apiHost} user=${vpnUser} password=${vpnPass} }\n:if ([:len [/ip hotspot walled-garden find where dst-host="${apiHost}"]] = 0) do={ /ip hotspot walled-garden add action=allow dst-host=${apiHost} }\n:if ([:len [/ip hotspot walled-garden ip find where dst-address="${apiHost}"]] = 0) do={ /ip hotspot walled-garden ip add action=accept dst-address=${apiHost} }\n`;
                                    const blob = new Blob([scriptContent], { type: 'application/octet-stream' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${routerName.replace(/\s+/g, '_')}_ovpn_setup.rsc`;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                }}
                                style={{ background: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 24px', borderRadius: 'var(--radius-sm)' }}>
                                <FileDownloadIcon fontSize="small" /> Download {routerName}_ovpn_setup.rsc
                            </button>
                        </div>

                        <div style={{
                            maxWidth: 500, margin: '24px auto 0', padding: 20,
                            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)',
                            textAlign: 'left',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <InfoOutlinedIcon style={{ fontSize: 18, color: '#1d4ed8' }} />
                                <strong style={{ fontSize: '0.9rem' }}>Instructions:</strong>
                            </div>
                            <ol style={{ paddingLeft: 20, margin: 0, fontSize: '0.85rem', color: '#374151', lineHeight: 1.8 }}>
                                <li>Download the RSC file using the button above</li>
                                <li>Connect to your MikroTik router via Winbox</li>
                                <li>Go to <strong>Files</strong> and drag the RSC file to upload it</li>
                                <li>Open <strong>Terminal</strong> and run: <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4 }}>/import {routerName}_ovpn_setup.rsc</code></li>
                                <li>Wait for the import to complete (2-3 minutes)</li>
                                <li>Click "Next" when the script has finished</li>
                            </ol>
                        </div>
                    </div>
                );

            /* ───────── STEP 1 : Connection ───────── */
            case 1:
                return (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <CableIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
                        <h2 style={{ marginBottom: 6 }}>Router Connection Status</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Monitoring router connection to our VPN network</p>

                        <div style={{
                            maxWidth: 500, margin: '0 auto', padding: 40,
                            border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-surface)',
                        }}>
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
                                    <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 24px', borderRadius: 'var(--radius-sm)', marginTop: 24 }}
                                        onClick={handleNext}>
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
                                        <button className="btn btn-secondary" onClick={checkConnection}>
                                            <RefreshIcon fontSize="small" /> Try Again
                                        </button>
                                        <button className="btn btn-secondary" onClick={() => setCurrentStep(0)}>
                                            <ArrowBackIcon fontSize="small" /> Check Instructions
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );

            /* ───────── STEP 2 : Services ───────── */
            case 2:
                return (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <SettingsIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
                        <h2 style={{ marginBottom: 6 }}>Choose Services to Configure</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Select which services you want to configure</p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, maxWidth: 750, margin: '0 auto' }}>
                            {[
                                { key: 'pppoe' as const, label: 'PPPoE Server Only', desc: 'Configure PPPoE server for client connections', icon: <DnsIcon style={{ fontSize: 40, color: 'var(--text-secondary)', marginBottom: 12 }} />, detail: 'radiax_pppoe bridge    10.116.0.x network\nradiax-pppoe service' },
                                { key: 'hotspot' as const, label: 'Hotspot Only', desc: 'Configure WiFi hotspot with login portal', icon: <WifiIcon style={{ fontSize: 40, color: 'var(--text-secondary)', marginBottom: 12 }} />, detail: 'radiax_hotspot bridge    10.116.0.x network\nlogin.spot portal' },
                                { key: 'both' as const, label: 'Both Services', desc: 'Configure both PPPoE and Hotspot', icon: <DeviceHubIcon style={{ fontSize: 40, color: 'var(--text-secondary)', marginBottom: 12 }} />, detail: 'radiax_bridge    PPPoE: 10.116.0.x\nHotspot: 10.116.0.x' },
                            ].map(svc => (
                                <div key={svc.key} onClick={() => setServiceType(svc.key)} style={{
                                    border: serviceType === svc.key ? '2px solid #0d9488' : '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)', padding: 20, cursor: 'pointer',
                                    background: serviceType === svc.key ? '#f0fdfa' : '#fff',
                                    transition: 'all 0.2s', textAlign: 'center',
                                }}>
                                    {svc.icon}
                                    <h4 style={{ marginBottom: 4 }}>{svc.label}</h4>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>{svc.desc}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
                                        <div style={{ width: 16, height: 16, borderRadius: '50%', border: serviceType === svc.key ? '5px solid #0d9488' : '2px solid var(--border)' }} />
                                        <span style={{ fontSize: '0.82rem', fontWeight: 500, color: serviceType === svc.key ? '#0d9488' : 'var(--text-secondary)' }}>Select {svc.label.split(' ')[0]}</span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{svc.detail}</div>
                                </div>
                            ))}
                        </div>

                        {/* Configurable IP Settings Section */}
                        <div style={{ maxWidth: 750, margin: '30px auto 0', textAlign: 'left', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: 24, background: '#f8fafc' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <SettingsIcon style={{ fontSize: 18, color: 'var(--primary)' }} /> IP & RADIUS Configuration
                            </h3>

                            <div className="grid-2 gap-20">
                                {/* PPPoE Settings */}
                                {(serviceType === 'pppoe' || serviceType === 'both') && (
                                    <div style={{ background: '#fff', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 12, color: '#0d9488' }}>PPPoE Network Settings</div>
                                        <div className="form-group">
                                            <label className="form-label">Local Gateway Address</label>
                                            <input className="form-input" value={pppoeLocalAddress} onChange={e => setPppoeLocalAddress(e.target.value)} placeholder="10.116.0.2" />
                                        </div>
                                        <div className="grid-2 gap-10">
                                            <div className="form-group">
                                                <label className="form-label">Pool Start</label>
                                                <input className="form-input" value={pppoePoolStart} onChange={e => setPppoePoolStart(e.target.value)} placeholder="10.116.0.3" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Pool End</label>
                                                <input className="form-input" value={pppoePoolEnd} onChange={e => setPppoePoolEnd(e.target.value)} placeholder="10.116.0.254" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Hotspot Settings */}
                                {(serviceType === 'hotspot' || serviceType === 'both') && (
                                    <div style={{ background: '#fff', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 12, color: '#0d9488' }}>Hotspot Network Settings</div>
                                        <div className="form-group">
                                            <label className="form-label">Hotspot Gateway Address</label>
                                            <input className="form-input" value={hotspotLocalAddress} onChange={e => setHotspotLocalAddress(e.target.value)} placeholder="10.116.0.2" />
                                        </div>
                                        <div className="grid-2 gap-10">
                                            <div className="form-group">
                                                <label className="form-label">Pool Start</label>
                                                <input className="form-input" value={hotspotPoolStart} onChange={e => setHotspotPoolStart(e.target.value)} placeholder="10.116.0.3" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Pool End</label>
                                                <input className="form-input" value={hotspotPoolEnd} onChange={e => setHotspotPoolEnd(e.target.value)} placeholder="10.116.0.254" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* RADIUS Settings */}
                                <div style={{ background: '#fff', padding: 16, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', gridColumn: (serviceType === 'both' ? 'span 2' : 'auto') }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 12, color: '#4338ca' }}>RADIUS Server Settings</div>
                                    <div className="grid-2 gap-10">
                                        <div className="form-group">
                                            <label className="form-label">RADIUS Server IP/Host</label>
                                            <input className="form-input" value={radiusAddress} onChange={e => setRadiusAddress(e.target.value)} placeholder="Server IP" />
                                            <div className="form-hint">Address of your billing server</div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">RADIUS Shared Secret</label>
                                            <input className="form-input" value={radiusSecret} onChange={e => setRadiusSecret(e.target.value)} placeholder="Secret key" />
                                            <div className="form-hint">Must match server configuration</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            /* ───────── STEP 3 : VPN Configuration ───────── */
            case 3:
                return (
                    <div style={{ padding: '20px 0' }}>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <VpnKeyIcon style={{ fontSize: 56, color: '#7c3aed', marginBottom: 12 }} />
                            <h2 style={{ marginBottom: 6 }}>VPN Tunnel Configuration</h2>
                            <p style={{ color: 'var(--text-secondary)' }}>Configure VPN server and secrets on this router</p>
                        </div>

                        <div style={{ maxWidth: 700, margin: '0 auto' }}>
                            {/* VPN Enable Toggle */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '16px 20px', border: '1px solid var(--border-light)',
                                borderRadius: 'var(--radius-md)', marginBottom: 16, background: 'var(--bg-surface)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <VpnKeyIcon style={{ color: '#7c3aed' }} />
                                    <div>
                                        <div style={{ fontWeight: 600 }}>Enable VPN Server</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Configure VPN server on this MikroTik</div>
                                    </div>
                                </div>
                                <label style={{ position: 'relative', display: 'inline-block', width: 48, height: 26 }}>
                                    <input type="checkbox" checked={vpnEnabled} onChange={e => setVpnEnabled(e.target.checked)}
                                        style={{ opacity: 0, width: 0, height: 0 }} />
                                    <span style={{
                                        position: 'absolute', cursor: 'pointer', inset: 0, borderRadius: 26,
                                        background: vpnEnabled ? '#7c3aed' : '#ccc', transition: '0.3s',
                                    }}>
                                        <span style={{
                                            position: 'absolute', height: 20, width: 20, left: vpnEnabled ? 24 : 4, bottom: 3,
                                            background: '#fff', borderRadius: '50%', transition: '0.3s',
                                        }} />
                                    </span>
                                </label>
                            </div>

                            {/* VPN Mode Selection */}
                            {vpnEnabled && (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
                                        🔒 VPN Mode
                                    </div>
                                    {/* Hybrid */}
                                    <div onClick={() => setVpnMode('hybrid')} style={{
                                        border: vpnMode === 'hybrid' ? '2px solid #7c3aed' : '1px solid var(--border)',
                                        borderRadius: 'var(--radius-md)', padding: 14, marginBottom: 10, cursor: 'pointer',
                                        background: vpnMode === 'hybrid' ? '#faf5ff' : '#fff', transition: 'all 0.2s',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 16, height: 16, borderRadius: '50%', border: vpnMode === 'hybrid' ? '5px solid #7c3aed' : '2px solid var(--border)', flexShrink: 0 }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <strong>Hybrid Mode</strong>
                                                    <span style={{ background: '#16a34a', color: '#fff', padding: '1px 8px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 600 }}>Recommended</span>
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>WireGuard (fast VPN) + OpenVPN (management access)</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                                        <div onClick={() => setVpnMode('wireguard')} style={{
                                            border: vpnMode === 'wireguard' ? '2px solid #7c3aed' : '1px solid var(--border)',
                                            borderRadius: 'var(--radius-md)', padding: 12, cursor: 'pointer',
                                            background: vpnMode === 'wireguard' ? '#faf5ff' : '#fff', transition: 'all 0.2s',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 14, height: 14, borderRadius: '50%', border: vpnMode === 'wireguard' ? '5px solid #7c3aed' : '2px solid var(--border)', flexShrink: 0 }} />
                                                <div>
                                                    <strong style={{ fontSize: '0.85rem' }}>WireGuard Only</strong>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fast & modern VPN</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div onClick={() => setVpnMode('openvpn')} style={{
                                            border: vpnMode === 'openvpn' ? '2px solid #7c3aed' : '1px solid var(--border)',
                                            borderRadius: 'var(--radius-md)', padding: 12, cursor: 'pointer',
                                            background: vpnMode === 'openvpn' ? '#faf5ff' : '#fff', transition: 'all 0.2s',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ width: 14, height: 14, borderRadius: '50%', border: vpnMode === 'openvpn' ? '5px solid #7c3aed' : '2px solid var(--border)', flexShrink: 0 }} />
                                                <div>
                                                    <strong style={{ fontSize: '0.85rem' }}>OpenVPN Only</strong>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Traditional, compatible</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {vpnEnabled && (
                                <>
                                    {/* VPN Server Settings */}
                                    <div style={{
                                        border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                                        overflow: 'hidden', marginBottom: 16,
                                    }}>
                                        <div style={{
                                            padding: '12px 20px', borderBottom: '1px solid var(--border-light)',
                                            fontWeight: 600, background: '#f5f3ff', color: '#7c3aed',
                                            display: 'flex', alignItems: 'center', gap: 8,
                                        }}>
                                            <SettingsIcon style={{ fontSize: 16 }} /> VPN Server Settings
                                        </div>
                                        <div style={{ padding: 20 }}>
                                            <div className="grid-2 gap-16">
                                                <div className="form-group">
                                                    <label className="form-label">VPN Protocol</label>
                                                    <select className="form-select" value={vpnProtocol} onChange={e => setVpnProtocol(e.target.value)}>
                                                        <option value="L2TP">L2TP/IPsec</option>
                                                        <option value="PPTP">PPTP</option>
                                                        <option value="SSTP">SSTP</option>
                                                        <option value="OpenVPN">OpenVPN</option>
                                                    </select>
                                                    <div className="form-hint">L2TP/IPsec recommended for security</div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">IPsec Pre-Shared Key</label>
                                                    <input className="form-input" type="password" value={ipsecSecret}
                                                        onChange={e => setIpsecSecret(e.target.value)} />
                                                    <div className="form-hint">Shared secret for IPsec authentication</div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">IP Pool Start</label>
                                                    <input className="form-input" value={vpnPoolStart}
                                                        onChange={e => setVpnPoolStart(e.target.value)} placeholder="10.0.0.2" />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">IP Pool End</label>
                                                    <input className="form-input" value={vpnPoolEnd}
                                                        onChange={e => setVpnPoolEnd(e.target.value)} placeholder="10.0.0.254" />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">DNS Server</label>
                                                    <input className="form-input" value={vpnDns}
                                                        onChange={e => setVpnDns(e.target.value)} placeholder="8.8.8.8" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* VPN Secrets (Users) */}
                                    <div style={{
                                        border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            padding: '12px 20px', borderBottom: '1px solid var(--border-light)',
                                            fontWeight: 600, background: '#f5f3ff', color: '#7c3aed',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <LockIcon style={{ fontSize: 16 }} /> PPP Secrets (VPN Users)
                                                <span style={{
                                                    background: '#7c3aed', color: '#fff', padding: '1px 8px',
                                                    borderRadius: 10, fontSize: '0.75rem',
                                                }}>{vpnSecrets.length}</span>
                                            </div>
                                            <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                                                onClick={() => setShowAddVpnSecret(true)}>
                                                <AddIcon style={{ fontSize: 14 }} /> Add Secret
                                            </button>
                                        </div>
                                        <div style={{ padding: 16 }}>
                                            {vpnSecrets.length === 0 ? (
                                                <div style={{
                                                    textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)',
                                                }}>
                                                    <VpnKeyIcon style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }} />
                                                    <div style={{ fontSize: '0.88rem' }}>No VPN secrets added yet</div>
                                                    <div style={{ fontSize: '0.78rem', marginTop: 4 }}>Click "Add Secret" to create VPN user credentials</div>
                                                </div>
                                            ) : (
                                                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>USERNAME</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>PROTOCOL</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>PROFILE</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>LOCAL IP</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>REMOTE IP</th>
                                                            <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {vpnSecrets.map((s, i) => (
                                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                                <td style={{ padding: '10px 12px', fontWeight: 500 }}>{s.username}</td>
                                                                <td style={{ padding: '10px 12px' }}>
                                                                    <span style={{
                                                                        background: '#7c3aed22', color: '#7c3aed',
                                                                        padding: '2px 8px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
                                                                    }}>{s.protocol}</span>
                                                                </td>
                                                                <td style={{ padding: '10px 12px' }}>{s.profile}</td>
                                                                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.localAddress || 'Auto'}</td>
                                                                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.remoteAddress || 'Auto'}</td>
                                                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                                    <button className="btn-icon delete" onClick={() => removeVpnSecret(i)} title="Remove">
                                                                        <DeleteIcon style={{ fontSize: 16 }} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>

                                    {/* Add Secret Inline Form */}
                                    {showAddVpnSecret && (
                                        <div style={{
                                            marginTop: 16, border: '2px solid #7c3aed33', borderRadius: 'var(--radius-md)',
                                            padding: 20, background: '#faf5ff',
                                        }}>
                                            <div style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <AddIcon style={{ fontSize: 16, color: '#7c3aed' }} /> New VPN Secret
                                            </div>
                                            <div className="grid-2 gap-12">
                                                <div className="form-group">
                                                    <label className="form-label">Username <span className="required">*</span></label>
                                                    <input className="form-input" placeholder="vpn-user01" value={vpnForm.username}
                                                        onChange={e => setVpnForm({ ...vpnForm, username: e.target.value })} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Password <span className="required">*</span></label>
                                                    <input className="form-input" type="password" placeholder="Strong password"
                                                        value={vpnForm.password} onChange={e => setVpnForm({ ...vpnForm, password: e.target.value })} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Profile</label>
                                                    <select className="form-select" value={vpnForm.profile}
                                                        onChange={e => setVpnForm({ ...vpnForm, profile: e.target.value })}>
                                                        <option value="default">default</option>
                                                        <option value="default-encryption">default-encryption</option>
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Protocol</label>
                                                    <select className="form-select" value={vpnForm.protocol}
                                                        onChange={e => setVpnForm({ ...vpnForm, protocol: e.target.value })}>
                                                        <option value="L2TP">L2TP/IPsec</option>
                                                        <option value="PPTP">PPTP</option>
                                                        <option value="SSTP">SSTP</option>
                                                        <option value="OpenVPN">OpenVPN</option>
                                                    </select>
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Local Address</label>
                                                    <input className="form-input" placeholder="Auto-assign" value={vpnForm.localAddress}
                                                        onChange={e => setVpnForm({ ...vpnForm, localAddress: e.target.value })} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Remote Address</label>
                                                    <input className="form-input" placeholder="Auto-assign" value={vpnForm.remoteAddress}
                                                        onChange={e => setVpnForm({ ...vpnForm, remoteAddress: e.target.value })} />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                                <button className="btn btn-secondary" onClick={() => setShowAddVpnSecret(false)}>Cancel</button>
                                                <button className="btn btn-primary" onClick={addVpnSecret}>
                                                    <AddIcon fontSize="small" /> Add Secret
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Info banner */}
                                    <div style={{
                                        marginTop: 16, padding: '12px 16px',
                                        background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)',
                                        display: 'flex', alignItems: 'flex-start', gap: 10,
                                    }}>
                                        <InfoOutlinedIcon style={{ fontSize: 18, color: '#1d4ed8', marginTop: 2 }} />
                                        <div style={{ fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.6 }}>
                                            <strong>VPN Configuration Notes:</strong><br />
                                            • VPN secrets will be pushed to MikroTik as PPP Secrets during config generation<br />
                                            • {vpnProtocol === 'L2TP' ? 'L2TP server with IPsec encryption will be enabled' : `${vpnProtocol} server will be enabled`}<br />
                                            • IP Pool: {vpnPoolStart} – {vpnPoolEnd}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                );

            /* ───────── STEP 4 : Interfaces ───────── */
            case 4:
                return (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <CableIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
                        <h2 style={{ marginBottom: 6 }}>Select Network Interfaces</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Choose ethernet ports for your services</p>

                        <div style={{ maxWidth: 650, margin: '0 auto 20px', padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <WarningAmberIcon style={{ color: '#d97706', fontSize: 20, marginTop: 2 }} />
                            <div style={{ fontSize: '0.85rem', color: '#b45309' }}>
                                <strong>Important:</strong> Do NOT select the interface that provides your router's Internet connection (usually <strong>ether1</strong> or your WAN port). Adding it to the service bridge will disconnect your router from the internet!
                            </div>
                        </div>

                        <div style={{ maxWidth: 650, margin: '0 auto', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                                    🌐 Available Ethernet Interfaces
                                </div>
                                <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={fetchInterfaces}>
                                    <RefreshIcon fontSize="inherit" /> Refresh
                                </button>
                            </div>

                            {loadingInterfaces ? (
                                <div style={{ textAlign: 'center', padding: 40, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                                    <RefreshIcon className="spin" style={{ color: 'var(--primary)', marginBottom: 10 }} />
                                    <p style={{ color: 'var(--text-secondary)' }}>Fetching interfaces from {routerName}...</p>
                                </div>
                            ) : interfaces.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 40, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: '#fff' }}>
                                    <WarningAmberIcon style={{ color: '#d97706', fontSize: 32, marginBottom: 10 }} />
                                    <p style={{ color: 'var(--text-secondary)' }}>No ethernet interfaces found. Please check connection.</p>
                                </div>
                            ) : (
                                <div className="grid-2 gap-12">
                                    {interfaces.map((iface) => (
                                        <div key={iface.name} onClick={() => toggleInterface(iface.name)} style={{
                                            border: selectedInterfaces.includes(iface.name) ? '2px solid #0d9488' : '1px solid var(--border)',
                                            borderRadius: 'var(--radius-sm)', padding: '14px 16px', cursor: 'pointer',
                                            background: selectedInterfaces.includes(iface.name) ? '#f0fdfa' : '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 0.2s',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <input type="checkbox" checked={selectedInterfaces.includes(iface.name)}
                                                    onChange={() => toggleInterface(iface.name)} style={{ width: 16, height: 16 }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{iface.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{iface.type} - {iface.mac}</div>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: iface.status === 'Up' ? '#16a34a' : '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                ⊙ {iface.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{
                                marginTop: 20, padding: '12px 16px',
                                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)',
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                            }}>
                                <InfoOutlinedIcon style={{ fontSize: 18, color: '#1d4ed8', marginTop: 2 }} />
                                <div style={{ fontSize: '0.85rem', color: '#1e40af' }}>
                                    <strong>Bridge Information:</strong><br />
                                    A bridge will be created and selected interfaces will be added as ports.
                                </div>
                            </div>
                        </div>
                    </div>
                );

            /* ───────── STEP 5 : Generate ───────── */
            case 5:
                return (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <DescriptionIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
                        <h2 style={{ marginBottom: 6 }}>Generate Configuration</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Create RSC configuration file</p>

                        <div style={{
                            maxWidth: 600, margin: '0 auto', textAlign: 'left',
                            border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
                        }}>
                            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, color: '#0d9488' }}>
                                Configuration Summary
                            </div>
                            <div style={{ padding: 20 }}>
                                <div className="grid-2 gap-16" style={{ marginBottom: 12 }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <SettingsIcon style={{ fontSize: 14 }} /> Service Type:
                                        </div>
                                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <DnsIcon style={{ fontSize: 16 }} />
                                            {serviceType === 'pppoe' ? 'PPPoE Server Only' : serviceType === 'hotspot' ? 'Hotspot Only' : 'Both Services'}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Selected Interfaces:</div>
                                        <div style={{ fontWeight: 500 }}>{selectedInterfaces.length > 0 ? selectedInterfaces.join(', ') : 'None selected'}</div>
                                    </div>
                                </div>
                                {vpnEnabled && (
                                    <div className="grid-2 gap-16" style={{ marginBottom: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <VpnKeyIcon style={{ fontSize: 14 }} /> VPN Server:
                                            </div>
                                            <div style={{ fontWeight: 500 }}>{vpnProtocol} — {vpnSecrets.length} secret(s)</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>VPN IP Pool:</div>
                                            <div style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.85rem' }}>{vpnPoolStart} – {vpnPoolEnd}</div>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>Bridge Configuration:</div>
                                    <div style={{ fontSize: '0.82rem', color: '#0d9488' }}>
                                        Bridge will be created for PPPoE server with selected interfaces.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{
                            maxWidth: 600, margin: '24px auto', padding: 30,
                            border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)',
                        }}>
                            <RocketLaunchIcon style={{ fontSize: 48, color: 'var(--text-secondary)', marginBottom: 12 }} />
                            <h3 style={{ marginBottom: 6 }}>Ready to Generate Configuration</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>Click to create your custom RSC configuration file</p>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                                <button className="btn" style={{ background: '#3b82f6', color: '#fff', fontWeight: 600, padding: '10px 24px' }}
                                    onClick={() => setShowPreview(!showPreview)}>
                                    <ListIcon fontSize="small" /> {showPreview ? 'Hide Preview' : 'Preview Script'}
                                </button>
                                <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 24px' }}
                                    onClick={() => {
                                        const content = getGeneratedScript();
                                        const blob = new Blob([content], { type: 'application/octet-stream' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${routerName.replace(/\s+/g, '_')}_config.rsc`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                        setConfigGenerated(true);
                                    }}>
                                    <FileDownloadIcon fontSize="small" /> Generate & Download
                                </button>
                            </div>

                            {showPreview && (
                                <div style={{ marginTop: 20, textAlign: 'left', background: '#1e293b', borderRadius: 'var(--radius-md)', padding: '16px', overflowX: 'auto' }}>
                                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>Script Preview</div>
                                    <pre style={{ margin: 0, color: '#e2e8f0', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
                                        {getGeneratedScript()}
                                    </pre>
                                </div>
                            )}

                            {configGenerated && (
                                <div style={{ marginTop: 12, color: '#16a34a', fontWeight: 500, fontSize: '0.85rem' }}>
                                    ✅ Configuration generated and downloaded!
                                </div>
                            )}
                        </div>

                        <div style={{
                            maxWidth: 600, margin: '0 auto', padding: 20,
                            background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 'var(--radius-sm)', textAlign: 'left',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <WarningAmberIcon style={{ fontSize: 18, color: '#d97706' }} />
                                <strong style={{ fontSize: '0.9rem' }}>Next Steps:</strong>
                            </div>
                            <ol style={{ paddingLeft: 20, margin: 0, fontSize: '0.85rem', color: '#374151', lineHeight: 1.8 }}>
                                <li>Download the generated RSC file</li>
                                <li>Upload it to your MikroTik router via Winbox Files</li>
                                <li>Import it using Terminal: <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: 4, color: 'var(--primary)' }}>/import filename.rsc</code></li>
                                <li>Wait for import completion (1-2 minutes)</li>
                                <li>Click "Next" to verify the configuration</li>
                            </ol>
                        </div>
                    </div>
                );

            /* ───────── STEP 6 : Verify ───────── */
            case 6:
                return (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <VerifiedIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
                        <h2 style={{ marginBottom: 6 }}>Configuration Status Verification</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Verifying service configuration</p>

                        {/* Service Checks */}
                        <div style={{ display: 'grid', gridTemplateColumns: vpnEnabled ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr', gap: 16, maxWidth: 650, margin: '0 auto 24px' }}>
                            <div style={{
                                textAlign: 'left', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
                            }}>
                                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {serviceType === 'hotspot' ? <WifiIcon style={{ fontSize: 16 }} /> : serviceType === 'both' ? <DeviceHubIcon style={{ fontSize: 16 }} /> : <DnsIcon style={{ fontSize: 16 }} />}
                                    {serviceType === 'pppoe' ? 'PPPoE Server Status' : serviceType === 'hotspot' ? 'Hotspot Server Status' : 'PPPoE & Hotspot Status'}
                                </div>
                                <div style={{ padding: 20, textAlign: 'center' }}>
                                    {verifyStatus === 'checking' ? (
                                        <>
                                            <RefreshIcon className="spin" style={{ fontSize: 40, color: 'var(--primary)', marginBottom: 8 }} />
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Checking {serviceType === 'both' ? 'services' : 'server'}...</div>
                                        </>
                                    ) : verifyStatus === 'failed' ? (
                                        <>
                                            <CancelIcon style={{ fontSize: 40, color: 'var(--primary)', marginBottom: 8 }} />
                                            <div style={{ color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>Configuration Failed</div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{serviceType === 'pppoe' ? 'PPPoE Server' : serviceType === 'hotspot' ? 'Hotspot Server' : 'Services'} not found</div>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircleIcon style={{ fontSize: 40, color: '#16a34a', marginBottom: 8 }} />
                                            <div style={{ color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>Configuration Successful</div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{serviceType === 'pppoe' ? 'PPPoE Server is' : serviceType === 'hotspot' ? 'Hotspot Server is' : 'Services are'} running</div>
                                        </>
                                    )}
                                </div>
                            </div>
                            {vpnEnabled && (
                                <div style={{
                                    textAlign: 'left', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
                                }}>
                                    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <VpnKeyIcon style={{ fontSize: 16 }} /> VPN Server Status
                                    </div>
                                    <div style={{ padding: 20, textAlign: 'center' }}>
                                        {verifyStatus === 'checking' ? (
                                            <>
                                                <RefreshIcon className="spin" style={{ fontSize: 40, color: '#7c3aed', marginBottom: 8 }} />
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Checking VPN status...</div>
                                            </>
                                        ) : verifyStatus === 'failed' ? (
                                            <>
                                                <CancelIcon style={{ fontSize: 40, color: '#d97706', marginBottom: 8 }} />
                                                <div style={{ color: '#d97706', fontWeight: 600, marginBottom: 4 }}>Pending Setup</div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{vpnProtocol} server not yet active</div>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircleIcon style={{ fontSize: 40, color: '#16a34a', marginBottom: 8 }} />
                                                <div style={{ color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>VPN Active</div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{vpnProtocol} with {vpnSecrets.length} secret(s)</div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Overall Status */}
                        <div style={{
                            maxWidth: 600, margin: '0 auto', padding: 30,
                            border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)',
                        }}>
                            {verifyStatus === 'failed' ? (
                                <>
                                    <CancelIcon style={{ fontSize: 48, color: 'var(--primary)', marginBottom: 12 }} />
                                    <h3 style={{ color: 'var(--primary)', marginBottom: 16 }}>Configuration Failed</h3>
                                    <div style={{
                                        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)',
                                        padding: '12px 16px', fontSize: '0.85rem', color: '#b91c1c', marginBottom: 20,
                                    }}>
                                        All service configurations failed. Please check your RSC file import and try again.
                                    </div>
                                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                                        <button className="btn btn-secondary" onClick={() => setCurrentStep(0)}>
                                            <ArrowBackIcon fontSize="small" /> Go Back and Try Again
                                        </button>
                                        <button className="btn btn-secondary" onClick={() => onClose ? onClose() : navigate('/mikrotiks')}>
                                            <ListIcon fontSize="small" /> Back to Router List
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <CheckCircleIcon style={{ fontSize: 48, color: '#16a34a', marginBottom: 12 }} />
                                    <h3 style={{ color: '#16a34a' }}>All Systems Go!</h3>
                                    <p style={{ color: '#374151', fontSize: '0.9rem', margin: '8px 0 20px' }}>
                                        Router <strong>{routerName}</strong> is fully configured and connected.
                                        {vpnEnabled && ` VPN server (${vpnMode}) is active with ${vpnSecrets.length} user(s).`}
                                    </p>
                                    <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 24px' }}
                                        onClick={() => onClose ? onClose() : navigate('/mikrotiks')}>
                                        Go to Routers Dashboard
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 80 }}>
            {/* Title */}
            <div style={{ marginBottom: 4 }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 2 }}>Router Setup Wizard</h1>
                <p style={{ color: '#0d9488', fontSize: '0.9rem' }}>{routerName}</p>
            </div>

            {/* Stepper */}
            <div style={{ overflowX: 'auto', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 0', margin: '0 auto', maxWidth: 800, minWidth: 760 }}>
                    {steps.map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
                            <div style={{ textAlign: 'center', minWidth: 60 }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: '50%', margin: '0 auto 4px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: i < currentStep ? '#16a34a' : i === currentStep ? (i === 3 ? '#7c3aed' : '#16a34a') : '#e5e7eb',
                                    color: i <= currentStep ? '#fff' : '#9ca3af',
                                    fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.3s',
                                }}>
                                    {i < currentStep ? <CheckCircleIcon style={{ fontSize: 18 }} /> : React.cloneElement(step.icon, { style: { fontSize: 18 } })}
                                </div>
                                <div style={{ fontSize: '0.7rem', fontWeight: i === currentStep ? 700 : 400, color: i <= currentStep ? (i === 3 && i === currentStep ? '#7c3aed' : '#16a34a') : '#9ca3af' }}>{step.label}</div>
                                <div style={{ fontSize: '0.6rem', color: i <= currentStep ? (i === 3 && i === currentStep ? '#7c3aed' : '#16a34a') : '#9ca3af' }}>{step.sub}</div>
                            </div>
                            {i < steps.length - 1 && (
                                <div style={{
                                    flex: 1, height: 2, margin: '0 4px',
                                    background: i < currentStep ? '#16a34a' : '#e5e7eb',
                                    transition: 'all 0.3s', marginBottom: 24,
                                }} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step Content */}
            <div style={{ paddingBottom: 16 }}>
                {renderStepContent()}
            </div>

            {/* Navigation — fixed at bottom, always visible */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 24px',
                borderTop: '1px solid var(--border-light)',
                background: 'var(--bg-primary, #fff)',
                zIndex: 100,
                boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
            }}>
                <div>
                    {currentStep > 0 && (
                        <button className="btn btn-secondary" onClick={handlePrev}>
                            <ArrowBackIcon fontSize="small" /> Previous
                        </button>
                    )}
                </div>
                {currentStep === 6 && (verifyStatus === 'failed' || verifyStatus === 'checking') ? (
                    <button className="btn" style={{ background: '#f3f4f6', color: '#374151', fontWeight: 600, border: '1px solid var(--border)' }}
                        onClick={async () => {
                            setVerifyStatus('checking');
                            try {
                                if (routerId) {
                                    const result = await routersApi.testConnection(routerId);
                                    setVerifyStatus((result as any).success ? 'success' : 'failed');
                                } else {
                                    setVerifyStatus('failed');
                                }
                            } catch {
                                setVerifyStatus('failed');
                            }
                        }}>
                        <RefreshIcon fontSize="small" /> {verifyStatus === 'checking' ? 'Checking...' : 'Recheck Status'}
                    </button>
                ) : (
                    <button className="btn" style={{ background: currentStep === 3 ? '#7c3aed' : '#16a34a', color: '#fff', fontWeight: 600 }} onClick={handleNext}>
                        {getNextButtonLabel()} <ArrowForwardIcon fontSize="small" />
                    </button>
                )}
            </div>
        </div>
    );
}
