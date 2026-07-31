"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Package, ShoppingCart, Star, ExternalLink } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { ProductCardSkeleton } from "@/components/ui/LoadingSkeleton";
import Modal from "@/components/ui/Modal";
import { useCart } from "@/lib/cart";
import { useToast } from "@/components/ui/Toast";
import {
  formatPrice, calcDiscountedPrice, calcDiscountPercent, getFeaturedImage
} from "@/lib/utils";
import type { Product } from "@/types";

// ─── Quick View Modal Content ──────────────────────────────────
function QuickViewContent({ product, onClose }: { product: Product; onClose: () => void }) {
  const { addItem } = useCart();
  const { success } = useToast();
  const price = Number(product.price);
  const discountValue = product.discountValue != null ? Number(product.discountValue) : null;
  const discountedPrice = calcDiscountedPrice(price, product.discountType, discountValue);
  const discountPct = calcDiscountPercent(price, product.discountType, discountValue);
  const imageUrl = getFeaturedImage(product.images);

  const handleAdd = () => {
    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: imageUrl,
      price,
      discountType: product.discountType,
      discountValue,
      currency: product.currency,
      quantity: 1,
      maxQuantity: product.quantity,
      category: product.category?.name ?? null,
    });
    success("Added to cart!");
    onClose();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
      {/* Image */}
      <div
        className="relative bg-slate-50 rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none overflow-hidden"
        style={{ minHeight: 320 }}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="450px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package size={64} className="text-slate-200" />
          </div>
        )}
        {discountPct > 0 && (
          <span className="absolute top-4 left-4 badge badge-sale text-sm px-3 py-1.5">
            -{discountPct}%
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-6 md:p-8 flex flex-col justify-between">
        <div>
          {product.category && (
            <span className="text-xs font-semibold text-primary uppercase tracking-widest">
              {product.category.name}
            </span>
          )}
          <h2 className="font-display font-bold text-2xl text-slate-900 mt-1 mb-3 leading-snug">
            {product.name}
          </h2>
          {product.avgRating !== undefined && product.avgRating > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={
                      i < Math.round(product.avgRating!)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-slate-200 text-slate-200"
                    }
                  />
                ))}
              </div>
              <span className="text-sm text-slate-500">
                {product.avgRating.toFixed(1)} ({product.reviewCount} reviews)
              </span>
            </div>
          )}
          {product.description && (
            <p className="text-slate-600 text-sm leading-relaxed line-clamp-4 mb-6">
              {product.description}
            </p>
          )}
        </div>

        <div>
          <div className="mb-5">
            {discountPct > 0 ? (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black text-rose-600">
                  {formatPrice(discountedPrice, product.currency)}
                </span>
                <span className="text-lg text-slate-400 line-through">
                  {formatPrice(price, product.currency)}
                </span>
              </div>
            ) : (
              <span className="text-3xl font-black text-slate-900">
                {formatPrice(price, product.currency)}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleAdd}
              disabled={product.quantity === 0}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:opacity-90 hover:-translate-y-0.5"
              style={{ background: "var(--gradient-primary)" }}
            >
              <ShoppingCart size={18} />
              {product.quantity === 0 ? "Out of Stock" : "Add to Cart"}
            </button>
            <Link
              href={`/products/${product.slug}`}
              onClick={onClose}
              className="p-3.5 rounded-full border-2 border-slate-200 hover:border-primary text-slate-500 hover:text-primary transition-all"
              aria-label="View full details"
            >
              <ExternalLink size={18} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared product section layout ────────────────────────────
interface ProductSectionProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  queryParams: string;
  viewAllHref?: string;
  id?: string;
  limit?: number;
}

function ProductSection({
  title,
  subtitle,
  badge,
  badgeColor = "bg-primary/10 text-primary",
  queryParams,
  viewAllHref = "/products",
  id,
  limit = 8,
}: ProductSectionProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/products?${queryParams}&limit=${limit}`);
      const data = await res.json();
      setProducts(data.data ?? []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [queryParams, limit]);

  useEffect(() => { load(); }, [load]);

  return (
    <section id={id} className="py-20 bg-white">
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
            {badge && (
              <span className={`inline-block text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full mb-3 ${badgeColor}`}>
                {badge}
              </span>
            )}
            <h2 className="section-title font-display">{title}</h2>
            {subtitle && <p className="text-slate-500 mt-2 max-w-lg">{subtitle}</p>}
          </div>
          <Link
            href={viewAllHref}
            className="hidden sm:flex items-center gap-2 text-sm font-semibold text-primary hover:text-secondary transition-colors group shrink-0"
          >
            View All
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-slate-400">No products available.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {products.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.06, 0.4) }}
              >
                <ProductCard
                  product={product}
                  onQuickView={setQuickViewProduct}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Mobile view all */}
        <div className="sm:hidden mt-8 text-center">
          <Link
            href={viewAllHref}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold text-white"
            style={{ background: "var(--gradient-primary)" }}
          >
            View All <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {/* Quick View Modal */}
      <Modal
        isOpen={!!quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        size="xl"
      >
        {quickViewProduct && (
          <QuickViewContent
            product={quickViewProduct}
            onClose={() => setQuickViewProduct(null)}
          />
        )}
      </Modal>
    </section>
  );
}

// ─── Exported named sections ───────────────────────────────────
const PRODUCT_SECTION_CONFIG = {
  featured: {
    id: "featured-products",
    title: "Featured Products",
    subtitle: "Hand-picked by our team - the best products at unbeatable prices",
    badge: "Editor's Pick",
    badgeColor: "bg-amber-50 text-amber-700",
    queryParams: "featured=true",
    viewAllHref: "/products?featured=true",
  },
  latest: {
    id: "latest-products",
    title: "Newly Arrived",
    subtitle: "Fresh arrivals added daily - be the first to shop",
    badge: "Just In",
    badgeColor: "bg-emerald-50 text-emerald-700",
    queryParams: "latest=true",
    viewAllHref: "/products?sort=latest",
  },
  trending: {
    id: "trending-products",
    title: "Trending Now",
    subtitle: "Most viewed and talked-about products this week",
    badge: "Trending",
    badgeColor: "bg-rose-50 text-rose-600",
    queryParams: "trending=true",
    viewAllHref: "/products?sort=popular",
  },
} satisfies Record<string, ProductSectionProps>;

export function FeaturedProducts() {
  return <ProductSection {...PRODUCT_SECTION_CONFIG.featured} />;
}

export function LatestProducts() {
  return <ProductSection {...PRODUCT_SECTION_CONFIG.latest} />;
}

export function TrendingProducts() {
  return <ProductSection {...PRODUCT_SECTION_CONFIG.trending} />;
}
