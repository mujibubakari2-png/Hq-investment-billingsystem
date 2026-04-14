import PricingCard from "./PricingCard";

const plans = [
  {
    name: "Starter",
    price: "15,000",
    features: [
      "Unlimited Hotspot subscribers",
      "Up to 250 PPPoE connections",
      "Full customer management",
      "Standard billing reports",
    ],
    isPopular: false,
  },
  {
    name: "Growth",
    price: "50,000",
    features: [
      "Unlimited Hotspot subscribers",
      "Up to 500 PPPoE connections",
      "Fully automated billing",
      "Real-time SMS payment alerts",
      "Advanced analytics & reports",
    ],
    isPopular: true,
  },
  {
    name: "Scale",
    price: "100,000",
    features: [
      "Unlimited Hotspot subscribers",
      "Up to 1,000 PPPoE connections",
      "Full billing & renewal automation",
      "Business intelligence dashboard",
      "API access for custom integrations",
    ],
    isPopular: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 bg-softBg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-primary mb-4">Simple Pricing. Real Value.</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Pick the plan that matches your network size. Upgrade any time as you grow.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {plans.map((plan, index) => (
            <PricingCard key={index} {...plan} delay={index * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
}
