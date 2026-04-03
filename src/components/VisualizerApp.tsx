"use client";
import dynamic from "next/dynamic";
import { useState, useRef } from "react";
import { useMicrophone } from "@/hooks/useMicrophone";
import ColorPicker from "./ColorPicker";
import FFTPlot from "./FFTPlot";

const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div
        className="h-16 w-16 rounded-full border-2 animate-spin"
        style={{ borderColor: "var(--holo-color)", borderTopColor: "transparent" }}
      />
    </div>
  ),
});

const DEFAULT_COLOR = "#00d4ff";

export default function VisualizerApp() {
  const [color, setColor] = useState(DEFAULT_COLOR);

  const freqRef = useRef<Uint8Array>(new Uint8Array(256));
  const { state: micState, start, stop } = useMicrophone(freqRef);

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-white"
      style={{ "--holo-color": color } as React.CSSProperties}
    >
      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 42%, color-mix(in srgb, ${color} 9%, transparent) 0%, transparent 70%)`,
          transition: "background 0.6s ease",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-6 pb-2">
        <div className="flex items-center gap-2.5">
          <div
            className="h-2.5 w-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
          />
          <span
            className="text-sm font-semibold tracking-widest uppercase"
            style={{ color }}
          >
            HoloViz
          </span>
        </div>
        <div className="flex items-center gap-2">
          {micState.isListening && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{
                background: `color-mix(in srgb, ${color} 14%, transparent)`,
                color,
                border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
              }}
            >
              Live · Real FFT
            </span>
          )}
          <span className="text-xs text-gray-400 tracking-wide">
            3D Audio Visualizer
          </span>
        </div>
      </header>

      {/* Main layout */}
      <main className="relative z-10 flex flex-col items-center lg:flex-row lg:items-stretch lg:justify-center gap-0 min-h-[calc(100vh-80px)]">
        {/* 3D Canvas */}
        <div
          className="w-full lg:flex-1 flex items-center justify-center"
          style={{ minHeight: "clamp(320px, 55vw, 620px)" }}
        >
          <Scene
            frequencyDataRef={freqRef}
            color={color}
            isPlaying={micState.isListening}
          />
        </div>

        {/* Control panel */}
        <div className="w-full lg:w-[340px] flex flex-col justify-center px-5 pb-8 lg:py-10 lg:pr-8">
          <div
            className="rounded-3xl border bg-white/80 backdrop-blur-xl p-6 shadow-xl flex flex-col gap-5"
            style={{
              borderColor: `color-mix(in srgb, ${color} 28%, #e5e7eb)`,
              boxShadow: `0 4px 32px color-mix(in srgb, ${color} 14%, transparent), 0 1px 3px rgba(0,0,0,0.06)`,
            }}
          >
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                Audio Visualizer
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Microphone · Real-time FFT
              </p>
            </div>

            <Divider color={color} />

            {/* Microphone control */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Microphone
              </p>

              <button
                onClick={micState.isListening ? stop : start}
                className="w-full rounded-xl py-3 text-sm font-semibold transition-all active:scale-95"
                style={
                  micState.isListening
                    ? {
                        background: `color-mix(in srgb, ${color} 12%, white)`,
                        border: `1.5px solid color-mix(in srgb, ${color} 50%, transparent)`,
                        color,
                      }
                    : {
                        background: color,
                        border: `1.5px solid ${color}`,
                        color: "white",
                      }
                }
              >
                {micState.isListening ? "Stop Listening" : "Start Listening"}
              </button>

              {micState.error && (
                <p className="text-[11px] text-red-400 leading-relaxed">
                  {micState.error}
                </p>
              )}
            </div>

            <Divider color={color} />

            {/* FFT Plot */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Frequency Spectrum
              </p>
              <FFTPlot
                frequencyDataRef={freqRef}
                color={color}
                isListening={micState.isListening}
              />
              <div className="flex justify-between text-[10px] text-gray-400 px-1">
                <span>20 Hz</span>
                <span>Fast Fourier Transform</span>
                <span>20 kHz</span>
              </div>
            </div>

            <Divider color={color} />

            {/* Color picker */}
            <ColorPicker color={color} onChange={setColor} />

            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              Drag to rotate · Scroll to zoom
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Divider({ color }: { color: string }) {
  return (
    <div
      className="h-px w-full shrink-0"
      style={{
        background: `linear-gradient(to right, transparent, color-mix(in srgb, ${color} 35%, #e5e7eb), transparent)`,
      }}
    />
  );
}
