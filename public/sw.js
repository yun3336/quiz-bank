const CACHE = "quiz-bank-offline-v4";
const PRECACHE = [
  "/",
  "/practice",
  "/exam",
  "/review",
  "/lab",
  "/stats",
  "/privacy",
  "/support",
  "/offline.html",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = all.find((client) => "focus" in client);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate("/");
        return;
      }
      await self.clients.openWindow("/");
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // POST /api/grade、/api/quiz 不快取；GET /api/catalog 走下面 network-first。
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;

  const staticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/audio/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon" ||
    url.pathname.startsWith("/icon.") ||
    url.pathname.startsWith("/apple-icon");

  event.respondWith(staticAsset ? cacheFirst(request) : networkFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) await cache.put(request, fresh.clone());
  return fresh;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) await cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const offline = await cache.match("/offline.html");
      if (offline) return offline;
      const home = await cache.match("/");
      if (home) return home;
    }
    return new Response("目前離線，且這個頁面還沒快取過。", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
