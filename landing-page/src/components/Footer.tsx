import Link from "next/link";
import { Mail, Phone, MapPin, MessageCircle, Share2, MessageSquare, Camera, Video } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const billingUrl = process.env.NEXT_PUBLIC_BILLING_SYSTEM_URL ?? "/billing";

  return (
    <footer className="bg-slate-900 text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-16">
          {/* Brand */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white"
                style={{ background: "var(--gradient-primary)" }}
              >
                HQ
              </div>
              <div>
                <p className="font-display font-bold text-lg leading-none">HQ INVESTMENT</p>
                <p className="text-slate-400 text-xs">ISP Billing & Marketplace</p>
              </div>
            </div>
            <p className="text-slate-400 leading-relaxed text-sm max-w-xs">
              East Africa&apos;s premier platform combining powerful ISP billing automation with a premium e-commerce marketplace. Trusted by hundreds of ISPs and thousands of customers.
            </p>
            {/* Social */}
            <div className="flex flex-wrap gap-3">
              {[
                { icon: Share2, label: "Facebook", href: "#" },
                { icon: MessageSquare, label: "X (Twitter)", href: "#" },
                { icon: Camera, label: "Instagram", href: "#" },
                { icon: Video, label: "YouTube", href: "#" },
                { icon: MessageCircle, label: "WhatsApp", href: "#" },
              ].map(({ icon: Icon, label, href }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all hover:-translate-y-0.5"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <Icon size={17} />
                </Link>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-widest text-slate-300 mb-5">
              Marketplace
            </h4>
            <ul className="space-y-3">
              {[
                { label: "All Products", href: "/products" },
                { label: "New Arrivals", href: "/products?sort=latest" },
                { label: "Best Sellers", href: "/products?bestSeller=true" },
                { label: "Trending", href: "/products?trending=true" },
                { label: "Deals & Offers", href: "/products?inStock=true" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-slate-400 hover:text-white text-sm transition-colors hover:translate-x-0.5 inline-block">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ISP Platform */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-widest text-slate-300 mb-5">
              ISP Platform
            </h4>
            <ul className="space-y-3">
              {[
                { label: "Features", href: "/#features" },
                { label: "Pricing Plans", href: "/#pricing" },
                { label: "Contact Sales", href: "/#contact" },
                { label: "Login", href: `${billingUrl}/login` },
                { label: "Register", href: `${billingUrl}/register` },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-slate-400 hover:text-white text-sm transition-colors hover:translate-x-0.5 inline-block">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-widest text-slate-300 mb-5">
              Contact Us
            </h4>
            <ul className="space-y-4">
              <li>
                <a href="mailto:support@hqinvestment.co.tz" className="flex items-start gap-3 text-sm text-slate-400 hover:text-white transition-colors group">
                  <Mail size={16} className="shrink-0 mt-0.5 group-hover:text-secondary transition-colors" />
                  support@hqinvestment.co.tz
                </a>
              </li>
              <li>
                <a href="tel:+255621085215" className="flex items-start gap-3 text-sm text-slate-400 hover:text-white transition-colors group">
                  <Phone size={16} className="shrink-0 mt-0.5 group-hover:text-secondary transition-colors" />
                  +255 621085215
                </a>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-400">
                <MapPin size={16} className="shrink-0 mt-0.5" />
                Dar es Salaam, Tanzania
              </li>
            </ul>
            {/* Newsletter mini */}
            <div className="mt-6">
              <p className="text-xs text-slate-500 mb-2">Get deals in your inbox</p>
              <Link
                href="/#newsletter"
                className="inline-block text-xs font-semibold text-secondary hover:text-white transition-colors"
              >
                Subscribe to newsletter →
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <p className="text-slate-500">
            © {currentYear} HQ Investment. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-5 text-slate-500">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
