import { describe, expect, it } from "vitest";
import { hexToRgb, luminance, metaLine, mix, pegiColor, readableOn, rgbToHex, wrapText } from "../src/lib/artUtils";

describe("pegiColor", () => {
  it("suit les couleurs officielles PEGI", () => {
    expect(pegiColor(3)).toBe("#5BA829");
    expect(pegiColor(7)).toBe("#5BA829");
    expect(pegiColor(12)).toBe("#F29400");
    expect(pegiColor(16)).toBe("#F29400");
    expect(pegiColor(18)).toBe("#D6001C");
  });
});

describe("couleurs", () => {
  it("convertit hex ↔ rgb, y compris la forme courte", () => {
    expect(hexToRgb("#0f1426")).toEqual([15, 20, 38]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(rgbToHex(15, 20, 38)).toBe("#0f1426");
    expect(rgbToHex(300, -4, 127.6)).toBe("#ff0080");
  });

  it("calcule la luminance relative", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("choisit un texte lisible selon le fond", () => {
    expect(readableOn("#ffffff")).toBe("#111318");
    expect(readableOn("#f4f5f7")).toBe("#111318"); // bandeau PS5
    expect(readableOn("#003791")).toBe("#F4F6FB"); // bandeau PS4
    expect(readableOn("#0c0c0e")).toBe("#F4F6FB"); // bandeau PS3
  });

  it("mélange deux couleurs", () => {
    expect(mix("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mix("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("wrapText", () => {
  const byChars = (s: string) => s.length;

  it("coupe aux espaces sans dépasser la largeur", () => {
    const lines = wrapText("Gran Turismo 7 est un jeu de course", 14, byChars);
    expect(lines).toEqual(["Gran Turismo 7", "est un jeu de", "course"]);
    lines.forEach((l) => expect(l.length).toBeLessThanOrEqual(14));
  });

  it("limite le nombre de lignes et termine par une ellipse", () => {
    const lines = wrapText("un deux trois quatre cinq six sept huit neuf dix", 10, byChars, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(lines[1].length).toBeLessThanOrEqual(10);
  });

  it("garde un mot plus long que la ligne plutôt que de le perdre", () => {
    expect(wrapText("Supercalifragilistique", 5, byChars)).toEqual(["Supercalifragilistique"]);
  });

  it("renvoie une liste vide pour un texte vide", () => {
    expect(wrapText("   ", 10, byChars)).toEqual([]);
  });
});

describe("metaLine", () => {
  it("ignore les informations absentes", () => {
    expect(metaLine([2022, "PEGI 3", null, undefined, "", "Sony"])).toBe("2022 · PEGI 3 · Sony");
    expect(metaLine([null, null])).toBe("");
  });
});
