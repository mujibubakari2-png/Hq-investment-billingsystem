"use client";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface PricingCardProps {
  name: string;
  price: string;
  features: string[];
  isPopular?: boolean;
  delay?: number;
}

export default function PricingCard({ name, price, features, isPopular, delay = 0 }: PricingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      viewport={{ once: true }}
      className={`relative p-8 rounded-3xl bg-white shadow-lg flex flex-col items-center text-center transition-all ${
        isPopular ? "border-4 border-secondary scale-105 z-10" : "hover:scale-105"
      }`}
    >
      {isPopular && (
        <span className="absolute -top-4 bg-secondary text-white px-6 py-1 rounded-full text-sm font-bold uppercase tracking-wider">
          Most Popular
        </span>
      )}
      <h3 className="text-2xl font-bold text-primary mb-2">{name}</h3>
      <div className="flex items-baseline mb-6">
        <span className="text-4xl font-extrabold text-primary">Tsh {price}</span>
        <span className="text-gray-500 ml-1">/month</span>
      </div>
      <ul className="space-y-4 mb-10 w-full">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center text-gray-700 text-left">
            <Check size={20} className="text-secondary mr-3 flex-shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <a
        href={`${process.env.NEXT_PUBLIC_BILLING_SYSTEM_URL}/register?plan=${encodeURIComponent(name)}`}
        className={`w-full py-4 rounded-xl text-lg font-bold transition-all text-center ${
          isPopular
            ? "bg-secondary text-white hover:bg-primary shadow-lg"
            : "bg-softBg text-primary border-2 border-primary hover:bg-primary hover:text-white"
        }`}
      >
        Get Started
      </a>
    </motion.div>
  );
}
