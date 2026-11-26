import { ownCoverPath, pruneFiles, updateGame } from "./store";
import { supabase } from "./supabase";
import type { Game, GamePatch } from "./types";

/** Au-delà, une image est réduite : les scans LaunchBox font souvent 2 à 4 Mo, pour un affichage de 1368 px de haut. */
const MAX_BYTES = 600 * 1024;

const TARGETS = [
  { key: "cover_url", prefix: "front", max: 1400 },
  { key: "back_url", prefix: "back", max: 1400 },
  { key: "disc_url", prefix: "disc", max: 1024 },
] as const;

/** Taille maximale (côté le plus long) et qualité choisies pour que l'image reste nette en 3D. */
async function shrink(blob: Blob, max: number): Promise<Blob | null> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  // PNG (disques détourés) → WebP, qui garde la transparence ; le reste en JPEG.
  const type = blob.type === "image/png" || blob.type === "image/webp" ? "image/webp" : "image/jpeg";
  return await new Promise<Blob | null>((res) => c.toBlob(res, type, 0.86));
}

/**
 * Remplace les images trop lourdes d'un jeu (jaquette, dos, disque ou cartouche) par une version réduite,
 * dans le dossier de l'utilisateur, puis supprime l'originale. Renvoie le jeu mis à jour, ou null si rien n'a changé.
 * Une erreur n'est jamais bloquante : au pire l'image d'origine reste.
 */
export async function optimizeImages(game: Game): Promise<Game | null> {
  if (!supabase) return null;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return null;
    const patch: GamePatch = {};
    const old: string[] = [];
    for (const t of TARGETS) {
      const url = game[t.key];
      const path = ownCoverPath(url, uid);
      if (!url || !path || path.includes("-opt-")) continue;
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (blob.size <= MAX_BYTES) continue;
      const small = await shrink(blob, t.max);
      if (!small || small.size >= blob.size * 0.85) continue;
      const ext = small.type === "image/webp" ? "webp" : "jpg";
      const dest = `${uid}/${t.prefix}-opt-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("covers").upload(dest, small, { contentType: small.type });
      if (error) continue;
      (patch as Record<string, string>)[t.key] = supabase.storage.from("covers").getPublicUrl(dest).data.publicUrl;
      old.push(url);
    }
    if (!old.length) return null;
    const updated = await updateGame(game.id, patch);
    await pruneFiles(old);
    return updated;
  } catch {
    return null;
  }
}
