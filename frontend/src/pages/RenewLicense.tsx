import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PaymentIcon from '@mui/icons-material/Payment';
import PrintIcon from '@mui/icons-material/Print';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { licenseApi, type LicenseResponse } from '../api/client';
import authStore from '../stores/authStore';
import { formatDate } from '../utils/formatters';

export default function RenewLicense() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = authStore.useAuth();
    
    const [license, setLicense] = useState<LicenseResponse | null>(null);
    const [phone, setPhone] = useState(user?.phone || '');
    const [name, setName] = useState(user?.fullName || user?.username || '');
    const [email, setEmail] = useState(user?.email || '');
    const [submitting, setSubmitting] = useState(false);
    const [paymentSent, setPaymentSent] = useState(false);
    const [paymentMessage, setPaymentMessage] = useState('');
    
    // Check if we came from "Pay Outstanding"
    const isPayingBalance = location.state?.amount !== undefined;
    const balanceAmount = location.state?.amount || 0;

    const [selectedPackage, setSelectedPackage] = useState<number>(isPayingBalance ? 0 : 1);

    useEffect(() => {
        licenseApi.getLicense().then(setLicense).catch(console.error);
    }, []);

    const basePrice = license?.plan?.price || 20000;

    const packages = [
        { months: 1, title: '1 Month License', subtitle: 'Standard 30-day license', price: basePrice, save: 0 },
        { months: 3, title: '3 Months License', subtitle: `Save TZS ${(basePrice * 3 * 0.167).toLocaleString()} (16.7% off)`, price: basePrice * 3 - (basePrice * 3 * 0.167), save: basePrice * 3 * 0.167 },
        { months: 6, title: '6 Months License', subtitle: 'Best value for half year', price: basePrice * 6 - (basePrice * 6 * 0.20), save: basePrice * 6 * 0.20 },
        { months: 12, title: '12 Months License', subtitle: `Save TZS ${(basePrice * 12 * 0.167).toLocaleString()} (16.7% off)`, price: basePrice * 12 - (basePrice * 12 * 0.167), save: basePrice * 12 * 0.167 },
    ];

    const handlePayment = async () => {
        if (!phone) {
            alert("Please enter a valid phone number");
            return;
        }
        const amountToPay = getAmountToPay();
        if (!amountToPay || amountToPay <= 0) {
            alert("Please select a valid payment package");
            return;
        }
        setSubmitting(true);
        try {
            let amount = balanceAmount;
            let months = 0;
            
            if (selectedPackage > 0) {
                const pkg = packages.find(p => p.months === selectedPackage);
                if (pkg) {
                    amount = pkg.price;
                    months = pkg.months;
                }
            }

            const res = await licenseApi.renewLicense({
                packageMonths: months,
                phoneNumber: phone,
                amount: amount,
                invoiceId: selectedPackage === 0 ? license?.outstandingInvoices?.[0]?.id : undefined
            });
            
            if (res.success) {
                setPaymentMessage(res.message || 'STK push sent! Please enter your mobile money PIN to complete the payment.');
                setPaymentSent(true);
            } else {
                alert("Payment failed. Please try again.");
            }
        } catch (err: any) {
            alert(err.message || 'Payment initiation failed');
        } finally {
            setSubmitting(false);
        }
    };

    const getAmountToPay = () => {
        if (selectedPackage === 0) return balanceAmount;
        return packages.find(p => p.months === selectedPackage)?.price || 0;
    };

    const handlePrintInvoice = () => {
        const issueDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const periodFrom = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const periodTo = new Date(Date.now() + (selectedPackage || 1) * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const dueDate = license?.outstandingInvoices?.[0]?.dueDate || 'Immediately';
        const invoiceRef = license?.outstandingInvoices?.[0]?.id || 'INV-RENEWAL';
        const description = selectedPackage === 0 ? 'Outstanding Invoice Balance' : `License Fee - ${selectedPackage} Month(s)`;
        const amount = getAmountToPay().toLocaleString(undefined, { maximumFractionDigits: 0 });

        const printContent = `
            <html><head><title>Invoice ${invoiceRef}</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
                h1 { font-size: 1.8rem; margin-bottom: 4px; color: #333; }
                .header-flex { display: flex; justify-content: space-between; border-top: 4px solid #d32f2f; padding-top: 24px; margin-bottom: 32px; }
                .header-flex h2 { font-size: 1.2rem; font-weight: 700; margin: 0 0 8px 0; }
                .header-flex h1 { font-size: 1.5rem; font-weight: 300; color: #666; letter-spacing: 2px; margin: 0 0 8px 0; }
                .info-grid { display: grid; grid-template-columns: 1fr auto auto; gap: 32px; margin-bottom: 32px; }
                .info-label { font-size: 0.75rem; color: #666; margin-bottom: 8px; }
                .info-value { font-weight: 600; margin-bottom: 4px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
                th { text-align: left; padding: 8px 0; font-size: 0.75rem; color: #666; border-bottom: 2px solid #eee; }
                th.right { text-align: right; }
                td { padding: 16px 0; border-bottom: 1px solid #eee; }
                td.right { text-align: right; }
                .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
                .totals-box { width: 300px; }
                .total-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
                .balance-due { display: flex; justify-content: space-between; padding: 8px 0; font-weight: 700; font-size: 1.1rem; }
                .notes { font-size: 0.85rem; color: #666; line-height: 1.5; margin-bottom: 32px; }
                .footer { background: #f8f9fa; padding: 16px; text-align: center; font-size: 0.85rem; color: #666; border-radius: 4px; border-top: 1px solid #eee; }
            </style></head><body>
            
            <div class="header-flex">
                <div>
                    <h2>${license?.companyName || 'Our Company'}</h2>
                    <div style="font-size: 0.85rem; color: #666; line-height: 1.5">
                        support@${license?.companyName ? license.companyName.toLowerCase().replace(/\s+/g, '') : 'company'}.com<br/>
                        +255787109988
                    </div>
                </div>
                <div style="text-align: right;">
                    <h1>INVOICE</h1>
                    <div style="font-weight: 600">${invoiceRef}</div>
                </div>
            </div>

            <div class="info-grid">
                <div>
                    <div class="info-label">BILL TO</div>
                    <div class="info-value">${name.toUpperCase()}</div>
                    <div style="font-size: 0.85rem; color: #666; line-height: 1.5">
                        ${email ? email + '<br/>' : ''}
                        ${phone}
                    </div>
                </div>
                <div>
                    <div class="info-label">ISSUED</div>
                    <div style="font-weight: 500; margin-bottom: 16px;">${issueDate}</div>
                    <div class="info-label">PERIOD</div>
                    <div style="font-weight: 500;">${periodFrom} - ${periodTo}</div>
                </div>
                <div style="text-align: right;">
                    <div class="info-label">DUE DATE</div>
                    <div style="font-weight: 500; color: #d32f2f;">${dueDate}</div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>DESCRIPTION</th>
                        <th class="right">QTY</th>
                        <th class="right">PRICE</th>
                        <th class="right">TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="font-weight: 500;">${description}</td>
                        <td class="right" style="color: #1976d2;">1</td>
                        <td class="right">TZS ${amount}</td>
                        <td class="right" style="font-weight: 600;">TZS ${amount}</td>
                    </tr>
                </tbody>
            </table>

            <div class="totals">
                <div class="totals-box">
                    <div class="total-row">
                        <span style="color: #666;">Subtotal</span>
                        <span>TZS ${amount}</span>
                    </div>
                    <div class="balance-due">
                        <span>Balance Due</span>
                        <span>TZS ${amount}</span>
                    </div>
                </div>
            </div>

            <div>
                <div style="color: #666; font-size: 0.85rem; margin-bottom: 8px;"><strong>Notes</strong></div>
                <div class="notes">
                    Auto-generated: License renewal - Cycle from ${periodFrom} to ${periodTo} - TSH ${amount}
                </div>
            </div>

            <div class="footer">
                Thank you for your business! Questions? Contact support@${license?.companyName ? license.companyName.toLowerCase().replace(/\s+/g, '') : 'company'}.com
            </div>

            </body></html>
        `;
        const w = window.open('', '_blank');
        if (w) { 
            w.document.write(printContent); 
            w.document.close(); 
            setTimeout(() => { w.print(); }, 250);
        }
    };

    // ── Payment Success Screen ────────────────────────────────────────────────
    if (paymentSent) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-lighter)', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-family)', padding: '2rem' }}>
                <div className="card" style={{ maxWidth: 480, width: '100%', padding: '2.5rem 2rem', textAlign: 'center', boxShadow: 'var(--shadow-md)', borderTop: '4px solid #2e7d32' }}>
                    <div style={{ margin: '0 auto 1.5rem', width: 72, height: 72, borderRadius: '50%', background: '#e8f5e9', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircleIcon style={{ fontSize: 40 }} />
                    </div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Payment Initiated</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
                        {paymentMessage}
                    </p>
                    <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        After entering your PIN, your account will be reviewed and activated shortly.
                        If you experience any issues, please contact support.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <button className="btn btn-primary" style={{ background: '#1a1a2e', color: 'white', width: '100%' }} onClick={() => navigate('/dashboard')}>
                            Go to Dashboard
                        </button>
                        <button className="btn btn-secondary" style={{ width: '100%', border: '1px solid var(--border-light)' }} onClick={() => setPaymentSent(false)}>
                            Back to Renewal
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-lighter)', fontFamily: 'var(--font-family)', justifyContent: 'center', padding: 'clamp(10px, 3vw, 2rem)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', width: '100%', maxWidth: 1000 }}>
                
                {/* Left Column - Payment Selection */}
                <div style={{ flex: '1 1 300px', background: '#fff', borderRadius: '12px', boxShadow: 'var(--shadow-md)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: '#1a1a2e', color: 'white', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                        <PaymentIcon fontSize="small" /> Pay Invoice
                    </div>
                    <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Choose Payment Package:</div>
                        
                        {packages.map(pkg => (
                            <div 
                                key={pkg.months} 
                                onClick={() => setSelectedPackage(pkg.months)}
                                style={{ 
                                    border: `2px solid ${selectedPackage === pkg.months ? '#1a1a2e' : 'var(--border-light)'}`, 
                                    background: selectedPackage === pkg.months ? '#f8f9fa' : 'white',
                                    padding: '1rem', 
                                    borderRadius: '8px', 
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pkg.title}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{pkg.subtitle}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700 }}>TZS {pkg.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                    {pkg.save > 0 && <div style={{ fontSize: '0.8rem', color: '#2e7d32' }}>Save TZS {pkg.save.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>}
                                </div>
                            </div>
                        ))}

                        {isPayingBalance && balanceAmount > 0 && (
                            <div 
                                onClick={() => setSelectedPackage(0)}
                                style={{ 
                                    border: `2px solid ${selectedPackage === 0 ? '#1976d2' : 'var(--border-light)'}`, 
                                    background: selectedPackage === 0 ? '#1976d2' : 'white',
                                    color: selectedPackage === 0 ? 'white' : 'var(--text-primary)',
                                    padding: '1rem', 
                                    borderRadius: '8px', 
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 600 }}>Pay Invoice Balance</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Current amount due</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700 }}>TZS {balanceAmount.toLocaleString()}</div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Balance due</div>
                                </div>
                            </div>
                        )}

                        <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '8px', textAlign: 'center', marginTop: '1rem' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Amount to Pay</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0' }}>
                                <span style={{ fontSize: '1rem', verticalAlign: 'super' }}>TZS</span> {getAmountToPay().toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                            <span style={{ background: '#00d4ff', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>Invoice Balance</span>
                        </div>

                        <div className="form-group" style={{ marginTop: '1rem' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Phone Number</label>
                            <input type="text" className="form-control" value={phone} onChange={e => setPhone(e.target.value)} placeholder="06XXXXXXXX" />
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>M-Pesa, Tigo Pesa, Airtel Money</div>
                        </div>

                        <div className="form-group">
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Your Name</label>
                            <input type="text" className="form-control" value={name} onChange={e => setName(e.target.value)} />
                        </div>

                        <div className="form-group">
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Email Address</label>
                            <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>

                        <button 
                            className="btn btn-primary" 
                            style={{ background: '#1a1a2e', color: 'white', padding: '1rem', width: '100%', marginTop: '0.5rem' }}
                            onClick={handlePayment}
                            disabled={submitting}
                        >
                            <PaymentIcon fontSize="small" /> {submitting ? 'Processing...' : `Pay TZS ${getAmountToPay().toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        </button>
                    </div>
                </div>

                {/* Right Column - Invoice Preview */}
                <div style={{ flex: '1 1 400px', background: '#fff', borderRadius: '12px', boxShadow: 'var(--shadow-md)', padding: 'clamp(14px, 3.5vw, 2rem)', display: 'flex', flexDirection: 'column', overflowX: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '2rem' }}>
                        <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={handlePrintInvoice}><PrintIcon fontSize="small" /> Print</button>
                        <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#333', color: 'white' }} onClick={() => { alert('Choose "Save as PDF" as the destination in the print dialog to save.'); handlePrintInvoice(); }}><DescriptionIcon fontSize="small" /> PDF</button>
                    </div>

                    <div style={{ borderTop: '4px solid #d32f2f', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>{license?.companyName || 'Our Company'}</h2>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                support@{license?.companyName ? license.companyName.toLowerCase().replace(/\s+/g, '') : 'company'}.com<br/>
                                +255787109988
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 300, color: 'var(--text-secondary)', letterSpacing: 2, margin: '0 0 0.5rem 0' }}>INVOICE</h1>
                            <div style={{ fontWeight: 600 }}>{license?.outstandingInvoices?.[0]?.id || 'INV-RENEWAL'}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'space-between', marginBottom: '2rem' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>BILL TO</div>
                            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{name.toUpperCase()}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {email}<br/>
                                {phone}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>ISSUED</div>
                            <div style={{ fontWeight: 500, marginBottom: '1rem' }}>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                            
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>PERIOD</div>
                            <div style={{ fontWeight: 500 }}>
                                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - 
                                {new Date(Date.now() + (selectedPackage || 1) * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>DUE DATE</div>
                            <div style={{ fontWeight: 500, color: '#d32f2f' }}>
                                {license?.outstandingInvoices?.[0]?.dueDate ? formatDate(license.outstandingInvoices[0].dueDate) : 'Immediately'}
                            </div>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                                <th style={{ textAlign: 'left', padding: '0.5rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>DESCRIPTION</th>
                                <th style={{ textAlign: 'right', padding: '0.5rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>QTY</th>
                                <th style={{ textAlign: 'right', padding: '0.5rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>PRICE</th>
                                <th style={{ textAlign: 'right', padding: '0.5rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                                <td style={{ padding: '1rem 0', fontWeight: 500, fontSize: '0.9rem' }}>
                                    {selectedPackage === 0 ? 'Outstanding Invoice Balance' : `License Fee - ${selectedPackage} Month(s)`}
                                </td>
                                <td style={{ padding: '1rem 0', textAlign: 'right', color: '#1976d2' }}>1</td>
                                <td style={{ padding: '1rem 0', textAlign: 'right' }}>TZS {getAmountToPay().toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 600 }}>TZS {getAmountToPay().toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
                        <div style={{ width: 'min(250px, 100%)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-light)', fontSize: '0.9rem' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                                <span>TZS {getAmountToPay().toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontWeight: 700, fontSize: '1.1rem' }}>
                                <span>Balance Due</span>
                                <span>TZS {getAmountToPay().toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                            <DescriptionIcon fontSize="small" /> Notes
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            Auto-generated: License renewal - Cycle from {new Date().toLocaleDateString('en-US')} to {new Date(Date.now() + (selectedPackage || 1) * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US')} - TSH {getAmountToPay().toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                    </div>

                    <div style={{ background: '#f8f9fa', padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', borderRadius: '4px', borderTop: '1px solid var(--border-light)', marginTop: '2rem' }}>
                        Thank you for your business! Questions? Contact support@{license?.companyName ? license.companyName.toLowerCase().replace(/\s+/g, '') : 'company'}.com
                    </div>
                </div>

            </div>
        </div>
    );
}
