import { RoundedBox, useGLTF, useTexture } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { backCover, cartLabel, discDataSide, discLabel, fontsReady, frontCover, generatedCover, spineTexture } from "../lib/canvasArt";
import { LOW_POWER } from "../lib/perf";
import { PLATFORMS } from "../lib/platforms";
import type { Game, Platform } from "../lib/types";

// Dimensions du modèle Blender (boîtier PlayStation, 135 × 171 × 15 mm) ; les autres consoles le mettent à l'échelle.
const W0 = 1.35;
const H0 = 1.71;
const D0 = 0.15;
const T = 0.016; // épaisseur du plastique
// Cartouche Switch / Switch 2 (même format) : 21 × 31 × 3,3 mm, debout dans son support en bas du boîtier.
const CART = { w: 0.21, h: 0.31, d: 0.033 };
/** Hauteur du centre de la cartouche dans son support, depuis le bas du boîtier. */
const CART_FROM_BOTTOM = 0.3;
const OPEN_ANGLE = -2.75; // ≈ 158°, presque à plat comme un vrai boîtier
const DISC_R = 0.6; // disque de 120 mm
const HOLE_R = 0.075;
const DISC_T = 0.012;
const discRestZ = (D: number) => -D / 2 + T + 0.02 + DISC_T / 2; // posé sur les pétales du moyeu

// Coque modélisée dans Blender (blender/build_case.py) : plateau « Base » et couvercle « Lid »
// (origine sur la charnière), textures de plastique faites dans TextureLucraft.
const MODEL_URL = `${import.meta.env.BASE_URL}models/case.glb`;
useGLTF.preload(MODEL_URL);

