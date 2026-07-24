"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ShoppingBag, Zap, Shield, Star } from "lucide-react";

// Floating product cards data
const floatingCards = [
  { emoji: "📱", label: "Smartphones", price: "TZS 450,000", color: "#3b82f6", delay: 0 },
  { emoji: "💻", label: "Laptops", price: "TZS 1,200,000", color: "#10b981", delay: 0.5 },
  { emoji: "🎧", label: "Electronics", price: "TZS 85,000", color: "#f59e0b", delay: 1 },
  { emoji: "👗", label: "Fashion", price: "TZS 35,000", color: "#8b5cf6", delay: 1.5 },
];

const featureChips = [
  { icon: <Zap size={14} />, text: "Fast Delivery" },
  { icon: <Shield size={14} />, text: "Secure Payments" },
  { icon: <Star size={14} />, text: "Top Quality" },
];

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* ── Animated Gradient Background ── */}
      <div
        className="absolute inset-0 animate-gradient"
        style={{
          background: "linear-gradient(-45deg, #0f172a, #1e3a8a, #0c4a6e, #1e3a8a, #0f172a)",
          backgroundSize: "400% 400%",
        }}
      />

      {/* ── Mesh / Orbs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 animate-pulse-glow"
          style={{
            background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)",
            top: "-10%",
            right: "-5%",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-15"
          style={{
            background: "radial-gradient(circle, #10b981 0%, transparent 70%)",
            bottom: "5%",
            left: "-5%",
          }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Floating particles */}
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white opacity-30"
            style={{
              left: `${10 + i * 8}%`,
              top: `${20 + (i % 4) * 15}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.7, 0.3],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + i * 0.3,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* ── Left: Copy ── */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-white/90">
                🛍️ Premium Marketplace — East Africa
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-4xl md:text-5xl xl:text-6xl font-extrabold text-white leading-[1.1] mb-6"
            >
              Shop Smart.{" "}
              <span className="relative">
                <span
                  className="relative z-10"
                  style={{
                    background: "linear-gradient(135deg, #60a5fa, #34d399)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Live Better.
                </span>
                <motion.span
                  className="absolute -bottom-1 left-0 h-1 rounded-full"
                  style={{ background: "linear-gradient(135deg, #60a5fa, #34d399)", width: "100%" }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.8, duration: 0.6 }}
                />
              </span>
              <br />
              <span className="text-white/90">Sell Smarter.</span>
            </motion.h1>

            {/* Sub */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-lg text-white/70 mb-10 leading-relaxed max-w-lg mx-auto lg:mx-0"
            >
              HQ Investment combines a world-class marketplace with powerful ISP billing tools.
              Find top products from verified vendors — delivered fast, priced fairly.
            </motion.p>

            {/* Feature Chips */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-wrap gap-3 justify-center lg:justify-start mb-10"
            >
              {featureChips.map((chip) => (
                <div
                  key={chip.text}
                  className="flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-white/80 font-medium"
                >
                  {chip.icon}
                  {chip.text}
                </div>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Link
                href="/products"
                id="hero-shop-cta"
                className="group flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-white text-base transition-all hover:-translate-y-1"
                style={{
                  background: "linear-gradient(135deg, #3b82f6, #10b981)",
                  boxShadow: "0 8px 30px rgba(59,130,246,0.4)",
                }}
              >
                <ShoppingBag size={20} />
                Shop Now
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                href="/#pricing"
                id="hero-pricing-cta"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-sm transition-all hover:-translate-y-1 btn-ghost"
              >
                ISP Billing Plans
              </Link>
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="grid grid-cols-3 gap-6 mt-14 pt-10 border-t border-white/10"
            >
              {[
                { label: "Products", value: "10,000+" },
                { label: "Happy Customers", value: "50,000+" },
                { label: "ISP Partners", value: "500+" },
              ].map((s) => (
                <div key={s.label} className="text-center lg:text-left">
                  <p className="text-2xl font-black text-white">{s.value}</p>
                  <p className="text-sm text-white/50 mt-0.5">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right: Floating Cards ── */}
          <div className="hidden lg:flex relative items-center justify-center h-[520px]">
            {/* Central glow */}
            <div
              className="absolute w-80 h-80 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)",
              }}
            />

            {/* Main card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="relative z-10 glass-card rounded-3xl p-6 w-72 shadow-premium"
              style={{ animation: "float 6s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="text-4xl">🛒</div>
                <div>
                  <p className="font-bold text-slate-900">Featured Products</p>
                  <p className="text-sm text-slate-500">Best deals today</p>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { name: "Samsung Galaxy A55", price: "TZS 750,000" },
                  { name: "Nike Air Max 2024", price: "TZS 165,000" },
                  { name: "JBL Speaker", price: "TZS 85,000" },
                ].map((p) => (
                  <div key={p.name} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                    <span className="text-sm text-slate-700 font-medium">{p.name}</span>
                    <span className="text-sm font-bold text-primary">{p.price}</span>
                  </div>
                ))}
              </div>
              <div
                className="mt-4 w-full py-2.5 rounded-full text-center text-sm font-bold text-white"
                style={{ background: "var(--gradient-primary)" }}
              >
                View All
              </div>
            </motion.div>

            {/* Floating product chips */}
            {floatingCards.map((card, i) => {
              const positions = [
                { top: "5%", left: "-10%" },
                { top: "10%", right: "-10%" },
                { bottom: "10%", left: "-15%" },
                { bottom: "5%", right: "-8%" },
              ];
              const pos = positions[i];

              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + card.delay }}
                  className="absolute glass-card rounded-2xl p-3 flex items-center gap-3 shadow-lg w-44"
                  style={{
                    ...pos,
                    animation: `float ${6 + i}s ease-in-out infinite ${card.delay}s`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: `${card.color}20` }}
                  >
                    {card.emoji}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{card.label}</p>
                    <p className="text-xs text-primary font-bold">{card.price}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 80L1440 80L1440 20C1200 80 960 0 720 40C480 80 240 0 0 20V80Z" fill="white" />
        </svg>
      </div>
    </section>
  );
}
