/**
 * HotspotLivePreview — right-side phone mockup for HotspotLoginCustomizer
 * FE-001: Extracted from HotspotLoginCustomizer.tsx
 */

import { useState } from 'react';
import PreviewIcon from '@mui/icons-material/Preview';

interface PreviewPackage {
    id: string;
    name: string;
    price: number;
    validity: string;
}

export interface HotspotLivePreviewProps {
    primaryColor: string;
    accentColor: string;
    selectedFont: string;
    layout: 'grid' | 'horizontal' | 'vertical';
    enableAds: boolean;
    adMessage: string;
    enableRememberMe: boolean;
    companyName: string;
    customerCareNumber: string;
    routerName: string;
    packages: PreviewPackage[];
    onHide: () => void;
}

export function HotspotLivePreview(p: HotspotLivePreviewProps) {
    const [previewPkg,  setPreviewPkg]  = useState<PreviewPackage | null>(null);
    const [paymentStep, setPaymentStep] = useState<'initial' | 'waiting' | 'success'>('initial');
    const [previewPhone, setPreviewPhone] = useState('');

    const gridCols = p.layout === 'horizontal' ? 'repeat(4, 1fr)'
                   : p.layout === 'vertical'   ? '1fr'
                   : 'repeat(3, 1fr)';

    return (
        <div>
            <div className="card" style={{ position: 'sticky', top: 20 }}>
                {/* Card header */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <PreviewIcon style={{ fontSize: 16, color: 'var(--info)' }} /> Live Preview
                    </h3>
                    <button className="btn btn-secondary" style={{ fontSize: '0.72rem', padding: '4px 10px' }} onClick={p.onHide}>Hide</button>
                </div>

                {/* Phone mockup */}
                <div style={{ background: '#f0f4f8', borderRadius: '0 0 12px 12px', overflow: 'hidden', position: 'relative' }}>
                    {/* Brand header */}
                    <div style={{ background: `linear-gradient(135deg, ${p.primaryColor}, ${p.accentColor})`, padding: '14px 12px 12px', textAlign: 'center', color: '#fff', borderRadius: '0 0 14px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                            <span style={{ fontSize: '0.9rem' }}>📶</span>
                            <span style={{ fontWeight: 700, fontSize: '0.82rem', letterSpacing: 0.3, fontFamily: p.selectedFont }}>{p.companyName}</span>
                        </div>
                        <div style={{ fontSize: '0.6rem', fontWeight: 600, opacity: 0.9, marginBottom: 6 }}>Supported Mobile Networks</div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                            {['M-Pesa', 'Airtel', 'T-Pesa', 'HaloPesa'].map(n => (
                                <span key={n} style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 5, padding: '2px 6px', fontSize: '0.52rem', fontWeight: 600 }}>{n}</span>
                            ))}
                        </div>
                        <div style={{ fontSize: '0.58rem', opacity: 0.85, marginBottom: 6 }}>📦 Select · 💳 Pay · 🌐 Connect</div>
                        <div style={{ background: `${p.accentColor}40`, borderRadius: 12, padding: '4px 10px', fontSize: '0.6rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            📞 Support: {p.customerCareNumber || '0621085215'}
                        </div>
                    </div>

                    {/* Ad banner */}
                    {p.enableAds && (
                        <div style={{ background: `linear-gradient(90deg, ${p.accentColor}10, ${p.primaryColor}10)`, padding: '6px 10px', textAlign: 'center', fontSize: '0.55rem', color: p.primaryColor, fontWeight: 600 }}>
                            {p.adMessage || '🎉 Special offer! Get extra data on all packages today!'}
                        </div>
                    )}

                    <div style={{ padding: '10px 12px', fontFamily: p.selectedFont }}>
                        {/* Packages */}
                        <div style={{ fontWeight: 700, color: p.primaryColor, fontSize: '0.68rem', marginBottom: 6 }}>📦 Packages</div>
                        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 5, marginBottom: 10 }}>
                            {p.packages.slice(0, 4).map((pkg, i) => (
                                <div key={i}
                                    onClick={() => { setPreviewPkg(pkg); setPaymentStep('initial'); setPreviewPhone(''); }}
                                    style={{ background: `linear-gradient(135deg, ${p.accentColor}08, ${p.accentColor}15)`, border: `1.5px solid ${p.accentColor}30`, borderRadius: 8, padding: '6px 4px', textAlign: 'center', cursor: 'pointer' }}>
                                    <div style={{ fontSize: '0.52rem', fontWeight: 700, color: p.accentColor, textTransform: 'uppercase' }}>{pkg.name}</div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: p.primaryColor, lineHeight: 1 }}>
                                        <span style={{ fontSize: '0.48rem', color: '#888' }}>TSH </span>{(pkg.price || 0).toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: '0.48rem', color: '#e74c3c', marginTop: 2, marginBottom: 5 }}>⏱ {pkg.validity}</div>
                                    <button style={{ background: p.accentColor, color: '#fff', border: 'none', padding: '3px 0', width: '100%', borderRadius: 4, fontSize: '0.48rem', fontWeight: 700, cursor: 'pointer' }}>Buy</button>
                                </div>
                            ))}
                        </div>

                        {/* Voucher */}
                        <div style={{ fontWeight: 700, color: p.primaryColor, fontSize: '0.62rem', marginBottom: 4 }}>🎟️ Redeem Voucher</div>
                        <div style={{ background: '#f8fafb', border: '1px solid #e8ecf0', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <input placeholder="Voucher code" readOnly style={{ flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.56rem' }} />
                                <button style={{ background: '#e53935', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 5, fontSize: '0.52rem', fontWeight: 700 }}>Redeem</button>
                            </div>
                        </div>

                        {/* Reconnect */}
                        <div style={{ fontWeight: 700, color: p.primaryColor, fontSize: '0.62rem', marginBottom: 4 }}>🔄 Reconnect</div>
                        <div style={{ background: '#f8fafb', border: '1px solid #e8ecf0', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                            <input placeholder="Transaction reference (HP...)" readOnly style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.56rem', marginBottom: 4 }} />
                            <button style={{ width: '100%', background: 'linear-gradient(135deg, #e53935, #c62828)', color: '#fff', border: 'none', padding: '5px', borderRadius: 5, fontSize: '0.56rem', fontWeight: 700 }}>💳 Reconnect</button>
                        </div>

                        {/* Manual Login */}
                        <div style={{ fontWeight: 700, color: p.primaryColor, fontSize: '0.62rem', marginBottom: 4 }}>📶 Manual Login</div>
                        <div style={{ background: '#f8fafb', border: '1px solid #e8ecf0', borderRadius: 8, padding: 8, marginBottom: 6 }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                                <input placeholder="HS-TI07956" readOnly style={{ flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.56rem' }} />
                                <input placeholder="••••" type="password" readOnly style={{ flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.56rem' }} />
                                <button style={{ background: p.accentColor, color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 5, fontSize: '0.52rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Connect</button>
                            </div>
                            {p.enableRememberMe && (
                                <div style={{ marginTop: 4, fontSize: '0.48rem', color: '#888', display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <input type="checkbox" readOnly style={{ width: 8, height: 8 }} />
                                    Remember me (Auto-reconnect while subscribed)
                                </div>
                            )}
                            <div style={{ background: `${p.accentColor}10`, border: `1px solid ${p.accentColor}25`, borderRadius: 5, padding: '4px 8px', marginTop: 6, fontSize: '0.52rem', color: p.primaryColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                                🖥️ MAC: <strong>62:C4:BB:A5:6B:DA</strong>
                            </div>
                        </div>

                        <div style={{ textAlign: 'center', fontSize: '0.48rem', color: '#bbb', marginTop: 6 }}>
                            Powered by {p.companyName} • {p.routerName}
                        </div>
                    </div>

                    {/* Payment Simulation Overlay */}
                    {previewPkg && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 15, zIndex: 10, borderRadius: '0 0 12px 12px', fontFamily: p.selectedFont }}>
                            <div style={{ background: '#fff', borderRadius: 12, width: '100%', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                                <div style={{ background: `linear-gradient(135deg, ${p.primaryColor}, ${p.accentColor})`, padding: 12, color: '#fff', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.55rem', opacity: 0.9 }}>Confirm Purchase</div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{previewPkg.name}</div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>TSH {previewPkg.price.toLocaleString()}</div>
                                </div>

                                {paymentStep === 'initial' && (
                                    <div style={{ padding: 15 }}>
                                        <div style={{ marginBottom: 10 }}>
                                            <label style={{ display: 'block', fontSize: '0.6rem', color: '#666', marginBottom: 4 }}>Enter Mobile Number</label>
                                            <input type="tel" placeholder="0XXXXXXXXX" value={previewPhone} onChange={e => setPreviewPhone(e.target.value)}
                                                style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.7rem' }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={() => setPaymentStep('waiting')}
                                                style={{ flex: 2, background: p.accentColor, color: '#fff', border: 'none', padding: '6px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>Pay Now</button>
                                            <button onClick={() => setPreviewPkg(null)}
                                                style={{ flex: 1, background: '#94a3b8', color: '#fff', border: 'none', padding: '6px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                                        </div>
                                    </div>
                                )}

                                {paymentStep === 'waiting' && (
                                    <div style={{ padding: '25px 15px', textAlign: 'center' }}>
                                        <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 15, fontSize: '0.55rem', fontWeight: 700, background: `${p.accentColor}15`, color: p.accentColor, marginBottom: 8 }}>
                                            Waiting for payment...
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: '#475569', marginBottom: 12 }}>Please enter your PIN on your phone.</div>
                                        <div className="preview-spinner" style={{ width: 20, height: 20, border: `2px solid ${p.accentColor}20`, borderTopColor: p.accentColor, borderRadius: '50%', margin: '0 auto' }} />
                                        <button onClick={() => { setPaymentStep('success'); setTimeout(() => setPreviewPkg(null), 2500); }}
                                            style={{ marginTop: 15, background: 'none', border: 'none', color: p.accentColor, fontSize: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
                                            (Simulate Success)
                                        </button>
                                    </div>
                                )}

                                {paymentStep === 'success' && (
                                    <div style={{ padding: '25px 15px', textAlign: 'center' }}>
                                        <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 15, fontSize: '0.55rem', fontWeight: 700, background: '#22c55e', color: '#fff', marginBottom: 8 }}>PAID!</div>
                                        <div style={{ fontSize: '0.65rem', color: '#065f46', fontWeight: 600 }}>Connecting you online now...</div>
                                        <div style={{ fontSize: '0.8rem', marginTop: 8 }}>✅</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <style>{`
                    @keyframes previewSpin { to { transform: rotate(360deg); } }
                    .preview-spinner { animation: previewSpin 0.8s linear infinite; }
                `}</style>
                <div style={{ padding: '8px 12px', fontSize: '0.72rem', color: '#dc2626' }}>
                    <strong>Preview Note:</strong> Simplified preview. Click "Preview Changes" for the full page, or "Download ZIP" for the complete template.
                </div>
            </div>
        </div>
    );
}
