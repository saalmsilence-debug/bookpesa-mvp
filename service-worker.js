const CACHE_NAME = "bookpesa-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/service-worker.js"
];

// Install cache
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Serve cached files
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cachedFile => {
      return cachedFile || fetch(event.request);
    })
  );
});
