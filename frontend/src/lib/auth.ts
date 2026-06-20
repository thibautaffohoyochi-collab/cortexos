import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"

const API_URL = process.env.NEXT_PUBLIC_API_URL!

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // Email + password → calls our FastAPI backend
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
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        })

        if (!res.ok) return null

        const data = await res.json()

        // Fetch user profile
        const profileRes = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${data.access_token}` },
        })
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

    // Google (for Gmail + Drive access)
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
      // Initial sign in
      if (user) {
        token.accessToken = (user as any).accessToken
        token.refreshToken = (user as any).refreshToken
        token.tenantId = (user as any).tenantId
        token.tenantName = (user as any).tenantName
        token.isAdmin = (user as any).isAdmin
        // Token expires in 60 min — store expiry time
        token.accessTokenExpires = Date.now() + 23 * 60 * 60 * 1000 // 23h
      }
      if (account?.provider === "google") {
        token.googleAccessToken = account.access_token
        token.googleRefreshToken = account.refresh_token
      }

      // Token still valid
      if (Date.now() < (token.accessTokenExpires as number ?? 0)) {
        return token
      }

      // Token expired — refresh it
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: token.refreshToken }),
        })
        if (!res.ok) throw new Error("Refresh failed")
        const data = await res.json()
        token.accessToken = data.access_token
        token.refreshToken = data.refresh_token ?? token.refreshToken
        token.accessTokenExpires = Date.now() + 23 * 60 * 60 * 1000
      } catch {
        // Refresh failed — force re-login
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
      // Expose error to client so it can redirect to login
      if (token.error) (session as any).error = token.error
      return session
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
})
