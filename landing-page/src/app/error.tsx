"use client";

import Link from "next/link";
import { RotateCcw, Store } from "lucide-react";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <section className="max-w-lg text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <Store size={28} />
        </div>
        <h1 className="font-display text-3xl font-black text-slate-900 mb-3">
          Something went wrong
        </h1>
        <p className="text-slate-500 mb-8">
          The store could not finish loading this view. Please retry or return to the marketplace.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white"
            style={{ background: "var(--gradient-primary)" }}
          >
            <RotateCcw size={16} />
            Try again
          </button>
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 hover:border-primary/30 hover:text-primary"
          >
            Browse products
          </Link>
        </div>
      </section>
    </main>
  );
}
