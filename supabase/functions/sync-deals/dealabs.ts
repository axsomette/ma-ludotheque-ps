// Lecture des flux RSS publics de Dealabs (bons plans : jeu, boutique, prix). Module pur, testé avec Vitest,
// inclus tel quel dans la fonction sync-deals.

export type Platform = "ps3" | "ps4" | "ps5";

export interface Deal {
  id: string; // « dealabs:<numéro du bon plan> », unique
  title: string;
  merchant: string | null;
  price: number | null;
  link: string;
  image: string | null;
  platform: Platform | null;
  published_at: string; // ISO
  /** Promo signalée comme terminée sur Dealabs. */
  is_expired: boolean;
}

/** Numéro du bon plan, quelle que soit la forme de l'adresse (…/bons-plans/titre-3469009, …/share-deal/3469009). */
export function threadId(link: string): string | null {
  return link.match(/(\d{4,})(?:[/?#].*)?$/)?.[1] ?? null;
}

/** Flux lus, et la plateforme qu'ils concernent (null : à déduire du titre). */
export const FEEDS: Array<{ url: string; platform: Platform | null }> = [
  { url: "https://www.dealabs.com/rss/groupe/jeux-playstation-5", platform: "ps5" },
  { url: "https://www.dealabs.com/rss/groupe/jeux-playstation-4", platform: "ps4" },
  { url: "https://www.dealabs.com/rss/groupe/playstation-5", platform: "ps5" },
  { url: "https://www.dealabs.com/rss/groupe/playstation-4", platform: "ps4" },
  { url: "https://www.dealabs.com/rss/groupe/jeux-video", platform: null },
];

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();

/** « 69,99€ », « 1 299,00 € », « Gratuit » → nombre (0 pour gratuit), sinon null. */
export function parsePrice(s: string | undefined | null): number | null {
  if (!s) return null;
  if (/gratuit|free/i.test(s)) return 0;
  const m = s.replace(/\s| | /g, "").match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n < 100000 ? n : null;
}

const TO_ARABIC: Record<string, string> = { II: "2", III: "3", IV: "4", V: "5", VI: "6", VII: "7", VIII: "8", IX: "9", X: "10", XI: "11", XII: "12", XIII: "13", XVI: "16" };
const TO_ROMAN = Object.fromEntries(Object.entries(TO_ARABIC).map(([r, a]) => [a, r]));

/**
 * Recherches à lancer pour un titre : tel quel, puis avec les numéros écrits autrement
 * (« Code Vein II » → « Code Vein 2 » ; « Red Dead Redemption 2 » → « Red Dead Redemption II »).
 */
export function searchVariants(title: string): string[] {
  const t = title.replace(/\s+/g, " ").trim();
  const arabic = t.replace(/\b(XVI|XIII|XII|XI|IX|X|VIII|VII|VI|IV|V|III|II)\b/g, (m) => TO_ARABIC[m] ?? m);
  const roman = t.replace(/\b(1[0-3]|16|[2-9])\b/g, (m) => TO_ROMAN[m] ?? m);
  return [...new Set([t, arabic, roman])].slice(0, 3);
}

/** Plateforme d'après le titre du bon plan (PS5 avant PS4 : « PS4/PS5 » compte comme PS5). */
export function platformOf(title: string): Platform | null {
  if (/\b(ps ?5|playstation ?5)\b/i.test(title)) return "ps5";
  if (/\b(ps ?4|playstation ?4)\b/i.test(title)) return "ps4";
  if (/\b(ps ?3|playstation ?3)\b/i.test(title)) return "ps3";
  return null;
}

/** Bons plans d'un flux RSS Dealabs. Seuls ceux qui concernent une console PlayStation sont gardés. */
export function parseFeed(xml: string, feedPlatform: Platform | null): Deal[] {
  const out: Deal[] = [];
  for (const it of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
    const tag = (name: string) => it.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1];
    const title = decode(tag("title") ?? "");
    const link = decode(tag("link") ?? "");
    if (!title || !/^https:\/\/www\.dealabs\.com\//.test(link)) continue;
    const merchantTag = it.match(/<pepper:merchant\b[^>]*>/)?.[0] ?? "";
    const attr = (n: string) => merchantTag.match(new RegExp(`${n}="([^"]*)"`))?.[1];
    const platform = platformOf(title) ?? feedPlatform;
    if (!platform) continue;
    const date = new Date(tag("pubDate") ?? "");
    const image = it.match(/<media:content[^>]*url="([^"]+)"/)?.[1] ?? null;
    const num = threadId(link);
    if (!num) continue;
    out.push({
      id: `dealabs:${num}`,
      title: title.slice(0, 300),
      merchant: attr("name") ? decode(attr("name")!).slice(0, 80) : null,
      price: parsePrice(attr("price") ? decode(attr("price")!) : null),
      link,
      image: image && /^https:\/\/static-pepper\.dealabs\.com\//.test(image) ? image : null,
      platform,
      published_at: (Number.isNaN(date.getTime()) ? new Date() : date).toISOString(),
      is_expired: false,
    });
  }
  return out;
}

/**
 * Bons plans d'une page de recherche Dealabs (https://www.dealabs.com/search?q=…). Chaque bon plan y est décrit
 * par un composant (attribut data-vue3) dont les propriétés « thread » donnent titre, prix, boutique, date et statut.
 * Seuls les bons plans PlayStation sont gardés.
 */
export function parseSearch(html: string): Deal[] {
  const out: Deal[] = [];
  for (const m of html.matchAll(/data-vue3=(?:'([^']*)'|"([^"]*)")/g)) {
    // deno-lint-ignore no-explicit-any
    let j: any;
    try {
      j = JSON.parse(decode(m[1] ?? m[2] ?? ""));
    } catch {
      continue;
    }
    const t = j?.props?.thread;
    if (!t || typeof t.title !== "string") continue;
    const title = decode(t.title).slice(0, 300);
    const platform = platformOf(title);
    const link = String(t.shareableLink ?? t.link ?? "");
    const num = threadId(link) ?? (t.threadId != null ? String(t.threadId) : null);
    if (!platform || !num || !/^https:\/\/www\.dealabs\.com\//.test(link)) continue;
    const price = typeof t.price === "number" && t.price >= 0 && t.price < 100000 ? t.price : null;
    const when = typeof t.publishedAt === "number" ? new Date(t.publishedAt * 1000) : new Date();
    out.push({
      id: `dealabs:${num}`,
      title,
      merchant: typeof t.merchant?.merchantName === "string" ? t.merchant.merchantName.slice(0, 80) : null,
      price,
      link,
      image: null,
      platform,
      published_at: when.toISOString(),
      is_expired: t.isExpired === true,
    });
  }
  return [...new Map(out.map((d) => [d.id, d])).values()];
}
