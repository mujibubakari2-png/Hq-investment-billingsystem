"use client";
import { motion } from "framer-motion";
import { Check, Zap, Star, Shield, Crown } from "lucide-react";

interface PricingCardProps {
    id: string;
    name: string;
    price: string;
    clientLimit: number;
    features: string[];
    tier: "basic" | "standard" | "professional" | "enterprise";
    isPopular?: boolean;
    delay?: number;
}

const TIER_CONFIG = {
    basic: {
        label: "Starter",
        icon: Zap,
        gradient: "from-slate-100 to-slate-50",
        accent: "#64748b",
        badge: "bg-slate-100 text-slate-600",
        btn: "bg-slate-800 text-white hover:bg-slate-700",
    },
    standard: {
        label: "Standard",
        icon: Star,
        gradient: "from-sky-50 to-white",
        accent: "#0ea5e9",
        badge: "bg-sky-100 text-sky-700",
        btn: "bg-sky-500 text-white hover:bg-sky-600",
    },
    professional: {
        label: "Professional",
        icon: Shield,
        gradient: "from-violet-50 to-white",
        accent: "#7c3aed",
        badge: "bg-violet-100 text-violet-700",
        btn: "bg-violet-600 text-white hover:bg-violet-700",
    },
    enterprise: {
        label: "Enterprise",
        icon: Crown,
        gradient: "from-amber-50 to-white",
        accent: "#d97706",
        badge: "bg-amber-100 text-amber-700",
        btn: "bg-amber-500 text-white hover:bg-amber-600",
    },
} as const;

export default function PricingCard({
    id,
    name,
    price,
    features,
    tier,
    isPopular,
    delay = 0,
}: PricingCardProps) {
    const billingUrl = process.env.NEXT_PUBLIC_BILLING_SYSTEM_URL || "";
    const cfg = TIER_CONFIG[tier];
    const TierIcon = cfg.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            viewport={{ once: true }}
            className={`relative rounded-3xl bg-gradient-to-br ${cfg.gradient} shadow-lg flex flex-col border ${
                isPopular
                    ? "border-2 ring-2 ring-offset-2 scale-[1.03] z-10"
                    : "border-gray-200 hover:scale-[1.02]"
            } transition-transform duration-300`}
            style={isPopular ? { borderColor: cfg.accent, ringColor: cfg.accent } as React.CSSProperties : {}}
        >
            {/* Popular Badge */}
            {isPopular && (
                <div
                    className="absolute -top-4 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-5 py-1 rounded-full shadow"
                    style={{ background: cfg.accent }}
                >
                    ⭐ Most Popular
                </div>
            )}

            {/* Card Header */}
            <div className="p-7 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: cfg.accent + "22" }}
                    >
                        <TierIcon size={20} style={{ color: cfg.accent }} />
                    </div>
                    <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide ${cfg.badge}`}
                    >
                        {cfg.label}
                    </span>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-1">{name}</h3>

                <div className="flex items-baseline gap-1 mt-3">
                    <span className="text-3xl font-extrabold text-gray-900">
                        Tsh {price}
                    </span>
                    <span className="text-gray-400 text-sm">/month</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                    Billed monthly • Cancel anytime
                </p>
            </div>

            {/* Divider */}
            <div className="mx-7 h-px bg-gray-100" />

            {/* Feature List */}
            <div className="p-7 flex-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                    What&apos;s included
                </p>
                <ul className="space-y-3">
                    {features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                            <span
                                className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ background: cfg.accent + "22" }}
                            >
                                <Check size={12} style={{ color: cfg.accent }} />
                            </span>
                            <span className="text-sm text-gray-600">
                                {feature}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* CTA Button */}
            <div className="p-7 pt-0">
                <a
                    href={`${billingUrl}/register?planId=${encodeURIComponent(id)}&plan=${encodeURIComponent(name)}`}
                    className={`block w-full text-center py-3.5 rounded-xl font-semibold text-sm transition-all shadow-sm ${cfg.btn}`}
                >
                    Get Started with {name} →
                </a>
                <p className="text-center text-xs text-gray-400 mt-3">
                    No setup fees · Free 7-day trial
                </p>
            </div>
        </motion.div>
    );
}
