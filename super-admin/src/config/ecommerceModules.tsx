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
  owner: string;
  actions: string[];
}

export interface CommerceNavigationItem {
  to: string;
  icon: ReactNode;
  label: string;
  section?: string;
}

export interface CommerceReadinessItem {
  label: string;
  detail: string;
  status: CommerceModuleStatus;
}

export const commerceModules: CommerceModule[] = [
  { slug: 'products', label: 'Products', description: 'Manage product catalogue, pricing, media, variants, and SEO fields.', icon: <Package size={18} />, status: 'Operational', metric: 'Catalog', owner: 'Merchandising', actions: ['Create product', 'Edit pricing', 'Manage media'] },
  { slug: 'categories', label: 'Categories', description: 'Control category trees, landing metadata, icons, and product counts.', icon: <Tags size={18} />, status: 'Operational', metric: 'Navigation', owner: 'Merchandising', actions: ['Reorder categories', 'Edit SEO metadata', 'Feature category'] },
  { slug: 'brands', label: 'Brands', description: 'Create brand pages, logo assets, featured brands, and merchandising rules.', icon: <Shield size={18} />, status: 'Configured', metric: 'Brand hub', owner: 'Content', actions: ['Upload logo', 'Feature brand', 'Edit brand page'] },
  { slug: 'collections', label: 'Collections', description: 'Build seasonal, luxury, electronics, fashion, and campaign shelves.', icon: <Layers size={18} />, status: 'Operational', metric: 'Campaigns', owner: 'Growth', actions: ['Build collection', 'Schedule campaign', 'Attach products'] },
  { slug: 'inventory', label: 'Inventory', description: 'Track stock status, low-stock alerts, SKUs, and availability controls.', icon: <Boxes size={18} />, status: 'Operational', metric: 'Stock', owner: 'Operations', actions: ['Sync stock', 'Set alerts', 'Manage SKU rules'] },
  { slug: 'warehouses', label: 'Warehouses', description: 'Manage warehouse locations, fulfillment zones, and transfer workflows.', icon: <Server size={18} />, status: 'Configured', metric: 'Fulfillment', owner: 'Operations', actions: ['Add warehouse', 'Set zones', 'Plan transfers'] },
  { slug: 'orders', label: 'Orders', description: 'Monitor order lifecycle from pending to delivered, returned, or refunded.', icon: <Receipt size={18} />, status: 'Operational', metric: 'Orders', owner: 'Operations', actions: ['Update status', 'Review payment', 'Manage refund'] },
  { slug: 'customers', label: 'Customers', description: 'View customer profiles, order history, wishlist, and account signals.', icon: <Users size={18} />, status: 'Operational', metric: 'CRM', owner: 'Support', actions: ['Open profile', 'Review history', 'Export segment'] },
  { slug: 'reviews', label: 'Reviews', description: 'Moderate product reviews, Q&A, verified badges, and seller replies.', icon: <Star size={18} />, status: 'Configured', metric: 'Trust', owner: 'Support', actions: ['Approve review', 'Reply to Q&A', 'Flag abuse'] },
  { slug: 'coupons', label: 'Coupons', description: 'Create fixed, percentage, customer-specific, and limited-use coupons.', icon: <BadgePercent size={18} />, status: 'Operational', metric: 'Discounts', owner: 'Growth', actions: ['Create coupon', 'Limit usage', 'Assign customers'] },
  { slug: 'flash-sales', label: 'Flash Sales', description: 'Schedule countdown offers, limited stock, and urgency placements.', icon: <Activity size={18} />, status: 'Operational', metric: 'Conversion', owner: 'Growth', actions: ['Schedule sale', 'Set countdown', 'Allocate stock'] },
  { slug: 'promotions', label: 'Promotions', description: 'Coordinate seasonal, holiday, VIP, referral, and member campaigns.', icon: <Megaphone size={18} />, status: 'Operational', metric: 'Growth', owner: 'Growth', actions: ['Launch promo', 'Target segment', 'Track uplift'] },
  { slug: 'banners', label: 'Banners', description: 'Control homepage banners, hero offers, campaign artwork, and CTAs.', icon: <Image size={18} />, status: 'Operational', metric: 'CMS', owner: 'Content', actions: ['Upload banner', 'Schedule hero', 'Set CTA'] },
  { slug: 'cms', label: 'CMS', description: 'Manage reusable homepage sections, marketing copy, and trust content.', icon: <Settings size={18} />, status: 'Configured', metric: 'Content', owner: 'Content', actions: ['Edit section', 'Publish FAQ', 'Update trust copy'] },
  { slug: 'blog', label: 'Blog', description: 'Publish buying guides, launch stories, SEO posts, and editorial content.', icon: <FileText size={18} />, status: 'Configured', metric: 'SEO', owner: 'Content', actions: ['Draft post', 'Optimize SEO', 'Schedule publish'] },
  { slug: 'pages', label: 'Pages', description: 'Create policy pages, FAQs, landing pages, and legal content.', icon: <FileText size={18} />, status: 'Configured', metric: 'Pages', owner: 'Content', actions: ['Edit policy', 'Publish page', 'Review legal'] },
  { slug: 'menus', label: 'Menus', description: 'Configure header navigation, mega menu groups, and footer links.', icon: <Menu size={18} />, status: 'Operational', metric: 'Navigation', owner: 'Content', actions: ['Edit menu', 'Group links', 'Preview mobile'] },
  { slug: 'media-library', label: 'Media Library', description: 'Organize product imagery, banners, documents, and brand assets.', icon: <Image size={18} />, status: 'Operational', metric: 'Assets', owner: 'Content', actions: ['Upload asset', 'Tag media', 'Audit alt text'] },
  { slug: 'shipping', label: 'Shipping', description: 'Set couriers, pickup points, shipping rules, and delivery estimates.', icon: <Truck size={18} />, status: 'Integration Required', metric: 'Delivery', owner: 'Operations', actions: ['Add courier', 'Set rates', 'Configure pickup'] },
  { slug: 'taxes', label: 'Taxes', description: 'Manage tax classes, regional rules, VAT settings, and invoice visibility.', icon: <Building2 size={18} />, status: 'Configured', metric: 'Compliance', owner: 'Finance', actions: ['Set VAT', 'Map region', 'Review invoices'] },
  { slug: 'payments', label: 'Payments', description: 'Configure mobile money, PayPal, bank transfer, cards, and webhooks.', icon: <CreditCard size={18} />, status: 'Operational', metric: 'Checkout', owner: 'Finance', actions: ['Enable provider', 'Test webhook', 'Review failures'] },
  { slug: 'analytics', label: 'Analytics', description: 'Track product views, cart adds, checkout starts, and conversion funnels.', icon: <BarChart3 size={18} />, status: 'Configured', metric: 'Insights', owner: 'Growth', actions: ['Review funnel', 'Export events', 'Connect pixel'] },
  { slug: 'reports', label: 'Reports', description: 'Export sales, stock, revenue, customers, promotions, and tax reports.', icon: <FileText size={18} />, status: 'Configured', metric: 'Exports', owner: 'Finance', actions: ['Export CSV', 'Schedule report', 'Audit revenue'] },
  { slug: 'settings', label: 'Settings', description: 'Set currencies, locales, store policies, SEO defaults, and automation.', icon: <Settings size={18} />, status: 'Integration Required', metric: 'Control', owner: 'Platform', actions: ['Set currency', 'Update policy', 'Configure SEO'] },
  { slug: 'developer', label: 'Developer & API Keys', description: 'Centralize commerce API keys, webhook signing, SDK access, and integration health.', icon: <KeyRound size={18} />, status: 'Operational', metric: 'Integrations', owner: 'Engineering', actions: ['Rotate key', 'Copy webhook secret', 'Check SDK health'] },
];

export const commerceReadinessItems: CommerceReadinessItem[] = [
  { label: 'Landing page control', detail: 'Hero, banners, collections, product shelves, FAQs, testimonials, and trust content are mapped to commerce modules.', status: 'Operational' },
  { label: 'Customer shopping flow', detail: 'Catalogue, search, wishlist, compare, cart, recently viewed, checkout, payments, and tracking links are covered.', status: 'Operational' },
  { label: 'Order and payment operations', detail: 'Order lifecycle, payment providers, retries, refunds, coupons, and audit logs have admin ownership.', status: 'Configured' },
  { label: 'External integrations', detail: 'Courier, warehouse sync, pixels, SMS, and advanced provider webhooks remain integration work.', status: 'Integration Required' },
];

export const commerceNavigationItems: CommerceNavigationItem[] = [
  { section: 'E-Commerce', to: '/ecommerce', icon: <ShoppingBag size={16} />, label: 'Dashboard' },
  ...commerceModules.map((item) => ({
    to: `/ecommerce/${item.slug}`,
    icon: item.icon,
    label: item.label,
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
