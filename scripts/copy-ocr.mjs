// Copie dans public/ocr/ les fichiers dont Tesseract a besoin à l'exécution (worker, moteur WebAssembly,
// données de langue eng/fra), depuis node_modules : l'OCR ne charge plus aucun code depuis un CDN.
// Lancé automatiquement avant `npm run dev` et `npm run build`. public/ocr/ est ignoré par git.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "ocr");
const nm = (p) => join(root, "node_modules", p);

const files = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  // OCR en mode LSTM seul (OEM 1, défaut) : l'une de ces trois variantes est choisie selon le navigateur
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "core/tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "core/tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "core/tesseract-core-relaxedsimd-lstm.wasm.js"],
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "lang/eng.traineddata.gz"],
  ["@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz", "lang/fra.traineddata.gz"],
];

for (const [from, to] of files) {
  const dest = join(out, to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(nm(from), dest);
}
console.log(`OCR : ${files.length} fichiers copiés dans public/ocr/`);
