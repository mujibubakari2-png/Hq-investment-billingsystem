"use client";

import Link from "next/link";
import SavedProductsGrid from "@/components/shop/SavedProductsGrid";
import { useCommerce } from "@/lib/commerce";

export default function RecentlyViewedSection() {
  const { recentlyViewed } = useCommerce();

  if (recentlyViewed.length === 0) return null;

  return (
    <section className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-widest text-primary">Continue shopping</span>
            <h2 className="section-title mt-2">Recently Viewed</h2>
            <p className="text-slate-500 mt-2">Pick up where you left off.</p>
          </div>
          <Link href="/recently-viewed" className="text-sm font-bold text-primary">
            View History
          </Link>
        </div>
        <SavedProductsGrid
          products={recentlyViewed.slice(0, 4)}
          emptyTitle=""
          emptyText=""
          removeLabel="Remove"
        />
      </div>
    </section>
  );
}
