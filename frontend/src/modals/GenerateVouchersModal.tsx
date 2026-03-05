import { useState } from 'react';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { mockPackages, mockRouters } from '../data/mockData';

interface GenerateVouchersModalProps {
    onClose: () => void;
    onGenerate?: (data: VoucherConfig) => void;
}

interface VoucherConfig {
    packageType: string;
    router: string;
    packageId: string;
    count: number;
    codeLength: number;
    codeFormat: 'alphanumeric-upper' | 'alphanumeric-lower' | 'numeric';
    prefix: string;
    smsPhone: string;
    sendSms: boolean;
}

export default function GenerateVouchersModal({ onClose, onGenerate }: GenerateVouchersModalProps) {
    const [packageType, setPackageType] = useState('');
    const [router, setRouter] = useState('');
    const [packageId, setPackageId] = useState('');
    const [count, setCount] = useState(1);
    const [codeLength, setCodeLength] = useState(8);
    const [codeFormat, setCodeFormat] = useState<'alphanumeric-upper' | 'alphanumeric-lower' | 'numeric'>('alphanumeric-upper');
    const [prefix, setPrefix] = useState('');
    const [smsPhone, setSmsPhone] = useState('');
    const [sendSms, setSendSms] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const filteredPackages = mockPackages.filter(p =>
        (!packageType || p.type === packageType) &&
        (!router || p.router === router)
    );

    const handleGenerate = () => {
        if (onGenerate) {
            onGenerate({ packageType, router, packageId, count, codeLength, codeFormat, prefix, smsPhone, sendSms });
        }
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <div className="modal-header-icon">
                            <ConfirmationNumberIcon fontSize="small" />
                        </div>
                        <div>
                            <div className="modal-title">Generate Vouchers</div>
                            <div className="modal-subtitle">Generate vouchers for customer plans</div>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><CloseIcon fontSize="small" /></button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">Package Type</label>
                        <select className="form-select" value={packageType} onChange={e => setPackageType(e.target.value)}>
                            <option value="">Select Package Type</option>
                            <option value="Hotspot">Hotspot</option>
                            <option value="PPPoE">PPPoE</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Router</label>
                        <select className="form-select" value={router} onChange={e => setRouter(e.target.value)}>
                            <option value="">Select Router</option>
                            {mockRouters.map(r => (
                                <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Package</label>
                        <select className="form-select" value={packageId} onChange={e => setPackageId(e.target.value)}>
                            <option value="">Select Package</option>
                            {filteredPackages.map(p => (
                                <option key={p.id} value={p.id}>{p.name} – {p.price.toLocaleString()} TZS</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Number of Vouchers</label>
                            <input type="number" className="form-input" min={1} max={500} value={count} onChange={e => setCount(Number(e.target.value))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Code Length</label>
                            <input type="number" className="form-input" min={4} max={20} value={codeLength} onChange={e => setCodeLength(Number(e.target.value))} />
                        </div>
                    </div>

                    {/* Advanced Options Toggle */}
                    <button
                        className="btn btn-secondary"
                        style={{ marginBottom: 16 }}
                        onClick={() => setShowAdvanced(!showAdvanced)}
                    >
                        {showAdvanced ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        Advanced Options
                    </button>

                    {showAdvanced && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Code Format</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {([
                                        { value: 'alphanumeric-upper', label: 'ABC123' },
                                        { value: 'alphanumeric-lower', label: 'abc123' },
                                        { value: 'numeric', label: '123456' },
                                    ] as const).map(f => (
                                        <button
                                            key={f.value}
                                            className={`btn ${codeFormat === f.value ? 'btn-primary' : 'btn-secondary'}`}
                                            onClick={() => setCodeFormat(f.value)}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Prefix</label>
                                <input type="text" className="form-input" placeholder="e.g., WiFi-" value={prefix} onChange={e => setPrefix(e.target.value)} maxLength={10} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">SMS Notification</label>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Phone number"
                                        value={smsPhone}
                                        onChange={e => setSmsPhone(e.target.value)}
                                        style={{ flex: 1 }}
                                    />
                                    <div className="toggle" onClick={() => setSendSms(!sendSms)}>
                                        <div className={`toggle-switch ${sendSms ? 'active' : ''}`} />
                                        <span className="toggle-label">Send SMS</span>
                                    </div>
                                </div>
                                <div className="form-hint">SMS only works for single voucher</div>
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <div className="modal-footer-left" />
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button
                            className="btn btn-primary"
                            onClick={handleGenerate}
                            disabled={!packageId}
                        >
                            <ConfirmationNumberIcon fontSize="small" /> Generate Vouchers
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
