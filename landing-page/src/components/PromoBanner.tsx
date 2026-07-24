"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { BannerSkeleton } from "@/components/ui/LoadingSkeleton";
import type { Banner } from "@/types";

const AUTO_PLAY_MS = 5000;

export default function PromoBanner() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/public/banners")
      .then((r) => r.json())
      .then((d) => setBanners(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const go = useCallback((next: number, dir: number) => {
    setDirection(dir);
    setCurrent(next);
  }, []);

  const prev = useCallback(() => {
    go((current - 1 + banners.length) % banners.length, -1);
  }, [current, banners.length, go]);

  const next = useCallback(() => {
    go((current + 1) % banners.length, 1);
  }, [current, banners.length, go]);

  // Auto-advance
  useEffect(() => {
    if (banners.length <= 1) return;
    timerRef.current = setInterval(next, AUTO_PLAY_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [banners.length, next]);

  if (loading) {
    return (
      <section className="py-10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BannerSkeleton />
        </div>
      </section>
    );
  }

  if (banners.length === 0) return null;

  const banner = banners[current];

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  return (
    <section id="promo-banner" className="py-10 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl" style={{ minHeight: 340 }}>
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={banner.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className="relative w-full"
              style={{ minHeight: 340 }}
            >
              {/* Background */}
              <div className="relative h-80 md:h-[420px] rounded-3xl overflow-hidden">
                {banner.imageUrl ? (
                  <Image
                    src={banner.imageUrl}
                    alt={banner.title ?? "Promotional banner"}
                    fill
                    className="object-cover"
                    priority={current === 0}
                    sizes="(max-width: 1280px) 100vw, 1280px"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{ background: "var(--gradient-hero)" }}
                  />
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-center px-8 md:px-16 max-w-xl">
                  {banner.title && (
                    <motion.h2
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="font-display text-3xl md:text-5xl font-extrabold text-white mb-3 leading-tight"
                    >
                      {banner.title}
                    </motion.h2>
                  )}
                  {banner.subtitle && (
                    <motion.p
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-white/80 text-lg mb-7 leading-relaxed"
                    >
                      {banner.subtitle}
                    </motion.p>
                  )}
                  {banner.linkUrl && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <Link
                        href={banner.linkUrl}
                        className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-sm text-white transition-all hover:-translate-y-1"
                        style={{
                          background: "linear-gradient(135deg, #3b82f6, #10b981)",
                          boxShadow: "0 8px 25px rgba(59,130,246,0.4)",
                        }}
                      >
                        {banner.linkText ?? "Shop Now"}
                        <ExternalLink size={16} />
                      </Link>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation arrows */}
          {banners.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white transition-all hover:scale-110"
                style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
                aria-label="Previous banner"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={next}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-white transition-all hover:scale-110"
                style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
                aria-label="Next banner"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {/* Dots */}
          {banners.length > 1 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
              {banners.map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i, i > current ? 1 : -1)}
                  aria-label={`Go to banner ${i + 1}`}
                  className="transition-all duration-300 rounded-full"
                  style={{
                    width: i === current ? 24 : 8,
                    height: 8,
                    background: i === current ? "white" : "rgba(255,255,255,0.5)",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
