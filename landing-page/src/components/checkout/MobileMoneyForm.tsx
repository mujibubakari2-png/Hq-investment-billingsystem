"use client";
import { useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { mobileMoneyProviderOptions, type MobileMoneyProvider } from "@/config/payments";
import { useCart } from "@/lib/cart";
import { Popup } from "@/stores/popupStore";
import { formatPrice, getErrorMessage } from "@/lib/utils";

interface MobileMoneyFormProps {
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

export default function MobileMoneyForm({ amount, currency, onSuccess, customerInfo }: MobileMoneyFormProps) {
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState(customerInfo.phone || "");
  const [provider, setProvider] = useState<MobileMoneyProvider>("PALMPESA");
  const { clearCart, state: cartState } = useCart();

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      Popup.warning("Validation Error", "Please enter a valid phone number");
      return;
    }

    setLoading(true);
    Popup.loading("Waiting for payment provider...");
    try {
      const res = await fetch("/api/public/checkout/mobile-money", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          provider,
          items: cartState.items,
          customerInfo,
        }),
      });
      const data = await res.json();

      if (data.success) {
        Popup.success("Payment Request Sent", "Check your phone and approve the payment prompt to complete the order.", { text: "OK", onAction: () => Popup.close() });
        clearCart();
        onSuccess(data.data.orderId);
      } else {
        throw new Error(data.error || "Payment failed");
      }
    } catch (err: unknown) {
      Popup.error("Payment Failed", getErrorMessage(err, "Payment failed"), { text: "Try Again", onAction: () => Popup.close() });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handlePayment} className="space-y-5 bg-slate-50 p-6 rounded-2xl border border-slate-100">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Select Provider</label>
        <div className="grid grid-cols-2 gap-3">
          {mobileMoneyProviderOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setProvider(option.value)}
              className={getProviderButtonClass(option.tone, provider === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Smartphone size={18} />
          </span>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 255750000000"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-700 transition-all"
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">Enter the number that will receive the payment prompt.</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white font-bold transition-all hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0"
        style={{ background: "var(--gradient-primary)" }}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Processing...
          </>
        ) : (
          `Pay ${formatPrice(amount, currency)}`
        )}
      </button>
    </form>
  );
}

function getProviderButtonClass(tone: "emerald" | "sky" | "amber" | "violet", active: boolean) {
  if (!active) {
    return "p-3 rounded-xl border-2 text-sm font-bold transition-all border-slate-200 text-slate-500 hover:border-slate-300 bg-white";
  }

  const toneClasses = {
    emerald: "border-emerald-500 bg-emerald-50 text-emerald-700",
    sky: "border-sky-500 bg-sky-50 text-sky-700",
    amber: "border-amber-500 bg-amber-50 text-amber-700",
    violet: "border-violet-500 bg-violet-50 text-violet-700",
  };

  return `p-3 rounded-xl border-2 text-sm font-bold transition-all ${toneClasses[tone]}`;
}
