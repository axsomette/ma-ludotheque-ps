// Flux RSS Dealabs : extraits réels (novembre 2026).
import { describe, expect, it } from "vitest";
import { parseFeed, parsePrice, platformOf } from "../supabase/functions/sync-deals/dealabs";

const item = (title: string, merchant: string, price: string, slug: string) => `<item>
<category><![CDATA[Consoles & Jeux vidéo]]></category><pepper:merchant name="${merchant}" price="${price}"/>
<media:content medium="image" url="https://static-pepper.dealabs.com/threads/raw/x/1_1/re/150x150/qt/55/1_1.jpg" width="100" height="100"/>
<title><![CDATA[${title}]]></title><description><![CDATA[<strong>${price} - ${merchant}</strong>]]></description>
<link>https://www.dealabs.com/bons-plans/${slug}</link><pubDate>Wed, 25 Nov 2026 16:23:58 +0100</pubDate></item>`;

const XML = `<rss><channel>${item("GTA VI sur PS5 (Sélection de villes)", "Carrefour", "69,99€", "gta-vi-3469009")}${item(
  "The Last of Us Remastered sur PS4",
  "Amazon",
  "8,99€",
  "tlou-3468992",
)}${item("Mario Kart World sur Switch 2", "Fnac", "59,99€", "mk-1")}</channel></rss>`;

describe("Dealabs", () => {
  it("prix", () => {
    expect(parsePrice("69,99€")).toBe(69.99);
    expect(parsePrice("1 299,00 €")).toBe(1299);
    expect(parsePrice("Gratuit")).toBe(0);
    expect(parsePrice(null)).toBeNull();
  });
  it("plateforme", () => {
    expect(platformOf("Jeu PS4/PS5")).toBe("ps5");
    expect(platformOf("Jeu sur PlayStation 4")).toBe("ps4");
    expect(platformOf("Jeu Switch")).toBeNull();
  });
  it("lit les bons plans PlayStation d'un flux, avec boutique, prix et date", () => {
    const d = parseFeed(XML, null);
    expect(d.map((x) => [x.title, x.merchant, x.price, x.platform])).toEqual([
      ["GTA VI sur PS5 (Sélection de villes)", "Carrefour", 69.99, "ps5"],
      ["The Last of Us Remastered sur PS4", "Amazon", 8.99, "ps4"],
    ]);
    expect(d[0].link).toBe("https://www.dealabs.com/bons-plans/gta-vi-3469009");
    expect(d[0].published_at).toBe("2026-11-25T15:23:58.000Z");
  });
  it("dans un flux PS5, un titre sans plateforme prend celle du flux", () => {
    expect(parseFeed(`<rss>${item("Astro Bot", "Leclerc", "39,99€", "ab")}</rss>`, "ps5")[0].platform).toBe("ps5");
  });
});

import { bestByMerchant, type StoreDeal } from "../src/lib/deals";

describe("comparateur des bons plans", () => {
  const d = (id: string, title: string, merchant: string, price: number): StoreDeal => ({ id, title, merchant, price, link: `https://www.dealabs.com/bons-plans/${id}`, published_at: "2026-11-20T10:00:00Z" });
  const rows = [
    d("1", "Gran Turismo 7 sur PS5", "Amazon", 33.49),
    d("2", "Gran Turismo 7 sur PS5", "E.Leclerc", 31.14),
    d("3", "Gran Turismo 7 sur PS5", "Amazon", 29.99),
    d("4", "Console PS5 Slim + Gran Turismo 7", "Fnac", 449),
    d("5", "Gran Turismo Sport sur PS4", "Fnac", 9.99),
    d("6", "Pack Logitech G29 : volant + pédales + Gran Turismo 7 PS5", "Cdiscount", 199.99),
  ];
  it("le moins cher par boutique, du moins cher au plus cher, sans les packs console", () => {
    expect(bestByMerchant(rows, "Gran Turismo 7", "ps5", "standard").map((x) => [x.merchant, x.price])).toEqual([
      ["Amazon", 29.99],
      ["E.Leclerc", 31.14],
    ]);
  });
});
