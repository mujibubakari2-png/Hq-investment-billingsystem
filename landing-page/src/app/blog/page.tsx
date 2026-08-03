import React from "react";
import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";
import { landingBuyingGuides } from "@/config/landing";

export const metadata = {
  title: "Blog & Buying Guides - HQ Investment",
  description: "Read our latest articles, buying guides, and updates.",
};

export default function BlogIndexPage() {
  return (
    <div className="min-h-screen pt-32 pb-20 bg-softBg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm font-semibold text-primary mb-4">
            <BookOpen size={16} />
            Our Blog
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-primary mb-4">
            Insights & Guides
          </h1>
          <p className="text-lg text-secondary max-w-2xl mx-auto">
            Discover tips, news, and comprehensive buying guides to help you make informed decisions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {landingBuyingGuides.map((guide, i) => (
            <Link href={guide.href} key={i} className="group glass-card rounded-2xl overflow-hidden flex flex-col hover:-translate-y-1 transition-transform">
              <div className="aspect-[16/9] bg-gradient-to-br from-blue-100 to-emerald-50 flex items-center justify-center p-6 text-center">
                <BookOpen size={40} className="text-primary/20" />
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-xl font-bold text-primary mb-3 group-hover:text-blue-600 transition-colors">
                  {guide.title}
                </h3>
                <div className="mt-auto pt-4 flex items-center justify-between text-sm font-semibold text-blue-600">
                  <span>Read Guide</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
