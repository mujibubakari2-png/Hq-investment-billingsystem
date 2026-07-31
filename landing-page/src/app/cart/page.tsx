"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Package, ShoppingBag, Trash2 } from "lucide-react";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import CartQuantityControls from "@/components/cart/CartQuantityControls";
import { useCart } from "@/lib/cart";
import { calcDiscountedPrice, formatPrice } from "@/lib/utils";
import type { CartItem } from "@/types";

export default function CartPage() {
  const [mounted, setMounted] = useState(false);
  const { state, removeItem, updateQty, clearCart, totals } = useCart();
  const currency = state.items[0]?.currency ?? "TZS";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 mb-8">
            <p className="text-sm font-semibold text-primary">Shopping Cart</p>
            <h1 className="font-display text-3xl sm:text-4xl font-black text-slate-900">
              Review Your Order
            </h1>
          </div>

          {state.items.length === 0 ? (
            <EmptyCart />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <section className="lg:col-span-8 space-y-4" aria-label="Cart items">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    {totals.totalItems} {totals.totalItems === 1 ? "item" : "items"} in your cart
                  </p>
                  <button
                    onClick={() => {
                      if (confirm("Clear cart?")) clearCart();
                    }}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-rose-500 hover:text-rose-700 transition-colors"
                  >
                    <Trash2 size={16} />
                    Clear Cart
                  </button>
                </div>

                {state.items.map((item) => (
                  <CartLineItem
                    key={item.id}
                    item={item}
                    onRemove={() => removeItem(item.id)}
                    onQuantityChange={(quantity) => updateQty(item.id, quantity)}
                  />
                ))}
              </section>

              <aside className="lg:col-span-4 lg:sticky lg:top-28">
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                  <h2 className="font-display text-xl font-bold text-slate-900 mb-5">Order Summary</h2>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-semibold text-slate-900">{formatPrice(totals.subtotal, currency)}</span>
                    </div>
                    {totals.savings > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Savings</span>
                        <span className="font-semibold">-{formatPrice(totals.savings, currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-600">
                      <span>Shipping</span>
                      <span className="font-semibold text-emerald-600">Free</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-4 text-lg">
                      <span className="font-bold text-slate-900">Total</span>
                      <span className="font-black text-slate-900">{formatPrice(totals.subtotal, currency)}</span>
                    </div>
                  </div>

                  <Link
                    href="/checkout"
                    className="mt-6 flex items-center justify-center gap-2 w-full py-4 rounded-full font-bold text-white text-sm transition-all hover:opacity-90 hover:-translate-y-0.5"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    Proceed to Checkout
                    <ArrowRight size={18} />
                  </Link>
                  <Link
                    href="/products"
                    className="mt-4 block text-center text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
                  >
                    Continue Shopping
                  </Link>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function EmptyCart() {
  return (
    <div className="min-h-[420px] flex flex-col items-center justify-center text-center bg-white border border-slate-100 rounded-2xl px-6">
      <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mb-5">
        <ShoppingBag size={40} className="text-slate-300" />
      </div>
      <h2 className="font-display text-2xl font-bold text-slate-900 mb-2">Your cart is empty</h2>
      <p className="text-slate-500 mb-8 max-w-sm">Add products to your cart and they will appear here for review.</p>
      <Link
        href="/products"
        className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold text-white transition-all hover:opacity-90"
        style={{ background: "var(--gradient-primary)" }}
      >
        Browse Products
        <ArrowRight size={18} />
      </Link>
    </div>
  );
}

function CartLineItem({
  item,
  onRemove,
  onQuantityChange,
}: {
  item: CartItem;
  onRemove: () => void;
  onQuantityChange: (quantity: number) => void;
}) {
  const effectivePrice = calcDiscountedPrice(item.price, item.discountType, item.discountValue);
  const isAtMax = item.quantity >= item.maxQuantity;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-[96px_1fr] sm:grid-cols-[104px_1fr_auto] gap-4 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"
    >
      <div className="relative w-24 h-24 sm:w-[104px] sm:h-[104px] rounded-xl overflow-hidden bg-slate-100">
        {item.image ? (
          <Image src={item.image} alt={item.name} fill className="object-cover" sizes="104px" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={30} className="text-slate-300" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        {item.category && (
          <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">{item.category}</p>
        )}
        <Link href={`/products/${item.slug}`}>
          <h3 className="font-bold text-slate-900 leading-snug hover:text-primary transition-colors">
            {item.name}
          </h3>
        </Link>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <CartQuantityControls
            quantity={item.quantity}
            maxQuantity={item.maxQuantity}
            onChange={onQuantityChange}
            size="md"
          />
          {isAtMax && <span className="text-xs font-semibold text-amber-600">Max stock reached</span>}
        </div>
      </div>

      <div className="col-span-2 sm:col-span-1 flex sm:flex-col items-center sm:items-end justify-between gap-3">
        <div className="text-left sm:text-right">
          <p className="font-black text-slate-900">
            {formatPrice(effectivePrice * item.quantity, item.currency)}
          </p>
          {item.discountValue && (
            <p className="text-xs text-slate-400 line-through">
              {formatPrice(item.price * item.quantity, item.currency)}
            </p>
          )}
        </div>
        <button
          onClick={onRemove}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-rose-500 transition-colors"
          aria-label={`Remove ${item.name}`}
        >
          <Trash2 size={16} />
          Remove
        </button>
      </div>
    </motion.article>
  );
}
