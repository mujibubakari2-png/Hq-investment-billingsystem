import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function getFallbackSettings() {
  return {
    HERO_CONFIG: {
      badgeText: 'Premium Marketplace for East Africa',
      title: 'Premium shopping.',
      subtitle: 'Real products.',
      floatingCards: [
        { icon: 'Smartphone', label: 'Smartphones', price: 'TZS 450,000', color: '#3b82f6', delay: 0 },
        { icon: 'Laptop', label: 'Laptops', price: 'TZS 1,200,000', color: '#10b981', delay: 0.5 },
        { icon: 'Headphones', label: 'Electronics', price: 'TZS 85,000', color: '#f59e0b', delay: 1 },
        { icon: 'Shirt', label: 'Fashion', price: 'TZS 35,000', color: '#8b5cf6', delay: 1.5 },
      ],
      trustItems: [
        { icon: 'Truck', title: 'Same-day dispatch', text: 'Dar es Salaam ready' },
        { icon: 'BadgeCheck', title: 'Verified sellers', text: 'Quality controlled' },
        { icon: 'PackageCheck', title: 'Easy returns', text: 'Buyer protection' },
      ],
    },
    STORE_FEATURES: [
      { icon: 'Zap', title: 'Fast Delivery', description: 'Reliable dispatch and delivery for your orders.' },
      { icon: 'Shield', title: 'Secure Payments', description: 'Protected checkout and trusted payment options.' },
      { icon: 'Star', title: 'Top Quality', description: 'Curated products from verified sellers.' },
    ],
    STATISTICS: {
      products: 500,
      customers: 5000,
      orders: 10000,
      yearsInBusiness: 4,
      brands: 120,
      countries: 12,
      satisfactionRate: 98,
      dailyVisitors: 3000,
    },
  };
}

function mergeSettings(settings: Record<string, unknown>) {
  const fallback = getFallbackSettings();

  const merged = { ...fallback, ...settings };

  if (typeof settings.HERO_CONFIG === 'object' && settings.HERO_CONFIG !== null) {
    merged.HERO_CONFIG = {
      ...fallback.HERO_CONFIG,
      ...(settings.HERO_CONFIG as Record<string, unknown>),
    };
  }

  if (Array.isArray(settings.STORE_FEATURES)) {
    merged.STORE_FEATURES = settings.STORE_FEATURES;
  }

  if (typeof settings.STATISTICS === 'object' && settings.STATISTICS !== null) {
    merged.STATISTICS = {
      ...fallback.STATISTICS,
      ...(settings.STATISTICS as Record<string, unknown>),
    };
  }

  return merged;
}

export async function GET() {
  try {
    const settings = await prisma.storeSetting.findMany();

    const formattedSettings = settings.reduce((acc: Record<string, unknown>, curr: { key: string; value: unknown }) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    return NextResponse.json({ success: true, data: mergeSettings(formattedSettings) });
  } catch (error) {
    console.error('Storefront settings proxy error:', error);
    return NextResponse.json({ success: true, data: getFallbackSettings() });
  }
}
