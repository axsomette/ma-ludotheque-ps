import { useEffect, useRef, useState } from "react";
import { findDeals, type StoreDeal } from "../lib/deals";
import { since } from "../lib/loans";
import { euros, fetchMarket, MarketNotConfigured, priceChartingUrl, storeLinks, type Estimate, type MarketResult } from "../lib/market";
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
  const [noEbay, setNoEbay] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const [deals, setDeals] = useState<StoreDeal[] | null>(null);
  const [dealsError, setDealsError] = useState<string | null>(null);
  const game = { title: candidate.name, platform };

  useEffect(() => {
    let live = true;
    setBusy(true);
    setNote(null);
    fetchMarket({ ...game, edition })
      .then((r) => live && setResult(r))
      .catch((e) => {
        if (!live) return;
        if (e instanceof MarketNotConfigured) setNoEbay(true);
        else setNote((e as Error).message);
      })
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate.igdb_id, candidate.name, platform, edition]);

  // Prix repérés boutique par boutique (bons plans Dealabs), indépendants d'eBay.
  useEffect(() => {
    let live = true;
    setDeals(null);
    setDealsError(null);
    findDeals(candidate.name, platform, edition)
      .then((d) => live && setDeals(d))
      .catch((e) => live && setDealsError((e as Error).message));
    return () => {
      live = false;
    };
  }, [candidate.name, platform, edition]);

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

        <section className="photos market" aria-labelledby="buy-deals-title">
          <h3 id="buy-deals-title">Prix par boutique</h3>
          {deals === null && !dealsError ? (
            <p className="value-line muted" role="status">
              <DiscSpinner size={18} /> Recherche des prix…
            </p>
          ) : dealsError ? (
            <p className="muted small">{dealsError}</p>
          ) : deals!.length === 0 ? (
            <p className="muted small">Aucune promo repérée pour ce jeu ces 90 derniers jours. Les prix se mettent à jour chaque heure : en attendant, compare directement sur les boutiques ci-dessous.</p>
          ) : (
            <>
              <ul className="deal-list">
                {deals!.map((d, i) => (
                  <li key={d.id}>
                    <a href={d.link} target="_blank" rel="noopener noreferrer" className={`deal ${d.is_expired ? "is-expired" : i === 0 ? "is-best" : ""}`}>
                      <span className="deal-merchant">{d.merchant ?? "Boutique"}</span>
                      <span className="deal-price mono">{d.price === 0 ? "Gratuit" : euros(d.price, 2)}</span>
                      <span className="deal-meta muted small">
                        {d.is_expired ? "Promo terminée · " : i === 0 ? "Meilleur prix · " : ""}repéré {since(d.published_at.slice(0, 10))}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="muted small">Prix repérés sur Dealabs (bons plans de la communauté) : une promo peut avoir pris fin, vérifie sur le site.</p>
            </>
          )}
          <p className="store-links small">
            <span className="muted">Pas le bon prix ? Voir sur </span>
            {storeLinks(game)
              .filter((l) => l.name !== "Dealabs")
              .map((l, i, all) => (
                <span key={l.name}>
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.name}
                  </a>
                  {i < all.length - 1 ? " · " : ""}
                </span>
              ))}
          </p>
          {result?.offers && <BuyOffers game={game} offers={result.offers} withStores={false} />}
        </section>

        {!noEbay && (
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
        )}


        <Ps5Panel game={game} />
      </div>
    </div>
  );
}
