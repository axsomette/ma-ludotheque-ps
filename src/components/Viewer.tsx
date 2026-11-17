import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";
import { PLATFORMS } from "../lib/platforms";
import type { Game } from "../lib/types";
import { GameCase3D } from "./GameCase3D";

interface Props {
  game: Game;
  onClose: () => void;
  onDelete: (g: Game) => void;
}

/** Recule la caméra sur les écrans étroits (téléphone en portrait) pour que le boîtier ouvert tienne. */
function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    const dist = aspect < 0.75 ? 8.2 : aspect < 1.1 ? 6.4 : 5.4;
    camera.position.set(0.3, 0.35, dist);
    camera.lookAt(0.3, 0.2, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

/** Vue plein écran d'un jeu : boîtier 3D qui s'ouvre au clic, disque qui sort et tourne. */
export function Viewer({ game, onClose, onDelete }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 700); // ouverture automatique à l'arrivée
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " " || e.key === "Enter") setOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const p = PLATFORMS[game.platform];

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={game.title}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0.4, 0.15, 4.4], fov: 34 }} gl={{ antialias: true }}>
        <color attach="background" args={["#07080c"]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 4, 5]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
        <Suspense fallback={null}>
          <GameCase3D game={game} open={open} onToggle={() => setOpen((o) => !o)} />
          {/* éclairage studio généré localement : aucun fichier HDR à télécharger */}
          <Environment resolution={256}>
            <Lightformer form="rect" intensity={3} position={[0, 4, 3]} scale={[8, 2, 1]} />
            <Lightformer form="rect" intensity={1.5} color="#7aa2ff" position={[-5, 1, 1]} scale={[3, 6, 1]} />
            <Lightformer form="ring" intensity={2} position={[4, 1, 2]} scale={2} />
          </Environment>
        </Suspense>
        <FitCamera />
        <ContactShadows position={[0, -0.8, 0]} opacity={0.55} scale={6} blur={2.6} far={2.5} />
        <OrbitControls makeDefault target={[0.3, 0.2, 0]} enablePan={false} minDistance={2.6} maxDistance={10} minPolarAngle={0.6} maxPolarAngle={2.3} />
      </Canvas>

      <div className="viewer-ui">
        <div className="viewer-info">
          <span className="badge" style={{ background: p.bandColor, color: p.bandText }}>
            {p.label}
          </span>
          <h2>{game.title}</h2>
          {game.release_year && <p className="muted">{game.release_year}</p>}
        </div>
        <div className="viewer-actions">
          <button className="btn primary" onClick={() => setOpen((o) => !o)}>
            {open ? "Fermer le boîtier" : "Ouvrir le boîtier"}
          </button>
          <button
            className="btn ghost danger"
            onClick={() => {
              if (confirm(`Retirer « ${game.title} » de la collection ?`)) onDelete(game);
            }}
          >
            Retirer
          </button>
          <button className="btn ghost" onClick={onClose} aria-label="Fermer">
            Fermer ✕
          </button>
        </div>
        <p className="hint">Clique sur le boîtier pour l'ouvrir · fais-le tourner en glissant</p>
      </div>
    </div>
  );
}
