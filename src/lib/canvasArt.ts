// Visuels générés en canvas : jaquette avant, tranche, dos, sérigraphie et face gravée du disque.
// Mise en page des boîtiers européens (PAL) PS5, PS4 et PS3, relevée sur de vrais boîtiers.
// Bandeaux : logotypes officiels PS5 / PS4 / PS3 (versions du domaine public de Wikimedia Commons,
// public/brand/consoles/), seuls le visuel et les infos du jeu changent d'une jaquette à l'autre.
import { mix, pegiColor, wrapText } from "./artUtils";
import { PLATFORMS } from "./platforms";
import type { Game, Platform } from "./types";

const DISPLAY = "\"Chakra Petch\", system-ui, sans-serif";
const BODY = "Barlow, system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

/** Charge une image distante utilisable dans un canvas (CORS). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image illisible : ${src.slice(0, 80)}`));
    img.src = src;
  });
}

// Logotypes officiels des bandeaux : PS5 noir, PS4 et PS3 blancs (teintés au besoin).
const WORDMARK_SRC: Record<Platform, string> = {
  ps5: `${import.meta.env.BASE_URL}brand/consoles/ps5-wordmark.png`,
  ps4: `${import.meta.env.BASE_URL}brand/consoles/ps4-wordmark.png`,
  ps3: `${import.meta.env.BASE_URL}brand/consoles/ps3-wordmark.png`,
};
const wordmarkImg: Partial<Record<Platform, HTMLImageElement>> = {};
let wordmarksLoading: Promise<void> | null = null;

function wordmarksReady(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  wordmarksLoading ??= Promise.all(
    (Object.keys(WORDMARK_SRC) as Platform[]).map((p) =>
      loadImage(WORDMARK_SRC[p])
        .then((img) => void (wordmarkImg[p] = img))
        .catch(() => undefined), // logo absent : le texte de secours prend le relais
    ),
  ).then(() => undefined);
  return wordmarksLoading;
}

/** Attend que les polices et les logotypes soient prêts (sinon le canvas dessine en police système). */
export async function fontsReady(): Promise<void> {
  await wordmarksReady();
  try {
    await Promise.all([
      document.fonts.load(`700 48px ${DISPLAY}`),
      document.fonts.load(`600 24px ${DISPLAY}`),
      document.fonts.load(`600 20px ${BODY}`),
      document.fonts.load(`500 20px ${MONO}`),
    ]);
  } catch {
    // police indisponible : le canvas utilise la police de secours
  }
}

