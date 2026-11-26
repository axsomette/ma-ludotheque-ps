/**
 * Appareil à ménager (téléphone, petit processeur) : rendu 3D allégé — pas de plastique transparent
 * calculé (transmission), pas d'ombres portées, résolution plafonnée. Le rendu reste le même à l'œil.
 */
export const LOW_POWER: boolean =
  typeof window !== "undefined" &&
  ((typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches) || (navigator.hardwareConcurrency ?? 8) <= 4);
