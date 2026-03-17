import { useState, useEffect } from 'react';
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
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { routersApi } from '../api/client';

const steps = [
    { label: 'Download', sub: 'OVPN Script', icon: <DownloadIcon /> },
    { label: 'Connection', sub: 'Verify Online', icon: <CableIcon /> },
    { label: 'Services', sub: 'Choose Setup', icon: <SettingsIcon /> },
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

const mockInterfaces: EthernetInterface[] = [
    { name: 'ether1-ISP', type: 'ether', mac: 'D4:01:C3:8B:99:EA', status: 'Up' },
    { name: 'ether2-LAN', type: 'ether', mac: 'D4:01:C3:8B:99:EB', status: 'Down' },
    { name: 'ether3-HOTSPOT', type: 'ether', mac: 'D4:01:C3:8B:99:EC', status: 'Up' },
    { name: 'ether4-HOTSPOT', type: 'ether', mac: 'D4:01:C3:8B:99:ED', status: 'Down' },
    { name: 'ether5-HOTSPOT', type: 'ether', mac: 'D4:01:C3:8B:99:EE', status: 'Down' },
];

export default function RouterSetupWizard() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [routerData, setRouterData] = useState<any>(null);

    useEffect(() => {
        if (id) {
            routersApi.get(id).then(data => setRouterData(data)).catch(console.error);
        }
    }, [id]);

    const routerName = routerData?.name || 'Loading...';

    // Step 3 state
    const [serviceType, setServiceType] = useState<'pppoe' | 'hotspot' | 'both'>('pppoe');

    // Step 4 state
    const [selectedInterfaces, setSelectedInterfaces] = useState<string[]>([]);

    // Step 5 state
    const [configGenerated, setConfigGenerated] = useState(false);

    // Step 6 state
    const [verifyStatus, setVerifyStatus] = useState<'checking' | 'success' | 'failed'>('failed');

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            navigate('/mikrotiks');
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
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
            case 2: return 'Next: Select Interfaces';
            case 3: return 'Next: Generate Config';
            case 4: return 'Next: Verify Setup';
            case 5: return 'Finish Setup';
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
                                    const scriptContent = `# OpenVPN Setup Script for ${routerName}\n/interface ovpn-client add name=ovpn-out1 connect-to=vpn.example.com user=vpn password=secret\n/ip hotspot walled-garden\nadd action=allow dst-host=*example.com\n`;
                                    const blob = new Blob([scriptContent], { type: 'text/plain' });
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
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Monitoring router connection</p>

                        <div style={{
                            maxWidth: 500, margin: '0 auto', padding: 40,
                            border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-surface)',
                        }}>
                            <CheckCircleIcon style={{ fontSize: 56, color: '#16a34a', marginBottom: 16 }} />
                            <h3 style={{ color: '#16a34a', marginBottom: 6 }}>Router is Online!</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>VPN connection established successfully</p>

                            <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 24px', borderRadius: 'var(--radius-sm)', marginTop: 24 }}
                                onClick={handleNext}>
                                Continue to Service Selection <ArrowForwardIcon fontSize="small" />
                            </button>
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

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 750, margin: '0 auto' }}>
                            {/* PPPoE Server Only */}
                            <div
                                onClick={() => setServiceType('pppoe')}
                                style={{
                                    border: serviceType === 'pppoe' ? '2px solid #0d9488' : '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)', padding: 20, cursor: 'pointer',
                                    background: serviceType === 'pppoe' ? '#f0fdfa' : '#fff',
                                    transition: 'all 0.2s', textAlign: 'center',
                                }}
                            >
                                <DnsIcon style={{ fontSize: 40, color: 'var(--text-secondary)', marginBottom: 12 }} />
                                <h4 style={{ marginBottom: 4 }}>PPPoE Server Only</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                                    Configure PPPoE server for client connections
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
                                    <div style={{
                                        width: 16, height: 16, borderRadius: '50%',
                                        border: serviceType === 'pppoe' ? '5px solid #0d9488' : '2px solid var(--border)',
                                    }} />
                                    <span style={{ fontSize: '0.82rem', fontWeight: 500, color: serviceType === 'pppoe' ? '#0d9488' : 'var(--text-secondary)' }}>
                                        Select PPPoE Server
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    radiax_pppoe bridge &nbsp;&nbsp; 10.10.10.x network<br />
                                    radiax-pppoe service
                                </div>
                            </div>

                            {/* Hotspot Only */}
                            <div
                                onClick={() => setServiceType('hotspot')}
                                style={{
                                    border: serviceType === 'hotspot' ? '2px solid #0d9488' : '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)', padding: 20, cursor: 'pointer',
                                    background: serviceType === 'hotspot' ? '#f0fdfa' : '#fff',
                                    transition: 'all 0.2s', textAlign: 'center',
                                }}
                            >
                                <WifiIcon style={{ fontSize: 40, color: 'var(--text-secondary)', marginBottom: 12 }} />
                                <h4 style={{ marginBottom: 4 }}>Hotspot Only</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                                    Configure WiFi hotspot with login portal
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
                                    <div style={{
                                        width: 16, height: 16, borderRadius: '50%',
                                        border: serviceType === 'hotspot' ? '5px solid #0d9488' : '2px solid var(--border)',
                                    }} />
                                    <span style={{ fontSize: '0.82rem', fontWeight: 500, color: serviceType === 'hotspot' ? '#0d9488' : 'var(--text-secondary)' }}>
                                        Select Hotspot
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    radiax_hotspot bridge &nbsp;&nbsp; 192.168.1.x network<br />
                                    login.spot portal
                                </div>
                            </div>

                            {/* Both Services */}
                            <div
                                onClick={() => setServiceType('both')}
                                style={{
                                    border: serviceType === 'both' ? '2px solid #0d9488' : '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)', padding: 20, cursor: 'pointer',
                                    background: serviceType === 'both' ? '#f0fdfa' : '#fff',
                                    transition: 'all 0.2s', textAlign: 'center',
                                }}
                            >
                                <DeviceHubIcon style={{ fontSize: 40, color: 'var(--text-secondary)', marginBottom: 12 }} />
                                <h4 style={{ marginBottom: 4 }}>Both Services</h4>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                                    Configure both PPPoE and Hotspot
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
                                    <div style={{
                                        width: 16, height: 16, borderRadius: '50%',
                                        border: serviceType === 'both' ? '5px solid #0d9488' : '2px solid var(--border)',
                                    }} />
                                    <span style={{ fontSize: '0.82rem', fontWeight: 500, color: serviceType === 'both' ? '#0d9488' : 'var(--text-secondary)' }}>
                                        Select Both
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    radiax_bridge &nbsp;&nbsp; PPPoE: 10.10.10.x<br />
                                    Hotspot: 192.168.1.x
                                </div>
                            </div>
                        </div>
                    </div>
                );

            /* ───────── STEP 3 : Interfaces ───────── */
            case 3:
                return (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <CableIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
                        <h2 style={{ marginBottom: 6 }}>Select Network Interfaces</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Choose ethernet ports for your services</p>

                        <div style={{ maxWidth: 650, margin: '0 auto', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontWeight: 600 }}>
                                🌐 Available Ethernet Interfaces
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                {mockInterfaces.map((iface) => (
                                    <div
                                        key={iface.name}
                                        onClick={() => toggleInterface(iface.name)}
                                        style={{
                                            border: selectedInterfaces.includes(iface.name) ? '2px solid #0d9488' : '1px solid var(--border)',
                                            borderRadius: 'var(--radius-sm)',
                                            padding: '14px 16px',
                                            cursor: 'pointer',
                                            background: selectedInterfaces.includes(iface.name) ? '#f0fdfa' : '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedInterfaces.includes(iface.name)}
                                                onChange={() => toggleInterface(iface.name)}
                                                style={{ width: 16, height: 16 }}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{iface.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {iface.type} - {iface.mac}
                                                </div>
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: '0.75rem', fontWeight: 500,
                                            color: iface.status === 'Up' ? '#16a34a' : '#9ca3af',
                                            display: 'flex', alignItems: 'center', gap: 4,
                                        }}>
                                            ⊙ {iface.status}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Bridge information */}
                            <div style={{
                                marginTop: 20, padding: '12px 16px',
                                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)',
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                            }}>
                                <InfoOutlinedIcon style={{ fontSize: 18, color: '#1d4ed8', marginTop: 2 }} />
                                <div style={{ fontSize: '0.85rem', color: '#1e40af' }}>
                                    <strong>Bridge Information:</strong><br />
                                    radiax_pppoe bridge will be created for PPPoE server with selected interfaces.
                                </div>
                            </div>
                        </div>
                    </div>
                );

            /* ───────── STEP 4 : Generate ───────── */
            case 4:
                return (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <DescriptionIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
                        <h2 style={{ marginBottom: 6 }}>Generate Configuration</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Create RSC configuration file</p>

                        {/* Configuration Summary */}
                        <div style={{
                            maxWidth: 600, margin: '0 auto', textAlign: 'left',
                            border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                        }}>
                            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, color: '#0d9488' }}>
                                Configuration Summary
                            </div>
                            <div style={{ padding: 20 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
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
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                                            Selected Interfaces:
                                        </div>
                                        <div style={{ fontWeight: 500 }}>
                                            {selectedInterfaces.length > 0 ? selectedInterfaces.join(', ') : 'None selected'}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 4 }}>Bridge Configuration:</div>
                                    <div style={{ fontSize: '0.82rem', color: '#0d9488' }}>
                                        Bridge will be created for PPPoE server with selected interfaces.
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Generate button */}
                        <div style={{
                            maxWidth: 600, margin: '24px auto', padding: 30,
                            border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-surface)',
                        }}>
                            <RocketLaunchIcon style={{ fontSize: 48, color: 'var(--text-secondary)', marginBottom: 12 }} />
                            <h3 style={{ marginBottom: 6 }}>Ready to Generate Configuration</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20 }}>
                                Click to create your custom RSC configuration file
                            </p>
                            <button
                                className="btn"
                                style={{ background: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 24px' }}
                                onClick={() => setConfigGenerated(true)}
                            >
                                <DescriptionIcon fontSize="small" /> Generate RSC Configuration
                            </button>
                            {configGenerated && (
                                <div style={{ marginTop: 12, color: '#16a34a', fontWeight: 500, fontSize: '0.85rem' }}>
                                    ✅ Configuration generated successfully!
                                </div>
                            )}
                        </div>

                        {/* Next Steps */}
                        <div style={{
                            maxWidth: 600, margin: '0 auto', padding: 20,
                            background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 'var(--radius-sm)',
                            textAlign: 'left',
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

            /* ───────── STEP 5 : Verify ───────── */
            case 5:
                return (
                    <div style={{ textAlign: 'center', padding: '30px 0' }}>
                        <VerifiedIcon style={{ fontSize: 56, color: 'var(--text-secondary)', marginBottom: 16 }} />
                        <h2 style={{ marginBottom: 6 }}>Configuration Status Verification</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 30 }}>Verifying service configuration</p>

                        {/* PPPoE Server Status */}
                        <div style={{
                            maxWidth: 400, margin: '0 auto 24px', textAlign: 'left',
                            border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                        }}>
                            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <DnsIcon style={{ fontSize: 16 }} /> PPPoE Server Status
                            </div>
                            <div style={{ padding: 20, textAlign: 'center' }}>
                                {verifyStatus === 'failed' ? (
                                    <>
                                        <CancelIcon style={{ fontSize: 40, color: 'var(--primary)', marginBottom: 8 }} />
                                        <div style={{ color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>Configuration Failed</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>PPPoE Server not found</div>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircleIcon style={{ fontSize: 40, color: '#16a34a', marginBottom: 8 }} />
                                        <div style={{ color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>Configuration Successful</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>PPPoE Server is running</div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Overall Status */}
                        <div style={{
                            maxWidth: 600, margin: '0 auto', padding: 30,
                            border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-surface)',
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
                                        <button className="btn btn-secondary" onClick={() => navigate('/mikrotiks')}>
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
                                    </p>
                                    <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 24px' }}
                                        onClick={() => navigate('/mikrotiks')}>
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
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Title */}
            <div style={{ marginBottom: 4 }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 2 }}>Router Setup Wizard</h1>
                <p style={{ color: '#0d9488', fontSize: '0.9rem' }}>{routerName}</p>
            </div>

            {/* Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 0', margin: '0 auto', maxWidth: 700 }}>
                {steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
                        <div style={{ textAlign: 'center', minWidth: 70 }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: '50%', margin: '0 auto 6px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: i < currentStep ? '#16a34a' : i === currentStep ? '#16a34a' : '#e5e7eb',
                                color: i <= currentStep ? '#fff' : '#9ca3af',
                                fontWeight: 600, fontSize: '0.9rem',
                                transition: 'all 0.3s',
                            }}>
                                {i < currentStep ? <HelpOutlineIcon style={{ fontSize: 20 }} /> : step.icon}
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: i === currentStep ? 700 : 400, color: i <= currentStep ? '#16a34a' : '#9ca3af' }}>{step.label}</div>
                            <div style={{ fontSize: '0.65rem', color: i <= currentStep ? '#16a34a' : '#9ca3af' }}>{step.sub}</div>
                        </div>
                        {i < steps.length - 1 && (
                            <div style={{
                                flex: 1, height: 2, margin: '0 8px',
                                background: i < currentStep ? '#16a34a' : '#e5e7eb',
                                transition: 'all 0.3s',
                                marginBottom: 28,
                            }} />
                        )}
                    </div>
                ))}
            </div>

            {/* Step Content */}
            {renderStepContent()}

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
                <div>
                    {currentStep > 0 && (
                        <button className="btn btn-secondary" onClick={handlePrev}>
                            <ArrowBackIcon fontSize="small" /> Previous
                        </button>
                    )}
                </div>
                {currentStep === 5 && verifyStatus === 'failed' ? (
                    <button className="btn" style={{ background: '#f3f4f6', color: '#374151', fontWeight: 600, border: '1px solid var(--border)' }}
                        onClick={() => setVerifyStatus('success')}>
                        <RefreshIcon fontSize="small" /> Recheck Status
                    </button>
                ) : (
                    <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600 }} onClick={handleNext}>
                        {getNextButtonLabel()} <ArrowForwardIcon fontSize="small" />
                    </button>
                )}
            </div>
        </div>
    );
}
