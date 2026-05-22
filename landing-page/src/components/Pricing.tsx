"use client";
import { useEffect, useState } from "react";
import PricingCard from "./PricingCard";

interface SaasPlan {
    id: string;
    name: string;
    price: number;
    clientLimit: number;
}

// ── Feature matrix per price tier ───────────────────────────────────────────
// Hotspot is UNLIMITED for all plans. PPPoE is limited by clientLimit.
// Plans are sorted ascending by price. Index 0 = cheapest, last = most expensive.

const TIER_FEATURES: Record<
    "basic" | "standard" | "professional" | "enterprise",
    string[]
> = {
    basic: [
        "Unlimited Hotspot subscribers",
        "Up to {limit} PPPoE connections",
        "Full customer management",
        "Mobile payment (M-Pesa & Airtel)",
        "Standard billing reports",
        "Email & SMS payment alerts",
    ],
    standard: [
        "Unlimited Hotspot subscribers",
        "Up to {limit} PPPoE connections",
        "Fully automated billing",
        "Real-time SMS payment alerts",
        "Advanced analytics & reports",
        "Real-time RADIUS online/offline sync",
        "Automated expiry & renewal alerts",
        "Multi-router support (up to 3)",
    ],
    professional: [
        "Unlimited Hotspot subscribers",
        "Up to {limit} PPPoE connections",
        "Full billing & renewal automation",
        "Business intelligence dashboard",
        "All payment channels + API callbacks",
        "Unlimited routers & WireGuard VPN",
        "SMS bulk messaging to clients",
        "Priority technical support",
    ],
    enterprise: [
        "Unlimited Hotspot subscribers",
        "Up to {limit} PPPoE connections",
        "Everything in Professional",
        "API access for custom integrations",
        "Custom branding & white-labelling",
        "Multi-admin & role-based access",
        "SLA uptime guarantee",
        "24/7 dedicated support line",
    ],
};

function getTierKey(
    index: number,
    total: number
): keyof typeof TIER_FEATURES {
    if (total === 1) return "standard";
    const ratio = index / (total - 1);
    if (ratio === 0) return "basic";
    if (ratio <= 0.33) return "standard";
    if (ratio <= 0.66) return "professional";
    return "enterprise";
}

function buildFeatures(plan: SaasPlan, index: number, total: number): string[] {
    const key = getTierKey(index, total);
    return TIER_FEATURES[key].map((f) =>
        f.replace("{limit}", plan.clientLimit.toLocaleString())
    );
}

export default function Pricing() {
    const [plans, setPlans] = useState<SaasPlan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/plans")
            .then((res) => res.json())
            .then((data: SaasPlan[]) =>
                setPlans(Array.isArray(data) ? data : [])
            )
            .catch(() => setPlans([]))
            .finally(() => setLoading(false));
    }, []);

    // Middle plan is "most popular"
    const popularIndex = plans.length > 1 ? Math.floor(plans.length / 2) : 0;

    return (
        <section id="pricing" className="py-20 bg-softBg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <span className="inline-block text-sm font-semibold text-secondary uppercase tracking-widest mb-3">
                        Transparent Pricing
                    </span>
                    <h2 className="text-3xl md:text-5xl font-bold text-primary mb-4">
                        Simple Pricing. Real Value.
                    </h2>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Pick the plan that matches your network size. Upgrade any time as you grow.
                        Every plan includes a <strong>10-day free trial</strong> — no credit card required.
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                    </div>
                ) : plans.length === 0 ? (
                    <div className="text-center text-gray-500 py-16">
                        <p>
                            No plans available at the moment. Please contact
                            support.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 items-start">
                        {plans.map((plan, index) => (
                            <PricingCard
                                key={plan.id}
                                id={plan.id}
                                name={plan.name}
                                price={plan.price.toLocaleString()}
                                clientLimit={plan.clientLimit}
                                features={buildFeatures(plan, index, plans.length)}
                                tier={getTierKey(index, plans.length)}
                                isPopular={index === popularIndex}
                                delay={index * 0.1}
                            />
                        ))}
                    </div>
                )}

                <p className="text-center text-sm text-gray-400 mt-10">
                    🎉 All plans include a <strong>10-day free trial</strong>. After the trial, billing starts automatically based on your chosen plan. No credit card required to start.
                </p>
            </div>
        </section>
    );
}
