"use client";
import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ZoomIn, Package } from "lucide-react";
import type { ProductImage } from "@/types";

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [direction, setDirection] = useState(1);

  if (images.length === 0) {
    return (
      <div className="aspect-square rounded-3xl bg-slate-100 flex items-center justify-center">
        <Package size={80} className="text-slate-300" />
      </div>
    );
  }

  const go = (idx: number, dir: number) => {
    setDirection(dir);
    setActive(idx);
  };

  const prev = () => go((active - 1 + images.length) % images.length, -1);
  const next = () => go((active + 1) % images.length, 1);

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? "60%" : "-60%", opacity: 0, scale: 0.96 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? "-60%" : "60%", opacity: 0, scale: 0.96 }),
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Main image */}
      <div
        className="relative overflow-hidden rounded-3xl bg-slate-50 group cursor-zoom-in"
        style={{ aspectRatio: "1/1" }}
        onClick={() => setZoomed(true)}
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={images[active].id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0"
          >
            <Image
              src={images[active].url}
              alt={images[active].altText ?? productName}
              fill
              className="object-contain p-4"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </motion.div>
        </AnimatePresence>

        {/* Zoom hint */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="p-2 rounded-full bg-white/80 backdrop-blur-sm shadow-md">
            <ZoomIn size={18} className="text-slate-500" />
          </div>
        </div>

        {/* Arrows (multiple images) */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center text-slate-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
              aria-label="Previous image"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center text-slate-600 hover:bg-white transition-all opacity-0 group-hover:opacity-100"
              aria-label="Next image"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => go(i, i > active ? 1 : -1)}
              aria-label={`View image ${i + 1}`}
              className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                i === active
                  ? "border-primary shadow-md scale-105"
                  : "border-transparent hover:border-slate-300"
              }`}
            >
              <Image
                src={img.url}
                alt={img.altText ?? `${productName} thumbnail ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}

      {/* Zoom lightbox */}
      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setZoomed(false)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="relative w-full max-w-2xl aspect-square"
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={images[active].url}
                alt={images[active].altText ?? productName}
                fill
                className="object-contain"
                sizes="700px"
              />
            </motion.div>
            <button
              onClick={() => setZoomed(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
              aria-label="Close zoom"
            >✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
