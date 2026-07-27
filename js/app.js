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
          Shell.render();
          Router.render();
          return;
        }
        if (what === 'orders') LiveTrack.sync();
        // toute autre modification peut faire évoluer le compteur de notifications
        if (!Store.isLogged) return;
        await Store.refreshUnread();
        Shell.renderTop();

        // annonce visuelle de la dernière notification reçue
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

      // un livreur qui rouvre l'app en pleine course reprend le partage
      LiveTrack.sync();

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
