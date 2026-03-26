"use client";
import { useEffect, useRef, useState, useCallback, MutableRefObject } from "react";
import {
  AudioAnalysis,
  AudioBeat,
  AudioSegment,
  NowPlayingResponse,
  SpotifyTrack,
} from "@/lib/spotify";

export interface SpotifyState {
  isAuthenticated: boolean;
  isConnecting: boolean;
  isPlaying: boolean;
  track: SpotifyTrack | null;
  progressMs: number;
}

// Binary search for the current segment at `timeSec`
function findSegment(
  segments: AudioSegment[],
  timeSec: number
): AudioSegment | null {
  if (!segments.length) return null;
  let lo = 0;
  let hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    if (timeSec < seg.start) hi = mid - 1;
    else if (timeSec >= seg.start + seg.duration) lo = mid + 1;
    else return seg;
  }
  return segments[Math.min(lo, segments.length - 1)];
}

// Binary search for nearest beat and return confidence if we're "on the beat"
function getBeatBoost(beats: AudioBeat[], timeSec: number): number {
  if (!beats.length) return 1;
  let lo = 0;
  let hi = beats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid].start < timeSec) lo = mid + 1;
    else hi = mid;
  }
  const beat = beats[Math.max(0, lo - 1)];
  const distFromBeat = timeSec - beat.start;
  const window = beat.duration * 0.18;
  if (distFromBeat >= 0 && distFromBeat < window && beat.confidence > 0.3) {
    return 1 + beat.confidence * 0.7;
  }
  return 1;
}

/**
 * Converts a Spotify audio segment into a simulated 256-bin FFT Uint8Array.
 * - Bins 0-159:  12 chroma pitch classes interpolated across the range
 * - Bins 160-255: 12 timbre coefficients interpolated across the range
 * Both channels are scaled by loudness and a beat-based boost.
 */
function buildFFT(
  segment: AudioSegment,
  beatBoost: number,
  prevFFT: Uint8Array
): Uint8Array {
  // Loudness: Spotify loudness_max is typically -60..0 dB
  // Map to 0..1 where -60 dB = 0, 0 dB = 1
  const loudness = Math.max(0, Math.min(1, (segment.loudness_max + 60) / 60));
  const scale = Math.min(1, loudness * beatBoost);

  const fft = new Uint8Array(256);

  // Pitch classes → low/mid bins (0-159)
  for (let i = 0; i < 160; i++) {
    const t = (i / 160) * 12;
    const i0 = Math.floor(t) % 12;
    const i1 = (i0 + 1) % 12;
    const frac = t - Math.floor(t);
    const v = segment.pitches[i0] * (1 - frac) + segment.pitches[i1] * frac;
    // Natural frequency rolloff toward higher bins
    const env = 1 - (i / 160) * 0.35;
    const raw = Math.round(v * scale * env * 245);
    // Smooth slightly with previous frame to reduce jitter
    fft[i] = Math.round(raw * 0.7 + prevFFT[i] * 0.3);
  }

  // Timbre → high freq bins (160-255)
  // timbre[0] ≈ loudness (~-60..60), others ≈ spectral shape (~-100..100)
  for (let i = 160; i < 256; i++) {
    const t = ((i - 160) / 96) * 12;
    const i0 = Math.floor(t) % 12;
    const i1 = (i0 + 1) % 12;
    const frac = t - Math.floor(t);
    const v = segment.timbre[i0] * (1 - frac) + segment.timbre[i1] * frac;
    const norm =
      i0 === 0
        ? Math.max(0, Math.min(1, (v + 60) / 120))
        : Math.max(0, Math.min(1, (v + 100) / 200));
    const raw = Math.round(norm * scale * 210);
    fft[i] = Math.round(raw * 0.7 + prevFFT[i] * 0.3);
  }

  return fft;
}

export function useSpotify(spotifyFreqRef: MutableRefObject<Uint8Array>) {
  const [state, setState] = useState<SpotifyState>({
    isAuthenticated: false,
    isConnecting: true,
    isPlaying: false,
    track: null,
    progressMs: 0,
  });

  const isSpotifyActiveRef = useRef(false);
  const analysisRef = useRef<AudioAnalysis | null>(null);
  const currentTrackIdRef = useRef<string | null>(null);
  const lastProgressRef = useRef(0);
  const lastPollTimeRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef(0);

  const fetchAnalysis = useCallback(async (trackId: string) => {
    try {
      const res = await fetch(`/api/spotify/analysis/${trackId}`);
      if (!res.ok) return;
      const data: AudioAnalysis = await res.json();
      analysisRef.current = data;
      currentTrackIdRef.current = trackId;
    } catch {
      // network error — analysis unavailable, sphere uses idle animation
    }
  }, []);

  const pollNowPlaying = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/now-playing");
      if (res.status === 401) {
        setState((p) => ({ ...p, isAuthenticated: false }));
        isSpotifyActiveRef.current = false;
        return;
      }

      const data: NowPlayingResponse = await res.json();

      if (!data.is_playing || !data.item) {
        setState((p) => ({ ...p, isPlaying: false, track: null }));
        isSpotifyActiveRef.current = false;
        return;
      }

      isSpotifyActiveRef.current = true;
      lastProgressRef.current = data.progress_ms;
      lastPollTimeRef.current = Date.now();

      setState((p) => ({
        ...p,
        isPlaying: true,
        track: data.item,
        progressMs: data.progress_ms,
      }));

      if (data.item.id !== currentTrackIdRef.current) {
        analysisRef.current = null;
        await fetchAnalysis(data.item.id);
      }
    } catch {
      // network error — keep last state
    }
  }, [fetchAnalysis]);

  // rAF loop: update spotifyFreqRef every frame based on interpolated position
  useEffect(() => {
    let running = true;

    const loop = () => {
      if (!running) return;

      if (isSpotifyActiveRef.current && analysisRef.current) {
        const elapsed = Date.now() - lastPollTimeRef.current;
        const posSec = (lastProgressRef.current + elapsed) / 1000;

        const segment = findSegment(analysisRef.current.segments, posSec);
        if (segment) {
          const boost = getBeatBoost(analysisRef.current.beats, posSec);
          spotifyFreqRef.current = buildFFT(
            segment,
            boost,
            spotifyFreqRef.current
          );
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [spotifyFreqRef]);

  // Initial auth check + polling
  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch("/api/spotify/now-playing");
        if (res.status === 401) {
          setState((p) => ({ ...p, isAuthenticated: false, isConnecting: false }));
          return;
        }
        setState((p) => ({ ...p, isAuthenticated: true, isConnecting: false }));
        await pollNowPlaying();
        pollTimerRef.current = setInterval(pollNowPlaying, 3000);
      } catch {
        setState((p) => ({ ...p, isConnecting: false }));
      }
    };

    init();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [pollNowPlaying]);

  const connect = useCallback(() => {
    window.location.href = "/api/auth/login";
  }, []);

  const disconnect = useCallback(() => {
    window.location.href = "/api/auth/logout";
  }, []);

  return { state, isSpotifyActiveRef, connect, disconnect };
}
