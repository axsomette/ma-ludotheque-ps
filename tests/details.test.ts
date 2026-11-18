// Compléter les infos d'un jeu rangé avant l'ajout des détails.
import { describe, expect, it } from "vitest";
import { needsDetails, pickSameGame } from "../src/lib/covers";
import type { CoverCandidate } from "../src/lib/types";

const cand = (igdb_id: number | null, name: string): CoverCandidate => ({
  igdb_id,
  name,
  year: 2022,
  thumb_url: "",
  image_id: "co1abc",
  summary: "Résumé",
  publisher: "Éditeur",
  genres: ["Course"],
  screenshot_ids: [],
  pegi: 3,
});

describe("needsDetails", () => {
  const complet = { igdb_id: 1, summary: "s", publisher: "p", genres: ["g"], pegi: 3 as const, screenshots: ["u"] };
  it("repère un jeu IGDB à qui il manque des infos", () => {
    expect(needsDetails(complet)).toBe(false);
    expect(needsDetails({ ...complet, summary: null })).toBe(true);
    expect(needsDetails({ ...complet, genres: [] })).toBe(true);
    expect(needsDetails({ ...complet, pegi: null })).toBe(true);
  });
  it("ne propose rien pour un jeu sans fiche IGDB (photo gardée comme jaquette)", () => {
    expect(needsDetails({ ...complet, igdb_id: null, summary: null })).toBe(false);
  });
});

describe("pickSameGame", () => {
  const results = [cand(10, "Gran Turismo 7"), cand(11, "Gran Turismo Sport")];
  it("retrouve le jeu par son identifiant IGDB", () => {
    expect(pickSameGame(results, 11, "peu importe")?.name).toBe("Gran Turismo Sport");
  });
  it("sinon par titre exact, sans tenir compte de la casse", () => {
    expect(pickSameGame(results, 99, "gran turismo 7 ")?.igdb_id).toBe(10);
  });
  it("ne prend pas un jeu approchant", () => {
    expect(pickSameGame(results, null, "Gran Turismo")).toBeNull();
  });
});

describe("fetchScans", () => {
  it("annonce clairement qu'il n'y a pas de vrais scans en mode démo", async () => {
    const { fetchScans, ScansUnavailable } = await import("../src/lib/covers");
    await expect(fetchScans({ title: "Gran Turismo 7", platform: "ps5", back_url: null, disc_url: null })).rejects.toBeInstanceOf(ScansUnavailable);
  });
});
