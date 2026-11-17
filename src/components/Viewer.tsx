import { ContactShadows, Environment, Lightformer, PresentationControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import { metaLine, mix } from "../lib/artUtils";
import { dominantColor } from "../lib/canvasArt";
import { coverSrc } from "./Library";
import { uploadPhoto, type PhotoKind } from "../lib/covers";
import { PLATFORMS } from "../lib/platforms";
import { updateGame } from "../lib/store";
import type { Game } from "../lib/types";
import { GameCase3D, type CaseMode } from "./GameCase3D";
import { IconBack, IconCamera, IconCase, IconDisc, IconFlip, IconOpen, IconTrash } from "./icons";

interface Props {
  game: Game;
  /** Geste demandé depuis l'accueil : prendre en main, ouvrir, ou sortir le disque. */
  initialMode?: CaseMode;
  onClose: () => void;
  onDelete: (g: Game) => Promise<void>;
  onUpdate: (g: Game) => void;
}

/** Recule la caméra sur les écrans étroits pour que le boîtier ouvert tienne dans le cadre. */
function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const aspect = size.width / size.height;
    const dist = aspect < 0.7 ? 8.2 : aspect < 1.05 ? 6.6 : 6.2;
    // Visée un peu sous le boîtier : il remonte et laisse la place à la barre de boutons en bas.
    camera.position.set(0, 0.05, dist);
    camera.lookAt(0, -0.32, 0);
  }, [camera, size.width, size.height]);
  return null;
}

const MODES: Array<{ id: CaseMode; label: string; Icon: typeof IconCase; key: string }> = [
  { id: "front", label: "Face", Icon: IconCase, key: "f" },
  { id: "back", label: "Dos", Icon: IconFlip, key: "d" },
  { id: "open", label: "Ouvrir", Icon: IconOpen, key: "o" },
  { id: "disc", label: "Disque", Icon: IconDisc, key: "x" },
];

/**
 * Vue d'un jeu : on prend le boîtier en main (glisser), on le retourne, on l'ouvre,
 * on sort le disque et on le retourne pour voir sa face gravée.
 */
