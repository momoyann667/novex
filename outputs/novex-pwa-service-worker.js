const NOVEX_PWA_VERSION = "novex-pwa-v1.0.0";
const NOVEX_STATIC_CACHE = `${NOVEX_PWA_VERSION}:static`;
const NOVEX_APP_SHELL = [
  "./novex-pwa-app-shell.html",
  "./novex-design-system.css",
  "./novex-pwa-client.js",
  "./novex-pwa-manifest.webmanifest",
  "./novex-icon-192.svg",
  "./novex-icon-512.svg",
  "./novex-icon-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(NOVEX_STATIC_CACHE).then((cache) => cache.addAll(NOVEX_APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("novex-pwa-") && key !== NOVEX_STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  if (url.pathname.includes("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./novex-pwa-app-shell.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(NOVEX_STATIC_CACHE).then((cache) => cache.put(request, responseToCache));
        return response;
      });
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "NOVEX_SKIP_WAITING") {
    self.skipWaiting();
  }
});
