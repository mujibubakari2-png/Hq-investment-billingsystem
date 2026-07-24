import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ProductNotFound() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white flex items-center justify-center pt-20">
        <div className="text-center px-4 py-24">
          <div
            className="w-24 h-24 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6"
            style={{ background: "var(--gradient-primary)" }}
          >
            🔍
          </div>
          <h1 className="font-display font-black text-4xl text-slate-900 mb-3">
            Product Not Found
          </h1>
          <p className="text-slate-500 text-lg mb-8 max-w-md mx-auto">
            This product may have been removed or the link is incorrect.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/products"
              className="px-8 py-4 rounded-full font-bold text-white text-sm transition-all hover:-translate-y-0.5"
              style={{ background: "var(--gradient-primary)" }}
            >
              Browse All Products
            </Link>
            <Link
              href="/"
              className="px-8 py-4 rounded-full font-bold text-slate-600 border-2 border-slate-200 text-sm hover:border-primary hover:text-primary transition-all"
            >
              Go Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
