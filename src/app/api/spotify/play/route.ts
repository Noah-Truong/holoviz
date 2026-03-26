import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, SPOTIFY_API_BASE } from "@/lib/spotify";

export async function POST(req: NextRequest) {
  const { context_uri } = await req.json();

  if (!context_uri) {
    return NextResponse.json({ error: "missing_context_uri" }, { status: 400 });
  }

  const accessToken = req.cookies.get("spotify_access_token")?.value;
  const refreshToken = req.cookies.get("spotify_refresh_token")?.value;
  const expiresAt = parseInt(req.cookies.get("spotify_expires_at")?.value ?? "0");

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { tokens } = await getValidAccessToken(accessToken, refreshToken, expiresAt);

  const spotifyRes = await fetch(`${SPOTIFY_API_BASE}/me/player/play`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ context_uri }),
  });

  if (spotifyRes.status === 403) {
    return NextResponse.json({ error: "premium_required" }, { status: 403 });
  }
  if (spotifyRes.status === 404) {
    return NextResponse.json({ error: "no_active_device" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
