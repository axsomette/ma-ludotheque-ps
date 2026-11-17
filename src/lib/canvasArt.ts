// Visuels générés en canvas : jaquette de secours, tranche, dos, sérigraphie et face gravée du disque.
import { mix, pegiColor, readableOn, wrapText } from "./artUtils";
import { PLATFORMS } from "./platforms";
import type { Game, Platform } from "./types";

const DISPLAY = "\"Chakra Petch\", system-ui, sans-serif";
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

/** Attend que les polices de l'interface soient prêtes (sinon le canvas dessine en police système). */
export async function fontsReady(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`700 48px ${DISPLAY}`),
      document.fonts.load(`500 24px ${DISPLAY}`),
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

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Pictogramme PEGI : carré de couleur, âge en grand, « PEGI » en petit. */
function drawPegi(ctx: CanvasRenderingContext2D, pegi: Game["pegi"], x: number, y: number, size: number) {
  if (!pegi) return;
  ctx.fillStyle = pegiColor(pegi);
  roundRect(ctx, x, y, size, size, size * 0.06);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = `700 ${size * 0.5}px ${DISPLAY}`;
  ctx.fillText(String(pegi), x + size / 2, y + size * 0.6);
  ctx.font = `700 ${size * 0.17}px ${DISPLAY}`;
  ctx.fillText("PEGI", x + size / 2, y + size * 0.88);
  ctx.textAlign = "left";
}

/** Bandeau de plateforme, tel qu'imprimé en haut des jaquettes. */
function drawBand(ctx: CanvasRenderingContext2D, platform: Platform, w: number, h: number) {
  const p = PLATFORMS[platform];
  ctx.fillStyle = p.bandColor;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = p.bandText;
  ctx.font = `700 ${h * 0.5}px ${DISPLAY}`;
  ctx.fillText(p.label, h * 0.35, h * 0.68);
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
  drawBand(ctx, platform, W, 62);
  ctx.fillStyle = "#fff";
  ctx.font = `700 54px ${DISPLAY}`;
  ctx.shadowColor = "rgba(0,0,0,.45)";
  ctx.shadowBlur = 18;
  const lines = wrapText(title.toUpperCase(), W - 72, (s) => ctx.measureText(s).width, 4);
  lines.forEach((l, i) => ctx.fillText(l, 36, H - 64 - (lines.length - 1 - i) * 60));
  return c.toDataURL("image/jpeg", 0.9);
}

/** Tranche : bandeau plateforme, titre vertical, éditeur en pied. Couleur de fond tirée de la jaquette. */
export function spineTexture(game: Game, base: string): HTMLCanvasElement {
  const W = 96, H = 1216;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const p = PLATFORMS[game.platform];
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, mix(base, "#000000", 0.25));
  g.addColorStop(0.5, base);
  g.addColorStop(1, mix(base, "#000000", 0.3));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = p.bandColor;
  ctx.fillRect(0, 0, W, 150);
  ctx.fillStyle = p.bandText;
  ctx.font = `700 34px ${DISPLAY}`;
  ctx.textAlign = "center";
  ctx.fillText(p.label, W / 2, 92);
  const ink = readableOn(base);
  ctx.save();
  ctx.translate(W / 2 + 13, 190);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  ctx.font = `700 40px ${DISPLAY}`;
  const [line] = wrapText(game.title.toUpperCase(), H - 380, (s) => ctx.measureText(s).width, 1);
  ctx.fillText(line ?? "", 0, 0);
  ctx.restore();
  if (game.publisher) {
    ctx.save();
    ctx.translate(W / 2 + 7, H - 40);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.75;
    ctx.font = `600 20px ${MONO}`;
    const [pub] = wrapText(game.publisher.toUpperCase(), 160, (s) => ctx.measureText(s).width, 1);
    ctx.fillText(pub ?? "", 0, 0);
    ctx.restore();
  }
  return c;
}

