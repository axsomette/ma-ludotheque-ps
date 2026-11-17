import { generatedCover } from "./canvasArt";
import { supabase } from "./supabase";
import type { CoverCandidate, Platform } from "./types";

/**
 * Cherche des jaquettes correspondant au titre lu sur la photo.
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
    }));
  }
  const { data, error } = await supabase.functions.invoke<{ results: CoverCandidate[] }>("search-cover", {
    body: { query: q, platform },
  });
  if (error) throw new Error(`Recherche impossible : ${error.message}`);
  return data?.results ?? [];
}

/**
 * Enregistre la grande jaquette dans le stockage Supabase de l'utilisateur
 * (une copie chez soi évite les blocages CORS au moment de l'afficher en 3D).
 */
export async function saveCover(candidate: CoverCandidate, platform: Platform): Promise<string> {
  if (!supabase || !candidate.image_id) return candidate.thumb_url.startsWith("data:") ? candidate.thumb_url : generatedCover(candidate.name, platform);
  const { data, error } = await supabase.functions.invoke<{ url: string }>("save-cover", {
    body: { image_id: candidate.image_id },
  });
  if (error || !data?.url) throw new Error(`Enregistrement de la jaquette impossible : ${error?.message ?? "réponse vide"}`);
  return data.url;
}

/** Utilise la photo prise comme jaquette (quand le jeu n'est pas trouvé). */
export async function savePhotoAsCover(file: Blob): Promise<string> {
  const jpeg = await toCoverJpeg(file);
  if (!supabase) return await blobToDataUrl(jpeg);
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Non connecté");
  const path = `${uid}/photo-${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("covers").upload(path, jpeg, { contentType: "image/jpeg" });
  if (error) throw error;
  return supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
}

/** Redimensionne la photo au format jaquette (max 1080 px de haut), en JPEG. */
async function toCoverJpeg(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1080 / bmp.height);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Conversion JPEG impossible"))), "image/jpeg", 0.88));
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}
