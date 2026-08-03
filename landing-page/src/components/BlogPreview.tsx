"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen, Clock, Tag } from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
  category?: string | null;
  readTime?: number | null;
  publishedAt?: string | null;
  author?: {
    name: string;
    avatar?: string | null;
  } | null;
}

// Static buying guides shown when API returns nothing
const FALLBACK_POSTS: BlogPost[] = [
  {
    id: "1",
    title: "How to Choose the Best Laptop for Your Business Team",
    slug: "business-laptop-guide",
    excerpt:
      "From processor specs to battery life and security features — everything you need to make the right laptop investment for your team.",
    category: "Buying Guide",
    readTime: 6,
    publishedAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
  },
  {
    id: "2",
    title: "Mobile Money Checkout: A Safety Checklist for Online Shoppers",
    slug: "mobile-money-safety",
    excerpt:
      "Stay safe when paying via M-Pesa, Airtel Money, or Halo. These practical tips help you avoid fraud and shop with confidence.",
    category: "Security",
    readTime: 4,
    publishedAt: new Date(Date.now() - 5 * 86400_000).toISOString(),
  },
  {
    id: "3",
    title: "Top 10 Electronics to Look Out for This Season",
    slug: "electronics-buying-guide",
    excerpt:
      "Smartphones, audio gear, wearables, and home automation — our editors have curated the must-have tech picks of the season.",
    category: "Trending",
    readTime: 5,
    publishedAt: new Date(Date.now() - 8 * 86400_000).toISOString(),
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Buying Guide": "bg-blue-50 text-blue-700",
  "Security": "bg-amber-50 text-amber-700",
  "Trending": "bg-rose-50 text-rose-600",
  "News": "bg-emerald-50 text-emerald-700",
  "Tips": "bg-violet-50 text-violet-700",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function BlogCard({ post, index }: { post: BlogPost; index: number }) {
  const catClass = CATEGORY_COLORS[post.category ?? ""] ?? "bg-slate-50 text-slate-600";

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: index * 0.1 }}
      className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      {/* Cover image */}
      <Link href={`/blog/${post.slug}`} className="block relative h-48 bg-slate-100 overflow-hidden shrink-0">
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
        <div className="flex items-center gap-2 mb-3">
          {post.category && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${catClass}`}>
              <Tag size={9} />
              {post.category}
            </span>
          )}
          {post.readTime && (
            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
              <Clock size={10} />
              {post.readTime} min read
            </span>
          )}
        </div>

        <Link href={`/blog/${post.slug}`}>
          <h3 className="font-display font-bold text-slate-900 leading-snug mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h3>
        </Link>

        {post.excerpt && (
          <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 flex-1 mb-4">
            {post.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
          {/* Author */}
          <div className="flex items-center gap-2 min-w-0">
            {post.author?.avatar ? (
              <div className="relative w-7 h-7 rounded-full overflow-hidden shrink-0">
                <Image src={post.author.avatar} alt={post.author.name} fill className="object-cover" sizes="28px" />
              </div>
            ) : (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ background: "var(--gradient-primary)" }}
              >
                {(post.author?.name ?? "HQ")[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">
                {post.author?.name ?? "HQ Editorial"}
              </p>
              {post.publishedAt && (
                <p className="text-[10px] text-slate-400">{timeAgo(post.publishedAt)}</p>
              )}
            </div>
          </div>

          <Link
            href={`/blog/${post.slug}`}
            className="flex items-center gap-1 text-xs font-bold text-primary hover:text-secondary transition-colors shrink-0"
          >
            Read
            <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

export default function BlogPreview() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/blog/posts?limit=3")
      .then((r) => r.json())
      .then((d) => {
        const data: BlogPost[] = d.data ?? [];
        setPosts(data.length > 0 ? data : FALLBACK_POSTS);
      })
      .catch(() => setPosts(FALLBACK_POSTS))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="blog" className="py-20 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <BookOpen size={18} className="text-primary" />
              </div>
              <span className="text-sm font-semibold text-primary uppercase tracking-widest">
                From the Blog
              </span>
            </div>
            <h2 className="section-title">Guides &amp; Insights</h2>
            <p className="text-slate-500 mt-2">
              Buying guides, product news, and tips to help you shop smarter.
            </p>
          </div>
          <Link
            href="/blog"
            className="hidden sm:flex items-center gap-2 text-sm font-semibold text-primary hover:text-secondary transition-colors group"
          >
            All Articles
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-slate-100">
                <div className="skeleton h-48 w-full" />
                <div className="p-5 space-y-3 bg-white">
                  <div className="skeleton h-4 w-1/3 rounded" />
                  <div className="skeleton h-6 w-full rounded" />
                  <div className="skeleton h-4 w-5/6 rounded" />
                  <div className="skeleton h-4 w-3/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {posts.map((post, i) => (
              <BlogCard key={post.id} post={post} index={i} />
            ))}
          </div>
        )}

        {/* Mobile CTA */}
        <div className="sm:hidden mt-8 text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold text-white"
            style={{ background: "var(--gradient-primary)" }}
          >
            All Articles <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
