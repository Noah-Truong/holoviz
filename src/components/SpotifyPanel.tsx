"use client";
import Image from "next/image";
import { SpotifyState } from "@/hooks/useSpotify";
import PlaylistBrowser from "./PlaylistBrowser";

interface SpotifyPanelProps {
  state: SpotifyState;
  isActive: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onPlaylistSelect: () => void;
}

export default function SpotifyPanel({
  state,
  isActive,
  onConnect,
  onDisconnect,
  onNext,
  onPrevious,
  onPlaylistSelect,
}: SpotifyPanelProps) {
  const { isAuthenticated, isConnecting, isPlaying, track, usingAnalysis, contextUri } = state;

  if (isConnecting) {
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="h-2.5 w-2.5 rounded-full bg-gray-200 animate-pulse" />
        <span className="text-xs text-gray-400">Checking Spotify…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <button
        onClick={onConnect}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] shadow-md"
        style={{ background: "linear-gradient(135deg, #1DB954, #17a346)" }}
      >
        <SpotifyIcon className="h-5 w-5" />
        Connect Spotify
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <SpotifyIcon className="h-3.5 w-3.5" color="#1DB954" />
          <span className="text-xs font-semibold text-[#1DB954]">Spotify</span>
          {isActive && (
            <span className="rounded-full bg-[#1DB954]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#1DB954] uppercase tracking-wider">
              Live
            </span>
          )}
          {isActive && usingAnalysis && (
            <span
              title="Visualizer is driven by Spotify audio analysis for the current track"
              className="rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 uppercase tracking-wider cursor-help"
            >
              Analysis
            </span>
          )}
          {isActive && !usingAnalysis && (
            <span
              title="Loading audio analysis for this track…"
              className="rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 uppercase tracking-wider cursor-help"
            >
              Loading…
            </span>
          )}
        </div>
        <button
          onClick={onDisconnect}
          className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          Disconnect
        </button>
      </div>

      {/* Now Playing card */}
      {isPlaying && track ? (
        <div
          className="flex items-center gap-3 rounded-xl p-3 border transition-all duration-500"
          style={{
            backgroundColor: isActive ? "rgba(29,185,84,0.07)" : "#f9fafb",
            borderColor: isActive ? "#1DB95440" : "#e5e7eb",
          }}
        >
          {track.album.images[0] && (
            <div className="relative shrink-0">
              <Image
                src={track.album.images[0].url}
                alt={track.album.name}
                width={44}
                height={44}
                className="rounded-lg shadow-sm"
              />
              {isActive && (
                <div
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  style={{ boxShadow: "0 0 0 2px #1DB954" }}
                />
              )}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
              {track.name}
            </p>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {track.artists.map((a) => a.name).join(", ")}
            </p>
          </div>
          {isActive && (
            <div className="flex gap-[3px] items-end h-5 shrink-0">
              {[0.6, 1, 0.75].map((h, i) => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-[#1DB954]"
                  style={{
                    height: `${h * 100}%`,
                    animation: "barBounce 0.8s ease-in-out infinite alternate",
                    animationDelay: `${i * 130}ms`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-gray-50 border border-gray-100">
          <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
          <p className="text-xs text-gray-500">Nothing playing on Spotify</p>
        </div>
      )}

      {/* Playlist browser */}
      <PlaylistBrowser
        isAuthenticated={isAuthenticated}
        currentContextUri={contextUri}
        onPlaylistSelect={onPlaylistSelect}
      />

      {/* Track navigation controls */}
      <div className="flex items-center justify-center gap-3 pt-0.5">
        <TrackButton onClick={onPrevious} label="Previous track" disabled={!isPlaying}>
          <PreviousIcon />
        </TrackButton>

        {/* Playback hint */}
        <span className="text-[11px] text-gray-400 flex-1 text-center leading-snug">
          {isPlaying ? "Playing on Spotify" : "Open Spotify to play"}
        </span>

        <TrackButton onClick={onNext} label="Next track" disabled={!isPlaying}>
          <NextIcon />
        </TrackButton>
      </div>
    </div>
  );
}

function TrackButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`
        flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200
        focus:outline-none
        ${
          disabled
            ? "opacity-35 cursor-not-allowed border-gray-200 text-gray-300"
            : "cursor-pointer border-[#1DB954]/40 text-[#1DB954] hover:bg-[#1DB954]/10 hover:border-[#1DB954] hover:scale-105 active:scale-95"
        }
      `}
    >
      {children}
    </button>
  );
}

function PreviousIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798L4.555 5.168z" />
    </svg>
  );
}

function SpotifyIcon({
  className,
  color = "white",
}: {
  className?: string;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={color}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
