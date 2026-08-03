DO $ $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductStatus') THEN
    CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'SCHEDULED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus') THEN
    CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StockMovementType') THEN
    CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUST');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EcomCustomerStatus') THEN
    CREATE TYPE "EcomCustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromotionType') THEN
    CREATE TYPE "PromotionType" AS ENUM ('DISCOUNT', 'BOGO', 'FREE_SHIPPING', 'BUNDLE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromotionStatus') THEN
    CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SCHEDULED', 'EXPIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MediaAssetType') THEN
    CREATE TYPE "MediaAssetType" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'OTHER');
  END IF;
END
$$;

-- Migration: 20260803_add_ecommerce_cms_tables
-- Purpose: Creates 26 ecommerce and CMS tables that exist in schema.prisma but not in DB.

CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "banners" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "linkText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "blog_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author" TEXT,
    "coverImageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "collections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "bannerUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'percent',
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiryDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "custom_pages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ecom_customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "totalSpent" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "status" "EcomCustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ecom_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ecom_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ecom_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ecom_orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "shippingAddress" JSONB,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "customerId" TEXT,

    CONSTRAINT "ecom_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "faqs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT DEFAULT 'general',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "flash_sales" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "discountPercentage" DECIMAL(5,2) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flash_sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "media_assets" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileType" "MediaAssetType" NOT NULL DEFAULT 'OTHER',
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT,
    "altText" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "menu_items" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "menus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "image" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "product_images" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "categoryId" TEXT,
    "brandId" TEXT,
    "collectionId" TEXT,
    "warehouseId" TEXT,
    "taxClassId" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "discountType" TEXT DEFAULT 'percent',
    "discountValue" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "specifications" JSONB,
    "tags" TEXT[],
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "trending" BOOLEAN NOT NULL DEFAULT false,
    "bestSeller" BOOLEAN NOT NULL DEFAULT false,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "metaKeywords" TEXT[],
    "ogImage" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "promotions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PromotionType" NOT NULL DEFAULT 'DISCOUNT',
    "status" "PromotionStatus" NOT NULL DEFAULT 'DRAFT',
    "discountValue" DECIMAL(12,2),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reviews" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "email" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "shipping_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "referenceId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "tax_classes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratePercentage" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_classes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "testimonials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "company" TEXT,
    "content" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ecom_order_items" ADD CONSTRAINT "ecom_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ecom_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ecom_order_items" ADD CONSTRAINT "ecom_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ecom_orders" ADD CONSTRAINT "ecom_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "ecom_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "products" ADD CONSTRAINT "products_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "products" ADD CONSTRAINT "products_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "products" ADD CONSTRAINT "products_taxClassId_fkey" FOREIGN KEY ("taxClassId") REFERENCES "tax_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_keyHash_key" ON "api_keys"("keyHash");

CREATE INDEX IF NOT EXISTS "banners_isActive_idx" ON "banners"("isActive");

CREATE INDEX IF NOT EXISTS "banners_position_idx" ON "banners"("position");

CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_slug_key" ON "blog_posts"("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_key" ON "coupons"("code");

CREATE UNIQUE INDEX IF NOT EXISTS "custom_pages_slug_key" ON "custom_pages"("slug");

