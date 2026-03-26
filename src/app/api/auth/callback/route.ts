import { NextRequest, NextResponse } from "next/server";
import { SPOTIFY_TOKEN_URL } from "@/lib/spotify";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = req.cookies.get("spotify_oauth_state")?.value;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const isSecure = process.env.NODE_ENV === "production";

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(new URL("/?error=auth_failed", appUrl));
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;

  const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${appUrl}/api/auth/callback`,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return NextResponse.redirect(new URL("/?error=token_failed", appUrl));
  }

  const expiresAt = Date.now() + tokenData.expires_in * 1000;
  const cookieSecure = { ...COOKIE_OPTS, secure: isSecure };

  const response = NextResponse.redirect(new URL("/", appUrl));

  response.cookies.set("spotify_access_token", tokenData.access_token, {
    ...cookieSecure,
    maxAge: tokenData.expires_in,
  });
  response.cookies.set("spotify_refresh_token", tokenData.refresh_token, {
    ...cookieSecure,
    maxAge: 30 * 24 * 60 * 60,
  });
  response.cookies.set("spotify_expires_at", String(expiresAt), {
    ...cookieSecure,
    maxAge: tokenData.expires_in,
  });
  response.cookies.delete("spotify_oauth_state");

  return response;
}
