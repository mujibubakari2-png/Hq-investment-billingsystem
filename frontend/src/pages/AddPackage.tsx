import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InventoryIcon from '@mui/icons-material/Inventory';
import SettingsIcon from '@mui/icons-material/Settings';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SpeedIcon from '@mui/icons-material/Speed';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import { mockRouters } from '../data/mockData';

export default function AddPackage() {
    const navigate = useNavigate();
    const [packageType, setPackageType] = useState('Hotspot');
    const [accountType, setAccountType] = useState('Personal');
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [duration, setDuration] = useState('');
    const [durationUnit, setDurationUnit] = useState('Minutes');
    const [router, setRouter] = useState('');
    const [uploadSpeed, setUploadSpeed] = useState('1');
    const [uploadUnit, setUploadUnit] = useState('Mbps');
    const [downloadSpeed, setDownloadSpeed] = useState('1');
    const [downloadUnit, setDownloadUnit] = useState('Mbps');
    const [burstEnabled, setBurstEnabled] = useState(false);
    const [hotspotType, setHotspotType] = useState('Unlimited');
    const [devices, setDevices] = useState(1);
    const [payStatus, setPayStatus] = useState('Prepaid');
    const [paymentType, setPaymentType] = useState('Prepaid');

    const handleSave = () => {
        console.log('Add package:', { packageType, accountType, name, price, duration, durationUnit, router, uploadSpeed, uploadUnit, downloadSpeed, downloadUnit, burstEnabled, hotspotType, devices, payStatus, paymentType });
        navigate('/packages');
    };

    return (
        <div>
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon">
                        <InventoryIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Add Package</h1>
                        <p className="page-subtitle">Create a new service package for your clients</p>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-body">
                    {/* Basic Information */}
                    <div className="form-section-title" style={{ color: 'var(--primary)' }}>
                        <SettingsIcon fontSize="small" /> Basic Information
                    </div>
                    <div className="form-hint" style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>Define the core details of your package</div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Package Type <span className="required">*</span></label>
                            <select className="form-select" value={packageType} onChange={e => setPackageType(e.target.value)}>
                                <option>Hotspot</option>
                                <option>PPPoE</option>
                            </select>
                            <div className="form-hint">Select the connection method for this package</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Account Type <span className="required">*</span></label>
                            <select className="form-select" value={accountType} onChange={e => setAccountType(e.target.value)}>
                                <option>Personal</option>
                                <option>Business</option>
                            </select>
                            <div className="form-hint">Choose the target customer segment</div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Name <span className="required">*</span></label>
                            <input type="text" className="form-input" placeholder="Enter a unique, descriptive package name" value={name} onChange={e => setName(e.target.value)} />
                            <div className="form-hint">Pick an easy, descriptive package name</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Price <span className="required">*</span></label>
                            <input type="number" className="form-input" placeholder="0" value={price} onChange={e => setPrice(e.target.value)} />
                            <div className="form-hint">Set the price clients will pay for this package</div>
                        </div>
                    </div>

                    {/* Duration & Router */}
                    <div className="form-section-title" style={{ color: 'var(--primary)' }}>
                        <AccessTimeIcon fontSize="small" /> Duration &amp; Router
                    </div>
                    <div className="form-hint" style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>Define how long the package will be valid and which router to use</div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Duration <span className="required">*</span></label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input type="number" className="form-input" placeholder="e.g., 24" value={duration} onChange={e => setDuration(e.target.value)} style={{ flex: 1 }} />
                                <select className="form-select" value={durationUnit} onChange={e => setDurationUnit(e.target.value)} style={{ width: 120 }}>
                                    <option>Minutes</option>
                                    <option>Hours</option>
                                    <option>Days</option>
                                    <option>Months</option>
                                </select>
                            </div>
                            <div className="form-hint">How long the package will remain active after purchase</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Router <span className="required">*</span></label>
                            <select className="form-select" value={router} onChange={e => setRouter(e.target.value)}>
                                <option value="">Select Router</option>
                                {mockRouters.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                            </select>
                            <div className="form-hint">Select which router will provide this service</div>
                        </div>
                    </div>

                    {/* Bandwidth Configuration */}
                    <div className="form-section-title" style={{ color: 'var(--primary)' }}>
                        <SpeedIcon fontSize="small" /> Bandwidth Configuration
                    </div>
                    <div className="form-hint" style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>Set the speed limits for this package</div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Upload Speed</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input type="number" className="form-input" value={uploadSpeed} onChange={e => setUploadSpeed(e.target.value)} style={{ flex: 1 }} />
                                <select className="form-select" value={uploadUnit} onChange={e => setUploadUnit(e.target.value)} style={{ width: 100 }}>
                                    <option>Mbps</option>
                                    <option>Kbps</option>
                                </select>
                            </div>
                            <div className="form-hint">Maximum speed for uploading data</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Download Speed</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input type="number" className="form-input" value={downloadSpeed} onChange={e => setDownloadSpeed(e.target.value)} style={{ flex: 1 }} />
                                <select className="form-select" value={downloadUnit} onChange={e => setDownloadUnit(e.target.value)} style={{ width: 100 }}>
                                    <option>Mbps</option>
                                    <option>Kbps</option>
                                </select>
                            </div>
                            <div className="form-hint">Maximum speed for downloading data</div>
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="toggle" onClick={() => setBurstEnabled(!burstEnabled)}>
                            <div className={`toggle-switch ${burstEnabled ? 'active' : ''}`} />
                            <span className="toggle-label">Enable Burst</span>
                        </div>
                        <div className="form-hint" style={{ marginTop: 6 }}>Allow temporary speed bursts above the set limits</div>
                    </div>

                    {/* Hotspot Settings */}
                    {packageType === 'Hotspot' && (
                        <>
                            <div className="form-section-title" style={{ color: 'var(--primary)' }}>
                                <SettingsIcon fontSize="small" /> Hotspot Settings
                            </div>
                            <div className="form-hint" style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>Configure specific settings for hotspot connections</div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Type</label>
                                    <select className="form-select" value={hotspotType} onChange={e => setHotspotType(e.target.value)}>
                                        <option>Unlimited</option>
                                        <option>Data-capped</option>
                                    </select>
                                    <div className="form-hint">Choose between unlimited usage or data-capped plans</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Devices</label>
                                    <input type="number" className="form-input" min={1} max={50} value={devices} onChange={e => setDevices(Number(e.target.value))} />
                                    <div className="form-hint">Maximum number of devices that can connect simultaneously</div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Additional Settings */}
                    <div className="form-section-title" style={{ color: 'var(--primary)' }}>
                        <SettingsIcon fontSize="small" /> Additional Settings
                    </div>
                    <div className="form-hint" style={{ marginBottom: 16, color: 'var(--text-secondary)' }}>Let's have additional checkbox sections</div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Pay Status</label>
                            <select className="form-select" value={payStatus} onChange={e => setPayStatus(e.target.value)}>
                                <option>Prepaid</option>
                                <option>Postpaid</option>
                            </select>
                            <div className="form-hint">Enable or disable this package for customers</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Payment Type</label>
                            <select className="form-select" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                                <option>Prepaid</option>
                                <option>Postpaid</option>
                            </select>
                            <div className="form-hint">Choose the GTU method for this package</div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
                        <button className="btn btn-secondary" onClick={() => navigate('/packages')}>
                            <CloseIcon fontSize="small" /> Cancel
                        </button>
                        <button className="btn btn-primary" onClick={handleSave} disabled={!name || !price || !duration || !router}>
                            <CheckIcon fontSize="small" /> Add Package
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
