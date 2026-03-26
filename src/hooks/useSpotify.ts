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
  usingAnalysis: boolean;
}

// ── Audio analysis helpers ──────────────────────────────────────────────────

function findSegment(segments: AudioSegment[], timeSec: number): AudioSegment | null {
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
  const dist = timeSec - beat.start;
  if (dist >= 0 && dist < beat.duration * 0.18 && beat.confidence > 0.3) {
    return 1 + beat.confidence * 0.7;
  }
  return 1;
}

/**
 * Builds a 256-bin FFT from Spotify's audio segment data.
 * Bins 0-159  → 12 chroma pitch classes
 * Bins 160-255 → 12 timbre coefficients
 */
function buildFFTFromAnalysis(
  segment: AudioSegment,
  beatBoost: number,
  prevFFT: Uint8Array
): Uint8Array {
  const loudness = Math.max(0, Math.min(1, (segment.loudness_max + 60) / 60));
  const scale = Math.min(1, loudness * beatBoost);
  const fft = new Uint8Array(256);

  for (let i = 0; i < 160; i++) {
    const t = (i / 160) * 12;
    const i0 = Math.floor(t) % 12;
    const i1 = (i0 + 1) % 12;
    const frac = t - Math.floor(t);
    const v = segment.pitches[i0] * (1 - frac) + segment.pitches[i1] * frac;
    const env = 1 - (i / 160) * 0.35;
    fft[i] = Math.round((v * scale * env * 245) * 0.7 + prevFFT[i] * 0.3);
  }

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
    fft[i] = Math.round((norm * scale * 210) * 0.7 + prevFFT[i] * 0.3);
  }

  return fft;
}

/**
 * Synthetic fallback FFT — used when Spotify's audio analysis API is
 * unavailable (it was deprecated in late 2024).
 *
 * Generates a perceptually realistic frequency spectrum using overlapping
 * band oscillators and a simulated ~120 BPM kick/snare pattern that
 * makes the sphere look music-reactive without real audio data.
 */
function buildSyntheticFFT(
  progressMs: number,
  elapsedMs: number,
  prevFFT: Uint8Array
): Uint8Array {
  const fft = new Uint8Array(256);
  const t = (progressMs + elapsedMs) / 1000; // wall-clock seconds into track

  // ── Beat pattern: kick on every beat, snare/hat on off-beats (~120 BPM) ──
  const bps = 2; // beats-per-second = 120 BPM
  const beatPhase = (t * bps) % 1;
  // Sharp attack + exponential decay — like an acoustic kick
  const kick = Math.exp(-beatPhase * 9) * (1 - Math.exp(-beatPhase * 80));

  const hatPhase = (t * bps * 2) % 1;
  const hat = Math.exp(-hatPhase * 14) * 0.45;

  // ── Frequency band envelopes ──────────────────────────────────────────────
  for (let i = 0; i < 256; i++) {
    const n = i / 255; // 0..1

    // Sub-bass & kick (0-50): beat-locked pulse
    const bass = kick * Math.pow(Math.max(0, 1 - n * 5), 2) * 0.95;

    // Low-mid / warmth (30-120): slow melodic oscillation
    const lmEnv = Math.exp(-Math.pow((n - 0.22) / 0.14, 2)) * 0.55;
    const lm = (0.5 + 0.5 * Math.sin(t * 5.1 + i * 0.19)) * lmEnv;

    // Mid / presence (80-170): harmonic shimmer
    const mEnv = Math.exp(-Math.pow((n - 0.46) / 0.18, 2)) * 0.42;
    const m = (0.5 + 0.5 * Math.sin(t * 9.7 + i * 0.27 + 1.3)) * mEnv;

    // Upper-mid / transients (150-220): hat-locked + sustain
    const hmEnv = Math.exp(-Math.pow((n - 0.69) / 0.11, 2)) * 0.32;
    const hm = hat * hmEnv + (0.3 + 0.3 * Math.sin(t * 14 + i * 0.41)) * hmEnv * 0.55;

    // Air / highs (205-255): subtle shimmer
    const airEnv = Math.pow(Math.max(0, n - 0.78) / 0.22, 0.6) * 0.18;
    const air = Math.abs(Math.sin(t * 21 + i * 1.1)) * airEnv;

    const total = Math.min(1, bass + lm + m + hm + air);
    // Smooth with previous frame so motion feels organic, not jittery
    fft[i] = Math.round(Math.round(total * 228) * 0.55 + prevFFT[i] * 0.45);
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
      if (!res.ok) {
        // Audio analysis API was deprecated by Spotify in late 2024.
        // We fall back to the synthetic FFT generator automatically.
        console.warn(
          `[HoloViz] Spotify audio analysis unavailable (${res.status}) — using synthetic FFT.`
        );
        setState((p) => ({ ...p, usingAnalysis: false }));
        return;
      }
      const data: AudioAnalysis = await res.json();
      analysisRef.current = data;
      currentTrackIdRef.current = trackId;
      setState((p) => ({ ...p, usingAnalysis: true }));
    } catch {
      setState((p) => ({ ...p, usingAnalysis: false }));
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
        currentTrackIdRef.current = data.item.id;
        setState((p) => ({ ...p, usingAnalysis: false }));
        fetchAnalysis(data.item.id); // fire-and-forget — sphere uses synthetic in the meantime
      }
    } catch {
      // keep last known state on transient network errors
    }
  }, [fetchAnalysis]);

  // ── rAF loop: push frequency data every frame ──────────────────────────
  // Runs independently of polling — always active so the sphere is never
  // stuck waiting for a poll. Uses real analysis when available, synthetic
  // (beat-simulated) FFT otherwise.
  useEffect(() => {
    let running = true;

    const loop = () => {
      if (!running) return;

      if (isSpotifyActiveRef.current) {
        const elapsed = Date.now() - lastPollTimeRef.current;
        const posSec = (lastProgressRef.current + elapsed) / 1000;

        if (analysisRef.current) {
          // Real per-segment audio data from Spotify
          const segment = findSegment(analysisRef.current.segments, posSec);
          if (segment) {
            const boost = getBeatBoost(analysisRef.current.beats, posSec);
            spotifyFreqRef.current = buildFFTFromAnalysis(
              segment,
              boost,
              spotifyFreqRef.current
            );
          }
        } else {
          // Synthetic fallback: realistic spectrum + beat simulation
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

  // ── Initial auth probe + polling interval ──────────────────────────────
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

  const skipTrack = useCallback(
    async (direction: "next" | "previous") => {
      try {
        await fetch(`/api/spotify/skip/${direction}`, { method: "POST" });
        await new Promise((r) => setTimeout(r, 750));
        analysisRef.current = null;
        currentTrackIdRef.current = null;
        setState((p) => ({ ...p, usingAnalysis: false }));
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
    window.location.href = "/api/auth/logout";
  }, []);

  return { state, isSpotifyActiveRef, connect, disconnect, nextTrack, previousTrack };
}
