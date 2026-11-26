// Recherche de jeux dans la base IGDB (Twitch), filtrée par console (PlayStation, Nintendo, Xbox).
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

import { FAMILY_IGDB, IGDB_ID, isPlatform } from "../_shared/platforms.ts";

let token: { value: string; expires: number } | null = null;

async function igdbToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const id = Deno.env.get("TWITCH_CLIENT_ID");
  const secret = Deno.env.get("TWITCH_CLIENT_SECRET");
  if (!id || !secret) throw new Error("TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET manquants");
  // Identifiants dans le corps (jamais dans l'URL : une erreur réseau recopie l'URL dans son message).
  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }),
    redirect: "error",
  });
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
    redirect: "error",
  });
  if (!r.ok) throw new Error(`IGDB ${r.status} ${await r.text().catch(() => "")}`.trim());
  return await r.json();
}

/** Quota d'appels par utilisateur (fonction SQL take_quota, limites fixées côté base). */
async function underQuota(supabase: ReturnType<typeof createClient>, fn: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("take_quota", { fn });
  if (error) throw error; // quota illisible : on refuse (échec fermé)
  return data === true;
}

// Types de jeu IGDB gardés : 0 jeu, 4 extension autonome, 8 remake, 9 remaster, 10 édition étendue, 11 portage.
// Écartés : DLC, extension, bundle, mod, épisode, saison, fork, pack, mise à jour.
const GAME_TYPES = "(0,4,8,9,10,11)";

const words = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const same = (a: string, b: string) => words(a).join(" ") === words(b).join(" ");
const contains = (name: string, q: string) => {
  const have = new Set(words(name));
  return words(q).every((w) => have.has(w));
};

/** Noms d'un jeu dans d'autres langues (noms alternatifs et localisés). */
// deno-lint-ignore no-explicit-any
function otherNames(g: any): Array<{ name: string; french: boolean }> {
  return [
    // deno-lint-ignore no-explicit-any
    ...(g.alternative_names ?? []).map((a: any) => ({ name: String(a?.name ?? ""), french: /fran|french/i.test(String(a?.comment ?? "")) })),
    // deno-lint-ignore no-explicit-any
    ...(g.game_localizations ?? []).map((l: any) => ({ name: String(l?.name ?? ""), french: false })),
  ].filter((n) => n.name && !same(n.name, g.name));
}

/** Nom à afficher sous le titre IGDB : celui qui correspond à la recherche, sinon le titre français. */
// deno-lint-ignore no-explicit-any
function localName(g: any, q: string): string | null {
  if (contains(g.name, q)) return null;
  const names = otherNames(g);
  return (names.find((n) => contains(n.name, q)) ?? names.find((n) => n.french))?.name ?? null;
}

// Jeux de fans et projets amateurs : jamais vendus en boîte.
const FAN_MADE = /\bfan[- ]?(?:made|created|game|project)\b|\bunofficial\b/i;
// Éditions d'un même jeu : proposées après le jeu de base.
const EDITION = /\b(?:edition|bundle|collection|pack)\b/i;

/**
 * Résultats utiles pour une collection physique, du plus probable au moins probable :
 * sans doublon ni jeu de fan ni jeu pas encore sorti ; titre exact (toutes langues), puis titre contenant
 * la recherche ; à égalité, les jeux sortis et classés PEGI (vendus en boîte en Europe) et le jeu de base
 * avant ses éditions ; enfin l'ordre de pertinence d'IGDB.
 */
