"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ArrowLeft, ShieldCheck, CheckCircle2,
  Tag, Truck, Loader2, X, Percent
} from "lucide-react";
import { useCart, getCartTotals } from "@/lib/cart";
import { formatPrice, getFeaturedImage, calcDiscountedPrice } from "@/lib/utils";
import PayPalButton from "@/components/checkout/PayPalButton";
import MobileMoneyForm from "@/components/checkout/MobileMoneyForm";

// ─── Types ───────────────────────────────────────────────────────
interface ShippingZone {
  id: string;
  name: string;
  rate: number;
}

interface CouponResult {
  code: string;
  discountType: string;
  discountAmount: number;
  discountApplied: number;
  message: string;
}

// ─── Page ─────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const router = useRouter();
  const { state: cartState } = useCart();
  const [mounted, setMounted] = useState(false);

  // Checkout steps
  const [step, setStep] = useState<1 | 2>(1);
  const [paymentMethod, setPaymentMethod] = useState<"MOBILE_MONEY" | "PAYPAL" | null>(null);
  const [orderCompleteId, setOrderCompleteId] = useState<string | null>(null);

  // Form
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
  });

  // Shipping
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [shippingRate, setShippingRate] = useState<number>(0);
  const [shippingLoading, setShippingLoading] = useState(true);

  // Tax
  const [taxRate, setTaxRate] = useState<number>(0); // percentage e.g. 18
  const [taxName, setTaxName] = useState<string>("VAT");

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<CouponResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Fetch shipping zones & tax rates on mount
  useEffect(() => {
    async function loadRates() {
      setShippingLoading(true);
      try {
        const [shRes, txRes] = await Promise.all([
          fetch("/api/public/shipping-zones"),
          fetch("/api/public/tax-rates"),
        ]);

        if (shRes.ok) {
          const shData = await shRes.json();
          const zones: ShippingZone[] = shData.data ?? [];
          setShippingZones(zones);
          // Pre-select first zone
          if (zones.length > 0) {
            setSelectedZoneId(zones[0].id);
            setShippingRate(zones[0].rate);
          }
        }

        if (txRes.ok) {
          const txData = await txRes.json();
          if (txData.data && txData.data.length > 0) {
            setTaxRate(txData.data[0].ratePercentage);
            setTaxName(txData.data[0].name);
          }
        }
      } catch {
        // Silently ignore — shipping will stay at 0
      } finally {
        setShippingLoading(false);
      }
    }
    loadRates();
  }, []);

  // When city changes, auto-match a shipping zone by name
  useEffect(() => {
    if (!formData.city || shippingZones.length === 0) return;
    const cityLower = formData.city.toLowerCase();
    const matched = shippingZones.find((z) =>
      z.name.toLowerCase().includes(cityLower) || cityLower.includes(z.name.toLowerCase()),
    );
    if (matched) {
      setSelectedZoneId(matched.id);
      setShippingRate(matched.rate);
    }
  }, [formData.city, shippingZones]);

  // When selectedZoneId changes, update rate
  useEffect(() => {
    const zone = shippingZones.find((z) => z.id === selectedZoneId);
    if (zone) setShippingRate(zone.rate);
  }, [selectedZoneId, shippingZones]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  // ─── Totals (declared before useCallback to avoid TS2448) ──────
  const { subtotal } = getCartTotals(cartState.items);
  const currency = cartState.items[0]?.currency ?? "TZS";
  const couponDiscount = couponApplied?.discountApplied ?? 0;
  const taxableAmount = subtotal - couponDiscount;
  const taxAmount = taxRate > 0 ? Math.round((taxableAmount * taxRate) / 100 * 100) / 100 : 0;
  const total = Math.max(0, taxableAmount + shippingRate + taxAmount);

  // Coupon handler
  const handleApplyCoupon = useCallback(async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    setCouponApplied(null);

    try {
      const res = await fetch("/api/public/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim(), subtotal }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setCouponError(data.error ?? "Invalid coupon code");
      } else {
        setCouponApplied(data.data as CouponResult);
      }
    } catch {
      setCouponError("Failed to validate coupon. Please try again.");
    } finally {
      setCouponLoading(false);
    }
  }, [couponCode, subtotal]);

  const removeCoupon = () => {
    setCouponApplied(null);
    setCouponCode("");
    setCouponError(null);
  };

  // ─── Mount guard ──────────────────────────────────────────────
  if (!mounted) return null;

  // ─── Order complete ───────────────────────────────────────────
  if (orderCompleteId) {
    return (
      <div className="min-h-screen pt-24 pb-16 bg-slate-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 mb-2">Order Received!</h1>
          <p className="text-slate-500 mb-8 text-sm sm:text-base">
            Thank you for your purchase. Your order ID is{" "}
            <span className="font-bold text-slate-800">#{orderCompleteId.substring(0, 8).toUpperCase()}</span>.
            Mobile money orders are completed after provider confirmation.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center justify-center w-full py-4 rounded-xl text-white font-bold transition-all hover:opacity-90"
            style={{ background: "var(--gradient-primary)" }}
          >
            Continue Shopping
          </Link>
        </motion.div>
      </div>
    );
  }

  // ─── Empty cart ───────────────────────────────────────────────
  if (cartState.items.length === 0) {
    return (
      <div className="min-h-screen pt-24 pb-16 bg-slate-50 flex flex-col items-center justify-center px-4">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 mb-4">Your Cart is Empty</h1>
        <p className="text-slate-500 mb-8 text-center">Add some items to your cart before checking out.</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-full font-semibold hover:border-slate-300 transition-colors"
        >
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    );
  }

  // ─── Main checkout ────────────────────────────────────────────
  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-16 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <nav className="flex items-center text-sm text-slate-500 mb-6 sm:mb-8 overflow-x-auto">
          <Link href="/products" className="hover:text-primary transition-colors whitespace-nowrap">Shop</Link>
          <ChevronRight size={16} className="mx-1.5 shrink-0" />
          <span className={`whitespace-nowrap ${step === 1 ? "text-slate-900 font-semibold" : ""}`}>Information</span>
          <ChevronRight size={16} className="mx-1.5 shrink-0" />
          <span className={`whitespace-nowrap ${step === 2 ? "text-slate-900 font-semibold" : ""}`}>Payment</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">

          {/* ── Left: Form & Payment ────────────────────────────── */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">

              {/* Step 1: Customer Info */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100"
                >
                  <div className="flex items-center justify-between mb-6 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">Contact Details</h2>
                    <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">Step 1 of 2</span>
                  </div>

                  <form onSubmit={handleNextStep} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name *</label>
                        <input
                          type="text" name="name" required
                          value={formData.name} onChange={handleInputChange}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address *</label>
                        <input
                          type="email" name="email" required
                          value={formData.email} onChange={handleInputChange}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number *</label>
                      <input
                        type="tel" name="phone" required
                        value={formData.phone} onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                        placeholder="+255 700 000 000"
                      />
                    </div>

                    <div className="border-t border-slate-100 pt-5">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-4">Shipping Address</h3>
                      <div className="space-y-5">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Street Address *</label>
                          <input
                            type="text" name="address" required
                            value={formData.address} onChange={handleInputChange}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                            placeholder="123 Main St, Apartment 4B"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">City / Region *</label>
                          <input
                            type="text" name="city" required
                            value={formData.city} onChange={handleInputChange}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors text-sm"
                            placeholder="Dar es Salaam"
                          />
                          {/* Auto-matched shipping zone hint */}
                          {formData.city && shippingZones.length > 0 && (
                            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                              <Truck size={11} />
                              {shippingZones.find((z) => z.id === selectedZoneId)?.name ?? "Standard"} shipping selected
                            </p>
                          )}
                        </div>

                        {/* Manual shipping zone selector */}
                        {shippingZones.length > 1 && (
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                              <Truck size={14} className="inline mr-1" />
                              Shipping Zone
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {shippingZones.map((zone) => (
                                <label
                                  key={zone.id}
                                  className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all text-sm ${
                                    selectedZoneId === zone.id
                                      ? "border-primary bg-primary/5"
                                      : "border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name="shippingZone"
                                      value={zone.id}
                                      checked={selectedZoneId === zone.id}
                                      onChange={() => setSelectedZoneId(zone.id)}
                                      className="w-4 h-4 text-primary focus:ring-primary"
                                    />
                                    <span className="font-medium text-slate-800">{zone.name}</span>
                                  </div>
                                  <span className="font-bold text-slate-700">
                                    {zone.rate === 0 ? (
                                      <span className="text-emerald-600">Free</span>
                                    ) : (
                                      formatPrice(zone.rate, currency)
                                    )}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full flex items-center justify-center py-4 rounded-xl text-white font-bold transition-all hover:opacity-90 text-sm sm:text-base"
                        style={{ background: "var(--gradient-primary)" }}
                      >
                        Continue to Payment
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* Step 2: Payment */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100"
                >
                  <div className="flex items-center justify-between mb-6 sm:mb-8">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setStep(1)}
                        className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                      >
                        <ArrowLeft size={20} />
                      </button>
                      <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">Payment</h2>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1">
                      <ShieldCheck size={14} /> Secure
                    </span>
                  </div>

                  {/* Payment Method Selection */}
                  <div className="space-y-3 mb-6 sm:mb-8">
                    <label className={`block border-2 rounded-2xl p-4 cursor-pointer transition-all ${
                      paymentMethod === "MOBILE_MONEY" ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio" name="paymentMethod"
                            checked={paymentMethod === "MOBILE_MONEY"}
                            onChange={() => setPaymentMethod("MOBILE_MONEY")}
                            className="w-5 h-5 text-primary focus:ring-primary border-slate-300"
                          />
                          <span className="font-bold text-slate-900 text-sm sm:text-base">Mobile Money</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-xs font-bold bg-emerald-600 text-white px-2 py-1 rounded">PalmPesa</span>
                          <span className="text-xs font-bold bg-sky-600 text-white px-2 py-1 rounded">ZenoPay</span>
                        </div>
                      </div>
                    </label>

                    <label className={`block border-2 rounded-2xl p-4 cursor-pointer transition-all ${
                      paymentMethod === "PAYPAL" ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio" name="paymentMethod"
                            checked={paymentMethod === "PAYPAL"}
                            onChange={() => setPaymentMethod("PAYPAL")}
                            className="w-5 h-5 text-primary focus:ring-primary border-slate-300"
                          />
                          <span className="font-bold text-slate-900 text-sm sm:text-base">PayPal or Credit Card</span>
                        </div>
                        <span className="text-sm font-bold text-[#003087]">PayPal</span>
                      </div>
                    </label>
                  </div>

                  {/* Payment form injection */}
                  <div>
                    {paymentMethod === "MOBILE_MONEY" && (
                      <MobileMoneyForm
                        amount={total}
                        currency={currency}
                        customerInfo={formData}
                        onSuccess={(id) => setOrderCompleteId(id)}
                      />
                    )}
                    {paymentMethod === "PAYPAL" && (
                      <PayPalButton
                        amount={total}
                        currency={currency}
                        customerInfo={formData}
                        onSuccess={(id) => setOrderCompleteId(id)}
                      />
                    )}
                    {!paymentMethod && (
                      <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 text-sm">
                        Please select a payment method above.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Right: Order Summary ─────────────────────────────── */}
          <div className="lg:col-span-5 order-first lg:order-last">
            <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-3xl lg:sticky lg:top-28 shadow-2xl">
              <h3 className="text-lg sm:text-xl font-display font-bold mb-5 sm:mb-6">Order Summary</h3>

              {/* Cart items */}
              <div className="space-y-4 max-h-[30vh] lg:max-h-[35vh] overflow-y-auto pr-1 custom-scrollbar mb-5">
                {cartState.items.map((item) => (
                  <div key={item.id} className="flex gap-3 items-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/10 rounded-xl relative overflow-hidden shrink-0">
                      {item.image && (
                        <Image src={item.image} alt={item.name} fill className="object-cover" sizes="64px" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-sm font-semibold truncate text-slate-100">{item.name}</h4>
                      <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right font-bold text-xs sm:text-sm shrink-0">
                      {formatPrice(
                        calcDiscountedPrice(item.price, item.discountType, item.discountValue) * item.quantity,
                        item.currency,
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Coupon code ──────────────────────────────── */}
              <div className="border-t border-slate-700/50 pt-5 mb-5">
                <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1">
                  <Tag size={12} /> Coupon / Promo Code
                </p>

                {couponApplied ? (
                  <div className="flex items-center justify-between bg-emerald-500/20 border border-emerald-500/30 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Percent size={14} className="text-emerald-400" />
                      <div>
                        <p className="text-xs font-bold text-emerald-300">{couponApplied.code}</p>
                        <p className="text-[10px] text-emerald-400">{couponApplied.message}</p>
                      </div>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handleApplyCoupon(); }}
                      placeholder="Enter code"
                      className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all uppercase tracking-wider"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1 shrink-0"
                    >
                      {couponLoading ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
                    </button>
                  </div>
                )}

                {couponError && (
                  <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                    <X size={10} /> {couponError}
                  </p>
                )}
              </div>

              {/* ── Price breakdown ──────────────────────────── */}
              <div className="border-t border-slate-700/50 pt-4 space-y-2.5 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-white font-medium">{formatPrice(subtotal, currency)}</span>
                </div>

                {couponApplied && (
                  <div className="flex justify-between text-emerald-400">
                    <span className="flex items-center gap-1">
                      <Tag size={12} /> Coupon ({couponApplied.code})
                    </span>
                    <span className="font-bold">-{formatPrice(couponApplied.discountApplied, currency)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="flex items-center gap-1">
                    <Truck size={12} /> Shipping
                  </span>
                  {shippingLoading ? (
                    <Loader2 size={12} className="animate-spin text-slate-400" />
                  ) : shippingRate === 0 ? (
                    <span className="text-emerald-400 font-medium">Free</span>
                  ) : (
                    <span className="text-white font-medium">{formatPrice(shippingRate, currency)}</span>
                  )}
                </div>

                {taxRate > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>{taxName} ({taxRate}%)</span>
                    <span>{formatPrice(taxAmount, currency)}</span>
                  </div>
                )}

                <div className="flex justify-between border-t border-slate-700/50 pt-3 mt-2 text-base sm:text-lg">
                  <span className="font-bold text-white">Total</span>
                  <span className="font-black text-white">{formatPrice(total, currency)}</span>
                </div>
              </div>

              {/* Security badge */}
              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500">
                <ShieldCheck size={14} className="text-emerald-500" />
                256-bit SSL encrypted payment
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
