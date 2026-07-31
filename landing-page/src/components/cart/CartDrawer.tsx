"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Trash2, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import CartQuantityControls from "@/components/cart/CartQuantityControls";
import { useCart } from "@/lib/cart";
import { formatPrice, calcDiscountedPrice } from "@/lib/utils";

function EmptyCart() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 py-16 px-8 text-center">
      <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center">
        <ShoppingBag size={40} className="text-slate-300" />
      </div>
      <div>
        <p className="font-bold text-slate-800 text-xl mb-1">Your cart is empty</p>
        <p className="text-slate-500 text-sm">Add products to get started</p>
      </div>
      <Link
        href="/products"
        className="btn-primary px-8 py-3 text-sm font-semibold"
        style={{ background: "var(--gradient-primary)", color: "white", borderRadius: "var(--radius-full)" }}
      >
        Browse Products
      </Link>
    </div>
  );
}

export default function CartDrawer() {
  const { state, closeCart, removeItem, updateQty, clearCart, totals } = useCart();
  const { items, isOpen } = state;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="cart-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="cart-overlay"
            onClick={closeCart}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            key="cart-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="cart-drawer"
            role="dialog"
            aria-label="Shopping cart"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <ShoppingBag size={22} className="text-primary" />
                <h2 className="font-bold text-slate-900 text-lg">
                  Cart
                  {totals.totalItems > 0 && (
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      ({totals.totalItems} {totals.totalItems === 1 ? "item" : "items"})
                    </span>
                  )}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {items.length > 0 && (
                  <button
                    onClick={() => { if (confirm("Clear cart?")) clearCart(); }}
                    className="text-xs text-slate-400 hover:text-rose-500 transition-colors px-2 py-1"
                    aria-label="Clear cart"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={closeCart}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-all"
                  aria-label="Close cart"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <EmptyCart />
              ) : (
                <AnimatePresence initial={false}>
                  <div className="space-y-3">
                    {items.map((item) => {
                      const effectivePrice = calcDiscountedPrice(
                        item.price,
                        item.discountType,
                        item.discountValue
                      );
                      return (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex gap-3 p-3 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md transition-all"
                        >
                          {/* Image */}
                          <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-white border border-slate-100">
                            {item.image ? (
                              <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                className="object-cover"
                                sizes="80px"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                <Package size={24} className="text-slate-300" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/products/${item.slug}`}
                              className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2 hover:text-primary transition-colors"
                              onClick={closeCart}
                            >
                              {item.name}
                            </Link>
                            {item.category && (
                              <p className="text-xs text-slate-400 mt-0.5">{item.category}</p>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              {/* Qty controls */}
                              <CartQuantityControls
                                quantity={item.quantity}
                                maxQuantity={item.maxQuantity}
                                onChange={(quantity) => updateQty(item.id, quantity)}
                              />

                              {/* Price */}
                              <div className="text-right">
                                <p className="font-bold text-slate-900 text-sm">
                                  {formatPrice(effectivePrice * item.quantity, item.currency)}
                                </p>
                                {item.discountValue && (
                                  <p className="text-xs text-slate-400 line-through">
                                    {formatPrice(item.price * item.quantity, item.currency)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Remove */}
                          <button
                            onClick={() => removeItem(item.id)}
                            className="self-start p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-5 space-y-4 bg-white">
                {/* Savings */}
                {totals.savings > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600 font-medium">You save</span>
                    <span className="text-emerald-600 font-bold">
                      -{formatPrice(totals.savings, items[0]?.currency)}
                    </span>
                  </div>
                )}
                
                {/* Subtotal */}
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Subtotal</span>
                  <span className="text-2xl font-black text-slate-900">
                    {formatPrice(totals.subtotal, items[0]?.currency)}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Shipping & taxes calculated at checkout</p>

                {/* Checkout Button */}
                <Link
                  href="/checkout"
                  onClick={closeCart}
                  className="flex items-center justify-center gap-2 w-full py-4 rounded-full font-bold text-white text-sm transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-95"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  Proceed to Checkout
                </Link>
                <Link
                  href="/products"
                  onClick={closeCart}
                  className="block text-center text-sm text-slate-500 hover:text-primary transition-colors mt-4"
                >
                  Continue Shopping
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
