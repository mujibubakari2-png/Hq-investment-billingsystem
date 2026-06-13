/**
 * CustomizerPanel — left-side controls for HotspotLoginCustomizer
 * FE-001: Extracted from HotspotLoginCustomizer.tsx
 */

import PaletteIcon    from '@mui/icons-material/Palette';
import TextFieldsIcon  from '@mui/icons-material/TextFields';
import ViewModuleIcon  from '@mui/icons-material/ViewModule';
import CampaignIcon    from '@mui/icons-material/Campaign';
import PersonIcon      from '@mui/icons-material/Person';
import BusinessIcon    from '@mui/icons-material/Business';
import DownloadIcon    from '@mui/icons-material/Download';
import PreviewIcon     from '@mui/icons-material/Preview';
import GridViewIcon    from '@mui/icons-material/GridView';
import ViewColumnIcon  from '@mui/icons-material/ViewColumn';
import ViewListIcon    from '@mui/icons-material/ViewList';

export const FONTS = [
    { name: 'Inter',       description: "Modern & Clean - Perfect for professional look",    provider: "Google's Font" },
    { name: 'Roboto',      description: "Google's Font - Friendly and readable",              provider: '' },
    { name: 'Open Sans',   description: 'Humanist Sans - Very friendly and open',             provider: '' },
    { name: 'Poppins',     description: 'Geometric Sans - Rounded and modern',                provider: '' },
    { name: 'Lato',        description: 'Humanist Sans - Serious but friendly',               provider: '' },
    { name: 'Montserrat',  description: 'Urban Typography - Bold and modern',                 provider: '' },
    { name: 'Nunito',      description: 'Rounded Sans - Soft and friendly',                   provider: '' },
];

export interface CustomizerPanelProps {
    // Colors
    primaryColor: string;       setPrimaryColor:       (v: string)  => void;
    accentColor: string;        setAccentColor:        (v: string)  => void;
    // Typography
    selectedFont: string;       setSelectedFont:       (v: string)  => void;
    // Layout
    layout: 'grid' | 'horizontal' | 'vertical';
    setLayout: (v: 'grid' | 'horizontal' | 'vertical') => void;
    // Ads
    enableAds: boolean;         setEnableAds:          (v: boolean) => void;
    adMessage: string;          setAdMessage:          (v: string)  => void;
    // UX
    enableRememberMe: boolean;  setEnableRememberMe:   (v: boolean) => void;
    // Company
    companyName: string;        setCompanyName:        (v: string)  => void;
    customerCareNumber: string; setCustomerCareNumber: (v: string)  => void;
    backendUrl: string;         setBackendUrl:         (v: string)  => void;
    // Actions
    saving: boolean;
    saveSuccess: boolean;
    saveError: string | null;
    syncStatus: { status: 'success' | 'error'; message: string } | null;
    onSave:           () => void;
    onPreview:        () => void;
    onDownloadZip:    () => void;
}

