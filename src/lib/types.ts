export type Platform = "ps3" | "ps4" | "ps5";
export type Pegi = 3 | 7 | 12 | 16 | 18;

/** Un jeu physique de la collection. */
export interface Game {
  id: string;
  title: string;
  platform: Platform;
  igdb_id: number | null;
  /** Jaquette avant. */
  cover_url: string | null;
  release_year: number | null;
  summary: string | null;
  publisher: string | null;
  genres: string[];
  pegi: Pegi | null;
  /** Captures d'écran officielles (dos du boîtier). */
  screenshots: string[];
  /** Photo du vrai dos, si l'utilisateur l'a prise. */
  back_url: string | null;
  /** Photo du vrai disque, si l'utilisateur l'a prise. */
  disc_url: string | null;
  created_at: string;
}

export type NewGame = Omit<Game, "id" | "created_at">;
export type GamePatch = Partial<
  Pick<Game, "back_url" | "disc_url" | "title" | "summary" | "publisher" | "genres" | "pegi" | "screenshots" | "release_year">
>;

/** Un résultat de recherche de jaquette. */
export interface CoverCandidate {
  igdb_id: number | null;
  name: string;
  year: number | null;
  /** Petite image pour la liste de choix. */
  thumb_url: string;
  /** Identifiant d'image IGDB (pour enregistrer la grande jaquette), ou null en mode démo. */
  image_id: string | null;
  summary: string | null;
  publisher: string | null;
  genres: string[];
  screenshot_ids: string[];
  pegi: Pegi | null;
}

export const GAME_COLUMNS =
  "id,title,platform,igdb_id,cover_url,release_year,summary,publisher,genres,pegi,screenshots,back_url,disc_url,created_at";

/** Complète un jeu ancien (ou de la démo) avec les champs ajoutés depuis. */
export function normalizeGame(g: Partial<Game> & Pick<Game, "id" | "title" | "platform">): Game {
  return {
    igdb_id: null,
    cover_url: null,
    release_year: null,
    summary: null,
    publisher: null,
    pegi: null,
    back_url: null,
    disc_url: null,
    created_at: new Date(0).toISOString(),
    ...g,
    genres: g.genres ?? [],
    screenshots: g.screenshots ?? [],
  };
}
