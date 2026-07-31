"use client";

import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCommerce, type SavedProduct } from "@/lib/commerce";
import { formatPrice } from "@/lib/utils";
import { Package, Trash2 } from "lucide-react";

const rows: Array<{ label: string; value: (product: SavedProduct) => string }> = [
  { label: "Brand", value: (product) => product.brand ?? "Not specified" },
  { label: "Category", value: (product) => product.category ?? "Not specified" },
  { label: "SKU", value: (product) => product.sku ?? "Not specified" },
  { label: "Price", value: (product) => formatPrice(product.price, product.currency) },
  { label: "Rating", value: (product) => product.rating ? `${product.rating.toFixed(1)} / 5 (${product.reviewCount ?? 0})` : "No rating yet" },
  { label: "Availability", value: (product) => product.quantity > 0 ? `${product.quantity} in stock` : "Out of stock" },
];

export default function ComparePage() {
  const { compare, removeCompare, clearCompare } = useCommerce();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 pt-28">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-sm font-bold uppercase tracking-widest text-primary">Decision table</span>
              <h1 className="font-display text-3xl font-extrabold text-slate-950 mt-2">Compare Products</h1>
              <p className="text-slate-500 mt-2">Compare up to four products by price, stock, rating, brand, category, and SKU.</p>
            </div>
            {compare.length > 0 && (
              <button onClick={clearCompare} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 hover:border-rose-200 hover:text-rose-500">
                Clear Compare
              </button>
            )}
          </div>

          {compare.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
                <Package size={30} />
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-950">No products selected</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Use the compare icon on product cards or product pages to build a side-by-side table.
              </p>
              <Link href="/products" className="mt-6 inline-flex rounded-full px-6 py-3 text-sm font-bold text-white" style={{ background: "var(--gradient-primary)" }}>
                Browse Products
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-[760px] w-full border-collapse">
                <thead>
                  <tr>
                    <th className="w-44 border-b border-slate-200 bg-slate-50 p-5 text-left text-xs font-black uppercase tracking-widest text-slate-500">
                      Product
                    </th>
                    {compare.map((product) => (
                      <th key={product.id} className="border-b border-slate-200 p-5 text-left align-top">
                        <div className="relative mb-4 h-36 overflow-hidden rounded-2xl bg-slate-50">
                          {product.image ? (
                            <Image src={product.image} alt={product.name} fill className="object-cover" sizes="220px" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                              <Package size={38} />
                            </div>
                          )}
                        </div>
                        <Link href={`/products/${product.slug}`} className="line-clamp-2 text-sm font-bold text-slate-950 hover:text-primary">
                          {product.name}
                        </Link>
                        <button
                          onClick={() => removeCompare(product.id)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:border-rose-200 hover:text-rose-500"
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <td className="border-b border-slate-100 bg-slate-50 p-5 text-sm font-bold text-slate-700">
                        {row.label}
                      </td>
                      {compare.map((product) => (
                        <td key={`${row.label}-${product.id}`} className="border-b border-slate-100 p-5 text-sm text-slate-600">
                          {row.value(product)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="bg-slate-50 p-5 text-sm font-bold text-slate-700">Action</td>
                    {compare.map((product) => (
                      <td key={`action-${product.id}`} className="p-5">
                        <Link href={`/products/${product.slug}`} className="inline-flex rounded-full px-5 py-2.5 text-sm font-bold text-white" style={{ background: "var(--gradient-primary)" }}>
                          View Details
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
