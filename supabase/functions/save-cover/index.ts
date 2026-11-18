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

const MAX_BYTES = 5 * 1024 * 1024;
// Identifiant strict : on ne télécharge que depuis le CDN d'IGDB (pas de requête vers une URL arbitraire).
const IMAGE_ID = /^[a-z0-9]{4,40}$/;

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

    async function copy(size: string, id: string, prefix: string): Promise<string> {
      const img = await fetch(`https://images.igdb.com/igdb/image/upload/${size}/${id}.jpg`, { redirect: "error" });
      if (!img.ok) throw new Error(`Image IGDB introuvable (${img.status})`);
      const bytes = new Uint8Array(await img.arrayBuffer());
      if (bytes.byteLength > MAX_BYTES) throw new Error("Image trop lourde");
      const path = `${uid}/${prefix}-${id}.jpg`;
      const { error } = await supabase.storage.from("covers").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      return supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
    }

    const url = await copy("t_1080p", image_id, "igdb");
    // Les captures sont un plus : une capture qui échoue n'empêche pas l'ajout du jeu.
    const screenshots = (
      await Promise.allSettled(shots.map((s) => copy("t_screenshot_big", s, "shot")))
    ).flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));

    return json(req, { url, screenshots });
  } catch (e) {
    console.error(e); // le détail reste dans les journaux, jamais dans la réponse
    return json(req, { error: "La jaquette n'a pas pu être enregistrée. Réessaie dans un instant." }, 500);
  }
});
