import { RELATED } from "../../supabase/functions/_shared/platforms";
import { bestByMerchant, type StoreDeal } from "./deals";
import { supabase } from "./supabase";
import type { CoverCandidate, Platform } from "./types";

/** Un jeu de la liste d'envies. */
export interface WishItem {
  id: string;
  title: string;
  platform: Platform;
  igdb_id: number | null;
  thumb_url: string | null;
  /** Fiche IGDB, pour ranger le jeu dans la collection une fois acheté. */
  candidate: CoverCandidate | null;
  max_price: number | null;
  /** Meilleur prix déjà vu par l'utilisateur (sert à signaler une baisse). */
  last_seen_price: number | null;
  created_at: string;
}

const COLUMNS = "id,title,platform,igdb_id,thumb_url,candidate,max_price,last_seen_price,created_at";
const LOCAL_KEY = "ludotheque-demo-wishlist";

function readLocal(): WishItem[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as WishItem[];
  } catch {
    return [];
  }
}
function writeLocal(items: WishItem[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
  } catch {
    // stockage indisponible : la démo reste en mémoire
  }
}

const num = (v: unknown) => (v == null ? null : Number(v));
const norm = (w: WishItem): WishItem => ({ ...w, max_price: num(w.max_price), last_seen_price: num(w.last_seen_price) });

export async function listWishlist(): Promise<WishItem[]> {
  if (!supabase) return readLocal();
  const { data, error } = await supabase.from("wishlist").select(COLUMNS).order("created_at", { ascending: false });
  if (error) throw new Error("Ta liste d'envies n'a pas pu être chargée.");
  return (data as WishItem[]).map(norm);
}

/** Ajoute un jeu trouvé sur IGDB, avec un prix maximum facultatif. */
export async function addWish(c: CoverCandidate, platform: Platform, max_price: number | null, last_seen_price: number | null): Promise<WishItem> {
  const row = { title: c.name, platform, igdb_id: c.igdb_id, thumb_url: c.thumb_url.startsWith("data:") ? null : c.thumb_url, candidate: c.thumb_url.startsWith("data:") ? { ...c, thumb_url: "" } : c, max_price, last_seen_price };
  if (!supabase) {
    const item: WishItem = { ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    writeLocal([item, ...readLocal()]);
    return item;
  }
  const { data, error } = await supabase.from("wishlist").insert(row).select(COLUMNS).single();
  if (error) throw new Error(error.code === "23505" ? "Ce jeu est déjà dans ta liste d'envies." : "Le jeu n'a pas pu être ajouté à ta liste d'envies.");
  return norm(data as WishItem);
}

export async function updateWish(id: string, patch: Partial<Pick<WishItem, "max_price" | "last_seen_price">>): Promise<WishItem> {
  if (!supabase) {
    const list = readLocal();
    const i = list.findIndex((w) => w.id === id);
    if (i < 0) throw new Error("Envie introuvable");
    list[i] = { ...list[i], ...patch };
    writeLocal(list);
    return list[i];
  }
  const { data, error } = await supabase.from("wishlist").update(patch).eq("id", id).select(COLUMNS).single();
  if (error) throw new Error("La modification n'a pas pu être enregistrée.");
  return norm(data as WishItem);
}

export async function removeWish(id: string): Promise<void> {
  if (!supabase) {
    writeLocal(readLocal().filter((w) => w.id !== id));
    return;
  }
  const { error } = await supabase.from("wishlist").delete().eq("id", id);
  if (error) throw new Error("Le jeu n'a pas pu être retiré de ta liste d'envies.");
}

/** Le jeu (titre ou fiche IGDB, plateforme) est-il déjà dans la liste ? */
export function findWish(items: readonly WishItem[], c: Pick<CoverCandidate, "igdb_id" | "name">, platform: Platform): WishItem | null {
  return (
    items.find((w) => w.platform === platform && (c.igdb_id != null && w.igdb_id != null ? w.igdb_id === c.igdb_id : w.title.toLowerCase() === c.name.toLowerCase())) ?? null
  );
}

export type WishAlert = "target" | "drop" | null;

export interface WishPrice {
  /** Meilleur prix actuel (promo en cours), ou null. */
  best: StoreDeal | null;
  alert: WishAlert;
}

/** Alerte : prix sous le maximum demandé, sinon baisse par rapport au dernier prix vu. */
export function alertFor(w: Pick<WishItem, "max_price" | "last_seen_price">, best: StoreDeal | null): WishAlert {
  if (!best || best.is_expired) return null;
  if (w.max_price != null && best.price <= w.max_price) return "target";
  if (w.last_seen_price != null && best.price < w.last_seen_price - 0.005) return "drop";
  return null;
}

/** Meilleur prix et alerte de chaque envie, d'après les bons plans des 90 derniers jours (une seule lecture). */
export async function wishPrices(items: readonly WishItem[]): Promise<Map<string, WishPrice>> {
  const out = new Map<string, WishPrice>();
  if (!supabase || !items.length) return out;
  const platforms = [...new Set(items.flatMap((w) => RELATED[w.platform]))];
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("deals")
    .select("id,title,merchant,price,link,published_at,is_expired,platform")
    .in("platform", platforms)
    .gte("published_at", since)
    .not("price", "is", null)
    .order("published_at", { ascending: false })
    .limit(5000);
  const rows = (data ?? []) as StoreDeal[];
  for (const w of items) {
    const all = bestByMerchant(rows, w.title, w.platform, "standard");
    const best = all.find((d) => !d.is_expired) ?? null;
    out.set(w.id, { best, alert: alertFor(w, best) });
  }
  return out;
}
