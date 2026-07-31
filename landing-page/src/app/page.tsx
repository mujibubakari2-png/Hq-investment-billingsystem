import Navbar from "@/components/Navbar";
import JsonLd from "@/components/JsonLd";
import Hero from "@/components/Hero";
import Categories from "@/components/Categories";
import { FeaturedProducts, LatestProducts, TrendingProducts } from "@/components/ProductSections";
import CommerceHighlights from "@/components/CommerceHighlights";
import CommerceExperience from "@/components/CommerceExperience";
import CommerceCommandSection from "@/components/CommerceCommandSection";
import RecentlyViewedSection from "@/components/RecentlyViewedSection";
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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hqinvestment.co.tz";
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
        telephone: "+255700000001",
        areaServed: "TZ",
        availableLanguage: ["English", "Swahili"],
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
  ];

  return (
    <main className="min-h-screen overflow-x-hidden">
      <JsonLd data={structuredData} />
      <Navbar />
      <Hero />
      <Categories />
      <CommerceHighlights />
      <FeaturedProducts />
      <PromoBanner />
      <LatestProducts />
      <TrendingProducts />
      <CommerceExperience />
      <CommerceCommandSection />
      <RecentlyViewedSection />
      <Statistics />
      <Testimonials />
      <Features />
      <Pricing />
      <Newsletter />
      <FAQ />
      <Contact />
      <Footer />
    </main>
  );
}
