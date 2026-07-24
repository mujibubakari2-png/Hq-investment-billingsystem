"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { TestimonialSkeleton } from "@/components/ui/LoadingSkeleton";
import type { Testimonial } from "@/types";

export default function Testimonials() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/public/testimonials")
      .then((r) => r.json())
      .then((d) => setTestimonials(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const navigate = useCallback((dir: number) => {
    setDirection(dir);
    setCurrent((c) => (c + dir + testimonials.length) % testimonials.length);
  }, [testimonials.length]);

  useEffect(() => {
    if (testimonials.length <= 1) return;
    timerRef.current = setInterval(() => navigate(1), 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [testimonials.length, navigate]);

  if (!loading && testimonials.length === 0) return null;

  // Show 3 cards on desktop, sliding the center
  const getVisible = () => {
    if (testimonials.length === 0) return [];
    return [-1, 0, 1].map((offset) => ({
      testimonial: testimonials[(current + offset + testimonials.length) % testimonials.length],
      offset,
    }));
  };

  return (
    <section id="testimonials" className="py-20 bg-slate-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full mb-4">
            ⭐ Customer Reviews
          </span>
          <h2 className="section-title font-display">What Our Customers Say</h2>
          <p className="section-subtitle mt-3 mx-auto">
            Thousands of satisfied customers across East Africa trust HQ Investment
          </p>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => <TestimonialSkeleton key={i} />)}
          </div>
        ) : (
          <>
            {/* Desktop: 3-up slider */}
            <div className="hidden md:block relative">
              <div className="grid grid-cols-3 gap-6">
                <AnimatePresence initial={false} custom={direction} mode="wait">
                  {getVisible().map(({ testimonial, offset }) => (
                    <motion.div
                      key={testimonial.id + offset}
                      custom={direction}
                      initial={{ opacity: 0, x: direction * 100 }}
                      animate={{
                        opacity: offset === 0 ? 1 : 0.65,
                        x: 0,
                        scale: offset === 0 ? 1 : 0.95,
                      }}
                      exit={{ opacity: 0, x: direction * -100 }}
                      transition={{ duration: 0.4 }}
                    >
                      <TestimonialCard
                        testimonial={testimonial}
                        featured={offset === 0}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Mobile: single slide */}
            <div className="md:hidden relative">
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={testimonials[current]?.id}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -60 }}
                  transition={{ duration: 0.35 }}
                >
                  {testimonials[current] && (
                    <TestimonialCard testimonial={testimonials[current]} featured />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Controls */}
            {testimonials.length > 1 && (
              <div className="flex items-center justify-center gap-4 mt-10">
                <button
                  onClick={() => navigate(-1)}
                  className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:border-primary hover:text-primary transition-all"
                  aria-label="Previous testimonial"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex gap-2">
                  {testimonials.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
                      aria-label={`Testimonial ${i + 1}`}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i === current ? 24 : 8,
                        height: 8,
                        background: i === current ? "var(--primary)" : "#cbd5e1",
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => navigate(1)}
                  className="w-10 h-10 rounded-full border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:border-primary hover:text-primary transition-all"
                  aria-label="Next testimonial"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function TestimonialCard({ testimonial, featured }: { testimonial: Testimonial; featured?: boolean }) {
  const initials = testimonial.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div
      className={`testimonial-card flex flex-col gap-4 ${
        featured ? "ring-2 ring-primary/20 shadow-card-hover" : ""
      }`}
    >
      {/* Quote icon */}
      <Quote size={32} className="text-primary/20 shrink-0" />

      {/* Stars */}
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={14}
            className={i < testimonial.rating ? "fill-amber-400 text-amber-400" : "fill-slate-100 text-slate-100"}
          />
        ))}
      </div>

      {/* Content */}
      <p className="text-slate-600 leading-relaxed text-sm flex-1 line-clamp-5">
        &ldquo;{testimonial.content}&rdquo;
      </p>

      {/* Author */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
        {testimonial.avatarUrl ? (
          <div className="relative w-10 h-10 rounded-full overflow-hidden shrink-0">
            <Image src={testimonial.avatarUrl} alt={testimonial.name} fill className="object-cover" sizes="40px" />
          </div>
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: "var(--gradient-primary)" }}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{testimonial.name}</p>
          {(testimonial.role || testimonial.company) && (
            <p className="text-xs text-slate-500 truncate">
              {[testimonial.role, testimonial.company].filter(Boolean).join(" at ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
