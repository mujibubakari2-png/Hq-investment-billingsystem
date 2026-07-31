"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SavedProductsGrid from "@/components/shop/SavedProductsGrid";
import { useCommerce } from "@/lib/commerce";

export default function WishlistPage() {
  const { wishlist, removeWishlist, clearWishlist } = useCommerce();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 pt-28">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-sm font-bold uppercase tracking-widest text-primary">Saved products</span>
              <h1 className="font-display text-3xl font-extrabold text-slate-950 mt-2">Wishlist</h1>
              <p className="text-slate-500 mt-2">Keep products for later, watch prices, and move quickly when stock is low.</p>
            </div>
            {wishlist.length > 0 && (
              <button onClick={clearWishlist} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:border-rose-200 hover:text-rose-500">
                Clear Wishlist
              </button>
            )}
          </div>

          <SavedProductsGrid
            products={wishlist}
            emptyTitle="Your wishlist is empty"
            emptyText="Tap the heart on a product to save it here. Your wishlist stays on this device for guest shopping."
            removeLabel="Remove from wishlist"
            onRemove={removeWishlist}
          />
        </section>
      </main>
      <Footer />
    </>
  );
}
