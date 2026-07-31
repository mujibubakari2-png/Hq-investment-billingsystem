"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Package, ShoppingBag, Users } from "lucide-react";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import type { Stats } from "@/types";

const STAT_CONFIGS = [
  {
    key: "products" as const,
    label: "Products Listed",
    icon: Package,
    suffix: "+",
    color: "from-blue-500 to-blue-600",
    delay: 0,
  },
  {
    key: "customers" as const,
    label: "Happy Customers",
    icon: Users,
    suffix: "+",
    color: "from-emerald-500 to-emerald-600",
    delay: 0.1,
  },
  {
    key: "orders" as const,
    label: "Orders Completed",
    icon: ShoppingBag,
    suffix: "+",
    color: "from-violet-500 to-violet-600",
    delay: 0.2,
  },
  {
    key: "yearsInBusiness" as const,
    label: "Years of Excellence",
    icon: Calendar,
    suffix: "+",
    color: "from-rose-500 to-rose-600",
    delay: 0.3,
  },
];

export default function Statistics() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/public/stats")
      .then((response) => response.json())
      .then((data) => setStats(data.data ?? null))
      .catch(() => {});
  }, []);

  const defaults: Stats = { products: 500, customers: 5000, orders: 10000, yearsInBusiness: 4 };
  const data = stats ?? defaults;

  return (
    <section
      id="statistics"
      className="py-20 relative overflow-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="font-display text-3xl md:text-5xl font-extrabold text-white mb-4">
            Trusted by Thousands
          </h2>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Numbers that speak for themselves, growing stronger every day across East Africa.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {STAT_CONFIGS.map(({ key, label, icon: Icon, suffix, color, delay }) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay }}
              className="stat-card"
            >
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mx-auto mb-4 shadow-lg`}
              >
                <Icon size={26} className="text-white" />
              </div>
              <p className="text-4xl md:text-5xl font-black text-white mb-2">
                <AnimatedCounter target={data[key]} suffix={suffix} duration={2.5} />
              </p>
              <p className="text-white/60 text-sm font-medium">{label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
