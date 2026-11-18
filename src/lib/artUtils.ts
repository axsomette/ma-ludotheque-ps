// Fonctions de calcul pur (sans DOM) utilisées pour composer les visuels. Testées dans tests/.
import type { Pegi, Platform } from "./types";

/** Couleurs officielles des pictogrammes d'âge PEGI : vert (3, 7), orange (12, 16), rouge (18). */
export function pegiColor(pegi: Pegi): string {
  if (pegi <= 7) return "#5BA829";
  if (pegi <= 16) return "#F29400";
  return "#D6001C";
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

/** Luminance relative WCAG (0 = noir, 1 = blanc). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Texte lisible sur un fond donné : quasi-noir ou quasi-blanc, selon le meilleur contraste. */
export function readableOn(bg: string): string {
  const L = luminance(bg);
  const onWhite = (L + 0.05) / (0.0 + 0.05); // contraste du noir sur ce fond
  const onBlack = (1.05) / (L + 0.05); // contraste du blanc sur ce fond
  return onWhite >= onBlack ? "#111318" : "#F4F6FB";
}

/** Mélange linéaire de deux couleurs (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** Coupe un texte en lignes d'une largeur maximale, avec une fonction de mesure fournie (canvas, ou nombre de caractères en test). */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number, maxLines = Infinity): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (measure(test) > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && measure(`${last}…`) > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.replace(/[\s,.;:]+$/, "")}…`;
  }
  return lines;
}

/** Ligne d'informations type « dos de boîtier » : PS5 · 2022 · PEGI 3 · Éditeur. */
export function metaLine(parts: Array<string | number | null | undefined>): string {
  return parts.filter((p) => p !== null && p !== undefined && String(p).trim() !== "").join(" · ");
}

/** Le pixel a-t-il la couleur du bandeau de la plateforme (blanc PS5, bleu PS4, noir PS3) ? */
export function isBandPixel(r: number, g: number, b: number, platform: Platform): boolean {
  if (platform === "ps5") return r > 200 && g > 200 && b > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 30;
  if (platform === "ps4") return b > 140 && b - r > 70 && b - g > 30;
  return Math.max(r, g, b) < 62;
}

/**
 * Hauteur du bandeau d'origine d'une jaquette, en nombre de lignes depuis le haut, ou 0 s'il n'y en a pas.
 * `share[y]` = part des pixels de la ligne y qui ont la couleur du bandeau (lignes du haut de l'image).
 * Le bandeau s'arrête à la première cassure nette (moins de 20 % de pixels à sa couleur) ; au-dessus,
 * sa couleur doit dominer (moyenne ≥ 55 %, jamais moins de 30 % : le logo et les mentions en prennent une part).
 * Un vrai bandeau européen fait 5 à 14 % de la hauteur. Sans cassure (illustration de la même couleur
 * juste en dessous), on retient la hauteur standard si le haut de l'image a bien l'allure d'un bandeau.
 */
export function bandRows(share: number[], totalRows: number, standard = 0.105): number {
  const looksLikeBand = (rows: number[]) =>
    rows.length > 0 && rows.reduce((a, b) => a + b, 0) / rows.length >= 0.55 && Math.min(...rows) >= 0.3;
  const end = share.findIndex((s) => s < 0.2);
  const run = end === -1 ? share.length : end;
  if (run < totalRows * 0.05) return 0;
  if (run > totalRows * 0.14) {
    const std = Math.round(totalRows * standard);
    return looksLikeBand(share.slice(0, std)) ? std : 0;
  }
  return looksLikeBand(share.slice(0, run)) ? run : 0;
}
