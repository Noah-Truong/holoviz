"use client";
import { useEffect, useRef, useState, useCallback, MutableRefObject } from "react";
import { NowPlayingResponse, SpotifyTrack } from "@/lib/spotify";

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
// Used when a track has no preview_url (rare, some markets/tracks).
// Generates a perceptually realistic frequency spectrum from elapsed time so
// the sphere always has some reaction when Spotify is active.

function buildSyntheticFFT(
  progressMs: number,
  elapsedMs: number,
  prevFFT: Uint8Array
): Uint8Array {
  const fft = new Uint8Array(256);
  const t = (progressMs + elapsedMs) / 1000;

  const beatPhase = (t * 2) % 1; // ~120 BPM
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

  // Preview audio chain
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fftArrayRef = useRef<any>(new Uint8Array(256));
  const usingRealAudioRef = useRef(false);

  // ── Preview audio helpers ─────────────────────────────────────────────────

  const stopPreview = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = "";
      audioElRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    usingRealAudioRef.current = false;
  }, []);

  const startPreview = useCallback(
    async (previewUrl: string) => {
      stopPreview();
      try {
        const audioEl = new Audio();
        // crossOrigin = anonymous is required for Web Audio API to read the
        // decoded samples. Spotify's preview CDN supports this header.
        audioEl.crossOrigin = "anonymous";
        audioEl.loop = true;
        audioEl.src = previewUrl;

        const ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.82;

        const source = ctx.createMediaElementSource(audioEl);

        // Route: audio element → analyser → (silent gain) → destination
        // The analyser node has access to all frequency data even though
        // the user won't hear the preview (gain = 0 at the output).
        const silentGain = ctx.createGain();
        silentGain.gain.value = 0;
        source.connect(analyser);
        analyser.connect(silentGain);
        silentGain.connect(ctx.destination);

        fftArrayRef.current = new Uint8Array(analyser.frequencyBinCount) as unknown as Uint8Array;

        // Resume AudioContext if suspended (autoplay policy)
        const play = async () => {
          if (ctx.state === "suspended") await ctx.resume();
          await audioEl.play();
        };
        await play();

        audioElRef.current = audioEl;
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
        usingRealAudioRef.current = true;
        setState((p) => ({ ...p, usingAnalysis: true }));
      } catch (err) {
        console.warn("[HoloViz] Preview audio setup failed:", err);
        usingRealAudioRef.current = false;
        setState((p) => ({ ...p, usingAnalysis: false }));
      }
    },
    [stopPreview]
  );

  // ── rAF loop: push frequency data every frame ────────────────────────────
  useEffect(() => {
    let running = true;

    const loop = () => {
      if (!running) return;

      if (isSpotifyActiveRef.current) {
        if (usingRealAudioRef.current && analyserRef.current) {
          // Real FFT from the track's preview audio
          analyserRef.current.getByteFrequencyData(fftArrayRef.current);
          spotifyFreqRef.current = fftArrayRef.current;
        } else {
          // Synthetic fallback for tracks without a preview URL
          const elapsed = Date.now() - lastPollTimeRef.current;
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
        stopPreview();
        return;
      }

      const data: NowPlayingResponse = await res.json();

      if (!data.is_playing || !data.item) {
        setState((p) => ({ ...p, isPlaying: false, track: null, usingAnalysis: false }));
        isSpotifyActiveRef.current = false;
        stopPreview();
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

      // New track detected — (re)start preview audio
      if (data.item.id !== currentTrackIdRef.current) {
        currentTrackIdRef.current = data.item.id;
        if (data.item.preview_url) {
          // fire-and-forget; synthetic FFT covers the brief load gap
          startPreview(data.item.preview_url);
        } else {
          stopPreview();
          setState((p) => ({ ...p, usingAnalysis: false }));
        }
      }
    } catch {
      // keep last known state on transient network errors
    }
  }, [startPreview, stopPreview]);

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
      stopPreview();
    };
  }, [pollNowPlaying, stopPreview]);

  // ── Track navigation ──────────────────────────────────────────────────────

  const skipTrack = useCallback(
    async (direction: "next" | "previous") => {
      try {
        await fetch(`/api/spotify/skip/${direction}`, { method: "POST" });
        stopPreview();
        currentTrackIdRef.current = null;
        setState((p) => ({ ...p, usingAnalysis: false }));
        await new Promise((r) => setTimeout(r, 800));
        await pollNowPlaying();
      } catch {
        // ignore
      }
    },
    [pollNowPlaying, stopPreview]
  );

  const nextTrack = useCallback(() => skipTrack("next"), [skipTrack]);
  const previousTrack = useCallback(() => skipTrack("previous"), [skipTrack]);

  const connect = useCallback(() => {
    window.location.href = "/api/auth/login";
  }, []);

  const disconnect = useCallback(() => {
    stopPreview();
    window.location.href = "/api/auth/logout";
  }, [stopPreview]);

  const refreshNow = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 900));
    await pollNowPlaying();
  }, [pollNowPlaying]);

  return { state, isSpotifyActiveRef, connect, disconnect, nextTrack, previousTrack, refreshNow };
}
