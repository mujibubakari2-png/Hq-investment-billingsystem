import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'HQ Investment — ISP Billing & Network Management Platform',
    description:
        'HQ Investment is a modern, multi-tenant ISP billing and network management platform for Tanzanian internet service providers. Manage subscribers, RADIUS, MikroTik routers, payments, and reporting — all in one place.',
    keywords: [
        'ISP billing system', 'Tanzania ISP', 'MikroTik management', 'RADIUS billing',
        'PPPoE management', 'hotspot billing', 'internet service provider software',
        'subscriber management', 'network management Tanzania', 'HQ Investment',
    ],
    authors: [{ name: 'HQ Investment Ltd' }],
    creator: 'HQ Investment Ltd',
    publisher: 'HQ Investment Ltd',
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.yourdomain.com'),
    openGraph: {
        type: 'website',
        locale: 'en_TZ',
        url: '/',
        siteName: 'HQ Investment ISP Platform',
        title: 'HQ Investment — ISP Billing & Network Management',
        description:
            'Multi-tenant ISP billing platform with RADIUS, MikroTik, PPPoE, Hotspot, mobile payments, and real-time analytics.',
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'HQ Investment Platform' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'HQ Investment — ISP Billing Platform',
        description: 'Modern ISP billing & network management for Tanzanian ISPs.',
        images: ['/og-image.png'],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    icons: {
        icon: '/favicon.ico',
        apple: '/apple-touch-icon.png',
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body style={{ margin: 0, padding: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>
                {children}
            </body>
        </html>
    );
}
