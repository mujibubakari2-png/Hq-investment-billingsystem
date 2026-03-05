import { useState } from 'react';
import PaletteIcon from '@mui/icons-material/Palette';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import CampaignIcon from '@mui/icons-material/Campaign';
import AnnouncementIcon from '@mui/icons-material/Announcement';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import PreviewIcon from '@mui/icons-material/Preview';
import DownloadIcon from '@mui/icons-material/Download';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import GridViewIcon from '@mui/icons-material/GridView';
import WifiIcon from '@mui/icons-material/Wifi';
import PaymentIcon from '@mui/icons-material/Payment';
import LinkIcon from '@mui/icons-material/Link';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';

const fonts = [
    { name: 'Inter', description: 'Modern & Clean - Perfect for professional look', provider: "Google's Font" },
    { name: 'Roboto', description: "Google's Font - Friendly and readable", provider: '' },
    { name: 'Open Sans', description: 'Humanist Sans - Very friendly and open', provider: '' },
    { name: 'Poppins', description: 'Geometric Sans - Rounded and modern', provider: '' },
    { name: 'Lato', description: 'Humanist Sans - Serious but friendly', provider: '' },
    { name: 'Montserrat', description: 'Urban Typography - Bold and modern', provider: '' },
    { name: 'Nunito', description: 'Rounded Sans - Soft and friendly', provider: '' },
];

