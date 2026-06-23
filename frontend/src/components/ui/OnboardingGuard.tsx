"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"

// Pages that don't need onboarding redirect
const PUBLIC_PATHS = ["/", "/login", "/register", "/onboarding", "/join"]

export function OnboardingGuard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status !== "authenticated") return
    if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return

    // Check if onboarding was completed
    const done = localStorage.getItem("cortexos-onboarding-done")
    if (!done) {
      router.push("/onboarding")
    }
  }, [status, pathname])

  return null
}
