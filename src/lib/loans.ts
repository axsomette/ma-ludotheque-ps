import type { Game } from "./types";

/** Date du jour au format AAAA-MM-JJ (heure locale), pour la colonne loaned_at. */
export function today(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** « aujourd'hui », « hier », « depuis 5 jours », « depuis 3 semaines », « depuis 2 mois », « depuis plus d'un an ». */
export function since(date: string, now = new Date()): string {
  const [y, m, d] = date.split("-").map(Number);
  const start = new Date(y, (m ?? 1) - 1, d ?? 1);
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - start.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 14) return `depuis ${days} jours`;
  if (days < 61) return `depuis ${Math.round(days / 7)} semaines`;
  if (days < 365) return `depuis ${Math.round(days / 30)} mois`;
  return days < 730 ? "depuis plus d'un an" : `depuis plus de ${Math.floor(days / 365)} ans`;
}

/** Date lisible : « 12 mars 2026 ». */
export function frenchDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export const isLoaned = (g: Pick<Game, "loaned_to">): boolean => !!g.loaned_to?.trim();

/** « Prêté à Thomas · depuis 3 semaines ». */
export function loanLine(g: Pick<Game, "loaned_to" | "loaned_at">, now = new Date()): string | null {
  if (!isLoaned(g)) return null;
  return `Prêté à ${g.loaned_to!.trim()}${g.loaned_at ? ` · ${since(g.loaned_at, now)}` : ""}`;
}

/** Prêts en cours, du plus ancien au plus récent (ceux qu'il faut penser à réclamer d'abord). */
export function activeLoans(games: readonly Game[]): Game[] {
  return games.filter(isLoaned).sort((a, b) => (a.loaned_at ?? "").localeCompare(b.loaned_at ?? ""));
}
