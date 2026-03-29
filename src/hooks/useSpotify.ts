"use client";
import { useEffect, useRef, useState, useCallback, MutableRefObject } from "react";
import { AudioAnalysis, NowPlayingResponse, SpotifyTrack } from "@/lib/spotify";

export interface SpotifyState {
  isAuthenticated: boolean;
  isConnecting: boolean;
  isPlaying: boolean;
  track: SpotifyTrack | null;
  progressMs: number;
  usingAnalysis: boolean;
  contextUri: string | null;
}

// ── Synthetic FFT fallback ──────────────────────────────────────────────────
// Used while audio analysis is loading or unavailable.

function buildSyntheticFFT(
  progressMs: number,
  elapsedMs: number,
  prevFFT: Uint8Array
): Uint8Array {
  const fft = new Uint8Array(256);
  const t = (progressMs + elapsedMs) / 1000;

  const beatPhase = (t * 2) % 1;
  const kick = Math.exp(-beatPhase * 9) * (1 - Math.exp(-beatPhase * 80));
  const hatPhase = (t * 4) % 1;
  const hat = Math.exp(-hatPhase * 14) * 0.45;

  for (let i = 0; i < 256; i++) {
    const n = i / 255;
    const bass = kick * Math.pow(Math.max(0, 1 - n * 5), 2) * 0.95;
    const lmEnv = Math.exp(-Math.pow((n - 0.22) / 0.14, 2)) * 0.55;
    const lm = (0.5 + 0.5 * Math.sin(t * 5.1 + i * 0.19)) * lmEnv;
    const mEnv = Math.exp(-Math.pow((n - 0.46) / 0.18, 2)) * 0.42;
    const m = (0.5 + 0.5 * Math.sin(t * 9.7 + i * 0.27 + 1.3)) * mEnv;
    const hmEnv = Math.exp(-Math.pow((n - 0.69) / 0.11, 2)) * 0.32;
    const hm = hat * hmEnv + (0.3 + 0.3 * Math.sin(t * 14 + i * 0.41)) * hmEnv * 0.55;
    const airEnv = Math.pow(Math.max(0, n - 0.78) / 0.22, 0.6) * 0.18;
    const air = Math.abs(Math.sin(t * 21 + i * 1.1)) * airEnv;
    const total = Math.min(1, bass + lm + m + hm + air);
    fft[i] = Math.round(Math.round(total * 228) * 0.55 + prevFFT[i] * 0.45);
  }
  return fft;
}

// ── Analysis-driven FFT ────────────────────────────────────────────────────
// Maps Spotify audio analysis data (beats, segments with chroma pitches,
// timbre, and loudness) to a 256-bin frequency array synchronized with the
// live playback position. This drives the visualizer with real musical data
// for the actual track playing — not a preview clip.

