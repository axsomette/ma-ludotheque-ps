// Va chercher sur ScreenScraper les vrais scans d'un jeu (dos du boîtier et sérigraphie du disque),
// en privilégiant la version française puis européenne, et les copie dans covers/<user_id>/.
// Numéros de systèmes et noms de médias relevés dans Skyscraper (GPL) : PS3 = 59, PS4 = 60, PS5 = 284,
// « box-2D-back » pour le dos, « support-2D » pour le disque.
// Les identifiants ScreenScraper sont ceux du projet (secrets Supabase), jamais ceux d'un autre logiciel.
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

// --- ScreenScraper ---

const SYSTEMS: Record<string, number> = { ps3: 59, ps4: 60, ps5: 284 };
// Ordre de préférence des régions : France, Europe, monde, puis le reste.
const REGIONS = ["fr", "eu", "wor", "ss", "uk", "de", "us", "jp"];
const MAX_BYTES = 8 * 1024 * 1024;

interface SsMedia {
  type?: string;
  region?: string;
  url?: string;
  format?: string;
}
interface SsGame {
  id?: string | number;
  noms?: Array<{ region?: string; text?: string }>;
  medias?: SsMedia[];
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Le meilleur média d'un type donné, selon la région préférée. */
function pick(medias: SsMedia[], types: RegExp): SsMedia | null {
  const found = medias.filter((m) => m.url && m.type && types.test(m.type));
  if (!found.length) return null;
  const rank = (m: SsMedia) => {
    const i = REGIONS.indexOf((m.region ?? "wor").toLowerCase());
    return i === -1 ? REGIONS.length : i;
  };
  return found.sort((a, b) => rank(a) - rank(b))[0];
}

/** N'accepte que les adresses de ScreenScraper (aucune requête vers une URL arbitraire). */
function safeUrl(u: string): URL | null {
  try {
    const url = new URL(u);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (host !== "screenscraper.fr" && !host.endsWith(".screenscraper.fr")) return null;
    url.protocol = "https:";
    return url;
  } catch {
    return null;
  }
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

    const devid = Deno.env.get("SS_DEVID");
    const devpassword = Deno.env.get("SS_DEVPASSWORD");
    if (!devid || !devpassword) {
      return json(req, { error: "ScreenScraper n'est pas encore configuré.", code: "not_configured" }, 503);
    }

    const { title, platform } = await req.json();
    if (typeof title !== "string" || !title.trim() || title.length > 120) return json(req, { error: "Titre invalide" }, 400);
    const systemeid = SYSTEMS[platform as string];
    if (!systemeid) return json(req, { error: "Plateforme invalide" }, 400);

    const params = new URLSearchParams({
      devid,
      devpassword,
      softname: Deno.env.get("SS_SOFTNAME") ?? "ma-ludotheque",
      output: "json",
      systemeid: String(systemeid),
      recherche: title.trim(),
    });
    const ssid = Deno.env.get("SS_USER");
    const sspassword = Deno.env.get("SS_PASSWORD");
    if (ssid && sspassword) {
      params.set("ssid", ssid);
      params.set("sspassword", sspassword);
    }

    const res = await fetch(`https://api.screenscraper.fr/api2/jeuRecherche.php?${params}`);
    if (res.status === 429 || res.status === 430 || res.status === 431) {
      return json(req, { error: "Quota ScreenScraper atteint. Réessaie plus tard." }, 429);
    }
    if (!res.ok) return json(req, { error: `ScreenScraper indisponible (${res.status})` }, 502);
    const text = await res.text();
    let data: { response?: { jeux?: SsGame[] } };
    try {
      data = JSON.parse(text);
    } catch {
      return json(req, { error: "Réponse ScreenScraper illisible" }, 502);
    }

    // Le jeu dont un nom correspond exactement au titre, sinon le premier résultat (classés par probabilité).
    const games = (data.response?.jeux ?? []).filter((g) => g && g.id);
    const wanted = norm(title);
    const game = games.find((g) => (g.noms ?? []).some((n) => n.text && norm(n.text) === wanted)) ?? games[0];
    if (!game) return json(req, { back_url: null, disc_url: null, found: false });
    const medias = game.medias ?? [];

    async function copy(m: SsMedia | null, kind: "back" | "disc", minBytes: number): Promise<string | null> {
      const url = m?.url ? safeUrl(m.url) : null;
      if (!url) return null;
      const img = await fetch(url);
      const type = img.headers.get("content-type") ?? "";
      if (!img.ok || !type.startsWith("image/")) return null; // « NOMEDIA » ou erreur
      const bytes = new Uint8Array(await img.arrayBuffer());
      if (bytes.byteLength < minBytes || bytes.byteLength > MAX_BYTES) return null; // scan raté ou trop lourd
      const ext = type.includes("png") ? "png" : "jpg";
      const path = `${uid}/ss-${kind}-${game!.id}.${ext}`;
      const { error } = await supabase.storage.from("covers").upload(path, bytes, { contentType: type, upsert: true });
      if (error) throw error;
      return supabase.storage.from("covers").getPublicUrl(path).data.publicUrl;
    }

    const [back, disc] = await Promise.allSettled([
      copy(pick(medias, /^box-2D-back$/i), "back", 20 * 1024), // en dessous de 20 Ko, le scan est inexploitable
      copy(pick(medias, /^support-2D$/i) ?? pick(medias, /^support-texture$/i), "disc", 4 * 1024),
    ]);
    const name = game.noms?.find((n) => n.region === "fr" || n.region === "eu")?.text ?? game.noms?.[0]?.text ?? null;
    return json(req, {
      found: true,
      ss_id: game.id,
      name,
      back_url: back.status === "fulfilled" ? back.value : null,
      disc_url: disc.status === "fulfilled" ? disc.value : null,
    });
  } catch (e) {
    console.error(e);
    return json(req, { error: (e as Error).message }, 500);
  }
});
