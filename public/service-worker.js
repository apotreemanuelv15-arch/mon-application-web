// Nom du cache pour votre application Josué 1:8
const CACHE_NAME = 'josue-v1';

// On écoute l'installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('✅ Service Worker de Josué 1:8 installé !');
});

// Ce script permet de répondre aux requêtes réseau
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // Optionnel : On peut ajouter ici une page hors-ligne plus tard
      return caches.match(event.request);
    })
  );
});