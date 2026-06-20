import type { Metadata } from "next"
import "./globals.css"
import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/lib/theme"
import { LangProvider } from "@/lib/i18n"

export const metadata: Metadata = {
  title: "CortexOS — Interrogez vos données entreprise en langage naturel",
  description: "CortexOS centralise vos données d'entreprise (Gmail, Drive, CSV, Excel) et vous permet de les interroger avec une IA. Réponses instantanées, sources citées, multi-utilisateurs.",
  keywords: "IA entreprise, RAG, données entreprise, Gmail IA, assistant IA business, chatbot données",
  openGraph: {
    title: "CortexOS — Interrogez vos données entreprise en langage naturel",
    description: "Connectez Gmail, Drive, CSV et interrogez vos données avec une IA. Réponses avec sources citées.",
    url: "https://cortexos-xi.vercel.app",
    siteName: "CortexOS",
    type: "website",
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
      <body>
        <ThemeProvider>
          <LangProvider>
            <SessionProvider>
              {children}
            </SessionProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
