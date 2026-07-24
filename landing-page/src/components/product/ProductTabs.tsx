"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StarRating from "@/components/ui/StarRating";
import { useToast } from "@/components/ui/Toast";
import type { Product, Review } from "@/types";

const TABS = ["Description", "Specifications", "Reviews"] as const;
type Tab = (typeof TABS)[number];

interface ProductTabsProps {
  product: Product;
}

export default function ProductTabs({ product }: ProductTabsProps) {
  const [active, setActive] = useState<Tab>("Description");

  return (
    <div className="mt-16">
      {/* Tab Headers */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            id={`tab-${tab.toLowerCase()}`}
            role="tab"
            aria-selected={active === tab}
            aria-controls={`panel-${tab.toLowerCase()}`}
            className={`relative px-6 py-4 text-sm font-semibold transition-colors whitespace-nowrap ${
              active === tab
                ? "text-primary"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab}
            {tab === "Reviews" && product.reviewCount !== undefined && product.reviewCount > 0 && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {product.reviewCount}
              </span>
            )}
            {active === tab && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ background: "var(--gradient-primary)" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="py-8" role="tabpanel" id={`panel-${active.toLowerCase()}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            {active === "Description" && <DescriptionTab product={product} />}
            {active === "Specifications" && <SpecificationsTab product={product} />}
            {active === "Reviews" && <ReviewsTab product={product} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function DescriptionTab({ product }: { product: Product }) {
  if (!product.description) {
    return <p className="text-slate-400 italic">No description available for this product.</p>;
  }
  return (
    <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
      {product.description.split("\n").map((para, i) => (
        <p key={i} className="mb-4">{para}</p>
      ))}
    </div>
  );
}

function SpecificationsTab({ product }: { product: Product }) {
  const specs = product.specifications as Array<{ key: string; value: string }> | null;

  if (!specs || specs.length === 0) {
    return <p className="text-slate-400 italic">No specifications listed for this product.</p>;
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200">
      <table className="w-full text-sm">
        <tbody>
          {specs.map(({ key, value }, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-slate-50" : "bg-white"}>
              <td className="px-5 py-3.5 font-semibold text-slate-700 w-40 md:w-56 border-r border-slate-200">
                {key}
              </td>
              <td className="px-5 py-3.5 text-slate-600">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewsTab({ product }: { product: Product }) {
  const reviews = (product as Product & { reviews?: Review[] }).reviews ?? [];
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({ authorName: "", email: "", rating: 5, title: "", comment: "" });
  const [submitting, setSubmitting] = useState(false);
  const { success, error } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.authorName || !formData.comment) {
      error("Name and review comment are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, ...formData }),
      });
      const data = await res.json();
      if (data.success) {
        success("Review submitted! It will appear after moderation.");
        setFormOpen(false);
        setFormData({ authorName: "", email: "", rating: 5, title: "", comment: "" });
      } else {
        error(data.error ?? "Failed to submit review.");
      }
    } catch {
      error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Summary */}
      {product.avgRating !== undefined && product.avgRating > 0 && (
        <div className="flex items-center gap-8 p-6 rounded-2xl bg-slate-50 border border-slate-100">
          <div className="text-center">
            <p className="text-6xl font-black text-slate-900">{product.avgRating.toFixed(1)}</p>
            <StarRating rating={product.avgRating} size={20} className="justify-center mt-2" />
            <p className="text-sm text-slate-500 mt-1">{product.reviewCount} reviews</p>
          </div>
          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter((r) => Math.round(r.rating) === star).length;
              const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3 text-sm">
                  <span className="text-slate-500 w-4">{star}</span>
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-amber-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: (5 - star) * 0.1 }}
                    />
                  </div>
                  <span className="text-slate-400 w-4">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Write review button */}
      <button
        onClick={() => setFormOpen((o) => !o)}
        className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white transition-all hover:opacity-90"
        style={{ background: "var(--gradient-primary)" }}
      >
        ✍️ Write a Review
      </button>

      {/* Review form */}
      <AnimatePresence>
        {formOpen && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-2xl border border-slate-200 p-6 space-y-5 bg-slate-50"
          >
            <h3 className="font-display font-bold text-lg text-slate-900">Your Review</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name *</label>
                <input
                  type="text" required value={formData.authorName}
                  onChange={(e) => setFormData({ ...formData, authorName: e.target.value })}
                  className="input-base" placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email (optional)</label>
                <input
                  type="email" value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-base" placeholder="your@email.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Rating *</label>
              <StarRating rating={formData.rating} size={28} interactive onChange={(r) => setFormData({ ...formData, rating: r })} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Review Title</label>
              <input
                type="text" value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input-base" placeholder="Sum up your experience"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Your Review *</label>
              <textarea
                required rows={4} value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                className="input-base resize-none" placeholder="Share your experience with this product…"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={submitting}
                className="px-8 py-3 rounded-full text-sm font-bold text-white disabled:opacity-60 transition-all"
                style={{ background: "var(--gradient-primary)" }}
              >
                {submitting ? "Submitting…" : "Submit Review"}
              </button>
              <button type="button" onClick={() => setFormOpen(false)}
                className="px-8 py-3 rounded-full text-sm font-semibold text-slate-600 border-2 border-slate-200 hover:border-slate-300 transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Review list */}
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <p className="text-slate-400 italic text-center py-8">No reviews yet. Be the first to review!</p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="p-5 rounded-2xl border border-slate-100 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: "var(--gradient-primary)" }}>
                      {review.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{review.authorName}</p>
                      <p className="text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                <StarRating rating={review.rating} size={14} />
              </div>
              {review.title && <p className="font-semibold text-slate-800 mb-1">{review.title}</p>}
              {review.comment && <p className="text-slate-600 text-sm leading-relaxed">{review.comment}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