function hashHue(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

type Img = CanvasImageSource & { width: number; height: number };

function drawCover(ctx: CanvasRenderingContext2D, img: Img, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Part de la hauteur occupée par le bandeau de plateforme sur une jaquette européenne. */
const BAND = 0.105;

/**
 * Logotype officiel de la plateforme, hauteur `height`, centré verticalement sur y.
 * `ink` recolore le logo (« silver » : dégradé argenté du PS3) ; sans logo chargé, le nom est écrit en secours.
 */
function drawWordmark(
  ctx: CanvasRenderingContext2D,
  platform: Platform,
  x: number,
  y: number,
  height: number,
  ink: string,
  align: "left" | "center" = "left",
) {
  const img = wordmarkImg[platform];
  if (!img) {
    ctx.save();
    ctx.fillStyle = ink === "silver" ? "#d8dbe2" : ink;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.font = `600 ${height * 1.25}px ${DISPLAY}`;
    ctx.letterSpacing = `${height * 0.2}px`;
    ctx.fillText(PLATFORMS[platform].label, x, y);
    ctx.restore();
    return;
  }
  const w = (img.width / img.height) * height;
  const left = align === "center" ? x - w / 2 : x;
  // recoloration : logo dessiné seul, puis la couleur appliquée « dans » sa forme
  const off = document.createElement("canvas");
  off.width = Math.ceil(w);
  off.height = Math.ceil(height);
  const o = off.getContext("2d")!;
  o.drawImage(img, 0, 0, w, height);
  o.globalCompositeOperation = "source-in";
  if (ink !== "silver") o.fillStyle = ink;
  else {
    const g = o.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, "#f6f7fa");
    g.addColorStop(1, "#9ea3ae");
    o.fillStyle = g;
  }
  o.fillRect(0, 0, off.width, off.height);
  ctx.drawImage(off, left, y - height / 2);
}

/**
 * Bandeau du haut de la jaquette, version européenne :
 * PS5 blanc à lettrage noir, PS4 bleu dégradé (sombre aux bords) à lettrage blanc,
 * PS3 noir laqué à lettrage argent, avec « PlayStation Network » à droite.
 */
function drawBand(ctx: CanvasRenderingContext2D, platform: Platform, w: number, h: number) {
  if (platform === "ps5") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    drawWordmark(ctx, "ps5", h * 0.5, h * 0.5, h * 0.4, "#000000");
    return;
  }
  if (platform === "ps4") {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "#00246a");
    g.addColorStop(0.5, "#0b52c9");
    g.addColorStop(1, "#00246a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    drawWordmark(ctx, "ps4", h * 0.5, h * 0.5, h * 0.4, "#ffffff");
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#36373d");
  g.addColorStop(0.5, "#0b0b0d");
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // « PS3 » argenté (dégradé appliqué dans le logo)
  drawWordmark(ctx, "ps3", h * 0.5, h * 0.5, h * 0.34, "silver");
  ctx.save();
  ctx.fillStyle = "#e4e6ec";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${h * 0.24}px ${BODY}`;
  ctx.fillText("PlayStation Network", w - h * 0.4, h * 0.52);
  ctx.restore();
}

/** Pictogramme PEGI européen : âge sur fond de couleur, « www.pegi.info » sur bande blanche. */
function drawPegi(ctx: CanvasRenderingContext2D, pegi: Game["pegi"], x: number, y: number, size: number) {
  if (!pegi) return;
  const strip = size * 0.24;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 2, y - 2, size + 4, size + strip + 4);
  ctx.fillStyle = pegiColor(pegi);
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${size * 0.62}px ${DISPLAY}`;
  ctx.fillText(String(pegi), x + size / 2, y + size * 0.54);
  ctx.fillStyle = "#000000";
  ctx.font = `600 ${strip * 0.62}px ${BODY}`;
  ctx.fillText("www.pegi.info", x + size / 2, y + size + strip / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

/** Pastille d'information imprimée en bas de face (« Connexion internet requise »…). */
function drawInfoPill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, h: number, border: string) {
  ctx.save();
  ctx.font = `700 ${h * 0.38}px ${BODY}`;
  const w = ctx.measureText(text).width + h * 0.9;
  ctx.fillStyle = "rgba(0,0,0,.6)";
  roundRect(ctx, x, y, w, h, h * 0.3);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = Math.max(1, h * 0.05);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + h * 0.45, y + h / 2);
  ctx.restore();
}

/** Code-barres EAN décoratif (motif régulier, aucun code réel). */
function drawBarcode(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: string) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#0d0f14";
  let cx = x + w * 0.04;
  let k = hashHue(seed) + 7;
  while (cx < x + w * 0.96) {
    k = (k * 37 + 11) % 97;
    const bw = 1 + (k % 3);
    ctx.fillRect(cx, y + h * 0.06, bw, h * 0.8);
    cx += bw + 1 + ((k >> 2) % 3);
  }
}

function lines(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, max: number, align: CanvasTextAlign = "left") {
  ctx.textAlign = align;
  const ls = wrapText(text, maxW, (s) => ctx.measureText(s).width, max);
  ls.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  ctx.textAlign = "left";
  return ls.length * lh;
}

/**
 * Jaquette générée (mode démo, ou jeu sans jaquette trouvée) :
 * bandeau de plateforme + dégradé + titre. Aucune image protégée.
 */
