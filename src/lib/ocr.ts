import { guessPlatform } from "./platforms";
import type { Platform } from "./types";

export interface OcrResult {
  /** Titre probable, à confirmer ou corriger par l'utilisateur. */
  title: string;
  platform: Platform | null;
  raw: string;
}

// Mots imprimés sur toutes les jaquettes, sans rapport avec le titre.
const NOISE = /^(PS[345]|PLAYSTATION|PLAY|STATION|PEGI|ONLY|ON|SONY|ENTERTAINMENT|BLU|RAY|DISC|NETWORK|ONLINE|VR|\d{1,2}\+?|WWW|COM)$/i;

/**
 * Lit le texte de la photo de la jaquette, directement dans le navigateur
 * (la photo ne quitte pas l'appareil). Tesseract est chargé seulement à la demande.
 */
export async function readCover(file: Blob, onProgress?: (p: number) => void): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["eng", "fra"], 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    const raw = data.text ?? "";
    // On garde les lignes les plus « grosses » et lisibles : le titre est en général en grand.
    const lines = raw
      .split("\n")
      .map((l) => l.replace(/[^\p{L}\p{N}' :&-]/gu, " ").replace(/\s+/g, " ").trim())
      .filter((l) => l.length >= 2)
      .map((l) => l.split(" ").filter((w) => w.length > 1 && !NOISE.test(w)).join(" "))
      .filter((l) => l.length >= 3);
    const title = lines.slice(0, 2).join(" ").slice(0, 60);
    return { title, platform: guessPlatform(raw), raw };
  } finally {
    await worker.terminate();
  }
}
