import { useEffect, useRef, useState } from "react";
import { saveCover, searchCovers, uploadPhoto } from "../lib/covers";
import { DuplicateGameError, duplicateMessage, findDuplicate, type GameKey } from "../lib/duplicates";
import { readCover } from "../lib/ocr";
import { PLATFORMS, PLATFORM_ORDER } from "../lib/platforms";
import type { CoverCandidate, Game, NewGame, Platform } from "../lib/types";
import { IconCamera, IconClose, IconSearch } from "./icons";
import { DiscSpinner } from "./Logo";

interface Props {
  onClose: () => void;
  onAdd: (g: NewGame) => Promise<void>;
  /** Jeux déjà rangés, pour signaler les doublons avant l'ajout. */
  existing: readonly Game[];
  /** Ouvre un jeu déjà rangé (quand on tente de le ranger une deuxième fois). */
  onOpenExisting: (g: Game) => void;
}

type Step = "photo" | "reading" | "search" | "saving";

// Les trois temps de l'ajout, affichés comme une barre de progression segmentée.
const STAGES: Array<{ label: string; steps: Step[] }> = [
  { label: "Photo", steps: ["photo", "reading"] },
  { label: "Jeu", steps: ["search"] },
  { label: "Rangement", steps: ["saving"] },
];

/**
 * Ajout d'un jeu : photo → lecture du titre (dans le navigateur) →
 * recherche du jeu sur IGDB → choix → copie de la jaquette et des captures.
 */
