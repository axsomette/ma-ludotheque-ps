import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Content-Security-Policy de la version publiée (GitHub Pages ne permet pas d'en-têtes HTTP : balise meta).
 * Pas en développement : le rechargement à chaud de Vite injecte des scripts en ligne.
 * - scripts : le site (+ WebAssembly pour l'OCR, servi depuis /ocr/) et Cloudflare Turnstile (anti-robots) ;
 * - réseau : le site et Supabase (API, stockage, fonctions) ; data:/blob: pour les textures du modèle 3D ;
 * - images : le site, Supabase (jaquettes copiées), IGDB (vignettes de recherche), data:/blob: (canvas, photos).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com", // vérification anti-robots Turnstile
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co https://images.igdb.com",
  "connect-src 'self' data: blob: https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function contentSecurityPolicy(): Plugin {
  return {
    name: "ludotheque-csp",
    apply: "build",
    transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" }],
  };
}

// Sur GitHub Pages, le site est servi sous /<nom-du-repo>/.
// BASE_PATH est fourni par le workflow de déploiement ; en local on sert à la racine.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), contentSecurityPolicy()],
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
