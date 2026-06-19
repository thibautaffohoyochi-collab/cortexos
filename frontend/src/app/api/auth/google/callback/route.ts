import { NextRequest, NextResponse } from "next/server"

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")

  if (!code || !state) {
    return NextResponse.redirect(new URL("/sources?error=oauth_failed", req.url))
  }

  // Forward to backend callback
  const backendUrl = `${API}/google/callback?code=${code}&state=${state}`
  return NextResponse.redirect(backendUrl)
}
