import { describe, expect, it } from "vitest";
import { hexToRgb, luminance, metaLine, mix, pegiColor, readableOn, rgbToHex, wrapText, bandRows } from "../src/lib/artUtils";

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

describe("bandRows : hauteur du bandeau d'origine d'une jaquette", () => {
  // parts de pixels à la couleur du bandeau, ligne par ligne (relevées sur de vraies jaquettes)
  const astro = [1, 0.98, 0.96, 0.96, 0.71, 0.88, 0.88, 0.75, 0.84, 0.8, 0.69, 0.88, 0.95, 1, 1, 0, 0, 0, 0, 0];
  const tlou = [0.76, 0.76, 0.54, 0.47, 0.6, 0.46, 0.42, 0.58, 0.55, 0.76, 0.76, 0, 0, 0.04, 0.01, 0.03];
  const gow = [1, 1, 0.98, 0.96, 0.95, 0.91, 0.88, 0.83, 0.82, 0.8, 0.77, 0.82, 0.96, 1, 1, 1, 0.77, 0.99, 1, 0.98, 0.95, 0.88, 0.79, 0.74, 0.7, 0.63, 0.59, 0.34, 0.29, 0.22];

  it("mesure un bandeau PS5 jusqu'à la cassure", () => expect(bandRows(astro, 150)).toBe(15));
  it("tolère le logo argenté et les mentions d'un bandeau PS3", () => expect(bandRows(tlou, 138)).toBe(11));
  it("retient la hauteur standard quand l'illustration prolonge la couleur du bandeau", () => expect(bandRows(gow, 150)).toBe(16));
  it("ne voit pas de bandeau sur une illustration seule", () => {
    expect(bandRows([0, 0, 0.1, 0.2, 0.1], 150)).toBe(0);
    expect(bandRows([0.4, 0.35, 0.3, 0.32, 0.4, 0.3, 0.31, 0.36, 0.4, 0.3, 0, 0], 150)).toBe(0);
  });
});
