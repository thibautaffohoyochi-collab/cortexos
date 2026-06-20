import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Session cookie lasts 7 days
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },

  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const res = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: credentials.email, password: credentials.password }),
        })

        if (!res.ok) return null
        const data = await res.json()

        const profileRes = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        })
        if (!profileRes.ok) return null
        const profile = await profileRes.json()

        return {
          id: profile.id,
          email: profile.email,
          name: profile.full_name,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          tenantId: profile.tenant_id,
          tenantName: profile.tenant_name,
          isAdmin: profile.is_admin,
        }
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid email profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/drive.readonly",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      // First sign in — store everything with 7-day expiry
      if (user) {
        token.accessToken = (user as any).accessToken
        token.refreshToken = (user as any).refreshToken
        token.tenantId = (user as any).tenantId
        token.tenantName = (user as any).tenantName
        token.isAdmin = (user as any).isAdmin
        token.accessTokenExpires = Date.now() + SEVEN_DAYS_MS
        token.error = undefined
        return token
      }

      if (account?.provider === "google") {
        token.googleAccessToken = account.access_token
        token.googleRefreshToken = account.refresh_token
        token.accessTokenExpires = Date.now() + SEVEN_DAYS_MS
        token.error = undefined
        return token
      }

      // Token still valid — return as-is
      const expires = token.accessTokenExpires as number ?? 0
      if (Date.now() < expires) {
        return token
      }

      // Token expired — try refresh
      if (!token.refreshToken) {
        token.error = "RefreshTokenError"
        return token
      }

      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: token.refreshToken }),
        })

        if (!res.ok) throw new Error(`Refresh failed: ${res.status}`)

        const data = await res.json()
        token.accessToken = data.access_token
        token.refreshToken = data.refresh_token ?? token.refreshToken
        token.accessTokenExpires = Date.now() + SEVEN_DAYS_MS
        token.error = undefined
      } catch (err) {
        console.error("[NextAuth] Token refresh failed:", err)
        token.error = "RefreshTokenError"
      }

      return token
    },

    async session({ session, token }) {
      session.user = {
        ...session.user,
        accessToken: token.accessToken as string,
        tenantId: token.tenantId as string,
        tenantName: token.tenantName as string,
        isAdmin: token.isAdmin as boolean,
      } as any

      if (token.error) {
        (session as any).error = token.error
      }

      return session
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
})
