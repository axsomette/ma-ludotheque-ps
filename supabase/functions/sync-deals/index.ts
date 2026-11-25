// Collecte des bons plans PlayStation des flux RSS publics de Dealabs dans la table deals.
// Appelée chaque heure (GitHub Actions) et à l'ouverture d'une fiche d'achat ; sans données
// personnelles, elle ne demande pas de session, mais ne relit les flux qu'une fois par quart d'heure.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { FEEDS, parseFeed, type Deal } from "./dealabs.ts";

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

const UA = "ma-ludotheque/1.0 (lecteur RSS, collection personnelle de jeux PlayStation)";
const EVERY = 15 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "POST attendu" }, 405);
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

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
    const unique = [...new Map(all.map((d) => [d.id, { ...d, seen_at: new Date().toISOString() }])).values()];
    if (unique.length) {
      const { error } = await db.from("deals").upsert(unique, { onConflict: "id" });
      if (error) throw error;
    }
    // Historique limité à 6 mois.
    await db.from("deals").delete().lt("published_at", new Date(Date.now() - 183 * 86_400_000).toISOString());
    return json(req, { stored: unique.length });
  } catch (e) {
    console.error(e);
    return json(req, { error: "La collecte des bons plans a échoué." }, 500);
  }
});
