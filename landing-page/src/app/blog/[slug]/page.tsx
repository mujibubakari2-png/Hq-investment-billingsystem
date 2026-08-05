import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, User, Clock, BookOpen } from "lucide-react";
import type { Metadata } from "next";

// ─── Types ────────────────────────────────────────────────────────
interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  coverImage?: string | null;
  readTime?: number | null;
  publishedAt?: string | null;
  author?: { name: string; avatar?: string | null } | null;
}

// ─── Static fallback posts (shown only if slug not in DB) ─────────
// Kept for backward compatibility with existing links to these slugs.
const STATIC_POSTS: Record<string, { title: string; content: string; date: string; author: string }> = {
  "business-laptop-guide": {
    title: "How to Choose the Best Laptop for Your Business Team",
    date: "Aug 12, 2026",
    author: "HQ Investment Tech Team",
    content: `
Choosing the right laptops for your business team is crucial for productivity, security, and employee satisfaction. This guide outlines the key factors you should consider when making enterprise purchases.

## 1. Performance Requirements

Determine the primary use case. Developers and designers need high-end processors (Intel Core i7/i9 or Apple M-series) and dedicated graphics, while customer service representatives might only need standard processors (Intel Core i5) focused on web browsing and CRM tasks.

## 2. Build Quality and Portability

If your team works remotely or travels often, prioritize lightweight laptops (under 3.5 lbs) with durable build materials like aluminum or carbon fiber. Battery life should reliably last over 8 hours to support an entire workday off the charger.

## 3. Security Features

Enterprise laptops must include hardware security. Look for TPM 2.0 chips, biometric authentication (fingerprint readers or IR cameras for Windows Hello), and smart card readers depending on your industry compliance requirements.
    `.trim(),
  },
  "mobile-money-safety": {
    title: "Mobile Money Checkout: A Safety Checklist for Online Shoppers",
    date: "Sep 05, 2026",
    author: "HQ Investment Security",
    content: `
Mobile money is one of the most popular payment methods in East Africa. However, scammers frequently target users during the checkout process. Follow this checklist to ensure your funds are safe.

## Verify the Merchant Name

When you receive the USSD push prompt or enter the till number, always verify the merchant name matches the store you are buying from. If it displays a personal name instead of a registered business, cancel the transaction.

## Never Share Your PIN

Your PIN is your signature. No legitimate business, customer support agent, or payment gateway will ever ask for your PIN. You should only enter it directly into your phone's secure M-Pesa or Tigo Pesa prompt.

## Confirm the Order Amount

Scammers sometimes initiate a push request for a higher amount than your actual cart total. Double-check the exact amount on your phone screen before pressing enter.
    `.trim(),
  },
  "electronics-buying-guide": {
    title: "Top 10 Electronics to Look Out for This Season",
    date: "Oct 18, 2026",
    author: "HQ Investment QA",
    content: `
Buying electronics online can be daunting, but following a few simple inspection rules can save you from receiving counterfeit or faulty products.

## Check the Warranty Details

Authentic electronics always come with a manufacturer's warranty. Check if the warranty is valid in your region and if the seller provides a clear return policy for dead-on-arrival (DOA) items.

## Read Verified Reviews

Don't just look at the star rating. Read reviews that include photos of the delivered product. Look for specific mentions of battery life, screen quality, or any overheating issues which are common in counterfeits.

## Inspect the Specifications

Compare the listed specifications with the official manufacturer's website. If a deal looks too good to be true (e.g., a 2TB flash drive for $5), it is almost certainly a fake product with altered firmware.
    `.trim(),
  },
};

// ─── Fetch a single post from DB ──────────────────────────────────
async function fetchPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001");

    const res = await fetch(
      `${baseUrl}/api/public/blog/posts?slug=${encodeURIComponent(slug)}`,
      { next: { revalidate: 60 } },
    );

    if (!res.ok) return null;
    const json = await res.json();
    return (json.data as BlogPost) ?? null;
  } catch {
    return null;
  }
}

// ─── Render markdown-like content as paragraphs + headings ────────
// Simple renderer — no external dependency needed for this use case.
function renderContent(raw: string) {
  const lines = raw.split(/\n/);
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { key++; continue; }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="text-2xl font-bold text-slate-900 mt-8 mb-3">
          {trimmed.slice(3)}
        </h2>,
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={key++} className="text-3xl font-bold text-slate-900 mt-8 mb-4">
          {trimmed.slice(2)}
        </h1>,
      );
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="text-xl font-semibold text-slate-800 mt-6 mb-2">
          {trimmed.slice(4)}
        </h3>,
      );
    } else {
      elements.push(
        <p key={key++} className="text-slate-600 leading-relaxed mb-4">
          {trimmed}
        </p>,
      );
    }
  }

  return <>{elements}</>;
}

// ─── Metadata ─────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const dbPost = await fetchPostBySlug(slug);
  if (dbPost) {
    return {
      title: `${dbPost.title} - HQ Investment Blog`,
      description: dbPost.excerpt ?? undefined,
    };
  }

  const staticPost = STATIC_POSTS[slug];
  if (staticPost) {
    return { title: `${staticPost.title} - HQ Investment Blog` };
  }

  return { title: "Post Not Found" };
}

// ─── Page ─────────────────────────────────────────────────────────
export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // 1. Try DB first
  const dbPost = await fetchPostBySlug(slug);

  if (dbPost) {
    return (
      <div className="min-h-screen pt-32 pb-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors mb-8"
          >
            <ArrowLeft size={16} />
            Back to all articles
          </Link>

          <article className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Cover */}
            {dbPost.coverImage && (
              <div className="relative h-64 sm:h-80 w-full bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dbPost.coverImage}
                  alt={dbPost.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-8 md:p-12">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6 leading-tight">
                {dbPost.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-slate-500 mb-10 pb-8 border-b border-slate-100">
                {dbPost.author && (
                  <div className="flex items-center gap-2">
                    <User size={15} />
                    <span>{dbPost.author.name}</span>
                  </div>
                )}
                {dbPost.publishedAt && (
                  <div className="flex items-center gap-2">
                    <Calendar size={15} />
                    <span>
                      {new Date(dbPost.publishedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
                {dbPost.readTime && (
                  <div className="flex items-center gap-2">
                    <Clock size={15} />
                    <span>{dbPost.readTime} min read</span>
                  </div>
                )}
              </div>

              <div className="prose-like">
                {renderContent(dbPost.content)}
              </div>
            </div>
          </article>

          <div className="mt-8 text-center">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              <BookOpen size={16} />
              More Articles
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 2. Fallback to static posts (backward compatibility)
  const staticPost = STATIC_POSTS[slug];

  if (staticPost) {
    return (
      <div className="min-h-screen pt-32 pb-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors mb-8"
          >
            <ArrowLeft size={16} />
            Back to all articles
          </Link>

          <article className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6 leading-tight">
              {staticPost.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-slate-500 mb-10 pb-8 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar size={15} />
                <span>{staticPost.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <User size={15} />
                <span>{staticPost.author}</span>
              </div>
            </div>

            <div className="prose-like">
              {renderContent(staticPost.content)}
            </div>
          </article>
        </div>
      </div>
    );
  }

  // 3. 404
  notFound();
}
