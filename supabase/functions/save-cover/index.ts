// Copie dans le stockage Supabase de l'utilisateur (covers/<user_id>/…) la grande jaquette IGDB
// et jusqu'à 3 captures d'écran (pour le dos du boîtier), puis renvoie leurs URL publiques.
// Avoir sa propre copie évite les blocages CORS au moment de les utiliser en textures 3D.
import { createClient } from "jsr:@supabase/supabase-js@2";

// --- CORS et réponses JSON (intégrés pour un déploiement en un seul fichier) ---

const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

/** Clé publique du projet : nouvelle clé « publishable » si présente, sinon l'ancienne clé anon. */
function publicKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const k = keys.default ?? Object.values(keys)[0];
    if (typeof k === "string" && k) return k;
  } catch {
    // variable absente ou illisible : on retombe sur l'ancienne clé
  }
  return Deno.env.get("SUPABASE_ANON_KEY")!;
}

/** Quota d'appels par utilisateur (fonction SQL take_quota, limites fixées côté base). */
async function underQuota(supabase: ReturnType<typeof createClient>, fn: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("take_quota", { fn });
  if (error) throw error; // quota illisible : on refuse (échec fermé)
  return data === true;
}

const MAX_BYTES = 5 * 1024 * 1024; // même plafond que le bucket « covers »
// Identifiant strict : on ne télécharge que depuis le CDN d'IGDB (pas de requête vers une URL arbitraire).
const IMAGE_ID = /^[a-z0-9]{4,40}$/;
const IGDB_IMAGES = "https://images.igdb.com/igdb/image/upload";
// Du plus grand au plus petit : t_cover_big est la miniature déjà affichée dans les résultats,
// elle sert de dernier recours si la grande taille est absente, trop lourde ou refusée.
const COVER_SIZES = ["t_1080p", "t_720p", "t_cover_big"];
const SHOT_SIZES = ["t_screenshot_big", "t_screenshot_med"];

/** Type réel de l'image d'après ses premiers octets (le bucket n'accepte que JPEG, PNG et WebP). */
function imageType(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/**
 * Télécharge une image du CDN d'IGDB. Les redirections sont suivies (3 au plus),
 * seulement en HTTPS et vers un hôte igdb.com.
 */
async function download(size: string, id: string): Promise<{ bytes: Uint8Array; type: string }> {
  let url = new URL(`${IGDB_IMAGES}/${size}/${id}.jpg`);
  for (let hop = 0; hop <= 3; hop++) {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel();
      const next = new URL(res.headers.get("location") ?? "", url);
      const host = next.hostname;
      if (next.protocol !== "https:" || !(host === "igdb.com" || host.endsWith(".igdb.com"))) {
        throw new Error(`Redirection IGDB refusée : ${next.host}`);
      }
      url = next;
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`Image IGDB ${size}/${id} introuvable (${res.status})`);
    }
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) {
      await res.body?.cancel();
      throw new Error(`Image IGDB ${size}/${id} trop lourde`);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new Error(`Image IGDB ${size}/${id} trop lourde (${bytes.byteLength} o)`);
    const type = imageType(bytes);
    if (!type) throw new Error(`Réponse IGDB ${size}/${id} qui n'est pas une image (${res.headers.get("content-type")})`);
    return { bytes, type };
  }
  throw new Error("Trop de redirections IGDB");
}

/** Première taille qui se télécharge ; les échecs intermédiaires restent dans les journaux. */
async function downloadFirst(sizes: string[], id: string): Promise<{ bytes: Uint8Array; type: string }> {
  let last: unknown;
  for (const size of sizes) {
    try {
      return await download(size, id);
    } catch (e) {
      console.warn((e as Error).message);
      last = e;
    }
  }
  throw last;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "POST attendu" }, 405);

  try {
    // Client agissant au nom de l'utilisateur : les règles RLS du stockage s'appliquent.
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, publicKey(), {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json(req, { error: "Non connecté" }, 401);
    const uid = auth.user.id;
    if (!(await underQuota(supabase, "save-cover"))) {
      return json(req, { error: "Trop d'ajouts pour l'instant. Réessaie dans une heure." }, 429);
    }

    const { image_id, screenshot_ids } = await req.json();
    if (typeof image_id !== "string" || !IMAGE_ID.test(image_id)) {
      return json(req, { error: "image_id invalide" }, 400);
    }
    const shots: string[] = Array.isArray(screenshot_ids)
      ? screenshot_ids.filter((s: unknown) => typeof s === "string" && IMAGE_ID.test(s)).slice(0, 3)
      : [];

    async function copy(sizes: string[], id: string, prefix: string): Promise<string> {
      const { bytes, type } = await downloadFirst(sizes, id);
      const path = `${uid}/${prefix}-${id}.${EXT[type]}`;
      const { error } = await supabase.storage.from("covers").upload(path, bytes, { contentType: type, upsert: true });
      if (error) throw new Error(`Dépôt de ${path} refusé : ${error.message}`);
      return supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
    }

    const url = await copy(COVER_SIZES, image_id, "igdb");
    // Les captures sont un plus : une capture qui échoue n'empêche pas l'ajout du jeu.
    const screenshots = (
      await Promise.allSettled(shots.map((s) => copy(SHOT_SIZES, s, "shot")))
    ).flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));

    return json(req, { url, screenshots });
  } catch (e) {
    console.error(e); // le détail reste dans les journaux, jamais dans la réponse
    return json(req, { error: "La jaquette n'a pas pu être enregistrée. Réessaie dans un instant." }, 500);
  }
});
