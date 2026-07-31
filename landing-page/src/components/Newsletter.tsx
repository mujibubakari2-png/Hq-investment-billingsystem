"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Sparkles } from "lucide-react";
import { Popup } from "@/stores/popupStore";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!EMAIL_PATTERN.test(email.trim())) {
      Popup.error("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/public/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (data.success) {
        Popup.success("Subscribed!", "You have successfully subscribed to our newsletter.");
        setEmail("");
      } else {
        Popup.error("Subscription Failed", data.error || "Failed to subscribe.");
      }
    } catch {
      Popup.warning("Network Error", "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="newsletter" className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl p-10 md:p-16 text-center"
          style={{ background: "var(--gradient-primary)" }}
        >
          <div className="relative">
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                <Sparkles size={28} className="text-white" />
              </div>
            </div>

            <h2 className="font-display text-3xl md:text-4xl font-extrabold text-white mb-3">
              Get Exclusive Deals First
            </h2>
            <p className="text-white/70 text-lg mb-8 max-w-md mx-auto">
              Subscribe for early access to sales, new arrivals, and members-only discounts.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
              <div className="flex-1 relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  id="newsletter-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  placeholder="Enter your email address"
                  className="w-full pl-11 pr-4 py-4 rounded-full text-slate-800 text-sm font-medium outline-none border-2 border-transparent focus:border-white/50 transition-all bg-white"
                  aria-label="Email address for newsletter"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-4 rounded-full font-bold text-sm text-primary bg-white hover:bg-slate-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5 whitespace-nowrap shadow-lg"
              >
                {loading ? "Subscribing..." : "Subscribe Free"}
              </button>
            </form>

            <p className="text-white/50 text-xs mt-5">
              No spam, ever. Unsubscribe anytime. By subscribing you agree to our Privacy Policy.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
