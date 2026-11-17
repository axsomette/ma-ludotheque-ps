import { generatedCover } from "./canvasArt";
import { supabase } from "./supabase";
import type { CoverCandidate, Platform } from "./types";

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
  if (error) throw new Error("La recherche n'a pas abouti. Vérifie ta connexion puis réessaie.");
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
  if (error || !data?.url) throw new Error("La jaquette n'a pas pu être enregistrée. Réessaie dans un instant.");
  return { url: data.url, screenshots: data.screenshots ?? [] };
}

export type PhotoKind = "front" | "back" | "disc";

/**
 * Envoie une photo prise par l'utilisateur (jaquette, dos ou disque) dans son dossier du stockage.
 * Le disque est recadré en carré centré, le reste est simplement redimensionné.
 */
export async function uploadPhoto(file: Blob, kind: PhotoKind): Promise<string> {
  const jpeg = await toJpeg(file, kind === "disc");
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
