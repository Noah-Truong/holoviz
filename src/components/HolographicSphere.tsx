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
    const radius = Math.sqrt(1 - y * y);
    const theta = golden * i;
    points.push(
      new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius)
    );
  }
  return points;
}

export default function HolographicSphere({
  frequencyDataRef,
  color,
  isPlaying,
}: HolographicSphereProps) {
  const groupRef = useRef<THREE.Group>(null);
  const spikeMeshRef = useRef<THREE.InstancedMesh>(null);
  const glowSphereRef = useRef<THREE.Mesh>(null);
  const ringRefs = useRef<THREE.Mesh[]>([]);

  const spherePoints = useMemo(() => fibonacciSphere(NODE_COUNT), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const spikeGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(0.008, 0.002, 1, 4);
    geo.translate(0, 0.5, 0);
    return geo;
  }, []);

  const spikeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.9,
      }),
    [color]
  );

  const glowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.07,
        side: THREE.FrontSide,
      }),
    [color]
  );

  const coreMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.15,
        wireframe: true,
      }),
    [color]
  );

  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      }),
    [color]
  );

  useFrame(({ clock }) => {
    if (!groupRef.current || !spikeMeshRef.current) return;

    const t = clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.12;

    const fftData = frequencyDataRef.current;
    const fftLen = fftData.length;

    const avgAmplitude =
      fftLen > 0
        ? fftData.reduce((a, b) => a + b, 0) / fftLen / 255
        : 0;

    const breathe = 1 + Math.sin(t * 0.8) * 0.02 + avgAmplitude * 0.08;

    if (glowSphereRef.current) {
      glowSphereRef.current.scale.setScalar(1 + avgAmplitude * 0.25);
      (glowSphereRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.04 + avgAmplitude * 0.18;
    }

    ringRefs.current.forEach((ring, i) => {
      if (!ring) return;
      ring.rotation.z = t * (0.2 + i * 0.1);
      ring.rotation.x = t * (0.15 - i * 0.05);
      const pulse = 1 + Math.sin(t * 2 + i) * 0.04 + avgAmplitude * 0.12;
      ring.scale.setScalar(pulse);
      (ring.material as THREE.MeshBasicMaterial).opacity =
        0.1 + avgAmplitude * 0.3;
    });

    for (let i = 0; i < NODE_COUNT; i++) {
      const point = spherePoints[i];
      const freqIndex = Math.floor((i / NODE_COUNT) * fftLen);
      const rawAmplitude = fftLen > 0 ? fftData[freqIndex] / 255 : 0;

      const idle = 0.04 + Math.sin(t * 1.5 + i * 0.3) * 0.015;
      const spikeLen = isPlaying
        ? idle + rawAmplitude * 0.65
        : idle + Math.sin(t * 0.5 + i * 0.7) * 0.02;

      const r = BASE_RADIUS * breathe;
      dummy.position.set(point.x * r, point.y * r, point.z * r);
      dummy.lookAt(0, 0, 0);
      dummy.rotateX(Math.PI / 2);
      dummy.scale.set(
        1 + rawAmplitude * 0.6,
        spikeLen,
        1 + rawAmplitude * 0.6
      );
      dummy.updateMatrix();
      spikeMeshRef.current.setMatrixAt(i, dummy.matrix);
    }

    spikeMeshRef.current.instanceMatrix.needsUpdate = true;
    (spikeMeshRef.current.material as THREE.MeshBasicMaterial).color.set(
      color
    );
  });

  return (
    <group ref={groupRef}>
      {/* Core wireframe sphere */}
      <mesh>
        <sphereGeometry args={[BASE_RADIUS, 32, 32]} />
        <primitive object={coreMaterial} attach="material" />
      </mesh>

      {/* Inner glow sphere */}
      <mesh ref={glowSphereRef}>
        <sphereGeometry args={[BASE_RADIUS * 1.12, 32, 32]} />
        <primitive object={glowMaterial} attach="material" />
      </mesh>

      {/* Outer soft glow */}
      <mesh>
        <sphereGeometry args={[BASE_RADIUS * 1.35, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Orbital rings */}
      {[1.0, 1.08, 1.18].map((scale, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) ringRefs.current[i] = el;
          }}
          rotation={[Math.PI / 2 + i * 0.5, i * 0.4, 0]}
        >
          <torusGeometry args={[BASE_RADIUS * scale, 0.004, 8, 128]} />
          <primitive object={ringMaterial} attach="material" />
        </mesh>
      ))}

      {/* Spike instanced mesh */}
      <instancedMesh
        ref={spikeMeshRef}
        args={[spikeGeometry, spikeMaterial, NODE_COUNT]}
        frustumCulled={false}
      />
    </group>
  );
}
