"use client";

import { motion } from "framer-motion";
import { Smartphone, Download, Star, Bell, ShieldCheck, Zap } from "lucide-react";

const APP_FEATURES = [
  { icon: Bell, text: "Real-time order & delivery notifications" },
  { icon: ShieldCheck, text: "Biometric-secured one-tap checkout" },
  { icon: Zap, text: "Exclusive app-only flash deals" },
  { icon: Star, text: "Track rewards points & loyalty tiers" },
];

export default function MobileAppBanner() {
  return (
    <section className="py-20 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative rounded-3xl overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0f766e 100%)" }}
        >
          {/* Background grid */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          {/* Glow */}
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none" style={{ background: "radial-gradient(circle, #10b981, transparent)" }} />

          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 items-center p-8 md:p-12 lg:p-16">
            {/* Left: Content */}
            <div>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 text-xs font-bold text-cyan-200 uppercase tracking-widest mb-6">
                <Smartphone size={14} />
                HQ Investment App
              </span>

              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-4">
                Shop smarter.<br />
                <span
                  style={{
                    background: "linear-gradient(135deg, #60a5fa, #34d399)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Anywhere, anytime.
                </span>
              </h2>

              <p className="text-white/65 text-lg leading-relaxed mb-8 max-w-md">
                Get the full marketplace experience on your phone. Exclusive
                app deals, push alerts, one-tap checkout, and order tracking
                — all in your pocket.
              </p>

              {/* Features list */}
              <ul className="space-y-3 mb-10">
                {APP_FEATURES.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                      <Icon size={15} className="text-cyan-300" />
                    </div>
                    <span className="text-white/75 text-sm">{text}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-3">
                <a
                  href="#"
                  className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-50 transition-all hover:-translate-y-0.5 shadow-lg"
                  aria-label="Download on the App Store"
                >
                  {/* Apple icon SVG */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div>
                    <div className="text-[10px] text-slate-500 leading-none">Download on the</div>
                    <div className="text-sm font-black">App Store</div>
                  </div>
                </a>

                <a
                  href="#"
                  className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-50 transition-all hover:-translate-y-0.5 shadow-lg"
                  aria-label="Get it on Google Play"
                >
                  {/* Google Play icon SVG */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                    <path d="M3.18 23.76c.35.19.75.24 1.15.14l12.04-12.04-2.87-2.87L3.18 23.76zm16.04-10.93L16.7 11.1 5.29.29C4.89.09 4.44.09 4.04.29L16.16 12.4l3.06-1.57zm2.57 1.48c-.5-.5-1.12-.77-1.77-.77s-1.27.27-1.77.77l-1.87.96 2.87 2.87 1.87-.96c.98-.5.98-1.97-.33-2.87zM3.18.24L13.5 10.56 10.63 7.7.59 1.4C.19 1.2-.19.99-.34.29.01-.19.56-.19.94.09l2.24 1.15z" />
                  </svg>
                  <div>
                    <div className="text-[10px] text-slate-500 leading-none">Get it on</div>
                    <div className="text-sm font-black">Google Play</div>
                  </div>
                </a>
              </div>

              <p className="text-white/35 text-xs mt-5">
                Coming soon · Join the waitlist above to get early access
              </p>
            </div>

            {/* Right: Phone mockup */}
            <div className="flex justify-center lg:justify-end">
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                style={{ animation: "float 6s ease-in-out infinite" }}
              >
                {/* Phone frame */}
                <div
                  className="relative w-56 md:w-64 rounded-[2.5rem] p-2 shadow-2xl"
                  style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))", border: "1px solid rgba(255,255,255,0.25)", backdropFilter: "blur(12px)" }}
                >
                  <div className="rounded-[2rem] overflow-hidden bg-white">
                    {/* Status bar */}
                    <div className="flex items-center justify-between px-5 pt-3 pb-1">
                      <span className="text-[10px] font-bold text-slate-800">9:41</span>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-slate-200" />
                        <div className="w-3 h-3 rounded-full bg-slate-200" />
                        <div className="w-4 h-2 rounded-sm bg-slate-200" />
                      </div>
                    </div>
                    {/* App UI preview */}
                    <div className="px-3 pb-4 space-y-3">
                      {/* Search bar */}
                      <div className="h-9 rounded-full bg-slate-100 flex items-center gap-2 px-3">
                        <div className="w-3 h-3 rounded-full bg-slate-300" />
                        <div className="h-2.5 w-2/3 bg-slate-200 rounded" />
                      </div>
                      {/* Hero banner */}
                      <div className="h-24 rounded-2xl" style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}>
                        <div className="p-3">
                          <div className="h-2 w-1/2 bg-white/40 rounded mb-1.5" />
                          <div className="h-3 w-3/4 bg-white/60 rounded mb-3" />
                          <div className="h-5 w-1/3 bg-white rounded-full" />
                        </div>
                      </div>
                      {/* Product grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className="rounded-xl bg-slate-50 overflow-hidden">
                            <div className="h-16 bg-slate-200" style={{ background: `linear-gradient(135deg, hsl(${200 + i * 30}, 60%, 80%), hsl(${200 + i * 30}, 60%, 70%))` }} />
                            <div className="p-1.5 space-y-1">
                              <div className="h-2 w-3/4 bg-slate-200 rounded" />
                              <div className="h-2.5 w-1/2 bg-slate-300 rounded" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Download badge */}
                  <div className="absolute -top-3 -right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black text-white shadow-lg" style={{ background: "linear-gradient(135deg, #f59e0b, #f43f5e)" }}>
                    <Download size={11} />
                    Free
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
