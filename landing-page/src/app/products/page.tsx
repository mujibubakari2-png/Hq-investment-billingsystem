"use client";
import { Suspense } from "react";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import ProductFiltersPanel from "@/components/shop/ProductFilters";
import { ProductCardSkeleton } from "@/components/ui/LoadingSkeleton";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Package } from "lucide-react";
import type { Product, ProductCategory, ProductFilters } from "@/types";
import { buildQueryString } from "@/lib/utils";

// ─── Inner component (uses useSearchParams) ────────────────────
function ProductsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Parse filters from URL
  const filters: ProductFilters = {
    category: searchParams.get("category") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    minPrice: searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
    maxPrice: searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
    minRating: searchParams.get("minRating") ? Number(searchParams.get("minRating")) : undefined,
    inStock: searchParams.get("inStock") === "true" ? true : undefined,
    sort: (searchParams.get("sort") as ProductFilters["sort"]) ?? undefined,
    featured: searchParams.get("featured") === "true" ? true : undefined,
    trending: searchParams.get("trending") === "true" ? true : undefined,
    bestSeller: searchParams.get("bestSeller") === "true" ? true : undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
    limit: 16,
  };

  const updateFilters = useCallback(
    (updates: Partial<ProductFilters>) => {
      const current = Object.fromEntries(searchParams.entries());
      const next: Record<string, string> = { ...current };
      delete next.page; // reset page on filter change
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === false) {
          delete next[key];
        } else {
          next[key] = String(value);
        }
      }
      router.push(`${pathname}?${new URLSearchParams(next).toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const setPage = (p: number) => updateFilters({ page: p });

  // Fetch products whenever URL params change
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const isLatest = filters.sort === "latest";
      const isTrending = filters.sort === "popular";

      const params = buildQueryString({
        ...(filters.category && { category: filters.category }),
        ...(filters.search && { search: filters.search }),
        ...(filters.minPrice !== undefined && { minPrice: filters.minPrice }),
        ...(filters.maxPrice !== undefined && { maxPrice: filters.maxPrice }),
        ...(filters.minRating !== undefined && { minRating: filters.minRating }),
        ...(filters.inStock && { inStock: "true" }),
        ...(filters.featured && { featured: "true" }),
        ...(filters.bestSeller && { bestSeller: "true" }),
        ...(isLatest && { latest: "true" }),
        ...(isTrending && { trending: "true" }),
        page: filters.page ?? 1,
        limit: filters.limit ?? 16,
      });

      const res = await fetch(`/api/public/products?${params}`);
      const data = await res.json();
      setProducts(data.data ?? []);
      setTotal(data.meta?.total ?? 0);
      setTotalPages(data.meta?.totalPages ?? 1);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Load categories once
  useEffect(() => {
    fetch("/api/public/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.data ?? []))
      .catch(() => {});
  }, []);

  const searchQuery = filters.search;
  const currentCategoryName = categories.find((c) => c.slug === filters.category)?.name;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 pt-20">
        {/* Header bar */}
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="font-display font-extrabold text-3xl text-slate-900 mb-1">
              {searchQuery
                ? `Results for "${searchQuery}"`
                : currentCategoryName ?? "All Products"}
            </h1>
            <p className="text-slate-500 text-sm">
              {loading ? "Loading…" : `${total.toLocaleString()} product${total !== 1 ? "s" : ""} found`}
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8 items-start">
            {/* Sidebar filters */}
            <ProductFiltersPanel
              filters={filters}
              onChange={updateFilters}
              categories={categories}
            />

            {/* Product grid */}
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <ProductCardSkeleton key={i} />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <EmptyState searchQuery={searchQuery} onClear={() => router.push("/products")} />
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5 text-sm text-slate-500">
                    <span>{total.toLocaleString()} results</span>
                    {totalPages > 1 && (
                      <span>Page {filters.page} of {totalPages}</span>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={searchParams.toString()}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5"
                    >
                      {products.map((product, i) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3) }}
                        >
                          <ProductCard product={product} />
                        </motion.div>
                      ))}
                    </motion.div>
                  </AnimatePresence>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-10 flex justify-center gap-2 flex-wrap">
                      <button
                        disabled={filters.page === 1}
                        onClick={() => setPage((filters.page ?? 1) - 1)}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary disabled:opacity-30 transition-all"
                      >
                        ← Prev
                      </button>

                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        const p = i + 1;
                        const isActive = p === (filters.page ?? 1);
                        return (
                          <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                              isActive
                                ? "text-white shadow-md"
                                : "border border-slate-200 text-slate-600 hover:border-primary hover:text-primary"
                            }`}
                            style={isActive ? { background: "var(--gradient-primary)" } : {}}
                          >
                            {p}
                          </button>
                        );
                      })}

                      <button
                        disabled={(filters.page ?? 1) >= totalPages}
                        onClick={() => setPage((filters.page ?? 1) + 1)}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary disabled:opacity-30 transition-all"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

// ─── Empty state ───────────────────────────────────────────────
function EmptyState({ searchQuery, onClear }: { searchQuery?: string; onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-5">
        {searchQuery
          ? <Search size={36} className="text-slate-300" />
          : <Package size={36} className="text-slate-300" />}
      </div>
      <h2 className="font-display font-bold text-2xl text-slate-800 mb-2">
        {searchQuery ? `No results for "${searchQuery}"` : "No products found"}
      </h2>
      <p className="text-slate-500 mb-8 max-w-sm">
        {searchQuery
          ? "Try different keywords or browse all products."
          : "Try adjusting your filters to see more products."}
      </p>
      <button
        onClick={onClear}
        className="px-8 py-3 rounded-full text-sm font-bold text-white transition-all hover:-translate-y-0.5"
        style={{ background: "var(--gradient-primary)" }}
      >
        Browse All Products
      </button>
    </motion.div>
  );
}

// ─── Page export with Suspense boundary ───────────────────────
// Required because useSearchParams() needs Suspense in Next.js 15
export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 pt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {Array.from({ length: 16 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <ProductsInner />
    </Suspense>
  );
}
