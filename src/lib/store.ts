import { supabase } from "./supabase";
import { GAME_COLUMNS, normalizeGame, type Game, type GamePatch, type NewGame } from "./types";

const LOCAL_KEY = "ludotheque-demo-games";

function readLocal(): Game[] {
  try {
    return (JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as Game[]).map(normalizeGame);
  } catch {
    return [];
  }
}

function writeLocal(games: Game[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(games));
  } catch {
    // stockage indisponible (navigation privée) : la démo reste en mémoire
  }
}

/** Liste des jeux de l'utilisateur connecté (ou de la démo), du plus récent au plus ancien. */
export async function listGames(): Promise<Game[]> {
  if (!supabase) return readLocal();
  const { data, error } = await supabase.from("games").select(GAME_COLUMNS).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Game[]).map(normalizeGame);
}

export async function addGame(game: NewGame): Promise<Game> {
  if (!supabase) {
    const g: Game = normalizeGame({ ...game, id: crypto.randomUUID(), created_at: new Date().toISOString() });
    writeLocal([g, ...readLocal()]);
    return g;
  }
  const { data, error } = await supabase.from("games").insert(game).select(GAME_COLUMNS).single();
  if (error) throw error;
  return normalizeGame(data as Game);
}

export async function updateGame(id: string, patch: GamePatch): Promise<Game> {
  if (!supabase) {
    const list = readLocal();
    const i = list.findIndex((g) => g.id === id);
    if (i < 0) throw new Error("Jeu introuvable");
    list[i] = { ...list[i], ...patch };
    writeLocal(list);
    return list[i];
  }
  const { data, error } = await supabase.from("games").update(patch).eq("id", id).select(GAME_COLUMNS).single();
  if (error) throw error;
  return normalizeGame(data as Game);
}

export async function deleteGame(id: string): Promise<void> {
  if (!supabase) {
    writeLocal(readLocal().filter((g) => g.id !== id));
    return;
  }
  const { data: game } = await supabase.from("games").select("cover_url,back_url,disc_url,screenshots").eq("id", id).maybeSingle();
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) throw error;
  // Le bucket est public : un fichier laissé derrière resterait accessible par son adresse.
  if (game) await pruneFiles([game.cover_url, game.back_url, game.disc_url, ...(game.screenshots ?? [])]);
}

/**
 * Chemin d'un fichier du bucket « covers » à partir de son URL publique, seulement s'il est dans le dossier
 * de l'utilisateur (`<uid>/…`). Toute autre adresse (IGDB, fichier d'autrui, URL invalide) donne null.
 */
export function ownCoverPath(url: string | null | undefined, uid: string): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/covers/";
  const i = url.indexOf(marker);
  if (i < 0) return null;
  let path: string;
  try {
    path = decodeURIComponent(url.slice(i + marker.length).split(/[?#]/)[0]);
  } catch {
    return null;
  }
  const parts = path.split("/");
  if (parts.length !== 2 || parts[0] !== uid || !parts[1] || parts[1].startsWith(".")) return null;
  return path;
}

/**
 * Supprime du stockage les fichiers de l'utilisateur qui ne servent plus à aucun de ses jeux
 * (jeu supprimé, photo reprise). Un échec n'empêche pas l'action principale : au pire, un fichier reste.
 */
export async function pruneFiles(urls: Array<string | null | undefined>): Promise<void> {
  if (!supabase) return;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    const candidates = [...new Set(urls.map((u) => ownCoverPath(u, uid)).filter((p): p is string => !!p))];
    if (!candidates.length) return;
    const { data: games } = await supabase.from("games").select("cover_url,back_url,disc_url,screenshots");
    const used = new Set(
      (games ?? []).flatMap((g) => [g.cover_url, g.back_url, g.disc_url, ...(g.screenshots ?? [])]).map((u) => ownCoverPath(u, uid)),
    );
    const orphans = candidates.filter((p) => !used.has(p));
    if (orphans.length) await supabase.storage.from("covers").remove(orphans);
  } catch {
    // nettoyage au mieux
  }
}
