"use client";
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { CartItem, CartState } from "@/types";
import { calcDiscountedPrice } from "@/lib/utils";

// ─── Cart Actions ─────────────────────────────────────────────
type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "UPDATE_QTY"; payload: { id: string; quantity: number } }
  | { type: "CLEAR" }
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "TOGGLE" }
  | { type: "HYDRATE"; payload: CartItem[] };

// ─── Cart Reducer ─────────────────────────────────────────────
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, items: action.payload };
    case "ADD_ITEM": {
      const existing = state.items.find((i) => i.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === action.payload.id
              ? { ...i, quantity: Math.min(i.quantity + action.payload.quantity, i.maxQuantity) }
              : i
          ),
        };
      }
      return { ...state, items: [...state.items, action.payload] };
    }
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((i) => i.id !== action.payload) };
    case "UPDATE_QTY":
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === action.payload.id
            ? { ...i, quantity: Math.min(Math.max(1, action.payload.quantity), i.maxQuantity) }
            : i
        ),
      };
    case "CLEAR":
      return { ...state, items: [] };
    case "OPEN":
      return { ...state, isOpen: true };
    case "CLOSE":
      return { ...state, isOpen: false };
    case "TOGGLE":
      return { ...state, isOpen: !state.isOpen };
    default:
      return state;
  }
}

// ─── Selectors ────────────────────────────────────────────────
export function getCartTotals(items: CartItem[]) {
  const subtotal = items.reduce((sum, item) => {
    const effectivePrice = calcDiscountedPrice(item.price, item.discountType, item.discountValue);
    return sum + effectivePrice * item.quantity;
  }, 0);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const savings = items.reduce((sum, item) => {
    const discounted = calcDiscountedPrice(item.price, item.discountType, item.discountValue);
    return sum + (item.price - discounted) * item.quantity;
  }, 0);
  return { subtotal, totalItems, savings };
}

// ─── Context ──────────────────────────────────────────────────
interface CartContextValue {
  state: CartState;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  totals: ReturnType<typeof getCartTotals>;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────
const CART_KEY = "hq_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], isOpen: false });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      if (stored) dispatch({ type: "HYDRATE", payload: JSON.parse(stored) as CartItem[] });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(state.items)); }
    catch { /* ignore */ }
  }, [state.items]);

  const addItem = useCallback((item: CartItem) => {
    dispatch({ type: "ADD_ITEM", payload: item });
    dispatch({ type: "OPEN" });
  }, []);
  const removeItem = useCallback((id: string) => dispatch({ type: "REMOVE_ITEM", payload: id }), []);
  const updateQty = useCallback((id: string, quantity: number) =>
    dispatch({ type: "UPDATE_QTY", payload: { id, quantity } }), []);
  const clearCart = useCallback(() => dispatch({ type: "CLEAR" }), []);
  const openCart = useCallback(() => dispatch({ type: "OPEN" }), []);
  const closeCart = useCallback(() => dispatch({ type: "CLOSE" }), []);
  const toggleCart = useCallback(() => dispatch({ type: "TOGGLE" }), []);

  const totals = getCartTotals(state.items);
  const value: CartContextValue = {
    state, addItem, removeItem, updateQty,
    clearCart, openCart, closeCart, toggleCart, totals,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export default CartProvider;
