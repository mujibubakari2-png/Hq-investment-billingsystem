// Utility function (usually from shadcn but we add our own)
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Calculate discounted price from product */
export function calcDiscountedPrice(
  price: number,
  discountType: string | null,
  discountValue: number | null
): number {
  if (!discountValue || !discountType) return price;
  if (discountType === "percent") {
    return price - (price * discountValue) / 100;
  }
  if (discountType === "fixed") {
    return Math.max(0, price - discountValue);
  }
  return price;
}

/** Calculate discount percentage for display */
export function calcDiscountPercent(
  price: number,
  discountType: string | null,
  discountValue: number | null
): number {
  if (!discountValue || !discountType) return 0;
  if (discountType === "percent") return discountValue;
  if (discountType === "fixed") {
    return Math.round((discountValue / price) * 100);
  }
  return 0;
}

/** Format price with currency */
export function formatPrice(amount: number, currency = "TZS"): string {
  const locales: Record<string, string> = {
    TZS: "sw-TZ",
    KES: "sw-KE",
    UGX: "sw-UG",
    USD: "en-US",
    EUR: "en-DE",
    GBP: "en-GB",
    ZAR: "en-ZA",
  };

  const locale = locales[currency] || "en-US";

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "TZS" || currency === "UGX" ? 0 : 2,
      maximumFractionDigits: currency === "TZS" || currency === "UGX" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/** Build query string from filters */
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== false) {
      q.set(key, String(value));
    }
  }
  return q.toString();
}

/** Truncate long text */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "…";
}

/** Get featured image URL from product images */
export function getFeaturedImage(images: Array<{ url: string; isFeatured?: boolean }>): string | null {
  if (!images || images.length === 0) return null;
  const featured = images.find((img) => img.isFeatured);
  return featured?.url ?? images[0]?.url ?? null;
}

/** Generate share URL */
export function generateShareUrl(slug: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/products/${slug}`;
}

/** WhatsApp share link */
export function whatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

/** Debounce function */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
