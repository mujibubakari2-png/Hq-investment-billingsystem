"use client";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import { Zap, Users, CreditCard, BarChart3, ShieldCheck, Router, HelpCircle } from "lucide-react";

const ICON_MAP: Record<string, any> = {
  Zap, Users, CreditCard, BarChart3, ShieldCheck, Router
};

const defaultFeatures = [
  {
    title: "Zero Billing Errors",
    description: "Invoices are generated and dispatched automatically on schedule — no manual entry, no missed payments, no angry customers.",
    icon: "Zap",
  },
  {
    title: "Complete Subscriber Control",
    description: "View every subscriber's plan, payment history, and connection status in one clean dashboard — from onboarding to renewal.",
    icon: "Users",
  },
  {
    title: "Real-Time Payment Tracking",
    description: "Know the moment a payment lands. Instantly reconcile M-Pesa, voucher, and bank transactions without lifting a finger.",
    icon: "CreditCard",
  },
  {
    title: "Business Intelligence Reports",
    description: "Spot your most profitable plans, track churn, and identify growth trends with reports built for ISP operators.",
    icon: "BarChart3",
  },
  {
    title: "Enterprise-Grade Security",
    description: "Bank-level data encryption, role-based access control, and audit logs keep your business and your customers safe.",
    icon: "ShieldCheck",
  },
  {
    title: "Hotspot & PPPoE — One Platform",
    description: "Manage WiFi vouchers and wired PPPoE clients from a single dashboard. No more juggling multiple tools.",
    icon: "Router",
  },
];

export default function Features() {
  const [features, setFeatures] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/public/storefront/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data?.data?.STORE_FEATURES && data.data.STORE_FEATURES.length > 0) {
          setFeatures(data.data.STORE_FEATURES);
        } else {
          setFeatures(defaultFeatures);
        }
      })
      .catch((err) => {
        console.error(err);
        setFeatures(defaultFeatures);
      });
  }, []);

  return (
    <section id="features" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary bg-primary/8 px-4 py-2 rounded-full mb-4">
            Platform Features
          </span>
          <h2 className="section-title font-display mb-4">Everything Your ISP Business Needs to Thrive</h2>
          <p className="section-subtitle mx-auto">
            Powerful tools built specifically for ISP operators across East Africa.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {features.map((feature, index) => {
            const IconComp = ICON_MAP[feature.icon] || (LucideIcons as any)[feature.icon] || HelpCircle;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="p-7 rounded-2xl bg-white border border-slate-100 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group"
              >
                <div className="mb-5 p-3.5 bg-primary/8 rounded-2xl w-fit group-hover:bg-primary transition-colors duration-300">
                  <IconComp className="text-primary group-hover:text-white transition-colors duration-300" size={28} />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
