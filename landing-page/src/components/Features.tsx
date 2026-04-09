"use client";
import { motion } from "framer-motion";
import { Zap, Users, CreditCard, BarChart3, ShieldCheck, Router } from "lucide-react";

const features = [
  {
    title: "Automated Billing",
    description: "Generate and send invoices automatically. No more manual billing errors.",
    icon: <Zap className="text-secondary" size={32} />,
  },
  {
    title: "Customer Management",
    description: "Keep track of all your internet subscribers and their subscription history.",
    icon: <Users className="text-secondary" size={32} />,
  },
  {
    title: "Payment Tracking",
    description: "Real-time updates on payments and pending transactions.",
    icon: <CreditCard className="text-secondary" size={32} />,
  },
  {
    title: "Reports & Analytics",
    description: "Detailed insights into your business growth and network usage.",
    icon: <BarChart3 className="text-secondary" size={32} />,
  },
  {
    title: "Secure System",
    description: "Enterprise-grade security for your data and your customers.",
    icon: <ShieldCheck className="text-secondary" size={32} />,
  },
  {
    title: "PPPoE & Hotspot Support",
    description: "Full integration for both service types in a single dashboard.",
    icon: <Router className="text-secondary" size={32} />,
  },
];

export default function Features() {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-primary mb-4">Powerful Features</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to run your ISP business efficiently and profitably.
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
