import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isAuthenticated = !!req.auth
  const hasError = (req.auth as any)?.error === "RefreshTokenError"
  const isAuthPage = req.nextUrl.pathname.startsWith("/login") ||
                     req.nextUrl.pathname.startsWith("/register") ||
                     req.nextUrl.pathname.startsWith("/join")
  const isPublicPage = req.nextUrl.pathname === "/"

  // Force re-login if refresh token failed
  if (hasError && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Redirect unauthenticated users to login
  if (!isAuthenticated && !isAuthPage && !isPublicPage) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL("/chat", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|$).*)"],
}
