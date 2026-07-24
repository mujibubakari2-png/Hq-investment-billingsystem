"use client";
import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Heart, Share2, Eye, ShoppingCart, Package,
  Star, Zap, Award, Flame
} from "lucide-react";
import { useCart } from "@/lib/cart";
import { useToast } from "@/components/ui/Toast";
import {
  formatPrice, calcDiscountedPrice, calcDiscountPercent,
  getFeaturedImage, generateShareUrl, truncate
} from "@/lib/utils";
import type { Product } from "@/types";

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
}

export default function ProductCard({ product, onQuickView }: ProductCardProps) {
  const [favorited, setFavorited] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const { addItem } = useCart();
  const { success, info } = useToast();

  const price = Number(product.price);
  const discountedPrice = calcDiscountedPrice(price, product.discountType, product.discountValue != null ? Number(product.discountValue) : null);
  const discountPct = calcDiscountPercent(price, product.discountType, product.discountValue != null ? Number(product.discountValue) : null);
  const imageUrl = getFeaturedImage(product.images);
  const hasDiscount = discountPct > 0;
  const isOutOfStock = product.quantity === 0;

  const handleAddToCart = useCallback(async () => {
    if (isOutOfStock) return;
    setAddingToCart(true);
    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      image: imageUrl,
      price,
      discountType: product.discountType,
      discountValue: product.discountValue != null ? Number(product.discountValue) : null,
      currency: product.currency,
      quantity: 1,
      maxQuantity: product.quantity,
      category: product.category?.name ?? null,
    });
    success(`${truncate(product.name, 40)} added to cart!`);
    setTimeout(() => setAddingToCart(false), 600);
  }, [product, price, imageUrl, addItem, success, isOutOfStock]);

  const handleShare = useCallback(async () => {
    const url = generateShareUrl(product.slug);
    if (navigator.share) {
      try { await navigator.share({ title: product.name, url }); } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(url);
      info("Link copied!");
    }
  }, [product.name, product.slug, info]);

  const handleFavorite = useCallback(() => {
    setFavorited((f) => !f);
    success(favorited ? "Removed from wishlist" : "Added to wishlist!");
  }, [favorited, success]);

  return (
    <motion.div
      className="card-product group relative"
      whileHover={{ y: -6 }}
      transition={{ type: "spring", damping: 20 }}
      role="article"
      aria-label={product.name}
    >
      {/* ── Image Area ── */}
      <div className="relative overflow-hidden rounded-t-xl bg-slate-50" style={{ aspectRatio: "1/1" }}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-108"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <Package size={48} className="text-slate-300" />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300" />

        {/* ── Badges ── */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.isNew && (
            <span className="badge badge-new">
              <Zap size={10} /> New
            </span>
          )}
          {product.bestSeller && (
            <span className="badge badge-best">
              <Award size={10} /> Best Seller
            </span>
          )}
          {product.trending && !product.bestSeller && (
            <span className="badge badge-hot">
              <Flame size={10} /> Hot
            </span>
          )}
          {hasDiscount && (
            <span className="badge badge-sale">
              -{discountPct}%
            </span>
          )}
          {isOutOfStock && (
            <span className="badge badge-out">Out of Stock</span>
          )}
        </div>

        {/* ── Action Buttons (appear on hover) ── */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 translate-x-10 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300">
          {/* Favorite */}
          <button
            onClick={handleFavorite}
            className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-all"
            aria-label={favorited ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart
              size={16}
              className={favorited ? "fill-rose-500 text-rose-500" : "text-slate-400"}
            />
          </button>
          {/* Share */}
          <button
            onClick={handleShare}
            className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-all"
            aria-label="Share product"
          >
            <Share2 size={15} className="text-slate-400" />
          </button>
          {/* Quick View */}
          {onQuickView && (
            <button
              onClick={() => onQuickView(product)}
              className="w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:scale-110 transition-all"
              aria-label="Quick view"
            >
              <Eye size={15} className="text-slate-400" />
            </button>
          )}
        </div>

        {/* ── Add to Cart (bottom bar on hover) ── */}
        {!isOutOfStock && (
          <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <button
              onClick={handleAddToCart}
              disabled={addingToCart}
              className="w-full py-3 text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: "var(--gradient-primary)" }}
              aria-label={`Add ${product.name} to cart`}
            >
              {addingToCart ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <ShoppingCart size={16} />
              )}
              {addingToCart ? "Adding…" : "Add to Cart"}
            </button>
          </div>
        )}
      </div>

      {/* ── Info Area ── */}
      <div className="p-4">
        {/* Category */}
        {product.category && (
          <Link
            href={`/products?category=${product.category.slug}`}
            className="text-xs text-primary font-semibold uppercase tracking-wider hover:text-secondary transition-colors"
          >
            {product.category.name}
          </Link>
        )}

        {/* Name */}
        <Link href={`/products/${product.slug}`}>
          <h3 className="mt-1 font-bold text-slate-800 text-sm leading-snug line-clamp-2 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        {product.avgRating !== undefined && product.avgRating > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  className={i < Math.round(product.avgRating!) ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"}
                />
              ))}
            </div>
            <span className="text-xs text-slate-500">
              {product.avgRating.toFixed(1)} ({product.reviewCount ?? 0})
            </span>
          </div>
        )}

        {/* Price & Actions */}
        <div className="flex items-center justify-between mt-3">
          <div>
            {hasDiscount ? (
              <div>
                <span className="text-lg font-black text-rose-600">
                  {formatPrice(discountedPrice, product.currency)}
                </span>
                <span className="ml-2 text-xs text-slate-400 line-through">
                  {formatPrice(price, product.currency)}
                </span>
              </div>
            ) : (
              <span className="text-lg font-black text-slate-900">
                {formatPrice(price, product.currency)}
              </span>
            )}
          </div>

          {/* View Details */}
          <Link
            href={`/products/${product.slug}`}
            className="text-xs font-semibold text-primary hover:text-secondary transition-colors underline underline-offset-2"
          >
            Details
          </Link>
        </div>

        {/* Availability */}
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${isOutOfStock ? "bg-slate-300" : product.quantity <= 5 ? "bg-amber-400" : "bg-emerald-500"}`}
          />
          <span className="text-xs text-slate-500">
            {isOutOfStock
              ? "Out of stock"
              : product.quantity <= 5
              ? `Only ${product.quantity} left`
              : "In stock"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
