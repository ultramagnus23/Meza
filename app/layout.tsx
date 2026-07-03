import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

// Every page in this app reads client-side auth/session state and talks to
// Supabase at runtime - none of it is safe to statically prerender and cache
// at the CDN edge. Without this, Next.js treats plain 'use client' pages
// with no server data fetching as fully static and lets Render's Cloudflare
// front-end cache the HTML shell for up to a year (s-maxage=31536000),
// which meant a broken early deploy's markup could keep being served long
// after the underlying bug was fixed. Forcing dynamic rendering at the root
// layout applies to every nested route and stops that class of staleness
// entirely, at the cost of skipping static optimization (acceptable here -
// this is an authenticated SaaS dashboard, not a marketing site).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Experience Intelligence Platform",
  description: "Understand how physical environments influence customer behavior and business outcomes",
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <Toaster position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
