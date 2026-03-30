import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsApi } from '../api/client';
import PaymentIcon from '@mui/icons-material/Payment';
import SaveIcon from '@mui/icons-material/Save';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StarIcon from '@mui/icons-material/Star';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface Gateway {
    id: string;
    name: string;
    description: string;
    isDefault: boolean;
    enabled: boolean;
    number: number;
}

export default function PaymentChannels() {
    const [gateways, setGateways] = useState<Gateway[]>([
        { id: '1', name: 'Bank Deposit', description: 'Enable direct bank deposit payments', isDefault: false, enabled: false, number: 1 },
        { id: '2', name: 'Mpesa Buy Goods Till', description: 'Collect payments directly through M-pesa Buy Goods Till number', isDefault: false, enabled: false, number: 2 },
        { id: '3', name: 'Harakapay', description: 'Additional payment gateway', isDefault: false, enabled: false, number: 3 },
        { id: '4', name: 'Mpesa Paybill', description: 'Collect payments through M-Pesa Paybill number', isDefault: false, enabled: false, number: 4 },
        { id: '5', name: 'Palmpesa', description: 'Additional payment gateway', isDefault: true, enabled: false, number: 5 },
        { id: '6', name: 'Zenopay', description: 'Additional payment gateway', isDefault: false, enabled: false, number: 6 },
    ]);

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        settingsApi.get().then((res: any) => {
            const data = res.data || res;
            if (data?.paymentGateways) {
                try {
                    const parsed = JSON.parse(data.paymentGateways);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setGateways(parsed);
                    }
                } catch (e) {
                    console.error('Failed to parse gateway settings', e);
                }
            }
        }).catch(console.error);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await settingsApi.update({ paymentGateways: JSON.stringify(gateways) });
            alert('Payment channels saved successfully!');
        } catch (err) {
            console.error('Failed to save payment channels', err);
            alert('Failed to save payment channels.');
        } finally {
            setSaving(false);
        }
    };

    const activeCount = gateways.filter(g => g.enabled).length;
    const inactiveCount = gateways.filter(g => !g.enabled).length;
    const defaultGateway = gateways.find(g => g.isDefault);

    const toggleEnabled = (id: string) => {
        setGateways(prev => {
            const target = prev.find(p => p.id === id);
            if (!target) return prev;
            const willBeEnabled = !target.enabled;
            
            return prev.map(g => {
                if (g.id === id) {
                    return { ...g, enabled: willBeEnabled, isDefault: willBeEnabled };
                }
                if (willBeEnabled) {
                    return { ...g, enabled: false, isDefault: false };
                }
                return g;
            });
        });
    };

    const setDefault = (id: string) => {
        setGateways(prev => prev.map(g => ({ ...g, isDefault: g.id === id })));
    };

    const navigate = useNavigate();

    const configRoutes: Record<string, string> = {
        '1': '/bank-payment-config',
        '2': '/mpesa-till-config',
        '3': '/harakapay-config',
        '4': '/mpesa-paybill-config',
        '5': '/palmpesa-config',
        '6': '/zenopay-config',
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <PaymentIcon style={{ color: 'var(--text-secondary)' }} />
                <h1 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Payment Setup</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <InfoOutlinedIcon style={{ fontSize: 14 }} />
                Enable payment gateways using toggles and select one as the default
            </div>

            {/* Gateway Table */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: 60 }}>Default</th>
                                <th>Payment Gateway</th>
                                <th style={{ width: 80 }}>Status</th>
                                <th style={{ width: 80 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {gateways.map((gw) => (
                                <tr key={gw.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                width: 22, height: 22, borderRadius: '50%',
                                                background: gw.isDefault ? '#6366f1' : '#e5e7eb', color: '#fff',
                                                fontSize: '0.68rem', fontWeight: 700,
                                            }}>
                                                {gw.number}
                                            </span>
                                            <input
                                                type="radio"
                                                name="defaultGateway"
                                                checked={gw.isDefault}
                                                onChange={() => setDefault(gw.id)}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </div>
                                    </td>
                                    <td>
                                        <div>
                                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {gw.name}
                                                {gw.isDefault && (
                                                    <span style={{
                                                        background: '#ef4444', color: '#fff', padding: '1px 8px',
                                                        borderRadius: 4, fontSize: '0.65rem', fontWeight: 600,
                                                    }}>
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{gw.description}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <div
                                            onClick={() => toggleEnabled(gw.id)}
                                            style={{
                                                width: 40, height: 22, borderRadius: 12, cursor: 'pointer',
                                                background: gw.enabled ? '#16a34a' : '#d1d5db',
                                                position: 'relative', transition: 'all 0.2s',
                                            }}
                                        >
                                            <div style={{
                                                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                                                position: 'absolute', top: 2, left: gw.enabled ? 20 : 2,
                                                transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                            }} />
                                        </div>
                                    </td>
                                    <td>
                                        <button onClick={() => navigate(configRoutes[gw.id])} style={{
                                            background: 'transparent', border: 'none', cursor: 'pointer',
                                            color: '#ef4444', fontSize: '1.1rem',
                                        }}>
                                            ⊕
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
                <div style={{
                    background: '#dcfce7', borderRadius: 'var(--radius-md)', padding: '24px 16px',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{activeCount}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Active Gateways</div>
                </div>
                <div style={{
                    background: '#f0f9ff', borderRadius: 'var(--radius-md)', padding: '24px 16px',
                    textAlign: 'center',
                }}>
                    <AccessTimeIcon style={{ fontSize: 24, color: 'var(--info)', marginBottom: 4 }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{inactiveCount}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Inactive Gateways</div>
                </div>
                <div style={{
                    background: '#f5f3ff', borderRadius: 'var(--radius-md)', padding: '24px 16px',
                    textAlign: 'center',
                }}>
                    <StarIcon style={{ fontSize: 24, color: '#ef4444', marginBottom: 4 }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{defaultGateway?.name || 'None'}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Default Gateway</div>
                </div>
            </div>

            {/* Info + Save */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <InfoOutlinedIcon style={{ fontSize: 14 }} />
                    Toggle gateways on/off and select one as default for customers
                </div>
                <button 
                    className="btn" 
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        background: '#e11d48', color: '#fff', fontWeight: 600,
                        padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6,
                        opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                >
                    <SaveIcon fontSize="small" /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
