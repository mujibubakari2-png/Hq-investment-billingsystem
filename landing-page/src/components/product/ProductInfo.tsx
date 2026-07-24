"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Heart, Share2, Tag, CheckCircle,
  AlertCircle, Minus, Plus, Truck, Shield, RotateCcw,
  Zap, Award, Flame
} from "lucide-react";
import Link from "next/link";
import StarRating from "@/components/ui/StarRating";
import { useCart } from "@/lib/cart";
import { useToast } from "@/components/ui/Toast";
import {
  formatPrice, calcDiscountedPrice, calcDiscountPercent,
  getFeaturedImage, whatsAppLink
} from "@/lib/utils";
import type { Product } from "@/types";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "255700000001";

interface ProductInfoProps {
  product: Product;
}

export default function ProductInfo({ product }: ProductInfoProps) {
  const [qty, setQty] = useState(1);
  const [favorited, setFavorited] = useState(false);
  const { addItem } = useCart();
  const { success, info } = useToast();

  const price = Number(product.price);
  const discountValue = product.discountValue != null ? Number(product.discountValue) : null;
  const discountedPrice = calcDiscountedPrice(price, product.discountType, discountValue);
  const discountPct = calcDiscountPercent(price, product.discountType, discountValue);
  const hasDiscount = discountPct > 0;
  const isOutOfStock = product.quantity === 0;
  const isLowStock = product.quantity > 0 && product.quantity <= 5;
  const imageUrl = getFeaturedImage(product.images);

  const handleAddToCart = () => {
    if (isOutOfStock) return;
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
      quantity: qty,
      maxQuantity: product.quantity,
      category: product.category?.name ?? null,
    });
    success(`${product.name} × ${qty} added to cart!`);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: product.name, url }); } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(url);
      info("Link copied to clipboard!");
    }
  };

  const waMessage = `Hi! I'm interested in "${product.name}" — ${window?.location?.href ?? ""}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {product.isNew && (
          <span className="badge badge-new"><Zap size={11} /> New Arrival</span>
        )}
        {product.bestSeller && (
          <span className="badge badge-best"><Award size={11} /> Best Seller</span>
        )}
        {product.trending && (
          <span className="badge badge-hot"><Flame size={11} /> Trending</span>
        )}
        {hasDiscount && (
          <span className="badge badge-sale">-{discountPct}% OFF</span>
        )}
      </div>

      {/* Category breadcrumb */}
      {product.category && (
        <Link
          href={`/products?category=${product.category.slug}`}
          className="text-xs font-bold text-primary uppercase tracking-widest hover:text-secondary transition-colors"
        >
          {product.category.name}
        </Link>
      )}

      {/* Title */}
      <h1 className="font-display font-extrabold text-3xl md:text-4xl text-slate-900 leading-tight">
        {product.name}
      </h1>

      {/* Rating */}
      {product.avgRating !== undefined && (
        <div className="flex items-center gap-3">
          <StarRating rating={product.avgRating} count={product.reviewCount} size={18} />
          <span className="text-slate-400 text-sm">•</span>
          <a href="#reviews" className="text-sm text-primary hover:underline">
            Write a review
          </a>
        </div>
      )}

      {/* Brand / SKU */}
      <div className="flex flex-wrap gap-4 text-sm text-slate-500">
        {product.brand && (
          <span><span className="font-semibold text-slate-700">Brand:</span> {product.brand}</span>
        )}
        {product.sku && (
          <span><span className="font-semibold text-slate-700">SKU:</span> {product.sku}</span>
        )}
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-4">
        {hasDiscount ? (
          <>
            <span className="text-4xl font-black text-rose-600">
              {formatPrice(discountedPrice, product.currency)}
            </span>
            <span className="text-xl text-slate-400 line-through font-medium">
              {formatPrice(price, product.currency)}
            </span>
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className="badge badge-sale text-sm px-3 py-1.5"
            >
              Save {formatPrice(price - discountedPrice, product.currency)}
            </motion.span>
          </>
        ) : (
          <span className="text-4xl font-black text-slate-900">
            {formatPrice(price, product.currency)}
          </span>
        )}
      </div>

      {/* Availability */}
      <div className="flex items-center gap-2">
        {isOutOfStock ? (
          <><AlertCircle size={16} className="text-slate-400" /><span className="text-slate-400 font-medium text-sm">Out of Stock</span></>
        ) : isLowStock ? (
          <><AlertCircle size={16} className="text-amber-500" /><span className="text-amber-600 font-semibold text-sm">Only {product.quantity} left in stock!</span></>
        ) : (
          <><CheckCircle size={16} className="text-emerald-500" /><span className="text-emerald-600 font-semibold text-sm">In Stock</span></>
        )}
      </div>

      {/* Tags */}
      {product.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Tag size={14} className="text-slate-400 mt-0.5" />
          {product.tags.map((tag) => (
            <Link key={tag} href={`/products?search=${encodeURIComponent(tag)}`}>
              <span className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary transition-colors font-medium cursor-pointer">
                #{tag}
              </span>
            </Link>
          ))}
        </div>
      )}

      <hr className="border-slate-100" />

      {/* Quantity + Add to Cart */}
      {!isOutOfStock && (
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Qty selector */}
          <div className="flex items-center rounded-2xl border-2 border-slate-200 p-1 w-fit">
            <button
              onClick={() => setQty(Math.max(1, qty - 1))}
              disabled={qty <= 1}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all"
              aria-label="Decrease quantity"
            >
              <Minus size={16} />
            </button>
            <span className="w-12 text-center font-bold text-slate-900">{qty}</span>
            <button
              onClick={() => setQty(Math.min(product.quantity, qty + 1))}
              disabled={qty >= product.quantity}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all"
              aria-label="Increase quantity"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Add to Cart */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleAddToCart}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "var(--gradient-primary)" }}
          >
            <ShoppingCart size={18} />
            Add to Cart — {formatPrice(discountedPrice * qty, product.currency)}
          </motion.button>
        </div>
      )}

      {/* Action buttons row */}
      <div className="flex gap-3">
        <button
          onClick={() => { setFavorited((f) => !f); success(favorited ? "Removed from wishlist" : "Added to wishlist!"); }}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-500 transition-all"
        >
          <Heart size={17} className={favorited ? "fill-rose-500 text-rose-500" : ""} />
          Wishlist
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary transition-all"
        >
          <Share2 size={17} />
          Share
        </button>
        <a
          href={whatsAppLink(WHATSAPP_NUMBER, waMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #25d366, #128c7e)" }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.556 4.118 1.528 5.845L0 24l6.337-1.507A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.01-1.37l-.359-.214-3.764.895.929-3.67-.234-.376A9.818 9.818 0 012.182 12C2.182 6.583 6.583 2.182 12 2.182S21.818 6.583 21.818 12 17.417 21.818 12 21.818z"/></svg>
          WhatsApp
        </a>
      </div>

      {/* Trust badges */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        {[
          { icon: Truck, text: "Fast Delivery", sub: "1–3 business days" },
          { icon: Shield, text: "Secure Payment", sub: "100% protected" },
          { icon: RotateCcw, text: "Easy Returns", sub: "14-day policy" },
        ].map(({ icon: Icon, text, sub }) => (
          <div key={text} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 text-center border border-slate-100">
            <Icon size={20} className="text-primary" />
            <span className="text-xs font-bold text-slate-700">{text}</span>
            <span className="text-[10px] text-slate-400">{sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
