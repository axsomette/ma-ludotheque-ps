// Va chercher sur LaunchBox Games DB les vrais scans d'un jeu (dos du boîtier et sérigraphie du disque),
// version européenne en priorité, et les copie dans covers/<user_id>/. Aucun compte ni clé nécessaire.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { LB_PLATFORM, parseImages, parseResults, pickResult, rankImages, safeImageUrl, searchTerms, type LbImage, type LbResult, type Platform } from "./launchbox.ts";

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

/** Quota d'appels par utilisateur (fonction SQL take_quota, limites fixées côté base). */
async function underQuota(supabase: ReturnType<typeof createClient>, fn: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("take_quota", { fn });
  if (error) throw error; // quota illisible : on refuse (échec fermé)
  return data === true;
}

// --- LaunchBox ---

const LB = "https://gamesdb.launchbox-app.com";
const UA = "ma-ludotheque/1.0 (collection personnelle de jeux PlayStation)";
const MAX_BYTES = 5 * 1024 * 1024; // même plafond que le bucket « covers »

/**
 * Page de LaunchBox. Le site redirige /games/images/<id> vers /games/images/<id>-<titre> :
 * on suit au plus 3 redirections, et seulement si elles restent sur gamesdb.launchbox-app.com en HTTPS.
 */
async function page(path: string): Promise<string> {
  let url = new URL(LB + path);
  for (let hop = 0; hop <= 3; hop++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(12000), redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel();
      const next = new URL(res.headers.get("location") ?? "", url);
      if (next.protocol !== "https:" || next.hostname !== url.hostname) throw new Error(`Redirection LaunchBox refusée : ${next.host}`);
      url = next;
      continue;
    }
    if (!res.ok) throw new Error(`LaunchBox indisponible (${res.status})`);
    return res.text();
  }
  throw new Error("Trop de redirections LaunchBox");
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
    if (!(await underQuota(supabase, "fetch-scans"))) {
      return json(req, { error: "Trop de recherches de scans pour l'instant. Réessaie dans une heure." }, 429);
    }

    const { title, platform } = await req.json();
    if (typeof title !== "string" || !title.trim() || title.length > 120) return json(req, { error: "Titre invalide" }, 400);
    if (typeof platform !== "string" || !Object.hasOwn(LB_PLATFORM, platform)) return json(req, { error: "Plateforme invalide" }, 400);

    // Titre tel quel, puis sans sa mention d'édition (« – Complete Edition », « Enhanced »…).
    let game: LbResult | null = null;
    for (const term of searchTerms(title)) {
      game = pickResult(parseResults(await page(`/games/results/${encodeURIComponent(term)}`)), term, platform as Platform);
      if (game) break;
    }
    if (!game) return json(req, { found: false, back_url: null, disc_url: null });
    const images = parseImages(await page(`/games/images/${game.id}`));

    /** Télécharge un scan ; null s'il est absent, refusé, raté (trop léger) ou trop lourd pour le stockage. */
    async function download(url: string, minBytes: number): Promise<{ bytes: Uint8Array; type: string } | null> {
      const safe = safeImageUrl(url);
      if (!safe) return null;
      const img = await fetch(safe, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000), redirect: "error" });
      const type = img.headers.get("content-type") ?? "";
      if (!img.ok || !type.startsWith("image/") || Number(img.headers.get("content-length") ?? 0) > MAX_BYTES) {
        await img.body?.cancel();
        return null;
      }
      const bytes = new Uint8Array(await img.arrayBuffer());
      if (bytes.byteLength < minBytes || bytes.byteLength > MAX_BYTES) return null;
      return { bytes, type };
    }

    /** Premier scan utilisable, dans l'ordre des régions (un scan européen trop lourd laisse sa place au suivant). */
    async function copy(candidates: LbImage[], kind: "back" | "disc", minBytes: number): Promise<{ url: string; region: string | null } | null> {
      let got: { bytes: Uint8Array; type: string } | null = null;
      let chosen: LbImage | null = null;
      for (const c of candidates.slice(0, 4)) {
        got = await download(c.url, minBytes).catch(() => null);
        if (got) {
          chosen = c;
          break;
        }
      }
      if (!got || !chosen) return null;
      const { bytes, type } = got;
      const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
      const path = `${uid}/lb-${kind}-${game!.id}.${ext}`;
      const { error } = await supabase.storage.from("covers").upload(path, bytes, { contentType: type, upsert: true });
      if (error) throw error;
      return { url: supabase.storage.from("covers").getPublicUrl(path).data.publicUrl, region: chosen.region };
    }

    const [back, disc] = await Promise.allSettled([
      copy(rankImages(images, "Box - Back"), "back", 20 * 1024), // en dessous de 20 Ko, le scan est inexploitable
      copy(rankImages(images, "Disc"), "disc", 4 * 1024),
    ]);
    for (const r of [back, disc]) if (r.status === "rejected") console.error(r.reason);
    const b = back.status === "fulfilled" ? back.value : null;
    const d = disc.status === "fulfilled" ? disc.value : null;
    return json(req, {
      found: true,
      lb_id: game.id,
      name: game.title,
      back_region: b?.region ?? null,
      disc_region: d?.region ?? null,
      back_url: b?.url ?? null,
      disc_url: d?.url ?? null,
    });
  } catch (e) {
    console.error(e); // le détail reste dans les journaux, jamais dans la réponse
    return json(req, { error: "Les scans n'ont pas pu être récupérés. Réessaie plus tard." }, 500);
  }
});
