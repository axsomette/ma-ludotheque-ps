import { createContext, useContext } from "react";
import type { CoverCandidate, Platform } from "../lib/types";
import type { WishItem, WishPrice } from "../lib/wishlist";

export interface WishlistApi {
  items: WishItem[];
  prices: Map<string, WishPrice>;
  add: (c: CoverCandidate, platform: Platform, maxPrice: number | null, currentBest: number | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
  update: (id: string, patch: Partial<Pick<WishItem, "max_price" | "last_seen_price">>) => Promise<void>;
  /** Jeu acheté : rangé dans la collection (jaquette, captures), puis retiré de la liste. */
  bought: (w: WishItem | null, c: CoverCandidate, platform: Platform) => Promise<void>;
}

export const WishlistContext = createContext<WishlistApi | null>(null);

export function useWishlist(): WishlistApi | null {
  return useContext(WishlistContext);
}
