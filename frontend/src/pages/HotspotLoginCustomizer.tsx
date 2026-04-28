import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import PaletteIcon from '@mui/icons-material/Palette';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import CampaignIcon from '@mui/icons-material/Campaign';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import DownloadIcon from '@mui/icons-material/Download';
import PreviewIcon from '@mui/icons-material/Preview';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import GridViewIcon from '@mui/icons-material/GridView';
import WifiIcon from '@mui/icons-material/Wifi';
import RouterIcon from '@mui/icons-material/Router';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { routersApi, settingsApi, packagesApi, hotspotSettingsApi, CLEAN_API_URL } from '../api/client';
import authStore from '../stores/authStore';
import type { Router } from '../types';

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
    const [searchParams] = useSearchParams();
    const { user } = authStore.useAuth();

    // Router selection
    const [routers, setRouters] = useState<Router[]>([]);
    const [selectedRouterId, setSelectedRouterId] = useState('');
    const [loadingRouters, setLoadingRouters] = useState(true);

    // Packages for the selected router
    const [routerPackages, setRouterPackages] = useState<any[]>([]);

    // Customization options
    const [primaryColor, setPrimaryColor] = useState('#1a1a2e');
    const [accentColor, setAccentColor] = useState('#6366f1');
    const [selectedFont, setSelectedFont] = useState('Inter');
    const [layout, setLayout] = useState<'grid' | 'horizontal' | 'vertical'>('grid');
    const [enableAds, setEnableAds] = useState(false);
    const [adMessage, setAdMessage] = useState('🎉 Special offer! Get extra data on all packages today!');
    const [enableRememberMe, setEnableRememberMe] = useState(true);
    const [companyName, setCompanyName] = useState('');
    const [customerCareNumber, setCustomerCareNumber] = useState('');
    const [backendUrl, setBackendUrl] = useState(CLEAN_API_URL || '');
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Live preview
    const [showPreview, setShowPreview] = useState(true);
    const [previewPaymentPkg, setPreviewPaymentPkg] = useState<any | null>(null);
    const [previewPaymentStep, setPreviewPaymentStep] = useState<'initial' | 'waiting' | 'success'>('initial');
    const [previewPhone, setPreviewPhone] = useState('');

    // Load routers
    useEffect(() => {
        const load = async () => {
            setLoadingRouters(true);
            try {
                const data = await routersApi.list();
                setRouters(data as unknown as Router[]);
                // Auto-select router from URL param or first router
                const routerIdParam = searchParams.get('routerId');
                if (routerIdParam && data.some(r => r.id === routerIdParam)) {
                    setSelectedRouterId(routerIdParam);
                } else if (data.length > 0) {
                    setSelectedRouterId(data[0].id);
                }
            } catch (err) {
                console.error('Failed to load routers:', err);
            } finally {
                setLoadingRouters(false);
            }
        };
        load();
    }, [searchParams]);

    // Load user profile / settings for company info
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const settings = await settingsApi.get();
                setCompanyName(settings.companyName || user?.username || 'My ISP');
                setCustomerCareNumber(settings.supportPhone || user?.phone || '');
            } catch {
                // Fallback to user profile details
                setCompanyName(user?.username || 'My ISP');
                setCustomerCareNumber(user?.phone || '');
            }
        };
        loadSettings();
    }, [user]);

    // Load packages for the selected router
    useEffect(() => {
        if (!selectedRouterId) return;
        const loadPackages = async () => {
            try {
                const pkgs = await packagesApi.list({ routerId: selectedRouterId, status: 'Active' });
                const list = Array.isArray(pkgs) ? pkgs : [];
                // Map the packages to the format expected by the preview and generated HTML
                const mapped = list.map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    price: p.price || 0,
                    duration: p.duration,
                    durationUnit: p.durationUnit,
                    validity: p.validity,
                    bandwidth: p.bandwidth
                }));
                setRouterPackages(mapped);
            } catch (err) {
                console.error('Failed to load packages:', err);
                setRouterPackages([]);
            }
        };
        loadPackages();
    }, [selectedRouterId, routers]);

    // Load existing settings for the selected router
    useEffect(() => {
        if (!selectedRouterId) return;
        const loadCustomSettings = async () => {
            try {
                const settings = await hotspotSettingsApi.get(selectedRouterId);
                if (settings) {
                    if (settings.primaryColor) setPrimaryColor(settings.primaryColor);
                    if (settings.accentColor) setAccentColor(settings.accentColor);
                    if (settings.selectedFont) setSelectedFont(settings.selectedFont);
                    if (settings.layout && ['grid', 'horizontal', 'vertical'].includes(settings.layout)) {
                        setLayout(settings.layout as 'grid' | 'horizontal' | 'vertical');
                    }
                    if (settings.enableAds !== undefined) setEnableAds(settings.enableAds);
                    if (settings.adMessage) setAdMessage(settings.adMessage);
                    if (settings.enableRememberMe !== undefined) setEnableRememberMe(settings.enableRememberMe);
                    if (settings.companyName) setCompanyName(settings.companyName);
                    if (settings.customerCareNumber) setCustomerCareNumber(settings.customerCareNumber);
                    if (settings.backendUrl) setBackendUrl(settings.backendUrl);
                }
            } catch (err) {
                console.error('Failed to load hotspot settings:', err);
            }
        };
        loadCustomSettings();
    }, [selectedRouterId]);

    const selectedRouter = routers.find(r => r.id === selectedRouterId);

    const generateHtml = () => {
        const layoutClass = layout === 'horizontal' ? 'packages-horizontal' : layout === 'vertical' ? 'packages-vertical' : 'packages-grid';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>${companyName} Hotspot</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=${selectedFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=${selectedFont.replace(/ /g, '+')}:wght@400;500;600;700&display=swap" rel="stylesheet"></noscript>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: '${selectedFont}', sans-serif;
            background: linear-gradient(175deg, ${accentColor}18 0%, #f0f4f8 40%, #ffffff 100%);
            min-height: 100vh; padding: 0;
            display: flex; align-items: center; justify-content: center;
        }
        .page { 
            width: 100%; max-width: 480px; background: #fff; 
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            position: relative; overflow: hidden;
        }
        @media (min-width: 481px) {
            .page { border-radius: 24px; min-height: auto; margin: 20px; }
            body { background: linear-gradient(135deg, ${primaryColor}22, ${accentColor}22); }
        }
        @media (max-width: 480px) {
            .page { min-height: 100vh; border-radius: 0; }
            body { align-items: flex-start; }
        }

        /* ── Header ── */
        .header {
            background: linear-gradient(135deg, ${primaryColor}, ${accentColor});
            padding: 14px 12px 12px; text-align: center; color: #fff;
            border-radius: 0 0 16px 16px;
        }
        .header-brand { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px; }
        .header-brand svg { width: 20px; height: 20px; fill: #fff; }
        .header-brand h1 { font-size: 1.1rem; font-weight: 700; letter-spacing: 0.5px; }
        .networks-title { font-size: 0.75rem; font-weight: 600; margin-bottom: 6px; opacity: 0.9; }
        .networks-row { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
        .networks-row img { height: 28px; object-fit: contain; filter: brightness(1.1); }
        .network-badge {
            background: rgba(255,255,255,0.2); border-radius: 8px; padding: 4px 10px;
            font-size: 0.72rem; font-weight: 600; color: #fff;
        }
        .steps { display: flex; justify-content: center; gap: 10px; font-size: 0.75rem; margin-bottom: 8px; }
        .steps span { opacity: 0.85; }
        .steps .dot { opacity: 0.5; }
        .support-bar {
            background: ${accentColor}40; border-radius: 16px; padding: 6px 14px;
            font-size: 0.75rem; display: inline-flex; align-items: center; gap: 6px;
        }

        /* ── Section Shared ── */
        .section { padding: 10px 12px; }
        .section-title {
            font-size: 0.85rem; font-weight: 700; color: ${primaryColor};
            margin-bottom: 8px; display: flex; align-items: center; gap: 6px;
        }
        .section-card {
            background: #f8fafb; border: 1px solid #e8ecf0; border-radius: 10px;
            padding: 10px; margin-bottom: 8px;
        }

        /* ── Packages Grid ── */
        .packages-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .packages-horizontal { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; }
        .packages-horizontal .pkg-card { min-width: 140px; flex-shrink: 0; }
        .packages-vertical { display: flex; flex-direction: column; gap: 8px; }

        .pkg-card {
            background: linear-gradient(135deg, ${accentColor}08, ${accentColor}15);
            border: 1.5px solid ${accentColor}30; border-radius: 12px;
            padding: 12px 8px; text-align: center; cursor: pointer;
            transition: all 0.2s;
        }
        .pkg-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px ${accentColor}25; border-color: ${accentColor}; }
        .pkg-name { font-size: 0.78rem; font-weight: 700; color: ${accentColor}; margin-bottom: 4px; text-transform: uppercase; }
        .pkg-price { font-size: 1.3rem; font-weight: 700; color: ${primaryColor}; line-height: 1; }
        .pkg-price small { font-size: 0.7rem; font-weight: 500; color: #888; }
        .pkg-duration {
            font-size: 0.72rem; color: #e74c3c; margin-top: 4px;
            display: flex; align-items: center; justify-content: center; gap: 3px;
        }

        /* ── Input fields ── */
        .field-group { margin-bottom: 8px; }
        .field-group label { display: block; font-size: 0.75rem; color: #666; margin-bottom: 4px; font-weight: 500; }
        .field-input {
            width: 100%; padding: 8px 12px; border: 1.5px solid #d1d5db; border-radius: 8px;
            font-size: 0.85rem; font-family: '${selectedFont}', sans-serif;
            transition: border-color 0.2s;
        }
        .field-input:focus { outline: none; border-color: ${accentColor}; box-shadow: 0 0 0 3px ${accentColor}15; }

        /* ── Buttons ── */
        .btn-primary {
            width: 100%; padding: 10px; background: ${accentColor}; color: #fff;
            border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 700;
            cursor: pointer; font-family: '${selectedFont}', sans-serif;
            display: flex; align-items: center; justify-content: center; gap: 4px;
            transition: all 0.2s;
        }
        .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-accent {
            width: 100%; padding: 10px; background: linear-gradient(135deg, #e53935, #c62828);
            color: #fff; border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 700;
            cursor: pointer; font-family: '${selectedFont}', sans-serif;
            display: flex; align-items: center; justify-content: center; gap: 4px;
        }
        .btn-connect {
            padding: 8px 16px; background: ${accentColor}; color: #fff;
            border: none; border-radius: 8px; font-size: 0.8rem; font-weight: 700;
            cursor: pointer; white-space: nowrap;
        }
        .login-row { display: flex; gap: 8px; align-items: center; }
        .login-row .field-input { flex: 1; margin-bottom: 0; }

        /* ── Remember me / MAC ── */
        .remember-row {
            margin-top: 8px; display: flex; align-items: center; gap: 6px;
            font-size: 0.78rem; color: #777;
        }
        .remember-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: ${accentColor}; }
        .mac-bar {
            background: ${accentColor}10; border: 1px solid ${accentColor}25;
            border-radius: 8px; padding: 8px 14px; margin-top: 10px;
            font-size: 0.78rem; color: ${primaryColor}; display: flex; align-items: center; gap: 6px;
        }

        /* ── Footer ── */
        .footer {
            text-align: center; padding: 16px; font-size: 0.72rem; color: #bbb;
            border-top: 1px solid #f0f0f0; margin-top: 8px;
        }

        /* ── Ads ── */
        ${enableAds ? `.ad-banner {
            background: linear-gradient(90deg, ${accentColor}10, ${primaryColor}10);
            padding: 10px 16px; text-align: center; font-size: 0.82rem; color: ${primaryColor};
            font-weight: 500; animation: slideAd 6s infinite;
        }
        @keyframes slideAd { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }` : ''}

        .pkg-loading { text-align: center; padding: 20px; color: #888; font-size: 0.85rem; }
        @media (max-width: 380px) {
            .packages-grid { grid-template-columns: repeat(2, 1fr); }
        }

        /* ── Payment Overlay ── */
        .payment-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
            display: none; align-items: center; justify-content: center; z-index: 2000; padding: 20px;
        }
        .payment-box {
            background: #fff; border-radius: 20px; width: 100%; max-width: 360px;
            overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
            animation: modalUp 0.3s ease-out;
        }
        @keyframes modalUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .payment-header {
            background: linear-gradient(135deg, ${primaryColor}, ${accentColor});
            padding: 20px; color: #fff; text-align: center;
        }
        .payment-body { padding: 24px; }
        .status-badge {
            display: inline-block; padding: 4px 12px; border-radius: 20px;
            font-size: 0.72rem; font-weight: 700; margin-bottom: 12px;
            background: #f1f5f9; color: #64748b;
        }
        .status-loading { color: ${accentColor}; background: ${accentColor}15; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    </style>
</head>
<body>

    <!-- Payment Modal -->
    <div class="payment-overlay" id="paymentOverlay">
        <div class="payment-box">
            <div class="payment-header">
                <div style="font-size: 0.8rem; opacity: 0.9; margin-bottom: 4px;">Confirm Purchase</div>
                <div id="selectedPkgName" style="font-size: 1.1rem; font-weight: 700;">Package Name</div>
                <div id="selectedPkgPrice" style="font-size: 1.2rem; font-weight: 700; margin-top: 4px;">TSH 0</div>
            </div>
            <div class="payment-body" id="paymentInitial">
                <div class="field-group">
                    <label>Enter Mobile Money Number</label>
                    <input type="tel" class="field-input" id="phoneInput" placeholder="0XXXXXXXXX" maxlength="10" />
                    <div style="font-size: 0.68rem; color: #888; margin-top: 6px; line-height: 1.4;">
                        Ensure your phone is ON and unlocked to receive the PIN prompt.
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn-primary" style="flex: 2;" onclick="initiatePurchase()" id="btnPay">Pay Now</button>
                    <button class="btn-primary" style="flex: 1; background: #94a3b8;" onclick="closePayment()">Cancel</button>
                </div>
            </div>
            <div class="payment-body" id="paymentWait" style="display: none; text-align: center; padding: 40px 24px;">
                <div class="status-badge status-loading" id="pollStatus">Waiting for payment...</div>
                <div style="font-size: 0.85rem; color: #475569; margin-bottom: 20px;" id="pollMessage">
                    Please check your phone for the payment prompt and enter your PIN.
                </div>
                <div style="width: 40px; height: 40px; border: 3px solid ${accentColor}20; border-top-color: ${accentColor}; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto;"></div>
                <button class="btn-primary" style="margin-top: 30px; background: #94a3b8;" onclick="closePayment()">Close</button>
            </div>
        </div>
    </div>

    <style> @keyframes spin { to { transform: rotate(360deg); } } </style>

    <div class="page">
        <!-- Header -->
        <div class="header">
            <div class="header-brand">
                <svg viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
                <h1>${companyName}</h1>
            </div>
            <div class="networks-title">Supported Mobile Networks</div>
            <div class="networks-row">
                <span class="network-badge">M-Pesa</span>
                <span class="network-badge">Airtel Money</span>
                <span class="network-badge">T-Pesa</span>
                <span class="network-badge">HaloPesa</span>
            </div>
            <div class="steps">
                <span>📦 Select</span> <span class="dot">•</span>
                <span>💳 Pay</span> <span class="dot">•</span>
                <span>🌐 Connect</span>
            </div>
            <div class="support-bar">📞 Support: ${customerCareNumber}</div>
        </div>

        ${enableAds ? `<div class="ad-banner">${adMessage || '🎉 Special offer! Get extra data on all packages today!'}</div>` : ''}

        <!-- Packages -->
        <div class="section">
            <div class="section-title">📦 Packages</div>
            <div id="packagesContainer" class="${layoutClass}">
                <div class="pkg-loading">⏳ Loading packages...</div>
            </div>
        </div>

        <!-- Redeem Voucher -->
        <div class="section">
            <div class="section-title">🎟️ Redeem Voucher</div>
            <div class="section-card">
                <form name="voucher_form" action="$(link-login-only)" method="post" onsubmit="return doVoucher();">
                    <input type="hidden" name="dst" value="$(link-orig)" />
                    <div class="login-row">
                        <input type="text" class="field-input" name="username" id="voucher-code" placeholder="Voucher code" />
                        <button type="submit" class="btn-connect" style="background: #e53935;">Redeem</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Reconnect -->
        <div class="section">
            <div class="section-title">🔄 Reconnect</div>
            <div class="section-card">
                <label style="font-size: 0.78rem; color: #666; margin-bottom: 6px; display: block;">Enter Transaction reference</label>
                <div class="login-row">
                    <input type="text" class="field-input" id="zenopay-ref" placeholder="Transaction reference (HP...)" />
                </div>
                <button class="btn-accent" style="margin-top: 10px;" onclick="doReconnect()">
                    💳 Reconnect
                </button>
            </div>
        </div>

        <!-- Manual Login -->
        <div class="section">
            <div class="section-title">📶 Manual Login</div>
            <div class="section-card">
                $(if error)
                <div style="background: #fee2e2; color: #ef4444; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 0.85rem; text-align: center; border: 1px solid #fca5a5;">
                    $(error)
                </div>
                $(endif)
                <form name="login" action="$(link-login-only)" method="post" onsubmit="return doLogin()">
                    <input type="hidden" name="dst" value="$(link-orig)" />
                    <input type="hidden" name="popup" value="true" />
                    <div class="login-row">
                        <input type="text" class="field-input" name="username" value="$(username)" placeholder="Username" />
                        <input type="password" class="field-input" name="password" placeholder="••••" />
                        <button type="submit" class="btn-connect">Connect</button>
                    </div>
                </form>
                ${enableRememberMe ? `<div class="remember-row">
                    <input type="checkbox" id="remember" />
                    <label for="remember">Remember me (Auto-reconnect while subscribed)</label>
                </div>` : ''}
                <div class="mac-bar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${primaryColor}"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>
                    MAC: <strong>$(mac)</strong>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            Powered by ${companyName} • ${selectedRouter?.name || 'Router'}
        </div>
    </div>

    <script src="md5.js"></script>
    <script>
        // ── Configuration ──
        var API_BASE = '${backendUrl || CLEAN_API_URL || window.location.origin}';
        var ROUTER_ID = '${selectedRouterId}';
        var ACCENT = '${accentColor}';
        var PRIMARY = '${primaryColor}';
        var currentPkg = null;
        var pollInterval = null;

        // ── Fallback packages (baked at generation time) ──
        var fallbackPackages = ${JSON.stringify(
            routerPackages.length > 0
                ? routerPackages.map(p => ({
                    id: p.id, name: p.name, price: p.price || 0,
                    validity: p.validity || '',
                }))
                : [
                    { id: 'p1', name: 'MASAA 6', price: 450, validity: '6 Hours' },
                    { id: 'p2', name: 'MASAA 24', price: 950, validity: '24 Hours' },
                    { id: 'p3', name: 'SIKU 3', price: 2450, validity: '3 Days' },
                    { id: 'p4', name: 'SIKU 7', price: 5000, validity: '7 Days' },
                ]
        )};

        function renderPackages(packages) {
            var c = document.getElementById('packagesContainer');
            if (!packages || packages.length === 0) { c.innerHTML = '<div class="pkg-loading">No packages available</div>'; return; }
            c.innerHTML = packages.map(function(p) {
                return '<div class="pkg-card" onclick=\\'showPayment(' + JSON.stringify(p).replace(/"/g, "&quot;").replace(/'/g, "&#39;") + ')\\'>' +
                    '<div class="pkg-name">' + p.name + '</div>' +
                    '<div class="pkg-price"><small>TSH</small> ' + Number(p.price).toLocaleString() + '</div>' +
                    '<div class="pkg-duration" style="margin-bottom:6px">⏱ ' + (p.validity||'') + '</div>' +
                    '<button style="width:100%; border:none; padding:6px; background:' + ACCENT + '; color:#fff; border-radius:6px; font-weight:700; font-size:0.75rem; cursor:pointer;">Buy</button>' +
                '</div>';
            }).join('');
        }

        function showPayment(pkg) {
            currentPkg = pkg;
            document.getElementById('selectedPkgName').innerText = pkg.name;
            document.getElementById('selectedPkgPrice').innerText = 'TSH ' + Number(pkg.price).toLocaleString();
            document.getElementById('paymentInitial').style.display = 'block';
            document.getElementById('paymentWait').style.display = 'none';
            document.getElementById('paymentOverlay').style.display = 'flex';
        }

        function closePayment() {
            document.getElementById('paymentOverlay').style.display = 'none';
            if (pollInterval) clearInterval(pollInterval);
        }

        function initiatePurchase() {
            var phone = document.getElementById('phoneInput').value;
            if (!phone || phone.length < 10) { alert('Please enter a valid phone number'); return; }
            
            var btn = document.getElementById('btnPay');
            btn.disabled = true;
            btn.innerText = 'Processing...';

            fetch(API_BASE + '/api/hotspot/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    packageId: currentPkg.id,
                    phone: phone,
                    macAddress: '$(mac)',
                    routerId: ROUTER_ID
                })
            })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (d.error) { throw new Error(d.error); }
                document.getElementById('paymentInitial').style.display = 'none';
                document.getElementById('paymentWait').style.display = 'block';
                startPolling(d.reference);
            })
            .catch(function(err) {
                alert(err.message || 'Failed to initiate purchase');
                btn.disabled = false;
                btn.innerText = 'Pay Now';
            });
        }

        function startPolling(ref) {
            if (pollInterval) clearInterval(pollInterval);
            pollInterval = setInterval(function() {
                fetch(API_BASE + '/api/hotspot/status?reference=' + ref)
                .then(function(r) { return r.json(); })
                .then(function(d) {
                    if (d.status === 'COMPLETED') {
                        clearInterval(pollInterval);
                        document.getElementById('pollStatus').innerText = 'PAID! Connecting...';
                        document.getElementById('pollStatus').style.background = '#22c55e';
                        document.getElementById('pollStatus').style.color = '#fff';
                        document.getElementById('pollMessage').innerText = 'Your payment was successful. Getting you online now!';
                        
                        // Auto connect
                        setTimeout(function() {
                            connectUser(d.username, d.password);
                        }, 2000);
                    } else if (d.status === 'FAILED') {
                        clearInterval(pollInterval);
                        alert('Payment failed or cancelled. Please try again.');
                        closePayment();
                    }
                });
            }, 3000);
        }

        function connectUser(user, pass) {
            var f = document.forms['login'];
            f.username.value = user;
            f.password.value = pass;
            doLogin();
        }

        function doLogin() {
            var f = document.forms['login'];
            if (typeof hexMD5 !== 'undefined' && '$(chap-id)' !== '') {
                var newpass = hexMD5('$(chap-id)' + f.password.value + '$(chap-challenge)');
                // We must send the hashed password instead
                var sendForm = document.createElement('form');
                sendForm.method = 'post';
                sendForm.action = '$(link-login-only)';
                sendForm.innerHTML = '<input type="hidden" name="username" value="' + f.username.value + '" />' +
                                     '<input type="hidden" name="password" value="' + newpass + '" />' +
                                     '<input type="hidden" name="dst" value="' + f.dst.value + '" />';
                document.body.appendChild(sendForm);
                sendForm.submit();
                return false;
            }
            f.submit();
            return false;
        }

        function doVoucher() {
            var code = document.getElementById('voucher-code').value;
            if (!code) { alert('Please enter a voucher code'); return false; }
            
            var btn = document.forms['voucher_form'].querySelector('button');
            btn.disabled = true;
            btn.innerText = 'Checking...';

            fetch(API_BASE + '/api/hotspot/voucher/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code,
                    macAddress: '$(mac)',
                    routerId: ROUTER_ID
                })
            })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                if (d.error) { throw new Error(d.error); }
                alert('Voucher valid! Connecting...');
                connectUser(d.username, d.password || '');
            })
            .catch(function(err) {
                alert(err.message || 'Failed to redeem voucher');
                btn.disabled = false;
                btn.innerText = 'Redeem';
            });

            return false; // Prevent form submit
        }

        function doReconnect() {
            var ref = document.getElementById('zenopay-ref').value;
            if (!ref) { alert('Please enter your reference'); return; }
            
            var btn = document.querySelector('button[onclick="doReconnect()"]');
            btn.disabled = true;
            btn.innerText = 'Checking status...';

            startPolling(ref);
            
            // Re-enable after 10s if nothing happens
            setTimeout(function() { 
                btn.disabled = false; 
                btn.innerText = 'Reconnect'; 
            }, 10000);
        }

        // Load packages and check for active subscription
        (function() {
            renderPackages(fallbackPackages);
            if (!ROUTER_ID) return;

            // 1. Fetch live packages
            fetch(API_BASE + '/api/packages?routerId=' + ROUTER_ID + '&status=ACTIVE')
                .then(function(r) { return r.json(); })
                .then(function(d) { 
                    var pkgs = Array.isArray(d) ? d : (d.data || []);
                    if (pkgs.length > 0) renderPackages(pkgs); 
                })
                .catch(function() { console.log('Using baked-in packages'); });

            // 2. Check for active subscription (Auto-reconnect)
            var currentMac = '$(mac)';
            if (currentMac && currentMac !== '' && currentMac.indexOf('$') === -1) {
                fetch(API_BASE + '/api/hotspot/check-mac?mac=' + encodeURIComponent(currentMac))
                    .then(function(r) { return r.json(); })
                    .then(function(d) {
                        if (d.active) {
                            console.log('Active subscription found for MAC. Connecting...');
                            connectUser(d.username, d.password);
                        }
                    })
                    .catch(function(e) { console.log('MAC check failed', e); });
            }
        })();
    </script>
