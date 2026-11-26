// Cote et meilleures offres d'un jeu sur eBay France (API officielle « Browse », clés dans les secrets
// Supabase EBAY_CLIENT_ID / EBAY_CLIENT_SECRET). Renvoie une estimation selon l'état et l'édition,
// les offres les moins chères de vendeurs sérieux (neuf et occasion), et si une édition collector existe.
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


import { bestOffers, collectorExists, estimate, fromEbay, matches, type Condition, type Edition, type Listing, type Platform } from "./market.ts";

import { LABEL as PLATFORM_LABEL } from "../_shared/platforms.ts";
const EBAY = "https://api.ebay.com";

let token: { value: string; expires: number } | null = null;

/** Jeton d'application eBay (client credentials), gardé en mémoire jusqu'à son expiration. */
async function ebayToken(): Promise<string> {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const id = Deno.env.get("EBAY_CLIENT_ID");
  const secret = Deno.env.get("EBAY_CLIENT_SECRET");
  if (!id || !secret) throw new NotConfigured();
  const r = await fetch(`${EBAY}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${btoa(`${id}:${secret}`)}` },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope" }),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`eBay OAuth ${r.status}`);
  const j = await r.json();
  token = { value: j.access_token, expires: Date.now() + j.expires_in * 1000 };
  return token.value;
}

class NotConfigured extends Error {}

/** Annonces à prix fixe en euros, situées en France, pour une recherche (200 au plus). */
async function search(q: string): Promise<Listing[]> {
  const params = new URLSearchParams({
    q,
    limit: "200",
    filter: "buyingOptions:{FIXED_PRICE},priceCurrency:EUR,itemLocationCountry:FR",
  });
  const r = await fetch(`${EBAY}/buy/browse/v1/item_summary/search?${params}`, {
    headers: { Authorization: `Bearer ${await ebayToken()}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_FR", "Accept-Language": "fr-FR" },
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`eBay Browse ${r.status} ${await r.text().catch(() => "")}`.trim());
  const j = await r.json();
  return (j.itemSummaries ?? []).map(fromEbay).filter((l: Listing | null): l is Listing => !!l);
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
    if (!Deno.env.get("EBAY_CLIENT_ID") || !Deno.env.get("EBAY_CLIENT_SECRET")) {
      return json(req, { error: "L'estimation des prix n'est pas encore configurée (clés eBay manquantes).", code: "not_configured" }, 503);
    }
    if (!(await underQuota(supabase, "market-price"))) {
      return json(req, { error: "Trop d'estimations pour l'instant. Réessaie dans une heure." }, 429);
    }

    const body = await req.json();
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    const platform = body.platform as Platform;
    const edition: Edition = body.edition === "collector" ? "collector" : "standard";
    const condition: Condition = ["loose", "cib", "new"].includes(body.condition) ? body.condition : "cib";
    if (!title || !Object.hasOwn(PLATFORM_LABEL, String(platform))) return json(req, { error: "Titre ou plateforme invalide" }, 400);

    // Une recherche large (titre + plateforme), puis le tri se fait ici : édition, état, pertinence.
    const all = await search(`${title} ${PLATFORM_LABEL[platform]}`);
    const mine = all.filter((l) => matches(l, title, platform, edition));
    const est = estimate(mine, condition);

    const pick = (l: Listing) => ({ title: l.title, price: l.price, shipping: l.shipping, url: l.url, seller: l.seller, feedback: l.sellerFeedback, image: l.image });
    return json(req, {
      estimate: est,
      // Les trois cotes (pour acheter : neuf, complet d'occasion, disque seul).
      estimates: { new: estimate(mine, "new"), cib: estimate(mine, "cib"), loose: estimate(mine, "loose") },
      condition,
      edition,
      collector_exists: edition === "collector" || collectorExists(all, title, platform),
      offers: { new: bestOffers(mine, true).map(pick), used: bestOffers(mine, false).map(pick) },
      listings: mine.length,
      checked_at: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof NotConfigured) {
      return json(req, { error: "L'estimation des prix n'est pas encore configurée (clés eBay manquantes).", code: "not_configured" }, 503);
    }
    console.error(e); // le détail reste dans les journaux, jamais dans la réponse
    return json(req, { error: "Les prix n'ont pas pu être récupérés. Réessaie dans un instant." }, 502);
  }
});
