import crypto from "crypto";
import { MOBILE_MONEY_PROVIDERS, type MobileMoneyProvider } from "@/config/payments";
import { prisma } from "@/lib/prisma";
import { calcDiscountedPrice } from "@/lib/utils";

export interface CheckoutCustomerInfo {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
}

export interface CheckoutItemInput {
  productId: string;
  name?: string;
  quantity: number;
}

export interface ResolvedCheckoutItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomStr = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORD-${dateStr}-${randomStr}`;
}

export function normalizeMobileMoneyProvider(provider: unknown): MobileMoneyProvider {
  if (typeof provider !== "string") {
    throw new Error("Payment provider is required");
  }

  const normalized = provider.trim().toUpperCase();

  if (MOBILE_MONEY_PROVIDERS.includes(normalized as MobileMoneyProvider)) {
    return normalized as MobileMoneyProvider;
  }

  throw new Error(`Unsupported mobile money provider: ${provider}`);
}

export function parseCheckoutItems(value: unknown): CheckoutItemInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Cart is empty");
  }

  const merged = new Map<string, CheckoutItemInput>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid cart item");
    }

    const input = item as Partial<CheckoutItemInput>;
    const productId = typeof input.productId === "string" ? input.productId.trim() : "";
    const quantity = Number(input.quantity);

    if (!productId || !Number.isInteger(quantity) || quantity < 1) {
      throw new Error("Invalid cart item");
    }

    const existing = merged.get(productId);
    merged.set(productId, {
      productId,
      name: typeof input.name === "string" ? input.name : existing?.name,
      quantity: (existing?.quantity ?? 0) + quantity,
    });
  }

  return Array.from(merged.values());
}

export function parseCustomerInfo(value: unknown): CheckoutCustomerInfo {
  if (!value || typeof value !== "object") {
    throw new Error("Customer details are required");
  }

  const input = value as Partial<CheckoutCustomerInfo>;
  const name = typeof input.name === "string" ? input.name.trim() : "";

  if (!name) {
    throw new Error("Customer name is required");
  }

  return {
    name,
    email: typeof input.email === "string" ? input.email.trim() : undefined,
    phone: typeof input.phone === "string" ? input.phone.trim() : undefined,
    address: typeof input.address === "string" ? input.address.trim() : undefined,
    city: typeof input.city === "string" ? input.city.trim() : undefined,
  };
}

export async function resolveCheckoutItems(items: CheckoutItemInput[]) {
  const productIds = items.map((item) => item.productId);
  const dbProducts = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      status: "PUBLISHED",
      deletedAt: null,
    },
  });

  let totalTzs = 0;
  const orderItems: ResolvedCheckoutItem[] = [];

  for (const item of items) {
    const dbProduct = dbProducts.find((product) => product.id === item.productId);

    if (!dbProduct) {
      throw new Error(item.name ? `Product not found: ${item.name}` : "Product not found");
    }

    if (dbProduct.quantity < item.quantity) {
      throw new Error(`Only ${dbProduct.quantity} units of ${dbProduct.name} are available`);
    }

    const effectivePrice = calcDiscountedPrice(
      Number(dbProduct.price),
      dbProduct.discountType,
      dbProduct.discountValue ? Number(dbProduct.discountValue) : null,
    );
    const lineTotal = effectivePrice * item.quantity;
    totalTzs += lineTotal;

    orderItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: effectivePrice,
      total: lineTotal,
    });
  }

  if (totalTzs <= 0 || orderItems.length === 0) {
    throw new Error("Cart total is invalid");
  }

  return { totalTzs, orderItems };
}

export async function createEcomOrder({
  customerInfo,
  customerPhone,
  totalTzs,
  paymentMethod,
  paymentStatus = "PENDING",
  paymentRef,
  orderItems,
}: {
  customerInfo: CheckoutCustomerInfo;
  customerPhone?: string;
  totalTzs: number;
  paymentMethod: string;
  paymentStatus?: "PENDING" | "COMPLETED" | "FAILED";
  paymentRef?: string;
  orderItems: ResolvedCheckoutItem[];
}) {
  return prisma.ecomOrder.create({
    data: {
      orderNumber: generateOrderNumber(),
      customerName: customerInfo.name,
      customerEmail: customerInfo.email,
      customerPhone: customerPhone ?? customerInfo.phone,
      shippingAddress: customerInfo.address
        ? {
            street: customerInfo.address,
            city: customerInfo.city,
          }
        : undefined,
      totalAmount: totalTzs,
      status: paymentStatus === "COMPLETED" ? "PROCESSING" : "PENDING",
      paymentMethod,
      paymentStatus,
      paymentRef,
      items: {
        create: orderItems,
      },
    },
  });
}

export async function decrementStock(orderItems: ResolvedCheckoutItem[]) {
  await prisma.$transaction(async (tx) => {
    for (const item of orderItems) {
      const result = await tx.product.updateMany({
        where: {
          id: item.productId,
          quantity: { gte: item.quantity },
        },
        data: {
          quantity: { decrement: item.quantity },
        },
      });

      if (result.count !== 1) {
        throw new Error("Product stock changed before the order could be completed");
      }
    }
  });
}

export async function createPaidEcomOrderAndDecrementStock({
  customerInfo,
  totalTzs,
  paymentMethod,
  paymentRef,
  orderItems,
}: {
  customerInfo: CheckoutCustomerInfo;
  totalTzs: number;
  paymentMethod: string;
  paymentRef?: string;
  orderItems: ResolvedCheckoutItem[];
}) {
  return prisma.$transaction(async (tx) => {
    for (const item of orderItems) {
      const result = await tx.product.updateMany({
        where: {
          id: item.productId,
          quantity: { gte: item.quantity },
        },
        data: {
          quantity: { decrement: item.quantity },
        },
      });

      if (result.count !== 1) {
        throw new Error("Product stock changed before the order could be completed");
      }
    }

    return tx.ecomOrder.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone,
        shippingAddress: customerInfo.address
          ? {
              street: customerInfo.address,
              city: customerInfo.city,
            }
          : undefined,
        totalAmount: totalTzs,
        status: "PROCESSING",
        paymentMethod,
        paymentStatus: "COMPLETED",
        paymentRef,
        items: {
          create: orderItems,
        },
      },
    });
  });
}

export async function markOrderPaidAndDecrementStock(orderNumber: string) {
  const order = await prisma.ecomOrder.findUnique({
    where: { orderNumber },
    include: { items: true },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.paymentStatus === "COMPLETED") {
    return { alreadyCompleted: true };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.ecomOrder.updateMany({
      where: {
        id: order.id,
        paymentStatus: { not: "COMPLETED" },
      },
      data: {
        status: "PROCESSING",
        paymentStatus: "COMPLETED",
      },
    });

    if (updated.count !== 1) return;

    for (const item of order.items) {
      const stockUpdate = await tx.product.updateMany({
        where: {
          id: item.productId,
          quantity: { gte: item.quantity },
        },
        data: {
          quantity: { decrement: item.quantity },
        },
      });

      if (stockUpdate.count !== 1) {
        throw new Error("Product stock changed before the order could be completed");
      }
    }
  });

  return { alreadyCompleted: false };
}

export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const appSecret = process.env.PAYPAL_SECRET;
  const baseUrl = process.env.PAYPAL_API_BASE_URL || "https://api-m.sandbox.paypal.com";

  if (!clientId || !appSecret) {
    throw new Error("Missing PayPal credentials");
  }

  const auth = Buffer.from(`${clientId}:${appSecret}`).toString("base64");
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    body: "grant_type=client_credentials",
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });
  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error("Failed to authenticate with PayPal");
  }

  return data.access_token as string;
}
