/*
 * Minimal service worker — its job is to make the app installable, not to work
 * offline. Offline is explicitly out of scope, and this app renders live
 * database state, so caching HTML or server-action responses would show stale
 * answers to "who owes me what". The only thing cached is the icon set.
 *
 * A fetch handler must exist for Chrome/Edge to offer "Install"; this one
 * deliberately declines to handle anything except icons, letting the browser
 * do its normal thing (which keeps dev-server HMR untouched).
 */

const CACHE = "follow-ups-icons-v1";
const ICONS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ICONS))
      .catch(() => undefined) // an icon miss must not block installation
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/icons/")) return;

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request)),
  );
});
