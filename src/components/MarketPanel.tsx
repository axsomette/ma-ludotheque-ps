import { useEffect, useRef, useState } from "react";
import { CONDITIONS, conditionOf, euros, fetchMarket, MarketNotConfigured, storeLinks, valuePatch, type MarketResult, type Offer } from "../lib/market";
import { since } from "../lib/loans";
import { updateGame } from "../lib/store";
import { isDemo } from "../lib/supabase";
import type { Condition, Edition, Game } from "../lib/types";
import { DiscSpinner } from "./Logo";

interface Props {
  game: Game;
  onUpdate: (g: Game) => void;
}

const WEEK = 7 * 86_400_000;
const CONFIDENCE = { high: "fiable", medium: "indicative", low: "à prendre avec prudence" } as const;

function OfferRow({ o }: { o: Offer }) {
  return (
    <li>
      <a href={o.url} target="_blank" rel="noopener noreferrer" className="offer">
        <span className="offer-price mono">{euros(o.price, 2)}</span>
        <span className="offer-ship muted small">{o.shipping == null ? "port à voir" : o.shipping === 0 ? "port offert" : `+ ${euros(o.shipping, 2)} de port`}</span>
        <span className="offer-title small">{o.title}</span>
        <span className="offer-seller muted small">
          {o.seller ?? "vendeur"} {o.feedback != null ? `· ${o.feedback.toLocaleString("fr-FR")} % d'avis positifs` : ""}
        </span>
      </a>
    </li>
  );
}

/** Cote du jeu (eBay France) selon son état et son édition, et où l'acheter moins cher. */
export function MarketPanel({ game, onUpdate }: Props) {
  const [result, setResult] = useState<MarketResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState<string | null>(isDemo ? "L'estimation des prix n'est pas disponible en mode démo." : null);
  const auto = useRef<string | null>(null);

  async function run(next: Partial<Pick<Game, "condition" | "edition">> = {}) {
    if (isDemo) return;
    setBusy(true);
    setError(null);
    const target = { ...game, ...next };
    try {
      const r = await fetchMarket(target);
      setResult(r);
      onUpdate(await updateGame(game.id, { ...next, ...valuePatch(r) }));
    } catch (e) {
      if (e instanceof MarketNotConfigured) setNotConfigured(e.message);
      else setError((e as Error).message);
      if (Object.keys(next).length) onUpdate(await updateGame(game.id, next).catch(() => ({ ...game, ...next })));
    } finally {
      setBusy(false);
    }
  }

  // Estimation automatique à l'ouverture si la cote n'existe pas ou date de plus d'une semaine.
  useEffect(() => {
    if (auto.current === game.id) return;
    auto.current = game.id;
    setResult(null);
    if (!isDemo && (!game.value_at || Date.now() - new Date(game.value_at).getTime() > WEEK)) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  const cond = conditionOf(game);
  const showEdition = game.edition === "collector" || result?.collector_exists;
  const links = storeLinks(game);

  return (
    <>
      <section className="photos market" aria-labelledby="value-title">
        <h3 id="value-title">Valeur</h3>
        <div className="segmented small-seg" role="radiogroup" aria-label="État de ton exemplaire">
          {CONDITIONS.map((c) => (
            <button key={c.id} role="radio" aria-checked={cond === c.id} className={cond === c.id ? "on" : ""} disabled={busy} title={c.hint} onClick={() => cond !== c.id && void run({ condition: c.id as Condition })}>
              {c.label}
            </button>
          ))}
        </div>
        {showEdition && (
          <div className="edition-ask">
            <p className="small">Ce jeu existe en édition collector. Laquelle as-tu ?</p>
            <div className="segmented small-seg" role="radiogroup" aria-label="Édition">
              {(["standard", "collector"] as Edition[]).map((e) => (
                <button key={e} role="radio" aria-checked={game.edition === e} className={game.edition === e ? "on" : ""} disabled={busy} onClick={() => game.edition !== e && void run({ edition: e })}>
                  {e === "standard" ? "Classique" : "Collector"}
                </button>
              ))}
            </div>
          </div>
        )}

        {busy ? (
          <p className="value-line muted" role="status">
            <DiscSpinner size={18} /> Estimation en cours sur eBay France…
          </p>
        ) : game.value_eur != null ? (
          <div className="value-box">
            <p className="value-main">
              ≈ <strong>{euros(Number(game.value_eur))}</strong>
            </p>
            <p className="muted small">
              Entre {euros(Number(game.value_low ?? game.value_eur))} et {euros(Number(game.value_high ?? game.value_eur))}
              {result?.estimate ? ` · estimation ${CONFIDENCE[result.estimate.confidence]}` : ""}
            </p>
            <p className="muted small">
              {result?.estimate?.basis ?? `D'après ${game.value_n ?? 0} annonces eBay France`}
              {game.value_at ? ` · mise à jour ${since(game.value_at.slice(0, 10))}` : ""}
            </p>
          </div>
        ) : notConfigured ? (
          <p className="muted small">{notConfigured}</p>
        ) : game.value_at ? (
          <p className="muted small">Pas assez d'annonces sur eBay France pour estimer ce jeu dans cet état.</p>
        ) : (
          <p className="muted small">Pas encore estimé.</p>
        )}
        {!notConfigured && (
          <button className="btn" onClick={() => void run()} disabled={busy}>
            {game.value_at ? "Actualiser l'estimation" : "Estimer la valeur"}
          </button>
        )}
        {error && (
          <p className="error small" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="photos market" aria-labelledby="buy-title">
        <h3 id="buy-title">Acheter moins cher</h3>
        {result && (result.offers.new.length > 0 || result.offers.used.length > 0) ? (
          <>
            {result.offers.new.length > 0 && (
              <>
                <p className="small offer-head">Neuf · vendeurs eBay bien notés</p>
                <ul className="offers">{result.offers.new.map((o) => <OfferRow key={o.url} o={o} />)}</ul>
              </>
            )}
            {result.offers.used.length > 0 && (
              <>
                <p className="small offer-head">Occasion · vendeurs eBay bien notés</p>
                <ul className="offers">{result.offers.used.map((o) => <OfferRow key={o.url} o={o} />)}</ul>
              </>
            )}
          </>
        ) : result ? (
          <p className="muted small">Aucune offre de vendeur bien noté sur eBay France pour l'instant.</p>
        ) : null}
        <p className="muted small">Comparer dans les boutiques françaises reconnues :</p>
        <ul className="stores">
          {links.map((l) => (
            <li key={l.name}>
              <a href={l.url} target="_blank" rel="noopener noreferrer">
                <strong>{l.name}</strong>
                <span className="muted small">{l.kind}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
