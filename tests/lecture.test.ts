import { describe, expect, it } from "vitest";
import { cleanTitle } from "../src/lib/ocr";
import { guessPlatform } from "../src/lib/platforms";
import { normalizeGame } from "../src/lib/types";
import { coverSrc } from "../src/components/Library";

describe("guessPlatform", () => {
  it("reconnaît le bandeau de la jaquette", () => {
    expect(guessPlatform("PS5\nGRAN TURISMO 7")).toBe("ps5");
    expect(guessPlatform("ps4 only on playstation")).toBe("ps4");
    expect(guessPlatform("PlayStation 3")).toBe("ps3");
    expect(guessPlatform("P S 5")).toBe("ps5");
  });

  it("ne devine rien sans indice", () => {
    expect(guessPlatform("THE LAST OF US")).toBeNull();
  });
});

describe("cleanTitle", () => {
  it("retire les mentions communes et garde le titre", () => {
    const raw = "PS5\nGRAN TURISMO 7\nPEGI 3\nwww.playstation.com";
    expect(cleanTitle(raw)).toBe("GRAN TURISMO 7");
  });

  it("nettoie la ponctuation parasite de l'OCR", () => {
    expect(cleanTitle("|| HORIZON ~ FORBIDDEN WEST ||\n© 2022")).toBe("HORIZON FORBIDDEN WEST");
  });

  it("garde les deux premières lignes utiles et coupe à 60 caractères", () => {
    const title = cleanTitle("ASSASSIN'S CREED\nVALHALLA\nRAGNARÖK EDITION\nUBISOFT");
    expect(title).toBe("ASSASSIN'S CREED VALHALLA");
    expect(cleanTitle("A".repeat(100)).length).toBe(60);
  });

  it("renvoie une chaîne vide si rien n'est lisible", () => {
    expect(cleanTitle("§§\n12\n|")).toBe("");
  });
});

describe("coverSrc", () => {
  it("garde la jaquette enregistrée, sans rien générer", () => {
    const url = "https://exemple.supabase.co/storage/v1/object/public/covers/u/gt7.jpg";
    expect(coverSrc({ cover_url: url, title: "Gran Turismo 7", platform: "ps5" })).toBe(url);
  });
});

describe("normalizeGame", () => {
  it("complète un jeu enregistré avant l'ajout des détails", () => {
    const g = normalizeGame({ id: "1", title: "Canyon Run", platform: "ps3" });
    expect(g.genres).toEqual([]);
    expect(g.screenshots).toEqual([]);
    expect(g.pegi).toBeNull();
    expect(g.back_url).toBeNull();
  });

  it("conserve les valeurs existantes", () => {
    const g = normalizeGame({ id: "1", title: "GT7", platform: "ps5", genres: ["Racing"], pegi: 3 });
    expect(g.genres).toEqual(["Racing"]);
    expect(g.pegi).toBe(3);
  });
});
