import { useEffect, useRef, useState } from "react";
import { CONDITIONS, conditionOf, euros, fetchMarket, MarketNotConfigured, parseEuros, priceChartingUrl, valuePatch, type MarketResult } from "../lib/market";
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

/** Cote du jeu (eBay France) selon son état et son édition, et prix personnels. */
export function MarketPanel({ game, onUpdate }: Props) {
  const [result, setResult] = useState<MarketResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState<string | null>(isDemo ? "L'estimation des prix n'est pas disponible en mode démo." : null);
  const auto = useRef<string | null>(null);
  const fmt = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));
  const [paid, setPaid] = useState(fmt(game.purchase_price));
  const [mine, setMine] = useState(fmt(game.manual_value));
  const [priceMsg, setPriceMsg] = useState<string | null>(null);

  useEffect(() => {
    setPaid(fmt(game.purchase_price));
    setMine(fmt(game.manual_value));
    setPriceMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.id]);

  async function savePrices() {
    const p = parseEuros(paid);
    const m = parseEuros(mine);
    if (p === undefined || m === undefined) {
      setPriceMsg("Montant invalide : écris par exemple 24,90.");
      return;
    }
    try {
      onUpdate(await updateGame(game.id, { purchase_price: p, manual_value: m }));
      setPriceMsg("Enregistré.");
    } catch {
      setPriceMsg("Les prix n'ont pas pu être enregistrés. Réessaie.");
    }
  }

  async function setEdition(e: Edition) {
    if (game.edition === e) return;
    if (notConfigured) onUpdate(await updateGame(game.id, { edition: e }).catch(() => ({ ...game, edition: e })));
    else void run({ edition: e });
  }

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
        <div className="edition-ask">
          {showEdition && <p className="small">Ce jeu existe en édition collector sur eBay. Laquelle as-tu ?</p>}
          <div className="segmented small-seg" role="radiogroup" aria-label="Édition de ton exemplaire">
            {(["standard", "collector"] as Edition[]).map((e) => (
              <button key={e} role="radio" aria-checked={game.edition === e} className={game.edition === e ? "on" : ""} disabled={busy} onClick={() => void setEdition(e)}>
                {e === "standard" ? "Édition classique" : "Collector"}
              </button>
            ))}
          </div>
        </div>

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

        <form
          className="my-prices"
          onSubmit={(e) => {
            e.preventDefault();
            void savePrices();
          }}
        >
          <p className="small offer-head">Mes prix</p>
          <div className="my-prices-row">
            <label className="field">
              <span className="field-label">Prix d'achat (€)</span>
              <input id="price-paid" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="ex. 24,90" autoComplete="off" />
            </label>
            <label className="field">
              <span className="field-label">Ma cote (€)</span>
              <input id="price-mine" inputMode="decimal" value={mine} onChange={(e) => setMine(e.target.value)} placeholder="facultatif" autoComplete="off" />
            </label>
          </div>
          <p className="muted small">« Ma cote » remplace l'estimation dans le total de la collection. Vide = estimation automatique.</p>
          {game.purchase_price != null && (game.manual_value ?? game.value_eur) != null && (
            <p className="small gain">
              {(() => {
                const d = Number(game.manual_value ?? game.value_eur) - Number(game.purchase_price);
                return d >= 0 ? `+ ${euros(d)} depuis l'achat` : `− ${euros(-d)} depuis l'achat`;
              })()}
            </p>
          )}
          <div className="my-prices-actions">
            <button className="btn">Enregistrer</button>
            <a className="text-btn" href={priceChartingUrl(game)} target="_blank" rel="noopener noreferrer">
              Voir la cote sur PriceCharting
            </a>
          </div>
          {priceMsg && (
            <p className="small" role="status">
              {priceMsg}
            </p>
          )}
        </form>
      </section>

    </>
  );
}