export function AddGame({ onClose, onAdd, existing, onOpenExisting }: Props) {
  const [step, setStep] = useState<Step>("photo");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<Platform>("ps5");
  const [results, setResults] = useState<CoverCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Jeu déjà rangé correspondant au dernier choix (bouton « Voir le jeu »).
  const [duplicate, setDuplicate] = useState<Game | null>(null);
  // Verrou contre le double appui : deux ajouts simultanés créeraient un doublon.
  const busy = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && step !== "saving" && onClose();
    window.addEventListener("keydown", onKey);
    dialog.current?.querySelector<HTMLElement>("button, input")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, step]);

  async function onPhoto(file: File) {
    setError(null);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setStep("reading");
    setProgress(0);
    try {
      const r = await readCover(file, setProgress);
      const pf = r.platform ?? platform;
      if (r.platform) setPlatform(r.platform);
      setQuery(r.title);
      setStep("search");
      if (r.title) void runSearch(r.title, pf);
    } catch {
      setError("Le titre n'a pas pu être lu sur la photo. Tape-le ci-dessous.");
      setStep("search");
    }
  }

  async function runSearch(q = query, pf = platform) {
    if (!q.trim()) return;
    setSearching(true);
    setError(null);
    try {
      setResults(await searchCovers(q, pf));
    } catch (e) {
      setError((e as Error).message);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  /** Signale un doublon sans rien enregistrer. Renvoie true si le jeu est déjà rangé. */
  function blockDuplicate(key: GameKey): boolean {
    const dup = findDuplicate(existing, key);
    if (!dup) return false;
    setDuplicate(dup);
    setError(duplicateMessage(key));
    return true;
  }

  /** Échec d'un ajout : message, et bouton « Voir le jeu » si c'est un doublon détecté au dernier moment. */
  function fail(e: unknown) {
    setDuplicate(e instanceof DuplicateGameError ? e.existing : null);
    setError((e as Error).message);
    setStep("search");
  }

  async function choose(c: CoverCandidate) {
    if (busy.current) return;
    setDuplicate(null);
    setError(null);
    // Avant la copie de la jaquette : inutile de consommer le quota pour un jeu déjà rangé.
    if (blockDuplicate({ title: c.name, platform, igdb_id: c.igdb_id })) return;
    busy.current = true;
    setStep("saving");
    try {
      const { url, screenshots } = await saveCover(c, platform);
      await onAdd({
        title: c.name,
        platform,
        igdb_id: c.igdb_id,
        cover_url: url,
        release_year: c.year,
        summary: c.summary,
        publisher: c.publisher,
        genres: c.genres,
        pegi: c.pegi,
        screenshots,
        back_url: null,
        disc_url: null,
      });
      onClose();
    } catch (e) {
      fail(e);
    } finally {
      busy.current = false;
    }
  }

  async function usePhoto() {
    if (!photo || busy.current) return;
    const title = query.trim() || "Jeu sans titre";
    setDuplicate(null);
    setError(null);
    if (blockDuplicate({ title, platform, igdb_id: null })) return;
    busy.current = true;
    setStep("saving");
    try {
      const cover_url = await uploadPhoto(photo, "front");
      await onAdd({
        title,
        platform,
        igdb_id: null,
        cover_url,
        release_year: null,
        summary: null,
        publisher: null,
        genres: [],
        pegi: null,
        screenshots: [],
        back_url: null,
        disc_url: null,
      });
      onClose();
    } catch (e) {
      fail(e);
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="sheet-backdrop" onClick={() => step !== "saving" && onClose()}>
      <div ref={dialog} className="sheet" role="dialog" aria-modal="true" aria-labelledby="add-title" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 id="add-title">Ranger un jeu</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer" disabled={step === "saving"}>
            <IconClose />
          </button>
        </header>
        <ol className="stages" aria-label="Étapes">
          {STAGES.map((st, i) => {
            const current = STAGES.findIndex((x) => x.steps.includes(step));
            return (
              <li key={st.label} className={i < current ? "done" : i === current ? "now" : ""} aria-current={i === current ? "step" : undefined}>
                {st.label}
              </li>
            );
          })}
        </ol>

        {step === "photo" && (
          <div className="photo-step">
            <button className="photo-drop" onClick={() => fileInput.current?.click()}>
              <IconCamera width={34} height={34} />
              <strong>Photographier la jaquette</strong>
              <span className="muted">De face, avec le bandeau PS5, PS4 ou PS3 visible en haut.</span>
            </button>
            <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
            <button className="text-btn" onClick={() => setStep("search")}>
              Taper le titre à la place
            </button>
          </div>
        )}

        {step === "reading" && (
          <div className="reading" role="status">
            {preview && <img src={preview} alt="Photo de la jaquette" className="photo-preview" />}
            <p>Lecture du titre sur la photo… {Math.round(progress * 100)} %</p>
            <div className="bar" aria-hidden>
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}

        {(step === "search" || step === "saving") && (
          <div className="search-step">
            <form
              className="search-row"
              onSubmit={(e) => {
                e.preventDefault();
                void runSearch();
              }}
            >
              {preview && <img src={preview} alt="" className="photo-thumb" />}
              <label className="field">
                <span className="field-label">Titre du jeu</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Gran Turismo 7" autoFocus enterKeyHint="search" />
              </label>
              <button className="btn primary" disabled={!query.trim() || searching || step === "saving"} aria-label="Chercher">
                <IconSearch />
                <span className="hide-sm">Chercher</span>
              </button>
            </form>
            <div className="segmented" role="radiogroup" aria-label="Plateforme">
              {PLATFORM_ORDER.map((pf) => (
                <button
                  key={pf}
                  role="radio"
                  aria-checked={platform === pf}
                  className={platform === pf ? "on" : ""}
                  onClick={() => {
                    setPlatform(pf);
                    if (query.trim()) void runSearch(query, pf);
                  }}
                >
                  {PLATFORMS[pf].label}
                </button>
              ))}
            </div>

            {error && (
              <div className="error-row">
                <p className="error" role="alert">
                  {error}
                </p>
                {duplicate && (
                  <button
                    className="btn ghost"
                    onClick={() => {
                      onOpenExisting(duplicate);
                      onClose();
                    }}
                  >
                    Voir le jeu
                  </button>
                )}
              </div>
            )}

            {step === "saving" && (
              <div className="saving" role="status">
                <DiscSpinner />
                <span>Copie de la jaquette et des captures…</span>
              </div>
            )}
            {searching && (
              <div className="saving" role="status">
                <DiscSpinner />
                <span>Recherche du jeu…</span>
              </div>
            )}

            {results && results.length === 0 && !searching && step !== "saving" && (
              <p className="muted">Aucun jeu trouvé pour « {query} ». Vérifie l'orthographe, essaie une autre plateforme, ou garde ta photo comme jaquette.</p>
            )}
            {results && results.length > 0 && step !== "saving" && !searching && (
              <>
                <p className="muted small">Choisis la bonne édition :</p>
                <ul className="results">
                  {results.map((c) => {
                    const owned = !!findDuplicate(existing, { title: c.name, platform, igdb_id: c.igdb_id });
                    return (
                      <li key={`${c.igdb_id}-${c.name}`} className={owned ? "owned" : undefined}>
                        <button onClick={() => choose(c)} aria-label={owned ? `${c.name}, déjà dans ta ludothèque` : undefined}>
                          <span className="r-cover">
                            <img src={c.thumb_url} alt="" loading="lazy" />
                            {owned && <span className="r-owned">Déjà rangé</span>}
                          </span>
                          <span className="r-name">{c.name}</span>
                          <span className="r-meta mono">{[c.year, c.pegi ? `PEGI ${c.pegi}` : null].filter(Boolean).join(" · ")}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {photo && step !== "saving" && (
              <button className="btn ghost" onClick={usePhoto}>
                <IconCamera />
                Garder ma photo comme jaquette
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
