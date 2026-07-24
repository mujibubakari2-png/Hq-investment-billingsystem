"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";
import type { Faq } from "@/types";

function groupByCategory(faqs: Faq[]) {
  const map: Record<string, Faq[]> = {};
  for (const faq of faqs) {
    const cat = faq.category ?? "general";
    if (!map[cat]) map[cat] = [];
    map[cat].push(faq);
  }
  return map;
}

function FaqItem({ faq }: { faq: Faq }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="accordion-item">
      <button
        className="accordion-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        id={`faq-${faq.id}`}
        aria-controls={`faq-body-${faq.id}`}
      >
        <span className="pr-4 text-left font-semibold text-slate-800 text-sm">{faq.question}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="shrink-0"
        >
          <ChevronDown size={18} className="text-slate-400" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`faq-body-${faq.id}`}
            role="region"
            aria-labelledby={`faq-${faq.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="accordion-content pb-5 pt-1 text-sm">{faq.answer}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    fetch("/api/public/faqs")
      .then((r) => r.json())
      .then((d) => setFaqs(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const grouped = groupByCategory(faqs);
  const categories = ["all", ...Object.keys(grouped)];
  const filtered =
    activeCategory === "all"
      ? faqs
      : grouped[activeCategory] ?? [];

  if (!loading && faqs.length === 0) return null;

  return (
    <section id="faq" className="py-20 bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-primary/10">
              <HelpCircle size={24} className="text-primary" />
            </div>
          </div>
          <h2 className="section-title font-display">Frequently Asked Questions</h2>
          <p className="section-subtitle mt-3 mx-auto">
            Everything you need to know about HQ Investment marketplace and ISP billing platform.
          </p>
        </motion.div>

        {/* Category tabs */}
        {categories.length > 2 && (
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2 rounded-full text-sm font-semibold capitalize transition-all ${
                  activeCategory === cat
                    ? "text-white shadow-md"
                    : "bg-white text-slate-600 border border-slate-200 hover:border-primary hover:text-primary"
                }`}
                style={activeCategory === cat ? { background: "var(--gradient-primary)" } : {}}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* FAQ list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-xl" />
            ))}
          </div>
        ) : (
          <motion.div
            layout
            className="space-y-3"
          >
            <AnimatePresence mode="wait">
              {filtered.map((faq, i) => (
                <motion.div
                  key={faq.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <FaqItem faq={faq} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center p-8 bg-white rounded-2xl border border-slate-100 shadow-sm"
        >
          <p className="text-slate-600 mb-2 font-medium">Still have questions?</p>
          <p className="text-slate-500 text-sm mb-5">
            Our team is ready to help. Reach out via WhatsApp or email.
          </p>
          <Link
            href="/#contact"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold text-white transition-all hover:-translate-y-0.5"
            style={{ background: "var(--gradient-primary)" }}
          >
            Contact Us
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
