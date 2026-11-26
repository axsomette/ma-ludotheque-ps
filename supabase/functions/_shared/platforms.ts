// Consoles gérées, et comment les reconnaître ou les nommer chez chaque source (IGDB, LaunchBox, eBay, Dealabs).
// Module pur partagé par les fonctions (dossier _shared de Supabase) et testé avec Vitest.

export type Platform = "ps3" | "ps4" | "ps5" | "switch" | "switch2" | "x360" | "xone" | "xseries";

export const PLATFORM_IDS: Platform[] = ["ps5", "ps4", "ps3", "switch2", "switch", "xseries", "xone", "x360"];

export const isPlatform = (v: unknown): v is Platform => typeof v === "string" && (PLATFORM_IDS as string[]).includes(v);

/** Nom court, ajouté aux recherches (« Elden Ring PS5 », « Zelda Switch 2 »). */
export const LABEL: Record<Platform, string> = {
  ps5: "PS5", ps4: "PS4", ps3: "PS3", switch2: "Switch 2", switch: "Switch", xseries: "Xbox Series", xone: "Xbox One", x360: "Xbox 360",
};

/** Identifiants des plateformes IGDB. */
export const IGDB_ID: Record<Platform, number> = { ps3: 9, ps4: 48, ps5: 167, switch: 130, switch2: 508, x360: 12, xone: 49, xseries: 169 };

/** Consoles de la même famille, pour élargir une recherche qui ne donne rien (portage, titre mal lu). */
export const FAMILY_IGDB: Record<Platform, number[]> = {
  ps3: [7, 8, 9, 38, 46, 48, 167], ps4: [7, 8, 9, 38, 46, 48, 167], ps5: [7, 8, 9, 38, 46, 48, 167],
  switch: [130, 508, 41, 5], switch2: [130, 508, 41, 5],
  x360: [11, 12, 49, 169], xone: [11, 12, 49, 169], xseries: [11, 12, 49, 169],
};

/** Nom de la plateforme sur LaunchBox Games DB. */
export const LAUNCHBOX: Record<Platform, string> = {
  ps5: "Sony Playstation 5", ps4: "Sony Playstation 4", ps3: "Sony Playstation 3",
  switch: "Nintendo Switch", switch2: "Nintendo Switch 2",
  x360: "Microsoft Xbox 360", xone: "Microsoft Xbox One", xseries: "Microsoft Xbox Series X/S",
};

/** Mention de la plateforme dans un titre d'annonce ou de bon plan (sans accents, en minuscules ou non). */
export const PLATFORM_RE: Record<Platform, RegExp> = {
  ps5: /\b(ps ?5|playstation ?5)\b/i,
  ps4: /\b(ps ?4|playstation ?4)\b/i,
  ps3: /\b(ps ?3|playstation ?3)\b/i,
  switch2: /\b(switch ?2|ns ?2)\b/i,
  switch: /\bswitch\b(?! ?2\b)/i,
  xseries: /\b(xbox ?series|series ?[xs]\b|xsx)/i,
  xone: /\b(xbox ?one|xone)\b/i,
  x360: /\b(xbox ?360|x ?360)\b/i,
};

/**
 * Plateforme d'après le titre d'un bon plan ou d'une annonce. La plus récente gagne quand plusieurs
 * sont citées (« PS4/PS5 » → PS5, « Xbox One & Series X » → Series), sauf une Switch 2 « compatible Switch ».
 */
export function platformOf(title: string): Platform | null {
  for (const p of ["ps5", "ps4", "ps3", "switch2", "switch", "xseries", "xone", "x360"] as Platform[]) {
    if (PLATFORM_RE[p].test(title)) return p;
  }
  return null;
}

/** Plateformes dont les annonces conviennent aussi (un jeu Xbox One se joue sur Series, et inversement pour la recherche de prix). */
export const RELATED: Record<Platform, Platform[]> = {
  ps5: ["ps5"], ps4: ["ps4"], ps3: ["ps3"], switch: ["switch"], switch2: ["switch2"], x360: ["x360"],
  xone: ["xone", "xseries"], xseries: ["xseries", "xone"],
};
