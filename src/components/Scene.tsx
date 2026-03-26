"use client";
import { MutableRefObject, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import HolographicSphere from "./HolographicSphere";

interface SceneProps {
  frequencyDataRef: MutableRefObject<Uint8Array>;
  color: string;
  isPlaying: boolean;
}

export default function Scene({
  frequencyDataRef,
  color,
  isPlaying,
}: SceneProps) {
  return (
    <div className="w-full h-full" style={{ background: "transparent" }}>
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <Stars
            radius={30}
            depth={20}
            count={400}
            factor={1.2}
            fade
            speed={0.3}
            saturation={0.3}
          />
          <HolographicSphere
            frequencyDataRef={frequencyDataRef}
            color={color}
            isPlaying={isPlaying}
          />
        </Suspense>
        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3}
          maxDistance={10}
          autoRotate={false}
          enableDamping
          dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
}
