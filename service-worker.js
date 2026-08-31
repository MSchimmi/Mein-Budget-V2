const CACHE_NAME = "Mein-Budget-V8";
const ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./images/favicon.ico" // <-- Neu hinzugefügt
];

// 1. Installation: Dateien in den Cache laden und sofort aktivieren
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("[Service Worker] Caching all assets");
            return cache.addAll(ASSETS);
        }).then(() => {
            // Zwingt den installierenden Service Worker, sofort aktiv zu werden
            return self.skipWaiting();
        })
    );
});

// 2. Aktivierung: Alte Caches restlos löschen und Kontrolle übernehmen
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log("[Service Worker] Deleting old cache:", cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            // Lässt den Service Worker sofort die Kontrolle über alle offenen Tabs übernehmen
            return self.clients.claim();
        })
    );
});

// 3. Strategie: Erst im Cache suchen, falls offline. Sonst aus dem Netzwerk laden.
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Gibt die Datei aus dem Cache zurück, falls vorhanden, sonst normales Netzwerk
            return cachedResponse || fetch(event.request);
        })
    );
});
