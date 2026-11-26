import { matches, type Edition } from "../../supabase/functions/market-price/market";
import { LABEL, RELATED } from "../../supabase/functions/_shared/platforms";
import { supabase } from "./supabase";
import type { Platform } from "./types";

export interface StoreDeal {
  id: string;
  title: string;
  merchant: string | null;
  price: number;
  link: string;
  published_at: string;
  is_expired: boolean;
  platform?: Platform;
}

const DAYS = 90;

/**
 * Meilleur prix repéré par boutique pour ce jeu (bons plans Dealabs des 90 derniers jours),
 * du moins cher au plus cher. Relance d'abord la collecte (au plus une fois par quart d'heure côté serveur).
 */
export async function findDeals(title: string, platform: Platform, edition: Edition = "standard"): Promise<StoreDeal[]> {
  if (!supabase) return [];
  // Recherche ciblée du jeu sur Dealabs (côté serveur), puis lecture de tout ce qui est connu.
  await supabase.functions.invoke("sync-deals", { body: { q: title } }).catch(() => undefined);
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("deals")
    .select("id,title,merchant,price,link,published_at,is_expired,platform")
    .in("platform", RELATED[platform])
    .gte("published_at", since)
    .not("price", "is", null)
    .order("published_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error("Les bons plans n'ont pas pu être chargés.");
  return bestByMerchant((data ?? []) as StoreDeal[], title, platform, edition);
}

/**
 * Bons plans du jeu (titre, plateforme, édition), le moins cher par boutique, triés par prix.
 * Les promos en cours d'abord ; s'il n'y en a aucune, les promos terminées servent de repère (is_expired).
 */
export function bestByMerchant(rows: StoreDeal[], title: string, platform: Platform, edition: Edition): StoreDeal[] {
  // Un bon plan sans console dans son titre (flux d'une console précise) reçoit celle de sa ligne.
  const mine = rows.filter((r) => matches({ title: `${r.title} ${LABEL[r.platform ?? platform]}` }, title, platform, edition));
  const active = mine.filter((r) => !r.is_expired);
  return cheapestPerMerchant(active.length ? active : mine);
}

function cheapestPerMerchant(rows: StoreDeal[]): StoreDeal[] {
  const best = new Map<string, StoreDeal>();
  for (const r of rows) {
    const key = (r.merchant ?? "Autre").toLowerCase();
    const cur = best.get(key);
    if (!cur || Number(r.price) < Number(cur.price)) best.set(key, { ...r, price: Number(r.price) });
  }
  return [...best.values()].sort((a, b) => a.price - b.price);
}
