"use client";
import { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useCart } from "@/lib/cart";
import { useToast } from "@/components/ui/Toast";

interface PayPalButtonProps {
  amount: number;
  currency: string;
  onSuccess: (orderId: string) => void;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
    address?: string;
  };
}

export default function PayPalButton({ amount, currency, onSuccess, customerInfo }: PayPalButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const { clearCart, state: cartState } = useCart();
  const { error: toastError } = useToast();

  const initialOptions = {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "test",
    currency: currency === "TZS" ? "USD" : currency,
    intent: "capture",
  };

  // Note: PayPal doesn't support TZS directly. If currency is TZS, we convert to USD for PayPal.
  // In a real app, you should fetch a live exchange rate. Here we use a fixed rate of 2500 TZS = 1 USD for demonstration.
  const paypalAmount = currency === "TZS" ? (amount / 2500).toFixed(2) : amount.toFixed(2);

  return (
    <div className="w-full">
      {error && <div className="p-3 mb-4 text-sm text-rose-600 bg-rose-50 rounded-lg">{error}</div>}
      <PayPalScriptProvider options={initialOptions}>
        <PayPalButtons
          style={{ layout: "vertical", shape: "rect", color: "blue" }}
          createOrder={async (data, actions) => {
            try {
              const res = await fetch("/api/public/checkout/paypal/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  items: cartState.items,
                  customerInfo,
                }),
              });
              const orderData = await res.json();

              if (!orderData.success) {
                throw new Error(orderData.error || "Failed to create order");
              }
              return orderData.id; // Return PayPal Order ID
            } catch (err: any) {
              setError(err.message);
              toastError(err.message);
              throw err;
            }
          }}
          onApprove={async (data, actions) => {
            try {
              const res = await fetch("/api/public/checkout/paypal/capture-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderID: data.orderID,
                  items: cartState.items,
                  customerInfo,
                }),
              });
              const captureData = await res.json();

              if (captureData.success) {
                clearCart();
                onSuccess(captureData.data.id);
              } else {
                throw new Error(captureData.error || "Failed to capture payment");
              }
            } catch (err: any) {
              setError(err.message);
              toastError(err.message);
            }
          }}
        />
      </PayPalScriptProvider>
    </div>
  );
}
