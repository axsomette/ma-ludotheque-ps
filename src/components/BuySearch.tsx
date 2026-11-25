import { useEffect, useState } from "react";
import { searchCovers } from "../lib/covers";
import { findDuplicate } from "../lib/duplicates";
import { PLATFORMS, PLATFORM_ORDER } from "../lib/platforms";
import type { CoverCandidate, Game, Platform } from "../lib/types";
import { BuySheet } from "./BuySheet";
import { IconSearch } from "./icons";
import { DiscSpinner } from "./Logo";

interface Props {
  query: string;
  games: readonly Game[];
  initialPlatform: Platform;
  onOpenOwned: (g: Game) => void;
}

/** Sous les résultats de la barre de recherche : chercher n'importe quel jeu pour l'acheter au meilleur prix. */
export function BuySearch({ query, games, initialPlatform, onOpenOwned }: Props) {
  const [platform, setPlatform] = useState<Platform>(initialPlatform);
  const [results, setResults] = useState<CoverCandidate[] | null>(null);
  const [searched, setSearched] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<CoverCandidate | null>(null);
  const q = query.trim();

  useEffect(() => setPlatform(initialPlatform), [initialPlatform]);

  async function run(pf = platform) {
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await searchCovers(q, pf));
      setSearched(q);
    } catch (e) {
      setError((e as Error).message);
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  if (!q) return null;
  const stale = results && searched !== q;

  return (
    <section className="buy-search" aria-labelledby="buy-search-title">
      <h2 id="buy-search-title" className="buy-search-title">
        Acheter « {q} » au meilleur prix
      </h2>
      <div className="buy-search-row">
        <div className="segmented small-seg" role="radiogroup" aria-label="Plateforme">
          {PLATFORM_ORDER.map((pf) => (
            <button
              key={pf}
              role="radio"
              aria-checked={platform === pf}
              className={platform === pf ? "on" : ""}
              onClick={() => {
                setPlatform(pf);
                if (results) void run(pf);
              }}
            >
              {PLATFORMS[pf].label}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={() => void run()} disabled={busy}>
          {busy ? <DiscSpinner size={20} /> : <IconSearch />}
          {results && !stale ? "Relancer" : "Chercher les prix"}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {results && !stale && results.length === 0 && <p className="muted">Aucun jeu trouvé pour « {searched} » sur {PLATFORMS[platform].label}.</p>}
      {results && !stale && results.length > 0 && (
        <>
          <p className="muted small">Choisis le jeu pour voir sa cote et les meilleures offres :</p>
          <ul className="results">
            {results.map((c) => {
              const owned = !!findDuplicate(games, { title: c.name, platform, igdb_id: c.igdb_id });
              return (
                <li key={`${c.igdb_id}-${c.name}`} className={owned ? "owned" : undefined}>
                  <button onClick={() => setPicked(c)}>
                    <span className="r-cover">
                      <img src={c.thumb_url} alt="" loading="lazy" />
                      {owned && <span className="r-owned">Déjà rangé</span>}
                    </span>
                    <span className="r-name">{c.name}</span>
                    {c.local_name && <span className="r-alt">« {c.local_name} »</span>}
                    <span className="r-meta mono">{[c.year, c.pegi ? `PEGI ${c.pegi}` : null].filter(Boolean).join(" · ")}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {picked && (
        <BuySheet
          candidate={picked}
          platform={platform}
          owned={findDuplicate(games, { title: picked.name, platform, igdb_id: picked.igdb_id })}
          onOpenOwned={(g) => {
            setPicked(null);
            onOpenOwned(g);
          }}
          onClose={() => setPicked(null)}
        />
      )}
    </section>
  );
}
