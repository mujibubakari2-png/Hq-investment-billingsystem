"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Banknote, Gift, ShieldCheck, Sparkles } from "lucide-react";
import {
  landingBuyingGuides,
  landingExperienceCards,
  landingPaymentMethods,
  landingPriceBands,
  landingSocialPosts,
  landingStyleCollections,
  landingTrustBlocks,
  landingTrustMetrics,
} from "@/config/landing";

export default function CommerceExperience() {
  const ChecklistIcon = landingExperienceCards.checklist;
  const SocialIcon = landingExperienceCards.social.icon;
  const MobileAppIcon = landingExperienceCards.mobileApp.icon;
  const LocationsIcon = landingExperienceCards.locations.icon;
  const GuidesIcon = landingExperienceCards.guides.icon;
  const CertificationIcon = landingExperienceCards.certification.icon;
  const DiscoveryIcon = landingExperienceCards.discovery.icon;

  return (
    <>
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-3xl p-8 text-white overflow-hidden relative"
              style={{ background: "linear-gradient(135deg, #020617, #1e3a8a 52%, #0f766e)" }}
            >
              <div className="relative z-10">
                <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/10 border border-white/15">
                  <ShieldCheck size={14} /> Trust and checkout confidence
                </span>
                <h2 className="font-display text-3xl md:text-4xl font-extrabold leading-tight mt-6">
                  Secure checkout, verified sellers, and clear buyer protection.
                </h2>
                <p className="text-white/70 mt-4 max-w-xl">
                  The storefront communicates refund confidence, delivery clarity, SSL protection,
                  verified reviews, and payment flexibility before a customer reaches checkout.
                </p>
                <div className="grid grid-cols-2 gap-3 mt-8">
                  {landingTrustMetrics.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-2xl bg-white/10 border border-white/15 p-4">
                      <Icon size={18} className="text-cyan-200 mb-3" />
                      <div className="text-2xl font-black">{value}</div>
                      <div className="text-xs text-white/55 mt-1">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {landingTrustBlocks.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <div className="w-11 h-11 rounded-xl bg-white text-primary flex items-center justify-center shadow-sm mb-5">
                    <Icon size={20} />
                  </div>
                  <h3 className="font-display font-bold text-lg text-slate-950">{title}</h3>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5 md:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-5">
              <div className="flex items-center gap-3 min-w-fit">
                <div className="w-11 h-11 rounded-xl bg-white text-primary flex items-center justify-center shadow-sm">
                  <Banknote size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950">Supported payment methods</h3>
                  <p className="text-sm text-slate-500">Ready for local and international checkout flows.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:ml-auto">
                {landingPaymentMethods.map((method) => (
                  <span key={method} className="rounded-full bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">
                    {method}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10">
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 mb-3">
                <Sparkles size={14} /> Discovery paths
              </span>
              <h2 className="section-title">Shop by price, style, and story</h2>
              <p className="text-slate-500 mt-3 max-w-2xl">
                Extra merchandising shelves help customers find the right product quickly while keeping
                the homepage campaign-friendly for Super Admin control.
              </p>
            </div>
            <Link href="/products" className="inline-flex items-center gap-2 text-sm font-bold text-primary">
              Browse catalogue <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <Gift size={20} className="text-primary" />
                <h3 className="font-display font-bold text-xl text-slate-950">Shop by price</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {landingPriceBands.map((band) => (
                  <Link key={band.name} href={band.href} className="rounded-2xl border border-slate-200 p-4 hover:border-primary hover:bg-blue-50/40 transition-all">
                    <span className="font-bold text-slate-950">{band.name}</span>
                    <span className="block text-sm text-slate-500 mt-1">{band.detail}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-slate-950 p-6 text-white overflow-hidden relative">
              <div className="flex items-center gap-3 mb-5">
                <DiscoveryIcon size={20} className="text-cyan-300" />
                <h3 className="font-display font-bold text-xl">Shop by lifestyle</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {landingStyleCollections.map((style) => (
                  <Link
                    key={style}
                    href={`/products?style=${style.toLowerCase()}`}
                    className="rounded-full bg-white/10 border border-white/10 px-4 py-2 text-sm font-bold hover:bg-white hover:text-slate-950 transition-all"
                  >
                    {style}
                  </Link>
                ))}
              </div>
              <div className="mt-8 grid grid-cols-2 gap-3 text-sm text-white/65">
                {["Personalized recommendations", "Recently viewed", "Frequently bought together", "Upsell and bundles"].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <ChecklistIcon size={15} className="text-emerald-300" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.9fr] gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <SocialIcon size={18} className="text-primary" />
                <span className="text-sm font-bold uppercase tracking-widest text-primary">Social commerce</span>
              </div>
              <h2 className="section-title">Campaign content that feels alive</h2>
              <p className="text-slate-500 mt-3 max-w-2xl">
                Social galleries, app promotion, buying guides, store locations, partners, and certification
                signals are represented as launch-ready content blocks.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                {landingSocialPosts.map((post) => (
                  <div key={post.title} className={`rounded-3xl min-h-48 p-4 bg-gradient-to-br ${post.color} text-white flex flex-col justify-between`}>
                    <span className="text-xs font-black uppercase tracking-widest bg-white/20 rounded-full px-3 py-1 w-fit">{post.tag}</span>
                    <span className="font-display font-bold leading-tight">{post.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white text-primary flex items-center justify-center shadow-sm">
                    <MobileAppIcon size={22} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-xl text-slate-950">Mobile app ready</h3>
                    <p className="text-sm text-slate-500 mt-2">App Store, Google Play, QR campaign, push notifications, and loyalty hooks can plug into this block.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-primary flex items-center justify-center">
                    <LocationsIcon size={22} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-xl text-slate-950">Store locations and partners</h3>
                    <p className="text-sm text-slate-500 mt-2">Branches, opening hours, delivery partners, payment partners, and technology certifications stay visible.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <GuidesIcon size={20} className="text-primary" />
                    <h3 className="font-display font-bold text-xl text-slate-950">Buying guides</h3>
                  </div>
                  <Link href="/blog" className="text-sm font-bold text-primary">Blog</Link>
                </div>
                <div className="space-y-3">
                  {landingBuyingGuides.map((guide) => (
                    <Link key={guide.title} href={guide.href} className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700 hover:text-primary">
                      {guide.title}
                      <ArrowRight size={14} />
                    </Link>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white">
                <div className="flex items-center gap-3">
                  <CertificationIcon size={20} className="text-cyan-300" />
                  <span className="font-bold">Certifications and enterprise readiness</span>
                </div>
                <p className="text-sm text-white/55 mt-2">SSL, secure checkout, audit logs, analytics pixels, SEO schemas, and campaign scheduling are represented in the storefront architecture.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
