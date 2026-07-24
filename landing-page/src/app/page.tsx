import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import { FeaturedProducts, LatestProducts, TrendingProducts } from "@/components/ProductSections";
import PromoBanner from "@/components/PromoBanner";
import Features from "@/components/Features";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import Statistics from "@/components/Statistics";
import Newsletter from "@/components/Newsletter";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden">
      <Navbar />
      {/* ── Hero ── */}
      <Hero />

      {/* ── Shop Categories ── */}
      <Categories />

      {/* ── Featured Products ── */}
      <FeaturedProducts />

      {/* ── Promo Banner ── */}
      <PromoBanner />

      {/* ── Latest Arrivals ── */}
      <LatestProducts />

      {/* ── Trending Products ── */}
      <TrendingProducts />

      {/* ── Statistics ── */}
      <Statistics />

      {/* ── Customer Testimonials ── */}
      <Testimonials />

      {/* ── ISP Features (preserved) ── */}
      <Features />

      {/* ── ISP Pricing Plans (preserved) ── */}
      <Pricing />

      {/* ── Newsletter ── */}
      <Newsletter />

      {/* ── FAQ ── */}
      <FAQ />

      {/* ── Contact (preserved) ── */}
      <Contact />

      {/* ── Footer ── */}
      <Footer />
    </main>
  );
}
