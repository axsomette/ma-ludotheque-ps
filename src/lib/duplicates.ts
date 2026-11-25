import { PLATFORMS } from "./platforms";
import type { Game, Platform } from "./types";

/** Ce qu'il faut savoir d'un jeu pour reconnaître un doublon. */
export interface GameKey {
  title: string;
  platform: Platform;
  igdb_id: number | null;
}

/** Titre comparable : sans accents, casse, ponctuation ni espaces en trop (« Final Fantasy VII » = « final fantasy vii »). */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Même jeu sur la même plateforme : même fiche IGDB quand les deux en ont une,
 * sinon même titre (jeu rangé avec sa photo comme jaquette).
 * Un même jeu sur PS4 et PS5 n'est pas un doublon : ce sont deux boîtiers différents.
 */
export function isSameGame(a: GameKey, b: GameKey): boolean {
  if (a.platform !== b.platform) return false;
  if (a.igdb_id != null && b.igdb_id != null) return a.igdb_id === b.igdb_id;
  return normalizeTitle(a.title) === normalizeTitle(b.title);
}

/** Le jeu déjà rangé qui correspond, ou null. */
export function findDuplicate(games: readonly Game[], key: GameKey): Game | null {
  return games.find((g) => isSameGame(g, key)) ?? null;
}

/** Message affiché quand on essaie de ranger un jeu déjà présent. */
export function duplicateMessage(key: Pick<GameKey, "title" | "platform">): string {
  return `« ${key.title} » (${PLATFORMS[key.platform].label}) est déjà dans ta ludothèque.`;
}

export class DuplicateGameError extends Error {
  constructor(public readonly existing: Game | null, key: Pick<GameKey, "title" | "platform">) {
    super(duplicateMessage(key));
    this.name = "DuplicateGameError";
  }
}
