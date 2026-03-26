"use client";
import { useRef, useMemo, MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface HolographicSphereProps {
  frequencyDataRef: MutableRefObject<Uint8Array>;
  color: string;
  isPlaying: boolean;
}

const NODE_COUNT = 280;
const BASE_RADIUS = 1.6;

function fibonacciSphere(n: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    points.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
  }
  return points;
}

export default function HolographicSphere({
  frequencyDataRef,
  color,
  isPlaying,
}: HolographicSphereProps) {
  const groupRef = useRef<THREE.Group>(null);
  const stickMeshRef = useRef<THREE.InstancedMesh>(null);
  const ballMeshRef = useRef<THREE.InstancedMesh>(null);
  const glowSphereRef = useRef<THREE.Mesh>(null);
  const ringRefs = useRef<THREE.Mesh[]>([]);

  const spherePoints = useMemo(() => fibonacciSphere(NODE_COUNT), []);
  const stickDummy = useMemo(() => new THREE.Object3D(), []);
  const ballDummy = useMemo(() => new THREE.Object3D(), []);

  // Thin uniform cylinder — the lollipop stick, tip at local Y=1
  const stickGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.004, 0.004, 1, 5);
    geo.translate(0, 0.5, 0);
    return geo;
  }, []);

  // Unit sphere — scaled per-instance for the lollipop ball
  const ballGeometry = useMemo(() => new THREE.SphereGeometry(1, 10, 10), []);

  // All sphere-body materials use depthWrite: false so lollipops on the far
  // side of the sphere remain visible through it (holographic all-angle view).
  const coreMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.11,
        wireframe: true,
        depthWrite: false,
      }),
    [color]
  );

  const glowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.05,
        depthWrite: false,
      }),
    [color]
  );

  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [color]
  );

  // Lollipop materials — full depth writes so near sticks occlude far ones
  const stickMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.65,
      }),
    [color]
  );

  const ballMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 1,
      }),
    [color]
  );

  useFrame(({ clock }) => {
    if (!groupRef.current || !stickMeshRef.current || !ballMeshRef.current) return;

    const t = clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.12;

    const fftData = frequencyDataRef.current;
    const fftLen = fftData.length;
    const avgAmplitude =
      fftLen > 0 ? fftData.reduce((a, b) => a + b, 0) / fftLen / 255 : 0;

    const breathe = 1 + Math.sin(t * 0.8) * 0.02 + avgAmplitude * 0.08;
    const r = BASE_RADIUS * breathe;

    // Glow pulse
    if (glowSphereRef.current) {
      glowSphereRef.current.scale.setScalar(1 + avgAmplitude * 0.28);
      (glowSphereRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.03 + avgAmplitude * 0.14;
    }

    // Orbital rings
    ringRefs.current.forEach((ring, i) => {
      if (!ring) return;
      ring.rotation.z = t * (0.2 + i * 0.1);
      ring.rotation.x = t * (0.15 - i * 0.05);
      ring.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.04 + avgAmplitude * 0.12);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.1 + avgAmplitude * 0.28;
    });

    // Update material colors if color prop changed
    (stickMeshRef.current.material as THREE.MeshBasicMaterial).color.set(color);
    (ballMeshRef.current.material as THREE.MeshBasicMaterial).color.set(color);

    for (let i = 0; i < NODE_COUNT; i++) {
      const pt = spherePoints[i];
      const freqIndex = Math.floor((i / NODE_COUNT) * fftLen);
      const amp = fftLen > 0 ? fftData[freqIndex] / 255 : 0;

      const idle = 0.04 + Math.sin(t * 1.5 + i * 0.3) * 0.015;
      const spikeLen = isPlaying
        ? idle + amp * 0.72
        : idle + Math.sin(t * 0.5 + i * 0.7) * 0.018;

      // ── Stick: base at sphere surface, tip pointing outward ───────────────
      stickDummy.position.set(pt.x * r, pt.y * r, pt.z * r);
      stickDummy.lookAt(0, 0, 0);
      stickDummy.rotateX(Math.PI / 2);
      // Scale only Y (length); X/Z stay thin (geometry radius is 0.004 world units)
      stickDummy.scale.set(1, spikeLen, 1);
      stickDummy.updateMatrix();
      stickMeshRef.current.setMatrixAt(i, stickDummy.matrix);

      // ── Ball: placed exactly at the tip of the stick ──────────────────────
      const tipDist = r + spikeLen;
      ballDummy.position.set(pt.x * tipDist, pt.y * tipDist, pt.z * tipDist);
      // Ball grows slightly with amplitude for visual punch on loud passages
      ballDummy.scale.setScalar(0.024 + amp * 0.022);
      ballDummy.updateMatrix();
      ballMeshRef.current.setMatrixAt(i, ballDummy.matrix);
    }

    stickMeshRef.current.instanceMatrix.needsUpdate = true;
    ballMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      {/* All sphere-body geometry renders first (renderOrder 0) with depthWrite
          false so the lollipops behind the sphere are never occluded by it. */}

      <mesh renderOrder={0}>
        <sphereGeometry args={[BASE_RADIUS, 32, 32]} />
        <primitive object={coreMaterial} attach="material" />
      </mesh>

      <mesh ref={glowSphereRef} renderOrder={0}>
        <sphereGeometry args={[BASE_RADIUS * 1.14, 32, 32]} />
        <primitive object={glowMaterial} attach="material" />
      </mesh>

      <mesh renderOrder={0}>
        <sphereGeometry args={[BASE_RADIUS * 1.38, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.02}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {[1.0, 1.09, 1.19].map((scale, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) ringRefs.current[i] = el; }}
          rotation={[Math.PI / 2 + i * 0.5, i * 0.4, 0]}
          renderOrder={0}
        >
          <torusGeometry args={[BASE_RADIUS * scale, 0.003, 8, 128]} />
          <primitive object={ringMaterial} attach="material" />
        </mesh>
      ))}

      {/* Lollipop sticks — renderOrder 1 so they always draw after the sphere */}
      <instancedMesh
        ref={stickMeshRef}
        args={[stickGeometry, stickMaterial, NODE_COUNT]}
        frustumCulled={false}
        renderOrder={1}
      />

      {/* Lollipop balls */}
      <instancedMesh
        ref={ballMeshRef}
        args={[ballGeometry, ballMaterial, NODE_COUNT]}
        frustumCulled={false}
        renderOrder={1}
      />
    </group>
  );
}
