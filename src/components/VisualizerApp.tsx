"use client";
import dynamic from "next/dynamic";
import { useState, useRef, useEffect } from "react";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { useSpotify } from "@/hooks/useSpotify";
import { useDeezerPreview } from "@/hooks/useDeezerPreview";
import { useSystemAudio } from "@/hooks/useSystemAudio";
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

// Audio source modes
type AudioSource = "spotify" | "deezer" | "system" | "microphone" | "file";

export default function VisualizerApp() {
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [audioSource, setAudioSource] = useState<AudioSource>("spotify");

  // File-based audio analyzer
  const { audioState, frequencyDataRef: fileFreqRef, loadFile, play, pause, setVolume } =
    useAudioAnalyzer();

  // Spotify-driven frequency data (analysis-based synthetic FFT)
  const spotifyFreqRef = useRef<Uint8Array>(new Uint8Array(256));
  const { state: spotifyState, isSpotifyActiveRef, connect, disconnect, nextTrack, previousTrack, refreshNow } =
    useSpotify(spotifyFreqRef);

  // Deezer preview — real FFT from 30s preview clip
  const deezerFreqRef = useRef<Uint8Array>(new Uint8Array(256));
  const { state: deezerState, isActiveRef: isDeezerActiveRef } = useDeezerPreview(
    deezerFreqRef,
    spotifyState.track,
    audioSource === "deezer" && spotifyState.isAuthenticated && spotifyState.isPlaying
  );

  // System audio / microphone — real FFT from device audio
  const systemFreqRef = useRef<Uint8Array>(new Uint8Array(256));
  const { state: systemState, isActiveRef: isSystemActiveRef, startDisplay, startMicrophone, stop: stopSystem } =
    useSystemAudio(systemFreqRef);

  // The single ref passed to the 3D scene — updated each frame from whichever
  // source is currently active.
  const activeFreqRef = useRef<Uint8Array>(new Uint8Array(256));

  useEffect(() => {
    let frame: number;
    const merge = () => {
      if (audioSource === "system" || audioSource === "microphone") {
        if (isSystemActiveRef.current) {
          activeFreqRef.current = systemFreqRef.current;
        }
      } else if (audioSource === "deezer") {
        if (isDeezerActiveRef.current) {
          activeFreqRef.current = deezerFreqRef.current;
        } else if (isSpotifyActiveRef.current) {
          activeFreqRef.current = spotifyFreqRef.current;
        }
      } else if (audioSource === "spotify") {
        activeFreqRef.current = isSpotifyActiveRef.current
          ? spotifyFreqRef.current
          : fileFreqRef.current;
      } else {
        // file mode
        activeFreqRef.current = fileFreqRef.current;
      }
      frame = requestAnimationFrame(merge);
    };
    frame = requestAnimationFrame(merge);
    return () => cancelAnimationFrame(frame);
  }, [audioSource, isSpotifyActiveRef, isDeezerActiveRef, isSystemActiveRef,
      spotifyFreqRef, deezerFreqRef, systemFreqRef, fileFreqRef]);

  // Auto-switch source mode for system audio
  const handleStartDisplay = async () => {
    setAudioSource("system");
    await startDisplay();
  };
  const handleStartMicrophone = async () => {
    setAudioSource("microphone");
    await startMicrophone();
  };
  const handleStopSystem = () => {
    stopSystem();
    setAudioSource("spotify");
  };

  const isSpotifyPlaying = spotifyState.isAuthenticated && spotifyState.isPlaying;
  const displayIsPlaying = isSpotifyPlaying || audioState.isPlaying || systemState.isCapturing;

  // Determine what to show in the source badge
  const activeBadge = (() => {
    if (systemState.isCapturing) {
      return systemState.mode === "microphone" ? "Microphone" : "System Audio";
    }
    if (isSpotifyPlaying) {
      if (audioSource === "deezer" && deezerState.isPlaying) return "Deezer Preview";
      return "Spotify Live";
    }
    if (audioState.isPlaying) return "File Playing";
    return null;
  })();

  // Quality label for the active source
  const qualityLabel = (() => {
    if (systemState.isCapturing) return "Real FFT";
    if (audioSource === "deezer" && deezerState.isPlaying) return "Real FFT";
    if (isSpotifyPlaying && spotifyState.usingAnalysis) return "Analysis";
    if (audioState.isPlaying) return "Real FFT";
    return null;
  })();

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
          {activeBadge && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{
                background: `color-mix(in srgb, ${color} 14%, transparent)`,
                color,
                border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
              }}
            >
              {activeBadge}
              {qualityLabel && (
                <span className="ml-1 opacity-60">· {qualityLabel}</span>
              )}
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
            audioFeatures={spotifyState.features}
          />
        </div>

        {/* Control panel */}
        <div className="w-full lg:w-[340px] flex flex-col justify-center px-5 pb-8 lg:py-10 lg:pr-8">
          <div
            className="rounded-3xl border bg-white/80 backdrop-blur-xl p-6 shadow-xl flex flex-col gap-5 overflow-y-auto"
            style={{
              borderColor: `color-mix(in srgb, ${color} 28%, #e5e7eb)`,
              boxShadow: `0 4px 32px color-mix(in srgb, ${color} 14%, transparent), 0 1px 3px rgba(0,0,0,0.06)`,
              maxHeight: "calc(100dvh - 120px)",
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

            {/* Audio Source Selector */}
            <AudioSourceSelector
              color={color}
              current={audioSource}
              spotifyConnected={spotifyState.isAuthenticated}
              spotifyPlaying={isSpotifyPlaying}
              systemCapturing={systemState.isCapturing}
              systemMode={systemState.mode}
              deezerState={deezerState}
              systemError={systemState.error}
              onSelect={setAudioSource}
              onStartDisplay={handleStartDisplay}
              onStartMicrophone={handleStartMicrophone}
              onStopSystem={handleStopSystem}
            />

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

// ── Audio Source Selector ────────────────────────────────────────────────────

interface AudioSourceSelectorProps {
  color: string;
  current: AudioSource;
  spotifyConnected: boolean;
  spotifyPlaying: boolean;
  systemCapturing: boolean;
  systemMode: "display" | "microphone" | null;
  deezerState: { isLoading: boolean; isPlaying: boolean; matchTitle: string | null; error: string | null };
  systemError: string | null;
  onSelect: (s: AudioSource) => void;
  onStartDisplay: () => void;
  onStartMicrophone: () => void;
  onStopSystem: () => void;
}

function AudioSourceSelector({
  color,
  current,
  spotifyConnected,
  spotifyPlaying,
  systemCapturing,
  systemMode,
  deezerState,
  systemError,
  onSelect,
  onStartDisplay,
  onStartMicrophone,
  onStopSystem,
}: AudioSourceSelectorProps) {
  const sources: { id: AudioSource; label: string; subtitle: string; quality: string }[] = [
    {
      id: "spotify",
      label: "Spotify Analysis",
      subtitle: "Beat & pitch data",
      quality: "Synthetic FFT",
    },
    {
      id: "deezer",
      label: "Deezer Preview",
      subtitle: "30s real audio",
      quality: "Real FFT",
    },
    {
      id: "system",
      label: "System Audio",
      subtitle: "Chrome only",
      quality: "Real FFT",
    },
    {
      id: "microphone",
      label: "Microphone",
      subtitle: "Live input",
      quality: "Real FFT",
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Audio Source
      </p>
      <div className="grid grid-cols-2 gap-2">
        {sources.map((s) => {
          const isActive = current === s.id;
          const isRealFFT = s.quality === "Real FFT";
          return (
            <button
              key={s.id}
              onClick={() => {
                if (s.id === "system") {
                  if (systemCapturing && systemMode === "display") { onStopSystem(); return; }
                  onStartDisplay();
                } else if (s.id === "microphone") {
                  if (systemCapturing && systemMode === "microphone") { onStopSystem(); return; }
                  onStartMicrophone();
                } else {
                  onSelect(s.id);
                }
              }}
              className="relative flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all"
              style={{
                borderColor: isActive
                  ? `color-mix(in srgb, ${color} 60%, transparent)`
                  : `color-mix(in srgb, ${color} 18%, #e5e7eb)`,
                background: isActive
                  ? `color-mix(in srgb, ${color} 10%, white)`
                  : "transparent",
              }}
            >
              <span className="text-[11px] font-semibold text-gray-800">{s.label}</span>
              <span className="text-[10px] text-gray-400">{s.subtitle}</span>
              <span
                className="mt-0.5 rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wider"
                style={{
                  background: isRealFFT
                    ? `color-mix(in srgb, ${color} 18%, transparent)`
                    : "rgba(0,0,0,0.05)",
                  color: isRealFFT ? color : "#9ca3af",
                }}
              >
                {s.quality}
              </span>
            </button>
          );
        })}
      </div>

      {/* Deezer status */}
      {current === "deezer" && spotifyPlaying && (
        <div className="text-[11px] text-gray-500 leading-relaxed">
          {deezerState.isLoading && "Searching Deezer..."}
          {deezerState.isPlaying && deezerState.matchTitle && (
            <span style={{ color }}>Playing: {deezerState.matchTitle}</span>
          )}
          {deezerState.error && (
            <span className="text-red-400">{deezerState.error}</span>
          )}
          {!spotifyConnected && "Connect Spotify first"}
        </div>
      )}

      {/* System audio status / errors */}
      {(current === "system" || current === "microphone") && systemError && (
        <p className="text-[11px] text-red-400 leading-relaxed">{systemError}</p>
      )}
      {systemCapturing && (
        <p className="text-[11px] leading-relaxed" style={{ color }}>
          {systemMode === "microphone" ? "Mic active" : "System audio active"} &mdash; real-time FFT
        </p>
      )}
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
