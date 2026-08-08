"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "@/types";
import { getFeaturedImage } from "@/lib/utils";

export interface SavedProduct {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  brand: string | null;
  category: string | null;
  price: number;
  currency: string;
  rating?: number;
  reviewCount?: number;
  quantity: number;
  sku: string | null;
  savedAt: number;
}

interface CommerceContextValue {
  wishlist: SavedProduct[];
  compare: SavedProduct[];
  recentlyViewed: SavedProduct[];
  isWishlisted: (id: string) => boolean;
  isCompared: (id: string) => boolean;
  toggleWishlist: (product: Product) => boolean;
  toggleCompare: (product: Product) => boolean;
  removeWishlist: (id: string) => void;
  removeCompare: (id: string) => void;
  clearWishlist: () => void;
  clearCompare: () => void;
  trackViewed: (product: Product) => void;
  clearRecentlyViewed: () => void;
}

const WISHLIST_KEY = "hq_wishlist_v1";
const COMPARE_KEY = "hq_compare_v1";
const RECENT_KEY = "hq_recently_viewed_v1";
const COMPARE_LIMIT = 4;
const RECENT_LIMIT = 12;

const CommerceContext = createContext<CommerceContextValue | null>(null);

function productToSaved(product: Product): SavedProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    image: getFeaturedImage(product.images),
    brand: product.brand?.name ?? null,
    category: product.category?.name ?? null,
    price: Number(product.price),
    currency: product.currency,
    rating: product.avgRating,
    reviewCount: product.reviewCount,
    quantity: product.quantity,
    sku: product.sku,
    savedAt: Date.now(),
  };
}

function isSavedProduct(value: unknown): value is SavedProduct {
  if (!value || typeof value !== "object") return false;

  const item = value as Partial<SavedProduct>;

  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.slug === "string" &&
    typeof item.price === "number" &&
    typeof item.currency === "string" &&
    typeof item.quantity === "number" &&
    typeof item.savedAt === "number"
  );
}

function readStored(key: string): SavedProduct[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isSavedProduct) : [];
  } catch {
    return [];
  }
}

function writeStored(key: string, value: SavedProduct[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing or locked-down environments.
  }
}

export function CommerceProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<SavedProduct[]>([]);
  const [compare, setCompare] = useState<SavedProduct[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<SavedProduct[]>([]);

  useEffect(() => {
    setWishlist(readStored(WISHLIST_KEY));
    setCompare(readStored(COMPARE_KEY));
    setRecentlyViewed(readStored(RECENT_KEY));
  }, []);

  useEffect(() => writeStored(WISHLIST_KEY, wishlist), [wishlist]);
  useEffect(() => writeStored(COMPARE_KEY, compare), [compare]);
  useEffect(() => writeStored(RECENT_KEY, recentlyViewed), [recentlyViewed]);

  const isWishlisted = useCallback(
    (id: string) => wishlist.some((item) => item.id === id),
    [wishlist],
  );

  const isCompared = useCallback(
    (id: string) => compare.some((item) => item.id === id),
    [compare],
  );

  const toggleWishlist = useCallback((product: Product) => {
    const added = !wishlist.some((item) => item.id === product.id);
    setWishlist((items) => {
      if (items.some((item) => item.id === product.id)) {
        return items.filter((item) => item.id !== product.id);
      }
      return [productToSaved(product), ...items];
    });
    return added;
  }, [wishlist]);

  const toggleCompare = useCallback((product: Product) => {
    const added = !compare.some((item) => item.id === product.id);
    setCompare((items) => {
      if (items.some((item) => item.id === product.id)) {
        return items.filter((item) => item.id !== product.id);
      }
      return [productToSaved(product), ...items].slice(0, COMPARE_LIMIT);
    });
    return added;
  }, [compare]);

  const trackViewed = useCallback((product: Product) => {
    setRecentlyViewed((items) => {
      const next = [productToSaved(product), ...items.filter((item) => item.id !== product.id)];
      return next.slice(0, RECENT_LIMIT);
    });
  }, []);

  const value = useMemo<CommerceContextValue>(
    () => ({
      wishlist,
      compare,
      recentlyViewed,
      isWishlisted,
      isCompared,
      toggleWishlist,
      toggleCompare,
      removeWishlist: (id) => setWishlist((items) => items.filter((item) => item.id !== id)),
      removeCompare: (id) => setCompare((items) => items.filter((item) => item.id !== id)),
      clearWishlist: () => setWishlist([]),
      clearCompare: () => setCompare([]),
      trackViewed,
      clearRecentlyViewed: () => setRecentlyViewed([]),
    }),
    [compare, isCompared, isWishlisted, recentlyViewed, toggleCompare, toggleWishlist, trackViewed, wishlist],
  );

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const context = useContext(CommerceContext);
  if (!context) throw new Error("useCommerce must be used within CommerceProvider");
  return context;
}
