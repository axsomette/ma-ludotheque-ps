// @vitest-environment jsdom
// Sans variables Supabase, l'appli tourne en mode démo : la collection vit dans le localStorage.
import { beforeEach, describe, expect, it } from "vitest";
import { addGame, deleteGame, listGames, updateGame } from "../src/lib/store";
import { isDemo } from "../src/lib/supabase";
import type { NewGame } from "../src/lib/types";

const jeu = (title: string): NewGame => ({
  title,
  platform: "ps5",
  igdb_id: null,
  cover_url: null,
  release_year: 2022,
  summary: null,
  publisher: null,
  genres: [],
  pegi: 3,
  screenshots: [],
  back_url: null,
  disc_url: null,
});

describe("collection en mode démo", () => {
  beforeEach(() => localStorage.clear());

  it("tourne bien en mode démo sans configuration", () => {
    expect(isDemo).toBe(true);
  });

  it("ajoute, liste (plus récent d'abord), modifie et supprime", async () => {
    expect(await listGames()).toEqual([]);
    const a = await addGame(jeu("Premier"));
    const b = await addGame(jeu("Second"));
    expect((await listGames()).map((g) => g.title)).toEqual(["Second", "Premier"]);

    const maj = await updateGame(a.id, { back_url: "data:image/jpeg;base64,AA==" });
    expect(maj.back_url).toBe("data:image/jpeg;base64,AA==");
    expect((await listGames()).find((g) => g.id === a.id)?.back_url).toBe("data:image/jpeg;base64,AA==");

    await deleteGame(b.id);
    expect((await listGames()).map((g) => g.title)).toEqual(["Premier"]);
  });

  it("signale un jeu introuvable lors d'une modification", async () => {
    await expect(updateGame("inconnu", { disc_url: "x" })).rejects.toThrow("Jeu introuvable");
  });

  it("résiste à un stockage corrompu", async () => {
    localStorage.setItem("ludotheque-demo-games", "{pas du json");
    expect(await listGames()).toEqual([]);
  });
});

describe("ownCoverPath : seuls les fichiers de son propre dossier sont supprimables", () => {
  const uid = "5f0c3a52-1111-4a2b-9c3d-123456789abc";
  const base = "https://abcd.supabase.co/storage/v1/object/public/covers/";
  it("reconnaît un fichier de l'utilisateur", async () => {
    const { ownCoverPath } = await import("../src/lib/store");
    expect(ownCoverPath(`${base}${uid}/back-1234.jpg`, uid)).toBe(`${uid}/back-1234.jpg`);
    expect(ownCoverPath(`${base}${uid}/lb-disc-42.png?t=1`, uid)).toBe(`${uid}/lb-disc-42.png`);
  });
  it("refuse tout le reste", async () => {
    const { ownCoverPath } = await import("../src/lib/store");
    expect(ownCoverPath(`${base}autre-uid/back-1.jpg`, uid)).toBeNull();
    expect(ownCoverPath(`${base}${uid}/../autre/x.jpg`, uid)).toBeNull();
    expect(ownCoverPath(`${base}${uid}%2F..%2Fautre%2Fx.jpg`, uid)).toBeNull();
    expect(ownCoverPath("https://images.igdb.com/igdb/image/upload/t_1080p/abc.jpg", uid)).toBeNull();
    expect(ownCoverPath(null, uid)).toBeNull();
  });

  it("refuse un doublon (même titre, même plateforme) mais accepte une autre plateforme", async () => {
    await addGame(jeu("Astro Bot"));
    await expect(addGame(jeu("astro  bot"))).rejects.toThrow("déjà dans ta ludothèque");
    await addGame({ ...jeu("Astro Bot"), platform: "ps4" });
    expect((await listGames()).length).toBe(2);
  });
});
