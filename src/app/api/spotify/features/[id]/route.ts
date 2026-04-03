import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, SPOTIFY_API_BASE } from "@/lib/spotify";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const accessToken = req.cookies.get("spotify_access_token")?.value;
  const refreshToken = req.cookies.get("spotify_refresh_token")?.value;
  const expiresAt = parseInt(req.cookies.get("spotify_expires_at")?.value ?? "0");

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { tokens } = await getValidAccessToken(accessToken, refreshToken, expiresAt);

  const spotifyRes = await fetch(`${SPOTIFY_API_BASE}/audio-features/${id}`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!spotifyRes.ok) {
    return NextResponse.json(
      { error: "features_unavailable" },
      { status: spotifyRes.status }
    );
  }

  const data = await spotifyRes.json();
  return NextResponse.json(
    {
      energy: data.energy,
      danceability: data.danceability,
      valence: data.valence,
      tempo: data.tempo,
      loudness: data.loudness,
      acousticness: data.acousticness,
      key: data.key,
      mode: data.mode,
    },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  );
}