export function generatedCover(title: string, platform: Platform): string {
  const W = 540, H = 684;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const hue = hashHue(title);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, `hsl(${hue} 62% 34%)`);
  g.addColorStop(1, `hsl(${(hue + 50) % 360} 70% 12%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const r = ctx.createRadialGradient(W * 0.72, H * 0.36, 10, W * 0.72, H * 0.36, W * 0.75);
  r.addColorStop(0, `hsla(${(hue + 25) % 360} 90% 72% / .55)`);
  r.addColorStop(1, "transparent");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, H);
  // Illustration seule : le bandeau, le PEGI et l'éditeur sont posés par frontCover, comme sur un vrai boîtier.
  void platform;
  ctx.fillStyle = "#fff";
  ctx.font = `700 58px ${DISPLAY}`;
  ctx.shadowColor = "rgba(0,0,0,.45)";
  ctx.shadowBlur = 18;
  const ls = wrapText(title.toUpperCase(), W - 72, (s) => ctx.measureText(s).width, 4);
  ls.forEach((l, i) => ctx.fillText(l, 36, H * 0.42 + i * 64));
  return c.toDataURL("image/jpeg", 0.9);
}

/**
 * La jaquette a-t-elle déjà son bandeau de plateforme ? On regarde la bande du haut :
 * uniforme et claire (PS5), bleue (PS4) ou très sombre (PS3).
 */
function hasBand(img: Img, platform: Platform): boolean {
  const sample = (y0: number, y1: number) => {
    const c = document.createElement("canvas");
    c.width = 24; c.height = 4;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    // milieu de la largeur seulement : le nom de plateforme est à gauche, « PlayStation Network » à droite (PS3)
    ctx.drawImage(img, img.width * 0.35, img.height * y0, img.width * 0.3, img.height * (y1 - y0), 0, 0, 24, 4);
    const d = ctx.getImageData(0, 0, 24, 4).data;
    let r = 0, g = 0, b = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    r /= n; g /= n; b /= n;
    let v = 0;
    for (let i = 0; i < d.length; i += 4) v += Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b);
    return { r, g, b, v: v / n };
  };
  const band = sample(0.015, 0.07);
  const below = sample(0.13, 0.17);
  // un vrai bandeau est uni et tranche nettement avec l'illustration juste en dessous
  const contrast = Math.abs(band.r - below.r) + Math.abs(band.g - below.g) + Math.abs(band.b - below.b);
  if (band.v > 45 || contrast < 70) return false;
  if (platform === "ps5") return band.r > 225 && band.g > 225 && band.b > 225;
  if (platform === "ps4") return band.b > 120 && band.r < 70 && band.g < 120;
  return band.r < 45 && band.g < 45 && band.b < 50;
}

/**
 * Face avant : toujours le bandeau officiel de la plateforme, seul le visuel du jeu change.
 * Jaquette importée avec son propre bandeau : on le coupe et on garde l'illustration (avec ses
 * mentions d'origine en pied). Illustration seule : on compose tout le pied européen (PEGI, pastille, éditeur).
 */
export async function frontCover(game: Game): Promise<HTMLCanvasElement> {
  const W = 1080, H = 1368;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  await fontsReady();
  let img: HTMLImageElement | null = null;
  try {
    img = await loadImage(game.cover_url ?? generatedCover(game.title, game.platform));
  } catch {
    img = null;
  }
  const bh = Math.round(H * BAND);
  if (img && hasBand(img, game.platform)) {
    const cut = Math.round(img.height * BAND);
    const art = document.createElement("canvas");
    art.width = img.width;
    art.height = img.height - cut;
    art.getContext("2d")!.drawImage(img, 0, cut, img.width, img.height - cut, 0, 0, img.width, img.height - cut);
    drawCover(ctx, art, 0, bh, W, H - bh);
    drawBand(ctx, game.platform, W, bh);
    return c;
  }
  if (img) drawCover(ctx, img, 0, bh, W, H - bh);
  else {
    ctx.fillStyle = "#2a3150";
    ctx.fillRect(0, bh, W, H - bh);
  }
  drawBand(ctx, game.platform, W, bh);
  // Pied de face : PEGI à gauche, pastille d'information, éditeur à droite.
  const foot = H - 64;
  const shade = ctx.createLinearGradient(0, H - 300, 0, H);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,.45)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, H - 300, W, 300);
  drawPegi(ctx, game.pegi, 48, foot - 170, 130);
  if (game.platform !== "ps3") drawInfoPill(ctx, "CONNEXION INTERNET REQUISE", game.pegi ? 210 : 48, foot - 64, 52, game.platform === "ps4" ? "#3d8bff" : "rgba(255,255,255,.8)");
  if (game.publisher) {
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = `700 30px ${BODY}`;
    ctx.textAlign = "right";
    const [pub] = wrapText(game.publisher.toUpperCase(), 330, (s) => ctx.measureText(s).width, 1);
    ctx.fillText(pub ?? "", W - 48, foot - 10);
    ctx.textAlign = "left";
  }
  return c;
}

/**
 * Tranche (côté charnière), version européenne : en haut le segment de plateforme
 * (blanc PS5, bleu PS4, noir PS3) avec le nom à la verticale, puis le titre, et le PEGI en pied.
 */
export function spineTexture(game: Game, base: string): HTMLCanvasElement {
  const W = 96, H = 1216;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const body = game.platform === "ps5" ? base : "#0b0b0d";
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, mix(body, "#000000", 0.25));
  g.addColorStop(0.5, body);
  g.addColorStop(1, mix(body, "#000000", 0.3));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const top = 170;
  if (game.platform === "ps5") ctx.fillStyle = "#ffffff";
  else if (game.platform === "ps4") {
    const b = ctx.createLinearGradient(0, 0, W, 0);
    b.addColorStop(0, "#00246a"); b.addColorStop(0.5, "#0b52c9"); b.addColorStop(1, "#00246a");
    ctx.fillStyle = b;
  } else {
    const b = ctx.createLinearGradient(0, 0, W, 0);
    b.addColorStop(0, "#2a2b30"); b.addColorStop(1, "#000000");
    ctx.fillStyle = b;
  }
  ctx.fillRect(0, 0, W, top);
  ctx.save();
  ctx.translate(W / 2, top / 2);
  ctx.rotate(Math.PI / 2);
  drawWordmark(ctx, game.platform, 0, 0, 26, game.platform === "ps5" ? "#000000" : "#e9ebf0", "center");
  ctx.restore();
  ctx.save();
  ctx.translate(W / 2 + 14, top + 34);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 40px ${DISPLAY}`;
  const [line] = wrapText(game.title.toUpperCase(), H - top - 190, (s) => ctx.measureText(s).width, 1);
  ctx.fillText(line ?? "", 0, 0);
  ctx.restore();
  if (game.pegi) {
    ctx.fillStyle = pegiColor(game.pegi);
    ctx.fillRect(12, H - 96, W - 24, 72);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = `700 42px ${DISPLAY}`;
    ctx.fillText(String(game.pegi), W / 2, H - 45);
    ctx.textAlign = "left";
  }
  return c;
}

