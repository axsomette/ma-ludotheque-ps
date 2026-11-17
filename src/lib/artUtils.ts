// Fonctions de calcul pur (sans DOM) utilisées pour composer les visuels. Testées dans tests/.
import type { Pegi } from "./types";

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
