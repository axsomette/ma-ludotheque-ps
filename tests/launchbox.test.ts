// Lecture des pages LaunchBox Games DB (extraits réduits de vraies pages, novembre 2026).
import { describe, expect, it } from "vitest";
import { parseImages, parseResults, pickImage, pickResult, safeImageUrl } from "../supabase/functions/fetch-scans/launchbox";

const card = (id: string, slug: string, title: string, platform: string) => `
  <div b-x class="games-grid-card col-xl-3">
    <a class="list-item link-no-underline" href="/games/details/${id}-${slug}">
      <div b-x class="gameCard"><div b-x class="cardImgPart"><img b-x src="https://images.launchbox-app.com/a.jpg" alt="${title}" /></div>
      <div b-x class="cardContent"><div b-x class="cardHeading"><div b-x class="cardTitle">
        <h3 b-x>${title}</h3>
        <p b-x>${platform}</p>
      </div></div></div></div>
    </a>
  </div>`;

const RESULTS =
  card("159658", "gran-turismo-7-the-real-driving-simulator", "Gran Turismo 7: The Real Driving Simulator", "Sony Playstation 5") +
  card("160173", "gran-turismo-7-the-real-driving-simulator", "Gran Turismo 7: The Real Driving Simulator", "Sony Playstation 4") +
  card("160174", "gran-turismo-7-25th-anniversary-edition", "Gran Turismo 7: 25th Anniversary Edition", "Sony Playstation 5") +
  card("9001", "uncharted-the-nathan-drake-collection", "Uncharted: The Nathan Drake Collection", "Sony Playstation 4");

const img = (url: string, title: string) => `
  <a b-x style="text-decoration: none !important;"
     href="${url}"
     data-gameimageid="1"
     data-toggle="lightbox"
     data-gallery="gallery"
     data-title="${title}"
     data-footer="1131 x 1407 JPEG"><img src="${url}" alt="x" /></a>`;

const IMAGES =
  img("https://images.launchbox-app.com/front-na.jpg", "Gran Turismo 7: The Real Driving Simulator - Box - Front Image (North America)") +
  img("https://images.launchbox-app.com/logo.png", "Gran Turismo 7: The Real Driving Simulator - Clear Logo Image") +
  img("https://images.launchbox-app.com/disc-eu.png", "Gran Turismo 7: The Real Driving Simulator - Disc Image (Europe)") +
  img("https://images.launchbox-app.com/back-na.jpg", "Gran Turismo 7: The Real Driving Simulator - Box - Back Image (North America)") +
  img("https://images.launchbox-app.com/disc-jp.png", "Gran Turismo 7: The Real Driving Simulator - Disc Image (Japan)");

describe("LaunchBox : résultats de recherche", () => {
  it("lit l'identifiant, le titre et la plateforme de chaque carte", () => {
    const r = parseResults(RESULTS);
    expect(r).toHaveLength(4);
    expect(r[0]).toEqual({ id: "159658", title: "Gran Turismo 7: The Real Driving Simulator", platform: "Sony Playstation 5" });
  });

  it("choisit la bonne plateforme et écarte les éditions spéciales", () => {
    const r = parseResults(RESULTS);
    expect(pickResult(r, "Gran Turismo 7", "ps5")?.id).toBe("159658");
    expect(pickResult(r, "Gran Turismo 7", "ps4")?.id).toBe("160173");
    expect(pickResult(r, "Gran Turismo 7 : 25th Anniversary Edition", "ps5")?.id).toBe("160174");
    expect(pickResult(r, "Uncharted: The Nathan Drake Collection", "ps4")?.id).toBe("9001");
  });

  it("ne renvoie rien si le jeu n'existe pas sur la plateforme", () => {
    expect(pickResult(parseResults(RESULTS), "Gran Turismo 7", "ps3")).toBeNull();
    expect(pickResult(parseResults(RESULTS), "Astro Bot", "ps5")).toBeNull();
  });
});

describe("LaunchBox : images d'un jeu", () => {
  it("lit le type et la région de chaque image", () => {
    const images = parseImages(IMAGES);
    expect(images).toHaveLength(5);
    expect(images[1]).toEqual({ type: "Clear Logo", region: null, url: "https://images.launchbox-app.com/logo.png" });
    expect(images[3]).toEqual({ type: "Box - Back", region: "North America", url: "https://images.launchbox-app.com/back-na.jpg" });
  });

  it("préfère la version européenne, sinon prend ce qui existe", () => {
    const images = parseImages(IMAGES);
    expect(pickImage(images, "Disc")?.url).toBe("https://images.launchbox-app.com/disc-eu.png");
    expect(pickImage(images, "Box - Back")?.url).toBe("https://images.launchbox-app.com/back-na.jpg");
    expect(pickImage(images, "Cart")).toBeNull();
  });

  it("n'accepte que les images hébergées par LaunchBox", () => {
    expect(safeImageUrl("https://images.launchbox-app.com/x.jpg")).not.toBeNull();
    expect(safeImageUrl("http://images.launchbox-app.com/x.jpg")).toBeNull();
    expect(safeImageUrl("https://evil.example/x.jpg")).toBeNull();
    expect(safeImageUrl("https://images.launchbox-app.com.evil.example/x.jpg")).toBeNull();
  });
});