// deno-lint-ignore no-explicit-any
function rankGames(list: any[], q: string, pegi: Map<number, number>, now = Date.now()): any[] {
  const unique = list.filter(
    // deno-lint-ignore no-explicit-any
    (g, i) => g.cover?.image_id && list.findIndex((x: any) => x.id === g.id) === i,
  );
  const kept = unique.filter(
    (g) => !FAN_MADE.test(String(g.name)) && !(typeof g.first_release_date === "number" && g.first_release_date * 1000 > now),
  );
  // deno-lint-ignore no-explicit-any
  const match = (g: any) => {
    const names = [g.name, ...otherNames(g).map((n) => n.name)];
    if (names.some((n) => same(n, q))) return 0;
    if (names.some((n) => contains(n, q))) return 1;
    return 2;
  };
  // deno-lint-ignore no-explicit-any
  const retail = (g: any) => (pegi.has(g.id) && g.first_release_date ? 0 : 1);
  // deno-lint-ignore no-explicit-any
  const edition = (g: any) => (EDITION.test(String(g.name)) ? 1 : 0);
  return kept
    .map((g, i) => ({ g, i, k: [match(g), retail(g), edition(g)] }))
    .sort((a, b) => a.k[0] - b.k[0] || a.k[1] - b.k[1] || a.k[2] - b.k[2] || a.i - b.i)
    .map((x) => x.g);
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
    if (!(await underQuota(supabase, "search-cover"))) {
      return json(req, { error: "Trop de recherches pour l'instant. Réessaie dans une heure." }, 429);
    }

    const { query, platform } = await req.json();
    const q = String(query ?? "")
      .replace(/["\\;]/g, " ") // pas d'injection dans la requête APIcalypse
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    const pid = isPlatform(platform) ? IGDB_ID[platform] : undefined;
    if (!q || !pid) return json(req, { error: "query et platform requis" }, 400);

    const fields =
      "fields name,cover.image_id,first_release_date,summary,genres.name,screenshots.image_id," +
      "involved_companies.publisher,involved_companies.company.name," +
      "alternative_names.name,alternative_names.comment,game_localizations.name;";

    // Recherche IGDB limitée aux vrais jeux : pas de DLC, mod, épisode, pack ni mise à jour.
    // Si le filtre est refusé (schéma IGDB changé), on cherche sans lui plutôt que d'échouer.
    // deno-lint-ignore no-explicit-any
    async function search(where: string): Promise<any[]> {
      try {
        return await igdb(`search "${q}"; ${fields} where ${where} & game_type = ${GAME_TYPES}; limit 12;`);
      } catch (e) {
        console.warn("Filtre game_type ignoré :", (e as Error).message);
        return await igdb(`search "${q}"; ${fields} where ${where}; limit 12;`);
      }
    }
    // Titres français (et autres langues) : noms alternatifs et localisés d'IGDB, que « search » ne couvre pas toujours.
    // deno-lint-ignore no-explicit-any
    async function byLocalName(where: string): Promise<any[]> {
      try {
        return await igdb(
          `${fields} where (alternative_names.name ~ *"${q}"* | game_localizations.name ~ *"${q}"*) & ${where} & game_type = ${GAME_TYPES}; limit 12;`,
        );
      } catch (e) {
        console.warn("Recherche par nom local ignorée :", (e as Error).message);
        return [];
      }
    }

    const onPlatform = `platforms = (${pid}) & cover != null`;
    let [found, local] = await Promise.all([search(onPlatform), byLocalName(onPlatform)]);
    // Rien sur cette plateforme (titre mal lu, portage…) : on élargit aux autres consoles de la même famille.
    if (found.length + local.length === 0) {
      const wider = `platforms = (${FAMILY_IGDB[platform as keyof typeof FAMILY_IGDB].join(",")}) & cover != null`;
      [found, local] = await Promise.all([search(wider), byLocalName(wider)]);
    }
    const candidates = [...found, ...local];
    const pegi = await pegiFor([...new Set(candidates.map((g) => g.id))].slice(0, 24));
    const games = rankGames(candidates, q, pegi).slice(0, 12);


    const results = games.map((g) => ({
      igdb_id: g.id,
      name: g.name,
      local_name: localName(g, q),
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
    console.error(e); // le détail reste dans les journaux, jamais dans la réponse
    return json(req, { error: "La recherche de jaquettes est indisponible pour le moment. Réessaie dans un instant." }, 502);
  }
});