/** Clone la coque et l'habille du plastique de la console (bleu translucide PS5, bleu PS4, noir PS3). */
function useCaseShell(platform: Platform) {
  const { scene } = useGLTF(MODEL_URL);
  const shell = useMemo(() => {
    const p = PLATFORMS[platform];
    const root = scene.clone(true);
    const materials: THREE.Material[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as THREE.MeshStandardMaterial;
      const outer = src.name === "Plastic";
      const m = new THREE.MeshPhysicalMaterial({
        name: src.name,
        color: outer ? p.caseColor : p.caseInner,
        metalness: 0,
        roughness: 1, // la carte de rugosité porte les valeurs réelles
        roughnessMap: src.roughnessMap,
        normalMap: src.normalMap,
        normalScale: new THREE.Vector2(0.3, 0.3),
        clearcoat: outer ? 1 : 0.7,
        clearcoatRoughness: outer ? 0.08 : 0.18,
        // Sur téléphone, pas de transmission (rendu en deux passes) : une simple transparence suffit.
        transmission: LOW_POWER ? 0 : p.translucency,
        thickness: 0.03,
        ior: 1.49,
        transparent: p.translucency > 0,
        opacity: p.translucency > 0 ? (LOW_POWER ? 1 - p.translucency * 0.35 : 0.92) : 1,
      });
      mesh.material = m;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      materials.push(m);
    });
    const base = root.getObjectByName("Base")!;
    const lid = root.getObjectByName("Lid")!;
    lid.position.set(0, 0, 0); // placé par le groupe qui pivote
    return { base, lid, materials };
  }, [scene, platform]);
  useEffect(() => () => shell.materials.forEach((m) => m.dispose()), [shell]);
  return shell;
}

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
  const coverSrc = useMemo(() => game.cover_url ?? generatedCover(game.title, game.platform), [game.cover_url, game.title, game.platform]);
  const cover = useTexture(coverSrc);
  cover.colorSpace = THREE.SRGBColorSpace;
  cover.anisotropy = 8;

  const dataSide = useMemo(() => canvasTexture(discDataSide()), []);
  const style = PLATFORMS[game.platform];
  const { w: W, h: H, d: D } = style.size;
  const isCart = style.media === "cart";
  const shellScale: [number, number, number] = [W / W0, H / H0, D / D0];
  const rest: [number, number, number] = isCart ? [0, -H / 2 + CART_FROM_BOTTOM, CART.d / 2 + 0.004] : [0, 0.04, discRestZ(D)];

  const [front, setFront] = useState<THREE.Texture | null>(null);
  const [back, setBack] = useState<THREE.Texture | null>(null);
  const [label, setLabel] = useState<THREE.Texture | null>(null);
  const [spine, setSpine] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    let alive = true;
    frontCover(game).then((c) => alive && setFront(canvasTexture(c)));
    backCover(game, tint).then((c) => alive && setBack(canvasTexture(c)));
    (PLATFORMS[game.platform].media === "cart" ? cartLabel(game) : discLabel(game)).then((c) => alive && setLabel(canvasTexture(c)));
    // la tranche attend les logotypes officiels
    fontsReady().then(() => alive && setSpine(canvasTexture(spineTexture(game, tint))));
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

    const yaw = mode === "back" ? Math.PI - 0.42 : mode === "front" ? -0.42 : mode === "open" ? 0.06 : 0.05;
    root.current.rotation.y = k(root.current.rotation.y, yaw, 4);
    root.current.rotation.x = k(root.current.rotation.x, out ? 0.08 : 0.04, 4);
    // Ouvert presque à plat, le couvercle part à gauche : on recentre et on recule pour tout voir ;
    // disque sorti, le boîtier recule encore.
    root.current.position.x = k(root.current.position.x, out ? 0.3 : open ? 0.66 : 0, 4);
    root.current.position.z = k(root.current.position.z, out ? -1.2 : open ? -0.85 : 0, 4);

    // Disque : posé dans le boîtier, ou sorti face à soi et tournant lentement.
    const d = disc.current;
    d.position.x = k(d.position.x, out ? -0.12 : rest[0], 5);
    d.position.y = k(d.position.y, out ? 0.12 + Math.sin(state.clock.elapsedTime * 1.4) * 0.025 : rest[1], 5);
    d.position.z = k(d.position.z, out ? 1.25 : rest[2], 5);
    // La cartouche, minuscule, est agrandie une fois sortie pour qu'on lise son étiquette.
    const s = k(d.scale.x, out ? (isCart ? 3.4 : 1.12) : 1, 5);
    d.scale.setScalar(s);
    if (!isCart) spin.current += dt * (out ? 0.35 : open ? 0.12 : 0);
    flip.current = k(flip.current, discFlipped && out ? Math.PI : 0, 6);
    d.rotation.set(out ? 0.12 : 0, flip.current, spin.current);
  });

  const shell = useCaseShell(game.platform);
  // Film transparent qui recouvre les jaquettes : un reflet net par-dessus l'impression mate.
  const sleeve = (map: THREE.Texture | null) => (
    // clé = texture : le matériau se recompile quand l'image arrive après le premier rendu
    <meshPhysicalMaterial key={map ? map.uuid : "vide"} map={map ?? undefined} color={map ? "#ffffff" : "#3a3f4b"} roughness={0.38} clearcoat={1} clearcoatRoughness={0.04} specularIntensity={0.6} />
  );

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
        {/* coque Blender : plateau, tranche à double charnière, moyeu à pétales, arcs de maintien */}
        {isCart ? (
          <NintendoBase platform={game.platform} />
        ) : (
          <group scale={shellScale}>
            <primitive object={shell.base} />
          </group>
        )}
        {/* jaquette arrière, sous le film transparent */}
        <mesh position={[0, 0, -D / 2 - 0.0012]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[W - 0.05, H - 0.05]} />
          {sleeve(back)}
        </mesh>
        {/* impression de la tranche (côté charnière) */}
        <mesh position={[-W / 2 - 0.0012, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[D - 0.02, H - 0.05]} />
          {sleeve(spine)}
        </mesh>
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
        {isCart ? (
          <GameCard label={label} color={style.cardColor ?? "#36373c"} />
        ) : (
          <>
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
          </>
        )}
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
        {/* coque Blender : couvercle, lèvre d'emboîtement, attaches à livret */}
        {isCart ? (
          <NintendoLid platform={game.platform} />
        ) : (
          <group scale={shellScale}>
            <primitive object={shell.lid} />
          </group>
        )}
        {/* jaquette avant sous le film transparent */}
        <mesh position={[W / 2 + 0.006, 0, T / 2 + 0.0012]}>
          <planeGeometry args={[W - 0.05, H - 0.05]} />
          <meshPhysicalMaterial key={front ? front.uuid : "cover"} map={front ?? cover} roughness={0.38} clearcoat={1} clearcoatRoughness={0.04} specularIntensity={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/** Plastique d'un boîtier Nintendo : transparent (Switch) ou rouge (Switch 2). */
function NintendoPlastic({ platform }: { platform: Platform }) {
  const p = PLATFORMS[platform];
  const clear = p.translucency > 0;
  return (
    <meshPhysicalMaterial
      color={p.caseColor}
      roughness={clear ? 0.12 : 0.42}
      clearcoat={clear ? 1 : 0.5}
      clearcoatRoughness={0.1}
      transparent={clear}
      opacity={clear ? 0.38 : 1}
      depthWrite={!clear}
    />
  );
}

/**
 * Moitié arrière d'un boîtier Switch / Switch 2 (aucun moyeu à disque) : coque, fond intérieur
 * (dos de la jaquette papier sous le plastique transparent, ou plastique rouge sur Switch 2)
 * et support de cartouche en bas, au centre.
 */
function NintendoBase({ platform }: { platform: Platform }) {
  const { w: W, h: H, d: D } = PLATFORMS[platform].size;
  const p = PLATFORMS[platform];
  const cy = -H / 2 + CART_FROM_BOTTOM;
  const wall = 0.014;
  const fw = CART.w + 0.016;
  const fh = CART.h + 0.016;
  const holder = p.translucency > 0 ? "#cfd8e2" : mix3(p.caseColor, 0.82);
  return (
    <group>
      <RoundedBox args={[W, H, D / 2]} radius={0.028} smoothness={3} position={[0, 0, -D / 4]} castShadow receiveShadow>
        <NintendoPlastic platform={platform} />
      </RoundedBox>
      <mesh position={[0, 0, 0.0012]} receiveShadow>
        <planeGeometry args={[W - 0.07, H - 0.07]} />
        <meshStandardMaterial color={p.caseInner} roughness={0.8} />
      </mesh>
      {/* support de cartouche : cadre à quatre bords, ouvert en haut pour la saisir */}
      {[
        [0, cy - fh / 2, fw + wall, wall],
        [-fw / 2, cy - 0.02, wall, fh - 0.04],
        [fw / 2, cy - 0.02, wall, fh - 0.04],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.012]} castShadow>
          <boxGeometry args={[w, h, 0.022]} />
          <meshStandardMaterial color={holder} roughness={0.4} transparent={p.translucency > 0} opacity={p.translucency > 0 ? 0.75 : 1} />
        </mesh>
      ))}
    </group>
  );
}

