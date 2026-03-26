"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { AudioAnalyzer } from "@/lib/audioAnalyzer";

export interface AudioState {
  isPlaying: boolean;
  isLoaded: boolean;
  fileName: string;
  duration: number;
  currentTime: number;
  volume: number;
}

export function useAudioAnalyzer() {
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const animFrameRef = useRef<number>(0);
  const tickRef = useRef<() => void>(() => {});
  const frequencyDataRef = useRef<Uint8Array>(new Uint8Array(256));

  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    isLoaded: false,
    fileName: "",
    duration: 0,
    currentTime: 0,
    volume: 1,
  });

  useEffect(() => {
    analyzerRef.current = new AudioAnalyzer();
    tickRef.current = () => {
      if (!analyzerRef.current) return;
      frequencyDataRef.current = analyzerRef.current.getFrequencyData();
      setAudioState((prev) => ({
        ...prev,
        isPlaying: analyzerRef.current!.getIsPlaying(),
        currentTime: analyzerRef.current!.getCurrentTime(),
      }));
      animFrameRef.current = requestAnimationFrame(tickRef.current);
    };
    return () => {
      analyzerRef.current?.destroy();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const loadFile = useCallback(async (file: File) => {
    const az = analyzerRef.current;
    if (!az) return;
    await az.loadFile(file);
    setAudioState((prev) => ({
      ...prev,
      isLoaded: true,
      fileName: file.name,
      duration: az.duration,
      currentTime: 0,
      isPlaying: false,
    }));
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(tickRef.current);
  }, []);

  const play = useCallback(() => {
    analyzerRef.current?.play();
    setAudioState((prev) => ({ ...prev, isPlaying: true }));
  }, []);

  const pause = useCallback(() => {
    analyzerRef.current?.pause();
    setAudioState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const setVolume = useCallback((v: number) => {
    analyzerRef.current?.setVolume(v);
    setAudioState((prev) => ({ ...prev, volume: v }));
  }, []);

  return {
    audioState,
    frequencyDataRef,
    loadFile,
    play,
    pause,
    setVolume,
  };
}
