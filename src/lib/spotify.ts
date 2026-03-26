export const SPOTIFY_SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
].join(" ");

export const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface SpotifyArtist {
  name: string;
}

export interface SpotifyImage {
  url: string;
  width: number;
  height: number;
}

export interface SpotifyTrack {
  id: string;
  type: "track" | "episode";
  name: string;
  artists: SpotifyArtist[];
  album: {
    name: string;
    images: SpotifyImage[];
  };
  duration_ms: number;
}

export interface NowPlayingResponse {
  is_playing: boolean;
  progress_ms: number;
  item: SpotifyTrack | null;
}

export interface AudioSegment {
  start: number;
  duration: number;
  loudness_start: number;
  loudness_max: number;
  loudness_max_time: number;
  pitches: number[];
  timbre: number[];
}

export interface AudioBeat {
  start: number;
  duration: number;
  confidence: number;
}

export interface AudioAnalysis {
  beats: AudioBeat[];
  segments: AudioSegment[];
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<SpotifyTokens> {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function getValidAccessToken(
  accessToken: string,
  refreshToken: string,
  expiresAt: number
): Promise<{ tokens: SpotifyTokens; refreshed: boolean }> {
  if (Date.now() < expiresAt - 60_000) {
    return {
      tokens: { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt },
      refreshed: false,
    };
  }
  const tokens = await refreshAccessToken(refreshToken);
  return { tokens, refreshed: true };
}
