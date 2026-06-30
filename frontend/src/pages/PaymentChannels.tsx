import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentChannelsApi } from '../api/financeApi';
import PaymentIcon from '@mui/icons-material/Payment';
import SaveIcon from '@mui/icons-material/Save';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import StarIcon from '@mui/icons-material/Star';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface Gateway {
    id: string;
    provider: string;
    name: string;
    description: string;
    isDefault: boolean;
    enabled: boolean;
    number: number;
    persisted: boolean;
}

const gatewayCatalog: Gateway[] = [
    { id: 'BANK_TRANSFER', provider: 'BANK_TRANSFER', name: 'Bank Deposit', description: 'Enable direct bank deposit payments', isDefault: false, enabled: false, number: 1, persisted: false },
    { id: 'HARAKAPAY', provider: 'HARAKAPAY', name: 'Harakapay', description: 'HarakaPay payment gateway', isDefault: false, enabled: false, number: 2, persisted: false },
    { id: 'PALMPESA', provider: 'PALMPESA', name: 'Palmpesa', description: 'PalmPesa payment gateway', isDefault: false, enabled: false, number: 3, persisted: false },
    { id: 'ZENOPAY', provider: 'ZENOPAY', name: 'Zenopay', description: 'ZenoPay payment gateway', isDefault: false, enabled: false, number: 4, persisted: false },
    { id: 'MONGIKE', provider: 'MONGIKE', name: 'Mongike', description: 'Mongike payment gateway integration', isDefault: false, enabled: false, number: 5, persisted: false },
];

export default function PaymentChannels() {
    const [gateways, setGateways] = useState<Gateway[]>(gatewayCatalog);

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        paymentChannelsApi.list().then((channels: any) => {
            const rows = Array.isArray(channels) ? channels : [];
            const byProvider = new Map(rows.map((ch: any) => [String(ch.provider || '').toUpperCase(), ch]));
            const merged = gatewayCatalog.map((gw) => {
                const channel = byProvider.get(gw.provider);
                if (!channel) return gw;
                const enabled = String(channel.status || '').toUpperCase() === 'ACTIVE' || channel.status === 'Active';
                return {
                    ...gw,
                    id: channel.id,
                    name: channel.name || gw.name,
                    enabled,
                    isDefault: false,
                    persisted: true,
                };
            });
            const firstActive = merged.findIndex((gw) => gw.enabled);
            if (firstActive >= 0) merged[firstActive] = { ...merged[firstActive], isDefault: true };
            setGateways(merged);
        }).catch(console.error);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const unconfiguredEnabled = gateways.filter((gw) => gw.enabled && !gw.persisted);
            if (unconfiguredEnabled.length > 0) {
                alert(`Configure ${unconfiguredEnabled.map((gw) => gw.name).join(', ')} before enabling.`);
                return;
            }
            await Promise.all(gateways
                .filter((gw) => gw.persisted)
                .map((gw) => paymentChannelsApi.update(gw.id, { status: gw.enabled ? 'ACTIVE' : 'INACTIVE' })));
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
                    return { ...g, enabled: willBeEnabled, isDefault: willBeEnabled && !prev.some(other => other.id !== id && other.isDefault) };
                }
                return g;
            });
        });
    };

    const setDefault = (id: string) => {
        setGateways(prev => prev.map(g => ({ ...g, isDefault: g.id === id && g.enabled })));
    };

    const navigate = useNavigate();

    const configRoutes: Record<string, string> = {
        BANK_TRANSFER: '/bank-payment-config',
        HARAKAPAY: '/harakapay-config',
        PALMPESA: '/palmpesa-config',
        ZENOPAY: '/zenopay-config',
        MONGIKE: '/mongike-config',
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
                                        <button onClick={() => navigate(configRoutes[gw.provider])} style={{
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
            <div className="grid-3 gap-16" style={{ marginBottom: 20 }}>
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
