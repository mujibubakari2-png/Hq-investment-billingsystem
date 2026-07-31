"use client";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, ChevronDown, ChevronUp } from "lucide-react";
import type { ProductCategory, ProductFilters } from "@/types";
import StarRating from "@/components/ui/StarRating";
import { catalogueSortOptions, ratingFilterOptions } from "@/config/catalogue";

interface ProductFiltersProps {
  filters: ProductFilters;
  onChange: (f: Partial<ProductFilters>) => void;
  categories: ProductCategory[];
}

function FilterSection({ title, children, defaultOpen = true }: {
  title: string; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="filter-section">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full"
      >
        <span className="filter-title">{title}</span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ProductFiltersPanel({ filters, onChange, categories }: ProductFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [localMinPrice, setLocalMinPrice] = useState(filters.minPrice?.toString() ?? "");
  const [localMaxPrice, setLocalMaxPrice] = useState(filters.maxPrice?.toString() ?? "");

  const applyPriceRange = useCallback(() => {
    onChange({
      minPrice: localMinPrice ? parseFloat(localMinPrice) : undefined,
      maxPrice: localMaxPrice ? parseFloat(localMaxPrice) : undefined,
    });
  }, [localMinPrice, localMaxPrice, onChange]);

  const activeCount = [
    filters.category, filters.minPrice, filters.maxPrice,
    filters.minRating, filters.inStock,
  ].filter(Boolean).length;

  const clearAll = () => {
    setLocalMinPrice(""); setLocalMaxPrice("");
    onChange({ category: undefined, minPrice: undefined, maxPrice: undefined, minRating: undefined, inStock: undefined, sort: undefined });
  };

  const FilterContent = (
    <div className="space-y-4">
      {/* Active filters / Clear */}
      {activeCount > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl">
          <span className="text-xs font-semibold text-primary">{activeCount} filter{activeCount > 1 ? "s" : ""} active</span>
          <button onClick={clearAll} className="text-xs text-rose-500 font-semibold hover:text-rose-700 transition-colors flex items-center gap-1">
            <X size={12} /> Clear all
          </button>
        </div>
      )}

      {/* Sort */}
      <FilterSection title="Sort By">
        <div className="space-y-1">
          {catalogueSortOptions.map((opt) => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer py-1.5 group">
              <input
                type="radio"
                name="sort"
                value={opt.value}
                checked={filters.sort === opt.value}
                onChange={() => onChange({ sort: opt.value })}
                className="accent-primary w-4 h-4"
              />
              <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">{opt.label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Categories */}
      {categories.length > 0 && (
        <FilterSection title="Category">
          <div className="space-y-1 max-h-56 overflow-y-auto">
            <label className="flex items-center gap-3 cursor-pointer py-1.5 group">
              <input
                type="radio" name="category" value=""
                checked={!filters.category}
                onChange={() => onChange({ category: undefined })}
                className="accent-primary w-4 h-4"
              />
              <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">All Categories</span>
            </label>
            {categories.map((cat) => (
              <label key={cat.id} className="flex items-center justify-between cursor-pointer py-1.5 group">
                <div className="flex items-center gap-3">
                  <input
                    type="radio" name="category" value={cat.slug}
                    checked={filters.category === cat.slug}
                    onChange={() => onChange({ category: cat.slug })}
                    className="accent-primary w-4 h-4"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">{cat.name}</span>
                </div>
                {cat._count && (
                  <span className="text-xs text-slate-400 font-medium">{cat._count.products}</span>
                )}
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Price Range */}
      <FilterSection title="Price Range">
        <div className="flex gap-2 items-center">
          <input
            type="number" min="0" placeholder="Min"
            value={localMinPrice}
            onChange={(e) => setLocalMinPrice(e.target.value)}
            onBlur={applyPriceRange}
            onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
            className="input-base text-xs py-2 px-3"
          />
          <span className="text-slate-400 text-xs font-medium">to</span>
          <input
            type="number" min="0" placeholder="Max"
            value={localMaxPrice}
            onChange={(e) => setLocalMaxPrice(e.target.value)}
            onBlur={applyPriceRange}
            onKeyDown={(e) => e.key === "Enter" && applyPriceRange()}
            className="input-base text-xs py-2 px-3"
          />
        </div>
        <button
          onClick={applyPriceRange}
          className="mt-2 w-full py-2 text-xs font-semibold rounded-lg border border-slate-200 hover:border-primary hover:text-primary transition-all text-slate-600"
        >
          Apply
        </button>
      </FilterSection>

      {/* Rating */}
      <FilterSection title="Minimum Rating">
        <div className="space-y-2">
          {ratingFilterOptions.map((r) => (
            <label key={r} className="flex items-center gap-3 cursor-pointer py-1">
              <input
                type="radio" name="rating" value={r}
                checked={filters.minRating === r}
                onChange={() => onChange({ minRating: r })}
                className="accent-primary w-4 h-4"
              />
              <StarRating rating={r} size={14} />
              <span className="text-xs text-slate-500">& above</span>
            </label>
          ))}
          {filters.minRating && (
            <button onClick={() => onChange({ minRating: undefined })} className="text-xs text-rose-500 hover:text-rose-700">
              Clear rating
            </button>
          )}
        </div>
      </FilterSection>

      {/* Availability */}
      <FilterSection title="Availability">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!filters.inStock}
            onChange={(e) => onChange({ inStock: e.target.checked || undefined })}
            className="accent-primary w-4 h-4 rounded"
          />
          <span className="text-sm text-slate-600">In Stock Only</span>
        </label>
      </FilterSection>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 space-y-4 sticky top-24 self-start">
        {FilterContent}
      </aside>

      {/* Mobile filter button */}
      <div className="lg:hidden sticky top-20 z-40 flex justify-end mb-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold text-white shadow-lg"
          style={{ background: "var(--gradient-primary)" }}
        >
          <SlidersHorizontal size={16} />
          Filters {activeCount > 0 && <span className="bg-white text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">{activeCount}</span>}
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-80 bg-white z-[60] overflow-y-auto shadow-2xl p-5"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display font-bold text-lg">Filters</h2>
                <button onClick={() => setMobileOpen(false)} className="p-2 rounded-full hover:bg-slate-100">
                  <X size={20} />
                </button>
              </div>
              {FilterContent}
              <div className="mt-6 pt-4 border-t">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-3 rounded-full font-bold text-white text-sm"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  Show Results
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