async function screenshots(game: Game, n: number): Promise<HTMLImageElement[]> {
  const shots = await Promise.all(game.screenshots.slice(0, n).map((u) => loadImage(u).catch(() => null)));
  return shots.filter((s): s is HTMLImageElement => !!s);
}

function framed(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, w: number, h: number, fallback: string) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (img) drawCover(ctx, img, x, y, w, h);
  else {
    ctx.fillStyle = fallback;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

/** Bande blanche de mentions légales (commune aux trois dos), avec code-barres. */
function legalStrip(ctx: CanvasRenderingContext2D, game: Game, y: number, W: number, H: number, bg = "#ffffff", x0 = 48) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, y, W, H - y);
  ctx.fillStyle = "rgba(13,15,20,.62)";
  ctx.font = `500 17px ${BODY}`;
  const year = game.release_year ? `©${game.release_year} ` : "";
  const legal = `FOR HOME USE ONLY. ${year}${game.publisher ?? ""}. Unauthorised copying, adaptation, rental, lending, distribution, extraction, re-sale, renting, arcade use, charging for use, broadcast, public performance and internet transmission are prohibited.`;
  lines(ctx, legal, x0, y + 34, W - x0 - 48 - 300, 22, 4);
  drawBarcode(ctx, W - 48 - 270, H - 120, 270, 90, game.title);
}

/**
 * Dos du boîtier. Photo de l'utilisateur si elle existe ; sinon composé selon la mise en page
 * européenne de la plateforme, avec les vraies données du jeu (captures, résumé, genres, PEGI, éditeur).
 */
