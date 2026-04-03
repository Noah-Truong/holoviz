"use client";
import { useEffect, useRef, useState, useCallback, MutableRefObject } from "react";
import { AudioAnalyzer } from "@/lib/audioAnalyzer";
import { SpotifyTrack } from "@/lib/spotify";

export interface DeezerPreviewState {
  isLoading: boolean;
  isPlaying: boolean;
  matchTitle: string | null;
  matchArtist: string | null;
  error: string | null;
}

export function useDeezerPreview(
  deezerFreqRef: MutableRefObject<Uint8Array>,
  track: SpotifyTrack | null,
  enabled: boolean
) {
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const animFrameRef = useRef(0);
  const isActiveRef = useRef(false);
  const lastTrackIdRef = useRef<string | null>(null);

  const [state, setState] = useState<DeezerPreviewState>({
    isLoading: false,
    isPlaying: false,
    matchTitle: null,
    matchArtist: null,
    error: null,
  });

  // RAF loop — push real frequency data every frame
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      if (isActiveRef.current && analyzerRef.current) {
        const data = analyzerRef.current.getFrequencyData();
        // Copy into ref to avoid stale array reference
        if (deezerFreqRef.current.length !== data.length) {
          deezerFreqRef.current = new Uint8Array(data.length);
        }
        deezerFreqRef.current.set(data);
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [deezerFreqRef]);

  const loadTrack = useCallback(async (name: string, artist: string) => {
    setState({ isLoading: true, isPlaying: false, matchTitle: null, matchArtist: null, error: null });
    isActiveRef.current = false;

    try {
      const q = `track:"${name}" artist:"${artist}"`;
      const res = await fetch(`/api/deezer/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error("Search request failed");
      const data = await res.json();

      // Find first result with a preview URL
      const match = (data.data ?? []).find(
        (item: { preview?: string }) => item.preview
      );
      if (!match?.preview) throw new Error("No preview available for this track");

      if (!analyzerRef.current) {
        analyzerRef.current = new AudioAnalyzer();
      } else {
        analyzerRef.current.stop();
      }

      await analyzerRef.current.loadUrl(match.preview);
      analyzerRef.current.play();
      isActiveRef.current = true;

      setState({
        isLoading: false,
        isPlaying: true,
        matchTitle: match.title ?? name,
        matchArtist: match.artist?.name ?? artist,
        error: null,
      });
    } catch (e) {
      isActiveRef.current = false;
      setState({
        isLoading: false,
        isPlaying: false,
        matchTitle: null,
        matchArtist: null,
        error: e instanceof Error ? e.message : "Preview unavailable",
      });
    }
  }, []);

  // When enabled and a new Spotify track is detected, load its Deezer preview
  useEffect(() => {
    if (!enabled || !track) {
      if (!enabled) {
        analyzerRef.current?.stop();
        isActiveRef.current = false;
        setState(p => ({ ...p, isPlaying: false }));
      }
      return;
    }

    if (track.id === lastTrackIdRef.current) return;
    lastTrackIdRef.current = track.id;

    const artist = track.artists[0]?.name ?? "";
    loadTrack(track.name, artist);
  }, [track, enabled, loadTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      analyzerRef.current?.destroy();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return { state, isActiveRef };
}
