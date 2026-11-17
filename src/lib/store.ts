import { supabase } from "./supabase";
import type { Game, NewGame } from "./types";

const LOCAL_KEY = "ludotheque-demo-games";

function readLocal(): Game[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as Game[];
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
  const { data, error } = await supabase
    .from("games")
    .select("id,title,platform,igdb_id,cover_url,release_year,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Game[];
}

export async function addGame(game: NewGame): Promise<Game> {
  if (!supabase) {
    const g: Game = { ...game, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    writeLocal([g, ...readLocal()]);
    return g;
  }
  const { data, error } = await supabase
    .from("games")
    .insert(game)
    .select("id,title,platform,igdb_id,cover_url,release_year,created_at")
    .single();
  if (error) throw error;
  return data as Game;
}

export async function deleteGame(id: string): Promise<void> {
  if (!supabase) {
    writeLocal(readLocal().filter((g) => g.id !== id));
    return;
  }
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) throw error;
}
