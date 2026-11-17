import { PLATFORMS } from "./platforms";
import type { Platform } from "./types";

/** Charge une image distante utilisable dans un canvas (CORS). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image illisible : ${src}`));
    img.src = src;
  });
}

function hashHue(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/**
 * Jaquette générée (mode démo, ou jeu sans jaquette trouvée) :
 * bandeau de plateforme + dégradé + titre. Aucune image protégée.
 */
export function generatedCover(title: string, platform: Platform): string {
  const W = 540, H = 680;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const p = PLATFORMS[platform];
  const hue = hashHue(title);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, `hsl(${hue} 70% 32%)`);
  g.addColorStop(1, `hsl(${(hue + 60) % 360} 75% 12%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // halo
  const r = ctx.createRadialGradient(W * 0.7, H * 0.35, 10, W * 0.7, H * 0.35, W * 0.7);
  r.addColorStop(0, `hsla(${(hue + 30) % 360} 90% 70% / .55)`);
  r.addColorStop(1, "transparent");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, H);
  // bandeau
  ctx.fillStyle = p.bandColor;
  ctx.fillRect(0, 0, W, 64);
  ctx.fillStyle = p.bandText;
  ctx.font = "800 34px system-ui, sans-serif";
  ctx.fillText(p.label, 24, 45);
  // titre
  ctx.fillStyle = "#fff";
  ctx.font = "800 52px system-ui, sans-serif";
  ctx.shadowColor = "rgba(0,0,0,.5)";
  ctx.shadowBlur = 18;
  const lines = wrapLines(ctx, title.toUpperCase(), W - 70);
  lines.forEach((l, i) => ctx.fillText(l, 34, H - 70 - (lines.length - 1 - i) * 60));
  return c.toDataURL("image/jpeg", 0.9);
}

/** Tranche du boîtier : bandeau de plateforme en haut, titre à la verticale. */
export function spineTexture(title: string, platform: Platform): HTMLCanvasElement {
  const W = 64, H = 680;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const p = PLATFORMS[platform];
  ctx.fillStyle = "#f2f3f6";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = p.bandColor;
  ctx.fillRect(0, 0, W, 96);
  ctx.fillStyle = p.bandText;
  ctx.font = "800 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(p.label, W / 2, 60);
  ctx.save();
  ctx.translate(W / 2 + 9, 120);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = "#15171c";
  ctx.font = "700 26px system-ui, sans-serif";
  ctx.textAlign = "left";
  let t = title.toUpperCase();
  while (ctx.measureText(t).width > H - 150 && t.length > 4) t = t.slice(0, -2);
  ctx.fillText(t === title.toUpperCase() ? t : `${t}…`, 0, 0);
  ctx.restore();
  return c;
}

/** Sérigraphie du disque : la jaquette recadrée en cercle, trou central et anneau transparent. */
export async function discTexture(coverUrl: string | null, title: string, platform: Platform): Promise<HTMLCanvasElement> {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d")!;
  const R = S / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R, 0, Math.PI * 2);
  ctx.clip();
  try {
    const img = await loadImage(coverUrl ?? generatedCover(title, platform));
    const scale = Math.max(S / img.width, S / img.height);
    const w = img.width * scale, h = img.height * scale;
    ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
  } catch {
    ctx.fillStyle = "#c9ccd6";
    ctx.fillRect(0, 0, S, S);
  }
  // voile pour l'effet « imprimé sur disque »
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(0, 0, S, S);
  // zone transparente intérieure (argentée)
  const hub = ctx.createRadialGradient(R, R, 0, R, R, R * 0.36);
  hub.addColorStop(0, "#e9ecf2");
  hub.addColorStop(0.78, "#cfd4de");
  hub.addColorStop(1, "rgba(207,212,222,0)");
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(R, R, R * 0.36, 0, Math.PI * 2);
  ctx.fill();
  // libellé plateforme sur l'anneau
  ctx.fillStyle = "#1a1d24";
  ctx.font = "800 44px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(PLATFORMS[platform].label, R, R - R * 0.2);
  ctx.restore();
  return c;
}
