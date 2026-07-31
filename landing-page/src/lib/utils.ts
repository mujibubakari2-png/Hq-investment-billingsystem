import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calcDiscountedPrice(
  price: number,
  discountType: string | null,
  discountValue: number | null,
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

export function calcDiscountPercent(
  price: number,
  discountType: string | null,
  discountValue: number | null,
): number {
  if (!discountValue || !discountType || price <= 0) return 0;
  if (discountType === "percent") return discountValue;
  if (discountType === "fixed") {
    return Math.round((discountValue / price) * 100);
  }
  return 0;
}

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

export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== false) {
      query.set(key, String(value));
    }
  }

  return query.toString();
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}...`;
}

export function getFeaturedImage(images: Array<{ url: string; isFeatured?: boolean }>): string | null {
  if (!images || images.length === 0) return null;
  const featured = images.find((image) => image.isFeatured);
  return featured?.url ?? images[0]?.url ?? null;
}

export function generateShareUrl(slug: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/products/${slug}`;
}

export function whatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  return error instanceof Error ? error.message : fallback;
}

export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => unknown,
  delay: number,
): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout>;

  return (...args: Args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}
