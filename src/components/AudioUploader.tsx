"use client";
import { useRef, useState, DragEvent, ChangeEvent } from "react";

interface AudioUploaderProps {
  onFileLoad: (file: File) => void;
  fileName: string;
}

export default function AudioUploader({
  onFileLoad,
  fileName,
}: AudioUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) return;
    onFileLoad(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={`
        relative cursor-pointer select-none rounded-2xl border-2 border-dashed px-6 py-5
        transition-all duration-300
        ${
          isDragging
            ? "border-[var(--holo-color)] bg-[color-mix(in_srgb,var(--holo-color)_12%,transparent)] scale-[1.02]"
            : "border-[color-mix(in_srgb,var(--holo-color)_45%,transparent)] bg-[color-mix(in_srgb,var(--holo-color)_5%,transparent)] hover:border-[var(--holo-color)] hover:bg-[color-mix(in_srgb,var(--holo-color)_10%,transparent)]"
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={onChange}
      />
      <div className="flex flex-col items-center gap-2 text-center">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            background:
              "color-mix(in srgb, var(--holo-color) 18%, transparent)",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{ color: "var(--holo-color)" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        </div>
        {fileName ? (
          <div>
            <p
              className="text-sm font-semibold truncate max-w-[180px]"
              style={{ color: "var(--holo-color)" }}
            >
              {fileName}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Click or drop to replace
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-gray-700">
              Drop audio file here
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              or click to browse — MP3, WAV, FLAC, OGG
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
