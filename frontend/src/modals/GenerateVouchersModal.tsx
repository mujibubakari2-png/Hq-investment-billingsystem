import { useState, useEffect } from 'react';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { packagesApi, routersApi } from '../api/client';
import type { Package, Router } from '../types';

interface GenerateVouchersModalProps {
    onClose: () => void;
    onGenerate?: (data: VoucherConfig) => void;
}

interface VoucherConfig {
    packageType: string;
    routerId: string;
    packageId: string;
    count: number;
    codeLength: number;
    codeFormat: 'alphanumeric-upper' | 'alphanumeric-lower' | 'numeric';
    prefix: string;
    smsPhone: string;
    sendSms: boolean;
    createdById?: string;
}

export default function GenerateVouchersModal({ onClose, onGenerate }: GenerateVouchersModalProps) {
    const [packageType, setPackageType] = useState('');
    const [routerId, setRouterId] = useState('');
    const [packageId, setPackageId] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [count, setCount] = useState(1);
    const [codeLength, setCodeLength] = useState(8);
    const [codeFormat, setCodeFormat] = useState<'alphanumeric-upper' | 'alphanumeric-lower' | 'numeric'>('alphanumeric-upper');
    const [prefix, setPrefix] = useState('');
    const [smsPhone, setSmsPhone] = useState('');
    const [sendSms, setSendSms] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [routersList, setRoutersList] = useState<Router[]>([]);
    const [packagesList, setPackagesList] = useState<Package[]>([]);

    useEffect(() => {
        routersApi.list().then(d => setRoutersList(d as unknown as Router[])).catch(console.error);
        packagesApi.list().then(d => setPackagesList(d as unknown as Package[])).catch(console.error);
    }, []);

    const selectedRouter = routersList.find(r => r.id === routerId);
    const filteredPackages = packagesList.filter(p =>
        (!packageType || p.type === packageType) &&
        (!routerId || p.router === selectedRouter?.name)
    );

    const handleGenerate = () => {
        if (!packageId || !routerId) {
            setError('Router and Package are required');
            return;
        }
        setError(null);
        
        let currentUserId = undefined;
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                currentUserId = JSON.parse(userStr).id;
            }
        } catch (e) {}

        if (onGenerate) {
            onGenerate({ 
                packageType, routerId, packageId, count, codeLength, codeFormat, prefix, smsPhone, sendSms,
                createdById: currentUserId 
            } as VoucherConfig);
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
                    {error && (
                        <div style={{
                            background: '#fee2e2', color: '#dc2626', padding: '10px 14px',
                            borderRadius: 8, marginBottom: 16, fontSize: '0.82rem', fontWeight: 500,
                            border: '1px solid #fecaca'
                        }}>
                            {error}
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', marginBottom: 20 }}>
                        <label className="form-label" style={{ marginBottom: 0, fontWeight: 500 }}>Package Type</label>
                        <select className="form-select" value={packageType} onChange={e => setPackageType(e.target.value)}>
                            <option value="">Select Package Type</option>
                            <option value="Hotspot">Hotspot</option>
                            <option value="PPPoE">PPPoE</option>
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', marginBottom: 20 }}>
                        <label className="form-label" style={{ marginBottom: 0, fontWeight: 500 }}>Router</label>
                        <select className="form-select" value={routerId} onChange={e => setRouterId(e.target.value)}>
                            <option value="">Select Router</option>
                            {routersList.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', marginBottom: 20 }}>
                        <label className="form-label" style={{ marginBottom: 0, fontWeight: 500 }}>Package</label>
                        <select className="form-select" value={packageId} onChange={e => setPackageId(e.target.value)}>
                            <option value="">Select Package</option>
                            {filteredPackages.map(p => (
                                <option key={p.id} value={p.id}>{p.name} – {p.price.toLocaleString()} TZS</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', marginBottom: 20 }}>
                        <label className="form-label" style={{ marginBottom: 0, fontWeight: 500 }}>Number of Vouchers</label>
                        <input type="number" className="form-input" min={1} max={500} value={count} onChange={e => setCount(Number(e.target.value))} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', marginBottom: 24 }}>
                        <label className="form-label" style={{ marginBottom: 0, fontWeight: 500 }}>Code Length</label>
                        <input type="number" className="form-input" min={4} max={20} value={codeLength} onChange={e => setCodeLength(Number(e.target.value))} />
                    </div>

                    {/* Advanced Options Toggle */}
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', marginBottom: 20 }}>
                        <div />
                        <button
                            className="btn btn-secondary"
                            style={{ alignSelf: 'flex-start', background: '#333', color: '#fff', border: 'none' }}
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            {showAdvanced ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            Advanced Options
                        </button>
                    </div>

                    {showAdvanced && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', marginBottom: 20 }}>
                                <label className="form-label" style={{ marginBottom: 0, fontWeight: 500 }}>Code Format</label>
                                <div style={{ display: 'flex' }}>
                                    {([
                                        { value: 'alphanumeric-upper', label: 'ABC123' },
                                        { value: 'alphanumeric-lower', label: 'abc123' },
                                        { value: 'numeric', label: '123456' },
                                    ] as const).map((f, i) => (
                                        <button
                                            key={f.value}
                                            style={{ 
                                                padding: '8px 16px', 
                                                border: '1px solid var(--border)', 
                                                background: codeFormat === f.value ? '#333' : '#fff',
                                                color: codeFormat === f.value ? '#fff' : 'var(--text-primary)',
                                                fontWeight: 600,
                                                fontSize: '0.85rem',
                                                borderRight: i < 2 ? 'none' : '1px solid var(--border)',
                                                borderTopLeftRadius: i === 0 ? 'var(--radius-sm)' : 0,
                                                borderBottomLeftRadius: i === 0 ? 'var(--radius-sm)' : 0,
                                                borderTopRightRadius: i === 2 ? 'var(--radius-sm)' : 0,
                                                borderBottomRightRadius: i === 2 ? 'var(--radius-sm)' : 0,
                                            }}
                                            onClick={() => setCodeFormat(f.value)}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', marginBottom: 20 }}>
                                <label className="form-label" style={{ marginBottom: 0, fontWeight: 500 }}>Prefix</label>
                                <input type="text" className="form-input" placeholder="e.g., WIFI-" value={prefix} onChange={e => setPrefix(e.target.value)} maxLength={10} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'flex-start', marginBottom: 20 }}>
                                <label className="form-label" style={{ marginBottom: 0, marginTop: 10, fontWeight: 500 }}>SMS Notification</label>
                                <div>
                                    <div style={{ display: 'flex' }}>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Phone number"
                                            value={smsPhone}
                                            onChange={e => setSmsPhone(e.target.value)}
                                            style={{ flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                                        />
                                        <div 
                                            style={{ 
                                                display: 'flex', alignItems: 'center', gap: 6, 
                                                padding: '0 14px', border: '1px solid var(--border)', 
                                                borderLeft: 'none', background: '#f9fafb',
                                                borderTopRightRadius: 'var(--radius)', borderBottomRightRadius: 'var(--radius)'
                                            }}
                                            onClick={() => setSendSms(!sendSms)}
                                        >
                                            <input type="checkbox" checked={sendSms} readOnly style={{ width: 14, height: 14 }} />
                                            <span style={{ fontSize: '0.85rem' }}>Send SMS</span>
                                        </div>
                                    </div>
                                    <div className="form-hint" style={{ marginTop: 6 }}>SMS only works for single voucher</div>
                                </div>
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
                            id="generate-vouchers-btn"
                            onClick={handleGenerate}
                            disabled={!packageId || !routerId}
                        >
                            <ConfirmationNumberIcon fontSize="small" /> Generate Vouchers
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
