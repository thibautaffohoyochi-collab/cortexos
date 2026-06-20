"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"

/**
 * Watches for RefreshTokenError and redirects to login.
 * Also warns 5 minutes before expiry (future enhancement).
 */
export default function AutoRefresh() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const publicPaths = ["/", "/login", "/register"]
    if (publicPaths.some(p => pathname === p || pathname.startsWith("/join"))) return

    if ((session as any)?.error === "RefreshTokenError") {
      signOut({ redirect: false }).then(() => {
        router.push("/login")
      })
    }
  }, [session, pathname, router])

  return null
}