/**
 * Dos du boîtier. Photo de l'utilisateur si elle existe ; sinon composé comme un vrai dos
 * à partir des données du jeu : bandeau, titre, captures, résumé, genres, PEGI, éditeur.
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
  const dark = mix(tint, "#06070b", 0.78);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix(tint, "#06070b", 0.62));
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawBand(ctx, game.platform, W, 96);

  const pad = 64;
  ctx.fillStyle = "#fff";
  ctx.font = `700 64px ${DISPLAY}`;
  const titleLines = wrapText(game.title.toUpperCase(), W - pad * 2, (s) => ctx.measureText(s).width, 2);
  titleLines.forEach((l, i) => ctx.fillText(l, pad, 190 + i * 70));
  let y = 190 + (titleLines.length - 1) * 70 + 42;

  const shots = await Promise.all(game.screenshots.slice(0, 3).map((u) => loadImage(u).catch(() => null)));
  const imgs = shots.filter((s): s is HTMLImageElement => !!s);
  const frame = (img: HTMLImageElement, x: number, yy: number, w: number, h: number) => {
    ctx.save();
    roundRect(ctx, x, yy, w, h, 10);
    ctx.clip();
    drawCover(ctx, img, x, yy, w, h);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, yy, w, h, 10);
    ctx.stroke();
  };
  if (imgs.length) {
    const fw = W - pad * 2;
    frame(imgs[0], pad, y, fw, Math.round((fw * 9) / 16));
    y += Math.round((fw * 9) / 16) + 18;
    if (imgs.length > 1) {
      const sw = (fw - 18) / 2;
      const sh = Math.round((sw * 9) / 16);
      imgs.slice(1, 3).forEach((im, i) => frame(im, pad + i * (sw + 18), y, sw, sh));
      y += sh + 34;
    } else y += 16;
  } else if (game.cover_url) {
    try {
      const cov = await loadImage(game.cover_url);
      ctx.save();
      roundRect(ctx, pad, y, W - pad * 2, 420, 10);
      ctx.clip(); // sans recadrage, l'image « cover » déborde de son cadre
      ctx.globalAlpha = 0.35;
      drawCover(ctx, cov, pad, y, W - pad * 2, 420);
      ctx.restore();
      y += 450;
    } catch {
      y += 30;
    }
  }

  if (game.summary) {
    ctx.fillStyle = "rgba(244,246,251,.9)";
    ctx.font = `400 27px ${DISPLAY}`;
    const room = Math.max(2, Math.floor((H - 250 - y) / 38));
    wrapText(game.summary, W - pad * 2, (s) => ctx.measureText(s).width, Math.min(room, 9)).forEach((l, i) =>
      ctx.fillText(l, pad, y + i * 38),
    );
  }

  // Pied : genres, PEGI, éditeur — comme le bandeau légal d'un vrai dos.
  const footY = H - 170;
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(0, footY - 26, W, 1.5);
  drawPegi(ctx, game.pegi, pad, footY, 112);
  const tx = game.pegi ? pad + 140 : pad;
  ctx.fillStyle = "#fff";
  ctx.font = `600 24px ${MONO}`;
  if (game.genres.length) ctx.fillText(game.genres.join(" / ").toUpperCase(), tx, footY + 36);
  ctx.fillStyle = "rgba(244,246,251,.65)";
  ctx.font = `500 22px ${MONO}`;
  const legal = [game.publisher, game.release_year].filter(Boolean).join(" · ");
  if (legal) ctx.fillText(`© ${legal}`, tx, footY + 80);
  return c;
}

/**
 * Sérigraphie du disque (face étiquette). Photo du vrai disque si elle existe ;
 * sinon la jaquette en plein cadre avec le bandeau de plateforme, comme sur les disques PlayStation.
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
    // Recadrage sur le haut de la jaquette (sous le bandeau), là où se trouve l'illustration principale.
    const s = Math.max(S / img.width, S / (img.height * 0.82));
    const dw = img.width * s;
    ctx.drawImage(img, (S - dw) / 2, -img.height * s * 0.1, dw, img.height * s);
  } catch {
    ctx.fillStyle = "#c9ccd6";
    ctx.fillRect(0, 0, S, S);
  }
  // Bandeau plateforme en bas du disque, avec PEGI.
  const p = PLATFORMS[game.platform];
  const bandTop = S * 0.76;
  ctx.fillStyle = p.bandColor;
  ctx.fillRect(0, bandTop, S, S - bandTop);
  ctx.fillStyle = p.bandText;
  ctx.textAlign = "center";
  ctx.font = `700 64px ${DISPLAY}`;
  ctx.fillText(p.label, R, bandTop + 92);
  if (game.pegi) drawPegi(ctx, game.pegi, R + 230, bandTop + 26, 92);
  ctx.textAlign = "left";
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
