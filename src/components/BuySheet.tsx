import { useEffect, useRef, useState } from "react";
import { euros, fetchMarket, MarketNotConfigured, priceChartingUrl, type Estimate, type MarketResult } from "../lib/market";
import { PLATFORMS } from "../lib/platforms";
import type { CoverCandidate, Edition, Game, Platform } from "../lib/types";
import { BuyOffers } from "./BuyOffers";
import { IconClose } from "./icons";
import { DiscSpinner } from "./Logo";
import { Ps5Panel } from "./Ps5Panel";

interface Props {
  candidate: CoverCandidate;
  platform: Platform;
  /** Le même jeu s'il est déjà dans la collection. */
  owned: Game | null;
  onOpenOwned: (g: Game) => void;
  onClose: () => void;
}

const ROWS: Array<{ id: "new" | "cib" | "loose"; label: string }> = [
  { id: "new", label: "Neuf sous blister" },
  { id: "cib", label: "Occasion complet" },
  { id: "loose", label: "Disque seul" },
];

function Price({ e }: { e: Estimate | null | undefined }) {
  if (!e) return <span className="muted small">pas assez d'annonces</span>;
  return (
    <span>
      <strong className="mono">≈ {euros(e.value)}</strong>
      <span className="muted small"> · {euros(e.low)} à {euros(e.high)}</span>
    </span>
  );
}

/** Fiche d'achat d'un jeu trouvé depuis la barre de recherche : cote, meilleures offres, boutiques. */
export function BuySheet({ candidate, platform, owned, onOpenOwned, onClose }: Props) {
  const [edition, setEdition] = useState<Edition>("standard");
  const [result, setResult] = useState<MarketResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const game = { title: candidate.name, platform };

  useEffect(() => {
    let live = true;
    setBusy(true);
    setNote(null);
    fetchMarket({ ...game, edition })
      .then((r) => live && setResult(r))
      .catch((e) => live && setNote(e instanceof MarketNotConfigured ? e.message : (e as Error).message))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.igdb_id, candidate.name, platform, edition]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div ref={dialog} className="sheet buy-sheet" role="dialog" aria-modal="true" aria-labelledby="buy-title" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2 id="buy-title">Acheter moins cher</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <IconClose />
          </button>
        </header>

        <div className="buy-head">
          <img src={candidate.thumb_url} alt="" />
          <div>
            <p className="buy-name">{candidate.name}</p>
            <p className="muted small mono">{[PLATFORMS[platform].label, candidate.year, candidate.pegi ? `PEGI ${candidate.pegi}` : null].filter(Boolean).join(" · ")}</p>
            {owned && (
              <button className="text-btn" onClick={() => onOpenOwned(owned)}>
                Déjà dans ta ludothèque · voir le jeu
              </button>
            )}
          </div>
        </div>

        <section className="photos market" aria-labelledby="buy-price-title">
          <h3 id="buy-price-title">Cote du moment</h3>
          {(result?.collector_exists || edition === "collector") && (
            <div className="segmented small-seg" role="radiogroup" aria-label="Édition">
              {(["standard", "collector"] as Edition[]).map((e) => (
                <button key={e} role="radio" aria-checked={edition === e} className={edition === e ? "on" : ""} disabled={busy} onClick={() => setEdition(e)}>
                  {e === "standard" ? "Édition classique" : "Collector"}
                </button>
              ))}
            </div>
          )}
          {busy ? (
            <p className="value-line muted" role="status">
              <DiscSpinner size={18} /> Recherche des prix sur eBay France…
            </p>
          ) : note ? (
            <p className="muted small">{note}</p>
          ) : (
            <>
              <ul className="buy-prices">
                {ROWS.map((r) => (
                  <li key={r.id}>
                    <span className="small">{r.label}</span>
                    <Price e={result?.estimates?.[r.id]} />
                  </li>
                ))}
              </ul>
              <p className="muted small">D'après {result?.listings ?? 0} annonces eBay France, prix demandés hors aberrations.</p>
            </>
          )}
          <a className="text-btn" href={priceChartingUrl(game)} target="_blank" rel="noopener noreferrer">
            Comparer avec la cote PriceCharting
          </a>
        </section>

        <section className="photos market" aria-labelledby="buy-offers-title">
          <h3 id="buy-offers-title">Où l'acheter</h3>
          <BuyOffers game={game} offers={busy || note ? null : (result?.offers ?? null)} />
        </section>

        <Ps5Panel game={game} />
      </div>
    </div>
  );
}
