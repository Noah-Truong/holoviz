import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, SPOTIFY_API_BASE } from "@/lib/spotify";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ direction: string }> }
) {
  const { direction } = await context.params;

  if (direction !== "next" && direction !== "previous") {
    return NextResponse.json({ error: "invalid_direction" }, { status: 400 });
  }

  const accessToken = req.cookies.get("spotify_access_token")?.value;
  const refreshToken = req.cookies.get("spotify_refresh_token")?.value;
  const expiresAt = parseInt(req.cookies.get("spotify_expires_at")?.value ?? "0");

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { tokens } = await getValidAccessToken(accessToken, refreshToken, expiresAt);

  const spotifyRes = await fetch(
    `${SPOTIFY_API_BASE}/me/player/${direction}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );

  // 204 = success with no body, 403 = no premium, 404 = no active device
  if (spotifyRes.status === 403) {
    return NextResponse.json(
      { error: "premium_required" },
      { status: 403 }
    );
  }
  if (spotifyRes.status === 404) {
    return NextResponse.json(
      { error: "no_active_device" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
