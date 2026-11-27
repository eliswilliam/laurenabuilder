import type { Metadata } from 'next'
import { headers } from "next/headers"
import './globals.css'
import { PostHogProvider } from '../components/PostHogProvider'
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/components/auth/auth-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { I18nProvider } from "@/i18n/provider"
import { detectLocaleFromAcceptLanguage } from "@/i18n/locales"
// Navbar moved to chat-specific layout

export const metadata: Metadata = {
  title: 'Laurena Builder',
  description: 'Build websites with AI — Laurena Builder',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const headerStore = await headers()
  const initialLocale = detectLocaleFromAcceptLanguage(headerStore.get("accept-language"))

  return (
    // Suppress hydration warning for html attributes modified by next-themes script
    <html lang={initialLocale} suppressHydrationWarning>
      <body>
        <I18nProvider initialLocale={initialLocale}>
          <AuthProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
              <PostHogProvider>
                <main className="min-h-[calc(100vh-4rem)]">
                  {children}
                </main>
                <Toaster richColors position="top-center" />
              </PostHogProvider>
            </ThemeProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
