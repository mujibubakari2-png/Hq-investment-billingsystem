"use client";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";

export default function CartIcon() {
  const { toggleCart, totals } = useCart();
  const count = totals.totalItems;

  return (
    <button
      onClick={toggleCart}
      className="relative p-2.5 rounded-full hover:bg-slate-100 transition-all group"
      aria-label={`Shopping cart, ${count} items`}
      id="cart-toggle-btn"
    >
      <ShoppingCart
        size={22}
        className="text-slate-600 group-hover:text-primary transition-colors"
      />
      <AnimatePresence>
        {count > 0 && (
          <motion.span
            key="cart-badge"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", damping: 14, stiffness: 300 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-black text-white leading-none px-1"
            style={{ background: "var(--gradient-primary)" }}
          >
            {count > 99 ? "99+" : count}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
