"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import {
  landingAdminControlAreas,
  landingJourneySteps,
  landingServicePromises,
} from "@/config/landing";

const statusClass = {
  Live: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Configurable: "bg-blue-50 text-blue-700 border-blue-100",
  Ready: "bg-amber-50 text-amber-700 border-amber-100",
} as const;

export default function CommerceCommandSection() {
  return (
    <section className="py-20 bg-slate-950 text-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-cyan-200">
              <ShieldCheck size={14} /> Complete commerce flow
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-extrabold leading-tight mt-5">
              From landing page visit to repeat customer, every key path is represented.
            </h2>
            <p className="text-white/65 mt-5 max-w-xl leading-relaxed">
              The storefront now surfaces discovery, comparison, cart, checkout, payment,
              support, analytics, and Super Admin-controlled merchandising in one coherent
              e-commerce experience.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {landingAdminControlAreas.map((area) => (
                <motion.div
                  key={area.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="rounded-2xl bg-white/[0.06] border border-white/10 p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold">{area.title}</h3>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass[area.status]}`}>
                      {area.status}
                    </span>
                  </div>
                  <p className="text-sm text-white/55 leading-relaxed mt-3">{area.text}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            {landingJourneySteps.map(({ icon: Icon, ...step }, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: 18 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: index * 0.06 }}
                className="rounded-3xl bg-white text-slate-950 p-5 md:p-6 shadow-2xl shadow-black/10"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ background: "var(--gradient-primary)" }}>
                    <Icon size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Step {index + 1}</span>
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    </div>
                    <h3 className="font-display font-black text-xl mt-1">{step.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed mt-2">{step.text}</p>
                    <Link href={step.href} className="inline-flex items-center gap-2 text-sm font-black text-primary mt-4">
                      {step.cta} <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {landingServicePromises.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-white/[0.06] border border-white/10 p-5">
              <Icon size={20} className="text-cyan-200" />
              <h3 className="font-bold mt-4">{title}</h3>
              <p className="text-sm text-white/55 leading-relaxed mt-2">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
