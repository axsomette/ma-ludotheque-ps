// Va chercher sur LaunchBox Games DB les vrais scans d'un jeu (dos du boîtier et sérigraphie du disque),
// version européenne en priorité, et les copie dans covers/<user_id>/. Aucun compte ni clé nécessaire.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { LB_PLATFORM, parseImages, parseResults, pickImage, pickResult, safeImageUrl, type Platform } from "./launchbox.ts";

// --- CORS et réponses JSON ---

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

// --- LaunchBox ---

const LB = "https://gamesdb.launchbox-app.com";
const UA = "ma-ludotheque/1.0 (collection personnelle de jeux PlayStation)";
const MAX_BYTES = 8 * 1024 * 1024;

async function page(path: string): Promise<string> {
  const res = await fetch(LB + path, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`LaunchBox indisponible (${res.status})`);
  return res.text();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "POST attendu" }, 405);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, publicKey(), {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return json(req, { error: "Non connecté" }, 401);
    const uid = auth.user.id;

    const { title, platform } = await req.json();
    if (typeof title !== "string" || !title.trim() || title.length > 120) return json(req, { error: "Titre invalide" }, 400);
    if (!(platform in LB_PLATFORM)) return json(req, { error: "Plateforme invalide" }, 400);

    const results = parseResults(await page(`/games/results/${encodeURIComponent(title.trim())}`));
    const game = pickResult(results, title, platform as Platform);
    if (!game) return json(req, { found: false, back_url: null, disc_url: null });
    const images = parseImages(await page(`/games/images/${game.id}`));

    async function copy(url: string | undefined, kind: "back" | "disc", minBytes: number): Promise<string | null> {
      const safe = url ? safeImageUrl(url) : null;
      if (!safe) return null;
      const img = await fetch(safe, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
      const type = img.headers.get("content-type") ?? "";
      if (!img.ok || !type.startsWith("image/")) return null;
      const bytes = new Uint8Array(await img.arrayBuffer());
      if (bytes.byteLength < minBytes || bytes.byteLength > MAX_BYTES) return null; // scan raté ou trop lourd
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
      const path = `${uid}/lb-${kind}-${game!.id}.${ext}`;
      const { error } = await supabase.storage.from("covers").upload(path, bytes, { contentType: type, upsert: true });
      if (error) throw error;
      return supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
    }

    const backImg = pickImage(images, "Box - Back");
    const discImg = pickImage(images, "Disc");
    const [back, disc] = await Promise.allSettled([
      copy(backImg?.url, "back", 20 * 1024), // en dessous de 20 Ko, le scan est inexploitable
      copy(discImg?.url, "disc", 4 * 1024),
    ]);
    return json(req, {
      found: true,
      lb_id: game.id,
      name: game.title,
      back_region: backImg?.region ?? null,
      disc_region: discImg?.region ?? null,
      back_url: back.status === "fulfilled" ? back.value : null,
      disc_url: disc.status === "fulfilled" ? disc.value : null,
    });
  } catch (e) {
    console.error(e);
    return json(req, { error: (e as Error).message }, 500);
  }
});
