import { functionMessage } from "./covers";
import { supabase } from "./supabase";
import type { Condition, Edition, Game, GamePatch } from "./types";

export interface Offer {
  title: string;
  price: number;
  shipping: number | null;
  url: string;
  seller: string | null;
  feedback: number | null;
  image: string | null;
}

export interface Estimate {
  value: number;
  low: number;
  high: number;
  n: number;
  confidence: "high" | "medium" | "low";
  basis: string;
}

export interface MarketResult {
  estimate: Estimate | null;
  /** Les trois cotes à la fois (neuf, complet, disque seul). */
  estimates?: Record<Condition, Estimate | null>;
  condition: Condition;
  edition: Edition;
  collector_exists: boolean;
  offers: { new: Offer[]; used: Offer[] };
  listings: number;
  checked_at: string;
}

export class MarketNotConfigured extends Error {}
export class MarketQuotaReached extends Error {}

export const CONDITIONS: Array<{ id: Condition; label: string; hint: string }> = [
  { id: "loose", label: "Disque seul", hint: "sans boîte ni notice" },
  { id: "cib", label: "Complet", hint: "boîte, jaquette et disque" },
  { id: "new", label: "Neuf", hint: "sous blister" },
];

export const conditionOf = (g: Pick<Game, "condition">): Condition => g.condition ?? "cib";

/** Cote et offres eBay France pour un jeu, selon son état et son édition (fonction market-price). */
export async function fetchMarket(g: Pick<Game, "title" | "platform"> & Partial<Pick<Game, "condition" | "edition">>): Promise<MarketResult> {
  if (!supabase) throw new MarketNotConfigured("L'estimation des prix n'est pas disponible en mode démo.");
  const { data, error } = await supabase.functions.invoke<MarketResult>("market-price", {
    body: { title: g.title, platform: g.platform, condition: conditionOf({ condition: g.condition ?? null }), edition: g.edition ?? "standard" },
  });
  if (error) {
    const status = (error as { context?: Response }).context?.status;
    const msg = await functionMessage(error, "Les prix n'ont pas pu être récupérés. Réessaie dans un instant.");
    if (status === 503) throw new MarketNotConfigured(msg);
    if (status === 429) throw new MarketQuotaReached(msg);
    throw new Error(msg);
  }
  return data!;
}

/** Ce qu'il faut enregistrer sur le jeu après une estimation (null partout si rien n'a été trouvé). */
export function valuePatch(r: MarketResult): GamePatch {
  const e = r.estimate;
  return { value_eur: e?.value ?? null, value_low: e?.low ?? null, value_high: e?.high ?? null, value_n: e?.n ?? 0, value_at: r.checked_at };
}

/** Valeur retenue pour un jeu : la cote saisie à la main, sinon l'estimation eBay. */
export function gameValue(g: Pick<Game, "manual_value" | "value_eur">): number | null {
  if (g.manual_value != null) return Number(g.manual_value);
  return g.value_eur != null ? Number(g.value_eur) : null;
}

export interface CollectionValue {
  /** Somme des prix d'achat connus. */
  spent: number;
  total: number;
  low: number;
  high: number;
  /** Jeux comptés dans le total / jeux de la collection. */
  valued: number;
  count: number;
  /** Jeux jamais estimés ou dont la cote a plus de 30 jours. */
  stale: number;
}

const DAY = 86_400_000;

/** Total de la collection d'après les dernières cotes enregistrées. */
export function collectionValue(games: readonly Game[], now = Date.now()): CollectionValue {
  let total = 0, low = 0, high = 0, valued = 0, stale = 0, spent = 0;
  for (const g of games) {
    if (g.purchase_price != null) spent += Number(g.purchase_price);
    if (g.manual_value != null) {
      const v = Number(g.manual_value);
      total += v;
      low += v;
      high += v;
      valued++;
    } else if (g.value_eur != null) {
      total += Number(g.value_eur);
      low += Number(g.value_low ?? g.value_eur);
      high += Number(g.value_high ?? g.value_eur);
      valued++;
    }
    if (g.manual_value == null && (!g.value_at || now - new Date(g.value_at).getTime() > 30 * DAY)) stale++;
  }
  return { spent, total, low, high, valued, count: games.length, stale };
}

export const euros = (n: number, digits = 0) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: digits, minimumFractionDigits: digits });

/** Page de recherche PriceCharting (consultation par l'utilisateur ; leurs prix ne peuvent pas être repris dans l'appli). */
export function priceChartingUrl(g: Pick<Game, "title" | "platform">): string {
  return `https://www.pricecharting.com/fr/search-products?type=prices&q=${encodeURIComponent(`${g.title} PAL ${g.platform.toUpperCase()}`)}`;
}

/** « 12,5 » ou « 12.50 » → 12.5 ; vide → null ; invalide → undefined. */
export function parseEuros(s: string): number | null | undefined {
  const t = s.trim().replace(/\s|€/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100000 ? Math.round(n * 100) / 100 : undefined;
}

/** Boutiques françaises reconnues : recherche du jeu en un clic. */
export function storeLinks(g: Pick<Game, "title" | "platform">): Array<{ name: string; kind: string; url: string }> {
  const label = g.platform.toUpperCase();
  const q = encodeURIComponent(`${g.title} ${label}`);
  const qt = encodeURIComponent(g.title);
  return [
    { name: "PlayStation Store", kind: "Numérique officiel", url: `https://store.playstation.com/fr-fr/search/${qt}` },
    { name: "Fnac", kind: "Physique", url: `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${q}` },
    { name: "Micromania", kind: "Physique · neuf et occasion", url: `https://www.micromania.fr/search?q=${q}` },
    { name: "E.Leclerc", kind: "Physique", url: `https://www.e.leclerc/recherche?q=${q}` },
    { name: "Carrefour", kind: "Physique", url: `https://www.carrefour.fr/s?q=${q}` },
    { name: "Amazon.fr", kind: "Vendu et expédié par Amazon", url: `https://www.amazon.fr/s?k=${q}&rh=p_6%3AA1X6FK5RDHNB96` },
    { name: "leDénicheur", kind: "Comparateur de prix", url: `https://ledenicheur.fr/search?search=${q}` },
    { name: "Dealabs", kind: "Bons plans", url: `https://www.dealabs.com/search?q=${q}` },
  ];
}
