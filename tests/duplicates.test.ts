// Doublons : même jeu sur la même plateforme.
import { describe, expect, it } from "vitest";
import { duplicateMessage, findDuplicate, isSameGame, normalizeTitle } from "../src/lib/duplicates";
import { normalizeGame } from "../src/lib/types";

const ff7 = normalizeGame({ id: "1", title: "Final Fantasy VII Rebirth", platform: "ps5", igdb_id: 133236 });
const photo = normalizeGame({ id: "2", title: "Gran Turismo 7", platform: "ps4", igdb_id: null });

describe("normalizeTitle", () => {
  it("ignore casse, accents, ponctuation et espaces", () => {
    expect(normalizeTitle("  Pokémon : Légendes  ")).toBe("pokemon legendes");
    expect(normalizeTitle("FINAL FANTASY VII – Rebirth")).toBe(normalizeTitle("Final Fantasy VII Rebirth"));
  });
});

describe("isSameGame / findDuplicate", () => {
  it("reconnaît la même fiche IGDB sur la même plateforme, même si le titre diffère", () => {
    expect(isSameGame(ff7, { title: "FF7 Rebirth", platform: "ps5", igdb_id: 133236 })).toBe(true);
    expect(findDuplicate([photo, ff7], { title: "x", platform: "ps5", igdb_id: 133236 })?.id).toBe("1");
  });
  it("le même jeu sur une autre plateforme n'est pas un doublon", () => {
    expect(isSameGame(ff7, { title: "Final Fantasy VII Rebirth", platform: "ps4", igdb_id: 133236 })).toBe(false);
  });
  it("deux éditions IGDB différentes ne sont pas des doublons, même avec un titre proche", () => {
    expect(isSameGame(ff7, { title: "Final Fantasy VII Rebirth", platform: "ps5", igdb_id: 999 })).toBe(false);
  });
  it("sans fiche IGDB, compare les titres", () => {
    expect(isSameGame(photo, { title: "gran turismo 7", platform: "ps4", igdb_id: 42 })).toBe(true);
    expect(findDuplicate([photo], { title: "Gran Turismo Sport", platform: "ps4", igdb_id: null })).toBeNull();
  });
  it("message lisible", () => {
    expect(duplicateMessage(ff7)).toBe("« Final Fantasy VII Rebirth » (PS5) est déjà dans ta ludothèque.");
  });
});
