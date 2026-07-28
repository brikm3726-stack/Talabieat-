/* ==========================================================================
   SONS D'ALERTE
   --------------------------------------------------------------------------
   Deux sonneries, et une seule règle : elles s'arrêtent dès que la raison de
   sonner disparaît.

   • Restaurant — nouvelle commande : la sonnerie passe 3 fois. Si le gérant
     accepte (ou refuse) avant la fin, elle s'arrête immédiatement.
   • Livreur — course disponible : la sonnerie tourne en boucle jusqu'à ce
     qu'il accepte ou qu'il passe. Un plafond l'arrête de toute façon : une
     sonnerie sans fin dans un téléphone posé sur une table est intenable.

   Les navigateurs interdisent de jouer un son avant que l'utilisateur ait
   interagi avec la page. On déverrouille donc au premier clic, et une alerte
   arrivée trop tôt est rejouée à ce moment-là plutôt que perdue.
   ========================================================================== */
(function (w) {
  'use strict';

  const FILES = {
    'new-order': 'assets/sounds/nouvelle-commande.wav',   // restaurant
    'delivery':  'assets/sounds/course-disponible.m4a'    // livreur
  };

  const RESTO_FOIS   = 3;    // demandé : trois passages (~5 s au total)
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

    playing(key) {
      const p = players[key];
      return !!(p && (p.left > 0 || (!p.audio.paused && !p.audio.ended)));
    },

    /* ------------------------------------------------------------------
       Une notification vient d'arriver : faut-il sonner ?
       Le type vient du backend (mêmes valeurs qu'en base).
       ------------------------------------------------------------------ */
    onNotification(n) {
      if (!n || !w.Store || !Store.isLogged) return;
      if (n.type === 'new_order' && Store.role === 'restaurant')
        Sound.play('new-order', RESTO_FOIS);
      else if (n.type === 'delivery_available' && Store.role === 'driver')
        Sound.play('delivery', LIVREUR_MAX);
    },

    /* ------------------------------------------------------------------
       Les commandes ont bougé. On coupe la sonnerie si son motif a disparu
       — commande acceptée, refusée, ou course prise par un autre livreur.
       Rien n'est interrogé tant qu'aucun son ne joue.
       ------------------------------------------------------------------ */
    async reviewOrders() {
      if (!w.Store || !Store.isLogged) return Sound.stopAll();

      if (Sound.playing('new-order') && Store.role === 'restaurant') {
        const l = await API.safe(() => API.orders({ scope: 'restaurant', status: ['pending'] }), []);
        if (!l.length) Sound.stop('new-order');
      }
      if (Sound.playing('delivery') && Store.role === 'driver') {
        const l = await API.safe(() => API.orders({ scope: 'available' }), []);
        if (!l.length) Sound.stop('delivery');
      }
    }
  };

  w.Sound = Sound;
})(window);
