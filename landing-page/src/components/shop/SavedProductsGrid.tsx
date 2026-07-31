"use client";

import Image from "next/image";
import Link from "next/link";
import { Package, ShoppingBag, Star, Trash2 } from "lucide-react";
import type { SavedProduct } from "@/lib/commerce";
import { formatPrice } from "@/lib/utils";

interface SavedProductsGridProps {
  products: SavedProduct[];
  emptyTitle: string;
  emptyText: string;
  removeLabel: string;
  onRemove?: (id: string) => void;
}

export default function SavedProductsGrid({
  products,
  emptyTitle,
  emptyText,
  removeLabel,
  onRemove,
}: SavedProductsGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
          <ShoppingBag size={30} />
        </div>
        <h2 className="font-display text-2xl font-bold text-slate-950">{emptyTitle}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{emptyText}</p>
        <Link
          href="/products"
          className="mt-6 inline-flex rounded-full px-6 py-3 text-sm font-bold text-white"
          style={{ background: "var(--gradient-primary)" }}
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((product) => (
        <article key={product.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <Link href={`/products/${product.slug}`} className="relative block overflow-hidden rounded-2xl bg-slate-50" style={{ aspectRatio: "1/1" }}>
            {product.image ? (
              <Image src={product.image} alt={product.name} fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                <Package size={44} />
              </div>
            )}
          </Link>
          <div className="pt-4">
            {product.category && (
              <p className="text-xs font-bold uppercase tracking-widest text-primary">{product.category}</p>
            )}
            <Link href={`/products/${product.slug}`}>
              <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-slate-900 hover:text-primary">
                {product.name}
              </h3>
            </Link>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              {product.rating ? (
                <>
                  <Star size={13} className="fill-amber-400 text-amber-400" />
                  <span>{product.rating.toFixed(1)} ({product.reviewCount ?? 0})</span>
                </>
              ) : (
                <span>{product.sku ? `SKU: ${product.sku}` : product.brand ?? "Verified product"}</span>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-lg font-black text-slate-950">
                {formatPrice(product.price, product.currency)}
              </span>
              {onRemove && (
                <button
                  onClick={() => onRemove(product.id)}
                  className="rounded-full border border-slate-200 p-2 text-slate-400 hover:border-rose-200 hover:text-rose-500"
                  aria-label={`${removeLabel} ${product.name}`}
                  title={removeLabel}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
