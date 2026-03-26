import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, SPOTIFY_API_BASE } from "@/lib/spotify";

function setCookiesIfRefreshed(
  response: NextResponse,
  refreshed: boolean,
  tokens: { access_token: string; refresh_token: string; expires_at: number },
  prevRefreshToken: string,
  isSecure: boolean
) {
  if (!refreshed) return;
  const opts = { httpOnly: true, secure: isSecure, sameSite: "lax" as const, path: "/" };
  const ttl = Math.round((tokens.expires_at - Date.now()) / 1000);
  response.cookies.set("spotify_access_token", tokens.access_token, { ...opts, maxAge: ttl });
  response.cookies.set("spotify_expires_at", String(tokens.expires_at), { ...opts, maxAge: ttl });
  if (tokens.refresh_token !== prevRefreshToken) {
    response.cookies.set("spotify_refresh_token", tokens.refresh_token, {
      ...opts,
      maxAge: 30 * 24 * 60 * 60,
    });
  }
}

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get("spotify_access_token")?.value;
  const refreshToken = req.cookies.get("spotify_refresh_token")?.value;
  const expiresAt = parseInt(req.cookies.get("spotify_expires_at")?.value ?? "0");
  const isSecure = process.env.NODE_ENV === "production";

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { tokens, refreshed } = await getValidAccessToken(
    accessToken,
    refreshToken,
    expiresAt
  );

  const spotifyRes = await fetch(
    `${SPOTIFY_API_BASE}/me/player/currently-playing`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );

  // 204 = nothing playing
  if (spotifyRes.status === 204) {
    const res = NextResponse.json({ is_playing: false });
    setCookiesIfRefreshed(res, refreshed, tokens, refreshToken, isSecure);
    return res;
  }

  if (!spotifyRes.ok) {
    return NextResponse.json({ error: "spotify_error" }, { status: spotifyRes.status });
  }

  const data = await spotifyRes.json();

  // Only surface track items (not podcast episodes)
  if (data?.item?.type !== "track") {
    const res = NextResponse.json({ is_playing: false });
    setCookiesIfRefreshed(res, refreshed, tokens, refreshToken, isSecure);
    return res;
  }

  const res = NextResponse.json({
    is_playing: data.is_playing,
    progress_ms: data.progress_ms,
    context_uri: data.context?.uri ?? null,
    item: {
      id: data.item.id,
      type: data.item.type,
      name: data.item.name,
      artists: data.item.artists,
      album: data.item.album,
      duration_ms: data.item.duration_ms,
      preview_url: data.item.preview_url ?? null,
    },
  });

  setCookiesIfRefreshed(res, refreshed, tokens, refreshToken, isSecure);
  return res;
}
