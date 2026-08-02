/* ==========================================================================
   PARTAGE DE POSITION DU LIVREUR
   --------------------------------------------------------------------------
   Deux régimes, pour deux besoins qui n'ont rien à voir :

   • EN COURSE (statuts « livreur trouvé » et « en cours de livraison ») —
     position toutes les ~15 secondes, GPS précis. Le client la voit avancer
     sur sa carte de suivi.

   • EN VEILLE (livreur validé, en ligne, sans course) — position toutes les
     ~60 secondes, précision ordinaire. Personne ne la regarde : elle sert au
     serveur à savoir qui est le plus près du restaurant quand une commande
     tombe. Sans elle, l'attribution « au plus proche » classait les livreurs
     d'après l'endroit où ils se trouvaient à la fin de leur dernière course,
     parfois la veille — autant tirer au sort.

   Le partage s'arrête tout seul dès que le livreur se met hors ligne ou se
   déconnecte : on ne suit jamais quelqu'un qui a fini sa journée.
   ========================================================================== */
(function (w) {
  'use strict';

  /* Un envoi toutes les 15 s en course, toutes les 60 s en veille. Le second
     est volontairement lâche : c'est le compromis entre une attribution juste
     et la batterie d'un téléphone qui reste allumé toute la soirée. */
  const CADENCE = { course: 15000, veille: 60000 };
  const ACTIVE  = ['driver_assigned', 'delivering'];

  let mode = null;            // null | 'course' | 'veille'
  let watchId = null;         // suivi continu (mode course)
  let timerId = null;         // relevé périodique (mode veille)
  let lastSent = 0;
  let lastError = null;
  const subs = [];

  function announce() {
    subs.forEach(cb => { try { cb(LiveTrack.state); } catch (e) { console.error(e); } });
  }

  async function envoyer(pos) {
    lastSent = Date.now();
    lastError = null;
    await API.safe(() => API.updateMyPosition(pos.coords.latitude, pos.coords.longitude));
    announce();
  }

  function surErreur(err) {
    lastError = err.code === 1
      ? "Autorisez la localisation : sans elle, les courses proches partent aux autres."
      : "Signal GPS faible — position non partagée.";
    announce();
  }

  const LiveTrack = {

    get state() {
      return { running: mode !== null, mode: mode, error: lastError, lastSent: lastSent };
    },

    onChange(cb) {
      subs.push(cb);
      return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); };
    },

    /** Choisit le régime qui convient à l'instant présent. À appeler librement. */
    async sync() {
      if (!Store.isLogged || Store.role !== 'driver') return LiveTrack.stop();

      const orders = await API.safe(() => API.orders({ scope: 'driver' }), []);
      if (orders.some(o => ACTIVE.indexOf(o.status) >= 0)) return LiveTrack.start('course');

      /* Pas de course en cours : on ne partage que si le livreur s'est déclaré
         disponible. Hors ligne, aucune position ne part — c'est la contrepartie
         honnête du fait qu'il ne reçoit aucune course. */
      const d = await API.safe(() => API.getDriver(), null);
      if (d && d.validation_status === 'approved' && d.status === 'available')
        return LiveTrack.start('veille');

      LiveTrack.stop();
    },

    /** @param {'course'|'veille'} [m] */
    start(m) {
      m = m || 'course';
      if (mode === m) return;
      if (!navigator.geolocation) {
        lastError = "Ce navigateur ne gère pas la géolocalisation.";
        return announce();
      }
      LiveTrack.stop();
      mode = m;
      lastError = null;
      announce();

      if (m === 'course') {
        watchId = navigator.geolocation.watchPosition(
          pos => {
            if (Date.now() - lastSent < CADENCE.course) return;   // on n'inonde pas le serveur
            envoyer(pos);
          },
          surErreur,
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
        );
        return;
      }

      /* En veille, un relevé ponctuel régulier plutôt qu'un suivi continu :
         même service rendu au serveur, sans garder le GPS ouvert en permanence. */
      const relever = () => navigator.geolocation.getCurrentPosition(
        envoyer, surErreur,
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 20000 }
      );
      relever();
      timerId = setInterval(relever, CADENCE.veille);
    },

    stop() {
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
      if (timerId !== null) { clearInterval(timerId); timerId = null; }
      if (mode !== null) { mode = null; lastError = null; announce(); }
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
