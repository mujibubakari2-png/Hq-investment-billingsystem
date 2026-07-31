import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hqinvestment.co.tz";
  const now = new Date();

  return [
    { url: baseUrl, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/products`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/wishlist`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${baseUrl}/compare`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${baseUrl}/recently-viewed`, lastModified: now, changeFrequency: "weekly", priority: 0.3 },
  ];
}
