/*
  Service Worker do GrowthQuest.
  Estratégia:
  - App shell (HTML, manifest, ícones): cache-first, atualizado em background.
  - Tudo mais (bibliotecas via CDN - React, lucide-react, recharts, babel):
    network-first, guardando cópia no cache para uso offline depois.
  - Navegação offline sem nada em cache ainda: cai para o index.html salvo.
*/

const CACHE_VERSION = "growthquest-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Só lidamos com GET; outros métodos passam direto pela rede.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isAppShell = url.origin === self.location.origin;

  if (isAppShell) {
    // Cache-first para os arquivos do próprio site.
    // Requisições de navegação (abrir a página) sempre caem no index.html se faltar rede e cache.
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() =>
            cached || (request.mode === "navigate" ? caches.match("./index.html") : undefined)
          );
        return cached || network;
      })
    );
  } else {
    // Network-first para as bibliotecas via CDN (React, lucide-react, recharts, babel).
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});

