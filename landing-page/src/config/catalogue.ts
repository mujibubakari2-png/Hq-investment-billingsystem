import type { ProductFilters } from "@/types";

export const CATALOGUE_PAGE_SIZE = 16;
export const CATALOGUE_MAX_PAGE_SIZE = 50;
export const CATALOGUE_VISIBLE_PAGES = 7;

export const catalogueSortOptions = [
  { value: "latest", label: "Newest First" },
  { value: "popular", label: "Most Popular" },
  { value: "discount", label: "Biggest Discount" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
] as const satisfies ReadonlyArray<{
  value: NonNullable<ProductFilters["sort"]>;
  label: string;
}>;

export const ratingFilterOptions = [4, 3, 2, 1] as const;

export function getVisiblePageNumbers(currentPage: number, totalPages: number) {
  const visibleCount = Math.min(CATALOGUE_VISIBLE_PAGES, totalPages);
  const half = Math.floor(visibleCount / 2);
  const start = Math.max(1, Math.min(currentPage - half, totalPages - visibleCount + 1));

  return Array.from({ length: visibleCount }, (_, index) => start + index);
}
