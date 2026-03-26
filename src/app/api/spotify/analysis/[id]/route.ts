import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, SPOTIFY_API_BASE } from "@/lib/spotify";

interface RawSegment {
  start: number;
  duration: number;
  loudness_start: number;
  loudness_max: number;
  loudness_max_time: number;
  pitches: number[];
  timbre: number[];
}

interface RawBeat {
  start: number;
  duration: number;
  confidence: number;
}

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

  const spotifyRes = await fetch(`${SPOTIFY_API_BASE}/audio-analysis/${id}`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!spotifyRes.ok) {
    return NextResponse.json(
      { error: "analysis_unavailable" },
      { status: spotifyRes.status }
    );
  }

  const data = await spotifyRes.json();

  // Return only the fields we need to keep the payload small
  return NextResponse.json(
    {
      beats: (data.beats as RawBeat[]).map((b) => ({
        start: b.start,
        duration: b.duration,
        confidence: b.confidence,
      })),
      segments: (data.segments as RawSegment[]).map((s) => ({
        start: s.start,
        duration: s.duration,
        loudness_max: s.loudness_max,
        pitches: s.pitches,
        timbre: s.timbre,
      })),
    },
    {
      headers: { "Cache-Control": "public, max-age=3600" },
    }
  );
}
