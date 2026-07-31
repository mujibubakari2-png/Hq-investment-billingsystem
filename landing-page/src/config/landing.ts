import {
  BadgeCheck,
  Banknote,
  BookOpen,
  Boxes,
  Building2,
  CheckCircle2,
  CreditCard,
  Gift,
  Globe2,
  HeartHandshake,
  MapPin,
  PackageCheck,
  QrCode,
  ShieldCheck,
  Smartphone,
  Star,
  Store,
  Truck,
  type LucideIcon,
} from "lucide-react";

export interface LandingCollection {
  name: string;
  detail: string;
  href: string;
  accent: string;
}

export interface LandingDealProduct {
  name: string;
  price: string;
  oldPrice: string;
  stock: number;
}

export interface LandingIconBlock {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface LandingMetric {
  label: string;
  value: string;
  icon: LucideIcon;
}

export const landingCollections: LandingCollection[] = [
  {
    name: "Electronics",
    detail: "Phones, laptops, audio, and smart devices",
    href: "/products?collection=electronics",
    accent: "from-blue-500 to-cyan-400",
  },
  {
    name: "Fashion",
    detail: "Daily fits, premium sneakers, watches, and bags",
    href: "/products?collection=fashion",
    accent: "from-rose-500 to-orange-400",
  },
  {
    name: "Home & Living",
    detail: "Appliances, decor, kitchen, and workspace upgrades",
    href: "/products?collection=home",
    accent: "from-emerald-500 to-teal-400",
  },
  {
    name: "Luxury Picks",
    detail: "Curated high-value products from trusted sellers",
    href: "/products?collection=luxury",
    accent: "from-violet-500 to-fuchsia-400",
  },
];

export const landingDealProducts: LandingDealProduct[] = [
  { name: "Samsung Galaxy A55", price: "TZS 750,000", oldPrice: "TZS 890,000", stock: 72 },
  { name: "HP EliteBook Core i7", price: "TZS 1,450,000", oldPrice: "TZS 1,720,000", stock: 38 },
  { name: "Nike Air Max", price: "TZS 165,000", oldPrice: "TZS 220,000", stock: 54 },
];

export const landingOperations: LandingIconBlock[] = [
  { icon: Boxes, title: "Inventory-ready", text: "Stock states, warehouses, SKU control, and low-stock signals." },
  { icon: Gift, title: "Campaign-ready", text: "Banners, flash sales, coupons, collections, and dynamic promos." },
  { icon: ShieldCheck, title: "Trust-first checkout", text: "Secure payments, audit-friendly flows, returns, and order tracking." },
  { icon: Truck, title: "Delivery focused", text: "Shipping methods, delivery estimates, pickup options, and courier support." },
];

export const landingTrustMetrics: LandingMetric[] = [
  { label: "Customer satisfaction", value: "98%", icon: Star },
  { label: "Verified products", value: "10k+", icon: BadgeCheck },
  { label: "Supported regions", value: "12", icon: Globe2 },
  { label: "Payment options", value: "8+", icon: Banknote },
];

export const landingTrustBlocks: LandingIconBlock[] = [
  { icon: Truck, title: "Delivery and tracking", text: "Free-shipping thresholds, courier estimates, pickup options, and order tracking paths." },
  { icon: PackageCheck, title: "Returns and warranty", text: "Warranty signals, simple return policy messaging, and refund-ready workflows." },
  { icon: CreditCard, title: "Payment flexibility", text: "Cards, wallets, PayPal, bank transfer, mobile money, and future provider slots." },
  { icon: HeartHandshake, title: "After-sale support", text: "Live chat, support center, product Q&A, and customer account notifications." },
];

export const landingPaymentMethods = [
  "Visa",
  "Mastercard",
  "PayPal",
  "Apple Pay",
  "Google Pay",
  "Mobile Money",
  "Bank Transfer",
  "Cash on Delivery",
];

export const landingPriceBands = [
  { name: "Budget", detail: "Smart picks under everyday budgets", href: "/products?maxPrice=100000" },
  { name: "Standard", detail: "Balanced quality and price", href: "/products?minPrice=100000&maxPrice=500000" },
  { name: "Premium", detail: "Higher-end products and warranties", href: "/products?minPrice=500000" },
  { name: "Luxury", detail: "Curated statement pieces", href: "/products?collection=luxury" },
];

export const landingStyleCollections = [
  "Office",
  "Outdoor",
  "Travel",
  "Gaming",
  "Minimalist",
  "Luxury",
];

export const landingSocialPosts = [
  { title: "Workspace upgrades", tag: "Office", color: "from-blue-500 to-cyan-400" },
  { title: "Weekend essentials", tag: "Travel", color: "from-emerald-500 to-teal-400" },
  { title: "Daily streetwear", tag: "Fashion", color: "from-rose-500 to-orange-400" },
  { title: "Smart home setup", tag: "Home", color: "from-violet-500 to-indigo-400" },
];

export const landingBuyingGuides = [
  { title: "How to choose a laptop for business teams", href: "/blog/business-laptop-guide" },
  { title: "Mobile money checkout safety checklist", href: "/blog/mobile-money-safety" },
  { title: "What to inspect before buying electronics online", href: "/blog/electronics-buying-guide" },
];

export const landingExperienceCards = {
  mobileApp: { icon: QrCode, title: "Mobile app ready" },
  locations: { icon: MapPin, title: "Store locations and partners" },
  guides: { icon: BookOpen, title: "Buying guides" },
  certification: { icon: Building2, title: "Certifications and enterprise readiness" },
  discovery: { icon: Store, title: "Shop by lifestyle" },
  social: { icon: Smartphone, title: "Social commerce" },
  checklist: CheckCircle2,
};
