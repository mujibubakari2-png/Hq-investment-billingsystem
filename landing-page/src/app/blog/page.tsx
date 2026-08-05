import React from "react";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, ArrowRight, Clock, Tag, Calendar } from "lucide-react";

export const metadata = {
  title: "Blog & Buying Guides - HQ Investment",
  description: "Read our latest articles, buying guides, and product insights.",
};

// ─── Types ────────────────────────────────────────────────────────
interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  readTime?: number | null;
  publishedAt?: string | null;
  author?: { name: string; avatar?: string | null } | null;
}

// ─── Fetch from DB via public API ─────────────────────────────────
async function fetchPosts(): Promise<BlogPost[]> {
  try {
    // Use absolute URL for server-side fetch in Next.js
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001");

    const res = await fetch(`${baseUrl}/api/public/blog/posts?limit=12`, {
      next: { revalidate: 60 }, // ISR: revalidate every 60 seconds
    });

    if (!res.ok) return [];
    const json = await res.json();
    return (json.data as BlogPost[]) ?? [];
  } catch {
    return [];
  }
}

// ─── Static fallback (shown only if DB has no posts yet) ─────────
const FALLBACK_POSTS: BlogPost[] = [
  {
    id: "1",
    title: "How to Choose the Best Laptop for Your Business Team",
    slug: "business-laptop-guide",
    excerpt:
      "From processor specs to battery life and security features — everything you need to make the right laptop investment for your team.",
    readTime: 6,
    publishedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
  {
    id: "2",
    title: "Mobile Money Checkout: A Safety Checklist for Online Shoppers",
    slug: "mobile-money-safety",
    excerpt:
      "Stay safe when paying via M-Pesa, Airtel Money, or Halo. These practical tips help you avoid fraud and shop with confidence.",
    readTime: 4,
    publishedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  },
  {
    id: "3",
    title: "Top 10 Electronics to Look Out for This Season",
    slug: "electronics-buying-guide",
    excerpt:
      "Smartphones, audio gear, wearables, and home automation — our editors have curated the must-have tech picks of the season.",
    readTime: 5,
    publishedAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Card ─────────────────────────────────────────────────────────
function BlogCard({ post, index }: { post: BlogPost; index: number }) {
  const isFromDB = !["1", "2", "3"].includes(post.id);
  const href = isFromDB ? `/blog/${post.slug}` : `/blog/${post.slug}`;

  return (
    <article className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
      {/* Cover image */}
      <Link href={href} className="block relative h-48 bg-slate-100 overflow-hidden shrink-0">
        {post.coverImage ? (
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, hsl(${210 + index * 40}, 70%, 20%), hsl(${210 + index * 40}, 70%, 35%))`,
            }}
          >
            <BookOpen size={40} className="text-white/30" />
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {post.readTime && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <Clock size={10} />
              {post.readTime} min read
            </span>
          )}
          {post.publishedAt && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <Calendar size={10} />
              {timeAgo(post.publishedAt)}
            </span>
          )}
        </div>

        <Link href={href}>
          <h2 className="font-bold text-slate-900 leading-snug mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors text-lg">
            {post.title}
          </h2>
        </Link>

        {post.excerpt && (
          <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 flex-1 mb-4">
            {post.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" }}
            >
              {(post.author?.name ?? "HQ")[0].toUpperCase()}
            </div>
            <p className="text-xs font-semibold text-slate-700 truncate">
              {post.author?.name ?? "HQ Editorial"}
            </p>
          </div>

          <Link
            href={href}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors shrink-0"
          >
            Read
            <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────
export default async function BlogIndexPage() {
  const dbPosts = await fetchPosts();
  const posts = dbPosts.length > 0 ? dbPosts : FALLBACK_POSTS;
  const isLive = dbPosts.length > 0;

  return (
    <div className="min-h-screen pt-32 pb-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold mb-4">
            <BookOpen size={16} />
            {isLive ? "Our Blog" : "Buying Guides"}
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">
            {isLive ? "Insights & Articles" : "Insights & Guides"}
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Discover tips, news, and comprehensive buying guides to help you make informed decisions.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {posts.map((post, i) => (
            <BlogCard key={post.id} post={post} index={i} />
          ))}
        </div>

        {/* Empty state (if DB has posts but all are unpublished) */}
        {posts.length === 0 && (
          <div className="text-center py-20">
            <BookOpen size={48} className="text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No articles published yet. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
