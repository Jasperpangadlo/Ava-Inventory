const CACHE_NAME = "ava-inventory-v94";

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

// App code that changes often — always fetch fresh so updates are never stale
const APP_CODE_FILES = ["/index.html", "/script.js", "/supabase-client.js", "/"];

// Truly static assets that rarely change — safe to serve instantly from cache
const CACHE_FIRST_ASSETS = ["/logo.png", "/manifest.json", "/style.css"];

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ⚡ Supabase API calls — always straight to network, never touch the cache.
  // (Also covers old Google Apps Script URLs, if any remain.)
  if(url.hostname.endsWith("supabase.co") || url.hostname === "script.google.com"){
    event.respondWith(fetch(event.request));
    return;
  }

  // Only GET requests are cacheable at all — writes always go straight to network
  if(event.request.method !== "GET"){
    event.respondWith(fetch(event.request));
    return;
  }

  // CDN libraries (chart.js, xlsx, jspdf) — cache-first, these are pinned/versioned URLs
  if(url.hostname === "cdn.jsdelivr.net" || url.hostname === "cdnjs.cloudflare.com"){
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
    return;
  }

  // App code (index.html, script.js, supabase-client.js) — NETWORK FIRST.
  // Freshness matters most here; always try the network so updates are picked up immediately.
  if(APP_CODE_FILES.includes(url.pathname) || (url.origin === self.location.origin && url.pathname.endsWith(".js") && !CACHE_FIRST_ASSETS.includes(url.pathname))){
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if(response && response.status === 200){
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html")))
    );
    return;
  }

  // Everything else considered "static" (images, manifest, fonts, css) — CACHE FIRST,
  // instant load from cache, then quietly refresh the cache in the background for next time.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkUpdate = fetch(event.request).then((response) => {
        if(response && response.status === 200){
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || networkUpdate;
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
