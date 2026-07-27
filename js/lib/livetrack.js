/* ==========================================================================
   PARTAGE DE POSITION DU LIVREUR
   --------------------------------------------------------------------------
   Pendant une course (statuts "livreur trouvé" et "en cours de livraison"),
   le téléphone du livreur envoie sa position toutes les ~15 secondes.
   Le client la voit avancer sur sa carte de suivi.

   Le partage s'arrête tout seul dès que la course est terminée : on ne suit
   jamais un livreur qui n'est pas en train de livrer.
   ========================================================================== */
(function (w) {
  'use strict';

  const SEND_EVERY = 15000;   // 15 s entre deux envois
  const ACTIVE = ['driver_assigned', 'delivering'];

  let watchId = null;
  let lastSent = 0;
  let lastError = null;
  let running = false;
  const subs = [];

  function announce() {
    subs.forEach(cb => { try { cb(LiveTrack.state); } catch (e) { console.error(e); } });
  }

  const LiveTrack = {

    get state() {
      return { running: running, error: lastError, lastSent: lastSent };
    },

    onChange(cb) {
      subs.push(cb);
      return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); };
    },

    /** Démarre ou arrête selon qu'une course est en cours. À appeler librement. */
    async sync() {
      if (!Store.isLogged || Store.role !== 'driver') return LiveTrack.stop();
      const orders = await API.safe(() => API.orders({ scope: 'driver' }), []);
      const busy = orders.some(o => ACTIVE.indexOf(o.status) >= 0);
      busy ? LiveTrack.start() : LiveTrack.stop();
    },

    start() {
      if (running) return;
      if (!navigator.geolocation) {
        lastError = "Ce navigateur ne gère pas la géolocalisation.";
        return announce();
      }
      running = true;
      lastError = null;
      announce();

      watchId = navigator.geolocation.watchPosition(
        async pos => {
          const now = Date.now();
          if (now - lastSent < SEND_EVERY) return;   // on n'inonde pas le serveur
          lastSent = now;
          lastError = null;
          await API.safe(() => API.updateMyPosition(pos.coords.latitude, pos.coords.longitude));
          announce();
        },
        err => {
          lastError = err.code === 1
            ? "Autorisez la localisation pour que le client vous suive."
            : "Signal GPS faible — position non partagée.";
          announce();
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
    },

    stop() {
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      if (running) { running = false; lastError = null; announce(); }
    },

    /** Envoi immédiat, hors du cycle automatique (bouton « partager maintenant »). */
    pushOnce() {
      return new Promise((res, rej) => {
        if (!navigator.geolocation) return rej(new Error('Géolocalisation indisponible.'));
        navigator.geolocation.getCurrentPosition(
          async pos => {
            lastSent = Date.now();
            lastError = null;
            const r = await API.safe(() => API.updateMyPosition(pos.coords.latitude, pos.coords.longitude));
            announce();
            res(r);
          },
          err => rej(new Error(err.code === 1
            ? "Autorisez l'accès à votre position dans le navigateur."
            : 'Position introuvable pour le moment.')),
          { enableHighAccuracy: true, timeout: 12000 }
        );
      });
    }
  };

  w.LiveTrack = LiveTrack;
})(window);
