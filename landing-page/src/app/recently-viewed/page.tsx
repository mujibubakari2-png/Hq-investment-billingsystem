"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SavedProductsGrid from "@/components/shop/SavedProductsGrid";
import { useCommerce } from "@/lib/commerce";

export default function RecentlyViewedPage() {
  const { recentlyViewed, clearRecentlyViewed } = useCommerce();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 pt-28">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-sm font-bold uppercase tracking-widest text-primary">Continue shopping</span>
              <h1 className="font-display text-3xl font-extrabold text-slate-950 mt-2">Recently Viewed</h1>
              <p className="text-slate-500 mt-2">Products you inspected most recently are kept here on this device.</p>
            </div>
            {recentlyViewed.length > 0 && (
              <button onClick={clearRecentlyViewed} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:border-rose-200 hover:text-rose-500">
                Clear History
              </button>
            )}
          </div>

          <SavedProductsGrid
            products={recentlyViewed}
            emptyTitle="No recently viewed products yet"
            emptyText="Open a product detail page and it will appear here so customers can continue shopping."
            removeLabel="Remove"
          />
        </section>
      </main>
      <Footer />
    </>
  );
}
