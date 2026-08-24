const CACHE = "japan-seismic-safety-v2";
const OFFLINE_GUIDE = "/offline.html";
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE_GUIDE))));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_GUIDE)));
});
self.addEventListener("push", event => {
  let payload = { title: "Japan Seismic Monitor", body: "A new USGS earthquake detection is available.", tag: "japan-seismic-alert", data: { url: "/alerts" } };
  try { payload = { ...payload, ...(event.data ? event.data.json() : {}) }; } catch { /* Keep the safe visible fallback. */ }
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, tag: payload.tag, data: payload.data, icon: "/favicon.ico", badge: "/favicon.ico", renotify: false }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/alerts"));
});