export function CustomizerPanel(p: CustomizerPanelProps) {
    const layouts: { key: 'grid' | 'horizontal' | 'vertical'; icon: React.ReactNode; label: string; desc: string }[] = [
        { key: 'grid',       icon: <GridViewIcon />,   label: 'Grid Layout',   desc: 'Packages displayed in a clean vertical list format' },
        { key: 'horizontal', icon: <ViewColumnIcon />, label: 'Horizontal',    desc: 'Compact horizontal scrollable bar with buy buttons' },
        { key: 'vertical',   icon: <ViewListIcon />,   label: 'Vertical Bar',  desc: 'Long thin packages arranged vertically in a scrollable container' },
    ];

    return (
        <div className="card" style={{ padding: 24 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: '1rem' }}>
                <PaletteIcon style={{ color: 'var(--info)' }} /> Customization Options
            </h3>

            {/* ── Colors ── */}
            <div style={{ marginBottom: 24 }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--info)' }}>
                    <PaletteIcon style={{ fontSize: 16 }} /> Colors
                </h4>
                <div className="grid-2 gap-16">
                    <div>
                        <label style={{ fontSize: '0.82rem', fontWeight: 500, marginBottom: 6, display: 'block' }}>Primary Color</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="color" value={p.primaryColor} onChange={e => p.setPrimaryColor(e.target.value)}
                                style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Text &amp; Borders<br />Used for headings and borders</span>
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.82rem', fontWeight: 500, marginBottom: 6, display: 'block' }}>Accent Color</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="color" value={p.accentColor} onChange={e => p.setAccentColor(e.target.value)}
                                style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Buttons &amp; Highlights<br />Used for buttons and icons</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Typography ── */}
            <div style={{ marginBottom: 24 }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--info)' }}>
                    <TextFieldsIcon style={{ fontSize: 16 }} /> Typography
                </h4>
                <label style={{ fontSize: '0.82rem', fontWeight: 500, marginBottom: 8, display: 'block' }}>Font Family</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {FONTS.map(font => (
                        <label key={font.name} onClick={() => p.setSelectedFont(font.name)} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            background:   p.selectedFont === font.name ? '#eff6ff' : '#fff',
                            borderColor:  p.selectedFont === font.name ? 'var(--info)'   : 'var(--border)',
                        }}>
                            <div style={{ width: 14, height: 14, borderRadius: '50%', border: p.selectedFont === font.name ? '4px solid var(--info)' : '2px solid var(--border)' }} />
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', fontFamily: font.name }}>{font.name}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{font.description}</div>
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {/* ── Layout ── */}
            <div style={{ marginBottom: 24 }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--info)' }}>
                    <ViewModuleIcon style={{ fontSize: 16 }} /> Package Display Layout
                </h4>
                <div className="grid-3 gap-10">
                    {layouts.map(l => (
                        <div key={l.key} onClick={() => p.setLayout(l.key)} style={{
                            border: p.layout === l.key ? '2px solid var(--info)' : '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', padding: 12, cursor: 'pointer',
                            background: p.layout === l.key ? '#eff6ff' : '#fff', textAlign: 'center',
                        }}>
                            <div style={{ color: p.layout === l.key ? 'var(--info)' : 'var(--text-secondary)', marginBottom: 4 }}>{l.icon}</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>{l.label}</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                                <div style={{ width: 12, height: 12, borderRadius: '50%', border: p.layout === l.key ? '4px solid var(--info)' : '2px solid var(--border)' }} />
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{l.desc}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Advertisement ── */}
            <div style={{ marginBottom: 20 }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'var(--info)' }}>
                    <CampaignIcon style={{ fontSize: 16 }} /> Advertisement Settings
                </h4>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: p.enableAds ? 12 : 0 }}>
                    <input type="checkbox" checked={p.enableAds} onChange={e => p.setEnableAds(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2 }} />
                    <div>
                        <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>Enable Advertisement Banner</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Display an advertisement banner at the top of the login page.</div>
                    </div>
                </label>
                {p.enableAds && (
                    <div style={{ marginLeft: 24, padding: '10px 14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginBottom: 6, fontWeight: 600 }}>Advertisement Text</label>
                        <input type="text" value={p.adMessage} onChange={e => p.setAdMessage(e.target.value)}
                            placeholder="Type your advertisement completely..."
                            style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.85rem' }} />
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 6 }}>You can use emojis like 🎉, ⚡ locally!</div>
                    </div>
                )}
            </div>

            {/* ── UX Features ── */}
            <div style={{ marginBottom: 20 }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: '#d97706' }}>
                    <PersonIcon style={{ fontSize: 16 }} /> User Experience Features
                </h4>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', border: '1px solid #fef3c7', borderRadius: 'var(--radius-sm)', padding: 10 }}>
                    <input type="checkbox" checked={p.enableRememberMe} onChange={e => p.setEnableRememberMe(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2 }} />
                    <div>
                        <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>Remember Me Feature</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>When enabled, users will be automatically reconnected as long as their subscription is active. Works even if username changes – remembers by account ID, MAC address, and device fingerprint.</div>
                    </div>
                </label>
            </div>

            {/* ── Company Info ── */}
            <div style={{ marginBottom: 20 }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--primary)' }}>
                    <BusinessIcon style={{ fontSize: 16 }} /> Company &amp; System Information
                </h4>
                <div className="grid-2 gap-12" style={{ marginBottom: 12 }}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.82rem' }}>Company Name</label>
                        <input type="text" className="form-input" value={p.companyName} onChange={e => p.setCompanyName(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.82rem' }}>Customer Care Number</label>
                        <input type="text" className="form-input" value={p.customerCareNumber} onChange={e => p.setCustomerCareNumber(e.target.value)} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.82rem' }}>Backend API URL Override</label>
                    <input type="text" className="form-input" value={p.backendUrl} onChange={e => p.setBackendUrl(e.target.value)} placeholder="https://api.yourdomain.com" />
                    <div className="form-hint" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                        The public URL of this billing system backend. Used for payments and voucher redemption.
                    </div>
                </div>
            </div>

            {/* ── Actions ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 24 }}>
                <button className="btn" onClick={p.onSave} disabled={p.saving}
                    style={{ background: p.saving ? '#818cf8' : '#4f46e5', color: '#fff', fontWeight: 600, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    {p.saving ? '⏳ Saving...' : '💾 Save Customization'}
                </button>
                <button className="btn" onClick={p.onPreview}
                    style={{ background: '#2563eb', color: '#fff', fontWeight: 600, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <PreviewIcon fontSize="small" /> Preview Changes
                </button>
                <button className="btn" onClick={p.onDownloadZip}
                    style={{ background: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 20px', gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <DownloadIcon fontSize="small" /> Download ZIP File
                </button>
            </div>

            {/* Feedback banners */}
            {p.saveSuccess && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, color: '#15803d', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ✅ Settings saved successfully!
                </div>
            )}
            {p.saveError && (
                <div style={{ marginTop: 10, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ❌ {p.saveError}
                </div>
            )}
            {p.syncStatus && (
                <div style={{
                    marginTop: 10, padding: '10px 14px',
                    background: p.syncStatus.status === 'success' ? '#f0fdf4' : '#fffbeb',
                    border: `1px solid ${p.syncStatus.status === 'success' ? '#86efac' : '#fde68a'}`,
                    borderRadius: 8,
                    color: p.syncStatus.status === 'success' ? '#15803d' : '#b45309',
                    fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {p.syncStatus.status === 'success' ? '✅' : '⚠️'} {p.syncStatus.message}
                    </div>
                    {p.syncStatus.status === 'error' && (
                        <button onClick={p.onSave}
                            style={{ background: 'transparent', border: '1px solid #fcd34d', borderRadius: 4, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', color: '#92400e', fontWeight: 600 }}>
                            Retry Sync
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
