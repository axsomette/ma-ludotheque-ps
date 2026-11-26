// Service worker de la Ludothèque.
// - Interface (HTML, JS, CSS, icônes, polices) : disponible hors ligne.
// - Page d'accueil : réseau d'abord (pour recevoir les mises à jour), cache en secours.
// - Fichiers versionnés (assets/…) et polices : cache d'abord.
// - Données Supabase, IGDB, Twitch : jamais mises en cache (toujours fraîches, jamais de données d'un autre compte).
const VERSION = "ludotheque-v6";
const SHELL = ["./", "manifest.webmanifest", "models/case.glb", "icons/icon-192.png", "icons/icon-512.png", "icons/icon.svg", "favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const NEVER_CACHE = /supabase\.co|igdb\.com|twitch\.tv|tessdata|jsdelivr/;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || NEVER_CACHE.test(req.url)) return;
  const url = new URL(req.url);

  // Navigation : réseau d'abord, page en cache si hors ligne.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !fonts) return;

  // Fichiers statiques et polices : cache d'abord, puis réseau (et on garde une copie).
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok || res.type === "opaque") {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
