import type { Platform } from "./types";

export type Family = "playstation" | "nintendo" | "xbox";

interface PlatformStyle {
  label: string;
  /** Nom complet (fiches, messages). */
  name: string;
  family: Family;
  /** Support du jeu : disque, ou cartouche (Switch). */
  media: "disc" | "cart";
  /** Dimensions du boîtier en mètres/10 (1 = 100 mm) : largeur, hauteur, épaisseur. */
  size: { w: number; h: number; d: number };
  /** Couleur du plastique du boîtier. */
  caseColor: string;
  /** Plastique vu de l'intérieur (plateau, moyeu), plus clair. */
  caseInner: string;
  /** Translucidité du plastique (0 = opaque) : le boîtier PS5 laisse voir la jaquette en transparence. */
  translucency: number;
  /** Bandeau du haut de la jaquette et de la tranche. */
  bandColor: string;
  bandText: string;
  /** Texte du bandeau quand aucun logotype n'est disponible (aucune marque déposée reproduite). */
  bandLabel: string;
  /** Teinte d'accent dans l'interface. */
  accent: string;
}

const PS = { w: 1.35, h: 1.71, d: 0.15 };

// Boîtiers européens (PAL), relevés sur de vrais boîtiers ; aucun logo ni marque déposée n'est reproduit
// (PlayStation : logotypes du domaine public ; Nintendo et Xbox : nom de la console en texte).
export const PLATFORMS: Record<Platform, PlatformStyle> = {
  ps5: { label: "PS5", name: "PlayStation 5", family: "playstation", media: "disc", size: PS, caseColor: "#2a63d6", caseInner: "#2f5fc4", translucency: 0.6, bandColor: "#ffffff", bandText: "#000000", bandLabel: "PS5", accent: "#e8ecf5" },
  ps4: { label: "PS4", name: "PlayStation 4", family: "playstation", media: "disc", size: PS, caseColor: "#0d3fa6", caseInner: "#24509f", translucency: 0.25, bandColor: "#0b4fc2", bandText: "#ffffff", bandLabel: "PS4", accent: "#3d7bff" },
  ps3: { label: "PS3", name: "PlayStation 3", family: "playstation", media: "disc", size: PS, caseColor: "#121316", caseInner: "#131418", translucency: 0, bandColor: "#0b0b0d", bandText: "#e4e6ec", bandLabel: "PS3", accent: "#a6adbb" },
  switch2: { label: "Switch 2", name: "Nintendo Switch 2", family: "nintendo", media: "cart", size: { w: 1.05, h: 1.7, d: 0.11 }, caseColor: "#d3000f", caseInner: "#b8000d", translucency: 0.2, bandColor: "#e60012", bandText: "#ffffff", bandLabel: "NINTENDO SWITCH 2", accent: "#ff5c6b" },
  switch: { label: "Switch", name: "Nintendo Switch", family: "nintendo", media: "cart", size: { w: 1.05, h: 1.7, d: 0.11 }, caseColor: "#d3000f", caseInner: "#b8000d", translucency: 0.2, bandColor: "#e60012", bandText: "#ffffff", bandLabel: "NINTENDO SWITCH", accent: "#ff4554" },
  xseries: { label: "Xbox Series", name: "Xbox Series X|S", family: "xbox", media: "disc", size: PS, caseColor: "#0e6b0e", caseInner: "#138a13", translucency: 0.3, bandColor: "#0a0a0a", bandText: "#ffffff", bandLabel: "XBOX SERIES X", accent: "#5ed35e" },
  xone: { label: "Xbox One", name: "Xbox One", family: "xbox", media: "disc", size: PS, caseColor: "#107c10", caseInner: "#159a15", translucency: 0.3, bandColor: "#107c10", bandText: "#ffffff", bandLabel: "XBOX ONE", accent: "#4cc34c" },
  x360: { label: "Xbox 360", name: "Xbox 360", family: "xbox", media: "disc", size: { w: 1.36, h: 1.91, d: 0.15 }, caseColor: "#3f9a3a", caseInner: "#5cb357", translucency: 0.5, bandColor: "#5aa83b", bandText: "#ffffff", bandLabel: "XBOX 360", accent: "#8bd36b" },
};

/** Ordre d'affichage : PlayStation, Nintendo, Xbox, de la plus récente à la plus ancienne. */
export const PLATFORM_ORDER: Platform[] = ["ps5", "ps4", "ps3", "switch2", "switch", "xseries", "xone", "x360"];

export const FAMILIES: Array<{ id: Family; label: string; platforms: Platform[] }> = [
  { id: "playstation", label: "PlayStation", platforms: ["ps5", "ps4", "ps3"] },
  { id: "nintendo", label: "Nintendo", platforms: ["switch2", "switch"] },
  { id: "xbox", label: "Xbox", platforms: ["xseries", "xone", "x360"] },
];

export const isPlatform = (v: unknown): v is Platform => typeof v === "string" && Object.hasOwn(PLATFORMS, v);

/** Nom du support pour l'interface : « disque » ou « cartouche ». */
export const mediaName = (p: Platform) => (PLATFORMS[p].media === "cart" ? "cartouche" : "disque");

/** Devine la plateforme à partir du texte lu sur la photo (bandeau « PS5 », « NINTENDO SWITCH », « XBOX ONE »…). */
export function guessPlatform(text: string): Platform | null {
  const t = text.toUpperCase().replace(/\s+/g, "");
  if (/PS5|PLAYSTATION5/.test(t)) return "ps5";
  if (/PS4|PLAYSTATION4/.test(t)) return "ps4";
  if (/PS3|PLAYSTATION3/.test(t)) return "ps3";
  if (/SWITCH2/.test(t)) return "switch2";
  if (/NINTENDOSWITCH|SWITCH/.test(t)) return "switch";
  if (/XBOXSERIES|SERIESX/.test(t)) return "xseries";
  if (/XBOX360|X360/.test(t)) return "x360";
  if (/XBOXONE/.test(t)) return "xone";
  return null;
}
