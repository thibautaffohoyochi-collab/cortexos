import type { Metadata, Viewport } from "next"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/lib/theme"
import { LangProvider } from "@/lib/i18n"
import AutoRefresh from "@/components/ui/AutoRefresh"
import { OnboardingGuard } from "@/components/ui/OnboardingGuard"
import { InstallPrompt } from "@/components/ui/InstallPrompt"

export const viewport: Viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: "CortexOS — IA Business",
  description: "Interrogez vos données entreprise en langage naturel. Chat IA, recherche web, workflows automatisés.",
  keywords: "IA entreprise, RAG, données entreprise, Gmail IA, assistant IA business, chatbot données",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CortexOS",
    startupImage: [
      {
        url: "/icons/icon-512x512.png",
        media: "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/icons/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/icons/icon-192x192.png",
  },
  openGraph: {
    title: "CortexOS — Interrogez vos données entreprise en langage naturel",
    description: "Connectez Gmail, Drive, CSV et interrogez vos données avec une IA. Réponses avec sources citées.",
    url: "https://cortexos-xi.vercel.app",
    siteName: "CortexOS",
    type: "website",
    images: [{ url: "/icons/icon-512x512.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CortexOS — IA pour vos données entreprise",
    description: "Interrogez vos emails, fichiers et données en langage naturel.",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        {/* PWA meta tags */}
        <meta name="application-name" content="CortexOS" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CortexOS" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#2563eb" />
        <meta name="msapplication-tap-highlight" content="no" />
        {/* Apple splash screens */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-startup-image" href="/icons/icon-512x512.png" />
      </head>
      <body>
        <ThemeProvider>
          <LangProvider>
            <SessionProvider>
              <AutoRefresh />
              <OnboardingGuard />
              <InstallPrompt />
              {children}
            </SessionProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
