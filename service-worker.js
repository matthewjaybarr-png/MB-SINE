const CACHE_NAME = "mb-sine-v2";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/host.js",
  "./js/data.js",
  "./js/core.js",
  "./js/workflow.js",
  "./js/app.js",
  "./js/actions.js",
  "./manifest.webmanifest",
  "./icons/mb-sine.svg",
  "./icons/mb-sine-192.png",
  "./icons/mb-sine-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if(requestUrl.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if(response.ok){
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => {
        if(cached) return cached;
        if(event.request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      }))
  );
});
