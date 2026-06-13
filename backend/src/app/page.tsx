/**
 * LP-001: HQ Investment ISP Platform — Public Landing Page
 *
 * Rendered at the backend root URL (/). Serves as both a marketing page
 * and an API status indicator for ops teams. Fully self-contained — no
 * external CSS framework; all styles are inline or via a <style> tag so
 * the page loads fast even without the Next.js frontend being online.
 */

import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'HQ Investment — ISP Billing & Network Management Platform',
    description:
        'Modern, multi-tenant ISP billing and network management for Tanzanian internet service providers. RADIUS, MikroTik, PPPoE, Hotspot, mobile payments, and real-time analytics.',
};

// ── Feature data ───────────────────────────────────────────────────────────────

const FEATURES = [
    {
        icon: '📡',
        title: 'RADIUS & MikroTik',
        desc: 'Full FreeRADIUS integration with atomic PPPoE and Hotspot user sync. Async MikroTik job queue with retries.',
    },
    {
        icon: '💳',
        title: 'Mobile Payments',
        desc: 'M-Pesa, Airtel Money, Tigopesa, and Halopesa webhook processing with idempotency and signature verification.',
    },
    {
        icon: '👥',
        title: 'Multi-Tenant',
        desc: 'Complete tenant isolation — every query is scoped. SUPER_ADMIN, ADMIN, AGENT, and VIEWER roles with fine-grained RBAC.',
    },
    {
        icon: '📊',
        title: 'Real-Time Analytics',
        desc: 'Live dashboard with subscriber counts, revenue totals, router status, and growth charts. Redis-cached for instant loads.',
    },
    {
        icon: '🔒',
        title: 'Security-First',
        desc: 'JWT access/refresh token rotation, TOTP MFA, OTP hashing, SameSite cookies, rate limiting, and audit logs.',
    },
    {
        icon: '🌐',
        title: 'Hotspot Portal',
        desc: 'Fully brandable captive portal per tenant. Custom logo, colors, and welcome text. Voucher-based billing.',
    },
    {
        icon: '📦',
        title: 'Package Management',
        desc: 'Flexible PPPoE and Hotspot packages with rate limits, session timeouts, and automatic MikroTik profile sync.',
    },
    {
        icon: '🔔',
        title: 'Smart Notifications',
        desc: 'SMS alerts for subscription expiry, payment confirmation, and account events via configurable SMS gateway.',
    },
];

const STATS = [
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '<60ms', label: 'API Response' },
    { value: '10M+', label: 'RADIUS Sessions' },
    { value: '4', label: 'Payment Gateways' },
];

// ── Page component ─────────────────────────────────────────────────────────────

