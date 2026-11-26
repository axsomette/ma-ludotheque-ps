import { ContactShadows, Environment, Lightformer, PresentationControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import { metaLine, mix } from "../lib/artUtils";
import { dominantColor } from "../lib/canvasArt";
import { coverSrc } from "./Library";
import { fetchDetails, fetchScans, needsDetails, ScansUnavailable, uploadPhoto, type PhotoKind } from "../lib/covers";
import { isDemo } from "../lib/supabase";
import { mediaName, PLATFORMS } from "../lib/platforms";
import { frenchDate, isLoaned, since, today } from "../lib/loans";
import { pruneFiles, updateGame } from "../lib/store";
import type { Game } from "../lib/types";
import { GameCase3D, type CaseMode } from "./GameCase3D";
import { MarketPanel } from "./MarketPanel";
import { Ps5Panel } from "./Ps5Panel";
import { DiscSpinner } from "./Logo";
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
  const [busy, setBusy] = useState<PhotoKind | "delete" | "details" | "scans" | "loan" | null>(null);
  const [borrower, setBorrower] = useState("");
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moreSummary, setMoreSummary] = useState(false);
  const backInput = useRef<HTMLInputElement>(null);
  const discInput = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const p = PLATFORMS[game.platform];
  // « disque » ou « cartouche » selon la console.
  const media = mediaName(game.platform);
  const Media = media[0].toUpperCase() + media.slice(1);
  const modes = MODES.map((m) => (m.id === "disc" ? { ...m, label: Media } : m));

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
      const url = await uploadPhoto(file, kind, kind === "disc" && media === "disque");
      const previous = kind === "back" ? game.back_url : game.disc_url;
      const updated = await updateGame(game.id, kind === "back" ? { back_url: url } : { disc_url: url });
      onUpdate(updated);
      void pruneFiles([previous]); // l'ancienne photo ne doit pas rester publique
      changeMode(kind === "back" ? "back" : "disc");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function completeDetails() {
    setBusy("details");
    setError(null);
    try {
      const patch = await fetchDetails(game);
      if (!patch) {
        setError(`« ${game.title} » n'a pas été retrouvé sur IGDB. Les infos restent telles quelles.`);
        return;
      }
      onUpdate(await updateGame(game.id, patch));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** Prête le jeu (nom saisi) ou le marque comme rendu (null). */
  async function setLoan(to: string | null) {
    setBusy("loan");
    setError(null);
    try {
      const updated = await updateGame(game.id, { loaned_to: to, loaned_at: to ? today() : null });
      onUpdate(updated);
      setBorrower("");
    } catch {
      setError("Le prêt n'a pas pu être enregistré. Réessaie.");
    } finally {
      setBusy(null);
    }
  }

  async function realScans() {
    setBusy("scans");
    setError(null);
    setScanNote(null);
    try {
      const patch = await fetchScans(game);
      if (!Object.keys(patch).length) {
        setScanNote(`Aucun scan de dos ou de ${media} trouvé pour ce jeu sur LaunchBox. Tu peux photographier les tiens.`);
        return;
      }
      const updated = await updateGame(game.id, patch);
      onUpdate(updated);
      changeMode(patch.back_url ? "back" : "disc");
      // Ce qui manque encore : on le dit, plutôt que de laisser le bouton sans explication.
      if (!updated.disc_url) setScanNote(`Dos récupéré. Pas de scan de la ${media === "disque" ? "face du disque" : "cartouche"} sur LaunchBox : photographie le tien si tu veux.`);
      else if (!updated.back_url) setScanNote(`${Media} récupéré${media === "cartouche" ? "e" : ""}. Pas de scan du dos pour ce jeu sur LaunchBox : photographie le tien si tu veux.`);
    } catch (e) {
      if (e instanceof ScansUnavailable) setScanNote(e.message);
      else setError((e as Error).message);
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
        <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.25, 5.6], fov: 32 }} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: import.meta.env.DEV }}>
          {/* Éclairage studio produit : lumière principale douce de face, contre-jour teinté, débouchage. */}
          <ambientLight intensity={0.9} />
          <directionalLight position={[2.5, 3.5, 6]} intensity={3.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
          <directionalLight position={[-5, 1.5, 3]} intensity={1.2} color="#dfe6ff" />
          <directionalLight position={[-3, 2, -4]} intensity={1.4} color={mix(tint, "#ffffff", 0.35)} />
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
              <Lightformer form="rect" intensity={4.2} position={[0, 4, 4]} scale={[9, 2, 1]} />
              <Lightformer form="rect" intensity={2.4} position={[0, -1, 6]} scale={[8, 1.2, 1]} />
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
          {modes.map(({ id, label, Icon }) => (
            <button key={id} className={`mode ${mode === id ? "on" : ""}`} aria-pressed={mode === id} onClick={() => changeMode(id)}>
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <p className="stage-hint">
          {mode === "disc"
            ? flipped
              ? media === "disque" ? "Face gravée · touche le disque pour le retourner" : "Dos de la cartouche · touche-la pour la retourner"
              : media === "disque" ? "Touche le disque pour voir sa face gravée" : "Touche la cartouche pour la retourner"
            : mode === "open"
              ? media === "disque" ? "Touche le disque pour le sortir · le boîtier pour le refermer" : "Touche la cartouche pour la sortir · le boîtier pour le refermer"
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
        {needsDetails(game) && (
          <div className="details-gap">
            <p className="muted small">Résumé, éditeur, genres ou captures manquent : ce jeu a été rangé avant leur ajout.</p>
            <button className="btn" onClick={completeDetails} disabled={busy !== null}>
              {busy === "details" ? <DiscSpinner size={20} /> : <IconFlip />}
              {busy === "details" ? "Recherche sur IGDB…" : "Compléter les infos"}
            </button>
          </div>
        )}
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

        <Ps5Panel game={game} />
        <MarketPanel game={game} onUpdate={onUpdate} />

        <section className={`photos loan ${isLoaned(game) ? "is-out" : ""}`} aria-labelledby="loan-title">
          <h3 id="loan-title">Prêt</h3>
          {isLoaned(game) ? (
            <>
              <p className="loan-who">
                Prêté à <strong>{game.loaned_to}</strong>
                {game.loaned_at && (
                  <span className="muted">
                    {" "}
                    · {since(game.loaned_at)}
                    {since(game.loaned_at).startsWith("depuis") ? ` (${frenchDate(game.loaned_at)})` : ""}
                  </span>
                )}
              </p>
              <button className="btn" onClick={() => void setLoan(null)} disabled={busy !== null}>
                {busy === "loan" ? <DiscSpinner size={20} /> : <IconCase />}
                Il me l'a rendu
              </button>
            </>
          ) : (
            <form
              className="loan-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (borrower.trim()) void setLoan(borrower.trim().slice(0, 80));
              }}
            >
              <label className="field">
                <span className="field-label">Prêter à</span>
                <input id="loan-to" value={borrower} onChange={(e) => setBorrower(e.target.value)} placeholder="Thomas" maxLength={80} autoComplete="off" enterKeyHint="done" />
              </label>
              <button className="btn" disabled={!borrower.trim() || busy !== null}>
                {busy === "loan" ? <DiscSpinner size={20} /> : <IconOpen />}
                Prêter
              </button>
            </form>
          )}
        </section>

        <section className="photos" aria-labelledby="photos-title">
          <h3 id="photos-title">Vrai dos, vrai{media === "cartouche" ? "e cartouche" : " disque"}</h3>
          {!isDemo && (!game.back_url || !game.disc_url) && (
            <>
              <p className="muted small">Récupère les vrais scans sur LaunchBox Games DB, version européenne en priorité.</p>
              <button className="btn" onClick={realScans} disabled={busy !== null}>
                {busy === "scans" ? <DiscSpinner size={20} /> : <IconDisc />}
                {busy === "scans" ? "Recherche des scans…" : "Récupérer les vrais scans"}
              </button>
              {scanNote && <p className="muted small" role="status">{scanNote}</p>}
            </>
          )}
          <p className="muted small">Ou remplace-les par tes propres photos.</p>
          <div className="photo-actions">
            <button className="btn" onClick={() => backInput.current?.click()} disabled={busy !== null}>
              <IconCamera />
              {busy === "back" ? "Envoi…" : game.back_url ? "Reprendre le dos" : "Photographier le dos"}
            </button>
            <button className="btn" onClick={() => discInput.current?.click()} disabled={busy !== null}>
              <IconDisc />
              {busy === "disc" ? "Envoi…" : game.disc_url ? `Reprendre ${media === "disque" ? "le disque" : "la cartouche"}` : `Photographier ${media === "disque" ? "le disque" : "la cartouche"}`}
            </button>
          </div>
          <input ref={backInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto("back", e.target.files?.[0])} />
          <input ref={discInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto("disc", e.target.files?.[0])} />
          {media === "disque" && <p className="muted small">Pour le disque, cadre-le bien au centre : la photo est recadrée en cercle.</p>}
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
