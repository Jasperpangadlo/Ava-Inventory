const CACHE_NAME = "ava-inventory-v51";

// Files to cache for offline access
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/logo.png",
  "/manifest.json",
  "https://cdn.jsdelivr.net/npm/chart.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js"
];

// Install — cache all static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Some assets failed to cache:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Always fetch Google Apps Script requests from network (never cache)
  if(url.hostname === "script.google.com"){
    event.respondWith(fetch(event.request));
    return;
  }

  // Network first strategy for HTML
  if(event.request.mode === "navigate"){
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Cache first for static assets (CSS, JS, images)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if(cached) return cached;
      return fetch(event.request).then((response) => {
        if(response && response.status === 200){
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Push notifications (for future use)
self.addEventListener("push", (event) => {
  if(!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || "AVA Inventory", {
    body   : data.body || "",
    icon   : "/logo.png",
    badge  : "/logo.png",
    vibrate: [200, 100, 200]
  });
});
