// Recherche de jaquettes dans la base IGDB (Twitch), filtrée par plateforme PlayStation.
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

interface IgdbGame {
  id: number;
  name: string;
  first_release_date?: number;
  cover?: { image_id: string };
}

async function igdb(body: string): Promise<IgdbGame[]> {
  const r = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": Deno.env.get("TWITCH_CLIENT_ID")!,
      Authorization: `Bearer ${await igdbToken()}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!r.ok) throw new Error(`IGDB ${r.status}`);
  return await r.json();
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

    const fields = "fields name,cover.image_id,first_release_date;";
    let games = await igdb(`search "${q}"; ${fields} where platforms = (${pid}) & cover != null; limit 12;`);
    // Rien sur cette plateforme (titre mal lu, portage…) : on élargit à toutes les plateformes.
    if (games.length === 0) games = await igdb(`search "${q}"; ${fields} where cover != null; limit 12;`);

    const results = games
      .filter((g) => g.cover?.image_id)
      .map((g) => ({
        igdb_id: g.id,
        name: g.name,
        year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
        image_id: g.cover!.image_id,
        thumb_url: `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover!.image_id}.jpg`,
      }));
    return json(req, { results });
  } catch (e) {
    console.error(e);
    return json(req, { error: (e as Error).message }, 502);
  }
});
