"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { SpotifyPlaylist } from "@/lib/spotify";

interface PlaylistBrowserProps {
  isAuthenticated: boolean;
  currentContextUri: string | null;
  onPlaylistSelect: () => void;
}

export default function PlaylistBrowser({
  isAuthenticated,
  currentContextUri,
  onPlaylistSelect,
}: PlaylistBrowserProps) {
  const [expanded, setExpanded] = useState(false);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  const fetchPlaylists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/spotify/playlists");
      if (res.status === 401 || res.status === 403) {
        setNeedsReauth(true);
        return;
      }
      if (!res.ok) {
        setError("Couldn't load playlists.");
        return;
      }
      const data = await res.json();
      setPlaylists(data.playlists ?? []);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && isAuthenticated && playlists.length === 0 && !needsReauth) {
      fetchPlaylists();
    }
  }, [expanded, isAuthenticated, playlists.length, needsReauth, fetchPlaylists]);

  const playPlaylist = useCallback(
    async (playlist: SpotifyPlaylist) => {
      if (playingId) return;
      setPlayingId(playlist.id);
      setError(null);
      try {
        const res = await fetch("/api/spotify/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context_uri: playlist.uri }),
        });
        if (res.status === 404) {
          setError("No active Spotify device — open Spotify on any device first.");
        } else if (res.status === 403) {
          setError("Spotify Premium required to change playback.");
        } else {
          onPlaylistSelect();
        }
      } catch {
        setError("Couldn't start playlist.");
      } finally {
        setTimeout(() => setPlayingId(null), 1200);
      }
    },
    [playingId, onPlaylistSelect]
  );

  if (!isAuthenticated) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Section header / toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between py-0.5 group focus:outline-none"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">
          Your Playlists
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
          />
        </svg>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 min-w-0">
          {/* Re-auth notice */}
          {needsReauth && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-center justify-between gap-3">
              <p className="text-xs text-amber-700 leading-snug">
                Reconnect to grant playlist access.
              </p>
              <a
                href="/api/auth/login"
                className="text-xs font-semibold text-amber-700 whitespace-nowrap underline underline-offset-2 shrink-0"
              >
                Reconnect →
              </a>
            </div>
          )}

          {/* Error message */}
          {error && !needsReauth && (
            <p className="text-[11px] text-red-500 leading-snug px-0.5">{error}</p>
          )}

          {/* Skeleton loader */}
          {loading && (
            <div className="flex flex-col gap-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-2 py-1.5 animate-pulse">
                  <div className="h-9 w-9 rounded-lg bg-gray-100 shrink-0" />
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="h-2.5 rounded-full bg-gray-100 w-3/4" />
                    <div className="h-2 rounded-full bg-gray-100 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Playlist list */}
          {!loading && playlists.length > 0 && (
            <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto -mx-1 px-1">
              {playlists.map((playlist) => {
                const isActive = currentContextUri === playlist.uri;
                const isQueuing = playingId === playlist.id;

                return (
                  <button
                    key={playlist.id}
                    onClick={() => playPlaylist(playlist)}
                    disabled={isQueuing}
                    className={[
                      "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5",
                      "transition-colors duration-150 focus:outline-none text-left",
                      isActive
                        ? "bg-[#1DB954]/10 border border-[#1DB954]/30"
                        : "border border-transparent hover:bg-gray-50",
                      isQueuing ? "opacity-60 cursor-wait" : "cursor-pointer",
                    ].join(" ")}
                  >
                    {/* Cover art — fixed size, never flex-shrinks */}
                    <div className="relative h-9 w-9 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                      {playlist.images[0] ? (
                        <Image
                          src={playlist.images[0].url}
                          alt={playlist.name}
                          fill
                          sizes="36px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <MusicNoteIcon />
                        </div>
                      )}
                      {isActive && (
                        <div className="absolute inset-0 ring-2 ring-inset ring-[#1DB954] rounded-lg pointer-events-none" />
                      )}
                    </div>

                    {/* Text — must have min-w-0 for truncate to work inside flex */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={[
                          "text-xs font-semibold truncate leading-tight",
                          isActive ? "text-[#1DB954]" : "text-gray-800",
                        ].join(" ")}
                      >
                        {playlist.name}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-tight">
                        {playlist.tracks.total} tracks
                        {playlist.owner.display_name
                          ? ` · ${playlist.owner.display_name}`
                          : ""}
                      </p>
                    </div>

                    {/* Right indicator — fixed width, never squishes text */}
                    <div className="w-5 shrink-0 flex items-center justify-center">
                      {isQueuing ? (
                        <div
                          className="h-3.5 w-3.5 rounded-full border-2 border-t-transparent animate-spin"
                          style={{
                            borderColor: "var(--holo-color)",
                            borderTopColor: "transparent",
                          }}
                        />
                      ) : isActive ? (
                        <div className="flex gap-[2px] items-end h-4">
                          {[0.5, 1, 0.7].map((h, i) => (
                            <div
                              key={i}
                              className="w-[2px] rounded-full bg-[#1DB954]"
                              style={{
                                height: `${h * 100}%`,
                                animation:
                                  "barBounce 0.7s ease-in-out infinite alternate",
                                animationDelay: `${i * 120}ms`,
                              }}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!loading && !needsReauth && playlists.length === 0 && !error && (
            <p className="text-[11px] text-gray-400 text-center py-3">
              No playlists found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MusicNoteIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-300">
      <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
    </svg>
  );
}
