"use client";
import { useEffect, useRef, useState, useCallback, MutableRefObject } from "react";

export type SystemAudioMode = "display" | "microphone";

export interface SystemAudioState {
  isCapturing: boolean;
  mode: SystemAudioMode | null;
  error: string | null;
}

export function useSystemAudio(systemFreqRef: MutableRefObject<Uint8Array>) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef(0);
  const isActiveRef = useRef(false);

  const [state, setState] = useState<SystemAudioState>({
    isCapturing: false,
    mode: null,
    error: null,
  });

  // RAF loop — push real frequency data every frame
  useEffect(() => {
    let running = true;
    const dataArray = new Uint8Array(256);
    const loop = () => {
      if (!running) return;
      if (isActiveRef.current && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        systemFreqRef.current.set(dataArray);
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [systemFreqRef]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    isActiveRef.current = false;
    setState({ isCapturing: false, mode: null, error: null });
  }, []);

  const startWithStream = useCallback(
    (stream: MediaStream, mode: SystemAudioMode) => {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        setState((p) => ({
          ...p,
          error: 'No audio track found. Enable "Share audio" when prompted.',
        }));
        return;
      }

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      // Intentionally NOT connecting to destination — analyze only, no echo

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream;
      isActiveRef.current = true;

      // Auto-stop when the user ends the share
      audioTracks[0].addEventListener("ended", stop, { once: true });

      setState({ isCapturing: true, mode, error: null });
    },
    [stop]
  );

  const startDisplay = useCallback(async () => {
    setState((p) => ({ ...p, error: null }));
    try {
      // audio-only getDisplayMedia; video: false is supported in Chrome 130+
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 44100 },
      } as DisplayMediaStreamOptions);
      startWithStream(stream, "display");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Permission denied";
      setState((p) => ({ ...p, error: msg }));
    }
  }, [startWithStream]);

  const startMicrophone = useCallback(async () => {
    setState((p) => ({ ...p, error: null }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 44100 },
      });
      startWithStream(stream, "microphone");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Microphone permission denied";
      setState((p) => ({ ...p, error: msg }));
    }
  }, [startWithStream]);

  useEffect(() => {
    return () => {
      stop();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [stop]);

  return { state, isActiveRef, startDisplay, startMicrophone, stop };
}
