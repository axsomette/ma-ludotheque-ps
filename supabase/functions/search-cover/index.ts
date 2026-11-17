// Recherche de jeux dans la base IGDB (Twitch), filtrée par plateforme PlayStation.
// Renvoie la jaquette et de quoi composer un dos réaliste : résumé, éditeur, genres, captures, PEGI.
// Les identifiants Twitch restent côté serveur (secrets Supabase), jamais dans le navigateur.
// Réservée aux utilisateurs connectés (protège le quota IGDB) : la session est vérifiée ici,
// car la vérification « verify_jwt » de la passerelle ne gère pas les nouvelles clés de signature.
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

// --- IGDB ---

const IGDB_PLATFORM: Record<string, number> = { ps3: 9, ps4: 48, ps5: 167 };

let token: { value: string; expires: number } | null = null;

async function igdbToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const id = Deno.env.get("TWITCH_CLIENT_ID");
  const secret = Deno.env.get("TWITCH_CLIENT_SECRET");
  if (!id || !secret) throw new Error("TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET manquants");
  const r = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`,
    { method: "POST" },
  );
  if (!r.ok) throw new Error(`Twitch OAuth ${r.status}`);
  const j = await r.json();
  token = { value: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return token.value;
}

// deno-lint-ignore no-explicit-any
async function igdb(body: string): Promise<any[]> {
  const r = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": Deno.env.get("TWITCH_CLIENT_ID")!,
      Authorization: `Bearer ${await igdbToken()}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!r.ok) throw new Error(`IGDB ${r.status} ${await r.text().catch(() => "")}`.trim());
  return await r.json();
}

const PEGI_WORDS: Record<string, number> = { three: 3, seven: 7, twelve: 12, sixteen: 16, eighteen: 18 };
const PEGI_LEGACY: Record<number, number> = { 1: 3, 2: 7, 3: 12, 4: 16, 5: 18 };

/** Lit l'âge PEGI quel que soit le schéma IGDB (récent : organization/rating_category ; ancien : category/rating). */
// deno-lint-ignore no-explicit-any
function pegiOf(ratings: any[] | undefined): number | null {
  for (const a of ratings ?? []) {
    const org = String(a?.organization?.name ?? a?.organization ?? "");
    const label = String(a?.rating_category?.rating ?? "");
    if (/pegi/i.test(org) || a?.organization === 2) {
      const n = Number(label.match(/\d+/)?.[0]);
      if ([3, 7, 12, 16, 18].includes(n)) return n;
      const w = PEGI_WORDS[label.toLowerCase()];
      if (w) return w;
    }
    if (a?.category === 2 && PEGI_LEGACY[a?.rating]) return PEGI_LEGACY[a.rating];
  }
  return null;
}

/** Classification PEGI par jeu : non bloquante (schéma récent puis ancien, erreurs ignorées). */
async function pegiFor(ids: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!ids.length) return out;
  const where = `where id = (${ids.join(",")}); limit ${ids.length};`;
  for (const fields of [
    "fields age_ratings.organization.name,age_ratings.rating_category.rating;",
    "fields age_ratings.category,age_ratings.rating;",
  ]) {
    try {
      for (const g of await igdb(`${fields} ${where}`)) {
        const p = pegiOf(g.age_ratings);
        if (p && !out.has(g.id)) out.set(g.id, p);
      }
    } catch (e) {
      console.warn("PEGI ignoré :", (e as Error).message);
    }
  }
  return out;
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

    const { query, platform } = await req.json();
    const q = String(query ?? "")
      .replace(/["\\;]/g, " ") // pas d'injection dans la requête APIcalypse
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    const pid = IGDB_PLATFORM[String(platform)];
    if (!q || !pid) return json(req, { error: "query et platform (ps3|ps4|ps5) requis" }, 400);

    const fields =
      "fields name,cover.image_id,first_release_date,summary,genres.name,screenshots.image_id," +
      "involved_companies.publisher,involved_companies.company.name;";
    let games = await igdb(`search "${q}"; ${fields} where platforms = (${pid}) & cover != null; limit 12;`);
    // Rien sur cette plateforme (titre mal lu, portage…) : on élargit à toutes les plateformes.
    if (games.length === 0) games = await igdb(`search "${q}"; ${fields} where cover != null; limit 12;`);
    games = games.filter((g) => g.cover?.image_id);

    const pegi = await pegiFor(games.map((g) => g.id));

    const results = games.map((g) => ({
      igdb_id: g.id,
      name: g.name,
      year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
      image_id: g.cover.image_id,
      thumb_url: `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`,
      summary: typeof g.summary === "string" ? g.summary.slice(0, 1500) : null,
      // deno-lint-ignore no-explicit-any
      publisher: (g.involved_companies ?? []).find((c: any) => c.publisher)?.company?.name ?? null,
      // deno-lint-ignore no-explicit-any
      genres: (g.genres ?? []).map((x: any) => x.name).filter(Boolean).slice(0, 3),
      // deno-lint-ignore no-explicit-any
      screenshot_ids: (g.screenshots ?? []).map((s: any) => s.image_id).filter(Boolean).slice(0, 3),
      pegi: pegi.get(g.id) ?? null,
    }));
    return json(req, { results });
  } catch (e) {
    console.error(e);
    return json(req, { error: (e as Error).message }, 502);
  }
});
