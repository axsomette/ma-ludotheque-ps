// Bons plans jeux vidéo (PlayStation, Nintendo, Xbox) de Dealabs, enregistrés dans la table deals.
// - Sans paramètre : collecte des flux RSS publics (chaque heure via GitHub Actions) ; sans données
//   personnelles, pas de session demandée, mais au plus une collecte par quart d'heure.
// - Avec { q } : recherche ciblée d'un jeu (page de recherche Dealabs, autorisée par leur robots.txt) ;
//   réservée aux utilisateurs connectés, avec quota, et la même recherche n'est relancée qu'après 20 minutes.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { FEEDS, parseFeed, parseSearch, searchVariants, type Deal } from "./dealabs.ts";

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
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

const UA = "ma-ludotheque/1.0 (lecteur RSS, collection personnelle de jeux vidéo)";
const EVERY = 15 * 60 * 1000;
const SEARCH_EVERY = 20 * 60 * 1000;

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

/** Bons plans d'un jeu : le titre tel quel, puis avec ses numéros écrits autrement (II / 2), que Dealabs ne rapproche pas. */
async function searchDealabs(q: string): Promise<Deal[]> {
  const found: Deal[] = [];
  for (const v of searchVariants(q)) {
    const r = await fetch(`https://www.dealabs.com/search?q=${encodeURIComponent(v)}`, {
      headers: { "User-Agent": UA, Accept: "text/html", "Accept-Language": "fr-FR" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error(`Recherche Dealabs ${r.status}`);
    found.push(...parseSearch(await r.text()));
  }
  return found;
}

const WISH_EVERY = 6 * 3600 * 1000; // chaque jeu de liste d'envies est recherché au plus toutes les 6 heures
const WISH_PER_RUN = 8; // et au plus 8 jeux par collecte, pour rester discret envers Dealabs

// deno-lint-ignore no-explicit-any
async function save(db: any, deals: Deal[]) {
  const rows = [...new Map(deals.map((d) => [d.id, { ...d, seen_at: new Date().toISOString() }])).values()];
  if (!rows.length) return 0;
  const { error } = await db.from("deals").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  return rows.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "POST attendu" }, 405);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));

    // --- Recherche ciblée d'un jeu ---
    if (typeof body.q === "string" && body.q.trim()) {
      const q = body.q.replace(/\s+/g, " ").trim().slice(0, 80);
      const user = createClient(Deno.env.get("SUPABASE_URL")!, publicKey(), {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });
      const { data: auth } = await user.auth.getUser();
      if (!auth.user) return json(req, { error: "Non connecté" }, 401);
      const key = `search:${q.toLowerCase()}`;
      const { data: last } = await db.from("app_state").select("value").eq("key", key).maybeSingle();
      if (last && Date.now() - new Date(last.value).getTime() < SEARCH_EVERY) return json(req, { cached: true });
      const { data: ok, error: qerr } = await user.rpc("take_quota", { fn: "search-deals" });
      if (qerr) throw qerr;
      if (ok !== true) return json(req, { error: "Trop de recherches de prix pour l'instant. Réessaie dans une heure." }, 429);
      await db.from("app_state").upsert({ key, value: new Date().toISOString() });
      return json(req, { stored: await save(db, await searchDealabs(q)) });
    }

    // --- Collecte des flux RSS ---

    const { data: state } = await db.from("app_state").select("value").eq("key", "deals_sync").maybeSingle();
    if (state && Date.now() - new Date(state.value).getTime() < EVERY) return json(req, { skipped: true, last: state.value });
    await db.from("app_state").upsert({ key: "deals_sync", value: new Date().toISOString() });

    const all: Deal[] = [];
    for (const f of FEEDS) {
      try {
        const r = await fetch(f.url, { headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml" }, redirect: "error", signal: AbortSignal.timeout(12000) });
        if (!r.ok) throw new Error(`Dealabs ${r.status} ${f.url}`);
        all.push(...parseFeed(await r.text(), f.platform));
      } catch (e) {
        console.warn((e as Error).message);
      }
    }
    // Un bon plan déjà vu en recherche garde son statut « terminé » : le flux ne le remet pas à jour.
    const stored = await save(db, all.map(({ is_expired: _, ...d }) => d as Deal));
    // Jeux des listes d'envies : recherche ciblée, les plus anciennement cherchés d'abord.
    let wished = 0;
    try {
      const { data: wl } = await db.from("wishlist").select("title").limit(2000);
      const titles = [...new Set((wl ?? []).map((w: { title: string }) => w.title.replace(/\s+/g, " ").trim().slice(0, 80)))];
      const keys = titles.map((t) => `search:${t.toLowerCase()}`);
      const { data: seen } = keys.length ? await db.from("app_state").select("key,value").in("key", keys) : { data: [] };
      const last = new Map((seen ?? []).map((r: { key: string; value: string }) => [r.key, new Date(r.value).getTime()]));
      const due = titles
        .filter((t) => Date.now() - (last.get(`search:${t.toLowerCase()}`) ?? 0) > WISH_EVERY)
        .sort((a, b) => (last.get(`search:${a.toLowerCase()}`) ?? 0) - (last.get(`search:${b.toLowerCase()}`) ?? 0))
        .slice(0, WISH_PER_RUN);
      for (const t of due) {
        await db.from("app_state").upsert({ key: `search:${t.toLowerCase()}`, value: new Date().toISOString() });
        wished += await save(db, await searchDealabs(t)).catch(() => 0);
      }
    } catch (e) {
      console.warn("Envies :", (e as Error).message);
    }

    // Historique limité à 6 mois, et anciennes recherches oubliées.
    await db.from("deals").delete().lt("published_at", new Date(Date.now() - 183 * 86_400_000).toISOString());
    await db.from("app_state").delete().like("key", "search:%").lt("value", new Date(Date.now() - 2 * 86_400_000).toISOString());
    return json(req, { stored, wished });
  } catch (e) {
    console.error(e);
    return json(req, { error: "La collecte des bons plans a échoué." }, 500);
  }
});
