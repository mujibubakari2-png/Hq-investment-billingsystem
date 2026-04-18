import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HQ Investment Backend',
  description: 'Backend API for ISP Billing System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
