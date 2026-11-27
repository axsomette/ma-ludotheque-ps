import { cleanPrices, percentile, type Condition } from "../../supabase/functions/market-price/market";
import type { Estimate } from "./market";

/**
 * Décote d'occasion appliquée au prix neuf constaté. Repères du marché français de l'occasion :
 * un jeu complet se revend autour de 60 % de son prix neuf du moment, le disque seul autour de 40 %.
 */
export const DEPRECIATION: Record<Condition, number> = { new: 1, cib: 0.62, loose: 0.42 };

const round = (n: number) => Math.round(n * 2) / 2;

/**
 * Cote estimée d'un jeu à partir des prix neufs repérés sur Dealabs (promos en cours ou terminées des 6 derniers mois) :
 * prix neuf « de marché » = médiane des prix sans les aberrations, puis décote selon l'état.
 * Estimation indicative (jamais « fiable ») : remplacée par la cote eBay dès qu'elle est disponible.
 */
export function estimateFromDeals(prices: number[], condition: Condition): Estimate | null {
  const s = cleanPrices(prices.filter((p) => p > 0));
  if (!s.length) return null;
  const k = DEPRECIATION[condition];
  const mid = percentile(s, 0.5);
  const lo = s.length > 1 ? percentile(s, 0.2) : mid * 0.85;
  const hi = s.length > 1 ? percentile(s, 0.8) : mid * 1.15;
  const n = s.length;
  const what = condition === "new" ? "prix neufs" : "prix neufs, décote d'occasion appliquée";
  return {
    value: round(mid * k),
    low: round(Math.min(lo, mid) * k * 0.9),
    high: round(Math.max(hi, mid) * k * 1.1),
    n,
    confidence: n >= 5 ? "medium" : "low",
    basis: `Estimation d'après ${n} ${n > 1 ? "prix repérés" : "prix repéré"} sur Dealabs (${what})`,
  };
}
