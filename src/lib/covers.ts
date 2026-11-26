import { generatedCover } from "./canvasArt";
import { supabase } from "./supabase";
import type { CoverCandidate, Game, GamePatch, Platform } from "./types";

/** Message d'erreur renvoyé par une fonction Supabase (ex. quota atteint), sinon le message par défaut. */
export async function functionMessage(error: unknown, fallback: string): Promise<string> {
  const ctx = (error as { context?: Response }).context;
  const body = ctx && typeof ctx.json === "function" ? await ctx.json().catch(() => null) : null;
  return typeof body?.error === "string" && body.error ? body.error : fallback;
}

/**
 * Cherche des jeux correspondant au titre lu sur la photo.
 * En production : fonction Supabase « search-cover » (base IGDB, filtrée par plateforme).
 * En démo : jaquettes générées localement.
 */
export async function searchCovers(query: string, platform: Platform): Promise<CoverCandidate[]> {
  const q = query.trim();
  if (!q) return [];
  if (!supabase) {
    return [q, `${q} – Édition Deluxe`].map((name) => ({
      igdb_id: null,
      name,
      year: null,
      thumb_url: generatedCover(name, platform),
      image_id: null,
      summary: null,
      publisher: null,
      genres: [],
      screenshot_ids: [],
      pegi: null,
    }));
  }
  const { data, error } = await supabase.functions.invoke<{ results: CoverCandidate[] }>("search-cover", {
    body: { query: q, platform },
  });
  if (error) throw new Error(await functionMessage(error, "La recherche n'a pas abouti. Vérifie ta connexion puis réessaie."));
  return data?.results ?? [];
}

/**
 * Copie la grande jaquette et les captures d'écran dans le stockage de l'utilisateur
 * (une copie chez soi évite les blocages CORS au moment de les afficher en 3D).
 */
export async function saveCover(c: CoverCandidate, platform: Platform): Promise<{ url: string; screenshots: string[] }> {
  if (!supabase || !c.image_id) {
    return { url: c.thumb_url.startsWith("data:") ? c.thumb_url : generatedCover(c.name, platform), screenshots: [] };
  }
  const { data, error } = await supabase.functions.invoke<{ url: string; screenshots: string[] }>("save-cover", {
    body: { image_id: c.image_id, screenshot_ids: c.screenshot_ids },
  });
  if (error) throw new Error(await functionMessage(error, "La jaquette n'a pas pu être enregistrée. Réessaie dans un instant."));
  if (!data?.url) throw new Error("La jaquette n'a pas pu être enregistrée. Réessaie dans un instant.");
  return { url: data.url, screenshots: data.screenshots ?? [] };
}

/** Un jeu rangé avant l'ajout des détails (ou dont la fiche IGDB était incomplète à l'époque). */
export function needsDetails(g: Pick<Game, "igdb_id" | "summary" | "publisher" | "genres" | "pegi" | "screenshots">): boolean {
  return g.igdb_id != null && (!g.summary || !g.publisher || g.genres.length === 0 || g.pegi == null || g.screenshots.length === 0);
}

/** Retrouve le même jeu dans les résultats : par identifiant IGDB, sinon par titre exact. */
export function pickSameGame(results: CoverCandidate[], igdbId: number | null, title: string): CoverCandidate | null {
  if (igdbId != null) {
    const byId = results.find((c) => c.igdb_id === igdbId);
    if (byId) return byId;
  }
  const t = title.trim().toLowerCase();
  return results.find((c) => c.name.trim().toLowerCase() === t) ?? null;
}

/**
 * Va rechercher sur IGDB les détails manquants d'un jeu déjà rangé (résumé, éditeur, genres, PEGI, captures).
 * Ce qui existe déjà n'est jamais écrasé par un vide. Renvoie null si le jeu n'est pas retrouvé.
 */
export async function fetchDetails(game: Game): Promise<GamePatch | null> {
  const c = pickSameGame(await searchCovers(game.title, game.platform), game.igdb_id, game.title);
  if (!c) return null;
  let screenshots = game.screenshots;
  if (screenshots.length === 0 && c.screenshot_ids.length > 0 && c.image_id) {
    screenshots = (await saveCover(c, game.platform)).screenshots;
  }
  return {
    summary: game.summary ?? c.summary,
    publisher: game.publisher ?? c.publisher,
    genres: game.genres.length > 0 ? game.genres : c.genres,
    pegi: game.pegi ?? c.pegi,
    release_year: game.release_year ?? c.year,
    screenshots,
  };
}

export class ScansUnavailable extends Error {}
/** Quota horaire de recherches de scans atteint (inutile de continuer une mise à jour groupée). */
export class ScansQuotaReached extends Error {}

/**
 * Vrais scans LaunchBox Games DB (dos et disque, version européenne en priorité), via la fonction fetch-scans.
 * Ne renvoie que ce qui manque au jeu : une photo prise par l'utilisateur n'est jamais remplacée.
 */
export async function fetchScans(game: Pick<Game, "title" | "platform" | "back_url" | "disc_url">): Promise<GamePatch> {
  if (!supabase) throw new ScansUnavailable("Les vrais scans ne sont pas disponibles en mode démo.");
  const { data, error } = await supabase.functions.invoke<{ back_url: string | null; disc_url: string | null; found: boolean }>("fetch-scans", {
    body: { title: game.title, platform: game.platform },
  });
  if (error) {
    const msg = await functionMessage(error, "Les scans n'ont pas pu être récupérés. Réessaie plus tard.");
    if ((error as { context?: Response }).context?.status === 429) throw new ScansQuotaReached(msg);
    throw new Error(msg);
  }
  const patch: GamePatch = {};
  if (!game.back_url && data?.back_url) patch.back_url = data.back_url;
  if (!game.disc_url && data?.disc_url) patch.disc_url = data.disc_url;
  return patch;
}

export type PhotoKind = "front" | "back" | "disc";

/**
 * Envoie une photo prise par l'utilisateur (jaquette, dos ou disque) dans son dossier du stockage.
 * Le disque est recadré en carré centré, le reste est simplement redimensionné.
 */
export async function uploadPhoto(file: Blob, kind: PhotoKind, square = kind === "disc"): Promise<string> {
  const jpeg = await toJpeg(file, square);
  if (!supabase) return await blobToDataUrl(jpeg);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Ta session a expiré. Reconnecte-toi pour envoyer la photo.");
  const path = `${uid}/${kind}-${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("covers").upload(path, jpeg, { contentType: "image/jpeg" });
  if (error) throw new Error("La photo n'a pas pu être envoyée. Réessaie.");
  return supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
}

async function toJpeg(file: Blob, squareCrop: boolean): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const sx = squareCrop ? (bmp.width - side) / 2 : 0;
  const sy = squareCrop ? (bmp.height - side) / 2 : 0;
  const sw = squareCrop ? side : bmp.width;
  const sh = squareCrop ? side : bmp.height;
  const scale = Math.min(1, (squareCrop ? 1024 : 1400) / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.round(sw * scale);
  c.height = Math.round(sh * scale);
  c.getContext("2d")!.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return await new Promise<Blob>((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("Conversion de la photo impossible"))), "image/jpeg", 0.88),
  );
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}
