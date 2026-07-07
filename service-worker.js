const CACHE_NAME = "ava-inventory-v70";

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

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Always network for Google Apps Script
  if(url.hostname === "script.google.com"){
    event.respondWith(fetch(event.request));
    return;
  }

  // Always network for CDN libraries (chart.js, xlsx, jspdf)
  if(
    url.hostname === "cdn.jsdelivr.net" ||
    url.hostname === "cdnjs.cloudflare.com"
  ){
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // NETWORK FIRST for all local files (index.html, style.css, script.js, etc.)
  // This ensures latest version always loads when online
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache the fresh response
        if(response && response.status === 200){
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback — serve from cache
        return caches.match(event.request)
          .then((cached) => cached || caches.match("/index.html"));
      })
  );
});

// Push notifications
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
