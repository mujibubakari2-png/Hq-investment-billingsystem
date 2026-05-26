"use client";
import { useEffect, useState } from "react";
import PricingCard from "./PricingCard";

interface SaasPlan {
    id: string;
    name: string;
    price: number;
    clientLimit: number;
}

// ── Feature matrix per tier ─────────────────────────────────────────────────
// These describe what the ISP OPERATOR gets, not their end customers.
// All plans include unlimited Hotspot subscribers and all payment gateways.
// The main differentiator is PPPoE capacity, router count, and support level.

const TIER_FEATURES: Record<
    "starter" | "business" | "enterprise",
    string[]
> = {
    starter: [
        "Unlimited Hotspot subscribers",
        "Up to {limit} PPPoE connections",
        "Full customer management & billing",
        "All payment gateways (M-Pesa, Airtel, Halo, etc.)",
        "SMS & Email payment notifications",
        "Basic billing reports & dashboard",
        "Single router support",
    ],
    business: [
        "Unlimited Hotspot subscribers",
        "Up to {limit} PPPoE connections",
        "Full automated billing & renewals",
        "All payment gateways + API callbacks",
        "Real-time SMS payment alerts",
        "Advanced analytics & financial reports",
        "RADIUS online/offline sync",
        "Multi-router support (up to 5)",
        "Voucher generation system",
    ],
    enterprise: [
        "Unlimited Hotspot subscribers",
        "Up to {limit} PPPoE connections",
        "Everything in Business, plus:",
        "Unlimited routers & WireGuard VPN",
        "Custom hotspot login portal branding",
        "Bulk SMS messaging to clients",
        "Multi-admin & role-based access",
        "Priority technical support",
        "Business intelligence dashboard",
    ],
};

function getTierKey(
    index: number,
    total: number
): keyof typeof TIER_FEATURES {
    if (total <= 1) return "business";
    if (total === 2) return index === 0 ? "starter" : "enterprise";
    // 3+ plans: first = starter, last = enterprise, middle = business
    if (index === 0) return "starter";
    if (index === total - 1) return "enterprise";
    return "business";
}

// Map tier keys to PricingCard tier props
function toCardTier(tier: keyof typeof TIER_FEATURES): "basic" | "standard" | "professional" | "enterprise" {
    switch (tier) {
        case "starter": return "basic";
        case "business": return "standard";
        case "enterprise": return "enterprise";
    }
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
        fetch("/api/saas-plans")
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
                        Pricing Plans
                    </span>
                    <h2 className="text-3xl md:text-5xl font-bold text-primary mb-4">
                        Choose Your Plan
                    </h2>
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
                        {plans.map((plan, index) => {
                            const tier = getTierKey(index, plans.length);
                            return (
                                <PricingCard
                                    key={plan.id}
                                    id={plan.id}
                                    name={plan.name}
                                    price={plan.price.toLocaleString()}
                                    clientLimit={plan.clientLimit}
                                    features={buildFeatures(plan, index, plans.length)}
                                    tier={toCardTier(tier)}
                                    isPopular={index === popularIndex}
                                    delay={index * 0.1}
                                />
                            );
                        })}
                    </div>
                )}


            </div>
        </section>
    );
}
