"use client";

interface PlayerControlsProps {
  isPlaying: boolean;
  isLoaded: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onPlayPause: () => void;
  onVolumeChange: (v: number) => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function PlayerControls({
  isPlaying,
  isLoaded,
  currentTime,
  duration,
  volume,
  onPlayPause,
  onVolumeChange,
}: PlayerControlsProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums text-gray-400 w-8">
          {formatTime(currentTime)}
        </span>
        <div
          className="relative flex-1 h-1.5 rounded-full overflow-hidden"
          style={{
            background: "color-mix(in srgb, var(--holo-color) 18%, #e5e7eb)",
          }}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-100"
            style={{
              width: `${progress}%`,
              background: "var(--holo-color)",
              boxShadow: "0 0 6px var(--holo-color)",
            }}
          />
        </div>
        <span className="text-xs tabular-nums text-gray-400 w-8 text-right">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-4">
        {/* Play/Pause */}
        <button
          disabled={!isLoaded}
          onClick={onPlayPause}
          className={`
            flex h-11 w-11 items-center justify-center rounded-full border-2
            transition-all duration-200 focus:outline-none
            ${
              isLoaded
                ? "cursor-pointer hover:scale-105 active:scale-95"
                : "cursor-not-allowed opacity-40"
            }
          `}
          style={{
            borderColor: "var(--holo-color)",
            background: isLoaded
              ? "color-mix(in srgb, var(--holo-color) 12%, transparent)"
              : "transparent",
            boxShadow: isLoaded ? "0 0 12px color-mix(in srgb, var(--holo-color) 35%, transparent)" : "none",
          }}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
              style={{ color: "var(--holo-color)" }}
            >
              <path
                fillRule="evenodd"
                d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5 ml-0.5"
              style={{ color: "var(--holo-color)" }}
            >
              <path
                fillRule="evenodd"
                d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        {/* Volume */}
        <div className="flex items-center gap-2 flex-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4 shrink-0 text-gray-400"
          >
            <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
            <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.061z" />
          </svg>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
            style={
              {
                background: `linear-gradient(to right, var(--holo-color) ${volume * 100}%, #e5e7eb ${volume * 100}%)`,
                "--thumb-color": "var(--holo-color)",
              } as React.CSSProperties
            }
          />
        </div>
      </div>
    </div>
  );
}
