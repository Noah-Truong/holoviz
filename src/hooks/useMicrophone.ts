"use client";
import { useEffect, useRef, useState, useCallback, MutableRefObject } from "react";

export interface MicrophoneState {
  isListening: boolean;
  error: string | null;
}

export function useMicrophone(freqRef: MutableRefObject<Uint8Array>) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef(0);

  const [state, setState] = useState<MicrophoneState>({
    isListening: false,
    error: null,
  });

  // RAF loop — push frequency data every frame
  useEffect(() => {
    let running = true;
    const dataArray = new Uint8Array(256);
    const loop = () => {
      if (!running) return;
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        freqRef.current.set(dataArray);
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [freqRef]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    setState({ isListening: false, error: null });
  }, []);

  const start = useCallback(async () => {
    setState({ isListening: false, error: null });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 44100,
        },
      });

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      // Not connecting to destination — analyze only, no echo feedback

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream;

      stream.getAudioTracks()[0].addEventListener("ended", stop, { once: true });
      setState({ isListening: true, error: null });
    } catch (e) {
      setState({
        isListening: false,
        error: e instanceof Error ? e.message : "Microphone permission denied",
      });
    }
  }, [stop]);

  useEffect(() => {
    return () => {
      stop();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [stop]);

  return { state, start, stop };
}
