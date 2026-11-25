// Estimation de la cote d'un jeu à partir des annonces eBay France (module pur, testé avec Vitest,
// inclus tel quel dans la fonction market-price).
//
// Les annonces sont des prix demandés, pas des ventes conclues : on écarte les annonces hors sujet
// (lots, consoles, boîtiers vides, codes…), les prix aberrants, puis on prend un prix « bas de marché »
// (40e centile) plutôt que la moyenne, plus proche de ce qu'un jeu se vend vraiment.

export type Platform = "ps3" | "ps4" | "ps5";
export type Condition = "loose" | "cib" | "new";
export type Edition = "standard" | "collector";

export interface Listing {
  title: string;
  price: number;
  shipping: number | null;
  /** true : neuf (sous blister) ; false : occasion. */
  isNew: boolean;
  url: string;
  seller: string | null;
  sellerFeedback: number | null; // pourcentage d'avis positifs
  sellerScore: number | null; // nombre d'évaluations
  image: string | null;
}

export interface Estimate {
  value: number;
  low: number;
  high: number;
  /** Nombre d'annonces retenues pour ce calcul. */
  n: number;
  confidence: "high" | "medium" | "low";
  /** Comment la valeur a été obtenue (affiché sous l'estimation). */
  basis: string;
}

const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10", xi: "11", xii: "12", xiii: "13", xvi: "16" };
const STOP = new Set(["the", "of", "a", "an", "and", "le", "la", "les", "de", "du", "des", "et", "edition", "game"]);

