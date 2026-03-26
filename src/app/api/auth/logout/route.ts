import { NextRequest, NextResponse } from "next/server";

export function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const response = NextResponse.redirect(new URL("/", appUrl));
  response.cookies.delete("spotify_access_token");
  response.cookies.delete("spotify_refresh_token");
  response.cookies.delete("spotify_expires_at");
  return response;
}
