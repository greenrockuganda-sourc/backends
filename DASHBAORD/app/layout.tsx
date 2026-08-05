import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Seller Dashboard | Order & Inventory Management',
  description: 'Professional seller dashboard for managing products, orders, deliveries, and receipts',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