</body>
</html>`;
    };

    const handleSaveSettings = async () => {
        if (!selectedRouterId) {
            setSaveError('Please select a router first.');
            return;
        }
        setSaving(true);
        setSaveSuccess(false);
        setSaveError(null);
        try {
            await hotspotSettingsApi.update({
                routerId: selectedRouterId,
                primaryColor,
                accentColor,
                selectedFont,
                layout,
                enableAds,
                adMessage,
                enableRememberMe,
                companyName,
                customerCareNumber,
                backendUrl
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            console.error('Failed to save settings:', err);
            setSaveError(err.message || 'Failed to save settings. Please try again.');
            setTimeout(() => setSaveError(null), 5000);
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadZip = async () => {
        if (!selectedRouterId) {
            alert('Please select a router first.');
            return;
        }
        
        try {
            // Fetch the base template files from backend
            const cleanUrl = backendUrl ? (backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl) : '';
            const backendApi = cleanUrl ? (cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`) : '/api';
            const res = await fetch(`${backendApi}/hotspot/download?routerId=${selectedRouterId}`);
            if (!res.ok) throw new Error('Failed to fetch hotspot files from backend');
            
            const data = await res.json();
            const zip = new JSZip();
            
            // Debugging alert to help user
            alert(`Debug Info:\nAPI: ${backendApi}\nFound Files: ${data.files ? data.files.length : 0}\nStatus: ${res.status}`);

            // Add all base files to JSZip (md5.js, assets/css, images, etc.)
            if (data.files && Array.isArray(data.files)) {
                for (const file of data.files) {
                    if (file.encoding === 'base64') {
                        zip.file(file.path, file.content, { base64: true });
                    } else {
                        zip.file(file.path, file.content);
                    }
                }
            }

            // Override specific files with customized ones
            zip.file("favicon.ico", "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIElEQVQ4T2NkYGD4z8DAwMgAQUZUg9gwGkRDCXgEaQAAa/EIA1x7s7EAAAAASUVORK5CYII=", { base64: true });
            zip.file("login.html", generateHtml());
            zip.file("alogin.html", `<html><body><script>window.location='login.html';</script></body></html>`);
            zip.file("redirect.html", `<html><body><script>window.location='login.html';</script></body></html>`);
            zip.file("status.html", `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Status</title><style>body{font-family:sans-serif;background:#f3f4f6;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;} .card{background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);text-align:center;width:90%;max-width:350px;} h2{color:#1a1a2e;margin-top:0;} p{color:#666;font-size:0.9rem;} .btn{display:inline-block;background:#ef4444;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;margin-top:20px;font-weight:bold;}</style></head><body><div class="card"><h2>You are connected!</h2><p><strong>Username:</strong> $(username)</p><p><strong>IP:</strong> $(ip)</p>$(if session-time-left)<p><strong>Time left:</strong> $(session-time-left)</p>$(endif)<a href="$(link-logout)" class="btn">Log Out</a></div></body></html>`);
            zip.file("logout.html", `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Logged Out</title><style>body{font-family:sans-serif;background:#f3f4f6;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;} .card{background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);text-align:center;width:90%;max-width:350px;} h2{color:#1a1a2e;margin-top:0;} p{color:#666;font-size:0.9rem;} .btn{display:inline-block;background:#6366f1;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;margin-top:20px;font-weight:bold;}</style></head><body><div class="card"><h2>Logged Out</h2><p>You have successfully logged out.</p><p><strong>Session time:</strong> $(uptime)</p><a href="$(link-login)" class="btn">Log In Again</a></div></body></html>`);
            zip.file("api.json", `{
   "captive": $(if logged-in == 'yes')false$(else)true$(endif),
   "user-portal-url": "$(link-login-only)",
$(if session-timeout-secs != 0)
   "seconds-remaining": $(session-timeout-secs),
$(endif)
$(if remain-bytes-total)
   "bytes-remaining": $(remain-bytes-total),
$(endif)
   "can-extend-session": true
}`);
        zip.file("errors.txt", `# ERRORS
# This file contains error messages which are shown to user, when http/https
# login is used.
# These messages can be changed to make user interface more friendly, including
# translations to different languages.
#
# Various variables can be used here as well. Most frequently used ones are:
#	$(error-orig)	- original error message from hotspot
#	$(ip)		- ip address of a client
#	$(username)	- username of client trying to log in

# internal-error
# It should never happen. If it will, error page will be shown
# displaying this error message (error-orig will describe what has happened)

internal-error = internal error ($(error-orig))

# config-error
# Should never happen if hotspot is configured properly.

config-error = configuration error ($(error-orig))

# not-logged-in
# Will happen, if status or logout page is requested by user,
# which actually is not logged in

not-logged-in = you are not logged in (ip $(ip))

# ippool-empty
# IP address for user is to be assigned from ip pool, but there are no more
# addresses in that pool

ippool-empty = cannot assign ip address - no more free addresses from pool

# shutting-down
# When shutdown is executed, new clients are not accepted

shutting-down = hotspot service is shutting down

# user-session-limit
# If user profile has limit of shared-users, then this error will be shown
# after reaching this limit

user-session-limit = no more sessions are allowed for user $(username)

# license-session-limit
# Depending on licence number of active hotspot clients is limited to
# one or another amount. If this limit is reached, following error is displayed.

license-session-limit = session limit reached ($(error-orig))

# wrong-mac-username
# If username looks like MAC address (12:34:56:78:9a:bc), but is not
# a MAC address of this client, login is rejected

wrong-mac-username = invalid username ($(username)): this MAC address is not yours

# chap-missing
# If http-chap login method is used, but hotspot program does not receive
# back encrypted password, this error message is shown.
# Possible reasons of failure:
#	- JavaScript is not enabled in web browser;
#	- login.html page is not valid;
#	- challenge value has expired on server (more than 1h of inactivity);
#	- http-chap login method is recently removed;
# If JavaScript is enabled and login.html page is valid,
# then retrying to login usually fixes this problem.

chap-missing = web browser did not send challenge response (try again, enable JavaScript)

# invalid-username
# Most general case of invalid username or password. If RADIUS server
# has sent an error string with Access-Reject message, then it will
# override this setting.

invalid-username = invalid username or password

# invalid-mac
# Local users (on hotspot server) can be bound to some MAC address. If login
# from different MAC is tried, this error message will be shown.

invalid-mac = user $(username) is not allowed to log in from this MAC address

# uptime-limit, traffic-limit
# For local hotspot users in case if limits are reached

uptime-limit = user $(username) has reached uptime limit
traffic-limit = user $(username) has reached traffic limit

# radius-timeout
# User is authenticated by RADIUS server, but no response is received from it,
# following error will be shown.

radius-timeout = RADIUS server is not responding

# auth-in-progress
# Authorization in progress. Client already has issued an authorization request
# which is not yet complete.

auth-in-progress = already authorizing, retry later

# radius-reply
# Radius server returned some custom error message

radius-reply = $(error-orig)`);
        zip.file("WISPAaccessGatewaParam.xsd", `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified" attributeFormDefault="unqualified">
	<xs:element name="WISPAccessGatewayParam">
		<xs:complexType>
			<xs:choice>
				<xs:element name="Redirect" type="RedirectType"/>
				<xs:element name="Proxy" type="ProxyType"/>
				<xs:element name="AuthenticationReply" type="AuthenticationReplyType"/>
				<xs:element name="AuthenticationPollReply" type="AuthenticationPollReplyType"/>
				<xs:element name="LogoffReply" type="LogoffReplyType"/>
				<xs:element name="AbortLoginReply" type="AbortLoginReplyType"/>
			</xs:choice>
		</xs:complexType>
	</xs:element>
	<xs:simpleType name="AbortLoginURLType">
		<xs:restriction base="xs:anyURI"/>
	</xs:simpleType>
	<xs:simpleType name="NextURLType">
		<xs:restriction base="xs:anyURI"/>
	</xs:simpleType>
	<xs:simpleType name="AccessProcedureType">
		<xs:restriction base="xs:string"/>
	</xs:simpleType>
	<xs:simpleType name="AccessLocationType">
		<xs:restriction base="xs:string"/>
	</xs:simpleType>
	<xs:simpleType name="LocationNameType">
		<xs:restriction base="xs:string"/>
	</xs:simpleType>
	<xs:simpleType name="LoginURLType">
		<xs:restriction base="xs:anyURI"/>
	</xs:simpleType>
	<xs:simpleType name="MessageTypeType">
		<xs:restriction base="xs:integer"/>
	</xs:simpleType>
	<xs:simpleType name="ResponseCodeType">
		<xs:restriction base="xs:integer"/>
	</xs:simpleType>
	<xs:simpleType name="ReplyMessageType">
		<xs:restriction base="xs:string"/>
	</xs:simpleType>
	<xs:simpleType name="LoginResultsURLType">
		<xs:restriction base="xs:anyURI"/>
	</xs:simpleType>
	<xs:simpleType name="LogoffURLType">
		<xs:restriction base="xs:anyURI"/>
	</xs:simpleType>
	<xs:simpleType name="DelayType">
		<xs:restriction base="xs:integer"/>
	</xs:simpleType>
	<xs:complexType name="RedirectType">
		<xs:all>
			<xs:element name="AccessProcedure" type="AccessProcedureType"/>
			<xs:element name="AccessLocation" type="AccessLocationType"/>
			<xs:element name="LocationName" type="LocationNameType"/>
			<xs:element name="LoginURL" type="LoginURLType"/>
			<xs:element name="AbortLoginURL" type="AbortLoginURLType"/>
			<xs:element name="MessageType" type="MessageTypeType"/>
			<xs:element name="ResponseCode" type="ResponseCodeType"/>
		</xs:all>
	</xs:complexType>
	<xs:complexType name="ProxyType">
		<xs:all>
			<xs:element name="MessageType" type="MessageTypeType"/>
			<xs:element name="ResponseCode" type="ResponseCodeType"/>
			<xs:element name="NextURL" type="NextURLType" minOccurs="0" maxOccurs="1"/>
			<xs:element name="Delay" type="DelayType" minOccurs="0" maxOccurs="1"/>
		</xs:all>
	</xs:complexType>
	<xs:complexType name="AuthenticationReplyType">
		<xs:all>
			<xs:element name="MessageType" type="MessageTypeType"/>
			<xs:element name="ResponseCode" type="ResponseCodeType"/>
			<xs:element name="ReplyMessage" type="ReplyMessageType" minOccurs="0" maxOccurs="1"/>
			<xs:element name="LoginResultsURL" type="LoginResultsURLType" minOccurs="0" maxOccurs="1"/>
			<xs:element name="LogoffURL" type="LogoffURLType" minOccurs="0" maxOccurs="1"/>
		</xs:all>
	</xs:complexType>
	<xs:complexType name="AuthenticationPollReplyType">
		<xs:all>
			<xs:element name="MessageType" type="MessageTypeType"/>
			<xs:element name="ResponseCode" type="ResponseCodeType"/>
			<xs:element name="ReplyMessage" type="ReplyMessageType" minOccurs="0" maxOccurs="1"/>
			<xs:element name="Delay" type="DelayType" minOccurs="0" maxOccurs="1"/>
			<xs:element name="LogoffURL" type="LogoffURLType" minOccurs="0" maxOccurs="1"/>
		</xs:all>
	</xs:complexType>
	<xs:complexType name="LogoffReplyType">
		<xs:sequence>
			<xs:element name="MessageType" type="MessageTypeType"/>
			<xs:element name="ResponseCode" type="ResponseCodeType"/>
		</xs:sequence>
	</xs:complexType>
	<xs:complexType name="AbortLoginReplyType">
		<xs:sequence>
			<xs:element name="MessageType" type="MessageTypeType"/>
			<xs:element name="ResponseCode" type="ResponseCodeType"/>
			<xs:element name="LogoffURL" type="LogoffURLType" minOccurs="0" maxOccurs="1"/>
		</xs:sequence>
	</xs:complexType>
</xs:schema>`);
        zip.file("README.txt", `HQINVESTMENT HOTSPOT LOGIN PAGE
========================

Generated on: ${new Date().toLocaleString()}
Company: ${companyName}
Router: ${selectedRouter?.name || 'N/A'} (${selectedRouter?.host || ''})

FILES INCLUDED:
- login.html (Main hotspot login page)
- alogin.html (Status page after login)
- redirect.html (Automatic redirect)
- api.json (Connection status for external apps)
- errors.txt (Custom error messages)
- WISPAaccessGatewaParam.xsd (WISPr support for mobile devices)

DEPLOYMENT INSTRUCTIONS:
1. Upload the contents of this hotspot folder to your router's hotspot directory
2. Ensure the login.html file is accessible via your router's web interface
3. Test the page functionality before going live
4. Make sure all file permissions are set correctly on your router

MIKROTIK ROUTER SETUP:
1. Access your router via Winbox or WebFig
2. Go to Files and upload the contents to the hotspot folder
3. In IP > Hotspot > Server Profiles, set the login page to 'login.html'
4. Test the hotspot functionality

TROUBLESHOOTING:
- Ensure your router has internet connectivity for external resources
- IMPORTANT: You MUST allow Walled Garden access to your billing host/IP otherwise payments will fail!
- Check that the M-Pesa integration endpoints are accessible
- Verify that JavaScript is enabled on client devices`);
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `hotspot-${(selectedRouter?.name || 'template').replace(/\s+/g, '-').toLowerCase()}.zip`);
        
        } catch (err: any) {
            console.error("Download zip error:", err);
            alert("Error downloading hotspot files: " + err.message);
        }
    };

    const handlePreview = () => {
        const htmlContent = generateHtml();
        const previewWindow = window.open('', '_blank', 'width=420,height=700');
        if (previewWindow) {
            previewWindow.document.write(htmlContent);
            previewWindow.document.close();
        }
    };

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
                    <div>Company: <strong style={{ color: 'var(--text-primary)' }}>{companyName}</strong></div>
                    <div>User: <strong style={{ color: 'var(--text-primary)' }}>{user?.username || 'Admin'}</strong></div>
                    <div>Role: <strong style={{ color: 'var(--text-primary)' }}>{user?.role || 'User'}</strong></div>
                </div>
            </div>

            {/* Router Selector */}
            <div className="card" style={{ padding: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <RouterIcon style={{ color: '#d97706', fontSize: 22 }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Select Router:</span>
                    {loadingRouters ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading routers...</span>
                    ) : routers.length === 0 ? (
                        <span style={{ fontSize: '0.85rem', color: '#dc2626' }}>No routers found. Add a router first in the Mikrotiks page.</span>
                    ) : (
                        <select
                            className="select-field"
                            style={{ minWidth: 280, fontWeight: 500 }}
                            value={selectedRouterId}
                            onChange={e => setSelectedRouterId(e.target.value)}
                        >
                            {routers.map(r => (
                                <option key={r.id} value={r.id}>
                                    {r.name} — {r.host} ({r.status})
                                </option>
                            ))}
                        </select>
                    )}
                    {selectedRouter && (
                        <span style={{
                            padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                            background: selectedRouter.status === 'Online' ? '#d1fae5' : '#fee2e2',
                            color: selectedRouter.status === 'Online' ? '#065f46' : '#dc2626',
                        }}>
                            {selectedRouter.status === 'Online' ? '● Online' : '○ Offline'}
                        </span>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <InfoOutlinedIcon style={{ fontSize: 14 }} />
                        Each router gets its own customized login page
                    </div>
                </div>
                {routerPackages.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        📦 <strong>{routerPackages.length}</strong> packages found for this router — they will appear on the login page
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: showPreview ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', gap: 24 }}>
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
                            <div className="grid-2 gap-16">
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
                            <div className="grid-3 gap-10">
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
                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: enableAds ? 12 : 0 }}>
                                <input type="checkbox" checked={enableAds} onChange={e => setEnableAds(e.target.checked)} style={{ width: 16, height: 16, marginTop: 2 }} />
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>Enable Advertisement Banner</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Display an advertisement banner at the top of the login page.</div>
                                </div>
                            </label>
                            {enableAds && (
                                <div style={{ marginLeft: 24, padding: '10px 14px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                    <label style={{ display: 'block', fontSize: '0.78rem', color: '#475569', marginBottom: 6, fontWeight: 600 }}>Advertisement Text</label>
                                    <input
                                        type="text"
                                        value={adMessage}
                                        onChange={e => setAdMessage(e.target.value)}
                                        placeholder="Type your advertisement completely..."
                                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.85rem' }}
                                    />
                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 6 }}>You can use emojis like 🎉, ⚡ locally!</div>
                                </div>
                            )}
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
                                <BusinessIcon style={{ fontSize: 16 }} /> Company & System Information
                            </h4>
                            <div className="grid-2 gap-12" style={{ marginBottom: 12 }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '0.82rem' }}>Company Name</label>
                                    <input type="text" className="form-input" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '0.82rem' }}>Customer Care Number</label>
                                    <input type="text" className="form-input" value={customerCareNumber} onChange={e => setCustomerCareNumber(e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.82rem' }}>Backend API URL Override</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    value={backendUrl} 
                                    onChange={e => setBackendUrl(e.target.value)} 
                                    placeholder="https://your-backend.railway.app"
                                />
                                <div className="form-hint" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                                    The public URL of this billing system backend. Used for payments and voucher redemption.
                                </div>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 24 }}>
                            <button className="btn" onClick={handleSaveSettings} disabled={saving} style={{ background: saving ? '#818cf8' : '#4f46e5', color: '#fff', fontWeight: 600, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                {saving ? '⏳ Saving...' : '💾 Save Customization'}
                            </button>
                            <button className="btn" onClick={handlePreview} style={{ background: '#2563eb', color: '#fff', fontWeight: 600, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <PreviewIcon fontSize="small" /> Preview Changes
                            </button>
                            <button className="btn" onClick={handleDownloadZip} style={{ background: '#16a34a', color: '#fff', fontWeight: 600, padding: '10px 20px', gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                <DownloadIcon fontSize="small" /> Download ZIP File
                            </button>
                        </div>
                        {/* Save feedback */}
                        {saveSuccess && (
                            <div style={{ marginTop: 10, padding: '10px 14px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, color: '#15803d', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                ✅ Settings saved successfully!
                            </div>
                        )}
                        {saveError && (
                            <div style={{ marginTop: 10, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                ❌ {saveError}
                            </div>
                        )}

                    </div>
                </div>

                {/* Right: Live Preview */}
                {showPreview && (
                    <div>
                        <div className="card" style={{ position: 'sticky', top: 20 }}>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <PreviewIcon style={{ fontSize: 16, color: 'var(--info)' }} /> Live Preview
                                </h3>
                                <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                                    onClick={() => setShowPreview(false)}
                                >
                                    Hide
                                </button>
                            </div>
                            {/* MikroTik-style Preview */}
                            <div style={{ background: '#f0f4f8', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                                {/* Header */}
                                <div style={{
                                    background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
                                    padding: '14px 12px 12px', textAlign: 'center', color: '#fff',
                                    borderRadius: '0 0 14px 14px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                                        <span style={{ fontSize: '0.9rem' }}>📶</span>
                                        <span style={{ fontWeight: 700, fontSize: '0.82rem', letterSpacing: 0.3, fontFamily: selectedFont }}>{companyName}</span>
                                    </div>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 600, opacity: 0.9, marginBottom: 6 }}>Supported Mobile Networks</div>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                                        {['M-Pesa', 'Airtel', 'T-Pesa', 'HaloPesa'].map(n => (
                                            <span key={n} style={{
                                                background: 'rgba(255,255,255,0.2)', borderRadius: 5, padding: '2px 6px',
                                                fontSize: '0.52rem', fontWeight: 600,
                                            }}>{n}</span>
                                        ))}
                                    </div>
                                    <div style={{ fontSize: '0.58rem', opacity: 0.85, marginBottom: 6 }}>
                                        📦 Select · 💳 Pay · 🌐 Connect
                                    </div>
                                    <div style={{
                                        background: `${accentColor}40`, borderRadius: 12, padding: '4px 10px',
                                        fontSize: '0.6rem', display: 'inline-flex', alignItems: 'center', gap: 4,
                                    }}>
                                        📞 Support: {customerCareNumber || '0621085215'}
                                    </div>
                                </div>

                                {enableAds && (
                                    <div style={{
                                        background: `linear-gradient(90deg, ${accentColor}10, ${primaryColor}10)`,
                                        padding: '6px 10px', textAlign: 'center', fontSize: '0.55rem',
                                        color: primaryColor, fontWeight: 600
                                    }}>
                                        {adMessage || '🎉 Special offer! Get extra data on all packages today!'}
                                    </div>
                                )}

                                <div style={{ padding: '10px 12px', fontFamily: selectedFont }}>
                                    {/* Packages */}
                                    <div style={{ fontWeight: 700, color: primaryColor, fontSize: '0.68rem', marginBottom: 6 }}>📦 Packages</div>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: layout === 'horizontal' ? 'repeat(4, 1fr)' : layout === 'vertical' ? '1fr' : 'repeat(3, 1fr)',
                                        gap: 5, marginBottom: 10,
                                    }}>
                                        {(routerPackages.length > 0 ? routerPackages.slice(0, 4) : [
                                            { name: 'MASAA 6', price: 450, duration: 6, durationUnit: 'Hrs' },
                                            { name: 'MASAA 24', price: 950, duration: 24, durationUnit: 'Hrs' },
                                            { name: 'SIKU 3', price: 2450, duration: 3, durationUnit: 'Days' },
                                            { name: 'SIKU 7', price: 5000, duration: 7, durationUnit: 'Days' },
                                        ]).map((pkg: any, i: number) => (
                                            <div key={i}
                                                onClick={() => {
                                                    setPreviewPaymentPkg(pkg);
                                                    setPreviewPaymentStep('initial');
                                                    setPreviewPhone('');
                                                }}
                                                style={{
                                                    background: `linear-gradient(135deg, ${accentColor}08, ${accentColor}15)`,
                                                    border: `1.5px solid ${accentColor}30`, borderRadius: 8,
                                                    padding: '6px 4px', textAlign: 'center', cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                }}>
                                                <div style={{ fontSize: '0.52rem', fontWeight: 700, color: accentColor, textTransform: 'uppercase' }}>{pkg.name}</div>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: primaryColor, lineHeight: 1 }}>
                                                    <span style={{ fontSize: '0.48rem', color: '#888' }}>TSH </span>{(pkg.price || 0).toLocaleString()}
                                                </div>
                                                <div style={{ fontSize: '0.48rem', color: '#e74c3c', marginTop: 2, marginBottom: 5 }}>⏱ {pkg.validity}</div>
                                                <button style={{
                                                    background: accentColor, color: '#fff', border: 'none', padding: '3px 0',
                                                    width: '100%', borderRadius: 4, fontSize: '0.48rem', fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}>Buy</button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Voucher */}
                                    <div style={{ fontWeight: 700, color: primaryColor, fontSize: '0.62rem', marginBottom: 4 }}>🎟️ Redeem Voucher</div>
                                    <div style={{ background: '#f8fafb', border: '1px solid #e8ecf0', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <input placeholder="Voucher code" readOnly style={{
                                                flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.56rem',
                                            }} />
                                            <button style={{
                                                background: '#e53935', color: '#fff', border: 'none', padding: '4px 8px',
                                                borderRadius: 5, fontSize: '0.52rem', fontWeight: 700,
                                            }}>Redeem</button>
                                        </div>
                                    </div>

                                    {/* Reconnect */}
                                    <div style={{ fontWeight: 700, color: primaryColor, fontSize: '0.62rem', marginBottom: 4 }}>🔄 Reconnect</div>
                                    <div style={{ background: '#f8fafb', border: '1px solid #e8ecf0', borderRadius: 8, padding: 8, marginBottom: 8 }}>
                                        <input placeholder="Transaction reference (HP...)" readOnly style={{
                                            width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5,
                                            fontSize: '0.56rem', marginBottom: 4,
                                        }} />
                                        <button style={{
                                            width: '100%', background: 'linear-gradient(135deg, #e53935, #c62828)', color: '#fff',
                                            border: 'none', padding: '5px', borderRadius: 5, fontSize: '0.56rem', fontWeight: 700,
                                        }}>💳 Reconnect</button>
                                    </div>

                                    {/* Manual Login */}
                                    <div style={{ fontWeight: 700, color: primaryColor, fontSize: '0.62rem', marginBottom: 4 }}>📶 Manual Login</div>
                                    <div style={{ background: '#f8fafb', border: '1px solid #e8ecf0', borderRadius: 8, padding: 8, marginBottom: 6 }}>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <input placeholder="HS-TI07956" readOnly style={{
                                                flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.56rem',
                                            }} />
                                            <input placeholder="••••" type="password" readOnly style={{
                                                flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontSize: '0.56rem',
                                            }} />
                                            <button style={{
                                                background: accentColor, color: '#fff', border: 'none', padding: '4px 10px',
                                                borderRadius: 5, fontSize: '0.52rem', fontWeight: 700, whiteSpace: 'nowrap',
                                            }}>Connect</button>
                                        </div>
                                        {enableRememberMe && (
                                            <div style={{ marginTop: 4, fontSize: '0.48rem', color: '#888', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <input type="checkbox" readOnly style={{ width: 8, height: 8 }} />
                                                Remember me (Auto-reconnect while subscribed)
                                            </div>
                                        )}
                                        <div style={{
                                            background: `${accentColor}10`, border: `1px solid ${accentColor}25`,
                                            borderRadius: 5, padding: '4px 8px', marginTop: 6,
                                            fontSize: '0.52rem', color: primaryColor, display: 'flex', alignItems: 'center', gap: 4,
                                        }}>
                                            🖥️ MAC: <strong>62:C4:BB:A5:6B:DA</strong>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'center', fontSize: '0.48rem', color: '#bbb', marginTop: 6 }}>
                                        Powered by {companyName} • {selectedRouter?.name || 'Router'}
                                    </div>
                                </div>

                                {/* Preview Payment Simulation Overlay */}
                                {previewPaymentPkg && (
                                    <div style={{
                                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 15,
                                        zIndex: 10, borderRadius: '0 0 12px 12px',
                                        fontFamily: selectedFont
                                    }}>
                                        <div style={{ background: '#fff', borderRadius: 12, width: '100%', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                                            <div style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`, padding: 12, color: '#fff', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.55rem', opacity: 0.9 }}>Confirm Purchase</div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>{previewPaymentPkg.name}</div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>TSH {previewPaymentPkg.price.toLocaleString()}</div>
                                            </div>

                                            {previewPaymentStep === 'initial' && (
                                                <div style={{ padding: 15 }}>
                                                    <div style={{ marginBottom: 10 }}>
                                                        <label style={{ display: 'block', fontSize: '0.6rem', color: '#666', marginBottom: 4 }}>Enter Mobile Number</label>
                                                        <input
                                                            type="tel"
                                                            placeholder="0XXXXXXXXX"
                                                            value={previewPhone}
                                                            onChange={e => setPreviewPhone(e.target.value)}
                                                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: '0.7rem' }}
                                                        />
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button
                                                            onClick={() => setPreviewPaymentStep('waiting')}
                                                            style={{ flex: 2, background: accentColor, color: '#fff', border: 'none', padding: '6px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
                                                        >Pay Now</button>
                                                        <button
                                                            onClick={() => setPreviewPaymentPkg(null)}
                                                            style={{ flex: 1, background: '#94a3b8', color: '#fff', border: 'none', padding: '6px', borderRadius: 6, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}
                                                        >Cancel</button>
                                                    </div>
                                                </div>
                                            )}

                                            {previewPaymentStep === 'waiting' && (
                                                <div style={{ padding: '25px 15px', textAlign: 'center' }}>
                                                    <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 15, fontSize: '0.55rem', fontWeight: 700, background: `${accentColor}15`, color: accentColor, marginBottom: 8 }}>
                                                        Waiting for payment...
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', color: '#475569', marginBottom: 12 }}>Please enter your PIN on your phone.</div>
                                                    <div className="preview-spinner" style={{ width: 20, height: 20, border: `2px solid ${accentColor}20`, borderTopColor: accentColor, borderRadius: '50%', margin: '0 auto' }}></div>
                                                    <button
                                                        onClick={() => {
                                                            setPreviewPaymentStep('success');
                                                            setTimeout(() => setPreviewPaymentPkg(null), 2500);
                                                        }}
                                                        style={{ marginTop: 15, background: 'none', border: 'none', color: accentColor, fontSize: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
                                                    >(Simulate Success)</button>
                                                </div>
                                            )}

                                            {previewPaymentStep === 'success' && (
                                                <div style={{ padding: '25px 15px', textAlign: 'center' }}>
                                                    <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 15, fontSize: '0.55rem', fontWeight: 700, background: '#22c55e', color: '#fff', marginBottom: 8 }}>
                                                        PAID!
                                                    </div>
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
                                <strong>Preview Note:</strong> This is a simplified preview. Click "Preview Changes" for the full page, or "Download ZIP" to get the complete template.
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Show Preview Toggle (when hidden) */}
            {!showPreview && (
                <button
                    className="btn"
                    style={{
                        position: 'fixed', bottom: 20, right: 20,
                        background: '#2563eb', color: '#fff', fontWeight: 600,
                        padding: '10px 20px', borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        display: 'flex', alignItems: 'center', gap: 6, zIndex: 100,
                    }}
                    onClick={() => setShowPreview(true)}
                >
                    <PreviewIcon fontSize="small" /> Show Preview
                </button>
            )}
        </div>
    );
}
