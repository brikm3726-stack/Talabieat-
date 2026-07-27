/* ==========================================================================
   PANNEAU DE TEST — visible uniquement en mode démo
   --------------------------------------------------------------------------
   En démo, tous les comptes partagent la même base locale du navigateur.
   Ce panneau permet de basculer d'un rôle à l'autre en un clic pour dérouler
   un scénario complet dans un seul onglet :
       client passe commande → restaurant accepte → livreur livre
   Il disparaît automatiquement dès que Supabase est configuré.
   ========================================================================== */
(function (w) {
  'use strict';

  const ROLE = {
    client:     { icon: '🍔', label: 'Client' },
    restaurant: { icon: '🏪', label: 'Restaurant' },
    driver:     { icon: '🛵', label: 'Livreur' },
    admin:      { icon: '⚙️', label: 'Admin' }
  };

  /** Qui doit agir maintenant, et où ? */
  function nextStep(o) {
    if (!o) return null;
    const S = {
      pending:         ['restaurant', 'Le restaurant doit accepter la commande', '/r/orders'],
      accepted:        ['restaurant', 'Le restaurant doit lancer la préparation', '/r/orders'],
      preparing:       ['restaurant', 'Le restaurant doit signaler « commande prête »', '/r/orders'],
      ready:           ['driver',     'Un livreur disponible doit accepter la course', '/d/available'],
      driver_assigned: ['driver',     'Le livreur doit récupérer la commande', '/d/active'],
      delivering:      ['driver',     'Le livreur doit confirmer la livraison', '/d/active'],
      delivered:       ['client',     'Le client peut confirmer la réception', '/orders']
    }[o.status];
    if (!S) return null;
    return { role: S[0], text: S[1], path: S[2] };
  }

  const TestPanel = {

    mount() {
      if (API.mode !== 'demo' || !API.demoAccounts) return;
      if (document.getElementById('tpBtn')) return;

      const b = document.createElement('button');
      b.id = 'tpBtn';
      b.className = 'tp-btn';
      b.title = 'Panneau de test';
      b.innerHTML = '🧪';
      b.onclick = TestPanel.open;
      document.body.appendChild(b);
    },

    async open() {
      const accounts = API.demoAccounts();
      const order = API.demoLastOrder();
      const step = nextStep(order);

      // le compte qui doit agir maintenant (pour le mettre en avant)
      let actorId = null;
      let prepDriver = null;   // livreur à préparer avant de basculer
      if (step && order) {
        if (step.role === 'restaurant') actorId = order.owner_id;
        else if (step.role === 'client') actorId = order.client_id;
        else if (step.role === 'driver') {
          actorId = order.driver_id;
          if (!actorId) {
            // personne n'a encore pris la course : on propose un livreur et on
            // le rend opérationnel (validé, disponible, bon quartier) au clic
            const drivers = accounts.filter(a => a.role === 'driver' && !a.is_blocked);
            const best = drivers.find(a => a.driver_approved && a.zone_id === order.zone_id) ||
                         drivers.find(a => a.driver_approved) || drivers[0];
            if (best) { actorId = best.id; prepDriver = best; }
          }
        }
      }

      const groups = ['client', 'restaurant', 'driver', 'admin'];

      UI.sheet({
        title: '🧪 Panneau de test',
        body:

          '<div class="banner banner-info" style="margin-bottom:14px">' +
            'En mode démo, tous les comptes partagent la mémoire de <b>ce navigateur</b>. ' +
            'Restez dans <b>cet onglet</b> et changez de compte ici : une fenêtre privée ' +
            'aurait sa propre base et ne verrait pas vos commandes.</div>' +

          /* ---------------------------------------- scénario en cours */
          (order
            ? '<div class="card card-p" style="margin-bottom:14px">' +
                '<div class="row-between" style="margin-bottom:8px">' +
                  '<b style="font-size:14px">Dernière commande</b>' +
                  '<span class="ocode">#' + U.esc(order.code) + '</span>' +
                '</div>' +
                '<div class="row" style="gap:8px;flex-wrap:wrap">' + UI.tag(order.status) +
                  '<span class="tiny">' + U.esc(order.restaurant ? order.restaurant.name : '') + ' • ' +
                  U.money(order.total) + '</span></div>' +
                (step
                  ? '<div class="divider"></div>' +
                    '<div class="tiny" style="margin-bottom:9px">👉 <b>Prochaine étape :</b> ' + U.esc(step.text) + '</div>' +
                    (actorId
                      ? '<button class="btn btn-primary btn-block btn-sm" data-go="' + U.esc(actorId) +
                        '" data-path="' + U.esc(step.path) + '"' +
                        (prepDriver ? ' data-prep="' + U.esc(order.zone_id || '') + '"' : '') + '>' +
                        ROLE[step.role].icon + ' Passer au compte ' + ROLE[step.role].label.toLowerCase() +
                        ' et continuer</button>' +
                        (prepDriver
                          ? '<div class="tiny" style="margin-top:7px">Le compte <b>' +
                            U.esc(prepDriver.full_name || prepDriver.email) + '</b> sera validé, mis en ' +
                            '« disponible » et rattaché au quartier <b>' +
                            U.esc((order.zone && order.zone.name) || '—') + '</b> pour voir la course.</div>'
                          : '')
                      : '<div class="tiny">Aucun compte livreur n’existe encore. Déconnectez-vous et ' +
                        'créez-en un, il apparaîtra ici.</div>')
                  : '<div class="tiny" style="margin-top:8px">✅ Le parcours est terminé.</div>') +
              '</div>'
            : '<div class="banner banner-warn" style="margin-bottom:14px">' +
              'Aucune commande pour l’instant. Connectez-vous en client et passez-en une.</div>') +

          /* ---------------------------------------- validations */
          (accounts.some(a => a.pending)
            ? '<button class="btn btn-ok btn-block btn-sm" id="tpApprove" style="margin-bottom:14px">' +
              '✅ Valider tous les livreurs et restaurants en attente</button>'
            : '') +

          /* ---------------------------------------- comptes */
          '<div class="h3" style="margin-bottom:10px">Changer de compte</div>' +
          groups.map(g => {
            const list = accounts.filter(a => a.role === g);
            if (!list.length) return '';
            return '<div class="tiny" style="font-weight:800;text-transform:uppercase;letter-spacing:.05em;' +
                   'margin:12px 0 7px;color:var(--muted)">' + ROLE[g].icon + ' ' + ROLE[g].label + '</div>' +
              '<div class="stack" style="gap:7px">' + list.map(a =>
                '<button class="role-card ' + (a.is_current ? 'on' : '') + '" data-go="' + U.esc(a.id) + '" ' +
                  'style="text-align:left;width:100%;border-width:2px">' +
                  '<div class="ic">' + ROLE[g].icon + '</div>' +
                  '<div class="grow"><b>' + U.esc(a.full_name || a.email) + '</b>' +
                    (a.pending ? ' <span class="tag tag-warn">à valider</span>' : '') +
                    (a.is_blocked ? ' <span class="tag tag-danger">bloqué</span>' : '') +
                    '<div class="tiny">' + U.esc(a.email) + '</div>' +
                    (a.role === 'driver'
                      ? '<div class="tiny">' +
                        (a.driver_status === 'available' ? '🟢 disponible'
                          : a.driver_status === 'busy' ? '🔵 en livraison' : '⚪ indisponible') +
                        (a.zone_name ? ' • 📍 ' + U.esc(a.zone_name) : ' • 📍 aucun quartier') + '</div>'
                      : '') +
                  '</div>' +
                  '<div style="color:var(--brand);font-weight:800">' + (a.is_current ? 'ACTUEL' : '→') + '</div>' +
                '</button>').join('') + '</div>';
          }).join(''),

        footer: '<button class="btn btn-ghost btn-block btn-sm" id="tpReset">' +
                '♻️ Réinitialiser toutes les données de démo</button>',

        onMount(el, api) {

          el.querySelectorAll('[data-go]').forEach(btn => btn.onclick = async function () {
            const path = this.dataset.path;
            try {
              // rendre le livreur opérationnel avant de basculer, si demandé
              if (this.dataset.prep !== undefined)
                API.demoReadyDriver(this.dataset.go, this.dataset.prep || null);
              API.demoSwitchTo(this.dataset.go);
              await Store.refreshProfile();
              api.close();
              UI.ok('Connecté : ' + (Store.profile.full_name || ''),
                    ROLE[Store.role] ? ROLE[Store.role].label : '');
              Shell.render();
              Router.go(path || Router.homeFor(Store.role));
            } catch (e) { UI.err(e.message); }
          });

          const ap = el.querySelector('#tpApprove');
          if (ap) ap.onclick = async function () {
            UI.busy(this, true);
            const n = API.demoApproveAll();
            await Store.refreshProfile();
            api.close();
            UI.ok(n + ' compte(s) validé(s)');
            Router.render();
          };

          el.querySelector('#tpReset').onclick = async function () {
            if (!(await UI.confirm('Tout réinitialiser ?',
              'Les comptes, restaurants et commandes que vous avez créés seront effacés.',
              'Réinitialiser', true))) return;
            API.resetDemo();
            location.hash = '#/';
            location.reload();
          };
        }
      });
    }
  };

  w.TestPanel = TestPanel;
})(window);
