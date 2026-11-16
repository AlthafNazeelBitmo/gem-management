const CACHE = "gem-workspace-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const response = await fetch("/");
      const html = await response.clone().text();
      const assets = [
        ...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
      ].map((m) => m[1]);
      const cache = await caches.open(CACHE);
      await cache.put("/", response);
      await cache.addAll(assets);
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/buyer/")
  )
    return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate")
          return (await cache.match("/")) || Response.error();
        return Response.error();
      }
    })(),
  );
});
