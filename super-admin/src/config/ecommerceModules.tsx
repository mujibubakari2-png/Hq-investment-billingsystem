import type { ReactNode } from 'react';
import {
  Activity,
  BadgePercent,
  BarChart3,
  Boxes,
  Building2,
  CreditCard,
  FileText,
  Image,
  KeyRound,
  Layers,
  Megaphone,
  Menu,
  Package,
  Receipt,
  Search,
  Server,
  Settings,
  Shield,
  ShoppingBag,
  Star,
  Tags,
  Truck,
  Users,
} from 'lucide-react';

export type CommerceModuleStatus = 'Operational' | 'Configured' | 'Integration Required';

export interface CommerceModule {
  slug: string;
  label: string;
  description: string;
  icon: ReactNode;
  status: CommerceModuleStatus;
  metric: string;
}

export interface CommerceNavigationItem {
  to: string;
  icon: ReactNode;
  label: string;
  section?: string;
}

export const commerceModules: CommerceModule[] = [
  { slug: 'products', label: 'Products', description: 'Manage product catalogue, pricing, media, variants, and SEO fields.', icon: <Package size={18} />, status: 'Operational', metric: 'Catalog' },
  { slug: 'categories', label: 'Categories', description: 'Control category trees, landing metadata, icons, and product counts.', icon: <Tags size={18} />, status: 'Operational', metric: 'Navigation' },
  { slug: 'brands', label: 'Brands', description: 'Create brand pages, logo assets, featured brands, and merchandising rules.', icon: <Shield size={18} />, status: 'Configured', metric: 'Brand hub' },
  { slug: 'collections', label: 'Collections', description: 'Build seasonal, luxury, electronics, fashion, and campaign shelves.', icon: <Layers size={18} />, status: 'Operational', metric: 'Campaigns' },
  { slug: 'inventory', label: 'Inventory', description: 'Track stock status, low-stock alerts, SKUs, and availability controls.', icon: <Boxes size={18} />, status: 'Integration Required', metric: 'Stock' },
  { slug: 'warehouses', label: 'Warehouses', description: 'Manage warehouse locations, fulfillment zones, and transfer workflows.', icon: <Server size={18} />, status: 'Configured', metric: 'Fulfillment' },
  { slug: 'orders', label: 'Orders', description: 'Monitor order lifecycle from pending to delivered, returned, or refunded.', icon: <Receipt size={18} />, status: 'Operational', metric: 'Orders' },
  { slug: 'customers', label: 'Customers', description: 'View customer profiles, order history, wishlist, and account signals.', icon: <Users size={18} />, status: 'Operational', metric: 'CRM' },
  { slug: 'reviews', label: 'Reviews', description: 'Moderate product reviews, Q&A, verified badges, and seller replies.', icon: <Star size={18} />, status: 'Configured', metric: 'Trust' },
  { slug: 'coupons', label: 'Coupons', description: 'Create fixed, percentage, customer-specific, and limited-use coupons.', icon: <BadgePercent size={18} />, status: 'Operational', metric: 'Discounts' },
  { slug: 'flash-sales', label: 'Flash Sales', description: 'Schedule countdown offers, limited stock, and urgency placements.', icon: <Activity size={18} />, status: 'Operational', metric: 'Conversion' },
  { slug: 'promotions', label: 'Promotions', description: 'Coordinate seasonal, holiday, VIP, referral, and member campaigns.', icon: <Megaphone size={18} />, status: 'Operational', metric: 'Growth' },
  { slug: 'banners', label: 'Banners', description: 'Control homepage banners, hero offers, campaign artwork, and CTAs.', icon: <Image size={18} />, status: 'Operational', metric: 'CMS' },
  { slug: 'cms', label: 'CMS', description: 'Manage reusable homepage sections, marketing copy, and trust content.', icon: <Settings size={18} />, status: 'Configured', metric: 'Content' },
  { slug: 'blog', label: 'Blog', description: 'Publish buying guides, launch stories, SEO posts, and editorial content.', icon: <FileText size={18} />, status: 'Configured', metric: 'SEO' },
  { slug: 'pages', label: 'Pages', description: 'Create policy pages, FAQs, landing pages, and legal content.', icon: <FileText size={18} />, status: 'Configured', metric: 'Pages' },
  { slug: 'menus', label: 'Menus', description: 'Configure header navigation, mega menu groups, and footer links.', icon: <Menu size={18} />, status: 'Integration Required', metric: 'Navigation' },
  { slug: 'media-library', label: 'Media Library', description: 'Organize product imagery, banners, documents, and brand assets.', icon: <Image size={18} />, status: 'Configured', metric: 'Assets' },
  { slug: 'shipping', label: 'Shipping', description: 'Set couriers, pickup points, shipping rules, and delivery estimates.', icon: <Truck size={18} />, status: 'Integration Required', metric: 'Delivery' },
  { slug: 'taxes', label: 'Taxes', description: 'Manage tax classes, regional rules, VAT settings, and invoice visibility.', icon: <Building2 size={18} />, status: 'Configured', metric: 'Compliance' },
  { slug: 'payments', label: 'Payments', description: 'Configure mobile money, PayPal, bank transfer, cards, and webhooks.', icon: <CreditCard size={18} />, status: 'Operational', metric: 'Checkout' },
  { slug: 'analytics', label: 'Analytics', description: 'Track product views, cart adds, checkout starts, and conversion funnels.', icon: <BarChart3 size={18} />, status: 'Configured', metric: 'Insights' },
  { slug: 'reports', label: 'Reports', description: 'Export sales, stock, revenue, customers, promotions, and tax reports.', icon: <FileText size={18} />, status: 'Configured', metric: 'Exports' },
  { slug: 'settings', label: 'Settings', description: 'Set currencies, locales, store policies, SEO defaults, and automation.', icon: <Settings size={18} />, status: 'Integration Required', metric: 'Control' },
  { slug: 'api-keys', label: 'API Keys', description: 'Manage commerce API keys, webhook secrets, and integration access.', icon: <KeyRound size={18} />, status: 'Integration Required', metric: 'Developer' },
  { slug: 'developer', label: 'Developer', description: 'Centralize commerce API keys, webhook signing, SDK access, and integration health.', icon: <KeyRound size={18} />, status: 'Integration Required', metric: 'Integrations' },
];

export const commerceNavigationItems: CommerceNavigationItem[] = [
  { section: 'E-Commerce', to: '/ecommerce', icon: <ShoppingBag size={16} />, label: 'Dashboard' },
  ...commerceModules.map((item) => ({
    to: `/ecommerce/${item.slug}`,
    icon: item.icon,
    label: item.slug === 'developer' ? 'Commerce API Keys' : item.label,
    section: item.slug === 'developer' ? 'Developer' : undefined,
  })),
];

export const commerceStatusClass: Record<CommerceModuleStatus, string> = {
  Operational: 'sa-ecom-status-ready',
  Configured: 'sa-ecom-status-planned',
  'Integration Required': 'sa-ecom-status-setup',
};

export function matchesCommerceModule(module: CommerceModule, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [module.label, module.description, module.metric, module.status]
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}
