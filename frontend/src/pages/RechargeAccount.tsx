import { useState, useEffect } from 'react';
import PaymentIcon from '@mui/icons-material/Payment';
import { useNavigate } from 'react-router-dom';
import { clientsApi, routersApi, packagesApi, subscriptionsApi } from '../api/client';

export default function RechargeAccount() {
    const navigate = useNavigate();
    const [selectedAccount, setSelectedAccount] = useState('');
    const [planType, setPlanType] = useState<'Hotspot' | 'PPPoE'>('Hotspot');
    const [router, setRouter] = useState('');
    const [servicePlan, setServicePlan] = useState('');
    const [paymentUsing, setPaymentUsing] = useState('Cash');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [clients, setClients] = useState<Array<{ id: string; username: string; fullName: string }>>([]);
    const [routers, setRouters] = useState<Array<{ id: string; name: string }>>([]);
    const [packages, setPackages] = useState<Array<{ id: string; name: string; type: string; price: number; router: string }>>([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [clientData, routerData, packageData] = await Promise.all([
                    clientsApi.list({ limit: '500' }),
                    routersApi.list(),
                    packagesApi.list(),
                ]);
                setClients(clientData.data as any);
                setRouters(routerData as any);
                setPackages(packageData as any);
            } catch (err) {
                console.error('Failed to load recharge data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredPackages = packages.filter(pkg => {
        const matchesType = pkg.type === planType;
        const matchesRouter = !router || pkg.router === router || pkg.router === routers.find(r => r.id === router)?.name;
        return matchesType && matchesRouter;
    });

    const handleRecharge = async () => {
        if (!selectedAccount) { alert('Please select a customer account.'); return; }
        if (!router) { alert('Please select a router.'); return; }
        if (!servicePlan) { alert('Please select a service plan.'); return; }

        setSubmitting(true);
        try {
            await subscriptionsApi.create({
                clientId: selectedAccount,
                packageId: servicePlan,
                routerId: router,
                method: paymentUsing,
            });
            alert('Account recharged successfully!');
            navigate('/active-subscribers');
        } catch (err: any) {
            console.error('Failed to recharge:', err);
            alert(err?.message || 'Failed to recharge account. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div>
            {/* Page Header */}
            <div className="page-header">
                <div className="page-header-left">
                    <div className="page-header-icon">
                        <PaymentIcon />
                    </div>
                    <div>
                        <h1 className="page-title">Recharge Account</h1>
                        <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className="breadcrumb">
                                <a href="/">Home</a> <span>/</span> Recharge
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Form Card */}
            <div className="card">
                <div className="card-header">
                    <div className="card-title">
                        <PaymentIcon fontSize="small" style={{ color: 'var(--primary)' }} />
                        Account Recharge Form
                    </div>
                </div>
                <div className="card-body" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
                    Add credit to customer account to extend service period
                </div>
                <div className="card-body">
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading data...</div>
                    ) : (
                        <>
                            {/* Row 1: Select Account + Type */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label" style={{ color: 'var(--primary)' }}>
                                        1. Select Account
                                    </label>
                                    <select
                                        className="form-select"
                                        value={selectedAccount}
                                        onChange={(e) => setSelectedAccount(e.target.value)}
                                    >
                                        <option value="">Choose the customer account you want to recharge</option>
                                        {clients.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.username} — {c.fullName}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="form-hint">Choose the customer account you want to recharge</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ color: 'var(--primary)' }}>
                                        2. Type
                                    </label>
                                    <div className="tabs" style={{ marginBottom: 0 }}>
                                        <button
                                            className={`tab ${planType === 'Hotspot' ? 'active' : ''}`}
                                            onClick={() => { setPlanType('Hotspot'); setServicePlan(''); }}
                                        >
                                            Hotspot Plans
                                        </button>
                                        <button
                                            className={`tab ${planType === 'PPPoE' ? 'active' : ''}`}
                                            onClick={() => { setPlanType('PPPoE'); setServicePlan(''); }}
                                        >
                                            PPPoE Plans
                                        </button>
                                    </div>
                                    <div className="form-hint">Select the subscription type for this recharge</div>
                                </div>
                            </div>

                            {/* Row 2: Routers + Service Plan */}
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label" style={{ color: 'var(--primary)' }}>
                                        3. Routers
                                    </label>
                                    <select
                                        className="form-select"
                                        value={router}
                                        onChange={(e) => { setRouter(e.target.value); setServicePlan(''); }}
                                    >
                                        <option value="">Select Router</option>
                                        {routers.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                    <div className="form-hint">Choose the network router for this connection</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ color: 'var(--primary)' }}>
                                        4. Service Plan
                                    </label>
                                    <select
                                        className="form-select"
                                        value={servicePlan}
                                        onChange={(e) => setServicePlan(e.target.value)}
                                    >
                                        <option value="">Select Plans</option>
                                        {filteredPackages.map(pkg => (
                                            <option key={pkg.id} value={pkg.id}>
                                                {pkg.name} — TZS {pkg.price.toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="form-hint">Select the service package for this account</div>
                                </div>
                            </div>

                            {/* Row 3: Using */}
                            <div className="form-group">
                                <label className="form-label" style={{ color: 'var(--primary)' }}>
                                    5. Payment Method
                                </label>
                                <select
                                    className="form-select"
                                    value={paymentUsing}
                                    onChange={(e) => setPaymentUsing(e.target.value)}
                                    style={{ maxWidth: 400 }}
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="M-Pesa">M-Pesa</option>
                                    <option value="PalmPesa">PalmPesa</option>
                                    <option value="Voucher">Voucher</option>
                                </select>
                                <div className="form-hint">Select the payment method used for this recharge</div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                                <button className="btn btn-primary" onClick={handleRecharge} disabled={submitting}>
                                    <PaymentIcon fontSize="small" />
                                    {submitting ? 'Processing...' : 'Recharge'}
                                </button>
                                <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                                    ✕ Cancel
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
