import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, SPOTIFY_API_BASE, SpotifyPlaylist } from "@/lib/spotify";

interface RawPlaylist {
  id: string;
  name: string;
  description: string;
  uri: string;
  images: Array<{ url: string; width: number; height: number }>;
  tracks: { total: number };
  owner: { display_name: string };
}

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get("spotify_access_token")?.value;
  const refreshToken = req.cookies.get("spotify_refresh_token")?.value;
  const expiresAt = parseInt(req.cookies.get("spotify_expires_at")?.value ?? "0");

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { tokens } = await getValidAccessToken(accessToken, refreshToken, expiresAt);

  // Fetch up to 50 playlists (Spotify's max per request)
  const spotifyRes = await fetch(
    `${SPOTIFY_API_BASE}/me/playlists?limit=50`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );

  if (spotifyRes.status === 403) {
    return NextResponse.json({ error: "missing_scope" }, { status: 403 });
  }

  if (!spotifyRes.ok) {
    return NextResponse.json({ error: "spotify_error" }, { status: spotifyRes.status });
  }

  const data = await spotifyRes.json();

  const playlists: SpotifyPlaylist[] = (data.items as RawPlaylist[])
    .filter(Boolean)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      uri: p.uri,
      images: p.images ?? [],
      tracks: { total: p.tracks?.total ?? 0 },
      owner: { display_name: p.owner?.display_name ?? "" },
    }));

  return NextResponse.json({ playlists });
}
