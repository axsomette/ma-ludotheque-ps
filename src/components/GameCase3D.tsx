import { RoundedBox, useTexture } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { backCover, discDataSide, discLabel, generatedCover, spineTexture } from "../lib/canvasArt";
import { PLATFORMS } from "../lib/platforms";
import type { Game } from "../lib/types";

// Boîtier Blu-ray PlayStation : 135 × 171 × 15 mm (1 unité = 100 mm).
const W = 1.35;
const H = 1.71;
const D = 0.15;
const T = 0.016; // épaisseur du plastique
const OPEN_ANGLE = -1.95; // ≈ 112°
const DISC_R = 0.6; // disque de 120 mm
const HOLE_R = 0.075;
const DISC_T = 0.012;

export type CaseMode = "front" | "back" | "open" | "disc";

interface Props {
  game: Game;
  mode: CaseMode;
  discFlipped: boolean;
  tint: string;
  onCaseClick: () => void;
  onDiscClick: () => void;
}

/** Ignore les « clics » qui sont en réalité la fin d'un glisser (rotation à la main). */
const isTap = (e: ThreeEvent<MouseEvent>) => e.delta < 6;

function canvasTexture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function GameCase3D({ game, mode, discFlipped, tint, onCaseClick, onDiscClick }: Props) {
  const p = PLATFORMS[game.platform];
  const coverSrc = useMemo(() => game.cover_url ?? generatedCover(game.title, game.platform), [game.cover_url, game.title, game.platform]);
  const cover = useTexture(coverSrc);
  cover.colorSpace = THREE.SRGBColorSpace;
  cover.anisotropy = 8;

  const spine = useMemo(() => canvasTexture(spineTexture(game, tint)), [game, tint]);
  const dataSide = useMemo(() => canvasTexture(discDataSide()), []);

  const [back, setBack] = useState<THREE.Texture | null>(null);
  const [label, setLabel] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    backCover(game, tint).then((c) => alive && setBack(canvasTexture(c)));
    discLabel(game).then((c) => alive && setLabel(canvasTexture(c)));
    return () => {
      alive = false;
    };
  }, [game, tint]);

  const root = useRef<THREE.Group>(null!);
  const lid = useRef<THREE.Group>(null!);
  const disc = useRef<THREE.Group>(null!);
  const spin = useRef(0);
  const flip = useRef(0);

  useFrame((state, dt) => {
    const k = (v: number, target: number, speed = 5) => THREE.MathUtils.damp(v, target, speed, dt);
    const open = mode === "open" || mode === "disc";
    const out = mode === "disc";

    lid.current.rotation.y = k(lid.current.rotation.y, open ? OPEN_ANGLE : 0, 4.2);

    const yaw = mode === "back" ? Math.PI - 0.42 : mode === "front" ? -0.42 : mode === "open" ? 0.16 : 0.05;
    root.current.rotation.y = k(root.current.rotation.y, yaw, 4);
    root.current.rotation.x = k(root.current.rotation.x, out ? 0.08 : 0.04, 4);
    // Ouvert, le couvercle part à gauche : on recentre ; disque sorti, le boîtier recule.
    root.current.position.x = k(root.current.position.x, out ? 0.15 : open ? 0.48 : 0, 4);
    root.current.position.z = k(root.current.position.z, out ? -0.9 : 0, 4);

    // Disque : posé dans le boîtier, ou sorti face à soi et tournant lentement.
    const d = disc.current;
    d.position.x = k(d.position.x, out ? -0.12 : 0, 5);
    d.position.y = k(d.position.y, out ? 0.12 + Math.sin(state.clock.elapsedTime * 1.4) * 0.025 : 0.04, 5);
    d.position.z = k(d.position.z, out ? 1.25 : -D / 2 + T + 0.014, 5);
    const s = k(d.scale.x, out ? 1.12 : 1, 5);
    d.scale.setScalar(s);
    spin.current += dt * (out ? 0.35 : open ? 0.12 : 0);
    flip.current = k(flip.current, discFlipped && out ? Math.PI : 0, 6);
    d.rotation.set(out ? 0.12 : 0, flip.current, spin.current);
  });

  const plastic = (
    <meshPhysicalMaterial color={p.caseColor} roughness={0.32} metalness={0.02} clearcoat={0.9} clearcoatRoughness={0.18} />
  );
  const inner = <meshPhysicalMaterial color={p.caseColor} roughness={0.6} sheen={0.4} sheenColor="#ffffff" />;

  const hover = {
    onPointerOver: () => (document.body.style.cursor = "pointer"),
    onPointerOut: () => (document.body.style.cursor = ""),
  };

  return (
    <group ref={root}>
      {/* ---------- Base : fond, dos imprimé, tranche, bords ---------- */}
      <group
        onClick={(e) => {
          if (!isTap(e)) return;
          e.stopPropagation();
          onCaseClick();
        }}
        {...hover}
      >
        <RoundedBox args={[W, H, T]} radius={0.035} smoothness={4} position={[0, 0, -D / 2 + T / 2]} castShadow receiveShadow>
          {plastic}
        </RoundedBox>
        {/* jaquette arrière, sous le film transparent */}
        <mesh position={[0, 0, -D / 2 - 0.0012]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[W - 0.05, H - 0.05]} />
          <meshPhysicalMaterial map={back ?? cover} color={back ? "#ffffff" : "#3a3f4b"} roughness={0.3} clearcoat={1} clearcoatRoughness={0.1} />
        </mesh>
        {/* tranche (côté charnière) avec son impression */}
        <mesh position={[-W / 2 + T / 2, 0, 0]} castShadow>
          <boxGeometry args={[T, H - 0.02, D]} />
          {plastic}
        </mesh>
        <mesh position={[-W / 2 - 0.0012, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[D - 0.02, H - 0.05]} />
          <meshPhysicalMaterial map={spine} roughness={0.3} clearcoat={1} clearcoatRoughness={0.1} />
        </mesh>
        {/* bords haut / bas / ouverture */}
        {[H / 2 - T / 2, -H / 2 + T / 2].map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[W - 0.02, T, D]} />
            {plastic}
          </mesh>
        ))}
        <mesh position={[W / 2 - T / 2, 0, -D / 4]}>
          <boxGeometry args={[T, H - 0.02, D / 2]} />
          {plastic}
        </mesh>
        {/* intérieur : plateau et moyeu à griffes */}
        <mesh position={[0, 0, -D / 2 + T + 0.001]}>
          <planeGeometry args={[W - 0.06, H - 0.06]} />
          {inner}
        </mesh>
        <mesh position={[0, 0.04, -D / 2 + T + 0.004]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[DISC_R + 0.02, DISC_R + 0.02, 0.006, 96]} />
          <meshStandardMaterial color={p.caseColor} roughness={0.75} />
        </mesh>
        <group position={[0, 0.04, -D / 2 + T + 0.022]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[HOLE_R - 0.004, HOLE_R + 0.004, 0.03, 32]} />
            <meshStandardMaterial color="#e4e7ee" roughness={0.35} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0.012]} rotation={[0, 0, a]}>
                <boxGeometry args={[0.03, 0.012, 0.016]} />
                <meshStandardMaterial color="#f2f4f8" roughness={0.3} />
              </mesh>
            );
          })}
        </group>
      </group>

      {/* ---------- Disque : face étiquette, face gravée, vrai trou central ---------- */}
      <group
        ref={disc}
        onClick={(e) => {
          if (!isTap(e) || (mode !== "open" && mode !== "disc")) return;
          e.stopPropagation();
          onDiscClick();
        }}
        {...hover}
      >
        <mesh position={[0, 0, DISC_T / 2]} castShadow>
          <ringGeometry args={[HOLE_R, DISC_R, 128, 1]} />
          <meshPhysicalMaterial
            key={label ? label.uuid : "blank"}
            map={label ?? undefined}
            color={label ? "#ffffff" : "#d5d9e2"}
            roughness={0.42}
            clearcoat={0.6}
          />
        </mesh>
        <mesh position={[0, 0, -DISC_T / 2]} rotation={[0, Math.PI, 0]}>
          <ringGeometry args={[HOLE_R, DISC_R, 128, 1]} />
          {/* Peu métallique + légère émission de la texture : l'irisé reste visible sous tous les angles. */}
          <meshPhysicalMaterial
            map={dataSide}
            emissiveMap={dataSide}
            emissive="#ffffff"
            emissiveIntensity={0.14}
            metalness={0.45}
            roughness={0.2}
            iridescence={1}
            iridescenceIOR={1.6}
            iridescenceThicknessRange={[180, 620]}
            clearcoat={1}
            envMapIntensity={1.6}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[DISC_R, DISC_R, DISC_T, 128, 1, true]} />
          <meshPhysicalMaterial color="#d9dee8" metalness={0.8} roughness={0.25} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[HOLE_R, HOLE_R, DISC_T, 48, 1, true]} />
          <meshPhysicalMaterial color="#cfd5e0" roughness={0.2} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* ---------- Couvercle (pivote sur la tranche) ---------- */}
      <group
        ref={lid}
        position={[-W / 2, 0, D / 2 - T / 2]}
        onClick={(e) => {
          if (!isTap(e)) return;
          e.stopPropagation();
          onCaseClick();
        }}
        {...hover}
      >
        <RoundedBox args={[W, H, T]} radius={0.035} smoothness={4} position={[W / 2, 0, 0]} castShadow>
          {plastic}
        </RoundedBox>
        {/* jaquette avant sous le film transparent */}
        <mesh position={[W / 2 + 0.006, 0, T / 2 + 0.0012]}>
          <planeGeometry args={[W - 0.05, H - 0.05]} />
          <meshPhysicalMaterial map={cover} roughness={0.26} clearcoat={1} clearcoatRoughness={0.08} />
        </mesh>
        {/* face intérieure et clips à livret */}
        <mesh position={[W / 2, 0, -T / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[W - 0.06, H - 0.06]} />
          {inner}
        </mesh>
        {[0.62, -0.62].map((y) => (
          <mesh key={y} position={[W / 2 + 0.42, y, -T / 2 - 0.01]}>
            <boxGeometry args={[0.2, 0.05, 0.02]} />
            <meshStandardMaterial color={p.caseColor} roughness={0.45} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
