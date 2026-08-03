import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, User } from "lucide-react";
import { landingBuyingGuides } from "@/config/landing";

// In a real app, this would be fetched from a CMS or database.
const blogPosts: Record<string, { title: string; content: React.ReactNode; date: string; author: string }> = {
  "business-laptop-guide": {
    title: "How to choose a laptop for business teams",
    date: "Aug 12, 2026",
    author: "HQ Investment Tech Team",
    content: (
      <>
        <p>Choosing the right laptops for your business team is crucial for productivity, security, and employee satisfaction. This guide outlines the key factors you should consider when making enterprise purchases.</p>
        <h2>1. Performance Requirements</h2>
        <p>Determine the primary use case. Developers and designers need high-end processors (Intel Core i7/i9 or Apple M-series) and dedicated graphics, while customer service representatives might only need standard processors (Intel Core i5) focused on web browsing and CRM tasks.</p>
        <h2>2. Build Quality and Portability</h2>
        <p>If your team works remotely or travels often, prioritize lightweight laptops (under 3.5 lbs) with durable build materials like aluminum or carbon fiber. Battery life should reliably last over 8 hours to support an entire workday off the charger.</p>
        <h2>3. Security Features</h2>
        <p>Enterprise laptops must include hardware security. Look for TPM 2.0 chips, biometric authentication (fingerprint readers or IR cameras for Windows Hello), and smart card readers depending on your industry compliance requirements.</p>
      </>
    )
  },
  "mobile-money-safety": {
    title: "Mobile money checkout safety checklist",
    date: "Sep 05, 2026",
    author: "HQ Investment Security",
    content: (
      <>
        <p>Mobile money is one of the most popular payment methods in East Africa. However, scammers frequently target users during the checkout process. Follow this checklist to ensure your funds are safe.</p>
        <h2>Verify the Merchant Name</h2>
        <p>When you receive the USSD push prompt or enter the till number, always verify the merchant name matches the store you are buying from. If it displays a personal name instead of a registered business, cancel the transaction.</p>
        <h2>Never Share Your PIN</h2>
        <p>Your PIN is your signature. No legitimate business, customer support agent, or payment gateway will ever ask for your PIN. You should only enter it directly into your phone&apos;s secure M-Pesa or Tigo Pesa prompt.</p>
        <h2>Confirm the Order Amount</h2>
        <p>Scammers sometimes initiate a push request for a higher amount than your actual cart total. Double-check the exact amount on your phone screen before pressing enter.</p>
      </>
    )
  },
  "electronics-buying-guide": {
    title: "What to inspect before buying electronics online",
    date: "Oct 18, 2026",
    author: "HQ Investment QA",
    content: (
      <>
        <p>Buying electronics online can be daunting, but following a few simple inspection rules can save you from receiving counterfeit or faulty products.</p>
        <h2>Check the Warranty Details</h2>
        <p>Authentic electronics always come with a manufacturer&apos;s warranty. Check if the warranty is valid in your region and if the seller provides a clear return policy for dead-on-arrival (DOA) items.</p>
        <h2>Read Verified Reviews</h2>
        <p>Don&apos;t just look at the star rating. Read reviews that include photos of the delivered product. Look for specific mentions of battery life, screen quality, or any overheating issues which are common in counterfeits.</p>
        <h2>Inspect the Specifications</h2>
        <p>Compare the listed specifications with the official manufacturer&apos;s website. If a deal looks too good to be true (e.g., a 2TB flash drive for $5), it is almost certainly a fake product with altered firmware.</p>
      </>
    )
  }
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const post = blogPosts[resolvedParams.slug];
  if (!post) return { title: "Post Not Found" };
  return { title: `${post.title} - HQ Investment Blog` };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const post = blogPosts[resolvedParams.slug];

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen pt-32 pb-20 bg-softBg">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors mb-8">
          <ArrowLeft size={16} />
          Back to all articles
        </Link>

        <article className="glass-card rounded-3xl p-8 md:p-12">
          <h1 className="text-3xl md:text-5xl font-extrabold text-primary mb-6 leading-tight">
            {post.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-6 text-sm text-secondary mb-10 pb-10 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>{post.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <User size={16} />
              <span>{post.author}</span>
            </div>
          </div>

          <div className="prose prose-lg prose-slate max-w-none 
            prose-headings:font-bold prose-headings:text-primary 
            prose-p:text-secondary prose-p:leading-relaxed
            prose-a:text-blue-600 hover:prose-a:text-blue-700"
          >
            {post.content}
          </div>
        </article>

      </div>
    </div>
  );
}
