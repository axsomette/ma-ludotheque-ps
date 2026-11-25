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
  /** Personne à qui le jeu est prêté (null : le jeu est à la maison). */
  loaned_to: string | null;
  /** Date du prêt, AAAA-MM-JJ. */
  loaned_at: string | null;
  /** État de l'exemplaire : disque seul, complet (boîte + notice), neuf sous blister. null = complet par défaut. */
  condition: Condition | null;
  edition: Edition;
  /** Dernière cote calculée (euros) et sa fourchette, nombre d'annonces et date du calcul. */
  value_eur: number | null;
  value_low: number | null;
  value_high: number | null;
  value_n: number | null;
  value_at: string | null;
  created_at: string;
}

export type Condition = "loose" | "cib" | "new";
export type Edition = "standard" | "collector";

type Optional = "loaned_to" | "loaned_at" | "condition" | "edition" | "value_eur" | "value_low" | "value_high" | "value_n" | "value_at";
export type NewGame = Omit<Game, "id" | "created_at" | Optional> & Partial<Pick<Game, Optional>>;
export type GamePatch = Partial<
  Pick<Game, "back_url" | "disc_url" | "title" | "summary" | "publisher" | "genres" | "pegi" | "screenshots" | "release_year" | Optional>
>;

/** Un résultat de recherche de jaquette. */
export interface CoverCandidate {
  igdb_id: number | null;
  name: string;
  /** Autre nom du jeu (titre français…) quand c'est lui qui correspond à la recherche. */
  local_name?: string | null;
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
  "id,title,platform,igdb_id,cover_url,release_year,summary,publisher,genres,pegi,screenshots,back_url,disc_url,loaned_to,loaned_at,condition,edition,value_eur,value_low,value_high,value_n,value_at,created_at";

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
    loaned_to: null,
    loaned_at: null,
    condition: null,
    edition: "standard",
    value_eur: null,
    value_low: null,
    value_high: null,
    value_n: null,
    value_at: null,
    created_at: new Date(0).toISOString(),
    ...g,
    genres: g.genres ?? [],
    screenshots: g.screenshots ?? [],
  };
}
