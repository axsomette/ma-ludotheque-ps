import type { Game, GamePatch } from "./types";

/** Jeux à qui il manque le vrai dos ou le vrai disque. */
export function missingScans(games: readonly Game[]): Game[] {
  return games.filter((g) => !g.back_url || !g.disc_url);
}

export interface ScanAllProgress {
  done: number;
  total: number;
  current: Game | null;
}

export interface ScanAllReport {
  /** Jeux qui ont gagné au moins un scan. */
  updated: Game[];
  /** Jeux pour lesquels LaunchBox n'a rien de plus. */
  nothing: Game[];
  /** Jeux en erreur (réseau, LaunchBox indisponible…). */
  failed: Game[];
  /** Arrêt avant la fin : quota horaire atteint ou annulation. */
  stopped: "quota" | "cancelled" | null;
  message: string | null;
}

interface Deps {
  fetchScans: (g: Game) => Promise<GamePatch>;
  updateGame: (id: string, patch: GamePatch) => Promise<Game>;
  isQuota: (e: unknown) => boolean;
  onProgress?: (p: ScanAllProgress) => void;
  onUpdated?: (g: Game) => void;
  signal?: AbortSignal;
  /** Pause entre deux jeux, par politesse envers LaunchBox. */
  pauseMs?: number;
}

/**
 * Cherche les scans manquants de chaque jeu, un par un. Un échec n'arrête pas le reste,
 * sauf le quota horaire (les suivants échoueraient tous) ou une annulation.
 */
export async function scanAll(games: readonly Game[], deps: Deps): Promise<ScanAllReport> {
  const todo = missingScans(games);
  const report: ScanAllReport = { updated: [], nothing: [], failed: [], stopped: null, message: null };
  for (let i = 0; i < todo.length; i++) {
    if (deps.signal?.aborted) {
      report.stopped = "cancelled";
      break;
    }
    const g = todo[i];
    deps.onProgress?.({ done: i, total: todo.length, current: g });
    try {
      const patch = await deps.fetchScans(g);
      if (Object.keys(patch).length) {
        const updated = await deps.updateGame(g.id, patch);
        report.updated.push(updated);
        deps.onUpdated?.(updated);
      } else {
        report.nothing.push(g);
      }
    } catch (e) {
      if (deps.isQuota(e)) {
        report.stopped = "quota";
        report.message = (e as Error).message;
        break;
      }
      report.failed.push(g);
    }
    if (deps.pauseMs && i < todo.length - 1) await new Promise((r) => setTimeout(r, deps.pauseMs));
  }
  deps.onProgress?.({ done: report.updated.length + report.nothing.length + report.failed.length, total: todo.length, current: null });
  return report;
}
