import { useEffect, useRef, useState } from "react";
import { saveCover, savePhotoAsCover, searchCovers } from "../lib/covers";
import { readCover } from "../lib/ocr";
import { PLATFORMS, PLATFORM_ORDER } from "../lib/platforms";
import type { CoverCandidate, NewGame, Platform } from "../lib/types";

interface Props {
  onClose: () => void;
  onAdd: (g: NewGame) => Promise<void>;
}

type Step = "photo" | "reading" | "search" | "saving";

/**
 * Ajout d'un jeu : photo → lecture du titre (dans le navigateur) →
 * recherche de la jaquette officielle → choix → enregistrement.
 */
export function AddGame({ onClose, onAdd }: Props) {
  const [step, setStep] = useState<Step>("photo");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<Platform>("ps5");
  const [results, setResults] = useState<CoverCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function onPhoto(file: File) {
    setError(null);
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setStep("reading");
    setProgress(0);
    try {
      const r = await readCover(file, setProgress);
      if (r.platform) setPlatform(r.platform);
      setQuery(r.title);
      setStep("search");
      if (r.title) void runSearch(r.title, r.platform ?? platform);
    } catch (e) {
      setError(`Lecture de la photo impossible (${(e as Error).message}). Tape le titre à la main.`);
      setStep("search");
    }
  }

  async function runSearch(q = query, pf = platform) {
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

  async function choose(c: CoverCandidate) {
    setStep("saving");
    setError(null);
    try {
      const cover_url = await saveCover(c, platform);
      await onAdd({ title: c.name, platform, igdb_id: c.igdb_id, cover_url, release_year: c.year });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setStep("search");
    }
  }

  async function usePhoto() {
    if (!photo) return;
    setStep("saving");
    try {
      const cover_url = await savePhotoAsCover(photo);
      await onAdd({ title: query.trim() || "Jeu sans titre", platform, igdb_id: null, cover_url, release_year: null });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setStep("search");
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Ajouter un jeu" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>Ajouter un jeu</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>

        {step === "photo" && (
          <div className="photo-step">
            <button className="photo-drop" onClick={() => fileInput.current?.click()}>
              <span className="photo-icon" aria-hidden>
                📷
              </span>
              <strong>Prendre la jaquette en photo</strong>
              <span className="muted">Face avant, bien droite, avec le bandeau PS5 / PS4 / PS3 visible</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])}
            />
            <button className="btn link" onClick={() => setStep("search")}>
              … ou taper le titre
            </button>
          </div>
        )}

        {step === "reading" && (
          <div className="reading">
            {preview && <img src={preview} alt="Photo de la jaquette" className="photo-preview" />}
            <p>Lecture du titre… {Math.round(progress * 100)} %</p>
            <div className="bar">
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
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titre du jeu" aria-label="Titre du jeu" autoFocus />
              <button className="btn primary" disabled={!query.trim() || searching}>
                {searching ? "…" : "Chercher"}
              </button>
            </form>
            <div className="chips" role="radiogroup" aria-label="Plateforme">
              {PLATFORM_ORDER.map((pf) => (
                <button
                  key={pf}
                  role="radio"
                  aria-checked={platform === pf}
                  className={`chip ${platform === pf ? "on" : ""}`}
                  onClick={() => {
                    setPlatform(pf);
                    if (query.trim()) void runSearch(query, pf);
                  }}
                >
                  {PLATFORMS[pf].label}
                </button>
              ))}
            </div>

            {error && <p className="error">{error}</p>}
            {step === "saving" && <p className="muted">Enregistrement de la jaquette…</p>}

            {results && results.length === 0 && !searching && <p className="muted">Aucun jeu trouvé. Corrige le titre, ou garde ta photo comme jaquette.</p>}
            {results && results.length > 0 && (
              <ul className="results">
                {results.map((c) => (
                  <li key={`${c.igdb_id}-${c.name}`}>
                    <button onClick={() => choose(c)} disabled={step === "saving"}>
                      <img src={c.thumb_url} alt="" loading="lazy" />
                      <span>{c.name}</span>
                      {c.year && <small>{c.year}</small>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {photo && (
              <button className="btn ghost" onClick={usePhoto} disabled={step === "saving"}>
                Garder ma photo comme jaquette
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
