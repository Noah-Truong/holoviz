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
      if (res.status === 401) {
        setNeedsReauth(true);
        return;
      }
      if (res.status === 403) {
        setNeedsReauth(true);
        return;
      }
      if (!res.ok) {
        setError("Couldn't load playlists.");
        return;
      }
      const data = await res.json();
      setPlaylists(data.playlists);
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
      try {
        const res = await fetch("/api/spotify/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ context_uri: playlist.uri }),
        });
        if (res.status === 404) {
          setError("No active Spotify device. Open Spotify on any device first.");
        } else if (res.status === 403) {
          setError("Spotify Premium required to change tracks.");
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
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between group"
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 group-hover:text-gray-700 transition-colors">
          Your Playlists
        </p>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {expanded && (
        <div className="flex flex-col gap-1.5">
          {needsReauth && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex flex-col gap-2">
              <p className="text-xs text-amber-700 leading-snug">
                Reconnect Spotify to grant playlist access.
              </p>
              <a
                href="/api/auth/login"
                className="text-xs font-semibold text-amber-700 underline underline-offset-2"
              >
                Reconnect →
              </a>
            </div>
          )}

          {error && !needsReauth && (
            <p className="text-[11px] text-red-500 px-1">{error}</p>
          )}

          {loading && (
            <div className="flex flex-col gap-1.5 py-1">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 px-1 animate-pulse"
                >
                  <div className="h-9 w-9 rounded-lg bg-gray-100 shrink-0" />
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="h-2.5 rounded-full bg-gray-100 w-3/4" />
                    <div className="h-2 rounded-full bg-gray-100 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && playlists.length > 0 && (
            <div
              className="flex flex-col gap-0.5 max-h-56 overflow-y-auto overscroll-contain pr-0.5"
              style={{ scrollbarWidth: "thin", scrollbarColor: "var(--holo-color) transparent" }}
            >
              {playlists.map((playlist) => {
                const isCurrentlyPlaying =
                  currentContextUri === playlist.uri;
                const isQueuing = playingId === playlist.id;

                return (
                  <button
                    key={playlist.id}
                    onClick={() => playPlaylist(playlist)}
                    disabled={isQueuing}
                    className={`
                      flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left
                      transition-all duration-150 focus:outline-none
                      ${
                        isCurrentlyPlaying
                          ? "bg-[#1DB954]/10 border border-[#1DB954]/25"
                          : "hover:bg-gray-50 border border-transparent"
                      }
                      ${isQueuing ? "opacity-60 cursor-wait" : "cursor-pointer"}
                    `}
                  >
                    {/* Cover art */}
                    <div className="relative h-9 w-9 shrink-0">
                      {playlist.images[0] ? (
                        <Image
                          src={playlist.images[0].url}
                          alt={playlist.name}
                          fill
                          sizes="36px"
                          className="rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center">
                          <svg
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-4 w-4 text-gray-300"
                          >
                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                          </svg>
                        </div>
                      )}
                      {isCurrentlyPlaying && (
                        <div className="absolute inset-0 rounded-lg ring-2 ring-[#1DB954]" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-semibold truncate leading-tight ${
                          isCurrentlyPlaying ? "text-[#1DB954]" : "text-gray-800"
                        }`}
                      >
                        {playlist.name}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {playlist.tracks.total} tracks
                        {playlist.owner.display_name
                          ? ` · ${playlist.owner.display_name}`
                          : ""}
                      </p>
                    </div>

                    {/* Now playing indicator */}
                    {isCurrentlyPlaying && !isQueuing && (
                      <div className="flex gap-[2px] items-end h-4 shrink-0">
                        {[0.5, 1, 0.7].map((h, i) => (
                          <div
                            key={i}
                            className="w-[2px] rounded-full bg-[#1DB954]"
                            style={{
                              height: `${h * 100}%`,
                              animation: "barBounce 0.7s ease-in-out infinite alternate",
                              animationDelay: `${i * 120}ms`,
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {isQueuing && (
                      <div
                        className="h-3.5 w-3.5 rounded-full border border-t-transparent shrink-0 animate-spin"
                        style={{ borderColor: "var(--holo-color)", borderTopColor: "transparent" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!loading && !needsReauth && playlists.length === 0 && !error && (
            <p className="text-[11px] text-gray-400 text-center py-2">
              No playlists found.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
