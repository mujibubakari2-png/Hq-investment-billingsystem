import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types";

interface RelatedProductsProps {
  products: Product[];
}

export default function RelatedProducts({ products }: RelatedProductsProps) {
  if (products.length === 0) return null;

  return (
    <section className="mt-20 pt-16 border-t border-slate-100">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-display text-2xl font-bold text-slate-900">Related Products</h2>
        <Link
          href="/products"
          className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-secondary transition-colors group"
        >
          View More
          <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        {products.slice(0, 8).map((product, i) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.07 }}
          >
            <ProductCard product={product} />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
