/* ==========================================================================
   SONS D'ALERTE
   --------------------------------------------------------------------------
   Deux sonneries, et une seule règle : elles s'arrêtent dès que la raison de
   sonner disparaît.

   • Restaurant — nouvelle commande : la sonnerie part dès l'arrivée de la
     commande, sans rien attendre, et passe une seule fois. Accepter ou
     refuser la coupe, si tant est qu'elle joue encore.
   • Livreur — course disponible : la sonnerie part dès que la course se
     libère et tourne jusqu'à ce qu'il accepte ou qu'il passe. Un plafond
     l'arrête de toute façon : une sonnerie sans fin dans un téléphone posé
     sur une table est intenable.
   S'y ajoutent cinq accusés, qui ne sonnent qu'une fois et ne s'arrêtent
   jamais tout seuls : commande envoyée (client), commande acceptée et
   commande refusée (restaurant), course acceptée et livraison validée
   (livreur). Ils confirment un geste que l'on vient de faire — donc on les
   joue au retour du serveur, jamais avant : sonner puis afficher une erreur
   serait pire que de ne rien sonner.

   Les navigateurs interdisent de jouer un son avant que l'utilisateur ait
   interagi avec la page. On déverrouille donc au premier clic, et une alerte
   arrivée trop tôt est rejouée à ce moment-là plutôt que perdue.
   ========================================================================== */
(function (w) {
  'use strict';

  const FILES = {
    /* --- appels : ça sonne pour réclamer une réponse --- */
    'new-order': 'assets/sounds/nouvelle-commande.wav',   // restaurant
    'delivery':  'assets/sounds/course-disponible.m4a',   // livreur

    /* --- accusés : ça sonne une fois, pour confirmer un geste --- */
    'ordered':   'assets/sounds/commande-passee.wav',     // client : commande envoyée
    'accepted':  'assets/sounds/commande-acceptee.wav',   // restaurant : acceptée
    'refused':   'assets/sounds/commande-refusee.wav',    // restaurant : refusée
    'claimed':   'assets/sounds/course-acceptee.wav',     // livreur : course prise
    'delivered': 'assets/sounds/livraison-validee.m4a'    // livreur : course livrée
  };

  /* Les appels seuls s'interrompent. Un accusé dure une seconde et confirme
     un geste : le couper à mi-chemin parce qu'une liste s'est rafraîchie
     n'aurait aucun sens. */
  const ALERTES = ['new-order', 'delivery'];

  const RESTO_FOIS   = 1;    // demandé : un seul passage
  // La sonnerie livreur dure 9 s : quatre passages font déjà plus de 35 s
  // d'appel. Au-delà, le livreur n'est manifestement pas devant son écran.
  const LIVREUR_MAX  = 4;
  const MUTE_KEY     = 'talabi.sound.muted';

  const players = {};
  let unlocked = false;
  let pending  = null;       // alerte reçue avant le premier clic

  function readMuted() {
    try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
  }
  let muted = readMuted();

  function player(key) {
    if (!players[key]) {
      const audio = new Audio(FILES[key]);
      audio.preload = 'auto';
      const p = { audio: audio, left: 0 };
      audio.addEventListener('ended', () => { if (p.left > 0) start(p); else p.left = 0; });
      players[key] = p;
    }
    return players[key];
  }

  function start(p) {
    if (p.left <= 0) return;
    p.left--;
    try { p.audio.currentTime = 0; } catch (e) { /* pas encore chargé */ }
    const r = p.audio.play();
    if (r && r.catch) r.catch(() => { /* bloqué : le déverrouillage rejouera */ });
  }

  /* Premier geste de l'utilisateur : on autorise l'audio pour de bon. */
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    Object.keys(FILES).forEach(k => {
      const a = player(k).audio;
      a.muted = true;
      const r = a.play();
      if (r && r.then) r.then(() => { a.pause(); a.currentTime = 0; a.muted = false; })
                        .catch(() => { a.muted = false; });
      else a.muted = false;
    });
    if (pending) { const q = pending; pending = null; Sound.play(q.key, q.times); }
  }
  w.addEventListener('pointerdown', unlock);
  w.addEventListener('keydown', unlock);

  const Sound = {
    get muted() { return muted; },
    set muted(v) {
      muted = !!v;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
      if (muted) Sound.stopAll();
    },

    play(key, times) {
      if (muted || !FILES[key]) return;
      if (!unlocked) { pending = { key: key, times: times }; return; }
      const p = player(key);
      p.left = times || 1;
      start(p);
    },

    stop(key) {
      const p = players[key];
      if (!p) return;
      p.left = 0;
      p.audio.pause();
      try { p.audio.currentTime = 0; } catch (e) {}
    },

    stopAll() { Object.keys(players).forEach(Sound.stop); },

    /** Coupe les sonneries d'appel, laisse les accusés finir leur phrase. */
    stopAlerts() { ALERTES.forEach(Sound.stop); },

    playing(key) {
      const p = players[key];
      return !!(p && (p.left > 0 || (!p.audio.paused && !p.audio.ended)));
    },

    /* ==================================================================
       Le déclencheur, c'est l'ÉTAT des commandes, pas l'arrivée d'un
       message. La différence compte : une commande peut être déjà là quand
       le gérant ouvre son espace ou change de compte. Dans ce cas aucun
       nouvel évènement ne survient, et se fier au message ne sonnerait
       jamais. Ici, dès qu'une commande attend une réponse, ça sonne.

       Et dès qu'il n'y a plus rien en attente, ça s'arrête tout seul :
       commande acceptée, refusée, ou course prise par un autre livreur.
       ================================================================== */
    async watchOrders() {
      if (!w.Store || !Store.isLogged) return Sound.stopAlerts();
      if (Store.role === 'restaurant')
        await scan('new-order', { scope: 'restaurant', status: ['pending'] }, RESTO_FOIS);
      else if (Store.role === 'driver')
        await scan('delivery', { scope: 'available' }, LIVREUR_MAX);
      else
        Sound.stopAlerts();   // et non stopAll : le client vient peut-être de
                              // valider sa commande, l'accusé doit s'entendre
    },

    /** Changement de compte : ce qui a déjà sonné pour l'autre ne compte plus. */
    forget() { for (const k in annonces) delete annonces[k]; }
  };

  /* Commandes déjà signalées : on sonne pour une commande, pas à chaque
     rafraîchissement de la liste. */
  const annonces = {};

  async function scan(key, filtre, fois) {
    const l = await API.safe(() => API.orders(filtre), []);
    if (!l.length) { Sound.stop(key); return; }
    const neuves = l.filter(o => !annonces[o.id]);
    l.forEach(o => { annonces[o.id] = true; });
    if (neuves.length) Sound.play(key, fois);
  }

  w.Sound = Sound;
})(window);