CREATE INDEX IF NOT EXISTS "custom_pages_slug_idx" ON "custom_pages"("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "ecom_customers_email_key" ON "ecom_customers"("email");

CREATE INDEX IF NOT EXISTS "ecom_customers_email_idx" ON "ecom_customers"("email");

CREATE INDEX IF NOT EXISTS "ecom_customers_status_idx" ON "ecom_customers"("status");

CREATE INDEX IF NOT EXISTS "ecom_order_items_orderId_idx" ON "ecom_order_items"("orderId");

CREATE INDEX IF NOT EXISTS "ecom_order_items_productId_idx" ON "ecom_order_items"("productId");

CREATE UNIQUE INDEX IF NOT EXISTS "ecom_orders_orderNumber_key" ON "ecom_orders"("orderNumber");

CREATE INDEX IF NOT EXISTS "ecom_orders_orderNumber_idx" ON "ecom_orders"("orderNumber");

CREATE INDEX IF NOT EXISTS "ecom_orders_status_idx" ON "ecom_orders"("status");

CREATE INDEX IF NOT EXISTS "ecom_orders_paymentStatus_idx" ON "ecom_orders"("paymentStatus");

CREATE INDEX IF NOT EXISTS "ecom_orders_customerEmail_idx" ON "ecom_orders"("customerEmail");

CREATE INDEX IF NOT EXISTS "ecom_orders_customerId_idx" ON "ecom_orders"("customerId");

CREATE INDEX IF NOT EXISTS "ecom_orders_createdAt_idx" ON "ecom_orders"("createdAt");

CREATE INDEX IF NOT EXISTS "faqs_isActive_idx" ON "faqs"("isActive");

CREATE INDEX IF NOT EXISTS "faqs_category_idx" ON "faqs"("category");

CREATE INDEX IF NOT EXISTS "media_assets_fileType_idx" ON "media_assets"("fileType");

CREATE INDEX IF NOT EXISTS "menu_items_menuId_idx" ON "menu_items"("menuId");

CREATE UNIQUE INDEX IF NOT EXISTS "menus_slug_key" ON "menus"("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

CREATE INDEX IF NOT EXISTS "newsletter_subscribers_email_idx" ON "newsletter_subscribers"("email");

CREATE INDEX IF NOT EXISTS "newsletter_subscribers_isActive_idx" ON "newsletter_subscribers"("isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "product_categories_slug_key" ON "product_categories"("slug");

CREATE INDEX IF NOT EXISTS "product_categories_slug_idx" ON "product_categories"("slug");

CREATE INDEX IF NOT EXISTS "product_categories_isActive_idx" ON "product_categories"("isActive");

CREATE INDEX IF NOT EXISTS "product_images_productId_idx" ON "product_images"("productId");

CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_key" ON "products"("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_key" ON "products"("sku");

CREATE INDEX IF NOT EXISTS "products_slug_idx" ON "products"("slug");

CREATE INDEX IF NOT EXISTS "products_categoryId_idx" ON "products"("categoryId");

CREATE INDEX IF NOT EXISTS "products_brandId_idx" ON "products"("brandId");

CREATE INDEX IF NOT EXISTS "products_collectionId_idx" ON "products"("collectionId");

CREATE INDEX IF NOT EXISTS "products_status_idx" ON "products"("status");

CREATE INDEX IF NOT EXISTS "products_featured_idx" ON "products"("featured");

CREATE INDEX IF NOT EXISTS "products_trending_idx" ON "products"("trending");

CREATE INDEX IF NOT EXISTS "products_bestSeller_idx" ON "products"("bestSeller");

CREATE INDEX IF NOT EXISTS "products_createdAt_idx" ON "products"("createdAt");

CREATE INDEX IF NOT EXISTS "products_deletedAt_idx" ON "products"("deletedAt");

CREATE INDEX IF NOT EXISTS "promotions_status_idx" ON "promotions"("status");

CREATE INDEX IF NOT EXISTS "promotions_type_idx" ON "promotions"("type");

CREATE INDEX IF NOT EXISTS "reviews_productId_idx" ON "reviews"("productId");

CREATE INDEX IF NOT EXISTS "reviews_isApproved_idx" ON "reviews"("isApproved");

CREATE INDEX IF NOT EXISTS "stock_movements_productId_idx" ON "stock_movements"("productId");

CREATE INDEX IF NOT EXISTS "stock_movements_type_idx" ON "stock_movements"("type");

CREATE INDEX IF NOT EXISTS "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");

CREATE INDEX IF NOT EXISTS "testimonials_isActive_idx" ON "testimonials"("isActive");




