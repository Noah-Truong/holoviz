"use client";
import dynamic from "next/dynamic";
import { useState, useRef, useEffect } from "react";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { useSpotify } from "@/hooks/useSpotify";
import AudioUploader from "./AudioUploader";
import ColorPicker from "./ColorPicker";
import PlayerControls from "./PlayerControls";
import SpotifyPanel from "./SpotifyPanel";

const Scene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div
        className="h-16 w-16 rounded-full border-2 animate-spin"
        style={{
          borderColor: "var(--holo-color)",
          borderTopColor: "transparent",
        }}
      />
    </div>
  ),
});

const DEFAULT_COLOR = "#00d4ff";

export default function VisualizerApp() {
  const [color, setColor] = useState(DEFAULT_COLOR);

  // File-based audio analyzer
  const { audioState, frequencyDataRef: fileFreqRef, loadFile, play, pause, setVolume } =
    useAudioAnalyzer();

  // Spotify-driven frequency data
  const spotifyFreqRef = useRef<Uint8Array>(new Uint8Array(256));
  const { state: spotifyState, isSpotifyActiveRef, connect, disconnect, nextTrack, previousTrack, refreshNow } =
    useSpotify(spotifyFreqRef);

  // The single ref passed to the 3D scene — updated each frame from whichever
  // source is currently active (Spotify takes priority over file upload).
  const activeFreqRef = useRef<Uint8Array>(new Uint8Array(256));

  useEffect(() => {
    let frame: number;
    const merge = () => {
      activeFreqRef.current = isSpotifyActiveRef.current
        ? spotifyFreqRef.current
        : fileFreqRef.current;
      frame = requestAnimationFrame(merge);
    };
    frame = requestAnimationFrame(merge);
    return () => cancelAnimationFrame(frame);
  }, [isSpotifyActiveRef, spotifyFreqRef, fileFreqRef]);

  const isSpotifyPlaying = spotifyState.isAuthenticated && spotifyState.isPlaying;
  const displayIsPlaying = isSpotifyPlaying || audioState.isPlaying;

  const handlePlayPause = () => {
    if (audioState.isPlaying) pause();
    else play();
  };

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
          {/* Active source badge */}
          {(isSpotifyPlaying || audioState.isPlaying) && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{
                background: `color-mix(in srgb, ${color} 14%, transparent)`,
                color,
                border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
              }}
            >
              {isSpotifyPlaying ? "Spotify Live" : "File Playing"}
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
            frequencyDataRef={activeFreqRef}
            color={color}
            isPlaying={displayIsPlaying}
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
            {/* Title */}
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                Audio Visualizer
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Connect Spotify or upload a local track
              </p>
            </div>

            <Divider color={color} />

            {/* Spotify section */}
            <SpotifyPanel
              state={spotifyState}
              isActive={isSpotifyPlaying}
              onConnect={connect}
              onDisconnect={disconnect}
              onNext={nextTrack}
              onPrevious={previousTrack}
              onPlaylistSelect={refreshNow}
            />

            <Divider color={color} />

            {/* File upload section */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                Local File
              </p>
              <AudioUploader
                onFileLoad={loadFile}
                fileName={audioState.fileName}
              />
              <PlayerControls
                isPlaying={audioState.isPlaying}
                isLoaded={audioState.isLoaded}
                currentTime={audioState.currentTime}
                duration={audioState.duration}
                volume={audioState.volume}
                onPlayPause={handlePlayPause}
                onVolumeChange={setVolume}
              />
            </div>

            <Divider color={color} />

            {/* Color picker */}
            <ColorPicker color={color} onChange={setColor} />

            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              Drag to rotate &middot; Scroll to zoom
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
