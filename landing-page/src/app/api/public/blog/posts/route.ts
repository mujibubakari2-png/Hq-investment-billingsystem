import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBoundedInt } from "@/lib/publicApi";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/blog/posts
 * Returns published blog posts created in the Super Admin (BlogsPage.tsx).
 * Query params: limit, page, slug (single post lookup)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Single post by slug
    const slug = searchParams.get("slug");
    if (slug) {
      const post = await prisma.blogPost.findFirst({
        where: { slug, isPublished: true },
      });

      if (!post) {
        return NextResponse.json(
          { success: false, error: "Post not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        data: mapPost(post),
      });
    }

    // Paginated list
    const page = parseBoundedInt(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);
    const limit = parseBoundedInt(searchParams.get("limit"), 6, 1, 50);
    const skip = (page - 1) * limit;

    const [total, posts] = await Promise.all([
      prisma.blogPost.count({ where: { isPublished: true } }),
      prisma.blogPost.findMany({
        where: { isPublished: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: posts.map(mapPost),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("[PUBLIC/blog/posts] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load blog posts" },
      { status: 500 },
    );
  }
}

// ─── Map DB row to public shape ────────────────────────────────
function mapPost(post: {
  id: string;
  title: string;
  slug: string;
  content: string;
  author: string | null;
  coverImageUrl: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  // Derive a short excerpt from the content (first 180 chars, strip markdown)
  const excerpt = post.content
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*{1,2}(.*?)\*{1,2}/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 180);

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: excerpt || null,
    coverImage: post.coverImageUrl ?? null,
    author: post.author ? { name: post.author, avatar: null } : null,
    publishedAt: post.createdAt.toISOString(),
    // Estimate read time: ~200 words per minute
    readTime: Math.max(1, Math.ceil(post.content.split(/\s+/).length / 200)),
  };
}
