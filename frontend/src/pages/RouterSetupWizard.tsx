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
import { buildRouterSetupWizardScript, validateRouterSetupWizardServiceInputs } from '../utils/routerSetupWizardScript';

import {
    WIZARD_STEPS, NEXT_BUTTON_LABELS,
    type EthernetInterface, type VpnSecret, type ServiceType, type VpnMode, type VerifyStatus,
} from '../components/wizard/WizardTypes';
import { Step0Download, Step1Connection } from '../components/wizard/WizardSteps01';
import { Step2Services, Step3Vpn }         from '../components/wizard/WizardSteps23';
import { Step4Interfaces, Step5Generate, Step6Verify } from '../components/wizard/WizardSteps456';

// SEC-ROUTER-003 FIX: the wizard previously shipped with hardcoded, static
// default secrets (`hqinvestment_radius_secret`, `MyISPVpnKey2024!`) that
// were identical across every tenant/router unless an operator remembered to
// overwrite them by hand. Generate a cryptographically random secret in the
// browser instead (Web Crypto, not Math.random) so every router gets a
// unique value out of the box.
const SECRET_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function generateClientSecureSecret(length = 24): string {
    const bytes = new Uint8Array(length);
    (window.crypto || (window as any).msCrypto).getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < length; i++) out += SECRET_ALPHABET[bytes[i] % SECRET_ALPHABET.length];
    return out;
}
// Legacy static defaults that must never be trusted/kept if found in saved
// state or a stale draft — these are known, guessable, cross-tenant values.
const KNOWN_INSECURE_SECRETS = new Set(['hqinvestment_radius_secret', 'MyISPVpnKey2024!']);

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
    // SEC-ROUTER-003 FIX: no static default — generated below once (see
    // effect further down), or pulled from the router's real, already-
    // provisioned radiusSecret when available so it matches the RADIUS NAS
    // entry the backend already created for this router.
    const [radiusSecret, setRadiusSecret]   = useState('');

    // Step 3: VPN
    const [vpnEnabled, setVpnEnabled]       = useState(true);
    const [vpnMode, setVpnMode]             = useState<VpnMode>('hybrid');
    const [vpnProtocol, setVpnProtocol]     = useState('L2TP');
    const [vpnPoolStart, setVpnPoolStart]   = useState('10.0.0.2');
    const [vpnPoolEnd, setVpnPoolEnd]       = useState('10.0.0.254');
    const [vpnDns, setVpnDns]               = useState('8.8.8.8');
    const [ipsecSecret, setIpsecSecret]     = useState(() => generateClientSecureSecret(24));
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

    // SEC-ROUTER-003 FIX: once the router record loads, prefer its REAL
    // radiusSecret (already generated + synced to the RADIUS NAS table by
    // the backend when the router was created) over any placeholder — using
    // a different value here would silently break RADIUS auth because it
    // would no longer match the NAS entry. Masked values ("****1234",
    // returned to non-super-admin roles) and known legacy static defaults
    // are never trusted as a real secret; in that case we generate a random
    // one client-side instead of falling back to a static string.
    // Runs once per routerData load (guarded so it never overwrites a value
    // the operator has since edited by hand).
    useEffect(() => {
        if (!routerData) return;
        setRadiusSecret(prev => {
            if (prev) return prev; // already set (from backend or a previous run) — don't clobber operator edits
            const real = routerData.radiusSecret as string | undefined;
            const usable = real && !real.startsWith('****') && !KNOWN_INSECURE_SECRETS.has(real);
            return usable ? (real as string) : generateClientSecureSecret(32);
        });
    }, [routerData]);

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
        try { setInterfaces(await routersApi.listInterfaces(routerId)); }
        catch (err) { console.error('Failed to fetch interfaces:', err); }
        finally { setLoadingInterfaces(false); }
    };

    const runVerify = async () => {
        setServiceVerifyStatus('checking'); setVpnVerifyStatus('checking');
        if (!routerId) { setServiceVerifyStatus('failed'); setVpnVerifyStatus('failed'); return; }
        try {
            const connRes = await routersApi.testConnection(routerId);
            if (!connRes.success) { setServiceVerifyStatus('failed'); setVpnVerifyStatus('failed'); return; }

            // Service-specific verification: check for hotspot/PPPoE presence on the router
            let serviceVerified = false;
            try {
                if (serviceType === 'pppoe') {
                    // PPPoE-only: verify PPPoE users endpoint is accessible
                    await routersApi.getPPPoEUsers(routerId);
                    serviceVerified = true;
                } else if (serviceType === 'hotspot') {
                    // Hotspot-only: verify hotspot users endpoint is accessible
                    await routersApi.getHotspotUsers(routerId);
                    serviceVerified = true;
                } else if (serviceType === 'both') {
                    // Both: verify both endpoints are accessible
                    await Promise.all([
                        routersApi.getPPPoEUsers(routerId),
                        routersApi.getHotspotUsers(routerId),
                    ]);
                    serviceVerified = true;
                }
                setServiceVerifyStatus(serviceVerified ? 'success' : 'failed');
            } catch (err) {
                setServiceVerifyStatus('failed');
            }

            // VPN verification
            if (vpnEnabled) setVpnVerifyStatus(connRes.success ? 'success' : 'failed');
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

    // SEC-ROUTER-002 FIX (parity with backend /api/routers/[id]/script):
    // derive the VPN /24 management subnet from the WireGuard tunnel IP, so
    // Winbox/Web/API firewall rules can be scoped to it instead of the WAN.
    const vpnManagementSubnet: string | null = wgConfig?.routerTunnelIp
        ? `${(wgConfig.routerTunnelIp as string).split('.').slice(0, 3).join('.')}.0/24`
        : null;
    const certName = 'hq-hotspot-cert';

    const getGeneratedScript = (): string => {
        const serviceValidation = validateRouterSetupWizardServiceInputs({
            serviceType,
            hotspotLocalAddress,
            pppoeLocalAddress,
            hotspotPoolStart,
            hotspotPoolEnd,
            pppoePoolStart,
            pppoePoolEnd,
        });

        if (!serviceValidation.ok) {
            alert(`Missing required PPPoE/Hotspot values: ${serviceValidation.missingFields.join(', ')}. Please fill them in before generating the script.`);
            return '';
        }

        // SEC-ROUTER-001/003 FIX: block generation (same as the backend
        // validation layer) if required secrets are missing or still match a
        // known-insecure legacy static default, instead of silently shipping
        // an empty/guessable value to the router.
        if (!radiusSecret || KNOWN_INSECURE_SECRETS.has(radiusSecret)) {
            alert('RADIUS shared secret haipo au si salama. Tafadhali subiri ipakiwe kiotomatiki au weka secret yako kwenye Hatua 2.');
            return '';
        }
        if (vpnEnabled && (vpnProtocol === 'L2TP' || vpnMode === 'hybrid') && (!ipsecSecret || KNOWN_INSECURE_SECRETS.has(ipsecSecret))) {
            alert('IPsec Pre-Shared Key haipo au si salama. Tafadhali weka key yenye nguvu kwenye Hatua 3.');
            return '';
        }
        if (vpnSecrets.some(s => !s.password || s.password.length < 8)) {
            alert('Baadhi ya VPN secrets zina password dhaifu (chini ya herufi 8). Rekebisha kwenye Hatua 3 kabla ya kuendelea.');
            return '';
        }

        return buildRouterSetupWizardScript({
            routerName,
            routerId: routerId || '',
            publicApiBase,
            apiHost,
            serviceType,
            selectedInterfaces,
            vpnEnabled,
            vpnProtocol,
            vpnPoolStart,
            vpnPoolEnd,
            vpnSecrets: vpnSecrets.map((s) => ({
                username: s.username,
                password: s.password,
                protocol: s.protocol,
                profile: s.profile,
                localAddress: s.localAddress,
                remoteAddress: s.remoteAddress,
            })),
            hotspotLocalAddress,
            hotspotPoolStart,
            hotspotPoolEnd,
            pppoeLocalAddress,
            pppoePoolStart,
            pppoePoolEnd,
            radiusAddress,
            radiusSecret,
            vpnMode,
            vpnDns,
            ipsecSecret,
            wgConfig,
            certName,
            vpnManagementSubnet,
            dnsServers: (routerData && (routerData.dns as string)) || vpnDns || '8.8.8.8,8.8.4.4',
        });
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
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 24px', borderTop: '1px solid var(--border-light)', background: 'var(--bg-primary, #fff)', zIndex: 100, boxShadow: '0 -2px 8px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', minWidth: 120 }}>
                    {currentStep > 0 && (
                        <button className="btn btn-secondary" onClick={handlePrev} style={{ minWidth: 140, justifyContent: 'center' }}>
                            <ArrowBackIcon fontSize="small" /> Previous
                        </button>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 220 }}>
                    {currentStep === 6 && (serviceVerifyStatus === 'failed' || serviceVerifyStatus === 'checking') ? (
                        <button className="btn" style={{ background: '#f3f4f6', color: '#374151', fontWeight: 600, border: '1px solid var(--border)', minWidth: 170, justifyContent: 'center' }} onClick={runVerify}>
                            <RefreshIcon fontSize="small" /> {serviceVerifyStatus === 'checking' ? 'Checking...' : 'Recheck Status'}
                        </button>
                    ) : (
                        <button className="btn" style={{ background: currentStep === 3 ? '#7c3aed' : '#16a34a', color: '#fff', fontWeight: 600, minWidth: 220, justifyContent: 'center' }} onClick={handleNext}>
                            {NEXT_BUTTON_LABELS[currentStep] ?? 'Next'} <ArrowForwardIcon fontSize="small" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
