import PricingCard from "./PricingCard";

const plans = [
  {
    name: "Basic Plan",
    price: "15,000",
    features: [
      "Unlimited Hotspot Users",
      "Up to 250 PPPoE users",
      "Customer management",
      "Basic reports",
    ],
    isPopular: false,
  },
  {
    name: "Prime Plan",
    price: "50,000",
    features: [
      "Unlimited Hotspot Users",
      "Up to 500 PPPoE users",
      "Automated billing",
      "SMS alerts",
      "Advanced reports",
    ],
    isPopular: true,
  },
  {
    name: "Gold Plan",
    price: "100,000",
    features: [
      "Unlimited Hotspot Users",
      "Up to 1000 PPPoE users",
      "Full automation",
      "Analytics dashboard",
      "API access",
    ],
    isPopular: false,
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 bg-softBg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-primary mb-4">Choose Your Plan</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Flexible pricing options to scale with your ISP business.
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