export function Viewer({ game, initialMode = "front", onClose, onDelete, onUpdate }: Props) {
  const [mode, setMode] = useState<CaseMode>(initialMode);
  const [flipped, setFlipped] = useState(false);
  const [tint, setTint] = useState("#2a3558");
  const [busy, setBusy] = useState<PhotoKind | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moreSummary, setMoreSummary] = useState(false);
  const backInput = useRef<HTMLInputElement>(null);
  const discInput = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const p = PLATFORMS[game.platform];

  useEffect(() => {
    let alive = true;
    dominantColor(coverSrc(game)).then((c) => alive && setTint(c));
    return () => {
      alive = false;
    };
  }, [game]);

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      if (e.key === "Escape") onClose();
      const m = MODES.find((x) => x.key === e.key.toLowerCase());
      if (m) setMode(m.id);
      if (e.key === " ") {
        e.preventDefault();
        setMode((cur) => (cur === "front" || cur === "back" ? "open" : "front"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function changeMode(m: CaseMode) {
    if (m !== "disc") setFlipped(false);
    setMode(m);
  }

  async function onPhoto(kind: "back" | "disc", file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    setError(null);
    try {
      const url = await uploadPhoto(file, kind);
      const updated = await updateGame(game.id, kind === "back" ? { back_url: url } : { disc_url: url });
      onUpdate(updated);
      changeMode(kind === "back" ? "back" : "disc");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const glow = mix(tint, "#07090f", 0.4);
  const summary = game.summary ?? "";
  const longSummary = summary.length > 280;

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-labelledby="viewer-title" style={{ ["--glow" as string]: glow }}>
      <div className="viewer-stage">
        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.25, 5.6], fov: 32 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[3, 4, 6]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-4, 2, -3]} intensity={1.1} color={mix(tint, "#ffffff", 0.4)} />
          <Suspense fallback={null}>
            <PresentationControls global snap speed={1.6} polar={[-0.45, 0.45]} azimuth={[-1.2, 1.2]} cursor>
              <GameCase3D
                game={game}
                mode={mode}
                discFlipped={flipped}
                tint={tint}
                onCaseClick={() => changeMode(mode === "front" || mode === "back" ? "open" : "front")}
                onDiscClick={() => (mode === "disc" ? setFlipped((f) => !f) : changeMode("disc"))}
              />
            </PresentationControls>
            {/* éclairage studio généré localement : aucun fichier HDR à télécharger */}
            <Environment resolution={256}>
              <Lightformer form="rect" intensity={3.2} position={[0, 4, 4]} scale={[9, 2, 1]} />
              <Lightformer form="rect" intensity={1.6} color={mix(tint, "#ffffff", 0.5)} position={[-5, 1, 1]} scale={[3, 6, 1]} />
              <Lightformer form="ring" intensity={2.2} position={[4, 1, 3]} scale={2} />
            </Environment>
          </Suspense>
          <ContactShadows position={[0, -1.02, 0]} opacity={0.5} scale={7} blur={2.8} far={2.6} />
          <FitCamera />
        </Canvas>

        <button className="icon-btn viewer-back" onClick={onClose} aria-label="Revenir à la ludothèque">
          <IconBack />
        </button>

        <div className="mode-bar" role="toolbar" aria-label="Manipuler le boîtier">
          {MODES.map(({ id, label, Icon }) => (
            <button key={id} className={`mode ${mode === id ? "on" : ""}`} aria-pressed={mode === id} onClick={() => changeMode(id)}>
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <p className="stage-hint">
          {mode === "disc"
            ? flipped
              ? "Face gravée · touche le disque pour le retourner"
              : "Touche le disque pour voir sa face gravée"
            : mode === "open"
              ? "Touche le disque pour le sortir · le boîtier pour le refermer"
              : "Glisse pour tourner le boîtier · touche-le pour l'ouvrir"}
        </p>
      </div>

      <aside className="viewer-panel">
        <span className="tag" style={{ background: p.bandColor, color: p.bandText }}>
          {p.label}
        </span>
        <h2 id="viewer-title" className="viewer-title" ref={titleRef} tabIndex={-1}>
          {game.title}
        </h2>
        <p className="hero-meta mono">{metaLine([game.release_year, game.pegi ? `PEGI ${game.pegi}` : null, game.publisher])}</p>
        {game.genres.length > 0 && (
          <ul className="genres" aria-label="Genres">
            {game.genres.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        )}
        {summary && (
          <div className="summary">
            <p lang="en" className={moreSummary || !longSummary ? "" : "clamped"}>
              {summary}
            </p>
            {longSummary && (
              <button className="text-btn" onClick={() => setMoreSummary((v) => !v)} aria-expanded={moreSummary}>
                {moreSummary ? "Réduire" : "Lire la suite"}
              </button>
            )}
          </div>
        )}

        <section className="photos" aria-labelledby="photos-title">
          <h3 id="photos-title">Photos du vrai boîtier</h3>
          <p className="muted small">Remplace le dos et le disque générés par tes propres photos.</p>
          <div className="photo-actions">
            <button className="btn" onClick={() => backInput.current?.click()} disabled={busy !== null}>
              <IconCamera />
              {busy === "back" ? "Envoi…" : game.back_url ? "Reprendre le dos" : "Photographier le dos"}
            </button>
            <button className="btn" onClick={() => discInput.current?.click()} disabled={busy !== null}>
              <IconDisc />
              {busy === "disc" ? "Envoi…" : game.disc_url ? "Reprendre le disque" : "Photographier le disque"}
            </button>
          </div>
          <input ref={backInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto("back", e.target.files?.[0])} />
          <input ref={discInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto("disc", e.target.files?.[0])} />
          <p className="muted small">Pour le disque, cadre-le bien au centre : la photo est recadrée en cercle.</p>
        </section>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button
          className="btn danger-link"
          disabled={busy !== null}
          onClick={async () => {
            if (!confirm(`Retirer « ${game.title} » de ta ludothèque ?`)) return;
            setBusy("delete");
            try {
              await onDelete(game);
            } catch (e) {
              setError((e as Error).message);
              setBusy(null);
            }
          }}
        >
          <IconTrash />
          {busy === "delete" ? "Suppression…" : "Retirer de la collection"}
        </button>
      </aside>
    </div>
  );
}
