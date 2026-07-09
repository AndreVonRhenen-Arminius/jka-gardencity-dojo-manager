const CACHE_NAME = "jka-dojo-manager-v1.1.0";

const APP_SHELL = [
  "./",
  "./index.html",
  "./config.js",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js",
  "./js/auth.js",
  "./js/database.js",
  "./js/dashboard.js",
  "./js/navigation.js",
  "./js/utilities.js",
  "./js/ui.js",
  "./js/modules.js",
  "./js/install.js",
  "./js/settings.js",
  "./js/families.js",
  "./js/students.js",
  "./js/student-records.js",
  "./js/enquiries.js",
  "./js/terms.js",
  "./js/sessions.js",
  "./js/attendance.js",
  "./js/gradings.js",
  "./js/progress.js",
  "./js/fees.js",
  "./js/payments.js",
  "./js/expenses.js",
  "./js/banking.js",
  "./js/reports.js",
  "./js/communication.js",
  "./js/backup.js",
  "./js/audit.js",
  "./js/pwa-updates.js",
  "./vendor/supabase.min.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key =>
            key.startsWith("jka-dojo-manager-") &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Supabase data and authentication requests must always use the network.
  if (url.origin.includes("supabase.co")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response?.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response?.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
