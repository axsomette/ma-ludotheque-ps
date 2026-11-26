// Estimation de la cote à partir d'annonces eBay.
import { describe, expect, it } from "vitest";
import { bestOffers, cleanPrices, collectorExists, estimate, fromEbay, matches, type Listing } from "../supabase/functions/market-price/market";

const L = (title: string, price: number, isNew = false, extra: Partial<Listing> = {}): Listing => ({
  title, price, isNew, shipping: 0, url: "https://www.ebay.fr/itm/1", seller: "v", sellerFeedback: 99.5, sellerScore: 500, image: null, ...extra,
});

describe("pertinence des annonces", () => {
  const T = "Red Dead Redemption 2";
  it("garde le bon jeu sur la bonne plateforme", () => {
    expect(matches(L("Red Dead Redemption 2 PS4 complet FR", 20), T, "ps4", "standard")).toBe(true);
    expect(matches(L("Red Dead Redemption II - PlayStation 4", 20), T, "ps4", "standard")).toBe(true);
  });
  it("écarte autre plateforme, suite, lot, console, boîtier vide, collector", () => {
    expect(matches(L("Red Dead Redemption 2 Xbox One", 20), T, "ps4", "standard")).toBe(false);
    expect(matches(L("Red Dead Redemption PS3", 20), "Red Dead Redemption", "ps3", "standard")).toBe(true);
    expect(matches(L("Red Dead Redemption 2 PS3", 20), "Red Dead Redemption", "ps3", "standard")).toBe(false);
    expect(matches(L("Lot 5 jeux PS4 dont Red Dead Redemption 2", 40), T, "ps4", "standard")).toBe(false);
    expect(matches(L("Console PS4 Pro + Red Dead Redemption 2", 250), T, "ps4", "standard")).toBe(false);
    expect(matches(L("Red Dead Redemption 2 PS4 boîte vide", 3), T, "ps4", "standard")).toBe(false);
    expect(matches(L("Red Dead Redemption 2 PS4 édition collector", 300), T, "ps4", "standard")).toBe(false);
    expect(matches(L("Red Dead Redemption 2 PS4 édition collector", 300), T, "ps4", "collector")).toBe(true);
  });
  it("un mot du titre n'est pas exclu (« Code Vein » n'est pas un code de téléchargement)", () => {
    expect(matches(L("Code Vein II sur PS5", 22), "Code Vein II", "ps5", "standard")).toBe(true);
    expect(matches(L("Code PSN Code Vein II PS5", 22), "Code Vein II", "ps5", "standard")).toBe(false);
  });
  it("détecte une édition collector", () => {
    const all = [L("Red Dead Redemption 2 Collector PS4", 250), L("Red Dead Redemption 2 PS4 collector's box", 280), L("Red Dead Redemption 2 PS4", 20)];
    expect(collectorExists(all, T, "ps4")).toBe(true);
    expect(collectorExists(all.slice(2), T, "ps4")).toBe(false);
  });
});

describe("estimation", () => {
  const used = [12, 14, 15, 15, 16, 18, 19, 20, 22, 90].map((p) => L("Jeu PS4", p));
  const neuf = [30, 32, 35, 36].map((p) => L("Jeu PS4 neuf sous blister", p, true));
  const loose = [6, 7, 8].map((p) => L("Jeu PS4 disque seul", p));

  it("retire les prix aberrants", () => {
    expect(cleanPrices([1, 15, 16, 18, 20, 90])).toEqual([15, 16, 18, 20]);
  });
  it("complet : bas de marché des annonces d'occasion", () => {
    const e = estimate(used, "cib")!;
    expect(e.value).toBeGreaterThanOrEqual(15);
    expect(e.value).toBeLessThanOrEqual(17);
    expect(e.low).toBeLessThanOrEqual(e.value);
    expect(e.high).toBeGreaterThanOrEqual(e.value);
    expect(e.n).toBe(9); // 90 € écarté
    expect(e.confidence).toBe("high");
  });
  it("neuf : annonces neuves, sinon occasion majorée", () => {
    expect(estimate([...used, ...neuf], "new")!.value).toBeGreaterThan(30);
    expect(estimate(used, "new")!.basis).toContain("estimé d'après");
  });
  it("disque seul : annonces dédiées s'il y en a assez, sinon 60 % du complet", () => {
    expect(estimate([...used, ...loose], "loose")!.value).toBeLessThan(9);
    const fromCib = estimate(used, "loose")!;
    expect(fromCib.value).toBeCloseTo(estimate(used, "cib")!.value * 0.6, 0);
  });
  it("pas d'estimation sans annonces", () => {
    expect(estimate([], "cib")).toBeNull();
  });
});