/** Couvercle d'un boîtier Nintendo (origine sur la charnière), avec les attaches de la notice. */
function NintendoLid({ platform }: { platform: Platform }) {
  const { w: W, h: H, d: D } = PLATFORMS[platform].size;
  const p = PLATFORMS[platform];
  const zc = -D / 4 + T / 2; // centre de la coque dans le repère du couvercle
  const inner = zc - D / 4 - 0.0012; // face intérieure
  const tab = p.translucency > 0 ? "#cfd8e2" : mix3(p.caseColor, 0.82);
  return (
    <group>
      <RoundedBox args={[W, H, D / 2]} radius={0.028} smoothness={3} position={[W / 2, 0, zc]} castShadow receiveShadow>
        <NintendoPlastic platform={platform} />
      </RoundedBox>
      <mesh position={[W / 2, 0, inner]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W - 0.07, H - 0.07]} />
        <meshStandardMaterial color={p.caseInner} roughness={0.8} />
      </mesh>
      {/* attaches de la notice, en haut et en bas */}
      {[H / 2 - 0.1, -H / 2 + 0.1].map((y) => (
        <mesh key={y} position={[W / 2, y, inner - 0.008]}>
          <boxGeometry args={[0.2, 0.03, 0.016]} />
          <meshStandardMaterial color={tab} roughness={0.4} transparent={p.translucency > 0} opacity={p.translucency > 0 ? 0.75 : 1} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Cartouche Switch / Switch 2 : corps arrondi (gris foncé ou rouge), bord de prise strié en haut,
 * étiquette à l'avant, contacts dorés en bas au dos.
 */
function GameCard({ label, color }: { label: THREE.Texture | null; color: string }) {
  const { w, h, d } = CART;
  return (
    <group>
      <RoundedBox args={[w, h, d]} radius={0.008} smoothness={3} castShadow>
        <meshStandardMaterial color={color} roughness={0.55} />
      </RoundedBox>
      {/* bord de prise : fines stries au-dessus de l'étiquette */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, h / 2 - 0.016 - i * 0.008, d / 2 + 0.0004]}>
          <planeGeometry args={[w - 0.05, 0.0025]} />
          <meshStandardMaterial color={mix3(color, 0.7)} roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, -0.016, d / 2 + 0.0006]}>
        <planeGeometry args={[w - 0.024, h - 0.072]} />
        <meshPhysicalMaterial key={label ? label.uuid : "blank"} map={label ?? undefined} color={label ? "#ffffff" : "#d5d9e2"} roughness={0.35} clearcoat={0.4} />
      </mesh>
      {/* contacts dorés, en bas au dos */}
      <mesh position={[0, -h / 2 + 0.03, -d / 2 - 0.0006]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w * 0.7, 0.026]} />
        <meshStandardMaterial color="#c8a24c" metalness={0.85} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Teinte plus sombre (k < 1) d'une couleur hexadécimale. */
function mix3(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}
