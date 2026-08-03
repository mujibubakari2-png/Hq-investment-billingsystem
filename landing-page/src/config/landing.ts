import {
  BadgeCheck,
  Banknote,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Globe2,
  HeartHandshake,
  MapPin,
  PackageCheck,
  QrCode,
  Smartphone,
  Star,
  Store,
  Tags,
  Truck,
  UserRound,
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

export interface LandingJourneyStep {
  icon: LucideIcon;
  title: string;
  text: string;
  href: string;
  cta: string;
}

export interface LandingControlArea {
  title: string;
  text: string;
  status: "Live" | "Configurable" | "Ready";
}

export const landingCollections: LandingCollection[] = [
  {
    name: "Electronics",
    detail: "Phones, laptops, audio, and smart devices",
    href: "/products?category=electronics",
    accent: "from-blue-500 to-cyan-400",
  },
  {
    name: "Fashion",
    detail: "Daily fits, premium sneakers, watches, and bags",
    href: "/products?category=fashion",
    accent: "from-rose-500 to-orange-400",
  },
  {
    name: "Home & Living",
    detail: "Appliances, decor, kitchen, and workspace upgrades",
    href: "/products?category=home-living",
    accent: "from-emerald-500 to-teal-400",
  },
  {
    name: "Luxury Picks",
    detail: "Curated high-value products from trusted sellers",
    href: "/products?minPrice=1000000&sort=price-desc",
    accent: "from-violet-500 to-fuchsia-400",
  },
];

export const landingDealProducts: LandingDealProduct[] = [
  { name: "Samsung Galaxy A55", price: "TZS 750,000", oldPrice: "TZS 890,000", stock: 72 },
  { name: "HP EliteBook Core i7", price: "TZS 1,450,000", oldPrice: "TZS 1,720,000", stock: 38 },
  { name: "Nike Air Max", price: "TZS 165,000", oldPrice: "TZS 220,000", stock: 54 },
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

export const landingPriceBands = [
  { name: "Budget", detail: "Smart picks under TZS 50,000", href: "/products?maxPrice=50000" },
  { name: "Standard", detail: "Quality picks TZS 50k–300k", href: "/products?minPrice=50000&maxPrice=300000" },
  { name: "Premium", detail: "Higher-end TZS 300k–1M", href: "/products?minPrice=300000&maxPrice=1000000" },
  { name: "Luxury", detail: "Statement pieces above TZS 1M", href: "/products?minPrice=1000000&sort=price-desc" },
];

export const landingStyleCollections = [
  { label: "Office", href: "/products?search=office" },
  { label: "Outdoor", href: "/products?search=outdoor" },
  { label: "Travel", href: "/products?search=travel" },
  { label: "Gaming", href: "/products?search=gaming" },
  { label: "Minimalist", href: "/products?search=minimalist" },
  { label: "Luxury", href: "/products?minPrice=1000000&sort=price-desc" },
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
  discovery: { icon: Store, title: "Shop by lifestyle" },
  social: { icon: Smartphone, title: "Social commerce" },
  checklist: CheckCircle2,
};

export const landingJourneySteps: LandingJourneyStep[] = [
  {
    icon: Store,
    title: "Discover",
    text: "Search, category filters, curated collections, deals, and SEO-friendly product pages help customers find the right product fast.",
    href: "/products",
    cta: "Browse products",
  },
  {
    icon: Tags,
    title: "Compare and save",
    text: "Wishlist, compare, recently viewed, quick view, reviews, stock signals, and share links support confident buying decisions.",
    href: "/compare",
    cta: "Compare items",
  },
  {
    icon: CreditCard,
    title: "Checkout",
    text: "Persistent cart, cart drawer, quantity validation, mobile money, PayPal, coupons, and secure payment messaging are ready for conversion.",
    href: "/cart",
    cta: "Open cart",
  },
  {
    icon: ClipboardCheck,
    title: "After purchase",
    text: "Order confirmation, customer support, delivery tracking architecture, refunds, warranty messaging, and account handoff are represented.",
    href: "/track-order",
    cta: "Track order",
  },
];

export const landingAdminControlAreas: LandingControlArea[] = [
  { title: "Homepage merchandising", text: "Hero content, promo banners, featured shelves, collections, flash sales, testimonials, FAQs, and trust copy.", status: "Configurable" },
  { title: "Catalogue operations", text: "Products, categories, pricing, SEO fields, stock visibility, badges, reviews, and campaign placement.", status: "Live" },
  { title: "Checkout operations", text: "Payment providers, coupons, order notes, delivery messaging, tax readiness, and audit-friendly payment flows.", status: "Ready" },
  { title: "Growth and analytics", text: "Product impressions, cart events, checkout starts, conversion funnels, pixels, and reporting exports.", status: "Configurable" },
];

