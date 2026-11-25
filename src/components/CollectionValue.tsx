import { useRef, useState } from "react";
import { collectionValue, euros, fetchMarket, MarketNotConfigured, MarketQuotaReached, valuePatch } from "../lib/market";
import { updateGame } from "../lib/store";
import type { Game } from "../lib/types";
import { DiscSpinner } from "./Logo";

interface Props {
  games: readonly Game[];
  onUpdated: (g: Game) => void;
}

const WEEK = 7 * 86_400_000;

/** Valeur totale de la collection et estimation de tous les jeux d'un coup. */
export function CollectionValue({ games, onUpdated }: Props) {
  const [progress, setProgress] = useState<{ done: number; total: number; title: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const stop = useRef(false);
  const v = collectionValue(games);
  const todo = games.filter((g) => !g.value_at || Date.now() - new Date(g.value_at).getTime() > WEEK);

  async function run() {
    stop.current = false;
    setNote(null);
    let ok = 0, failed = 0;
    for (let i = 0; i < todo.length; i++) {
      if (stop.current) break;
      const g = todo[i];
      setProgress({ done: i, total: todo.length, title: g.title });
      try {
        const r = await fetchMarket(g);
        onUpdated(await updateGame(g.id, valuePatch(r)));
        ok++;
      } catch (e) {
        if (e instanceof MarketNotConfigured || e instanceof MarketQuotaReached) {
          setNote((e as Error).message);
          break;
        }
        failed++;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    setProgress(null);
    setNote((n) => n ?? `${ok} jeu${ok > 1 ? "x" : ""} estimé${ok > 1 ? "s" : ""}${failed ? `, ${failed} erreur${failed > 1 ? "s" : ""}` : ""}${stop.current ? " (arrêté)" : ""}.`);
  }

  return (
    <section className="scan-all value-strip" aria-label="Valeur de la collection">
      {progress ? (
        <>
          <div className="scan-all-status" role="status">
            <DiscSpinner size={20} />
            <span>
              Estimation : <span className="mono">{progress.done + 1} / {progress.total}</span>
              <span className="scan-all-title"> · {progress.title}</span>
            </span>
          </div>
          <div className="bar" aria-hidden>
            <span style={{ width: `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%` }} />
          </div>
          <button className="btn ghost" onClick={() => (stop.current = true)}>
            Arrêter
          </button>
        </>
      ) : (
        <>
          <div className="value-total">
            <span className="muted small">Valeur estimée de ta collection</span>
            <strong className="value-total-num">{v.valued ? euros(v.total) : "—"}</strong>
            <span className="muted small">
              {v.valued ? `entre ${euros(v.low)} et ${euros(v.high)} · ` : ""}
              {v.valued} / {v.count} jeux estimés · cotes eBay France
            </span>
          </div>
          {todo.length > 0 && (
            <button className="btn" onClick={() => void run()}>
              {v.valued ? `Actualiser (${todo.length} jeu${todo.length > 1 ? "x" : ""})` : "Estimer toute la collection"}
            </button>
          )}
          {note && (
            <p className="small scan-all-result" role="status">
              {note}
            </p>
          )}
        </>
      )}
    </section>
  );
}
