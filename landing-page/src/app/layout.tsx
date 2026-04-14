import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "HQInvestment Billing | ISP Billing & Management System for East Africa",
  description: "Stop chasing payments. HQInvestment automates billing, manages Hotspot & PPPoE subscribers, and integrates with MikroTik — so your ISP runs itself. Trusted by ISPs across Tanzania, Kenya & Uganda.",
  keywords: ["ISP Billing System", "MikroTik billing", "Hotspot billing Tanzania", "PPPoE management", "ISP automation East Africa", "internet billing software", "subscriber management"],
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
