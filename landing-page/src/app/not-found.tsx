import Link from "next/link";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4">
      <section className="max-w-lg text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-blue-50 text-primary flex items-center justify-center">
          <Search size={28} />
        </div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary mb-3">404</p>
        <h1 className="font-display text-3xl font-black text-slate-900 mb-3">
          Page not found
        </h1>
        <p className="text-slate-500 mb-8">
          This page is not available, but the marketplace is ready with live products and deals.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Home size={16} />
            Home
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700 hover:border-primary/30 hover:text-primary"
          >
            Shop products
          </Link>
        </div>
      </section>
    </main>
  );
}
