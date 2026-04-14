"use client";
import { motion } from "framer-motion";
import { Zap, Users, CreditCard, BarChart3, ShieldCheck, Router } from "lucide-react";

const features = [
  {
    title: "Zero Billing Errors",
    description: "Invoices are generated and dispatched automatically on schedule — no manual entry, no missed payments, no angry customers.",
    icon: <Zap className="text-secondary" size={32} />,
  },
  {
    title: "Complete Subscriber Control",
    description: "View every subscriber's plan, payment history, and connection status in one clean dashboard — from onboarding to renewal.",
    icon: <Users className="text-secondary" size={32} />,
  },
  {
    title: "Real-Time Payment Tracking",
    description: "Know the moment a payment lands. Instantly reconcile M-Pesa, voucher, and bank transactions without lifting a finger.",
    icon: <CreditCard className="text-secondary" size={32} />,
  },
  {
    title: "Business Intelligence Reports",
    description: "Spot your most profitable plans, track churn, and identify growth trends with reports built for ISP operators.",
    icon: <BarChart3 className="text-secondary" size={32} />,
  },
  {
    title: "Enterprise-Grade Security",
    description: "Bank-level data encryption, role-based access control, and audit logs keep your business and your customers safe.",
    icon: <ShieldCheck className="text-secondary" size={32} />,
  },
  {
    title: "Hotspot & PPPoE — One Platform",
    description: "Manage WiFi vouchers and wired PPPoE clients from a single dashboard. No more juggling multiple tools.",
    icon: <Router className="text-secondary" size={32} />,
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-primary mb-4">Everything Your ISP Needs to Thrive</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Six powerful modules. One platform. No more spreadsheets or missed payments.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="p-8 rounded-2xl bg-softBg hover:shadow-xl hover:-translate-y-2 transition-all group"
            >
              <div className="mb-6 p-4 bg-white rounded-2xl w-fit shadow-sm group-hover:bg-primary transition-colors">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-primary mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
