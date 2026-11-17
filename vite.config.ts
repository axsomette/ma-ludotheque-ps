import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Sur GitHub Pages, le site est servi sous /<nom-du-repo>/.
// BASE_PATH est fourni par le workflow de déploiement ; en local on sert à la racine.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
