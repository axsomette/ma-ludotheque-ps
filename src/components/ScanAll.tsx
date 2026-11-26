import { useRef, useState } from "react";
import { fetchScans, ScansQuotaReached } from "../lib/covers";
import { missingScans, scanAll, type ScanAllProgress, type ScanAllReport } from "../lib/scanAll";
import { optimizeImages } from "../lib/optimize";
import { updateGame } from "../lib/store";
import type { Game } from "../lib/types";
import { IconDisc } from "./icons";
import { DiscSpinner } from "./Logo";

interface Props {
  games: readonly Game[];
  onUpdated: (g: Game) => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

function summary(r: ScanAllReport): string {
  const parts = [`${plural(r.updated.length, "jeu complété", "jeux complétés")}`];
  if (r.nothing.length) parts.push(`${plural(r.nothing.length, "jeu", "jeux")} sans scan disponible sur LaunchBox`);
  if (r.failed.length) parts.push(`${plural(r.failed.length, "erreur", "erreurs")} (réessaie plus tard)`);
  let text = parts.join(", ") + ".";
  if (r.stopped === "quota") text += ` Arrêt avant la fin : ${r.message ?? "trop de recherches pour l'instant."}`;
  if (r.stopped === "cancelled") text += " Mise à jour arrêtée.";
  return text;
}

/** Bouton « Récupérer les scans manquants » : vrai dos et vrai disque pour toute la collection, d'un coup. */
export function ScanAll({ games, onUpdated }: Props) {
  const [progress, setProgress] = useState<ScanAllProgress | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const missing = missingScans(games).length;
  const running = progress !== null;

  if (!missing && !running && !result) return null;

  async function run() {
    abort.current = new AbortController();
    setResult(null);
    setProgress({ done: 0, total: missing, current: null });
    try {
      const r = await scanAll(games, {
        fetchScans,
        updateGame: async (id, patch) => {
          const g = await updateGame(id, patch);
          return (await optimizeImages(g)) ?? g;
        },
        isQuota: (e) => e instanceof ScansQuotaReached,
        onProgress: setProgress,
        onUpdated,
        signal: abort.current.signal,
        pauseMs: 400,
      });
      setResult(summary(r));
    } finally {
      setProgress(null);
      abort.current = null;
    }
  }

  return (
    <section className="scan-all" aria-label="Vrais scans">
      {running ? (
        <>
          <div className="scan-all-status" role="status">
            <DiscSpinner size={20} />
            <span>
              Scans : <span className="mono">{Math.min(progress.done + 1, progress.total)} / {progress.total}</span>
              {progress.current && <span className="scan-all-title"> · {progress.current.title}</span>}
            </span>
          </div>
          <div className="bar" aria-hidden>
            <span style={{ width: `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%` }} />
          </div>
          <button className="btn ghost" onClick={() => abort.current?.abort()}>
            Arrêter
          </button>
        </>
      ) : (
        <>
          <p className="muted small">
            {missing
              ? `${plural(missing, "jeu n'a", "jeux n'ont")} pas encore leur vrai dos ou leur vrai disque.`
              : "Tous tes jeux ont leur vrai dos et leur vrai disque."}
          </p>
          {missing > 0 && (
            <button className="btn" onClick={() => void run()}>
              <IconDisc />
              Récupérer les scans manquants
            </button>
          )}
          {result && (
            <p className="small scan-all-result" role="status">
              {result}
            </p>
          )}
        </>
      )}
    </section>
  );
}