describe("offres et conversion eBay", () => {
  it("les moins chères frais de port compris, vendeurs sérieux seulement", () => {
    const o = bestOffers(
      [L("A", 20, true, { shipping: 5 }), L("B", 22, true, { shipping: 0 }), L("C", 10, true, { sellerFeedback: 90 }), L("D", 5, false)],
      true,
    );
    expect(o.map((x) => x.title)).toEqual(["B", "A"]);
  });
  it("lit une annonce de l'API Browse", () => {
    const l = fromEbay({
      title: "God of War PS4", price: { value: "12.50", currency: "EUR" }, conditionId: "3000", itemWebUrl: "https://www.ebay.fr/itm/2",
      seller: { username: "x", feedbackPercentage: "99.1", feedbackScore: 1200 }, shippingOptions: [{ shippingCost: { value: "3.90", currency: "EUR" } }],
    })!;
    expect(l).toMatchObject({ price: 12.5, shipping: 3.9, isNew: false, sellerFeedback: 99.1, sellerScore: 1200 });
    expect(fromEbay({ title: "x", price: { value: "10", currency: "USD" } })).toBeNull();
  });
});

import { collectionValue, gameValue, parseEuros } from "../src/lib/market";
import { normalizeGame } from "../src/lib/types";

describe("valeur de la collection", () => {
  const g = (id: string, extra: object) => normalizeGame({ id, title: id, platform: "ps5", ...extra });
  it("saisie des montants", () => {
    expect(parseEuros("24,90")).toBe(24.9);
    expect(parseEuros(" 12 € ")).toBe(12);
    expect(parseEuros("")).toBeNull();
    expect(parseEuros("abc")).toBeUndefined();
    expect(parseEuros("-3")).toBeUndefined();
  });
  it("ma cote remplace l'estimation, total et dépenses", () => {
    const games = [
      g("a", { value_eur: 20, value_low: 15, value_high: 25, purchase_price: 60 }),
      g("b", { value_eur: 30, value_low: 20, value_high: 40, manual_value: 50 }),
      g("c", {}),
    ];
    expect(gameValue(games[1])).toBe(50);
    const v = collectionValue(games);
    expect(v).toMatchObject({ total: 70, low: 65, high: 75, valued: 2, count: 3, spent: 60 });
  });
});

describe("nouvelles consoles", () => {
  it("Switch, Switch 2 et Xbox ne se confondent pas", () => {
    expect(matches(L("Mario Kart World Switch 2 neuf", 60), "Mario Kart World", "switch2", "standard")).toBe(true);
    expect(matches(L("Mario Kart World Switch 2 neuf", 60), "Mario Kart World", "switch", "standard")).toBe(false);
    expect(matches(L("Mario Kart 8 Deluxe Nintendo Switch", 40), "Mario Kart 8 Deluxe", "switch", "standard")).toBe(true);
    expect(matches(L("Halo 3 Xbox 360 complet", 8), "Halo 3", "x360", "standard")).toBe(true);
    expect(matches(L("Forza Horizon 5 Xbox Series X", 30), "Forza Horizon 5", "xone", "standard")).toBe(false);
    expect(matches(L("Carte eShop 50€ + Mario Kart World Switch 2", 50), "Mario Kart World", "switch2", "standard")).toBe(false);
  });
});