export async function backCover(game: Game, tint: string): Promise<HTMLCanvasElement> {
  const W = 1080, H = 1368;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  if (game.back_url) {
    try {
      drawCover(ctx, await loadImage(game.back_url), 0, 0, W, H);
      return c;
    } catch {
      // photo illisible : on compose le dos
    }
  }
  await fontsReady();
  const shots = await screenshots(game, 3);
  let cover: HTMLImageElement | null = null;
  try {
    cover = await loadImage(game.cover_url ?? generatedCover(game.title, game.platform));
  } catch {
    cover = null;
  }
  const dark = mix(tint, "#06070b", 0.78);
  const summary = game.summary ?? "";
  const pad = 56;

  if (game.platform === "ps5") {
    // PS5 : pas de bandeau ; illustration pleine, texte centré, bande blanche de caractéristiques.
    const stripY = H - 330;
    if (cover) {
      drawCover(ctx, cover, 0, 0, W, stripY);
      ctx.fillStyle = "rgba(6,7,11,.55)";
      ctx.fillRect(0, 0, W, stripY);
    } else {
      ctx.fillStyle = dark;
      ctx.fillRect(0, 0, W, stripY);
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 30px ${BODY}`;
    let y = 110;
    if (summary) y += lines(ctx, summary.toUpperCase(), W / 2, y, W - 180, 40, 6, "center") + 30;
    const sw = (W - pad * 2 - 24) / 2;
    shots.slice(0, 2).forEach((s, i) => framed(ctx, s, pad + i * (sw + 24), Math.max(y, stripY - 40 - sw * 0.5625), sw, sw * 0.5625, dark));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, stripY, W, H - stripY);
    let px = pad;
    const pills = ["1 JOUEUR", ...game.genres.slice(0, 2).map((g) => g.toUpperCase())];
    ctx.font = `700 20px ${BODY}`;
    for (const t of pills) {
      const w = ctx.measureText(t).width + 40;
      ctx.fillStyle = "#111111";
      roundRect(ctx, px, stripY + 26, w, 44, 8);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(t, px + 20, stripY + 55);
      px += w + 12;
    }
    ctx.fillStyle = "#111111";
    ctx.fillRect(W - pad - 250, stripY + 26, 250, 44);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 22px ${BODY}`;
    ctx.fillText("playstation.com", W - pad - 225, stripY + 56);
    legalStrip(ctx, game, stripY + 96, W, H, "#ffffff", game.pegi ? pad + 112 : pad);
    drawPegi(ctx, game.pegi, pad, stripY + 112, 84);
    ctx.fillStyle = "#1b4fb8";
    ctx.fillRect(W - pad - 190, stripY + 96, 190, 40);
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 18px ${BODY}`;
    ctx.fillText("ULTRA HD Blu-ray", W - pad - 176, stripY + 122);
    return c;
  }

  if (game.platform === "ps4") {
    // PS4 : texte à gauche, captures empilées à droite, PEGI, tuiles bleues, bande blanche.
    const stripY = H - 250;
    const tilesY = stripY - 110;
    if (cover) {
      drawCover(ctx, cover, 0, 0, W, tilesY);
      ctx.fillStyle = "rgba(6,7,11,.62)";
      ctx.fillRect(0, 0, W, tilesY);
    } else {
      ctx.fillStyle = dark;
      ctx.fillRect(0, 0, W, tilesY);
    }
    const colW = 420;
    const sh = colW * 0.5625;
    [0, 1, 2].forEach((i) => framed(ctx, shots[i] ?? null, W - pad - colW, 70 + i * (sh + 22), colW, sh, mix(tint, "#000", 0.5)));
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 46px ${DISPLAY}`;
    let y = 120;
    y += lines(ctx, game.title.toUpperCase(), pad, y, W - colW - pad * 3, 50, 2) + 20;
    ctx.font = `500 26px ${BODY}`;
    ctx.fillStyle = "rgba(255,255,255,.88)";
    if (summary) lines(ctx, summary, pad, y, W - colW - pad * 3, 36, 14);
    drawPegi(ctx, game.pegi, W - pad - 120, tilesY - 190, 120);
    ctx.fillStyle = "#0d0f16";
    ctx.fillRect(0, tilesY, W, stripY - tilesY);
    const tiles = ["1 JOUEUR", "ESPACE REQUIS", "DUALSHOCK 4", ...(game.genres[0] ? [game.genres[0].toUpperCase()] : [])];
    const tw = (W - pad * 2 - 12 * (tiles.length - 1)) / tiles.length;
    tiles.forEach((t, i) => {
      ctx.fillStyle = "#0b63ce";
      ctx.fillRect(pad + i * (tw + 12), tilesY + 18, tw, 74);
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 19px ${BODY}`;
      ctx.textAlign = "center";
      ctx.fillText(t, pad + i * (tw + 12) + tw / 2, tilesY + 82);
      ctx.textAlign = "left";
    });
    legalStrip(ctx, game, stripY, W, H);
    ctx.fillStyle = "#0b63ce";
    roundRect(ctx, pad, H - 76, 230, 44, 6);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 22px ${BODY}`;
    ctx.fillText("playstation.com", pad + 26, H - 46);
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(pad + 280, H - 54, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 24px ${BODY}`;
    ctx.fillText("2", pad + 273, H - 45);
    ctx.fillStyle = "#0b5fc4";
    ctx.font = `italic 700 24px ${BODY}`;
    ctx.fillText("Blu-ray Disc", pad + 320, H - 45);
    return c;
  }

  // PS3 : fond noir, trois captures en haut, texte, PEGI et pictogrammes argentés, bande claire.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1b1c21");
  g.addColorStop(1, "#050506");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const sw = (W - pad * 2 - 32) / 3;
  [0, 1, 2].forEach((i) => framed(ctx, shots[i] ?? null, pad + i * (sw + 16), 56, sw, sw * 0.5625, mix(tint, "#000", 0.5)));
  let y = 56 + sw * 0.5625 + 70;
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 40px ${DISPLAY}`;
  y += lines(ctx, game.title.toUpperCase(), pad, y, W - pad * 2, 46, 2) + 14;
  ctx.font = `500 25px ${BODY}`;
  ctx.fillStyle = "rgba(255,255,255,.85)";
  if (summary) lines(ctx, summary, pad, y, W - pad * 2, 34, 12);
  const stripY = H - 230;
  const featY = stripY - 150;
  drawPegi(ctx, game.pegi, pad, featY, 100);
  for (let i = 0; i < 5; i++) {
    const fx = pad + 130 + i * 128;
    const fg = ctx.createLinearGradient(0, featY, 0, featY + 110);
    fg.addColorStop(0, "#eceef2");
    fg.addColorStop(1, "#b5b9c2");
    ctx.fillStyle = fg;
    ctx.fillRect(fx, featY + 10, 112, 112);
  }
  legalStrip(ctx, game, stripY, W, H, "#ececee");
  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.arc(pad + 24, H - 52, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 24px ${BODY}`;
  ctx.fillText("2", pad + 17, H - 43);
  ctx.fillStyle = "#0b5fc4";
  ctx.font = `italic 700 24px ${BODY}`;
  ctx.fillText("Blu-ray Disc", pad + 64, H - 43);
  return c;
}

/**
 * Sérigraphie du disque (face étiquette). Photo du vrai disque si elle existe ; sinon,
 * comme sur les disques européens : illustration sur tout le disque et segment de plateforme
 * en bas (blanc à filet bleu sur PS5, bleu sur PS4, noir sur PS3 avec une illustration argentée).
 */
export async function discLabel(game: Game): Promise<HTMLCanvasElement> {
  const S = 1024;
  const R = S / 2;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R, 0, Math.PI * 2);
  ctx.clip();
  if (game.disc_url) {
    try {
      drawCover(ctx, await loadImage(game.disc_url), 0, 0, S, S);
      ctx.restore();
      return c;
    } catch {
      // photo illisible : on génère la sérigraphie
    }
  }
  await fontsReady();
  try {
    const img = await loadImage(game.cover_url ?? generatedCover(game.title, game.platform));
    // Recadrage sous le bandeau de la jaquette, là où se trouve l'illustration.
    const s = Math.max(S / img.width, S / (img.height * 0.8));
    const dw = img.width * s;
    if (game.platform === "ps3") ctx.filter = "saturate(.45) brightness(1.18) contrast(1.05)";
    ctx.drawImage(img, (S - dw) / 2, -img.height * s * 0.12, dw, img.height * s);
    ctx.filter = "none";
  } catch {
    ctx.fillStyle = "#c9ccd6";
    ctx.fillRect(0, 0, S, S);
  }
  // Segment de plateforme en bas du disque.
  const top = S * 0.77;
  if (game.platform === "ps5") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, top, S, S - top);
    ctx.fillStyle = "#2a63d6";
    ctx.fillRect(0, top - 6, S, 6);
  } else if (game.platform === "ps4") {
    const g = ctx.createLinearGradient(0, top, 0, S);
    g.addColorStop(0, "#1d63d6");
    g.addColorStop(1, "#0a3a96");
    ctx.fillStyle = g;
    ctx.fillRect(0, top, S, S - top);
  } else {
    ctx.fillStyle = "#060607";
    ctx.fillRect(0, top, S, S - top);
    ctx.fillStyle = "#5a5d66";
    ctx.fillRect(0, top - 3, S, 3);
  }
  const ink = game.platform === "ps5" ? "#000000" : "#eef0f5";
  drawWordmark(ctx, game.platform, R, top + 64, 40, ink, "center");
  ctx.fillStyle = game.platform === "ps5" ? "rgba(0,0,0,.4)" : "rgba(255,255,255,.4)";
  ctx.fillRect(R - 200, top + 118, 400, 4);
  ctx.fillRect(R - 150, top + 132, 300, 4);
  if (game.pegi) {
    ctx.fillStyle = pegiColor(game.pegi);
    ctx.fillRect(S * 0.78, R + 30, 70, 70);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = `700 44px ${DISPLAY}`;
    ctx.fillText(String(game.pegi), S * 0.78 + 35, R + 82);
    ctx.textAlign = "left";
  }
  // Zone transparente centrale (moyeu), comme sur un vrai disque.
  const hub = ctx.createRadialGradient(R, R, 0, R, R, R * 0.33);
  hub.addColorStop(0, "rgba(230,234,242,1)");
  hub.addColorStop(0.62, "rgba(214,219,229,.96)");
  hub.addColorStop(0.9, "rgba(190,197,211,.55)");
  hub.addColorStop(1, "rgba(190,197,211,0)");
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(R, R, R * 0.33, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return c;
}

/** Face gravée (lecture) du disque : anneaux concentriques + diffraction arc-en-ciel. */
export function discDataSide(): HTMLCanvasElement {
  const S = 1024;
  const R = S / 2;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R, 0, Math.PI * 2);
  ctx.clip();
  // Base argent-bleuté d'une face de lecture Blu-ray.
  const base = ctx.createRadialGradient(R, R, R * 0.3, R, R, R);
  base.addColorStop(0, "#9aa3b6");
  base.addColorStop(1, "#5d6680");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  // Diffraction : deux tours d'arc-en-ciel, comme les reflets en « éventail » d'un vrai disque.
  const conic = ctx.createConicGradient(0.4, R, R);
  ["#5ee8ff", "#a77bff", "#ff7fd5", "#ffd36b", "#76ffa0", "#5ee8ff", "#a77bff", "#ff7fd5", "#ffd36b", "#76ffa0", "#5ee8ff"].forEach((col, i, a) =>
    conic.addColorStop(i / (a.length - 1), col),
  );
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = conic;
  ctx.fillRect(0, 0, S, S);
  ctx.globalAlpha = 1;
  for (let r = R * 0.36; r < R; r += 3) {
    ctx.strokeStyle = `rgba(255,255,255,${0.04 + ((r * 7) % 5) / 120})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(R, R, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const hub = ctx.createRadialGradient(R, R, 0, R, R, R * 0.34);
  hub.addColorStop(0, "rgba(220,226,236,.95)");
  hub.addColorStop(0.85, "rgba(200,207,220,.6)");
  hub.addColorStop(1, "rgba(200,207,220,0)");
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(R, R, R * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return c;
}

const colorCache = new Map<string, string>();

/** Couleur dominante d'une image (moyenne pondérée vers les tons saturés), mise en cache. */
export async function dominantColor(src: string | null, fallback = "#24304f"): Promise<string> {
  if (!src) return fallback;
  const hit = colorCache.get(src);
  if (hit) return hit;
  try {
    const img = await loadImage(src);
    const c = document.createElement("canvas");
    c.width = 12; c.height = 12;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, img.height * 0.12, img.width, img.height * 0.88, 0, 0, 12, 12);
    const d = ctx.getImageData(0, 0, 12, 12).data;
    let r = 0, g = 0, b = 0, wsum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const max = Math.max(d[i], d[i + 1], d[i + 2]);
      const min = Math.min(d[i], d[i + 1], d[i + 2]);
      const w = 0.25 + (max - min) / 255; // les pixels colorés comptent plus que les gris
      r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; wsum += w;
    }
    const hex = "#" + [r, g, b].map((v) => Math.round(v / wsum).toString(16).padStart(2, "0")).join("");
    colorCache.set(src, hex);
    return hex;
  } catch {
    return fallback;
  }
}
