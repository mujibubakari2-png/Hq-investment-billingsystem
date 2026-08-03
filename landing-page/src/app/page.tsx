import Navbar from "@/components/Navbar";
import JsonLd from "@/components/JsonLd";
import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import FlashSale from "@/components/FlashSale";
import {
  FeaturedProducts,
  BestSellers,
  LatestProducts,
  TrendingProducts,
} from "@/components/ProductSections";
import CommerceHighlights from "@/components/CommerceHighlights";
import CommerceExperience from "@/components/CommerceExperience";
import CommerceCommandSection from "@/components/CommerceCommandSection";
import RecentlyViewedSection from "@/components/RecentlyViewedSection";
import PromoBanner from "@/components/PromoBanner";
import BrandCarousel from "@/components/BrandCarousel";
import TrustSection from "@/components/TrustSection";
import Features from "@/components/Features";
import Pricing from "@/components/Pricing";
import Testimonials from "@/components/Testimonials";
import MobileAppBanner from "@/components/MobileAppBanner";
import BlogPreview from "@/components/BlogPreview";
import FAQ from "@/components/FAQ";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function LandingPage() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hqinvestment.co.tz";

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "HQ Investment",
      url: appUrl,
      logo: `${appUrl}/icon.png`,
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone: "+255621085215",
        areaServed: "TZ",
        availableLanguage: ["English", "Swahili"],
      },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Dar es Salaam",
        addressCountry: "TZ",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "HQ Investment Marketplace",
      url: appUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: `${appUrl}/products?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Store",
      name: "HQ Investment Marketplace",
      url: appUrl,
      description:
        "East Africa's premier e-commerce marketplace and ISP billing platform. Verified sellers, fast delivery, and secure payments.",
      image: `${appUrl}/og-image.jpg`,
      priceRange: "$$",
      telephone: "+255621085215",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Dar es Salaam",
        addressCountry: "TZ",
      },
    },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={structuredData} />

      {/* ── Navigation ─────────────────────────────────── */}
      <Navbar />

      {/* ── Hero ───────────────────────────────────────── */}
      <Hero />

      {/* ── Browse categories ──────────────────────────── */}
      <Categories />

      {/* ── Flash Sale ─────────────────────────────────── */}
      <FlashSale />

      {/* ── Featured Products ──────────────────────────── */}
      <FeaturedProducts />

      {/* ── Best Sellers ───────────────────────────────── */}
      <BestSellers />

      {/* ── Promotional banner carousel ────────────────── */}
      <PromoBanner />

      {/* ── Brand carousel ─────────────────────────────── */}
      <BrandCarousel />

      {/* ── Collections + Deals shelf ──────────────────── */}
      <CommerceHighlights />

      {/* ── Newly Arrived ──────────────────────────────── */}
      <LatestProducts />

      {/* ── Trending Now ───────────────────────────────── */}
      <TrendingProducts />

      {/* ── Trust, Payment, Lifestyle ──────────────────── */}
      <CommerceExperience />

      {/* ── Full Commerce Flow ─────────────────────────── */}
      <CommerceCommandSection />

      {/* ── Recently Viewed ────────────────────────────── */}
      <RecentlyViewedSection />

      {/* ── Customer Testimonials ──────────────────────── */}
      <Testimonials />

      {/* ── Mobile App Promotion ───────────────────────── */}
      <MobileAppBanner />

      {/* ── Blog / Buying Guides ───────────────────────── */}
      <BlogPreview />

      {/* ── ISP Platform Features ──────────────────────── */}
      <Features />

      {/* ── ISP Billing Plans ──────────────────────────── */}
      <Pricing />

      {/* ── FAQ ────────────────────────────────────────── */}
      <FAQ />

      {/* ── Contact ────────────────────────────────────── */}
      <Contact />

      {/* ── Footer ─────────────────────────────────────── */}
      <Footer />
    </main>
  );
}
