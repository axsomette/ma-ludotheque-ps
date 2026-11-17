import type { Platform } from "./types";

interface PlatformStyle {
  label: string;
  /** Couleur du plastique du boîtier. */
  caseColor: string;
  /** Bandeau du haut de la jaquette et de la tranche. */
  bandColor: string;
  bandText: string;
  /** Teinte d'accent dans l'interface. */
  accent: string;
}

// Couleurs inspirées des boîtiers réels, sans logo ni marque déposée.
export const PLATFORMS: Record<Platform, PlatformStyle> = {
  ps3: { label: "PS3", caseColor: "#16171b", bandColor: "#0c0c0e", bandText: "#e9e9ee", accent: "#a6adbb" },
  ps4: { label: "PS4", caseColor: "#0d3fa6", bandColor: "#003791", bandText: "#ffffff", accent: "#3d7bff" },
  ps5: { label: "PS5", caseColor: "#0a3a9c", bandColor: "#f4f5f7", bandText: "#111318", accent: "#e8ecf5" },
};

export const PLATFORM_ORDER: Platform[] = ["ps5", "ps4", "ps3"];

/** Devine la plateforme à partir du texte lu sur la photo (bandeau « PS5 », « PS4 »…). */
export function guessPlatform(text: string): Platform | null {
  const t = text.toUpperCase().replace(/\s+/g, "");
  if (/PS5|PLAYSTATION5/.test(t)) return "ps5";
  if (/PS4|PLAYSTATION4/.test(t)) return "ps4";
  if (/PS3|PLAYSTATION3/.test(t)) return "ps3";
  return null;
}
