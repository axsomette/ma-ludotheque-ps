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

/** Ce qu'un jeu PS3 ou PS4 donne sur PS5. null pour un jeu PS5. */
export function ps5Info(g: Pick<Game, "title" | "platform">): Ps5Info | null {
  if (g.platform === "ps5") return null;
  if (g.platform === "ps3") {
    return {
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
      tone: "info",
      headline: "Pas de mise à niveau PS5 connue",
      details: [base, "Ce jeu n'est pas dans la liste des mises à niveau PS5 (relevée sur Push Square et MeinMMO). Elle se met à jour à la main : vérifie sur le PlayStation Store en cas de doute."],
    };
  }
  const h = HEADLINE[u.status];
  const details = [u.note, base].filter((x): x is string => !!x);
  if (u.status === "free" || u.status === "conditional") details.push(DISC_RULE);
  return { tone: h.tone, headline: h.text, details };
}
