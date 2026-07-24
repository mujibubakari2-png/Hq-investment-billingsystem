"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ArrowLeft, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useCart, getCartTotals } from "@/lib/cart";
import { formatPrice, getFeaturedImage, calcDiscountedPrice } from "@/lib/utils";
import PayPalButton from "@/components/checkout/PayPalButton";
import MobileMoneyForm from "@/components/checkout/MobileMoneyForm";

export default function CheckoutPage() {
  const router = useRouter();
  const { state: cartState, clearCart } = useCart();
  const [mounted, setMounted] = useState(false);
  
  // Checkout state
  const [step, setStep] = useState<1 | 2>(1);
  const [paymentMethod, setPaymentMethod] = useState<"MOBILE_MONEY" | "PAYPAL" | null>(null);
  const [orderCompleteId, setOrderCompleteId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
  });

  useEffect(() => { setMounted(true); }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const { subtotal } = getCartTotals(cartState.items);
  // Defaulting to TZS if multiple currencies, or the first item's currency
  const currency = cartState.items[0]?.currency ?? "TZS";
  // Add tax or shipping here if needed
  const total = subtotal;

  if (!mounted) return null;

  if (orderCompleteId) {
    return (
      <div className="min-h-screen pt-24 pb-16 bg-slate-50 flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">Order Confirmed!</h1>
          <p className="text-slate-500 mb-8">
            Thank you for your purchase. Your order ID is <span className="font-bold text-slate-800">#{orderCompleteId.substring(0, 8).toUpperCase()}</span>. We've sent a confirmation email.
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

  if (cartState.items.length === 0) {
    return (
      <div className="min-h-screen pt-24 pb-16 bg-slate-50 flex flex-col items-center justify-center">
        <h1 className="text-3xl font-display font-bold text-slate-900 mb-4">Your Cart is Empty</h1>
        <p className="text-slate-500 mb-8">Add some items to your cart before checking out.</p>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-full font-semibold hover:border-slate-300 transition-colors"
        >
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-16 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="flex text-sm text-slate-500 mb-8">
          <Link href="/products" className="hover:text-primary transition-colors">Shop</Link>
          <ChevronRight size={16} className="mx-2" />
          <span className={step === 1 ? "text-slate-900 font-semibold" : ""}>Information</span>
          <ChevronRight size={16} className="mx-2" />
          <span className={step === 2 ? "text-slate-900 font-semibold" : ""}>Payment</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Left Column: Form & Payment */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
                >
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-display font-bold text-slate-900">Contact Details</h2>
                    <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">Step 1 of 2</span>
                  </div>

                  <form onSubmit={handleNextStep} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                        <input
                          type="text" name="name" required
                          value={formData.name} onChange={handleInputChange}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
                        <input
                          type="email" name="email" required
                          value={formData.email} onChange={handleInputChange}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                          placeholder="john@example.com"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Phone Number</label>
                      <input
                        type="tel" name="phone" required
                        value={formData.phone} onChange={handleInputChange}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                        placeholder="+255 700 000 000"
                      />
                    </div>

                    <div className="border-t border-slate-100 pt-6 mt-6">
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Shipping Address</h3>
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">Street Address</label>
                          <input
                            type="text" name="address" required
                            value={formData.address} onChange={handleInputChange}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                            placeholder="123 Main St, Apartment 4B"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">City / Region</label>
                          <input
                            type="text" name="city" required
                            value={formData.city} onChange={handleInputChange}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                            placeholder="Dar es Salaam"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button
                        type="submit"
                        className="w-full flex items-center justify-center py-4 rounded-xl text-white font-bold transition-all hover:opacity-90"
                        style={{ background: "var(--gradient-primary)" }}
                      >
                        Continue to Payment
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
                >
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setStep(1)}
                        className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                      >
                        <ArrowLeft size={20} />
                      </button>
                      <h2 className="text-2xl font-display font-bold text-slate-900">Payment</h2>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1">
                      <ShieldCheck size={14} /> Secure
                    </span>
                  </div>

                  {/* Payment Method Selection */}
                  <div className="space-y-4 mb-8">
                    <label className={`block border-2 rounded-2xl p-4 cursor-pointer transition-all ${
                      paymentMethod === "MOBILE_MONEY" ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === "MOBILE_MONEY"}
                            onChange={() => setPaymentMethod("MOBILE_MONEY")}
                            className="w-5 h-5 text-primary focus:ring-primary border-slate-300"
                          />
                          <span className="font-bold text-slate-900">Mobile Money</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-xs font-bold bg-[#00A651] text-white px-2 py-1 rounded">M-Pesa</span>
                          <span className="text-xs font-bold bg-[#004A96] text-white px-2 py-1 rounded">Tigo Pesa</span>
                        </div>
                      </div>
                    </label>

                    <label className={`block border-2 rounded-2xl p-4 cursor-pointer transition-all ${
                      paymentMethod === "PAYPAL" ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === "PAYPAL"}
                            onChange={() => setPaymentMethod("PAYPAL")}
                            className="w-5 h-5 text-primary focus:ring-primary border-slate-300"
                          />
                          <span className="font-bold text-slate-900">PayPal or Credit Card</span>
                        </div>
                        <span className="text-sm font-bold text-[#003087]">PayPal</span>
                      </div>
                    </label>
                  </div>

                  {/* Payment Form Injection */}
                  <div className="mt-8">
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
                      <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl text-slate-500">
                        Please select a payment method above.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Order Summary */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900 text-white p-8 rounded-3xl sticky top-28 shadow-2xl">
              <h3 className="text-xl font-display font-bold mb-6">Order Summary</h3>
              
              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {cartState.items.map((item) => (
                  <div key={item.id} className="flex gap-4 items-center">
                    <div className="w-16 h-16 bg-white/10 rounded-xl relative overflow-hidden shrink-0">
                      {item.image && (
                        <Image src={item.image} alt={item.name} fill className="object-cover" sizes="64px" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold truncate text-slate-100">{item.name}</h4>
                      <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right font-bold text-sm">
                      {formatPrice(calcDiscountedPrice(item.price, item.discountType, item.discountValue) * item.quantity, item.currency)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-700/50 mt-6 pt-6 space-y-3 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="text-white font-medium">{formatPrice(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="text-emerald-400 font-medium">Free</span>
                </div>
                <div className="flex justify-between border-t border-slate-700/50 pt-3 mt-3 text-lg">
                  <span className="font-bold text-white">Total</span>
                  <span className="font-black text-white">{formatPrice(total, currency)}</span>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
