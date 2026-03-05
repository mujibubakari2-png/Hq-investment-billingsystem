import { useState } from 'react';
import PaymentIcon from '@mui/icons-material/Payment';

import { useNavigate } from 'react-router-dom';

export default function RechargeAccount() {
    const [selectedAccount, setSelectedAccount] = useState('');
    const [planType, setPlanType] = useState<'hotspot' | 'pppoe'>('hotspot');
    const [router, setRouter] = useState('');
    const [servicePlan, setServicePlan] = useState('');
    const [paymentUsing, setPaymentUsing] = useState('Cash');
    const navigate = useNavigate();

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
                                <option value="HS-CW99147">HS-CW99147</option>
                                <option value="HS-WS10605">HS-WS10605</option>
                                <option value="0746052196">0746052196</option>
                            </select>
                            <div className="form-hint">Choose the customer account you want to recharge</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ color: 'var(--primary)' }}>
                                2. Type
                            </label>
                            <div className="tabs" style={{ marginBottom: 0 }}>
                                <button
                                    className={`tab ${planType === 'hotspot' ? 'active' : ''}`}
                                    onClick={() => setPlanType('hotspot')}
                                >
                                    Hotspot Plans
                                </button>
                                <button
                                    className={`tab ${planType === 'pppoe' ? 'active' : ''}`}
                                    onClick={() => setPlanType('pppoe')}
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
                                onChange={(e) => setRouter(e.target.value)}
                            >
                                <option value="">Select Routers</option>
                                <option value="INVESTMENT-123">INVESTMENT-123</option>
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
                                <option value="masaa 6">masaa 6 - TZS 500</option>
                                <option value="masaa 24">masaa 24 - TZS 1,000</option>
                                <option value="siku 3">siku 3 - TZS 2,500</option>
                                <option value="siku 7">siku 7 - TZS 5,000</option>
                            </select>
                            <div className="form-hint">Select the service package for this account</div>
                        </div>
                    </div>

                    {/* Row 3: Using */}
                    <div className="form-group">
                        <label className="form-label" style={{ color: 'var(--primary)' }}>
                            5. Using
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
                        <div className="form-hint">Prepaid. Recharge for the first time use TSH 0</div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                        <button className="btn btn-primary">
                            <PaymentIcon fontSize="small" /> Recharge
                        </button>
                        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
                            ✕ Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
