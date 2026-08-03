"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import {
  Calendar,
  Globe2,
  Package,
  ShoppingBag,
  Star,
  Users,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { Stats } from "@/types";

// ─── Animated counter ─────────────────────────────────────────────
function AnimatedCount({
  target,
  suffix = "",
  prefix = "",
  duration = 2.2,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  useEffect(() => {
    if (!inView) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

// ─── Stat card ───────────────────────────────────────────────────
interface StatConfig {
  key: keyof ExtendedStats;
  label: string;
  icon: React.ElementType;
  suffix: string;
  prefix?: string;
  gradient: string;
  delay: number;
}

interface ExtendedStats extends Stats {
  brands: number;
  countries: number;
  satisfactionRate: number;
  dailyVisitors: number;
}

const STAT_CONFIGS: StatConfig[] = [
  {
    key: "products",
    label: "Products Listed",
    icon: Package,
    suffix: "+",
    gradient: "from-blue-500 to-blue-600",
    delay: 0,
  },
  {
    key: "customers",
    label: "Happy Customers",
    icon: Users,
    suffix: "+",
    gradient: "from-emerald-500 to-emerald-600",
    delay: 0.08,
  },
  {
    key: "orders",
    label: "Orders Completed",
    icon: ShoppingBag,
    suffix: "+",
    gradient: "from-violet-500 to-violet-600",
    delay: 0.16,
  },
  {
    key: "yearsInBusiness",
    label: "Years of Excellence",
    icon: Calendar,
    suffix: "+",
    gradient: "from-rose-500 to-rose-600",
    delay: 0.24,
  },
  {
    key: "brands",
    label: "Trusted Brands",
    icon: Star,
    suffix: "+",
    gradient: "from-amber-500 to-orange-500",
    delay: 0.32,
  },
  {
    key: "countries",
    label: "Countries Served",
    icon: Globe2,
    suffix: "",
    gradient: "from-cyan-500 to-sky-600",
    delay: 0.4,
  },
  {
    key: "satisfactionRate",
    label: "Customer Satisfaction",
    icon: TrendingUp,
    suffix: "%",
    gradient: "from-fuchsia-500 to-pink-600",
    delay: 0.48,
  },
  {
    key: "dailyVisitors",
    label: "Daily Visitors",
    icon: Zap,
    suffix: "+",
    gradient: "from-teal-500 to-emerald-600",
    delay: 0.56,
  },
];

export default function Statistics() {
  const [stats, setStats] = useState<Partial<ExtendedStats>>({});

  useEffect(() => {
    fetch("/api/public/storefront/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.data?.STATISTICS) setStats(data.data.STATISTICS as ExtendedStats);
      })
      .catch(() => {});
  }, []);

  const defaults: ExtendedStats = {
    products: 500,
    customers: 5_000,
    orders: 10_000,
    yearsInBusiness: 4,
    brands: 120,
    countries: 12,
    satisfactionRate: 98,
    dailyVisitors: 3_000,
  };

  const data: ExtendedStats = { ...defaults, ...stats };

  return (
    <section
      id="statistics"
      className="py-20 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0c4a6e 100%)" }}
    >
      {/* Grid texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glow orbs */}
      <div
        className="absolute top-0 left-1/4 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ background: "radial-gradient(circle, #10b981, transparent)" }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span
            className="inline-block text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4"
            style={{ background: "rgba(255,255,255,0.1)", color: "#93c5fd" }}
          >
            By the Numbers
          </span>
          <h2 className="font-display text-3xl md:text-5xl font-extrabold text-white mb-4">
            Trusted Across East Africa
          </h2>
          <p className="text-white/55 text-lg max-w-xl mx-auto">
            Numbers that speak for themselves — growing stronger every day.
          </p>
        </motion.div>

        {/* Stats grid — 4 columns on md, 8 on xl */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4">
          {STAT_CONFIGS.map(({ key, label, icon: Icon, suffix, gradient, delay }) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay }}
              className="group flex flex-col items-center text-center p-5 rounded-2xl border border-white/10 hover:border-white/25 hover:-translate-y-1 transition-all duration-300"
              style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(8px)" }}
            >
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform duration-300`}
              >
                <Icon size={22} className="text-white" />
              </div>
              <p className="text-2xl md:text-3xl font-black text-white mb-1 tabular-nums">
                <AnimatedCount target={data[key] ?? 0} suffix={suffix} />
              </p>
              <p className="text-white/50 text-xs font-medium leading-tight">{label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
