/* ==========================================================================
   TALABI — Démarrage de l'application
   ========================================================================== */
(function (w) {
  'use strict';

  /* ====================================================================
     ÉCRAN D'OUVERTURE
     --------------------------------------------------------------------
     Cinq secondes, comptées depuis l'ouverture de la page — pas depuis la
     fin du chargement. Sur une bonne connexion l'application est prête en
     moins d'une seconde : sans cette retenue, le logo n'aurait que le temps
     d'apparaître avant de disparaître, et l'ouverture ressemblerait à un
     clignotement. Sur une connexion lente, le chargement dépasse les cinq
     secondes et l'écran s'efface dès qu'il est terminé : on ne fait jamais
     attendre en plus.
     ==================================================================== */
  const DUREE_INTRO = 5000;   // ms, animation de sortie comprise
  const SORTIE      = 700;    // doit couvrir la transition CSS de .sortie

  function finDeLIntro() {
    const splash = document.getElementById('splash');
    if (!splash) return Promise.resolve();

    // performance.now() part de l'ouverture de la page : c'est bien le temps
    // vu par l'utilisateur depuis son clic, pas le temps de calcul.
    const reste = Math.max(0, DUREE_INTRO - SORTIE - performance.now());

    return new Promise(resolve => {
      setTimeout(() => {
        splash.classList.add('sortie');
        setTimeout(() => { splash.remove(); resolve(); }, SORTIE);
      }, reste);
    });
  }

  /* ====================================================================
     PREMIÈRE OUVERTURE
     --------------------------------------------------------------------
     Le repère vit dans le navigateur, donc « première fois » veut dire
     première fois sur CET appareil. C'est bien ce qu'on veut : quelqu'un qui
     installe l'application sur son téléphone doit être accueilli, même s'il
     connaît déjà le site depuis son ordinateur.
     ==================================================================== */
  const CLE_PREMIERE_VISITE = 'talabi.deja_venu';

  function premiereVisite() {
    try {
      if (localStorage.getItem(CLE_PREMIERE_VISITE)) return false;
      localStorage.setItem(CLE_PREMIERE_VISITE, String(Date.now()));
      return true;
    } catch (e) {
      // navigation privée ou stockage refusé : on n'insiste pas
      return false;
    }
  }

  /** Une page précise a-t-elle été demandée dans l'adresse ? */
  function cheminDemande() {
    return location.hash.replace(/^#\/?/, '').length > 0;
  }

  /**
   * Lit ce que le serveur d'authentification a mis dans l'adresse, que ce soit
   * dans le hash (#access_token=…, #error=…) ou dans la requête (?code=…).
   * Rien n'est modifié ici : on se contente de photographier l'adresse avant
   * que la librairie Supabase ne la nettoie.
   */
  function lireRetourAuth() {
    const hash = location.hash.replace(/^#/, '');
    const query = location.search.replace(/^\?/, '');
    const lire = (source, cle) => {
      try { return new URLSearchParams(source).get(cle); } catch (e) { return null; }
    };
    const erreur = lire(hash, 'error_description') || lire(query, 'error_description') ||
                   lire(hash, 'error')             || lire(query, 'error');
    const tout = hash + '&' + query;

    return {
      recovery: /type=recovery/.test(tout),
      attenduSession: /(^|[&?])(access_token|code)=/.test(tout),
      erreur: erreur || ''
    };
  }

  function fail(message, detail) {
    const splash = document.getElementById('splash');
    /* L'écran d'entrée est une photo plein cadre : un message d'erreur écrit
       par-dessus serait illisible. On retire la photo avant d'écrire. */
    splash.classList.add('panne');
    splash.innerHTML =
      '<div class="wrap-sm center" style="color:#fff">' +
        '<div style="font-size:44px">⚠️</div>' +
        '<div class="h2" style="margin-top:10px">' + U.esc(message) + '</div>' +
        '<p style="opacity:.9;margin-top:8px;font-size:14px">' + U.esc(detail || '') + '</p>' +
        '<button class="btn" style="margin-top:18px;background:#fff;color:var(--brand)" ' +
        'onclick="location.reload()">Réessayer</button>' +
      '</div>';
  }

  async function boot() {
    try {
      /* ---- 0. Sans base de données, il n'y a pas d'application ---- */
      if (!w.TALABI_CONFIGURED) {
        return fail('Base de données non configurée',
          'Renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans le fichier config.js ' +
          '(Supabase → Project Settings → API), puis rechargez la page.');
      }

      /* ---- 1. Ce que Supabase a déposé dans l'adresse ----
         Retour de Google, d'un lien de confirmation ou de récupération : tout
         arrive par l'adresse de la page. On la lit AVANT d'initialiser le
         backend, car celui-ci la nettoie en passant. */
      const retour = lireRetourAuth();

      /* ---- 2. Backend ---- */
      await API.init();

      /* le lien de récupération mène au formulaire de nouveau mot de passe —
         après l'init, sinon on effacerait le jeton avant sa lecture.
         Deux sources : l'ancien format, qui écrivait type=recovery dans
         l'adresse, et l'évènement PASSWORD_RECOVERY du format actuel. */
      if (retour.recovery || API.recoveryPending) location.hash = '#/reset';

      /* ---- 3. Retour d'une connexion Google : appliquer le rôle choisi ---- */
      if (API.applyPendingRole) { try { await API.applyPendingRole(); } catch (e) { console.warn(e); } }

      /* ---- 4. Données de référence + session ---- */
      await Store.boot();

      /* ---- 5. Réactions aux évènements du backend ---- */
      let lastNotifId = null;
      if (Store.isLogged) {
        const first = await API.safe(() => API.notifications(1), []);
        lastNotifId = first.length ? first[0].id : '';
      }

      API.onChange(async function (what) {
        if (what === 'session') {
          await Store.refreshProfile();
          LiveTrack.sync();          // coupe le partage de position à la déconnexion
          // nouveau compte : ce qui a sonné pour le précédent ne compte plus,
          // et une commande déjà en attente doit se signaler tout de suite
          if (w.Sound) { Sound.stopAll(); Sound.forget(); Sound.watchOrders(); }
          Shell.render();
          Router.render();
          return;
        }
        if (what === 'orders') LiveTrack.sync();
        // sonne dès qu'une commande attend une réponse, se tait dès qu'il n'y
        // en a plus
        if (w.Sound) Sound.watchOrders();
        // toute autre modification peut faire évoluer le compteur de notifications
        if (!Store.isLogged) return;
        await Store.refreshUnread();
        Shell.renderTop();
        // le point orange de l'onglet Commandes suit le compteur non lu
        Shell.renderNav();

        // annonce visuelle — et sonore — de la dernière notification reçue
        const list = await API.safe(() => API.notifications(1), []);
        if (list.length && list[0].id !== lastNotifId) {
          if (lastNotifId !== null && !list[0].is_read) UI.toast(list[0].title, 'ok', list[0].body);
          lastNotifId = list[0].id;
        }
      });

      Store.subscribe(what => {
        if (what === 'cart') Shell.renderNav();
        if (what === 'wilaya') Shell.renderTop();
      });

      /* Où est la personne ? La barre du haut annonce sa wilaya, et le
         téléphone connaît la réponse. On la demande une seule fois, en tâche
         de fond : refus ou échec, la wilaya par défaut reste affichée et rien
         ne s'arrête. On n'attend surtout pas la réponse pour ouvrir la page —
         le navigateur peut mettre plusieurs secondes à poser la question. */
      if (App.est('client') && !Store.wilaya) Store.detectWilaya();

      /* ---- 6. Navigation ---- */

      /* Première ouverture : on présente l'application avant tout le reste.
         Uniquement si le visiteur n'est pas connecté et n'a demandé aucune
         page précise — un lien partagé vers un restaurant doit ouvrir ce
         restaurant, pas un écran d'accueil. */
      if (!Store.isLogged && premiereVisite() && !cheminDemande()) location.hash = '#/login';

      Router.start();

      // Une commande peut déjà attendre au moment où l'on ouvre l'application.
      // Le son ne partira qu'au premier clic (les navigateurs l'exigent), mais
      // il partira : la demande est mise de côté, pas perdue.
      if (w.Sound) Sound.watchOrders();

      // un livreur qui rouvre l'app en pleine course reprend le partage
      LiveTrack.sync();

      horlogeDesDelais();

      /* ---- 7. Fin de l'écran d'ouverture ---- */
      await finDeLIntro();

      /* ---- 8. Un retour de connexion qui n'a rien donné ne doit pas être
                silencieux : sans message, l'utilisateur revient sur l'accueil
                déconnecté et croit que le site est cassé. ---- */
      if (retour.erreur) {
        UI.err('Connexion impossible', retour.erreur);
      } else if (retour.attenduSession && !Store.isLogged) {
        UI.err('Connexion impossible',
          "Google a répondu, mais la session n'a pas pu s'ouvrir. Essayez depuis " +
          'le navigateur plutôt que depuis l’icône de l’écran d’accueil.');
      }

    } catch (e) {
      console.error(e);
      fail('Impossible de démarrer l’application', e.message);
    }
  }

  /* ====================================================================
     HORLOGE DES DÉLAIS
     --------------------------------------------------------------------
     Une seule horloge pour tout le site, qui ne fait que deux choses :
     rafraîchir le texte des comptes à rebours affichés, et demander au
     backend d'appliquer les délais échus.

     Elle ne bat que si un compte à rebours est à l'écran. Un site ouvert sur
     la carte d'un restaurant n'a aucune raison de réveiller le processeur du
     téléphone chaque seconde — et rien n'expire tant que personne n'attend.
     ==================================================================== */
  function horlogeDesDelais() {
    let dernierTick = 0;

    setInterval(async () => {
      const chronos = document.querySelectorAll('.cdown[data-until]');
      if (!chronos.length) return;

      let echu = false;
      chronos.forEach(el => {
        const reste = U.secondsLeft(el.dataset.until);
        const t = el.querySelector('.t');
        if (t) t.textContent = U.mmss(reste);
        el.classList.toggle('urgent', reste <= (+el.dataset.alert || 60));
        if (reste <= 0) { el.classList.add('fini'); echu = true; }
      });

      // Un compte à rebours vient de tomber : on applique le délai tout de
      // suite. Sinon on laisse passer 10 s — inutile de marteler le backend
      // pendant qu'il reste 4 minutes au chronomètre.
      const maintenant = Date.now();
      if (!echu && maintenant - dernierTick < 10000) return;
      dernierTick = maintenant;
      if (API.tick) await API.safe(() => API.tick(), false);
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ------------------------------------------------------------ divers */

  // fermeture des modales avec la touche Échap
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const root = document.getElementById('modal-root');
    const last = root && root.lastElementChild;
    if (last) {
      const x = last.querySelector('[data-x]');
      if (x) x.click(); else last.remove();
    }
  });

  // avertissement hors-ligne
  w.addEventListener('offline', () => UI.err('Connexion perdue', 'Vérifiez votre réseau.'));
  w.addEventListener('online', () => UI.ok('Connexion rétablie'));
})(window);
