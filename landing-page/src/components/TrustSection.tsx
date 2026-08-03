"use client";

import { motion } from "framer-motion";
import {
  Truck,
  ShieldCheck,
  RotateCcw,
  Headphones,
  BadgeCheck,
  Zap,
  Award,
  Heart,
} from "lucide-react";

const WHY_CARDS = [
  {
    icon: Zap,
    title: "Same-Day Dispatch",
    description: "Orders placed before 2 PM ship the same day within Dar es Salaam.",
    color: "from-amber-500 to-orange-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
  {
    icon: ShieldCheck,
    title: "Secure Payments",
    description: "Bank-grade encryption across all payment methods. Your money is always safe.",
    color: "from-blue-500 to-blue-600",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
  {
    icon: RotateCcw,
    title: "Easy Returns",
    description: "Not satisfied? Return within 7 days for a full refund — no questions asked.",
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    description: "Our customer success team is always on. Chat, call, or email anytime.",
    color: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
    text: "text-violet-700",
  },
  {
    icon: BadgeCheck,
    title: "Verified Products",
    description: "Every seller is vetted. Every product is quality-checked before listing.",
    color: "from-rose-500 to-pink-600",
    bg: "bg-rose-50",
    text: "text-rose-700",
  },
  {
    icon: Truck,
    title: "Nationwide Delivery",
    description: "Fast delivery across Tanzania. International shipping to East Africa.",
    color: "from-cyan-500 to-sky-600",
    bg: "bg-cyan-50",
    text: "text-cyan-700",
  },
  {
    icon: Award,
    title: "Quality Guarantee",
    description: "Premium products with manufacturer warranty. Shop with complete confidence.",
    color: "from-indigo-500 to-blue-600",
    bg: "bg-indigo-50",
    text: "text-indigo-700",
  },
  {
    icon: Heart,
    title: "Loyalty Rewards",
    description: "Earn points on every purchase. Redeem for discounts, vouchers, and more.",
    color: "from-fuchsia-500 to-pink-500",
    bg: "bg-fuchsia-50",
    text: "text-fuchsia-700",
  },
];

const TRUST_STATS = [
  { value: "98%", label: "Customer Satisfaction" },
  { value: "10k+", label: "Verified Products" },
  { value: "50k+", label: "Happy Customers" },
  { value: "< 24h", label: "Average Support Response" },
];

export default function TrustSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary bg-primary/8 px-4 py-2 rounded-full mb-4">
            Why HQ Investment
          </span>
          <h2 className="section-title font-display">
            Built for a Premium<br />
            <span className="text-gradient">Shopping Experience</span>
          </h2>
          <p className="section-subtitle mt-4 mx-auto">
            We combine the trust of verified sellers, the speed of local delivery,
            and the security of enterprise payments — all in one marketplace.
          </p>
        </motion.div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {WHY_CARDS.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="group relative p-6 rounded-2xl border border-slate-100 bg-white hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-default"
            >
              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-5 shadow-sm group-hover:scale-110 transition-transform duration-300`}
              >
                <card.icon size={22} className="text-white" />
              </div>

              <h3 className="font-display font-bold text-slate-900 mb-2">
                {card.title}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {card.description}
              </p>

              {/* Hover accent */}
              <div
                className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl bg-gradient-to-r ${card.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
              />
            </motion.div>
          ))}
        </div>

        {/* Trust Stats Strip */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative rounded-3xl overflow-hidden p-8 md:p-10"
          style={{ background: "linear-gradient(135deg, #0f172a, #1e3a8a 60%, #0c4a6e)" }}
        >
          {/* Background texture */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {TRUST_STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-black text-white mb-1">
                  {stat.value}
                </div>
                <div className="text-white/55 text-sm font-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
