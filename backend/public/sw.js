// Minimal service worker so the app can be installed. Pages always come from the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => new Response("<meta charset=utf-8><body style='font-family:sans-serif;padding:24px'><h2>Internet নেই</h2><p>সংযোগ ফিরলে আবার চেষ্টা করুন।</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } })));
  }
});
