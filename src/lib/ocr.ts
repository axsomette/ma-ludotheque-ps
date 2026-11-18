import { guessPlatform } from "./platforms";
import type { Platform } from "./types";

export interface OcrResult {
  /** Titre probable, à confirmer ou corriger par l'utilisateur. */
  title: string;
  platform: Platform | null;
  raw: string;
}

// Lignes entières sans rapport avec le titre : mentions légales, site web, PEGI, Blu-ray…
const NOISE_LINE = /(©|\bwww\b|\.com|\bpegi\b|blu-?ray|only on|exclusivit|playstation network)/i;
// Mots du bandeau imprimés sur toutes les jaquettes.
const NOISE_WORD = /^(PS[345]|PLAYSTATION|ONLY|SONY|ENTERTAINMENT|NETWORK|VR)$/i;

/**
 * Extrait un titre probable du texte brut lu sur la jaquette.
 * Les chiffres des titres sont conservés (Gran Turismo 7, FIFA 23) ; un nombre seul sur sa ligne
 * (l'âge PEGI, souvent) est écarté. On garde les deux premières lignes utiles.
 */
export function cleanTitle(raw: string): string {
  const lines = raw
    .split("\n")
    .filter((l) => !NOISE_LINE.test(l))
    .map((l) => l.replace(/[^\p{L}\p{N}' :&-]/gu, " ").replace(/\s+/g, " ").trim())
    .map((l) =>
      l
        .split(" ")
        // un caractère isolé est en général du bruit d'OCR, sauf un chiffre (GT7) ou « A » / « I »
        .filter((w) => (w.length > 1 || /[\dAI]/.test(w)) && !NOISE_WORD.test(w))
        .join(" "),
    )
    .filter((l) => l.length >= 3 && !/^\d+\+?$/.test(l));
  return lines.slice(0, 2).join(" ").slice(0, 60);
}

/**
 * Lit le texte de la photo de la jaquette, directement dans le navigateur
 * (la photo ne quitte pas l'appareil). Tesseract est chargé seulement à la demande.
 */
export async function readCover(file: Blob, onProgress?: (p: number) => void): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js");
  // Tout est servi par le site lui-même (public/ocr/, copié par scripts/copy-ocr.mjs) : aucun code
  // n'est chargé depuis un CDN, ce qui permet aussi une CSP stricte.
  const ocr = (p: string) => new URL(`${import.meta.env.BASE_URL}ocr/${p}`, window.location.href).href;
  const worker = await createWorker(["eng", "fra"], 1, {
    workerPath: ocr("worker.min.js"),
    workerBlobURL: false,
    corePath: ocr("core"),
    langPath: ocr("lang"),
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    const raw = data.text ?? "";
    return { title: cleanTitle(raw), platform: guessPlatform(raw), raw };
  } finally {
    await worker.terminate();
  }
}
