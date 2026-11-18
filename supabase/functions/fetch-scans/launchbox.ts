// Lecture des pages publiques de LaunchBox Games DB (gamesdb.launchbox-app.com), sans compte ni clé.
// Module pur (aucune dépendance) : testé avec Vitest, inclus tel quel dans la fonction fetch-scans.

export type Platform = "ps3" | "ps4" | "ps5";

export const LB_PLATFORM: Record<Platform, string> = {
  ps5: "Sony Playstation 5",
  ps4: "Sony Playstation 4",
  ps3: "Sony Playstation 3",
};

/** Ordre de préférence des régions : versions européennes d'abord. */
export const LB_REGIONS = ["France", "Europe", "United Kingdom", "Germany", "Spain", "Italy", "World", "North America", "Japan"];

export interface LbResult {
  id: string;
  title: string;
  platform: string;
}

export interface LbImage {
  type: string; // « Box - Back », « Disc », « Box - Front »…
  region: string | null;
  url: string;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

export const normTitle = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Cartes de la page de résultats : identifiant, titre, plateforme. */
export function parseResults(html: string): LbResult[] {
  const out: LbResult[] = [];
  const parts = html.split('href="/games/details/').slice(1);
  for (const part of parts) {
    const id = part.match(/^(\d+)/)?.[1];
    const title = part.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1];
    const platform = part.match(/<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/)?.[1];
    if (id && title && platform && !out.some((r) => r.id === id)) out.push({ id, title: decode(title), platform: decode(platform) });
  }
  return out;
}

/**
 * Le bon jeu pour un titre et une plateforme : titre identique, sinon titre suivi d'un sous-titre
 * (« Gran Turismo 7: The Real Driving Simulator »), en écartant les éditions spéciales si on n'en cherche pas.
 */
export function pickResult(results: LbResult[], title: string, platform: Platform): LbResult | null {
  const want = normTitle(title);
  const special = /edition|bundle|collector|pack\b|goty|game of the year/i;
  const onPlatform = results.filter((r) => r.platform.toLowerCase() === LB_PLATFORM[platform].toLowerCase());
  const exact = onPlatform.find((r) => normTitle(r.title) === want);
  if (exact) return exact;
  const prefixed = onPlatform.filter((r) => normTitle(r.title).startsWith(want) && want.length >= 3);
  const plain = prefixed.find((r) => !special.test(r.title) || special.test(title));
  return plain ?? prefixed[0] ?? null;
}

/** Images de la page « images » d'un jeu : type, région et adresse. */
export function parseImages(html: string): LbImage[] {
  const out: LbImage[] = [];
  for (const m of html.matchAll(/<a\b[^>]*data-toggle="lightbox"[^>]*>/g)) {
    const tag = m[0];
    const url = tag.match(/href="([^"]+)"/)?.[1];
    const t = tag.match(/data-title="([^"]+)"/)?.[1];
    if (!url || !t) continue;
    const label = decode(t).match(/ - ((?:Box|Disc|Cart|Clear|Screenshot|Fanart|Banner)[^]*?) Image(?: \(([^)]+)\))?$/);
    if (!label) continue;
    out.push({ type: label[1], region: label[2] ?? null, url });
  }
  return out;
}

/** La meilleure image d'un type, région européenne d'abord. */
export function pickImage(images: LbImage[], type: string): LbImage | null {
  const found = images.filter((i) => i.type === type);
  if (!found.length) return null;
  const rank = (i: LbImage) => {
    const r = i.region ? LB_REGIONS.indexOf(i.region) : -1;
    return r === -1 ? LB_REGIONS.length : r;
  };
  return [...found].sort((a, b) => rank(a) - rank(b))[0];
}

/** N'accepte que les images hébergées par LaunchBox (aucune requête vers une adresse arbitraire). */
export function safeImageUrl(u: string): URL | null {
  try {
    const url = new URL(u);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "images.launchbox-app.com") return null;
    return url;
  } catch {
    return null;
  }
}