/** Mots significatifs d'un titre (sans accents, ponctuation ni mots vides ; II = 2 ; Δ = delta). */
export function words(s: string): string[] {
  return s
    .replace(/[ΔΔ]/g, " delta ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]s\b/g, "s")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => ROMAN[w] ?? w);
}

const PLATFORM_RE: Record<Platform, RegExp> = {
  ps5: /\b(ps ?5|playstation ?5)\b/i,
  ps4: /\b(ps ?4|playstation ?4)\b/i,
  ps3: /\b(ps ?3|playstation ?3)\b/i,
};

// Annonces qui ne sont pas « le jeu seul » : lots, consoles, accessoires, boîtiers vides, codes, guides…
const JUNK =
  /\b(lot|lots|bundle|pack|console|manette|controller|casque|volant|pedales|pedalier|boitier vide|boite vide|jaquette seule|sans (le )?jeu|notice seule|steelbook seul|code|dlc|digital|dematerialise|cle|key|guide|soluce|artbook|figurine seule|poster|affiche|carte|pass|season|abonnement|ps plus|reparation|hs)\b/i;
const COLLECTOR = /\b(collector|collectors|collector's|edition collector|limited|limitee|edition limitee|steelbook)\b/i;
const LOOSE = /\b(sans boite|sans boitier|disque seul|cd seul|loose|sans jaquette)\b/i;

/** Normalise un titre d'annonce pour les expressions ci-dessus (accents retirés). */
const flat = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Mots qui doivent tous figurer dans l'annonce (titre sans sous-titre d'édition, mots vides retirés). */
export function requiredWords(title: string): string[] {
  const base = title.replace(/\s*[-–—:]\s*(?:the\s+)?(?:complete|deluxe|gold|ultimate|definitive|standard|launch|day one|special|enhanced|director'?s cut|game of the year|goty)(?:\s+edition)?\s*$/i, "");
  return [...new Set(words(base).filter((w) => !STOP.has(w)))];
}

/** L'annonce correspond-elle à ce jeu, sur cette plateforme, dans cette édition ? */
export function matches(l: Pick<Listing, "title">, title: string, platform: Platform, edition: Edition): boolean {
  const t = flat(l.title);
  if (JUNK.test(t)) return false;
  if (!PLATFORM_RE[platform].test(t)) return false;
  const have = new Set(words(l.title));
  if (!requiredWords(title).every((w) => have.has(w))) return false;
  // Suite numérotée absente du titre cherché (« Red Dead Redemption 2 » pour « Red Dead Redemption ») : écartée.
  const want = new Set(words(title));
  const next = words(l.title).find((w) => /^\d{1,2}$/.test(w) && !want.has(w) && Number(w) > 1 && Number(w) < 20 && !["3", "4", "5"].includes(w));
  if (next) return false;
  const isCollector = COLLECTOR.test(t);
  return edition === "collector" ? isCollector : !isCollector;
}

/** Centile p (0–1) d'une liste triée. */
export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Prix sans les aberrations (moins de 40 % ou plus de 250 % de la médiane), triés. */
export function cleanPrices(prices: number[]): number[] {
  const s = prices.filter((p) => p > 0 && Number.isFinite(p)).sort((a, b) => a - b);
  if (s.length < 3) return s;
  const med = percentile(s, 0.5);
  return s.filter((p) => p >= med * 0.4 && p <= med * 2.5);
}

const round = (n: number) => Math.round(n * 2) / 2; // au demi-euro

function stats(prices: number[], basis: string, factor = 1): Estimate | null {
  const s = cleanPrices(prices);
  if (s.length < 2) return null;
  const n = s.length;
  return {
    value: round(percentile(s, 0.4) * factor),
    low: round(percentile(s, 0.15) * factor),
    high: round(percentile(s, 0.75) * factor),
    n,
    confidence: n >= 8 ? "high" : n >= 4 ? "medium" : "low",
    basis,
  };
}

/**
 * Cote d'un exemplaire selon son état :
 * - neuf : annonces neuves ; à défaut, occasion × 1,35 ;
 * - complet : annonces d'occasion (hors « disque seul ») ; à défaut, neuf × 0,7 ;
 * - disque seul : annonces « sans boîte » s'il y en a assez, sinon complet × 0,6.
 */
export function estimate(listings: Listing[], condition: Condition): Estimate | null {
  const neuf = listings.filter((l) => l.isNew).map((l) => l.price);
  const loose = listings.filter((l) => !l.isNew && LOOSE.test(flat(l.title))).map((l) => l.price);
  const complet = listings.filter((l) => !l.isNew && !LOOSE.test(flat(l.title))).map((l) => l.price);
  const n = (b: string, k: number) => `${k} annonce${k > 1 ? "s" : ""} ${b} sur eBay France`;

  if (condition === "new") {
    return stats(neuf, n("neuves", cleanPrices(neuf).length)) ?? stats(complet, `estimé d'après ${n("d'occasion", cleanPrices(complet).length)}`, 1.35);
  }
  if (condition === "cib") {
    return stats(complet, n("d'occasion", cleanPrices(complet).length)) ?? stats(neuf, `estimé d'après ${n("neuves", cleanPrices(neuf).length)}`, 0.7);
  }
  if (cleanPrices(loose).length >= 3) return stats(loose, n("« disque seul »", cleanPrices(loose).length));
  const cib = estimate(listings, "cib");
  return cib
    ? { ...cib, value: round(cib.value * 0.6), low: round(cib.low * 0.6), high: round(cib.high * 0.6), confidence: cib.confidence === "high" ? "medium" : "low", basis: `estimé d'après le prix complet (${cib.basis})` }
    : null;
}

/** Vendeur sérieux : au moins 98 % d'avis positifs sur au moins 100 évaluations. */
export const trustedSeller = (l: Listing) => (l.sellerFeedback ?? 0) >= 98 && (l.sellerScore ?? 0) >= 100;

/** Meilleures offres pour acheter : les moins chères frais de port compris, vendeurs sérieux d'abord. */
export function bestOffers(listings: Listing[], isNew: boolean, max = 4): Listing[] {
  const total = (l: Listing) => l.price + (l.shipping ?? 0);
  return listings
    .filter((l) => l.isNew === isNew && trustedSeller(l))
    .sort((a, b) => total(a) - total(b))
    .slice(0, max);
}

/** Le jeu existe-t-il en édition collector ? (assez d'annonces collector pour le même jeu) */
export function collectorExists(all: Listing[], title: string, platform: Platform): boolean {
  return all.filter((l) => matches(l, title, platform, "collector")).length >= 2;
}

/** Annonce eBay (API Browse, item_summary) → Listing. Renvoie null si le prix n'est pas en euros. */
// deno-lint-ignore no-explicit-any
export function fromEbay(it: any): Listing | null {
  const price = Number(it?.price?.value);
  if (it?.price?.currency !== "EUR" || !Number.isFinite(price)) return null;
  const ship = it?.shippingOptions?.[0]?.shippingCost;
  const cond = String(it?.conditionId ?? "");
  return {
    title: String(it?.title ?? ""),
    price,
    shipping: ship && ship.currency === "EUR" ? Number(ship.value) : null,
    isNew: cond === "1000",
    url: String(it?.itemWebUrl ?? ""),
    seller: it?.seller?.username ?? null,
    sellerFeedback: it?.seller?.feedbackPercentage != null ? Number(it.seller.feedbackPercentage) : null,
    sellerScore: it?.seller?.feedbackScore != null ? Number(it.seller.feedbackScore) : null,
    image: it?.image?.imageUrl ?? null,
  };
}
