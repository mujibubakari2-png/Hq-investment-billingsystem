"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Award,
  CheckCircle,
  Flame,
  Heart,
  MessageCircle,
  RotateCcw,
  Scale,
  Share2,
  Shield,
  ShoppingCart,
  Tag,
  Truck,
  Zap,
} from "lucide-react";
import CartQuantityControls from "@/components/cart/CartQuantityControls";
import StarRating from "@/components/ui/StarRating";
import { useToast } from "@/components/ui/Toast";
import { useCart } from "@/lib/cart";
import { useCommerce } from "@/lib/commerce";
import {
  calcDiscountedPrice,
  calcDiscountPercent,
  formatPrice,
  getFeaturedImage,
  whatsAppLink,
} from "@/lib/utils";
import type { Product } from "@/types";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "255700000001";

interface ProductInfoProps {
  product: Product;
}

export default function ProductInfo({ product }: ProductInfoProps) {
  const [qty, setQty] = useState(1);
  const { addItem } = useCart();
  const { isWishlisted, isCompared, toggleWishlist, toggleCompare, trackViewed } = useCommerce();
  const { success, info } = useToast();

  const price = Number(product.price);
  const discountValue = product.discountValue != null ? Number(product.discountValue) : null;
  const discountedPrice = calcDiscountedPrice(price, product.discountType, discountValue);
  const discountPct = calcDiscountPercent(price, product.discountType, discountValue);
  const hasDiscount = discountPct > 0;
  const isOutOfStock = product.quantity === 0;
  const isLowStock = product.quantity > 0 && product.quantity <= 5;
  const imageUrl = getFeaturedImage(product.images);
  const favorited = isWishlisted(product.id);
  const compared = isCompared(product.id);
  const productUrl = `/products/${product.slug}`;
  const waMessage = `Hi! I'm interested in "${product.name}" - ${productUrl}`;

  useEffect(() => {
    trackViewed(product);
  }, [product, trackViewed]);

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
    success(`${product.name} x ${qty} added to cart!`);
  };

  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: product.name, url });
      } catch {
        // Sharing was dismissed.
      }
    } else {
      await navigator.clipboard.writeText(url);
      info("Link copied to clipboard!");
    }
  };

  const handleWishlist = () => {
    const added = toggleWishlist(product);
    success(added ? "Added to wishlist!" : "Removed from wishlist");
  };

  const handleCompare = () => {
    const added = toggleCompare(product);
    success(added ? "Added to compare" : "Removed from compare");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {product.isNew && (
          <span className="badge badge-new">
            <Zap size={11} /> New Arrival
          </span>
        )}
        {product.bestSeller && (
          <span className="badge badge-best">
            <Award size={11} /> Best Seller
          </span>
        )}
        {product.trending && (
          <span className="badge badge-hot">
            <Flame size={11} /> Trending
          </span>
        )}
        {hasDiscount && <span className="badge badge-sale">-{discountPct}% OFF</span>}
      </div>

      {product.category && (
        <Link
          href={`/products?category=${product.category.slug}`}
          className="text-xs font-bold text-primary uppercase tracking-widest hover:text-secondary transition-colors"
        >
          {product.category.name}
        </Link>
      )}

      <h1 className="font-display font-extrabold text-3xl md:text-4xl text-slate-900 leading-tight">
        {product.name}
      </h1>

      {product.avgRating !== undefined && (
        <div className="flex items-center gap-3">
          <StarRating rating={product.avgRating} count={product.reviewCount} size={18} />
          <span className="text-slate-400 text-sm">/</span>
          <a href="#reviews" className="text-sm text-primary hover:underline">
            Write a review
          </a>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-slate-500">
        {product.brand && (
          <span>
            <span className="font-semibold text-slate-700">Brand:</span> {product.brand}
          </span>
        )}
        {product.sku && (
          <span>
            <span className="font-semibold text-slate-700">SKU:</span> {product.sku}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-4">
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

      <div className="flex items-center gap-2">
        {isOutOfStock ? (
          <>
            <AlertCircle size={16} className="text-slate-400" />
            <span className="text-slate-400 font-medium text-sm">Out of Stock</span>
          </>
        ) : isLowStock ? (
          <>
            <AlertCircle size={16} className="text-amber-500" />
            <span className="text-amber-600 font-semibold text-sm">
              Only {product.quantity} left in stock!
            </span>
          </>
        ) : (
          <>
            <CheckCircle size={16} className="text-emerald-500" />
            <span className="text-emerald-600 font-semibold text-sm">In Stock</span>
          </>
        )}
      </div>

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

      {!isOutOfStock && (
        <div className="flex flex-col sm:flex-row gap-3">
          <CartQuantityControls quantity={qty} maxQuantity={product.quantity} onChange={setQty} size="md" />

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleAddToCart}
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "var(--gradient-primary)" }}
          >
            <ShoppingCart size={18} />
            Add to Cart - {formatPrice(discountedPrice * qty, product.currency)}
          </motion.button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleWishlist}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-500 transition-all"
        >
          <Heart size={17} className={favorited ? "fill-rose-500 text-rose-500" : ""} />
          Wishlist
        </button>
        <button
          onClick={handleCompare}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:border-primary hover:text-primary transition-all"
        >
          <Scale size={17} className={compared ? "text-primary" : ""} />
          Compare
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
          <MessageCircle size={17} />
          WhatsApp
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-2">
        {[
          { icon: Truck, text: "Fast Delivery", sub: "1-3 business days" },
          { icon: Shield, text: "Secure Payment", sub: "100% protected" },
          { icon: RotateCcw, text: "Easy Returns", sub: "14-day policy" },
        ].map(({ icon: Icon, text, sub }) => (
          <div
            key={text}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 text-center border border-slate-100"
          >
            <Icon size={20} className="text-primary" />
            <span className="text-xs font-bold text-slate-700">{text}</span>
            <span className="text-[10px] text-slate-400">{sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
