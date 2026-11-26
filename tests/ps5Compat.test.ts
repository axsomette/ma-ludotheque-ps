// Compatibilité PS5 des jeux PS3 / PS4.
import { describe, expect, it } from "vitest";
import { findUpgrade, ps5Info } from "../src/lib/ps5Compat";
import { PS5_UPGRADES } from "../src/data/ps5Upgrades";

describe("liste des mises à niveau", () => {
  it("est conséquente et sans doublon", () => {
    expect(PS5_UPGRADES.length).toBeGreaterThan(150);
    expect(new Set(PS5_UPGRADES.map((u) => u.title.toLowerCase())).size).toBe(PS5_UPGRADES.length);
  });
  it("retrouve un jeu malgré la ponctuation, les chiffres romains ou une mention d'édition", () => {
    expect(findUpgrade("Assassin's Creed Valhalla")?.status).toBe("free");
    expect(findUpgrade("ASSASSIN’S CREED VALHALLA")?.status).toBe("free");
    expect(findUpgrade("Horizon Zero Dawn Complete Edition")?.status).toBe("paid");
    expect(findUpgrade("The Last of Us Part II")?.status).toBe("paid");
  });
  it("ne confond pas un jeu avec un autre qui commence pareil", () => {
    expect(findUpgrade("Control Freak")).toBeNull();
    expect(findUpgrade("Red Dead Redemption 2")).toBeNull();
  });
});

describe("ps5Info", () => {
  it("rien pour un jeu PS5", () => expect(ps5Info({ title: "Astro Bot", platform: "ps5" })).toBeNull());
  it("PS3 : ne se lance pas sur PS5", () => expect(ps5Info({ title: "Heavy Rain", platform: "ps3" })?.tone).toBe("bad"));
  it("PS4 gratuit : rappelle la règle du disque", () => {
    const i = ps5Info({ title: "Assassin's Creed Valhalla", platform: "ps4" })!;
    expect(i.tone).toBe("good");
    expect(i.details.join(" ")).toContain("lecteur");
  });
  it("PS4 inconnu : rétrocompatible sans mise à niveau connue", () => {
    expect(ps5Info({ title: "Red Dead Redemption 2", platform: "ps4" })?.headline).toBe("Pas de mise à niveau PS5 connue");
  });
});

describe("autres consoles", () => {
  it("Switch → Switch 2, Xbox One / 360 → Series, dernière génération sans section", () => {
    expect(ps5Info({ title: "Zelda", platform: "switch" })?.section).toBe("Sur Switch 2");
    expect(ps5Info({ title: "Halo 5", platform: "xone" })?.tone).toBe("good");
    expect(ps5Info({ title: "Halo 3", platform: "x360" })?.tone).toBe("warn");
    expect(ps5Info({ title: "Mario Kart World", platform: "switch2" })).toBeNull();
    expect(ps5Info({ title: "Starfield", platform: "xseries" })).toBeNull();
  });
});
