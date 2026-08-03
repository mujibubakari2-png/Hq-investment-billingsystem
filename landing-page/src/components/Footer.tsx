"use client";

import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  MessageCircle,
  ArrowRight,
} from "lucide-react";

// ── Inline Social SVGs (lucide doesn't ship these in all versions) ──
const IconFacebook = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const IconTwitterX = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const IconInstagram = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

const IconYouTube = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const IconWhatsApp = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.557 4.118 1.529 5.847L0 24l6.335-1.51A11.95 11.95 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.017-1.38l-.36-.214-3.73.889.925-3.63-.234-.374A9.818 9.818 0 1121.818 12 9.818 9.818 0 0112 21.818z" />
  </svg>
);

const MARKETPLACE_LINKS = [
  { label: "All Products", href: "/products" },
  { label: "New Arrivals", href: "/products?sort=latest" },
  { label: "Best Sellers", href: "/products?bestSeller=true" },
  { label: "Flash Deals", href: "/products?flashSale=true" },
  { label: "Trending Now", href: "/products?trending=true" },
  { label: "Luxury Picks", href: "/products?collection=luxury" },
];

const HELP_LINKS = [
  { label: "Help Center", href: "/support" },
  { label: "Track My Order", href: "/track-order" },
  { label: "Returns & Refunds", href: "/returns" },
  { label: "Shipping Policy", href: "/shipping" },
  { label: "Payment Methods", href: "/payments" },
  { label: "Contact Us", href: "/contact" },
];

const COMPANY_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Careers", href: "/careers" },
  { label: "Press", href: "/press" },
  { label: "Blog", href: "/blog" },
  { label: "Affiliate Program", href: "/affiliates" },
  { label: "Become a Seller", href: "/sell" },
];

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Cookie Policy", href: "/cookies" },
  { label: "Accessibility", href: "/accessibility" },
  { label: "API Documentation", href: "/developers" },
];

const SOCIAL_LINKS = [
  { icon: IconFacebook, label: "Facebook", href: "#", color: "hover:text-blue-400" },
  { icon: IconTwitterX, label: "X (Twitter)", href: "#", color: "hover:text-sky-400" },
  { icon: IconInstagram, label: "Instagram", href: "#", color: "hover:text-pink-400" },
  { icon: IconYouTube, label: "YouTube", href: "#", color: "hover:text-red-400" },
  { icon: IconWhatsApp, label: "WhatsApp", href: "#", color: "hover:text-green-400" },
];

const PAYMENT_BADGES = [
  "Visa",
  "Mastercard",
  "PayPal",
  "Apple Pay",
  "Google Pay",
  "M-Pesa",
  "Airtel",
  "Bank Transfer",
];

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const billingUrl = process.env.NEXT_PUBLIC_BILLING_SYSTEM_URL ?? "/billing";

  return (
    <footer className="bg-slate-950 text-white">
      {/* Newsletter strip */}
      <div className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="text-center lg:text-left">
              <p className="font-display font-bold text-xl text-white">
                Get exclusive deals in your inbox
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Join 15,000+ subscribers. No spam, unsubscribe anytime.
              </p>
            </div>
            <form
              className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto"
              onSubmit={(e) => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="your@email.com"
                className="w-full sm:w-72 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 text-sm outline-none focus:border-secondary transition-colors"
                aria-label="Email for newsletter"
              />
              <button
                type="submit"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 shrink-0"
                style={{ background: "var(--gradient-primary)" }}
              >
                Subscribe
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-8 lg:gap-12 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-4 space-y-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 w-fit">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shrink-0"
                style={{ background: "var(--gradient-primary)" }}
              >
                HQ
              </div>
              <div>
                <p className="font-display font-bold text-base leading-none">HQ INVESTMENT</p>
                <p className="text-slate-500 text-xs mt-1">ISP Billing &amp; Marketplace</p>
              </div>
            </Link>

            <p className="text-slate-400 leading-relaxed text-sm max-w-sm">
              East Africa&apos;s premier platform combining powerful ISP billing
              automation with a premium e-commerce marketplace. Trusted by
              hundreds of ISPs and thousands of customers.
            </p>

            {/* Contact details */}
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:support@hqinvestment.co.tz"
                  className="flex items-center gap-3 text-sm text-slate-400 hover:text-white transition-colors group"
                >
                  <Mail size={16} className="shrink-0 group-hover:text-secondary transition-colors" />
                  support@hqinvestment.co.tz
                </a>
              </li>
              <li>
                <a
                  href="tel:+255621085215"
                  className="flex items-center gap-3 text-sm text-slate-400 hover:text-white transition-colors group"
                >
                  <Phone size={16} className="shrink-0 group-hover:text-secondary transition-colors" />
                  +255 621 085 215
                </a>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-400">
                <MapPin size={16} className="shrink-0 mt-0.5" />
                Dar es Salaam, Tanzania
              </li>
            </ul>

            {/* Social icons */}
            <div className="flex gap-2.5 pt-2">
              {SOCIAL_LINKS.map(({ icon: Icon, label, href, color }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 transition-all hover:-translate-y-1 ${color}`}
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Marketplace */}
          <div className="col-span-1 lg:col-span-2">
            <h4 className="font-display font-bold text-sm uppercase tracking-widest text-white mb-5">
              Marketplace
            </h4>
            <ul className="space-y-3">
              {MARKETPLACE_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-slate-400 hover:text-white text-sm transition-colors hover:translate-x-1 inline-block"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div className="col-span-1 lg:col-span-2">
            <h4 className="font-display font-bold text-sm uppercase tracking-widest text-white mb-5">
              Help &amp; Support
            </h4>
            <ul className="space-y-3">
              {HELP_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-slate-400 hover:text-white text-sm transition-colors hover:translate-x-1 inline-block"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="col-span-1 lg:col-span-2">
            <h4 className="font-display font-bold text-sm uppercase tracking-widest text-white mb-5">
              Company
            </h4>
            <ul className="space-y-3">
              {COMPANY_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-slate-400 hover:text-white text-sm transition-colors hover:translate-x-1 inline-block"
                  >
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={`${billingUrl}/login`}
                  className="text-slate-400 hover:text-white text-sm transition-colors hover:translate-x-1 inline-block"
                >
                  ISP Platform Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="col-span-1 lg:col-span-2">
            <h4 className="font-display font-bold text-sm uppercase tracking-widest text-white mb-5">
              Legal
            </h4>
            <ul className="space-y-3">
              {LEGAL_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-slate-400 hover:text-white text-sm transition-colors hover:translate-x-1 inline-block"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Payment methods */}
        <div className="border-t border-slate-800 pt-8 mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">
            Accepted Payments
          </p>
          <div className="flex flex-wrap gap-2.5">
            {PAYMENT_BADGES.map((method) => (
              <span
                key={method}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 border border-slate-700 bg-slate-800/50"
              >
                {method}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm">
            &copy; {currentYear} HQ Investment Limited. All rights reserved.
          </p>
          <div className="flex items-center gap-2.5 text-slate-500 text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
}
