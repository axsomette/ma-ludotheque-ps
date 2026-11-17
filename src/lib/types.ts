export type Platform = "ps3" | "ps4" | "ps5";

/** Un jeu physique de la collection. */
export interface Game {
  id: string;
  title: string;
  platform: Platform;
  igdb_id: number | null;
  cover_url: string | null;
  release_year: number | null;
  created_at: string;
}

export type NewGame = Omit<Game, "id" | "created_at">;

/** Un résultat de recherche de jaquette. */
export interface CoverCandidate {
  igdb_id: number | null;
  name: string;
  year: number | null;
  /** Petite image pour la liste de choix. */
  thumb_url: string;
  /** Identifiant d'image IGDB (pour enregistrer la grande jaquette), ou null en mode démo. */
  image_id: string | null;
}
