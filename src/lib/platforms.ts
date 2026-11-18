import type { Platform } from "./types";

interface PlatformStyle {
  label: string;
  /** Couleur du plastique du boîtier. */
  caseColor: string;
  /** Plastique vu de l'intérieur (plateau, moyeu), plus clair. */
  caseInner: string;
  /** Translucidité du plastique (0 = opaque) : le boîtier PS5 laisse voir la jaquette en transparence. */
  translucency: number;
  /** Bandeau du haut de la jaquette et de la tranche. */
  bandColor: string;
  bandText: string;
  /** Teinte d'accent dans l'interface. */
  accent: string;
}

// Boîtiers européens (PAL), relevés sur de vrais boîtiers ; aucun logo ni marque déposée n'est reproduit.
export const PLATFORMS: Record<Platform, PlatformStyle> = {
  ps3: { label: "PS3", caseColor: "#121316", caseInner: "#131418", translucency: 0, bandColor: "#0b0b0d", bandText: "#e4e6ec", accent: "#a6adbb" },
  ps4: { label: "PS4", caseColor: "#0d3fa6", caseInner: "#24509f", translucency: 0, bandColor: "#0b4fc2", bandText: "#ffffff", accent: "#3d7bff" },
  ps5: { label: "PS5", caseColor: "#2a63d6", caseInner: "#2f5fc4", translucency: 0.35, bandColor: "#ffffff", bandText: "#000000", accent: "#e8ecf5" },
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
