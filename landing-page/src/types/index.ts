// E-commerce TypeScript types

export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED" | "SCHEDULED";

export interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
  sortOrder: number;
  isFeatured: boolean;
  productId: string;
  createdAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  image: string | null;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { products: number };
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  brand: string | null;
  price: string | number;
  discountType: string | null;
  discountValue: string | number | null;
  currency: string;
  quantity: number;
  description: string | null;
  specifications: Record<string, string>[] | null;
  tags: string[];
  status: ProductStatus;
  featured: boolean;
  trending: boolean;
  bestSeller: boolean;
  isNew: boolean;
  viewCount: number;
  clickCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  metaKeywords: string[];
  ogImage: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  category: { id: string; name: string; slug: string } | null;
  images: ProductImage[];
  avgRating?: number;
  reviewCount?: number;
}

export interface Review {
  id: string;
  productId: string;
  authorName: string;
  email: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Banner {
  id: string;
  title: string | null;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  linkText: string | null;
  position: number;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  content: string;
  avatarUrl: string | null;
  rating: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  price: number;
  discountType: string | null;
  discountValue: number | null;
  currency: string;
  quantity: number;
  maxQuantity: number;
  category: string | null;
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  search?: string;
  sort?: "latest" | "popular" | "discount" | "price-asc" | "price-desc";
  featured?: boolean;
  trending?: boolean;
  bestSeller?: boolean;
  page?: number;
  limit?: number;
}

export interface Stats {
  products: number;
  customers: number;
  orders: number;
  yearsInBusiness: number;
}

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}
