"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  Flame,
  ShoppingCart,
  Clock,
  Zap,
  Package,
  ChevronRight,
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useToast } from "@/components/ui/Toast";
import {
  formatPrice,
  calcDiscountedPrice,
  calcDiscountPercent,
  getFeaturedImage,
} from "@/lib/utils";
import type { Product } from "@/types";

// ─── Countdown Timer ──────────────────────────────────────────────
interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
}

function useCountdown(endTime: Date): TimeLeft {
  const calc = useCallback((): TimeLeft => {
    const diff = Math.max(0, endTime.getTime() - Date.now());
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const seconds = Math.floor((diff % 60_000) / 1_000);
    return { hours, minutes, seconds };
  }, [endTime]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calc);

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(calc()), 1_000);
    return () => clearInterval(id);
  }, [calc]);

  return timeLeft;
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  const display = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl md:text-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
      >
        {/* Animated flip indicator */}
        <span className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
        {display}
      </div>
      <span className="text-[10px] uppercase tracking-widest text-white/60 mt-1.5 font-bold">
        {label}
      </span>
    </div>
  );
}

// ─── Flash Sale Product Card ──────────────────────────────────────
function FlashProductCard({ product, index }: { product: Product; index: number }) {
  const { addItem } = useCart();
  const { success } = useToast();
  const price = Number(product.price);
  const discountValue = product.discountValue != null ? Number(product.discountValue) : null;
  const discountedPrice = calcDiscountedPrice(price, product.discountType, discountValue);
  const discountPct = calcDiscountPercent(price, product.discountType, discountValue);
  const imageUrl = getFeaturedImage(product.images);
  const stockPct = product.quantity > 0 ? Math.min(100, Math.max(10, 100 - (product.quantity / 50) * 100)) : 100;

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
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      {/* Discount badge */}
      {discountPct > 0 && (
        <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full text-xs font-black text-white" style={{ background: "linear-gradient(135deg, #f43f5e, #e11d48)" }}>
          -{discountPct}%
        </div>
      )}

      {/* Image */}
      <Link href={`/products/${product.slug}`} className="block relative aspect-square overflow-hidden bg-slate-50">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package size={40} className="text-slate-200" />
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-4">
        {product.category && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary/70">
            {product.category.name}
          </span>
        )}
        <Link href={`/products/${product.slug}`}>
          <h3 className="font-semibold text-slate-800 text-sm leading-snug mt-0.5 mb-2 line-clamp-2 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-lg font-black text-rose-600">
            {formatPrice(discountedPrice, product.currency)}
          </span>
          {discountPct > 0 && (
            <span className="text-xs text-slate-400 line-through">
              {formatPrice(price, product.currency)}
            </span>
          )}
        </div>

        {/* Stock bar */}
        <div className="mb-3">
          <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1">
            <span className="text-rose-500 font-bold">
              {product.quantity > 0 ? `Only ${product.quantity} left!` : "Sold out"}
            </span>
            <span>{100 - Math.round(stockPct)}% sold</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${100 - Math.round(stockPct)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.3 + index * 0.1, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #f43f5e, #f59e0b)" }}
            />
          </div>
        </div>

        {/* Add to cart */}
        <button
          onClick={handleAdd}
          disabled={product.quantity === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: product.quantity === 0 ? "#94a3b8" : "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}
        >
          <ShoppingCart size={14} />
          {product.quantity === 0 ? "Out of Stock" : "Add to Cart"}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────
export default function FlashSale() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // End time: midnight of the current day (or 6 hours from now as fallback)
  const endTime = (() => {
    const d = new Date();
    d.setHours(23, 59, 59, 0);
    return d;
  })();

  const timeLeft = useCountdown(endTime);

  useEffect(() => {
    fetch("/api/public/products?flashSale=true&limit=6")
      .then((r) => r.json())
      .then((d) => setProducts(d.data ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section id="flash-sale" className="py-20 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1442 50%, #0f172a 100%)" }}>
      {/* Background texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle, #f43f5e, transparent)" }} />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-15 pointer-events-none" style={{ background: "radial-gradient(circle, #f59e0b, transparent)" }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-10"
        >
          <div>
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-4" style={{ background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)" }}>
              <Flame size={16} className="text-rose-400 animate-pulse" />
              <span className="text-sm font-bold text-rose-300 uppercase tracking-widest">Flash Sale</span>
              <Zap size={14} className="text-amber-400" />
            </div>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
              Today&apos;s Lightning<br />
              <span style={{ background: "linear-gradient(135deg, #f43f5e, #f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Deals
              </span>
            </h2>
            <p className="text-white/55 mt-2 text-sm">Limited quantities · Ends at midnight</p>
          </div>

          {/* Countdown */}
          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="flex items-center gap-2 text-white/60 text-sm font-semibold">
              <Clock size={15} />
              Time remaining
            </div>
            <div className="flex items-center gap-3">
              <TimeUnit value={timeLeft.hours} label="Hours" />
              <span className="text-white/40 font-black text-2xl mb-4">:</span>
              <TimeUnit value={timeLeft.minutes} label="Min" />
              <span className="text-white/40 font-black text-2xl mb-4">:</span>
              <TimeUnit value={timeLeft.seconds} label="Sec" />
            </div>
          </div>
        </motion.div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden">
                <div className="skeleton aspect-square" />
                <div className="p-4 space-y-2 bg-white rounded-b-2xl">
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-5 w-1/2 rounded" />
                  <div className="skeleton h-2 w-full rounded" />
                  <div className="skeleton h-8 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {products.map((product, i) => (
              <FlashProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        )}

        {/* View all */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-8 text-center"
        >
          <Link
            href="/products?flashSale=true"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-sm font-bold text-white border border-white/20 hover:bg-white/10 transition-all hover:-translate-y-0.5"
          >
            View All Flash Deals
            <ChevronRight size={16} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
