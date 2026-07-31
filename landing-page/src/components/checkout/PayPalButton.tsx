"use client";
import { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useCart } from "@/lib/cart";
import { Popup } from "@/stores/popupStore";
import { getErrorMessage } from "@/lib/utils";

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

export default function PayPalButton({ amount: _amount, currency, onSuccess, customerInfo }: PayPalButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const { clearCart, state: cartState } = useCart();

  const initialOptions = {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "test",
    currency: currency === "TZS" ? "USD" : currency,
    intent: "capture",
  };

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
            } catch (err: unknown) {
              const message = getErrorMessage(err, "Failed to create PayPal order");
              setError(message);
              Popup.error("PayPal Error", message, { text: "Try Again", onAction: () => Popup.close() });
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
                Popup.success("Payment Successful!", "Your PayPal payment was captured successfully.", { text: "OK", onAction: () => Popup.close() });
                clearCart();
                onSuccess(captureData.data.id);
              } else {
                throw new Error(captureData.error || "Failed to capture payment");
              }
            } catch (err: unknown) {
              const message = getErrorMessage(err, "Failed to capture PayPal payment");
              setError(message);
              Popup.error("Payment Failed", message, { text: "Close", onAction: () => Popup.close() });
            }
          }}
        />
      </PayPalScriptProvider>
    </div>
  );
}
