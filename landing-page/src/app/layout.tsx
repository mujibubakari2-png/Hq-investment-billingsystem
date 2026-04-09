import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "HQ Investment Billing | Reliable ISP Billing System",
  description: "Manage your internet customers, payments, and subscriptions easily with HQ Investment Billing System.",
  keywords: ["ISP Billing", "MikroTik management", "Hotspot billing", "PPPoE billing", "ISP automation"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
