import { PS5_UPGRADES, type Ps5Upgrade, type UpgradeStatus } from "../data/ps5Upgrades";
import type { Game } from "./types";

const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10" };
const words = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter(Boolean).map((w) => ROMAN[w] ?? w);

// Mots d'édition qu'un titre peut avoir en plus de celui de la liste (« Horizon Zero Dawn Complete Edition »).
const EXTRA = new Set(["complete", "edition", "deluxe", "gold", "ultimate", "definitive", "standard", "launch", "day", "one", "special", "limited", "collector", "collectors", "goty", "game", "of", "the", "year", "2018", "remastered"]);

/** L'entrée de la liste qui correspond à ce titre (même titre, éventuellement suivi d'une mention d'édition). */
export function findUpgrade(title: string, list: readonly Ps5Upgrade[] = PS5_UPGRADES): Ps5Upgrade | null {
  const w = words(title);
  let best: Ps5Upgrade | null = null;
  for (const u of list) {
    const uw = words(u.title.replace(/\s*\(\d{4}\)$/, ""));
    if (uw.length > w.length || !uw.every((x, i) => w[i] === x)) continue;
    if (!w.slice(uw.length).every((x) => EXTRA.has(x))) continue;
    if (!best || uw.length > words(best.title).length) best = u;
  }
  return best;
}

export interface Ps5Info {
  tone: "good" | "warn" | "bad" | "info";
  /** Titre de la section : « Sur PS5 », « Sur Switch 2 », « Sur Xbox Series ». */
  section: string;
  headline: string;
  details: string[];
}

const DISC_RULE = "Avec le disque, la version PS5 ne fonctionne que sur une PS5 avec lecteur, et le disque doit rester dans la console.";

const HEADLINE: Record<UpgradeStatus, { tone: Ps5Info["tone"]; text: string }> = {
  free: { tone: "good", text: "Mise à niveau PS5 gratuite" },
  conditional: { tone: "warn", text: "Mise à niveau PS5 gratuite sous condition" },
  digital: { tone: "warn", text: "Mise à niveau PS5 gratuite en version numérique seulement" },
  paid: { tone: "warn", text: "Version PS5 payante" },
  boost: { tone: "info", text: "Pas de version PS5, mais amélioré sur PS5" },
  expired: { tone: "bad", text: "Offre de mise à niveau PS5 terminée" },
};

/**
 * Ce que donne un jeu sur la console de génération suivante : PS3/PS4 → PS5, Switch → Switch 2,
 * Xbox 360/One → Xbox Series X|S. null pour un jeu de la dernière génération.
 */
export function ps5Info(g: Pick<Game, "title" | "platform">): Ps5Info | null {
  if (g.platform === "ps5" || g.platform === "switch2" || g.platform === "xseries") return null;
  if (g.platform === "switch") {
    return {
      tone: "good",
      section: "Sur Switch 2",
      headline: "Se lance sur Switch 2",
      details: [
        "La Switch 2 lit les cartouches Switch : presque tous les jeux Switch y fonctionnent (Nintendo publie la liste des rares exceptions).",
        "Certains jeux ont une « Nintendo Switch 2 Edition » ou une mise à jour gratuite qui les améliore sur Switch 2 : vérifie sur le Nintendo eShop.",
      ],
    };
  }
  if (g.platform === "xone") {
    return {
      tone: "good",
      section: "Sur Xbox Series",
      headline: "Se lance sur Xbox Series X",
      details: [
        "Les disques Xbox One fonctionnent sur Xbox Series X (avec lecteur) ; la Series S, sans lecteur, ne les lit pas.",
        "Beaucoup de jeux ont une version Series gratuite (« Smart Delivery ») : elle s'installe d'elle-même si le jeu y a droit.",
      ],
    };
  }
  if (g.platform === "x360") {
    return {
      tone: "warn",
      section: "Sur Xbox Series",
      headline: "Jouable seulement s'il est rétrocompatible",
      details: [
        "Environ 600 jeux Xbox 360 se lancent sur Xbox One et Xbox Series X avec le disque, d'après la liste officielle de Microsoft.",
        "Vérifie ce jeu dans la liste de rétrocompatibilité Xbox avant de compter dessus. La Series S, sans lecteur, ne lit pas les disques.",
      ],
    };
  }
  if (g.platform === "ps3") {
    return {
      section: "Sur PS5",
      tone: "bad",
      headline: "Ne se lance pas sur PS4 ni sur PS5",
      details: [
        "Les disques PS3 ne fonctionnent que sur PS3.",
        "Certains jeux PS3 sont jouables en streaming sur PS5 avec l'abonnement PS Plus Premium, ou existent en version remasterisée.",
      ],
    };
  }
  const u = findUpgrade(g.title);
  const base = "Le disque PS4 se lance sur PS5 (rétrocompatibilité), à de très rares exceptions près.";
  if (!u) {
    return {
      section: "Sur PS5",
      tone: "info",
      headline: "Pas de mise à niveau PS5 connue",
      details: [base, "Ce jeu n'est pas dans la liste des mises à niveau PS5 (relevée sur Push Square et MeinMMO). Elle se met à jour à la main : vérifie sur le PlayStation Store en cas de doute."],
    };
  }
  const h = HEADLINE[u.status];
  const details = [u.note, base].filter((x): x is string => !!x);
  if (u.status === "free" || u.status === "conditional") details.push(DISC_RULE);
  return { section: "Sur PS5", tone: h.tone, headline: h.text, details };
}
