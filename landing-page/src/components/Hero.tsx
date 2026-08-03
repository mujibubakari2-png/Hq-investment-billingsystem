"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Headphones,
  Laptop,
  PackageCheck,
  Shield,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  Truck,
  Zap,
  HelpCircle,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  Smartphone, Laptop, Headphones, Shirt, Zap, Shield, Star, Truck, BadgeCheck, PackageCheck
};

const defaultFloatingCards = [
  { icon: "Smartphone", label: "Smartphones", price: "TZS 450,000", color: "#3b82f6", delay: 0 },
  { icon: "Laptop", label: "Laptops", price: "TZS 1,200,000", color: "#10b981", delay: 0.5 },
  { icon: "Headphones", label: "Electronics", price: "TZS 85,000", color: "#f59e0b", delay: 1 },
  { icon: "Shirt", label: "Fashion", price: "TZS 35,000", color: "#8b5cf6", delay: 1.5 },
];

const defaultFeatureChips = [
  { icon: "Zap", title: "Fast Delivery" },
  { icon: "Shield", title: "Secure Payments" },
  { icon: "Star", title: "Top Quality" },
];

const defaultTrustItems = [
  { icon: "Truck", title: "Same-day dispatch", text: "Dar es Salaam ready" },
  { icon: "BadgeCheck", title: "Verified sellers", text: "Quality controlled" },
  { icon: "PackageCheck", title: "Easy returns", text: "Buyer protection" },
];

export default function Hero() {
  const [config, setConfig] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/public/storefront/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data?.data) {
          if (data.data.HERO_CONFIG) setConfig(data.data.HERO_CONFIG);
          if (data.data.STORE_FEATURES) setFeatures(data.data.STORE_FEATURES);
        }
      })
      .catch(console.error);
  }, []);

  const badgeText = config?.badgeText || "Premium Marketplace for East Africa";
  const title = config?.title || "Premium shopping.";
  const subtitle = config?.subtitle || "Real products.";

  const floatingCards = config?.floatingCards?.length ? config.floatingCards : defaultFloatingCards;
  const trustItems = config?.trustItems?.length ? config.trustItems : defaultTrustItems;
  const featureChips = features?.length ? features : defaultFeatureChips;

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-20">
      <div
        className="absolute inset-0 animate-gradient"
        style={{
          background: "linear-gradient(135deg, #070b16 0%, #15244a 42%, #083344 100%)",
          backgroundSize: "400% 400%",
        }}
      />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
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
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-white/90">
                {badgeText}
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-4xl md:text-5xl xl:text-6xl font-extrabold text-white leading-[1.1] mb-6"
            >
              {title}{" "}
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
                  {subtitle}
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
              <span className="text-white/90">Built to convert.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="text-lg text-white/70 mb-10 leading-relaxed max-w-lg mx-auto lg:mx-0"
            >
              HQ Investment brings verified sellers, fast delivery, protected payments,
              curated deals, and a commerce engine ready for daily campaigns at scale.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-wrap gap-3 justify-center lg:justify-start mb-10"
            >
              {featureChips.slice(0, 4).map((chip: any) => {
                const IconComp = ICON_MAP[chip.icon] || HelpCircle;
                return (
                  <div
                    key={chip.title}
                    className="flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-white/80 font-medium"
                  >
                    <IconComp size={14} />
                    {chip.title}
                  </div>
                );
              })}
            </motion.div>

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
                href="/products?sort=popular"
                id="hero-trending-cta"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-full font-bold text-sm transition-all hover:-translate-y-1 btn-ghost"
              >
                Explore Trending
              </Link>
            </motion.div>
          </div>

          <div className="hidden lg:flex relative items-center justify-center h-[520px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="relative z-10 glass-card rounded-3xl p-6 w-72 shadow-premium"
              style={{ animation: "float 6s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-50 text-primary">
                  <Sparkles size={25} />
                </div>
                <div>
                  <p className="font-bold text-slate-900">Flash Deals</p>
                  <p className="text-sm text-slate-500">Live campaign stack</p>
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
                02h 18m left
              </div>
            </motion.div>

            {floatingCards.map((card: any, i: number) => {
              const positions = [
                { top: "5%", left: "-10%" },
                { top: "10%", right: "-10%" },
                { bottom: "10%", left: "-15%" },
                { bottom: "5%", right: "-8%" },
              ];
              const pos = positions[i % 4];
              const IconComp = ICON_MAP[card.icon] || HelpCircle;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.5 + (card.delay || (i * 0.5)) }}
                  className="absolute glass-card rounded-2xl p-3 flex items-center gap-3 shadow-lg w-44"
                  style={{
                    ...pos,
                    animation: `float ${6 + i}s ease-in-out infinite ${(card.delay || i * 0.5)}s`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: `${card.color}20` }}
                  >
                    <IconComp size={20} color={card.color} />
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

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {trustItems.slice(0, 3).map((item: any) => {
            const IconComp = ICON_MAP[item.icon] || HelpCircle;
            return (
              <div key={item.title} className="glass rounded-2xl px-5 py-4 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center">
                  <IconComp size={18} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-white">{item.title}</span>
                  <span className="block text-xs text-white/55">{item.text}</span>
                </span>
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Bottom wave — theme-aware */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <svg
          viewBox="0 0 1440 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          className="w-full block"
          aria-hidden="true"
        >
          <path
            d="M0 80L1440 80L1440 20C1200 80 960 0 720 40C480 80 240 0 0 20V80Z"
            className="fill-slate-50"
          />
        </svg>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/40"
        aria-hidden="true"
      >
        <span className="text-[10px] uppercase tracking-widest font-semibold">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  );
}
