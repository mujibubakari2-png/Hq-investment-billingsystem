"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Grid3X3, ChevronRight } from "lucide-react";
import { CategorySkeleton } from "@/components/ui/LoadingSkeleton";
import type { ProductCategory } from "@/types";

const EMOJI_MAP: Record<string, string> = {
  electronics: "📱",
  phones: "📱",
  computers: "💻",
  accessories: "🎧",
  fashion: "👗",
  home: "🏠",
  beauty: "💄",
  food: "🍎",
  sports: "⚽",
  toys: "🧸",
  books: "📚",
  health: "💊",
};

function getIcon(cat: ProductCategory) {
  if (cat.icon) return cat.icon;
  const slug = cat.slug.toLowerCase();
  for (const key of Object.keys(EMOJI_MAP)) {
    if (slug.includes(key)) return EMOJI_MAP[key];
  }
  return "🛍️";
}

const BG_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)",
  "linear-gradient(135deg, #f43f5e 0%, #f59e0b 100%)",
  "linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)",
  "linear-gradient(135deg, #059669 0%, #0ea5e9 100%)",
  "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
  "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
  "linear-gradient(135deg, #0f172a 0%, #475569 100%)",
];

export default function Categories() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && categories.length === 0) return null;

  return (
    <section id="categories" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Grid3X3 size={18} className="text-primary" />
              </div>
              <span className="text-sm font-semibold text-primary uppercase tracking-widest">
                Browse by Category
              </span>
            </div>
            <h2 className="section-title">Shop by Category</h2>
            <p className="text-slate-500 mt-2">Find exactly what you&apos;re looking for</p>
          </div>
          <Link
            href="/products"
            className="hidden sm:flex items-center gap-2 text-sm font-semibold text-primary hover:text-secondary transition-colors group"
          >
            View All
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <CategorySkeleton key={i} />
              ))
            : categories.slice(0, 8).map((cat, i) => (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.07 }}
                >
                  <Link href={`/products?category=${cat.slug}`} aria-label={cat.name}>
                    <div
                      className="relative overflow-hidden rounded-2xl cursor-pointer group"
                      style={{ aspectRatio: "3/4" }}
                    >
                      {/* Background */}
                      {cat.image ? (
                        <Image
                          src={cat.image}
                          alt={cat.name}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                      ) : (
                        <div
                          className="absolute inset-0"
                          style={{ background: BG_GRADIENTS[i % BG_GRADIENTS.length] }}
                        />
                      )}

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-300 group-hover:from-black/90" />

                      {/* Content */}
                      <div className="absolute inset-0 flex flex-col items-center justify-end p-4 pb-5">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1"
                          style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
                        >
                          {getIcon(cat)}
                        </div>
                        <h3 className="text-white font-bold text-sm text-center leading-tight mb-1.5">
                          {cat.name}
                        </h3>
                        {cat._count && (
                          <span
                            className="text-xs font-semibold px-3 py-1 rounded-full"
                            style={{
                              background: "rgba(255,255,255,0.2)",
                              color: "white",
                              backdropFilter: "blur(8px)",
                            }}
                          >
                            {cat._count.products} items
                          </span>
                        )}
                      </div>

                      {/* Hover badge */}
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div
                          className="px-2.5 py-1 rounded-full text-xs font-bold text-white"
                          style={{ background: "var(--gradient-accent)" }}
                        >
                          Shop →
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
        </div>

        {/* Mobile view all */}
        <div className="sm:hidden mt-6 text-center">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-secondary transition-colors"
          >
            View All Categories <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
