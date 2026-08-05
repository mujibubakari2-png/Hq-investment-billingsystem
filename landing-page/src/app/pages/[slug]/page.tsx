import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Calendar } from "lucide-react";
import type { Metadata } from "next";

// ─── Types ────────────────────────────────────────────────────────
interface CustomPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  updatedAt: string;
}

// ─── Fetch from DB ────────────────────────────────────────────────
async function fetchPage(slug: string): Promise<CustomPage | null> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001");

    const res = await fetch(`${baseUrl}/api/public/pages/${encodeURIComponent(slug)}`, {
      next: { revalidate: 120 },
    });

    if (!res.ok) return null;
    const json = await res.json();
    return (json.data as CustomPage) ?? null;
  } catch {
    return null;
  }
}

// ─── Simple content renderer ──────────────────────────────────────
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
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={key++} className="text-slate-600 leading-relaxed ml-4 mb-1 list-disc">
          {trimmed.slice(2)}
        </li>,
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
  const page = await fetchPage(slug);

  if (!page) return { title: "Page Not Found - HQ Investment" };

  return {
    title: `${page.title} - HQ Investment`,
  };
}

// ─── Page ─────────────────────────────────────────────────────────
export default async function CustomPageView({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await fetchPage(slug);

  if (!page) notFound();

  return (
    <div className="min-h-screen pt-32 pb-20 bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        {/* Article card */}
        <article className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 md:p-12">
          {/* Header */}
          <div className="flex items-start gap-4 mb-8 pb-8 border-b border-slate-100">
            <div className="p-3 rounded-2xl bg-blue-50 shrink-0">
              <FileText size={24} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 leading-tight">
                {page.title}
              </h1>
              <div className="flex items-center gap-2 text-sm text-slate-400 mt-2">
                <Calendar size={13} />
                <span>
                  Last updated:{" "}
                  {new Date(page.updatedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div>{renderContent(page.content)}</div>
        </article>

        {/* Footer note */}
        <p className="text-center text-xs text-slate-400 mt-8">
          This page is managed by HQ Investment. For questions, please{" "}
          <Link href="/support" className="text-blue-600 hover:underline">
            contact support
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
