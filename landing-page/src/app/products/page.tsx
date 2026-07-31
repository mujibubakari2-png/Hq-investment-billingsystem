"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Package, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import ProductFiltersPanel from "@/components/shop/ProductFilters";
import { ProductCardSkeleton } from "@/components/ui/LoadingSkeleton";
import { CATALOGUE_PAGE_SIZE, getVisiblePageNumbers } from "@/config/catalogue";
import { buildQueryString } from "@/lib/utils";
import type { Product, ProductCategory, ProductFilters } from "@/types";

function ProductsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQueryString = searchParams.toString();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filters: ProductFilters = useMemo(() => {
    const params = new URLSearchParams(searchQueryString);

    return {
      category: params.get("category") ?? undefined,
      search: params.get("search") ?? undefined,
      minPrice: params.get("minPrice") ? Number(params.get("minPrice")) : undefined,
      maxPrice: params.get("maxPrice") ? Number(params.get("maxPrice")) : undefined,
      minRating: params.get("minRating") ? Number(params.get("minRating")) : undefined,
      inStock: params.get("inStock") === "true" ? true : undefined,
      sort: (params.get("sort") as ProductFilters["sort"]) ?? undefined,
      featured: params.get("featured") === "true" ? true : undefined,
      trending: params.get("trending") === "true" ? true : undefined,
      bestSeller: params.get("bestSeller") === "true" ? true : undefined,
      page: params.get("page") ? Number(params.get("page")) : 1,
      limit: CATALOGUE_PAGE_SIZE,
    };
  }, [searchQueryString]);

  const updateFilters = useCallback(
    (updates: Partial<ProductFilters>) => {
      const current = Object.fromEntries(searchParams.entries());
      const next: Record<string, string> = { ...current };
      delete next.page;

      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === false) {
          delete next[key];
        } else {
          next[key] = String(value);
        }
      }

      const nextParams = new URLSearchParams(next).toString();
      router.push(nextParams ? `${pathname}?${nextParams}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setPage = (page: number) => updateFilters({ page });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = buildQueryString({
        ...(filters.category && { category: filters.category }),
        ...(filters.search && { search: filters.search }),
        ...(filters.minPrice !== undefined && { minPrice: filters.minPrice }),
        ...(filters.maxPrice !== undefined && { maxPrice: filters.maxPrice }),
        ...(filters.minRating !== undefined && { minRating: filters.minRating }),
        ...(filters.inStock && { inStock: "true" }),
        ...(filters.featured && { featured: "true" }),
        ...(filters.bestSeller && { bestSeller: "true" }),
        ...(filters.sort === "latest" && { latest: "true" }),
        ...(filters.sort === "popular" && { trending: "true" }),
        ...(filters.sort && !["latest", "popular"].includes(filters.sort) && { sort: filters.sort }),
        page: filters.page ?? 1,
        limit: filters.limit ?? CATALOGUE_PAGE_SIZE,
      });

      const response = await fetch(`/api/public/products?${params}`);
      const data = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Unable to load products");
      }

      setProducts(data.data ?? []);
      setTotal(data.meta?.total ?? 0);
      setTotalPages(data.meta?.totalPages ?? 1);
    } catch {
      setProducts([]);
      setTotal(0);
      setTotalPages(1);
      setError("We could not load the catalogue right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetch("/api/public/categories")
      .then((response) => response.json())
      .then((data) => setCategories(data.data ?? []))
      .catch(() => {});
  }, []);

  const searchQuery = filters.search;
  const currentPage = filters.page ?? 1;
  const currentCategoryName = categories.find((category) => category.slug === filters.category)?.name;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 pt-20">
        <div className="bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="font-display font-extrabold text-3xl text-slate-900 mb-1">
              {searchQuery ? `Results for "${searchQuery}"` : currentCategoryName ?? "All Products"}
            </h1>
            <p className="text-slate-500 text-sm">
              {loading ? "Loading..." : `${total.toLocaleString()} product${total !== 1 ? "s" : ""} found`}
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-8 items-start">
            <ProductFiltersPanel filters={filters} onChange={updateFilters} categories={categories} />

            <div className="flex-1 min-w-0">
              {loading ? (
                <ProductGridSkeleton />
              ) : error ? (
                <ErrorState message={error} onRetry={fetchProducts} />
              ) : products.length === 0 ? (
                <EmptyState searchQuery={searchQuery} onClear={() => router.push("/products")} />
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5 text-sm text-slate-500">
                    <span>{total.toLocaleString()} results</span>
                    {totalPages > 1 && <span>Page {currentPage} of {totalPages}</span>}
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
                      {products.map((product, index) => (
                        <motion.div
                          key={product.id}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.3) }}
                        >
                          <ProductCard product={product} />
                        </motion.div>
                      ))}
                    </motion.div>
                  </AnimatePresence>

                  {totalPages > 1 && (
                    <div className="mt-10 flex justify-center gap-2 flex-wrap" aria-label="Pagination">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setPage(currentPage - 1)}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary disabled:opacity-30 transition-all"
                      >
                        Prev
                      </button>

                      {getVisiblePageNumbers(currentPage, totalPages).map((page) => {
                        const isActive = page === currentPage;

                        return (
                          <button
                            key={page}
                            onClick={() => setPage(page)}
                            aria-current={isActive ? "page" : undefined}
                            className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                              isActive
                                ? "text-white shadow-md"
                                : "border border-slate-200 text-slate-600 hover:border-primary hover:text-primary"
                            }`}
                            style={isActive ? { background: "var(--gradient-primary)" } : {}}
                          >
                            {page}
                          </button>
                        );
                      })}

                      <button
                        disabled={currentPage >= totalPages}
                        onClick={() => setPage(currentPage + 1)}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary disabled:opacity-30 transition-all"
                      >
                        Next
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

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: CATALOGUE_PAGE_SIZE }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
      role="alert"
    >
      <div className="w-20 h-20 rounded-3xl bg-rose-50 flex items-center justify-center mb-5">
        <AlertCircle size={36} className="text-rose-400" />
      </div>
      <h2 className="font-display font-bold text-2xl text-slate-800 mb-2">Catalogue unavailable</h2>
      <p className="text-slate-500 mb-8 max-w-sm">{message}</p>
      <button
        onClick={onRetry}
        className="px-8 py-3 rounded-full text-sm font-bold text-white transition-all hover:-translate-y-0.5"
        style={{ background: "var(--gradient-primary)" }}
      >
        Try Again
      </button>
    </motion.div>
  );
}

function EmptyState({ searchQuery, onClear }: { searchQuery?: string; onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center mb-5">
        {searchQuery ? (
          <Search size={36} className="text-slate-300" />
        ) : (
          <Package size={36} className="text-slate-300" />
        )}
      </div>
      <h2 className="font-display font-bold text-2xl text-slate-800 mb-2">
        {searchQuery ? `No results for "${searchQuery}"` : "No products found"}
      </h2>
      <p className="text-slate-500 mb-8 max-w-sm">
        {searchQuery ? "Try different keywords or browse all products." : "Try adjusting your filters to see more products."}
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

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 pt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <ProductGridSkeleton />
          </div>
        </div>
      }
    >
      <ProductsInner />
    </Suspense>
  );
}
