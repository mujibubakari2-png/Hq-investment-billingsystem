"use client";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 bg-gradient-to-br from-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-6xl font-extrabold text-primary mb-6"
        >
          Stop Chasing Payments. <span className="text-secondary">Start Running Your ISP.</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg md:text-xl text-gray-600 mb-10 max-w-3xl mx-auto"
        >
          HQInvestment automates billing, tracks every shilling, and keeps your Hotspot and PPPoE subscribers connected — so you can focus on growing your network, not chasing invoices.
        </motion.p>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4"
        >
          <a 
            href={`${process.env.NEXT_PUBLIC_BILLING_SYSTEM_URL}/register`}
            className="w-full sm:w-auto bg-primary text-white px-10 py-4 rounded-full text-lg font-bold shadow-lg hover:bg-accent hover:-translate-y-1 transition-all text-center"
          >
            Start Free Trial
          </a>
          <a href="#features" className="w-full sm:w-auto bg-white text-primary border-2 border-primary px-10 py-4 rounded-full text-lg font-bold hover:bg-blue-50 transition-all text-center">
            See How It Works
          </a>
        </motion.div>
      </div>
    </section>
  );
}
