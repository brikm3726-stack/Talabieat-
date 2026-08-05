/* ==========================================================================
   SERVICE WORKER — Talabi
   --------------------------------------------------------------------------
   Deux rôles, et le second est celui qui compte pour l'utilisateur :

   1. Rendre le site installable. Un navigateur Android ne propose « Installer »
      que si la page a un manifeste ET un service worker qui répond aux
      requêtes. Sans ce fichier, pas de bouton d'installation.

   2. Faire que l'application s'ouvre même sans réseau. À Tizi Ouzou la 4G
      n'est pas partout : une application qui affiche une page blanche dans
      l'ascenseur n'est pas une application.

   Ce qui n'est JAMAIS mis en cache : les appels à Supabase. Servir une
   commande périmée depuis le cache serait pire que d'afficher une erreur.
   ========================================================================== */

/* Changer ce numéro à chaque mise en ligne : c'est lui qui déclenche le
   remplacement de l'ancien cache par le nouveau. */
const VERSION = 'talabi-v97';

/* Quatre applications partagent ce fichier (client à la racine, resto/,
   livreur/, admin/). Chacune a son propre service worker de trois lignes qui
   déclare sa profondeur puis importe celui-ci — sans quoi les portées se
   chevaucheraient et une seule des quatre serait installable.
   Les caches sont nommés par application : vider celui du livreur ne doit pas
   déconnecter le restaurant. */
const R   = self.RACINE || './';                  // chemin de la racine commune
const QUI = self.APPLICATION || 'client';

const COQUILLE = VERSION + '-' + QUI + '-coquille';
const RESTE    = VERSION + '-' + QUI + '-reste';

/* Le strict nécessaire pour que l'application démarre hors ligne. */
const A_PRECHARGER = [
  './',
  './index.html',
  './manifest.webmanifest',
  R + 'config.js',
  R + 'assets/css/app.css',
  /* Le moteur de carte est chez nous : mis en cache, il ouvre le suivi même
     sans réseau, sur les tuiles déjà vues. */
  R + 'assets/vendor/leaflet/leaflet.css',
  R + 'assets/vendor/leaflet/leaflet.js',
  R + 'assets/img/logo.jpg',
  // premiere image vue a l'ouverture : elle ne doit jamais attendre le reseau
  R + 'assets/img/bg/entrer.jpg',
  R + 'assets/img/icons/icon-192.png',
  R + 'assets/img/icons/icon-512.png',
  R + 'js/lib/apps.js',
  R + 'js/lib/utils.js',
  R + 'js/lib/ui.js',
  R + 'js/lib/backend-supabase.js',
  R + 'js/lib/api.js',
  R + 'js/lib/store.js',
  R + 'js/lib/router.js',
  R + 'js/lib/shell.js',
  R + 'js/lib/components.js',
  R + 'js/lib/mappicker.js',
  R + 'js/lib/livetrack.js',
  R + 'js/lib/livescreen.js',
  R + 'js/lib/sound.js',
  R + 'js/lib/install.js',
  R + 'js/views/landing.js',
  R + 'js/views/auth.js',
  R + 'js/views/client.js',
  R + 'js/views/checkout.js',
  R + 'js/views/tracking.js',
  R + 'js/views/restaurant.js',
  R + 'js/views/driver.js',
  R + 'js/views/admin.js',
  R + 'js/views/account.js',
  R + 'js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(COQUILLE);
    /* addAll échoue en bloc si UN seul fichier manque ; on ajoute donc un par
       un pour qu'un oubli n'empêche pas toute l'installation. */
    await Promise.all(A_PRECHARGER.map(u =>
      c.add(new Request(u, { cache: 'reload' })).catch(err =>
        console.warn('[sw] non mis en cache :', u, err.message))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const noms = await caches.keys();
    /* On ne supprime que ses propres caches périmés : les trois autres
       applications ont les leurs, et le voisin n'a pas à en décider. */
    await Promise.all(noms
      .filter(n => n.indexOf('-' + QUI + '-') > 0 && !n.startsWith(VERSION))
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* La page peut demander l'activation immédiate d'une nouvelle version. */
self.addEventListener('message', e => {
  if (e.data === 'passe-devant') self.skipWaiting();
});

const estSupabase = u => /supabase\.(co|in)/.test(u.hostname) && u.pathname.indexOf('/storage/') !== 0;

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* Données vivantes : toujours le réseau, jamais le cache. */
  if (estSupabase(url)) return;

  /* Navigation : on tente le réseau, et à défaut on ouvre l'application depuis
     le cache. Sans cela, hors ligne, le navigateur afficherait sa page
     « pas de connexion » et l'application n'existerait plus. */
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try { return await fetch(req); }
      catch (err) {
        const c = await caches.open(COQUILLE);
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  const garder = (rep, ou) => {
    if (rep && rep.status === 200 && (rep.type === 'basic' || rep.type === 'cors')) {
      const copie = rep.clone();
      caches.open(ou).then(c => c.put(req, copie)).catch(() => {});
    }
    return rep;
  };
  const boite = url.origin === location.origin ? COQUILLE : RESTE;

  /* Le code de l'application : le RÉSEAU D'ABORD, le cache en secours.
     Avec le cache d'abord, une correction mise en ligne n'atteignait
     l'utilisateur qu'à la visite suivante — voire jamais, puisque le fichier
     servi était toujours l'ancien. Le cache reste là pour le hors-ligne. */
  const estCode = url.origin === location.origin &&
                  /\.(js|css|html|webmanifest)$/.test(url.pathname);

  if (estCode) {
    e.respondWith((async () => {
      try {
        const rep = await fetch(req);
        return garder(rep, boite);
      } catch (err) {
        return (await caches.match(req)) || Response.error();
      }
    })());
    return;
  }

  /* Images, sons, cartes, librairies externes : le cache d'abord (l'affichage
     est instantané), et on rafraîchit en arrière-plan. Ces fichiers-là ne
     changent pratiquement jamais. */
  e.respondWith((async () => {
    const vu = await caches.match(req);
    const reseau = fetch(req).then(rep => garder(rep, boite)).catch(() => null);
    return vu || (await reseau) || Response.error();
  })());
});
