"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BadgePercent, Gem, Timer } from "lucide-react";
import { landingCollections, landingDealProducts } from "@/config/landing";

export default function CommerceHighlights() {
  return (
    <>
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-blue-50 text-primary mb-3">
                <Gem size={14} /> Shop by collection
              </span>
              <h2 className="section-title">Curated shopping journeys</h2>
              <p className="text-slate-500 mt-3 max-w-2xl">
                Collections are structured for campaign launches, premium merchandising,
                SEO landing pages, and category-specific promotions.
              </p>
            </div>
            <Link href="/products" className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-primary">
              Browse all collections <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {landingCollections.map((collection, index) => (
              <motion.div
                key={collection.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: index * 0.06 }}
              >
                <Link href={collection.href} className="group block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                  <div className={`h-32 bg-gradient-to-br ${collection.accent} relative overflow-hidden`}>
                    <div className="absolute inset-x-6 bottom-5 h-16 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-md" />
                    <div className="absolute right-5 top-5 w-16 h-16 rounded-2xl bg-white/25 border border-white/25" />
                  </div>
                  <div className="p-5">
                    <h3 className="font-display font-bold text-lg text-slate-950 group-hover:text-primary transition-colors">
                      {collection.name}
                    </h3>
                    <p className="text-sm text-slate-500 mt-2 min-h-[44px]">{collection.detail}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-primary mt-5">
                      View category <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-8 items-stretch">
            <div className="rounded-3xl p-8 text-white overflow-hidden relative" style={{ background: "linear-gradient(135deg, #111827, #1d4ed8 55%, #0f766e)" }}>
              <div className="relative z-10">
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/10 border border-white/15 mb-8">
                  <Timer size={14} /> Flash sale control
                </span>
                <h2 className="font-display text-3xl md:text-4xl font-extrabold leading-tight">
                  Launch urgency campaigns without touching code.
                </h2>
                <p className="text-white/70 mt-4">
                  Countdown timers, stock progress, discount labels, limited-quantity offers,
                  banners, and promoted products can be managed from the Super Admin module.
                </p>
                <div className="grid grid-cols-3 gap-3 mt-8">
                  {["02", "18", "44"].map((value, i) => (
                    <div key={value} className="rounded-2xl bg-white/10 border border-white/15 p-4 text-center">
                      <div className="text-2xl font-black">{value}</div>
                      <div className="text-[11px] uppercase tracking-widest text-white/55">
                        {["Hours", "Minutes", "Seconds"][i]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-slate-950 rounded-3xl p-6 md:p-8 text-white">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-300">
                    <BadgePercent size={14} /> Today&apos;s deals
                  </span>
                  <h3 className="font-display text-2xl font-bold mt-1">High-converting offer shelf</h3>
                </div>
                <Link href="/products?deals=true" className="text-sm font-bold text-cyan-300">View deals</Link>
              </div>
              <div className="space-y-4">
                {landingDealProducts.map((product) => (
                  <div key={product.name} className="rounded-2xl bg-white/[0.06] border border-white/10 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold">{product.name}</h4>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                          <span className="text-emerald-300 font-black">{product.price}</span>
                          <span className="text-white/35 line-through">{product.oldPrice}</span>
                        </div>
                      </div>
                      <button className="px-4 py-2 rounded-full bg-white text-slate-950 text-xs font-black">
                        Buy Now
                      </button>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-300" style={{ width: `${product.stock}%` }} />
                    </div>
                    <div className="mt-2 text-xs text-white/45">{product.stock}% stock allocated</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

    </>
  );
}
