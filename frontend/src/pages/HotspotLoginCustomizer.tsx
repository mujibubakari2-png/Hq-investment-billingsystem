/**
 * HotspotLoginCustomizer â€” FE-001 refactor
 *
 * Before: 1,597 lines (92 KB) â€” all state, HTML generation, and JSX in one file
 * After:  ~730 lines â€” orchestrator that owns state + generateHtml();
 *         view split into:
 *           CustomizerPanel.tsx    â€” settings controls (Colors/Font/Layout/Ads/UX/Company)
 *           HotspotLivePreview.tsx â€” phone mockup with payment simulation
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import WifiIcon from '@mui/icons-material/Wifi';
import RouterIcon from '@mui/icons-material/Router';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PreviewIcon from '@mui/icons-material/Preview';
import { routersApi, settingsApi, packagesApi, hotspotSettingsApi, CLEAN_API_URL } from '../api';
import authStore from '../stores/authStore';
import type { Router } from '../types';
import { CustomizerPanel } from '../components/hotspot/CustomizerPanel';
import { HotspotLivePreview } from '../components/hotspot/HotspotLivePreview';

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
    const [adMessage, setAdMessage] = useState('ðŸŽ‰ Special offer! Get extra data on all packages today!');
    const [enableRememberMe, setEnableRememberMe] = useState(true);
    const [companyName, setCompanyName] = useState('');
    const [customerCareNumber, setCustomerCareNumber] = useState('');
    const [backendUrl, setBackendUrl] = useState(CLEAN_API_URL || '');
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<{ status: 'success' | 'error', message: string } | null>(null);

    // Live preview
    const [showPreview, setShowPreview] = useState(true);

    // Load routers
    useEffect(() => {
        const load = async () => {
            setLoadingRouters(true);
            try {
                const data = await routersApi.list();
                const routers = data as unknown as Router[];
                setRouters(routers);
                // Auto-select router from URL param or first router
                const routerIdParam = searchParams.get('routerId');
                if (routerIdParam && routers.some(r => r.id === routerIdParam)) {
                    setSelectedRouterId(routerIdParam);
                } else if (routers.length > 0) {
                    setSelectedRouterId(routers[0].id);
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

        /* â”€â”€ Header â”€â”€ */
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

        /* â”€â”€ Section Shared â”€â”€ */
        .section { padding: 10px 12px; }
        .section-title {
            font-size: 0.85rem; font-weight: 700; color: ${primaryColor};
            margin-bottom: 8px; display: flex; align-items: center; gap: 6px;
        }
        .section-card {
            background: #f8fafb; border: 1px solid #e8ecf0; border-radius: 10px;
            padding: 10px; margin-bottom: 8px;
        }

        /* â”€â”€ Packages Grid â”€â”€ */
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

        /* â”€â”€ Input fields â”€â”€ */
        .field-group { margin-bottom: 8px; }
        .field-group label { display: block; font-size: 0.75rem; color: #666; margin-bottom: 4px; font-weight: 500; }
        .field-input {
            width: 100%; padding: 8px 12px; border: 1.5px solid #d1d5db; border-radius: 8px;
            font-size: 0.85rem; font-family: '${selectedFont}', sans-serif;
            transition: border-color 0.2s;
        }
        .field-input:focus { outline: none; border-color: ${accentColor}; box-shadow: 0 0 0 3px ${accentColor}15; }

        /* â”€â”€ Buttons â”€â”€ */
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

        /* â”€â”€ Remember me / MAC â”€â”€ */
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

        /* â”€â”€ Footer â”€â”€ */
        .footer {
            text-align: center; padding: 16px; font-size: 0.72rem; color: #bbb;
            border-top: 1px solid #f0f0f0; margin-top: 8px;
        }

        /* â”€â”€ Ads â”€â”€ */
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

        /* â”€â”€ Payment Overlay â”€â”€ */
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
                <span>ðŸ“¦ Select</span> <span class="dot">â€¢</span>
                <span>ðŸ’³ Pay</span> <span class="dot">â€¢</span>
                <span>ðŸŒ Connect</span>
            </div>
            <div class="support-bar">ðŸ“ž Support: ${customerCareNumber}</div>
        </div>

        ${enableAds ? `<div class="ad-banner">${adMessage || 'ðŸŽ‰ Special offer! Get extra data on all packages today!'}</div>` : ''}

        <!-- Packages -->
        <div class="section">
            <div class="section-title">ðŸ“¦ Packages</div>
            <div id="packagesContainer" class="${layoutClass}">
                <div class="pkg-loading">â³ Loading packages...</div>
            </div>
        </div>

        <!-- Redeem Voucher -->
        <div class="section">
            <div class="section-title">ðŸŽŸï¸ Redeem Voucher</div>
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
            <div class="section-title">ðŸ”„ Reconnect</div>
            <div class="section-card">
                <label style="font-size: 0.78rem; color: #666; margin-bottom: 6px; display: block;">Enter Transaction reference</label>
                <div class="login-row">
                    <input type="text" class="field-input" id="zenopay-ref" placeholder="Transaction reference (HP...)" />
                </div>
                <button class="btn-accent" style="margin-top: 10px;" onclick="doReconnect()">
                    ðŸ’³ Reconnect
                </button>
            </div>
        </div>

        <!-- Manual Login -->
        <div class="section">
            <div class="section-title">ðŸ“¶ Manual Login</div>
            <div class="section-card">
                $(if error)
                <div style="background: #fee2e2; color: #ef4444; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 0.85rem; text-align: center; border: 1px solid #fca5a5;">
                    $(error)
                </div>
                $(endif)
                <form name="login" action="$(link-login-only)" method="post" onsubmit="return doLogin()">
                    <input type="hidden" name="dst" value="$(link-orig)" />
                    <input type="hidden" name="popup" value="true" />
                    <input type="hidden" name="mac" value="$(mac)" />
                    <div class="login-row">
                        <input type="text" class="field-input" name="username" value="$(username)" placeholder="Username" />
                        <input type="password" class="field-input" name="password" placeholder="â€¢â€¢â€¢â€¢" />
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
            Powered by ${companyName} â€¢ ${selectedRouter?.name || 'Router'}
        </div>
    </div>

    <script src="md5.js"></script>
    <script>
        // â”€â”€ Configuration (URL is BAKED IN at download time â€” never use window.location here) â”€â”€
        var API_BASE = '${(backendUrl || CLEAN_API_URL || '').replace(/\/$/, '')}';
        var ROUTER_ID = '${selectedRouterId}';
        var ACCENT = '${accentColor}';
        var PRIMARY = '${primaryColor}';
        var currentPkg = null;
        var pollInterval = null;

        // â”€â”€ Packages baked-in at generation time (always show these immediately) â”€â”€
        var fallbackPackages = ${JSON.stringify(
            routerPackages.length > 0
                ? routerPackages.map(p => ({
                    id: p.id,
                    name: p.name,
                    price: p.price || 0,
                    validity: p.validity || (p.duration ? p.duration + ' ' + (p.durationUnit || '') : ''),
                }))
                : [
                ]
        )};

        function renderPackages(packages) {
            var c = document.getElementById('packagesContainer');
            if (!packages || packages.length === 0) { c.innerHTML = '<div class="pkg-loading">No packages available</div>'; return; }
            c.innerHTML = packages.map(function(p) {
                return '<div class="pkg-card" onclick=\\'showPayment(' + JSON.stringify(p).replace(/"/g, "&quot;").replace(/'/g, "&#39;") + ')\\'>' +
                    '<div class="pkg-name">' + p.name + '</div>' +
                    '<div class="pkg-price"><small>TSH</small> ' + Number(p.price).toLocaleString() + '</div>' +
                    '<div class="pkg-duration" style="margin-bottom:6px">â± ' + (p.validity||'') + '</div>' +
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
                if (d && typeof d.error === 'string') { throw new Error(d.error); }
                document.getElementById('paymentInitial').style.display = 'none';
                document.getElementById('paymentWait').style.display = 'block';
                if (d.title) {
                    document.getElementById('pollStatus').innerText = d.title;
                }
                if (d.message) {
                    document.getElementById('pollMessage').innerText = d.message;
                }
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
                fetch(API_BASE + '/api/hotspot/status?reference=' + ref + '&routerId=' + ROUTER_ID)
                .then(function(r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .then(function(d) {
                        if (d.status === 'COMPLETED') {
                        clearInterval(pollInterval);
                        document.getElementById('pollStatus').innerText = d.title || 'PAID! Connecting...';
                        document.getElementById('pollStatus').style.background = '#22c55e';
                        document.getElementById('pollStatus').style.color = '#fff';
                        document.getElementById('pollMessage').innerText = d.message || 'Your payment was successful. Getting you online now!';
                        
                        if (d.autoConnect !== false && d.username && d.password) {
                            setTimeout(function() {
                                connectUser(d.username, d.password);
                            }, 2000);
                        }
                    } else if (d.status === 'FAILED') {
                        clearInterval(pollInterval);
                        alert(d.message || 'Payment failed or cancelled. Please try again.');
                        closePayment();
                    } else if (d.title) {
                        document.getElementById('pollStatus').innerText = d.title;
                        document.getElementById('pollMessage').innerText = d.message || 'Waiting for payment confirmation...';
                    }
                })
                .catch(function(err) {
                    // Network or parse error during polling — stop polling and surface message
                    if (pollInterval) clearInterval(pollInterval);
                    console.error('[Hotspot] status poll error:', err);
                    alert(err.message || 'Failed to check payment status. Please try again later.');
                    closePayment();
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
                                     '<input type="hidden" name="dst" value="' + f.dst.value + '" />' +
                                     '<input type="hidden" name="popup" value="true" />' +
                                     '<input type="hidden" name="mac" value="' + (f.mac ? f.mac.value : '$(mac)') + '" />';
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
                if (d && typeof d.error === 'string') { throw new Error(d.error); }
                if (d.title) {
                    alert(d.title + '\n' + (d.message || 'Connecting...'));
                } else {
                    alert('Voucher valid! Connecting...');
                }
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

        // â”€â”€ INIT: Show baked-in packages immediately, then try to fetch live ones â”€â”€
        (function() {
            // STEP 1: Always show baked-in packages immediately (no delay, no spinner)
            renderPackages(fallbackPackages);

            // STEP 2: Only attempt live fetch if we have a valid API_BASE and ROUTER_ID
            if (!API_BASE || API_BASE === '' || !ROUTER_ID) {
                console.log('[Hotspot] No API_BASE or ROUTER_ID â€” using baked-in packages only.');
                return;
            }

            // Fetch live packages (may fail due to CORS from MikroTik â€” that is OK)
            fetch(API_BASE + '/api/hotspot/packages?routerId=' + ROUTER_ID, { mode: 'cors' })
                .then(function(r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .then(function(d) {
                    var pkgs = Array.isArray(d) ? d : (d.data || []);
                    if (pkgs.length > 0) {
                        // Map live packages to display format
                        var mapped = pkgs.map(function(p) {
                            var validity = p.validity || (p.duration ? p.duration + ' ' + (p.durationUnit || '') : '');
                            return { id: p.id, name: p.name, price: p.price || 0, validity: validity };
                        });
                        renderPackages(mapped);
                        console.log('[Hotspot] Loaded ' + mapped.length + ' live packages.');
                    }
                })
                .catch(function(err) {
                    // CORS or network error â€” baked packages already showing, do nothing
                    console.log('[Hotspot] Live package fetch failed (using baked-in). Error: ' + err.message);
                });

            // STEP 3: Check for active subscription (Auto-reconnect by MAC)
            var currentMac = '$(mac)';
            if (currentMac && currentMac !== '' && currentMac.indexOf('$') === -1) {
                fetch(API_BASE + '/api/hotspot/check-mac?mac=' + encodeURIComponent(currentMac) + '&routerId=' + ROUTER_ID, { mode: 'cors' })
                    .then(function(r) { return r.json(); })
                    .then(function(d) {
                        if (d.title) {
                            document.getElementById('pollStatus').innerText = d.title;
                        }
                        if (d.message) {
                            document.getElementById('pollMessage').innerText = d.message;
                        }

                        if (d.active) {
                            console.log('[Hotspot] Active subscription found for MAC. Auto-connecting...');
                            connectUser(d.username, d.password);
                        }
                    })
                    .catch(function(e) { console.log('[Hotspot] MAC check failed:', e.message); });
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
        setSyncStatus(null);
        try {
            const res = await hotspotSettingsApi.update({
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

            if (res.synced !== undefined) {
                setSyncStatus({
                    status: res.synced ? 'success' : 'error',
                    message: res.synced
                        ? (res.syncMessage || 'Synced to MikroTik successfully.')
                        : (res.syncError ? `Sync failed: ${res.syncError}` : 'Failed to sync to MikroTik.')
                });
            }

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
            const safeZipName = (selectedRouter?.name || 'template')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/[^a-zA-Z0-9\-]/g, '')
                .replace(/-+/g, '-')
                .replace(/^-+|-+$/g, '')
                .toLowerCase();
            saveAs(content, `hotspot-${safeZipName}.zip`);

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

    // â”€â”€ Preview packages for the live panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const previewPackages = routerPackages.map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price || 0,
        validity: p.validity || (p.duration ? `${p.duration} ${p.durationUnit || ''}` : 'N/A'),
    }));

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 'clamp(1rem, 2.5vw, 1.3rem)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <WifiIcon style={{ color: '#16a34a' }} /> Hotspot Login Customizer
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Customize and download your hotspot login page</p>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    <div>Company: <strong style={{ color: 'var(--text-primary)' }}>{companyName}</strong></div>
                    <div>User: <strong style={{ color: 'var(--text-primary)' }}>{user?.username || 'Admin'}</strong></div>
                    <div>Role: <strong style={{ color: 'var(--text-primary)' }}>{user?.role || 'User'}</strong></div>
                </div>
            </div>

            {/* â”€â”€ Router Selector â”€â”€ */}
            <div className="card" style={{ padding: 16, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <RouterIcon style={{ color: '#d97706', fontSize: 22 }} />
                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Select Router:</span>
                    {loadingRouters ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Loading routers...</span>
                    ) : routers.length === 0 ? (
                        <span style={{ fontSize: '0.85rem', color: '#dc2626' }}>No routers found. Add a router first in the Mikrotiks page.</span>
                    ) : (
                        <select className="select-field"
                            style={{ width: '100%', maxWidth: 400, minWidth: 0, fontWeight: 500 }}
                            value={selectedRouterId}
                            onChange={e => setSelectedRouterId(e.target.value)}
                        >
                            {routers.map(r => (
                                <option key={r.id} value={r.id}>{r.name} â€” {r.host} ({r.status})</option>
                            ))}
                        </select>
                    )}
                    {selectedRouter && (
                        <span style={{
                            padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                            background: selectedRouter.status === 'Online' ? '#d1fae5' : '#fee2e2',
                            color: selectedRouter.status === 'Online' ? '#065f46' : '#dc2626',
                        }}>
                            {selectedRouter.status === 'Online' ? 'â— Online' : 'â—‹ Offline'}
                        </span>
                    )}
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        <InfoOutlinedIcon style={{ fontSize: 14 }} />
                        Each router gets its own customized login page
                    </div>
                </div>
                {routerPackages.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        ðŸ“¦ <strong>{routerPackages.length}</strong> packages found for this router â€” they will appear on the login page
                    </div>
                )}
            </div>

            {/* â”€â”€ Two-column: Controls | Preview â”€â”€ */}
            <div style={{ display: 'grid', gridTemplateColumns: showPreview ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr', gap: 24 }}>
                {/* Left â€” CustomizerPanel */}
                <div>
                    <CustomizerPanel
                        primaryColor={primaryColor} setPrimaryColor={setPrimaryColor}
                        accentColor={accentColor} setAccentColor={setAccentColor}
                        selectedFont={selectedFont} setSelectedFont={setSelectedFont}
                        layout={layout} setLayout={setLayout}
                        enableAds={enableAds} setEnableAds={setEnableAds}
                        adMessage={adMessage} setAdMessage={setAdMessage}
                        enableRememberMe={enableRememberMe} setEnableRememberMe={setEnableRememberMe}
                        companyName={companyName} setCompanyName={setCompanyName}
                        customerCareNumber={customerCareNumber} setCustomerCareNumber={setCustomerCareNumber}
                        backendUrl={backendUrl} setBackendUrl={setBackendUrl}
                        saving={saving}
                        saveSuccess={saveSuccess}
                        saveError={saveError}
                        syncStatus={syncStatus}
                        onSave={handleSaveSettings}
                        onPreview={handlePreview}
                        onDownloadZip={handleDownloadZip}
                    />
                </div>

                {/* Right â€” HotspotLivePreview */}
                {showPreview && (
                    <div>
                        <HotspotLivePreview
                            primaryColor={primaryColor}
                            accentColor={accentColor}
                            selectedFont={selectedFont}
                            layout={layout}
                            enableAds={enableAds}
                            adMessage={adMessage}
                            enableRememberMe={enableRememberMe}
                            companyName={companyName}
                            customerCareNumber={customerCareNumber}
                            routerName={selectedRouter?.name || 'Router'}
                            packages={previewPackages}
                            onHide={() => setShowPreview(false)}
                        />
                    </div>
                )}
            </div>

            {/* Show Preview FAB when panel is hidden */}
            {!showPreview && (
                <button className="btn"
                    style={{ position: 'fixed', bottom: 20, right: 20, background: '#2563eb', color: '#fff', fontWeight: 600, padding: '10px 20px', borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 6, zIndex: 100 }}
                    onClick={() => setShowPreview(true)}
                >
                    <PreviewIcon fontSize="small" /> Show Preview
                </button>
            )}
        </div>
    );
}
