/* ==========================================================================
   TALABI — Démarrage de l'application
   ========================================================================== */
(function (w) {
  'use strict';

  function fail(message, detail) {
    document.getElementById('splash').innerHTML =
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
      /* ---- 1. Le lien de récupération Supabase arrive dans le hash ---- */
      if (/type=recovery/.test(location.hash)) location.hash = '#/reset';

      /* ---- 2. Backend ---- */
      await API.init();

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

        // annonce visuelle — et sonore — de la dernière notification reçue
        const list = await API.safe(() => API.notifications(1), []);
        if (list.length && list[0].id !== lastNotifId) {
          if (lastNotifId !== null && !list[0].is_read) UI.toast(list[0].title, 'ok', list[0].body);
          lastNotifId = list[0].id;
        }
      });

      Store.subscribe(what => {
        if (what === 'cart') Shell.renderNav();
      });

      /* ---- 6. Navigation ---- */
      Router.start();

      // Une commande peut déjà attendre au moment où l'on ouvre l'application.
      // Le son ne partira qu'au premier clic (les navigateurs l'exigent), mais
      // il partira : la demande est mise de côté, pas perdue.
      if (w.Sound) Sound.watchOrders();

      // un livreur qui rouvre l'app en pleine course reprend le partage
      LiveTrack.sync();

      horlogeDesDelais();

      /* ---- 7. Fin du splash ---- */
      const splash = document.getElementById('splash');
      splash.style.transition = 'opacity .35s ease';
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 380);

      if (API.mode === 'demo') {
        TestPanel.mount();
        setTimeout(() => UI.toast('Mode démonstration actif', null,
          'Utilisez le bouton 🧪 en bas à droite pour changer de compte et tester tout le parcours.'), 900);
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
