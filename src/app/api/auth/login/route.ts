import { NextResponse } from "next/server";
import { SPOTIFY_AUTH_URL, SPOTIFY_SCOPES } from "@/lib/spotify";
import crypto from "crypto";

export function GET() {
  const state = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    scope: SPOTIFY_SCOPES,
    state,
  });

  const response = NextResponse.redirect(
    `${SPOTIFY_AUTH_URL}?${params.toString()}`
  );

  response.cookies.set("spotify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
  });

  return response;
}
