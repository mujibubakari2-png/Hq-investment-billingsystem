import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.yourdomain.com';
    const now = new Date();

    return [
        {
            url: base,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 1.0,
        },
        {
            url: `${base}/api/health`,
            lastModified: now,
            changeFrequency: 'always',
            priority: 0.3,
        },
    ];
}