export default function HotspotLoginCustomizer() {
    const [primaryColor, setPrimaryColor] = useState('#1a1a2e');
    const [accentColor, setAccentColor] = useState('#6366f1');
    const [selectedFont, setSelectedFont] = useState('Inter');
    const [layout, setLayout] = useState<'grid' | 'horizontal' | 'vertical'>('grid');
    const [enableAds, setEnableAds] = useState(false);
    const [enableAnnouncement, setEnableAnnouncement] = useState(true);
    const [enableRememberMe, setEnableRememberMe] = useState(true);
    const [companyName, setCompanyName] = useState('HQ INVESTMENT');
    const [customerCareNumber, setCustomerCareNumber] = useState('0621085215');

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <WifiIcon style={{ color: '#16a34a' }} /> Hotspot Login Customizer
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Customize and download your hotspot login page</p>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <div>Company: <strong>HQ INVESTMENT</strong></div>
                    <div>Router: <strong>INVESTMENT-123</strong></div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
                {/* Left: Customization Options */}
                <div>
                    <div className="card" style={{ padding: 24 }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: '1rem' }}>
                            <PaletteIcon style={{ color: 'var(--info)' }} /> Customization Options
                        </h3>

                        {/* Colors */}
                        <div style={{ marginBottom: 24 }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--info)' }}>
                                <PaletteIcon style={{ fontSize: 16 }} /> Colors
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 500, marginBottom: 6, display: 'block' }}>Primary Color</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                                            style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Text & Borders<br />Used for headings and borders</span>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 500, marginBottom: 6, display: 'block' }}>Accent Color</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                                            style={{ width: 36, height: 36, border: 'none', cursor: 'pointer', borderRadius: 4 }} />
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Buttons & Highlights<br />Used for buttons and icons</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Typography */}
                        <div style={{ marginBottom: 24 }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--info)' }}>
                                <TextFieldsIcon style={{ fontSize: 16 }} /> Typography
                            </h4>
                            <label style={{ fontSize: '0.82rem', fontWeight: 500, marginBottom: 8, display: 'block' }}>Font Family</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {fonts.map(font => (
                                    <label key={font.name} onClick={() => setSelectedFont(font.name)} style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer', background: selectedFont === font.name ? '#eff6ff' : '#fff',
                                        borderColor: selectedFont === font.name ? 'var(--info)' : 'var(--border)',
                                    }}>
                                        <div style={{
                                            width: 14, height: 14, borderRadius: '50%',
                                            border: selectedFont === font.name ? '4px solid var(--info)' : '2px solid var(--border)',
                                        }} />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', fontFamily: font.name }}>{font.name}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{font.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Package Display Layout */}
                        <div style={{ marginBottom: 24 }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--info)' }}>
                                <ViewModuleIcon style={{ fontSize: 16 }} /> Package Display Layout
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                                {[
                                    { key: 'grid' as const, icon: <GridViewIcon />, label: 'Grid Layout', desc: 'Packages displayed in a clean vertical list format' },
                                    { key: 'horizontal' as const, icon: <ViewColumnIcon />, label: 'Horizontal', desc: 'Compact horizontal scrollable bar with buy buttons' },
                                    { key: 'vertical' as const, icon: <ViewListIcon />, label: 'Vertical Bar', desc: 'Long thin packages arranged vertically in a scrollable container' },
                                ].map(l => (
                                    <div key={l.key} onClick={() => setLayout(l.key)}
                                        style={{
                                            border: layout === l.key ? '2px solid var(--info)' : '1px solid var(--border)',
                                            borderRadius: 'var(--radius-sm)', padding: 12, cursor: 'pointer',
                                            background: layout === l.key ? '#eff6ff' : '#fff', textAlign: 'center',
                                        }}>
                                        <div style={{ color: layout === l.key ? 'var(--info)' : 'var(--text-secondary)', marginBottom: 4 }}>{l.icon}</div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>{l.label}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                                            <div style={{ width: 12, height: 12, borderRadius: '50%', border: layout === l.key ? '4px solid var(--info)' : '2px solid var(--border)' }} />
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{l.desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Advertisement Settings */}
                        <div style={{ marginBottom: 20 }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'var(--info)' }}>
                                <CampaignIcon style={{ fontSize: 16 }} /> Advertisement Settings
                            </h4>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
                                <input type="checkbox" checked={enableAds} onChange={e => setEnableAds(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2 }} />
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>Enable Advertisement Slider</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Display rotating advertisements at the top of the login page. Ads will slide automatically every 5 seconds.</div>
                                </div>
                            </label>
                        </div>

                        {/* Announcement Popup */}
                        <div style={{ marginBottom: 20 }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: 'var(--primary)' }}>
                                <AnnouncementIcon style={{ fontSize: 16 }} /> Announcement Popup
                            </h4>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: 10 }}>
                                <input type="checkbox" checked={enableAnnouncement} onChange={e => setEnableAnnouncement(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2 }} />
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>Enable Announcement Popup</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Show a popup announcement when users first visit the login page. Features close/ok, OKE key support, and modern design.</div>
                                </div>
                            </label>
                        </div>

                        {/* User Experience Features */}
                        <div style={{ marginBottom: 20 }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color: '#d97706' }}>
                                <PersonIcon style={{ fontSize: 16 }} /> User Experience Features
                            </h4>
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', border: '1px solid #fef3c7', borderRadius: 'var(--radius-sm)', padding: 10 }}>
                                <input type="checkbox" checked={enableRememberMe} onChange={e => setEnableRememberMe(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2 }} />
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>Remember Me Feature</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>When enabled, users will be automatically reconnected as long as their subscription is active. Works even if username changes – remembers by account ID, MAC address, and device fingerprint.</div>
                                </div>
                            </label>
                        </div>

                        {/* Company Information */}
                        <div style={{ marginBottom: 20 }}>
                            <h4 style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, color: 'var(--primary)' }}>
                                <BusinessIcon style={{ fontSize: 16 }} /> Company Information
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '0.82rem' }}>Company Name</label>
                                    <input type="text" className="form-input" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '0.82rem' }}>Customer Care Number</label>
                                    <input type="text" className="form-input" value={customerCareNumber} onChange={e => setCustomerCareNumber(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                            <button className="btn" style={{ background: 'var(--info)', color: '#fff', fontWeight: 600, padding: '10px 20px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <PreviewIcon fontSize="small" /> Preview Changes
                            </button>
                            <button className="btn" style={{ background: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 20px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <DownloadIcon fontSize="small" /> Download ZIP File
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Live Preview */}
                <div>
                    <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: 20 }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <PreviewIcon style={{ fontSize: 16, color: '#16a34a' }} /> Live Preview
                        </div>

                        {/* Preview area */}
                        <div style={{
                            background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                            padding: 20, minHeight: 400,
                        }}>
                            <div style={{
                                background: '#fff', borderRadius: 12, padding: 20,
                                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                            }}>
                                {/* Hotspot header */}
                                <div style={{
                                    background: accentColor, borderRadius: 8, padding: '12px 16px',
                                    color: '#fff', textAlign: 'center', marginBottom: 16,
                                }}>
                                    <h4 style={{ fontFamily: selectedFont, margin: 0, fontSize: '0.95rem' }}>{companyName} HOTSPOT</h4>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 6, fontSize: '0.7rem' }}>
                                        <span>📶 Select</span> <span><PaymentIcon style={{ fontSize: 12 }} /> Pay</span> <span><LinkIcon style={{ fontSize: 12 }} /> Connect</span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', marginTop: 4 }}>
                                        <SupportAgentIcon style={{ fontSize: 12 }} /> Support: {customerCareNumber}
                                    </div>
                                </div>

                                {/* Packages */}
                                <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 8 }}>Available Packages</div>

                                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>⚡ 1 Hour Package</div>
                                        <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>Idha 500 • 1 Hour</div>
                                    </div>
                                    <button style={{ background: accentColor, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>Buy Now</button>
                                </div>

                                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>⚡ Daily Package</div>
                                        <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>Idha 1000 • 24 Hours</div>
                                    </div>
                                    <button style={{ background: accentColor, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}>Buy Now</button>
                                </div>

                                {/* Active Package Login */}
                                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.72rem', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <WifiIcon style={{ fontSize: 12 }} /> Active Package Login
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <input type="text" placeholder="mg@hotako@3ges..." style={{ flex: 1, fontSize: '0.68rem', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }} />
                                        <input type="password" placeholder="••••" style={{ width: 50, fontSize: '0.68rem', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }} />
                                        <button style={{ background: accentColor, color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: '0.65rem', fontWeight: 600, cursor: 'pointer' }}>Connect</button>
                                    </div>
                                    <div style={{ fontSize: '0.6rem', color: '#9ca3af', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <input type="checkbox" style={{ width: 10, height: 10 }} /> Remember me (auto reconnect while subscribed)
                                    </div>
                                </div>
                            </div>

                            {/* Preview note */}
                            <div style={{
                                marginTop: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.9)',
                                borderRadius: 6, fontSize: '0.68rem', color: '#374151',
                            }}>
                                <strong style={{ color: 'var(--primary)' }}>Preview Note:</strong> This is a simplified preview. The actual downloaded ZIP file will include all functionality including the improved announcement popup with close/ok icons and support for multiple image formats (JPG, PNG, WEBP, GIF, AVIF, SVG).
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
