// Liste d'envies : alertes de prix et doublons.
import { describe, expect, it } from "vitest";
import type { StoreDeal } from "../src/lib/deals";
import { alertFor, findWish, type WishItem } from "../src/lib/wishlist";

const deal = (price: number, is_expired = false): StoreDeal => ({ id: "d", title: "x", merchant: "Fnac", price, link: "https://www.dealabs.com/bons-plans/x-3400000", published_at: "2026-11-20T00:00:00Z", is_expired });
const wish = (o: Partial<WishItem> = {}): WishItem => ({
  id: "w", title: "Mario Kart World", platform: "switch2", igdb_id: 300, thumb_url: null, candidate: null, max_price: null, last_seen_price: null, created_at: "", ...o,
});

describe("alertes de prix", () => {
  it("prix sous le maximum demandé", () => {
    expect(alertFor(wish({ max_price: 50 }), deal(49.99))).toBe("target");
    expect(alertFor(wish({ max_price: 40 }), deal(49.99))).toBeNull();
  });
  it("baisse depuis le dernier prix vu", () => {
    expect(alertFor(wish({ last_seen_price: 59.99 }), deal(54.99))).toBe("drop");
    expect(alertFor(wish({ last_seen_price: 54.99 }), deal(54.99))).toBeNull();
  });
  it("rien sans promo en cours", () => {
    expect(alertFor(wish({ max_price: 100 }), null)).toBeNull();
    expect(alertFor(wish({ max_price: 100 }), deal(10, true))).toBeNull();
  });
});

describe("déjà dans la liste", () => {
  const items = [wish()];
  it("même fiche IGDB sur la même console", () => {
    expect(findWish(items, { igdb_id: 300, name: "Autre nom" }, "switch2")?.id).toBe("w");
    expect(findWish(items, { igdb_id: 300, name: "Mario Kart World" }, "switch")).toBeNull();
  });
  it("sans fiche IGDB, même titre", () => {
    expect(findWish([wish({ igdb_id: null })], { igdb_id: null, name: "mario kart world" }, "switch2")?.id).toBe("w");
  });
});
