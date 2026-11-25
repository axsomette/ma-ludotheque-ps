// Mise à jour groupée des vrais scans.
import { describe, expect, it } from "vitest";
import { missingScans, scanAll } from "../src/lib/scanAll";
import { normalizeGame, type Game, type GamePatch } from "../src/lib/types";

const g = (id: string, back: string | null, disc: string | null): Game =>
  normalizeGame({ id, title: `Jeu ${id}`, platform: "ps5", back_url: back, disc_url: disc });

class Quota extends Error {}

describe("scanAll", () => {
  const games = [g("complet", "b", "d"), g("rien", null, null), g("dos", null, "d"), g("panne", null, null)];

  it("ne traite que les jeux à qui il manque un scan", () => {
    expect(missingScans(games).map((x) => x.id)).toEqual(["rien", "dos", "panne"]);
  });

  it("enregistre ce qui est trouvé, continue après une erreur", async () => {
    const seen: string[] = [];
    const r = await scanAll(games, {
      fetchScans: async (x): Promise<GamePatch> => {
        seen.push(x.id);
        if (x.id === "panne") throw new Error("LaunchBox indisponible");
        return x.id === "dos" ? { back_url: "nouveau-dos" } : {};
      },
      updateGame: async (id, patch) => ({ ...games.find((x) => x.id === id)!, ...patch }),
      isQuota: (e) => e instanceof Quota,
    });
    expect(seen).toEqual(["rien", "dos", "panne"]);
    expect(r.updated.map((x) => [x.id, x.back_url])).toEqual([["dos", "nouveau-dos"]]);
    expect(r.nothing.map((x) => x.id)).toEqual(["rien"]);
    expect(r.failed.map((x) => x.id)).toEqual(["panne"]);
    expect(r.stopped).toBeNull();
  });

  it("s'arrête au quota horaire", async () => {
    let calls = 0;
    const r = await scanAll(games, {
      fetchScans: async () => {
        calls++;
        throw new Quota("Trop de recherches de scans pour l'instant.");
      },
      updateGame: async () => games[0],
      isQuota: (e) => e instanceof Quota,
    });
    expect(calls).toBe(1);
    expect(r.stopped).toBe("quota");
    expect(r.message).toContain("Trop de recherches");
  });

  it("s'arrête quand on annule", async () => {
    const ctrl = new AbortController();
    const r = await scanAll(games, {
      fetchScans: async () => {
        ctrl.abort();
        return {};
      },
      updateGame: async () => games[0],
      isQuota: () => false,
      signal: ctrl.signal,
    });
    expect(r.nothing).toHaveLength(1);
    expect(r.stopped).toBe("cancelled");
  });
});