function buildAnalysisFFT(
  progressMs: number,
  elapsedMs: number,
  analysis: AudioAnalysis,
  prevFFT: Uint8Array
): Uint8Array {
  const fft = new Uint8Array(256);
  const posSec = (progressMs + elapsedMs) / 1000;

  const segs = analysis.segments;
  if (!segs.length) return buildSyntheticFFT(progressMs, elapsedMs, prevFFT);

  // Binary search for current segment
  let lo = 0;
  let hi = segs.length - 1;
  let segIdx = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segs[mid].start <= posSec) {
      segIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const seg = segs[segIdx];
  const nextSeg = segs[segIdx + 1] ?? seg;

  // Interpolation factor within segment (0–1)
  const t = Math.min(1, Math.max(0, (posSec - seg.start) / Math.max(0.001, seg.duration)));

  // Interpolated chroma pitches (12 values, 0–1 each)
  const pitches = seg.pitches.map((p, i) => p + (nextSeg.pitches[i] - p) * t);

  // Loudness: normalize dB to 0–1 (typical range -35 to 0 dB)
  const loudnessDb = seg.loudness_max + (nextSeg.loudness_max - seg.loudness_max) * t;
  const loudness = Math.min(1, Math.max(0, (loudnessDb + 35) / 35));

  // Beat impulse: binary search for the most recent beat within 150 ms
  let beatAmp = 0;
  {
    const beats = analysis.beats;
    let blo = 0;
    let bhi = beats.length - 1;
    let bStart = beats.length;
    while (blo <= bhi) {
      const mid = (blo + bhi) >> 1;
      if (beats[mid].start < posSec - 0.15) {
        blo = mid + 1;
      } else {
        bStart = mid;
        bhi = mid - 1;
      }
    }
    for (let i = bStart; i < beats.length && beats[i].start <= posSec; i++) {
      const dist = posSec - beats[i].start;
      const impulse = beats[i].confidence * Math.exp(-dist * 25);
      if (impulse > beatAmp) beatAmp = impulse;
    }
  }

  for (let i = 0; i < 256; i++) {
    let val = 0;

    if (i < 8) {
      // Sub-bass: beat-driven kick with loudness floor
      val = (beatAmp * 0.95 + loudness * 0.3) * Math.pow(1 - i / 8, 1.5);
    } else if (i < 40) {
      // Bass: chroma C–D# (pitches 0–3), boosted on beats
      const pn = (i - 8) / 32;
      const rawIdx = pn * 4;
      const pIdx = Math.floor(rawIdx);
      const pFrac = rawIdx - pIdx;
      const p = pitches[pIdx] * (1 - pFrac) + (pitches[Math.min(11, pIdx + 1)]) * pFrac;
      val = p * loudness * 0.9 + beatAmp * Math.pow(1 - pn, 2) * 0.45;
    } else if (i < 96) {
      // Low-mid: chroma E–A (pitches 4–9)
      const pn = (i - 40) / 56;
      const rawIdx = pn * 6;
      const pIdx = 4 + Math.floor(rawIdx);
      const pFrac = rawIdx - Math.floor(rawIdx);
      const p =
        pitches[Math.min(11, pIdx)] * (1 - pFrac) +
        pitches[Math.min(11, pIdx + 1)] * pFrac;
      val = p * loudness * 0.8;
    } else if (i < 160) {
      // Mid: chroma A#–B (pitches 10–11) + harmonic reinforcement
      const pn = (i - 96) / 64;
      const p = pitches[10 + Math.floor(pn * 2 > 1 ? 1 : pn * 2)];
      const harmonic = (pitches[(Math.floor(pn * 12)) % 12] + pitches[(Math.floor(pn * 12) + 7) % 12]) * 0.25;
      val = (p + harmonic) * loudness * 0.65;
    } else if (i < 220) {
      // High-mid: harmonic presence shaped by loudness
      const pn = (i - 160) / 60;
      const harmonic = pitches[(Math.floor(pn * 6) + 5) % 12] * 0.5;
      val = (loudness * 0.35 + harmonic * loudness * 0.3) * (1 - pn * 0.55);
    } else {
      // Highs: air roll-off
      const pn = (i - 220) / 36;
      val = loudness * 0.18 * Math.pow(1 - pn, 2);
    }

    // Asymmetric smoothing: fast attack, slow release
    const raw = Math.min(1, Math.max(0, val));
    const prev = prevFFT[i] / 255;
    const smoothed = raw > prev ? raw * 0.65 + prev * 0.35 : raw * 0.2 + prev * 0.8;
    fft[i] = Math.round(smoothed * 230);
  }

  return fft;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useSpotify(spotifyFreqRef: MutableRefObject<Uint8Array>) {
  const [state, setState] = useState<SpotifyState>({
    isAuthenticated: false,
    isConnecting: true,
    isPlaying: false,
    track: null,
    progressMs: 0,
    usingAnalysis: false,
    contextUri: null,
  });

  // Playback tracking
  const isSpotifyActiveRef = useRef(false);
  const lastProgressRef = useRef(0);
  const lastPollTimeRef = useRef(0);
  const currentTrackIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef(0);

  // Audio analysis
  const analysisRef = useRef<AudioAnalysis | null>(null);
  const loadingAnalysisRef = useRef(false);

  // ── Analysis fetch ────────────────────────────────────────────────────────

  const fetchAnalysis = useCallback(async (trackId: string) => {
    if (loadingAnalysisRef.current) return;
    loadingAnalysisRef.current = true;
    analysisRef.current = null;
    setState((p) => ({ ...p, usingAnalysis: false }));
    try {
      const res = await fetch(`/api/spotify/analysis/${trackId}`);
      if (res.ok) {
        analysisRef.current = await res.json();
        setState((p) => ({ ...p, usingAnalysis: true }));
      }
    } catch {
      // keep synthetic fallback
    } finally {
      loadingAnalysisRef.current = false;
    }
  }, []);

  // ── rAF loop: push frequency data every frame ────────────────────────────
  useEffect(() => {
    let running = true;

    const loop = () => {
      if (!running) return;

      if (isSpotifyActiveRef.current) {
        const elapsed = Date.now() - lastPollTimeRef.current;

        if (analysisRef.current) {
          spotifyFreqRef.current = buildAnalysisFFT(
            lastProgressRef.current,
            elapsed,
            analysisRef.current,
            spotifyFreqRef.current
          );
        } else {
          spotifyFreqRef.current = buildSyntheticFFT(
            lastProgressRef.current,
            elapsed,
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

  // ── Polling ───────────────────────────────────────────────────────────────

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
        setState((p) => ({ ...p, isPlaying: false, track: null, usingAnalysis: false }));
        isSpotifyActiveRef.current = false;
        analysisRef.current = null;
        currentTrackIdRef.current = null;
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
        contextUri: data.context_uri,
      }));

      // New track detected — fetch its audio analysis
      if (data.item.id !== currentTrackIdRef.current) {
        currentTrackIdRef.current = data.item.id;
        fetchAnalysis(data.item.id);
      }
    } catch {
      // keep last known state on transient network errors
    }
  }, [fetchAnalysis]);

  // ── Initial auth + polling interval ──────────────────────────────────────
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
        pollTimerRef.current = setInterval(pollNowPlaying, 4000);
      } catch {
        setState((p) => ({ ...p, isConnecting: false }));
      }
    };

    init();

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [pollNowPlaying]);

  // ── Track navigation ──────────────────────────────────────────────────────

  const skipTrack = useCallback(
    async (direction: "next" | "previous") => {
      try {
        await fetch(`/api/spotify/skip/${direction}`, { method: "POST" });
        analysisRef.current = null;
        currentTrackIdRef.current = null;
        setState((p) => ({ ...p, usingAnalysis: false }));
        await new Promise((r) => setTimeout(r, 800));
        await pollNowPlaying();
      } catch {
        // ignore
      }
    },
    [pollNowPlaying]
  );

  const nextTrack = useCallback(() => skipTrack("next"), [skipTrack]);
  const previousTrack = useCallback(() => skipTrack("previous"), [skipTrack]);

  const connect = useCallback(() => {
    window.location.href = "/api/auth/login";
  }, []);

  const disconnect = useCallback(() => {
    analysisRef.current = null;
    window.location.href = "/api/auth/logout";
  }, []);

  const refreshNow = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 900));
    await pollNowPlaying();
  }, [pollNowPlaying]);

  return { state, isSpotifyActiveRef, connect, disconnect, nextTrack, previousTrack, refreshNow };
}
