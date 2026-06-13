/**
 * RouterSetupWizard — FE-001 refactor
 *
 * Before: 1,531 lines (114 KB) — all state, logic, and JSX in one file
 * After:  ~220 lines — pure orchestrator, all JSX in sub-components:
 *
 *   WizardTypes.tsx      — shared types + WizardStepBar
 *   WizardSteps01.tsx    — Step 0 (download) + Step 1 (connection)
 *   WizardSteps23.tsx    — Step 2 (services) + Step 3 (VPN)
 *   WizardSteps456.tsx   — Step 4 (interfaces) + Step 5 (generate) + Step 6 (verify)
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { routersApi, vpnApi } from '../api';
import { getPublicApiBase } from '../utils/config';
import { sanitizeMikroTikName } from '../utils/mikrotikUtils';

import {
    WIZARD_STEPS, NEXT_BUTTON_LABELS,
    type EthernetInterface, type VpnSecret, type ServiceType, type VpnMode, type VerifyStatus,
} from '../components/wizard/WizardTypes';
import { Step0Download, Step1Connection } from '../components/wizard/WizardSteps01';
import { Step2Services, Step3Vpn }         from '../components/wizard/WizardSteps23';
import { Step4Interfaces, Step5Generate, Step6Verify } from '../components/wizard/WizardSteps456';

interface RouterSetupWizardProps {
    router?: any;
    onClose?: () => void;
}

export default function RouterSetupWizard({ router: routerProp, onClose }: RouterSetupWizardProps = {}) {
    const { id: paramId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const routerId = routerProp?.id || paramId;

    // ── Core state ────────────────────────────────────────────────────────
    const [currentStep, setCurrentStep]   = useState(0);
    const [routerData, setRouterData]     = useState<any>(routerProp || null);

    // Step 1: connection
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');
    const [connectionError, setConnectionError]   = useState<string | null>(null);

    // Step 2: services
    const [serviceType, setServiceType]       = useState<ServiceType>('hotspot');
    const [pppoeLocalAddress, setPppoeLocalAddress] = useState('');
    const [pppoePoolStart, setPppoePoolStart]       = useState('');
    const [pppoePoolEnd, setPppoePoolEnd]           = useState('');
    const [hotspotLocalAddress, setHotspotLocalAddress] = useState('');
    const [hotspotPoolStart, setHotspotPoolStart]       = useState('');
    const [hotspotPoolEnd, setHotspotPoolEnd]           = useState('');
    const [radiusAddress, setRadiusAddress] = useState('');
    const [radiusSecret, setRadiusSecret]   = useState('hqinvestment_radius_secret');

    // Step 3: VPN
    const [vpnEnabled, setVpnEnabled]       = useState(true);
    const [vpnMode, setVpnMode]             = useState<VpnMode>('hybrid');
    const [vpnProtocol, setVpnProtocol]     = useState('L2TP');
    const [vpnPoolStart, setVpnPoolStart]   = useState('10.0.0.2');
    const [vpnPoolEnd, setVpnPoolEnd]       = useState('10.0.0.254');
    const [vpnDns, setVpnDns]               = useState('8.8.8.8');
    const [ipsecSecret, setIpsecSecret]     = useState('MyISPVpnKey2024!');
    const [vpnSecrets, setVpnSecrets]       = useState<VpnSecret[]>([]);
    const [showAddVpnSecret, setShowAddVpnSecret] = useState(false);
    const [vpnForm, setVpnForm]             = useState<VpnSecret>({ username: '', password: '', protocol: 'L2TP', profile: 'default', localAddress: '', remoteAddress: '' });

    // Step 4: interfaces
    const [interfaces, setInterfaces]           = useState<EthernetInterface[]>([]);
    const [loadingInterfaces, setLoadingInterfaces] = useState(false);
    const [selectedInterfaces, setSelectedInterfaces] = useState<string[]>([]);

    // Step 5: generate
    const [configGenerated, setConfigGenerated] = useState(false);
    const [showPreview, setShowPreview]         = useState(false);
    const [wgConfig, setWgConfig]               = useState<any>(null);

    // Step 6: verify
    const [serviceVerifyStatus, setServiceVerifyStatus] = useState<VerifyStatus>('checking');
    const [vpnVerifyStatus, setVpnVerifyStatus]         = useState<VerifyStatus>('checking');

    // ── Derived ───────────────────────────────────────────────────────────
    const publicApiBase = getPublicApiBase();
    const apiHost = publicApiBase.startsWith('http') ? new URL(publicApiBase).hostname : window.location.hostname;
    const routerName = routerData?.name || 'Loading...';

    // ── Initialise ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!routerData && routerId) {
            routersApi.get(routerId).then(setRouterData).catch(console.error);
        }
    }, [routerId]);

    // Fetch WireGuard config → derive LAN IPs
    useEffect(() => {
        if (!routerId) return;
        routersApi.wireguard?.getConfig?.(routerId)
            .then((cfg: any) => {
                setWgConfig(cfg);
                if (!radiusAddress) setRadiusAddress(cfg?.serverTunnelIp ?? '10.0.0.1');
                if (cfg?.routerTunnelIp) {
                    const parts = cfg.routerTunnelIp.split('.');
                    const prefix = `${parts[0]}.10.${parts[2] || '0'}`;
                    const gw = `${prefix}.1`;
                    setPppoeLocalAddress(gw); setPppoePoolStart(`${prefix}.10`); setPppoePoolEnd(`${prefix}.254`);
                    setHotspotLocalAddress(gw); setHotspotPoolStart(`${prefix}.10`); setHotspotPoolEnd(`${prefix}.254`);
                }
            })
            .catch(() => { if (!radiusAddress) setRadiusAddress(apiHost); });
    }, [routerId]);

    // Per-step side-effects
    useEffect(() => {
        if (currentStep === 1) checkConnection();
        if (currentStep === 4) fetchInterfaces();
        if (currentStep === 6) runVerify();
    }, [currentStep]);

    // ── Actions ───────────────────────────────────────────────────────────
    const checkConnection = async () => {
        if (!routerId) return;
        setConnectionStatus('checking'); setConnectionError(null);
        try {
            const res = await routersApi.testConnection(routerId);
            setConnectionStatus(res.success ? 'online' : 'offline');
            if (!res.success) setConnectionError(res.message as string);
        } catch (err: any) {
            setConnectionStatus('offline');
            setConnectionError(err.message || 'Failed to connect');
        }
    };

    const fetchInterfaces = async () => {
        if (!routerId) return;
        setLoadingInterfaces(true);
        try { setInterfaces(await (routersApi as any).listInterfaces(routerId)); }
        catch (err) { console.error('Failed to fetch interfaces:', err); }
        finally { setLoadingInterfaces(false); }
    };

    const runVerify = async () => {
        setServiceVerifyStatus('checking'); setVpnVerifyStatus('checking');
        if (!routerId) { setServiceVerifyStatus('failed'); setVpnVerifyStatus('failed'); return; }
        try {
            const res = await routersApi.testConnection(routerId);
            if (res.success) {
                try {
                    await (routersApi as any).listInterfaces(routerId);
                    setServiceVerifyStatus('success');
                } catch { setServiceVerifyStatus('failed'); }
            } else { setServiceVerifyStatus('failed'); }
            if (vpnEnabled) setVpnVerifyStatus(res.success ? 'success' : 'failed');
            else setVpnVerifyStatus('success');
        } catch { setServiceVerifyStatus('failed'); setVpnVerifyStatus('failed'); }
    };

    const addVpnSecret = () => {
        if (!vpnForm.username || !vpnForm.password) { alert('Username and Password are required.'); return; }
        setVpnSecrets(prev => [...prev, { ...vpnForm, id: Date.now().toString() }]);
        setVpnForm({ username: '', password: '', protocol: vpnProtocol, profile: 'default', localAddress: '', remoteAddress: '' });
        setShowAddVpnSecret(false);
    };

    const toggleInterface = (name: string) => setSelectedInterfaces(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);

    const getGeneratedScript = (): string => {
        if (!hotspotLocalAddress || !pppoeLocalAddress) {
            alert('VPN IP not loaded yet. Please wait for WireGuard config to load, then try again.');
            return '';
        }
        const hotspotPrefix  = hotspotLocalAddress.split('.').slice(0, 3).join('.');
        const hotspotNetwork = `${hotspotPrefix}.0/24`;
        const hotspotCidr    = `${hotspotLocalAddress}/24`;
        const lines: string[] = [
            `# RSC Configuration for ${routerName}`,
            `# Generated: ${new Date().toISOString()}`,
            `# Service: ${serviceType === 'pppoe' ? 'PPPoE' : serviceType === 'hotspot' ? 'Hotspot' : 'PPPoE + Hotspot'}`,
            `# VPN Mode: ${vpnEnabled ? vpnMode : 'Disabled'}`,
            '', '# ===== Management Safety =====',
            '/tool mac-server set allowed-interface-list=all',
            '/tool mac-server mac-winbox set allowed-interface-list=all',
            '/ip neighbor discovery-settings set discover-interface-list=all',
            '', '# ===== Bridge Setup =====',
        ];
        if (selectedInterfaces.length > 0) {
            lines.push(
                ':local targetBridge "radiax_bridge"',
                `:if ([:len [/interface bridge find where name=$targetBridge]] = 0) do={ /interface bridge add name=$targetBridge comment="HQ Investment Bridge" }`,
            );
            selectedInterfaces.forEach(iface => {
                lines.push(
                    `:if ([:len [/interface bridge port find where interface="${iface}"]] = 0) do={ /interface bridge port add bridge=$targetBridge interface=${iface} }`,
                );
            });
        }
        if (serviceType === 'pppoe' || serviceType === 'both') {
            lines.push(
                '', '# ===== PPPoE Server =====',
                `:if ([:len [/ip pool find where name="pppoe-pool"]] = 0) do={ /ip pool add name="pppoe-pool" ranges=${pppoePoolStart}-${pppoePoolEnd} }`,
                `/ppp profile add name="pppoe-profile" local-address=${pppoeLocalAddress} dns-server=8.8.8.8,8.8.4.4 use-compression=no use-encryption=no`,
                `/interface pppoe-server server add service-name="hq-pppoe" interface=$targetBridge default-profile="pppoe-profile" authentication=mschapv2 disabled=no`,
            );
        }
        if (serviceType === 'hotspot' || serviceType === 'both') {
            lines.push(
                '', '# ===== Hotspot Server =====',
                `:if ([:len [/ip pool find where name="hs-pool"]] = 0) do={ /ip pool add name="hs-pool" ranges=${hotspotPoolStart}-${hotspotPoolEnd} }`,
                `:if ([:len [/ip address find where interface=$targetBridge]] = 0) do={ /ip address add address=${hotspotCidr} interface=$targetBridge }`,
                `:if ([:len [/ip hotspot find where interface=$targetBridge]] = 0) do={ /ip hotspot add name="hq-hotspot" interface=$targetBridge address-pool="hs-pool" profile="hq-hotspot" }`,
                `/ip hotspot profile set [/ip hotspot profile find where name="default"] hotspot-address=${hotspotLocalAddress} html-directory=hotspot`,
                `/ip hotspot profile add name="hq-hotspot" hotspot-address=${hotspotLocalAddress} html-directory=hotspot login-by=mac-cookie,http-chap use-radius=yes`,
                `/ip dhcp-server network add address=${hotspotNetwork} gateway=${hotspotLocalAddress} dns-server=8.8.8.8,8.8.4.4`,
            );
        }
        if (vpnEnabled) {
            lines.push('', '# ===== VPN Server =====');
            if (vpnProtocol === 'L2TP' || vpnMode === 'hybrid') {
                lines.push(
                    `/ip pool add name="vpn-pool" ranges=${vpnPoolStart}-${vpnPoolEnd}`,
                    `/ppp profile add name="vpn-profile" local-address=${pppoeLocalAddress || hotspotLocalAddress} remote-address="vpn-pool" dns-server=${vpnDns}`,
                    `/interface l2tp-server server set enabled=yes use-ipsec=yes ipsec-secret="${ipsecSecret}" default-profile="vpn-profile"`,
                );
            }
            if (vpnSecrets.length > 0) {
                vpnSecrets.forEach(s => {
                    lines.push(`/ppp secret add name="${s.username}" password="${s.password}" service=${s.protocol.toLowerCase()} profile="vpn-profile"${s.localAddress ? ` local-address=${s.localAddress}` : ''}${s.remoteAddress ? ` remote-address=${s.remoteAddress}` : ''}`);
                });
            }
        }
        lines.push(
            '', '# ===== RADIUS Client =====',
            `:if ([:len [/radius find where address="${radiusAddress}"]] = 0) do={`,
            `  /radius add service=hotspot,ppp address=${radiusAddress} secret="${radiusSecret}" authentication-port=1812 accounting-port=1813 timeout=3s`,
            `}`,
            `/radius incoming set accept=yes port=3799`,
            '/ppp aaa set use-radius=yes accounting=yes',
            '', '# ===== Walled Garden =====',
            `:if ([:len [/ip hotspot walled-garden find where dst-host="${apiHost}"]] = 0) do={ /ip hotspot walled-garden add dst-host="${apiHost}" action=allow comment="Billing Portal" }`,
            `:if ([:len [/ip hotspot walled-garden ip find where dst-address="${radiusAddress}"]] = 0) do={ /ip hotspot walled-garden ip add dst-address="${radiusAddress}" action=accept comment="Billing Portal IP" }`,
            ...(wgConfig?.routerTunnelIp ? [`:if ([:len [/ip hotspot walled-garden ip find where dst-address="${wgConfig.routerTunnelIp.split('.').slice(0,3).join('.')}.0/24"]] = 0) do={ /ip hotspot walled-garden ip add dst-address="${wgConfig.routerTunnelIp.split('.').slice(0,3).join('.')}.0/24" action=accept comment="VPN Subnet" }`] : []),
            '', '# ===== NAT (Masquerade) =====',
            ':if ([:len [/ip firewall nat find where action=masquerade]] = 0) do={ /ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade }',
            '', '# ===== System Scheduler =====',
            `:if ([:len [/system scheduler find name="billing-sync"]] > 0) do={ /system scheduler remove [find name="billing-sync"] }`,
            `/system scheduler add name="billing-sync" interval=5m on-event=":tool fetch url=${publicApiBase}/api/sync/ keep-result=no" start-time=00:00:00`,
            '', '# ===== Logging =====',
            ':if ([:len [/system logging find topics=hotspot]] = 0) do={ /system logging add topics=hotspot action=memory }',
            ':if ([:len [/system logging find topics=radius]] = 0) do={ /system logging add topics=radius action=memory }',
            '', '# Configuration complete',
        );
        return lines.join('\n');
    };

    const handleDownloadConfig = () => {
        const content = getGeneratedScript();
        if (!content) return;
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${sanitizeMikroTikName(routerName)}_config.rsc`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setConfigGenerated(true);
    };

    const handleNext = () => {
        if (currentStep === 1 && connectionStatus !== 'online') { alert('Please wait for connection check or ensure router is online.'); return; }
        if (currentStep === 4 && selectedInterfaces.length === 0) { alert('Please select at least one interface for the service bridge.'); return; }
        if (currentStep === 5 && !configGenerated) { if (!window.confirm('You have not generated the RSC config yet. Continue anyway?')) return; }
        if (currentStep < WIZARD_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            if (vpnEnabled && vpnSecrets.length > 0 && routerId) {
                vpnSecrets.forEach(s => {
                    (vpnApi as any).create({ ...s, routerId, service: s.protocol.toLowerCase() }).catch(console.error);
                });
            }
            if (onClose) onClose(); else navigate('/mikrotiks');
        }
    };
    const handlePrev   = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };
    const handleFinish = () => { if (onClose) onClose(); else navigate('/mikrotiks'); };

    // ── Step switcher ─────────────────────────────────────────────────────
    const renderStep = () => {
        switch (currentStep) {
            case 0: return <Step0Download routerName={routerName} wgConfig={wgConfig} />;
            case 1: return <Step1Connection connectionStatus={connectionStatus} connectionError={connectionError} routerData={routerData} onRetry={checkConnection} onNext={handleNext} onBack={() => setCurrentStep(0)} />;
            case 2: return <Step2Services serviceType={serviceType} setServiceType={setServiceType} pppoeLocalAddress={pppoeLocalAddress} setPppoeLocalAddress={setPppoeLocalAddress} pppoePoolStart={pppoePoolStart} setPppoePoolStart={setPppoePoolStart} pppoePoolEnd={pppoePoolEnd} setPppoePoolEnd={setPppoePoolEnd} hotspotLocalAddress={hotspotLocalAddress} setHotspotLocalAddress={setHotspotLocalAddress} hotspotPoolStart={hotspotPoolStart} setHotspotPoolStart={setHotspotPoolStart} hotspotPoolEnd={hotspotPoolEnd} setHotspotPoolEnd={setHotspotPoolEnd} radiusAddress={radiusAddress} setRadiusAddress={setRadiusAddress} radiusSecret={radiusSecret} setRadiusSecret={setRadiusSecret} />;
            case 3: return <Step3Vpn vpnEnabled={vpnEnabled} setVpnEnabled={setVpnEnabled} vpnMode={vpnMode} setVpnMode={setVpnMode} vpnProtocol={vpnProtocol} setVpnProtocol={setVpnProtocol} vpnPoolStart={vpnPoolStart} setVpnPoolStart={setVpnPoolStart} vpnPoolEnd={vpnPoolEnd} setVpnPoolEnd={setVpnPoolEnd} vpnDns={vpnDns} setVpnDns={setVpnDns} ipsecSecret={ipsecSecret} setIpsecSecret={setIpsecSecret} vpnSecrets={vpnSecrets} showAddVpnSecret={showAddVpnSecret} setShowAddVpnSecret={setShowAddVpnSecret} vpnForm={vpnForm} setVpnForm={setVpnForm} onAddSecret={addVpnSecret} onRemoveSecret={i => setVpnSecrets(prev => prev.filter((_, idx) => idx !== i))} />;
            case 4: return <Step4Interfaces routerName={routerName} interfaces={interfaces} loadingInterfaces={loadingInterfaces} selectedInterfaces={selectedInterfaces} onToggleInterface={toggleInterface} onRefresh={fetchInterfaces} />;
            case 5: return <Step5Generate routerName={routerName} serviceType={serviceType} selectedInterfaces={selectedInterfaces} vpnEnabled={vpnEnabled} vpnProtocol={vpnProtocol} vpnPoolStart={vpnPoolStart} vpnPoolEnd={vpnPoolEnd} vpnSecrets={vpnSecrets} hotspotLocalAddress={hotspotLocalAddress} pppoeLocalAddress={pppoeLocalAddress} configGenerated={configGenerated} showPreview={showPreview} setShowPreview={setShowPreview} getGeneratedScript={getGeneratedScript} onDownload={handleDownloadConfig} />;
            case 6: return <Step6Verify routerName={routerName} serviceType={serviceType} vpnEnabled={vpnEnabled} vpnMode={vpnMode} vpnSecrets={vpnSecrets} serviceVerifyStatus={serviceVerifyStatus} vpnVerifyStatus={vpnVerifyStatus} onGoBack={() => setCurrentStep(0)} onFinish={handleFinish} />;
            default: return null;
        }
    };

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 80 }}>
            {/* Header */}
            <div style={{ marginBottom: 4 }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 2 }}>Router Setup Wizard</h1>
                <p style={{ color: '#0d9488', fontSize: '0.9rem' }}>{routerName}</p>
            </div>

            {/* Step bar */}
            <div style={{ overflowX: 'auto', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 0', margin: '0 auto', maxWidth: 800 }}>
                    {WIZARD_STEPS.map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < WIZARD_STEPS.length - 1 ? 1 : 0 }}>
                            <div style={{ textAlign: 'center', minWidth: 60 }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: i < currentStep ? '#16a34a' : i === currentStep ? (i === 3 ? '#7c3aed' : '#16a34a') : '#e5e7eb', color: i <= currentStep ? '#fff' : '#9ca3af', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.3s' }}>
                                    {i < currentStep ? <CheckCircleIcon style={{ fontSize: 18 }} /> : <span style={{ fontSize: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{step.icon}</span>}
                                </div>
                                <div style={{ fontSize: '0.7rem', fontWeight: i === currentStep ? 700 : 400, color: i <= currentStep ? (i === 3 && i === currentStep ? '#7c3aed' : '#16a34a') : '#9ca3af' }}>{step.label}</div>
                                <div style={{ fontSize: '0.6rem', color: i <= currentStep ? (i === 3 && i === currentStep ? '#7c3aed' : '#16a34a') : '#9ca3af' }}>{step.sub}</div>
                            </div>
                            {i < WIZARD_STEPS.length - 1 && (
                                <div style={{ flex: 1, height: 2, margin: '0 4px', background: i < currentStep ? '#16a34a' : '#e5e7eb', transition: 'all 0.3s', marginBottom: 24 }} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Step content */}
            <div style={{ paddingBottom: 16 }}>{renderStep()}</div>

            {/* Fixed nav bar */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderTop: '1px solid var(--border-light)', background: 'var(--bg-primary, #fff)', zIndex: 100, boxShadow: '0 -2px 8px rgba(0,0,0,0.08)' }}>
                <div>
                    {currentStep > 0 && (
                        <button className="btn btn-secondary" onClick={handlePrev}>
                            <ArrowBackIcon fontSize="small" /> Previous
                        </button>
                    )}
                </div>
                {currentStep === 6 && (serviceVerifyStatus === 'failed' || serviceVerifyStatus === 'checking') ? (
                    <button className="btn" style={{ background: '#f3f4f6', color: '#374151', fontWeight: 600, border: '1px solid var(--border)' }} onClick={runVerify}>
                        <RefreshIcon fontSize="small" /> {serviceVerifyStatus === 'checking' ? 'Checking...' : 'Recheck Status'}
                    </button>
                ) : (
                    <button className="btn" style={{ background: currentStep === 3 ? '#7c3aed' : '#16a34a', color: '#fff', fontWeight: 600 }} onClick={handleNext}>
                        {NEXT_BUTTON_LABELS[currentStep] ?? 'Next'} <ArrowForwardIcon fontSize="small" />
                    </button>
                )}
            </div>
        </div>
    );
}
