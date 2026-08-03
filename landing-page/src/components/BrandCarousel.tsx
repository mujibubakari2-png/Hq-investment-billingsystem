"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Award } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Brand {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  description?: string | null;
  _count?: { products: number };
}

// Static fallback brands shown when API returns nothing
const FALLBACK_BRANDS: Omit<Brand, "_count">[] = [
  { id: "1", name: "Samsung", slug: "samsung" },
  { id: "2", name: "Apple", slug: "apple" },
  { id: "3", name: "Nike", slug: "nike" },
  { id: "4", name: "Sony", slug: "sony" },
  { id: "5", name: "LG", slug: "lg" },
  { id: "6", name: "HP", slug: "hp" },
  { id: "7", name: "Lenovo", slug: "lenovo" },
  { id: "8", name: "Adidas", slug: "adidas" },
  { id: "9", name: "Dell", slug: "dell" },
  { id: "10", name: "Asus", slug: "asus" },
  { id: "11", name: "Huawei", slug: "huawei" },
  { id: "12", name: "Xiaomi", slug: "xiaomi" },
];

const BRAND_COLORS = [
  "#1e3a8a", "#0ea5e9", "#10b981", "#f59e0b",
  "#8b5cf6", "#f43f5e", "#0f766e", "#d97706",
  "#2563eb", "#7c3aed", "#059669", "#dc2626",
];

function BrandLogoItem({ brand, index }: { brand: Brand; index: number }) {
  const color = BRAND_COLORS[index % BRAND_COLORS.length];
  const initials = brand.name.slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/products?brand=${brand.slug}`}
      className="group flex flex-col items-center gap-3 px-6 py-5 rounded-2xl border border-slate-200 bg-white hover:border-primary/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 shrink-0 w-36"
      title={brand.name}
    >
      {brand.logo ? (
        <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
          <Image
            src={brand.logo}
            alt={brand.name}
            fill
            className="object-contain p-1"
            sizes="56px"
          />
        </div>
      ) : (
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm group-hover:scale-105 transition-transform"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
        >
          {initials}
        </div>
      )}
      <div className="text-center min-w-0">
        <p className="text-xs font-bold text-slate-700 truncate group-hover:text-primary transition-colors">
          {brand.name}
        </p>
        {brand._count?.products != null && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            {brand._count.products} products
          </p>
        )}
      </div>
    </Link>
  );
}

export default function BrandCarousel() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/public/brands?limit=20")
      .then((r) => r.json())
      .then((d) => {
        const data: Brand[] = d.data ?? [];
        setBrands(data.length >= 6 ? data : (FALLBACK_BRANDS as Brand[]));
      })
      .catch(() => setBrands(FALLBACK_BRANDS as Brand[]))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && brands.length === 0) return null;

  // Duplicate for seamless loop
  const displayed = brands.length > 0 ? [...brands, ...brands] : [];

  return (
    <section className="py-20 bg-slate-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Award size={18} className="text-primary" />
              </div>
              <span className="text-sm font-semibold text-primary uppercase tracking-widest">
                Top Brands
              </span>
            </div>
            <h2 className="section-title">Shop by Brand</h2>
            <p className="text-slate-500 mt-2">
              Authentic products from the world&apos;s most trusted brands
            </p>
          </div>
          <Link
            href="/products"
            className="hidden sm:flex items-center gap-2 text-sm font-semibold text-primary hover:text-secondary transition-colors group"
          >
            All Brands
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {/* Scrolling track */}
        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton rounded-2xl shrink-0 w-36 h-28" />
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* Gradient fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-r from-slate-50 to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none" />

            <div className="overflow-hidden">
              <div
                ref={trackRef}
                className="flex gap-4"
                style={{
                  animation: `brand-scroll ${brands.length * 2.5}s linear infinite`,
                  width: "max-content",
                }}
              >
                {displayed.map((brand, i) => (
                  <BrandLogoItem key={`${brand.id}-${i}`} brand={brand} index={i} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Inject keyframe */}
      <style>{`
        @keyframes brand-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="brand-scroll"] { animation: none; }
        }
      `}</style>
    </section>
  );
}
