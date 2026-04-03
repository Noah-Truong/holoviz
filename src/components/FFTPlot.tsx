"use client";
import { useRef, useEffect, MutableRefObject } from "react";

interface FFTPlotProps {
  frequencyDataRef: MutableRefObject<Uint8Array>;
  color: string;
  isListening: boolean;
}

// Web Audio fftSize 512 → 256 bins, typical sample rate 44100 Hz
// Frequency per bin ≈ 44100 / 512 ≈ 86.1 Hz
const SAMPLE_RATE = 44100;
const FFT_SIZE = 512;
const HZ_PER_BIN = SAMPLE_RATE / FFT_SIZE;

// Frequency axis labels and their Hz values
const FREQ_LABELS: { hz: number; label: string }[] = [
  { hz: 50, label: "50" },
  { hz: 100, label: "100" },
  { hz: 250, label: "250" },
  { hz: 500, label: "500" },
  { hz: 1000, label: "1k" },
  { hz: 2000, label: "2k" },
  { hz: 5000, label: "5k" },
  { hz: 10000, label: "10k" },
  { hz: 20000, label: "20k" },
];

const MIN_FREQ = 20;
const MAX_FREQ = 20000;

// Map a frequency (Hz) to a 0–1 position on the log-scaled X axis
function freqToX(hz: number): number {
  return Math.log10(hz / MIN_FREQ) / Math.log10(MAX_FREQ / MIN_FREQ);
}

// Map a canvas X pixel to the nearest FFT bin index
function xToBin(x: number, width: number, binCount: number): number {
  const xNorm = x / width;
  const hz = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, xNorm);
  return Math.min(binCount - 1, Math.max(0, Math.round(hz / HZ_PER_BIN)));
}

export default function FFTPlot({ frequencyDataRef, color, isListening }: FFTPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Parse theme color to an RGB triple for gradient use
    const tmp = document.createElement("canvas");
    tmp.width = tmp.height = 1;
    const t = tmp.getContext("2d")!;
    t.fillStyle = color;
    t.fillRect(0, 0, 1, 1);
    const [r, g, b] = t.getImageData(0, 0, 1, 1).data;

    let running = true;

    const draw = () => {
      if (!running) return;
      animRef.current = requestAnimationFrame(draw);

      const W = canvas.width;
      const H = canvas.height;
      const fft = frequencyDataRef.current;
      const binCount = fft.length;

      // Clear
      ctx.clearRect(0, 0, W, H);

      const plotH = H - 24; // reserve 24px for freq axis labels at bottom

      // ── Grid lines ──────────────────────────────────────────────────────────
      ctx.strokeStyle = `rgba(${r},${g},${b},0.1)`;
      ctx.lineWidth = 1;
      for (const frac of [0.25, 0.5, 0.75, 1]) {
        const y = plotH * (1 - frac);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // ── dBFS labels on Y axis ────────────────────────────────────────────────
      ctx.fillStyle = `rgba(${r},${g},${b},0.35)`;
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      for (const [frac, label] of [
        [1, "0 dBFS"],
        [0.75, "−10"],
        [0.5, "−20"],
        [0.25, "−34"],
      ] as [number, string][]) {
        ctx.fillText(label, 3, plotH * (1 - frac) + 10);
      }

      // ── Spectrum area fill ──────────────────────────────────────────────────
      const grad = ctx.createLinearGradient(0, 0, 0, plotH);
      grad.addColorStop(0, `rgba(${r},${g},${b},0.85)`);
      grad.addColorStop(0.6, `rgba(${r},${g},${b},0.45)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0.05)`);
      ctx.fillStyle = grad;
      ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(0, plotH);

      for (let px = 0; px < W; px++) {
        const bin = xToBin(px, W, binCount);
        const amp = isListening ? fft[bin] / 255 : 0;
        const y = plotH * (1 - amp);
        if (px === 0) ctx.lineTo(px, y);
        else ctx.lineTo(px, y);
      }

      ctx.lineTo(W, plotH);
      ctx.closePath();
      ctx.fill();

      // Stroke the top edge of the spectrum for crispness
      ctx.beginPath();
      for (let px = 0; px < W; px++) {
        const bin = xToBin(px, W, binCount);
        const amp = isListening ? fft[bin] / 255 : 0;
        const y = plotH * (1 - amp);
        if (px === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();

      // ── Frequency axis labels ───────────────────────────────────────────────
      ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      for (const { hz, label } of FREQ_LABELS) {
        const x = freqToX(hz) * W;
        // Tick mark
        ctx.strokeStyle = `rgba(${r},${g},${b},0.25)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, plotH);
        ctx.lineTo(x, plotH + 4);
        ctx.stroke();
        ctx.fillText(label, x, H - 3);
      }
    };

    draw();
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [frequencyDataRef, color, isListening]);

  // Keep canvas resolution in sync with its display size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * (window.devicePixelRatio || 1);
      canvas.height = height * (window.devicePixelRatio || 1);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-xl"
      style={{
        height: 160,
        background: `color-mix(in srgb, ${color} 4%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 18%, #e5e7eb)`,
      }}
    />
  );
}
