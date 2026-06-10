import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'JobSphere',
  description: 'AI-Powered Applicant Tracking System',
}

/**
 * Root layout — intentionally does NOT render <html>/<body>.
 * The [locale]/layout.tsx nested layout owns the full document structure
 * (including <html lang={locale}>) so the document lang is always set to
 * the active locale rather than a hardcoded "en".
 * Next.js 14 supports this pattern when a nested layout provides the
 * html/body elements.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
