import type { Metadata } from "next";
import "@/styles/globals.css";
import { CartProvider } from "@/lib/cart";
import { ToastProvider } from "@/components/ui/Toast";
import CartDrawer from "@/components/cart/CartDrawer";

export const metadata: Metadata = {
  title: {
    default: "HQ Investment — ISP Billing & Marketplace",
    template: "%s | HQ Investment",
  },
  description:
    "HQ Investment — your all-in-one platform for ISP billing management and premium product marketplace. Trusted by ISPs across East Africa.",
  keywords: [
    "ISP Billing System",
    "MikroTik billing",
    "Hotspot billing Tanzania",
    "PPPoE management",
    "ISP automation East Africa",
    "online marketplace Tanzania",
    "e-commerce East Africa",
    "HQ Investment",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "HQ Investment",
    title: "HQ Investment — ISP Billing & Marketplace",
    description:
      "Automate your ISP billing and shop premium products at HQ Investment marketplace.",
  },
  twitter: {
    card: "summary_large_image",
    title: "HQ Investment",
    description: "ISP Billing & E-Commerce Marketplace",
  },
  robots: { index: true, follow: true },
  viewport: { width: "device-width", initialScale: 1 },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect for Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased font-sans">
        <ToastProvider>
          <CartProvider>
            {children}
            <CartDrawer />
          </CartProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
