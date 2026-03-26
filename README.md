# HoloViz — 3D Audio Visualizer

A Next.js web app that renders a real-time holographic 3D sphere animated by Fast Fourier Transform (FFT) analysis of uploaded audio files.

## Features

- **3D Holographic Sphere** — Rendered with React Three Fiber (Three.js), 280 signal nodes emanate from the surface and pulse with the music
- **Real-time FFT Analysis** — Web Audio API drives every spike on the sphere using frequency bin data
- **Audio File Upload** — Drag & drop or click to browse MP3, WAV, FLAC, OGG, and more
- **Color Customization** — 8 holographic color presets + custom color picker
- **Interactive 3D** — Drag to orbit, scroll to zoom, uses OrbitControls
- **Mobile Responsive** — Stacks vertically on small screens, side-by-side on desktop
- **White background with holographic glow** — Radial ambient glow, wireframe sphere, orbital rings, animated scanlines

## Stack

| Tool | Purpose |
|------|---------|
| Next.js 16 (App Router) | Framework |
| React Three Fiber | Three.js declarative renderer |
| @react-three/drei | Stars, OrbitControls helpers |
| Web Audio API | FFT frequency analysis |
| Tailwind CSS | Styling |
| TypeScript | Type safety |

## Getting Started

### 1. Spotify Setup (required for Spotify integration)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) and create an app
2. In your app settings, add these **Redirect URIs**:
   - `http://localhost:3000/api/auth/callback` (dev)
   - `https://your-app.vercel.app/api/auth/callback` (prod)
3. Copy `.env.local.example` → `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

### 2. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

```bash
npx vercel
```

Set these environment variables in the Vercel dashboard:
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `NEXT_PUBLIC_APP_URL` → `https://your-app.vercel.app`

The `vercel.json` is pre-configured with security headers.

## How it Works

1. User uploads an audio file → decoded via `AudioContext.decodeAudioData()`
2. An `AnalyserNode` with `fftSize: 512` produces 256 frequency bins per frame
3. Each of the 280 sphere nodes maps to a frequency bin; its spike length scales with amplitude
4. React Three Fiber's `useFrame` loop updates the `InstancedMesh` matrix every frame (~60fps)
5. The sphere also breathes (subtle scale pulse) and rotates slowly, with orbital rings and a soft glow sphere layered on top
# holoviz
