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
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10", xi: "11", xii: "12", xiii: "13", xvi: "16" };

/**
 * Mots comparables d'un titre : sans accents ni ponctuation, chiffres romains en chiffres (« II » = « 2 »),
 * « Δ » lu « delta » (Metal Gear Solid Δ), « & » lu « and ».
 */
export function titleWords(s: string): string[] {
  return s
    .replace(/[ΔΔ]/g, " delta ")
    .replace(/&/g, " and ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => ROMAN[w] ?? w);
}

export const normTitle = (s: string) => titleWords(s).join("");

// Mentions d'édition ajoutées par IGDB ou par l'utilisateur, absentes des fiches LaunchBox.
const EDITION_SUFFIX =
  /\s*(?:[-–—:]\s*)?(?:(?:the\s+)?(?:complete|deluxe|gold|ultimate|definitive|digital deluxe|special|standard|launch|day one|collector'?s|enhanced|remastered)(?:\s+edition)?|game of the year(?:\s+edition)?|goty(?:\s+edition)?|director'?s cut)\s*$/i;

/** Titres à essayer dans la recherche LaunchBox : le titre tel quel, puis sans sa mention d'édition. */
export function searchTerms(title: string): string[] {
  const t = title.trim();
  const out = [t];
  let base = t;
  for (let i = 0; i < 3 && EDITION_SUFFIX.test(base); i++) base = base.replace(EDITION_SUFFIX, "").trim();
  if (base && base !== t) out.push(base);
  const beforeDash = t.split(/\s+[–—-]\s+/)[0].trim();
  if (beforeDash && !out.includes(beforeDash)) out.push(beforeDash);
  return out;
}

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
  if (plain ?? prefixed[0]) return plain ?? prefixed[0];
  // Titre LaunchBox qui contient tous les mots cherchés (« Final Fantasy VII Remake: Rebirth » pour
  // « Final Fantasy VII Rebirth ») : le plus court, édition standard d'abord.
  const words = titleWords(title);
  if (words.length < 2) return null;
  const containing = onPlatform
    .filter((r) => {
      const have = new Set(titleWords(r.title));
      return words.every((w) => have.has(w));
    })
    .sort((a, b) => Number(special.test(a.title)) - Number(special.test(b.title)) || a.title.length - b.title.length);
  return containing[0] ?? null;
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

/** Toutes les images d'un type, de la meilleure région à la moins bonne (européennes d'abord). */
export function rankImages(images: LbImage[], type: string): LbImage[] {
  const rank = (i: LbImage) => {
    const r = i.region ? LB_REGIONS.indexOf(i.region) : -1;
    return r === -1 ? LB_REGIONS.length : r;
  };
  return images.filter((i) => i.type === type).sort((a, b) => rank(a) - rank(b));
}

/** La meilleure image d'un type, région européenne d'abord. */
export function pickImage(images: LbImage[], type: string): LbImage | null {
  return rankImages(images, type)[0] ?? null;
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