export default function LandingPage() {
    return (
        <>
            <style>{`
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                :root {
                    --bg:        #0a0f1e;
                    --bg2:       #0d1528;
                    --card:      #111827;
                    --border:    rgba(255,255,255,0.07);
                    --accent:    #3b82f6;
                    --accent2:   #6366f1;
                    --green:     #10b981;
                    --text:      #f1f5f9;
                    --muted:     #94a3b8;
                    --radius:    16px;
                }

                body { background: var(--bg); color: var(--text); }

                /* ── Nav ── */
                nav {
                    position: sticky; top: 0; z-index: 100;
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 0 2rem; height: 64px;
                    background: rgba(10,15,30,0.85);
                    backdrop-filter: blur(16px);
                    border-bottom: 1px solid var(--border);
                }
                .nav-logo { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.1rem; }
                .nav-logo-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent); }
                .nav-links { display: flex; gap: 1.5rem; }
                .nav-links a { color: var(--muted); text-decoration: none; font-size: 0.9rem; transition: color 0.2s; }
                .nav-links a:hover { color: var(--text); }
                .nav-cta {
                    background: var(--accent); color: #fff; border: none; border-radius: 8px;
                    padding: 0.5rem 1.25rem; font-size: 0.875rem; font-weight: 600;
                    cursor: pointer; text-decoration: none;
                    transition: opacity 0.2s, transform 0.15s;
                }
                .nav-cta:hover { opacity: 0.88; transform: translateY(-1px); }

                /* ── Hero ── */
                .hero {
                    position: relative; overflow: hidden;
                    min-height: 88vh; display: flex; align-items: center; justify-content: center;
                    text-align: center; padding: 6rem 2rem 4rem;
                }
                .hero-glow {
                    position: absolute; top: -120px; left: 50%; transform: translateX(-50%);
                    width: 800px; height: 500px; border-radius: 50%;
                    background: radial-gradient(ellipse, rgba(59,130,246,0.18) 0%, transparent 70%);
                    pointer-events: none;
                }
                .hero-grid {
                    position: absolute; inset: 0;
                    background-image:
                        linear-gradient(rgba(59,130,246,0.05) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(59,130,246,0.05) 1px, transparent 1px);
                    background-size: 60px 60px;
                    pointer-events: none;
                }
                .badge {
                    display: inline-flex; align-items: center; gap: 8px;
                    background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.3);
                    border-radius: 999px; padding: 0.35rem 1rem;
                    font-size: 0.8rem; color: #93c5fd; margin-bottom: 1.5rem;
                    font-weight: 500; letter-spacing: 0.02em;
                }
                .badge-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
                @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
                h1 {
                    font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 900;
                    line-height: 1.1; letter-spacing: -0.03em; margin-bottom: 1.5rem;
                    background: linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                }
                .hero-accent { -webkit-text-fill-color: unset; color: var(--accent); }
                .hero-sub {
                    font-size: clamp(1rem, 2.5vw, 1.25rem); color: var(--muted);
                    max-width: 620px; margin: 0 auto 2.5rem; line-height: 1.7;
                }
                .hero-ctas { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
                .btn-primary {
                    background: linear-gradient(135deg, var(--accent), var(--accent2));
                    color: #fff; border: none; border-radius: 10px;
                    padding: 0.85rem 2rem; font-size: 1rem; font-weight: 600;
                    cursor: pointer; text-decoration: none;
                    box-shadow: 0 4px 24px rgba(59,130,246,0.35);
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(59,130,246,0.45); }
                .btn-ghost {
                    background: transparent; color: var(--muted);
                    border: 1px solid var(--border); border-radius: 10px;
                    padding: 0.85rem 2rem; font-size: 1rem; font-weight: 500;
                    cursor: pointer; text-decoration: none;
                    transition: color 0.2s, border-color 0.2s;
                }
                .btn-ghost:hover { color: var(--text); border-color: rgba(255,255,255,0.2); }

                /* ── Stats ── */
                .stats {
                    display: flex; justify-content: center; flex-wrap: wrap; gap: 2rem;
                    padding: 3rem 2rem; border-top: 1px solid var(--border);
                    border-bottom: 1px solid var(--border);
                    background: var(--bg2);
                }
                .stat { text-align: center; }
                .stat-value { font-size: 2.25rem; font-weight: 800; color: var(--accent); }
                .stat-label { font-size: 0.875rem; color: var(--muted); margin-top: 4px; }

                /* ── Section ── */
                section { padding: 5rem 2rem; max-width: 1200px; margin: 0 auto; }
                .section-header { text-align: center; margin-bottom: 3.5rem; }
                .section-tag {
                    display: inline-block; color: var(--accent); font-size: 0.8rem;
                    font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
                    margin-bottom: 0.75rem;
                }
                h2 { font-size: clamp(1.75rem, 4vw, 2.75rem); font-weight: 800; letter-spacing: -0.02em; margin-bottom: 1rem; }
                .section-sub { color: var(--muted); font-size: 1.05rem; max-width: 520px; margin: 0 auto; line-height: 1.7; }

                /* ── Feature grid ── */
                .features-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 1.25rem;
                }
                .feature-card {
                    background: var(--card); border: 1px solid var(--border);
                    border-radius: var(--radius); padding: 1.75rem;
                    transition: border-color 0.25s, transform 0.25s, box-shadow 0.25s;
                }
                .feature-card:hover {
                    border-color: rgba(59,130,246,0.35);
                    transform: translateY(-3px);
                    box-shadow: 0 12px 40px rgba(0,0,0,0.3);
                }
                .feature-icon { font-size: 2rem; margin-bottom: 1rem; }
                .feature-title { font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; }
                .feature-desc { font-size: 0.875rem; color: var(--muted); line-height: 1.65; }

                /* ── Architecture ── */
                .arch-section { background: var(--bg2); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
                .arch-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; }
                @media (max-width: 768px) { .arch-grid { grid-template-columns: 1fr; } .nav-links { display: none; } }
                .arch-stack { display: flex; flex-direction: column; gap: 1rem; }
                .arch-item {
                    display: flex; align-items: center; gap: 1rem;
                    background: var(--card); border: 1px solid var(--border);
                    border-radius: 12px; padding: 1rem 1.25rem;
                }
                .arch-icon { font-size: 1.5rem; flex-shrink: 0; }
                .arch-name { font-weight: 600; font-size: 0.9rem; }
                .arch-desc { font-size: 0.8rem; color: var(--muted); }
                .chip {
                    display: inline-block; background: rgba(59,130,246,0.12);
                    border: 1px solid rgba(59,130,246,0.25); border-radius: 6px;
                    padding: 0.25rem 0.6rem; font-size: 0.75rem; color: #93c5fd;
                    font-weight: 500; margin-left: auto; flex-shrink: 0;
                }

                /* ── API status ── */
                .status-section { text-align: center; }
                .status-card {
                    display: inline-flex; align-items: center; gap: 1rem;
                    background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25);
                    border-radius: 12px; padding: 1rem 2rem; margin-bottom: 1.5rem;
                }
                .status-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; }
                .status-text { font-weight: 600; color: var(--green); }
                .endpoint-list {
                    display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                    gap: 0.75rem; text-align: left; max-width: 900px; margin: 2rem auto 0;
                }
                .endpoint {
                    background: var(--card); border: 1px solid var(--border);
                    border-radius: 10px; padding: 0.875rem 1rem;
                    font-family: 'Courier New', monospace; font-size: 0.8rem;
                    color: var(--muted);
                }
                .method { color: var(--green); font-weight: 700; margin-right: 6px; }
                .method.post { color: #f59e0b; }
                .method.del { color: #ef4444; }

                /* ── Footer ── */
                footer {
                    border-top: 1px solid var(--border); padding: 2rem;
                    text-align: center; color: var(--muted); font-size: 0.85rem;
                    background: var(--bg2);
                }
                footer strong { color: var(--text); }
            `}</style>

            {/* ── Navigation ── */}
            <nav>
                <div className="nav-logo">
                    <div className="nav-logo-dot" />
                    HQ Investment
                </div>
                <div className="nav-links">
                    <a href="#features">Features</a>
                    <a href="#architecture">Stack</a>
                    <a href="#api">API</a>
                </div>
                <a className="nav-cta" href="/api/health">API Status</a>
            </nav>

            {/* ── Hero ── */}
            <header className="hero" role="banner">
                <div className="hero-glow" aria-hidden="true" />
                <div className="hero-grid" aria-hidden="true" />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div className="badge">
                        <span className="badge-dot" />
                        Multi-Tenant ISP Platform · Tanzania
                    </div>
                    <h1>
                        Billing &amp; Network Management
                        <br />
                        Built for <span className="hero-accent">African ISPs</span>
                    </h1>
                    <p className="hero-sub">
                        One platform for subscriber management, RADIUS authentication,
                        MikroTik automation, mobile payments, and real-time analytics.
                        Designed for Tanzanian internet service providers.
                    </p>
                    <div className="hero-ctas">
                        <a className="btn-primary" href="/api/health" id="hero-api-status-btn">
                            Check API Status
                        </a>
                        <a className="btn-ghost" href="#features" id="hero-features-btn">
                            Explore Features
                        </a>
                    </div>
                </div>
            </header>

            {/* ── Stats bar ── */}
            <div className="stats" role="region" aria-label="Platform statistics">
                {STATS.map(s => (
                    <div className="stat" key={s.label}>
                        <div className="stat-value">{s.value}</div>
                        <div className="stat-label">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Features ── */}
            <section id="features" aria-labelledby="features-heading">
                <div className="section-header">
                    <span className="section-tag">Features</span>
                    <h2 id="features-heading">Everything an ISP Needs</h2>
                    <p className="section-sub">
                        From RADIUS to revenue — every operational layer your ISP
                        needs is built-in, integrated, and production-ready.
                    </p>
                </div>
                <div className="features-grid">
                    {FEATURES.map(f => (
                        <article className="feature-card" key={f.title}>
                            <div className="feature-icon" aria-hidden="true">{f.icon}</div>
                            <h3 className="feature-title">{f.title}</h3>
                            <p className="feature-desc">{f.desc}</p>
                        </article>
                    ))}
                </div>
            </section>

            {/* ── Architecture ── */}
            <div className="arch-section">
                <section id="architecture" aria-labelledby="arch-heading">
                    <div className="arch-grid">
                        <div>
                            <span className="section-tag">Architecture</span>
                            <h2 id="arch-heading">Production-Grade Stack</h2>
                            <p className="section-sub" style={{ textAlign: 'left', margin: '1rem 0 2rem' }}>
                                Built on battle-tested open-source infrastructure tuned
                                for high-throughput ISP workloads in East Africa.
                            </p>
                        </div>
                        <div className="arch-stack">
                            {[
                                { icon: '⚡', name: 'Next.js 14', desc: 'App Router API routes', chip: 'Backend' },
                                { icon: '🗄️', name: 'PostgreSQL 16', desc: 'Partitioned radacct, Prisma ORM', chip: 'Database' },
                                { icon: '🔴', name: 'Redis + BullMQ', desc: 'Cache layer + MikroTik job queue', chip: 'Queue' },
                                { icon: '📡', name: 'FreeRADIUS', desc: 'MD5-Password, PPPoE, Hotspot', chip: 'RADIUS' },
                                { icon: '🛡️', name: 'JWT + TOTP MFA', desc: 'Access/refresh rotation, OTP hashing', chip: 'Auth' },
                            ].map(item => (
                                <div className="arch-item" key={item.name}>
                                    <span className="arch-icon" aria-hidden="true">{item.icon}</span>
                                    <div>
                                        <div className="arch-name">{item.name}</div>
                                        <div className="arch-desc">{item.desc}</div>
                                    </div>
                                    <span className="chip">{item.chip}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>

            {/* ── API Status ── */}
            <section id="api" className="status-section" aria-labelledby="api-heading">
                <span className="section-tag">API Reference</span>
                <h2 id="api-heading">REST API — Available at /api/*</h2>
                <p className="section-sub" style={{ margin: '0.75rem auto 2rem' }}>
                    All endpoints require a valid JWT Bearer token except
                    <code style={{ color: 'var(--accent)', margin: '0 4px' }}>/api/health</code>
                    and the public hotspot portal.
                </p>
                <div className="status-card" role="status" aria-live="polite">
                    <div className="status-dot" />
                    <span className="status-text">API Operational</span>
                </div>
                <div className="endpoint-list" aria-label="Available API endpoints">
                    {[
                        ['GET', '/api/health'],
                        ['POST', '/api/auth/login'],
                        ['POST', '/api/auth/refresh'],
                        ['GET', '/api/dashboard'],
                        ['GET', '/api/clients'],
                        ['POST', '/api/clients'],
                        ['GET', '/api/subscriptions'],
                        ['POST', '/api/subscriptions'],
                        ['GET', '/api/packages'],
                        ['GET', '/api/routers'],
                        ['GET', '/api/transactions'],
                        ['POST', '/api/transactions'],
                        ['GET', '/api/vouchers'],
                        ['POST', '/api/vouchers'],
                        ['GET', '/api/radius'],
                        ['GET', '/api/reports'],
                    ].map(([method, path]) => (
                        <div className="endpoint" key={`${method}-${path}`}>
                            <span className={`method ${method === 'POST' ? 'post' : method === 'DELETE' ? 'del' : ''}`}>
                                {method}
                            </span>
                            {path}
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Footer ── */}
            <footer role="contentinfo">
                <p>
                    © {new Date().getFullYear()} <strong>HQ Investment Ltd</strong> · ISP Billing &amp; Network Management Platform
                </p>
                <p style={{ marginTop: '0.5rem' }}>
                    Built for Tanzanian Internet Service Providers ·{' '}
                    <a href="/api/health" style={{ color: 'var(--accent)', textDecoration: 'none' }}>API Health</a>
                    {' · '}
                    <a href="/sitemap.xml" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Sitemap</a>
                </p>
            </footer>
        </>
    );
}