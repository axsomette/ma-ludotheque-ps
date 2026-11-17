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
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) throw error;
}
