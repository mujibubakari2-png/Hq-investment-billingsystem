import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Breadcrumb from "@/components/product/Breadcrumb";
import ProductGallery from "@/components/product/ProductGallery";
import ProductInfo from "@/components/product/ProductInfo";
import ProductTabs from "@/components/product/ProductTabs";
import RelatedProducts from "@/components/product/RelatedProducts";
import type { Product } from "@/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getProduct(slug: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
    const res = await fetch(`${baseUrl}/api/public/products/${slug}`, {
      next: { revalidate: 60 }, // Revalidate every 60 seconds
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product Not Found" };

  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? product.description?.slice(0, 160),
    keywords: product.metaKeywords?.join(", "),
    openGraph: {
      title: product.seoTitle ?? product.name,
      description: product.seoDescription ?? product.description?.slice(0, 160),
      images: product.ogImage
        ? [{ url: product.ogImage }]
        : product.images?.[0]?.url
        ? [{ url: product.images[0].url }]
        : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: product.seoTitle ?? product.name,
      description: product.seoDescription ?? product.description?.slice(0, 160),
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getProduct(slug);

  if (!data) notFound();

  const product: Product & { related?: Product[] } = data;
  const related: Product[] = data.related ?? [];

  const breadcrumbs = [
    { label: "Products", href: "/products" },
    ...(product.category ? [{ label: product.category.name, href: `/products?category=${product.category.slug}` }] : []),
    { label: product.name },
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
          {/* Breadcrumb */}
          <div className="mb-8">
            <Breadcrumb items={breadcrumbs} />
          </div>

          {/* Product Main Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 mb-8">
            {/* Gallery */}
            <ProductGallery images={product.images} productName={product.name} />
            {/* Info */}
            <ProductInfo product={product} />
          </div>

          {/* Tabs: Description, Specs, Reviews */}
          <ProductTabs product={product} />

          {/* Related Products */}
          <RelatedProducts products={related} />
        </div>
      </main>
      <Footer />
    </>
  );
}
