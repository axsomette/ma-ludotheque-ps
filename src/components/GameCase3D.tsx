import { useFrame } from "@react-three/fiber";
import { RoundedBox, useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { discTexture, generatedCover, spineTexture } from "../lib/canvasArt";
import { PLATFORMS } from "../lib/platforms";
import type { Game } from "../lib/types";

// Proportions d'un boîtier Blu-ray PlayStation (≈ 135 × 170 × 14 mm).
const W = 1.35;
const H = 1.7;
const D = 0.14;
const T = 0.018; // épaisseur du plastique
const OPEN_ANGLE = -1.95; // ≈ 112°

interface Props {
  game: Game;
  open: boolean;
  onToggle: () => void;
}

export function GameCase3D({ game, open, onToggle }: Props) {
  const p = PLATFORMS[game.platform];
  const coverSrc = useMemo(() => game.cover_url ?? generatedCover(game.title, game.platform), [game]);
  const cover = useTexture(coverSrc);
  cover.colorSpace = THREE.SRGBColorSpace;
  cover.anisotropy = 8;

  const spine = useMemo(() => {
    const t = new THREE.CanvasTexture(spineTexture(game.title, game.platform));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [game.title, game.platform]);

  const [disc, setDisc] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    discTexture(game.cover_url, game.title, game.platform).then((c) => {
      if (!alive) return;
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      setDisc(t);
    });
    return () => {
      alive = false;
    };
  }, [game.cover_url, game.title, game.platform]);

  const root = useRef<THREE.Group>(null!);
  const lid = useRef<THREE.Group>(null!);
  const discGroup = useRef<THREE.Group>(null!);
  const progress = useRef(0);
  const spin = useRef(0);

  useFrame((state, dt) => {
    const target = open ? 1 : 0;
    progress.current = THREE.MathUtils.damp(progress.current, target, 3.2, dt);
    const k = progress.current;
    lid.current.rotation.y = OPEN_ANGLE * easeInOut(k);

    // Le disque sort quand le boîtier est presque ouvert, puis tourne et flotte.
    const lift = THREE.MathUtils.smoothstep(k, 0.55, 1);
    spin.current += dt * (0.4 + lift * 2.2);
    discGroup.current.position.z = -D / 2 + T + 0.012 + lift * 0.34;
    discGroup.current.position.y = 0.05 + lift * Math.sin(state.clock.elapsedTime * 1.6) * 0.03;
    discGroup.current.rotation.z = spin.current;

    // Ouvert, le couvercle part à gauche : on recentre l'ensemble et on le remonte au-dessus des boutons.
    root.current.position.x = k * 0.55;
    root.current.position.y = 0.28;

    // Fermé : léger balancement pour montrer le volume.
    const idle = 1 - k;
    root.current.rotation.y = idle * Math.sin(state.clock.elapsedTime * 0.5) * 0.35 + k * 0.28;
    root.current.rotation.x = idle * Math.sin(state.clock.elapsedTime * 0.35) * 0.05;
  });

  const plastic = (
    <meshPhysicalMaterial color={p.caseColor} roughness={0.35} metalness={0.05} clearcoat={0.8} clearcoatRoughness={0.25} />
  );
  const innerPlastic = <meshPhysicalMaterial color={p.caseColor} roughness={0.55} metalness={0} sheen={0.3} />;

  return (
    <group
      ref={root}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      {/* ---------- Base (reste fixe) ---------- */}
      {/* fond */}
      <RoundedBox args={[W, H, T]} radius={0.02} smoothness={3} position={[0, 0, -D / 2 + T / 2]} castShadow>
        {plastic}
      </RoundedBox>
      {/* dos : la jaquette assombrie, comme le verso imprimé */}
      <mesh position={[0, 0, -D / 2 - 0.0015]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W - 0.03, H - 0.03]} />
        <meshStandardMaterial map={cover} color="#5a5f6b" roughness={0.6} />
      </mesh>
      {/* tranche (côté charnière) */}
      <mesh position={[-W / 2 + T / 2, 0, 0]} castShadow>
        <boxGeometry args={[T, H, D]} />
        {plastic}
      </mesh>
      <mesh position={[-W / 2 - 0.0015, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[D - 0.012, H - 0.03]} />
        <meshStandardMaterial map={spine} roughness={0.5} />
      </mesh>
      {/* bords haut / bas / droit */}
      <mesh position={[0, H / 2 - T / 2, 0]}>
        <boxGeometry args={[W, T, D]} />
        {plastic}
      </mesh>
      <mesh position={[0, -H / 2 + T / 2, 0]}>
        <boxGeometry args={[W, T, D]} />
        {plastic}
      </mesh>
      <mesh position={[W / 2 - T / 2, 0, 0]}>
        <boxGeometry args={[T, H, D]} />
        {plastic}
      </mesh>
      {/* support du disque */}
      <mesh position={[0, 0.05, -D / 2 + T + 0.004]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.008, 96]} />
        {innerPlastic}
      </mesh>
      <mesh position={[0, 0.05, -D / 2 + T + 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.085, 0.095, 0.05, 32]} />
        <meshStandardMaterial color="#d8dbe2" roughness={0.4} />
      </mesh>

      {/* ---------- Disque ---------- */}
      <group ref={discGroup} position={[0, 0.05, -D / 2 + T + 0.012]}>
        {/* key : le matériau est reconstruit quand la sérigraphie (chargée après coup) arrive */}
        <mesh key={disc ? disc.uuid : "blank"} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.012, 128]} />
          <meshPhysicalMaterial attach="material-0" color="#c9ced8" metalness={0.9} roughness={0.2} />
          <meshPhysicalMaterial
            attach="material-1"
            map={disc ?? undefined}
            color={disc ? "#ffffff" : "#cfd3dc"}
            metalness={0.35}
            roughness={0.3}
            clearcoat={1}
            iridescence={0.55}
            iridescenceIOR={1.4}
          />
          <meshPhysicalMaterial attach="material-2" color="#dfe3ec" metalness={1} roughness={0.08} iridescence={1} iridescenceIOR={1.5} />
        </mesh>
        {/* trou central */}
        <mesh position={[0, 0, 0.007]}>
          <circleGeometry args={[0.075, 48]} />
          <meshBasicMaterial color="#0b0d12" />
        </mesh>
      </group>

      {/* ---------- Couvercle (pivote sur la tranche) ---------- */}
      <group ref={lid} position={[-W / 2, 0, D / 2 - T / 2]}>
        <RoundedBox args={[W, H, T]} radius={0.02} smoothness={3} position={[W / 2, 0, 0]} castShadow>
          {plastic}
        </RoundedBox>
        {/* jaquette sous le film transparent */}
        <mesh position={[W / 2 + 0.005, 0, T / 2 + 0.0015]}>
          <planeGeometry args={[W - 0.04, H - 0.04]} />
          <meshPhysicalMaterial map={cover} roughness={0.28} clearcoat={1} clearcoatRoughness={0.08} />
        </mesh>
        {/* face intérieure + clips à livret */}
        <mesh position={[W / 2, 0, -T / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[W - 0.05, H - 0.05]} />
          {innerPlastic}
        </mesh>
        {[0.55, -0.55].map((y) => (
          <mesh key={y} position={[W / 2 + 0.35, y, -T / 2 - 0.012]}>
            <boxGeometry args={[0.18, 0.05, 0.02]} />
            <meshStandardMaterial color={p.caseColor} roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
