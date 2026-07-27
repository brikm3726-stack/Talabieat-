/* ==========================================================================
   VUES CLIENT — historique des commandes & suivi en temps réel
   ========================================================================== */
(function (w) {
  'use strict';

  const ACTIVE = ['pending', 'accepted', 'preparing', 'ready', 'driver_assigned', 'delivering'];

  /* ======================================================================
     HISTORIQUE DES COMMANDES
     ====================================================================== */
  Router.add('/orders', async function (params, query, view) {
    let tab = 'active';

    view.innerHTML = '<div class="wrap-sm page">' +
      Cmp.pageHead('Mes commandes', 'Suivez vos commandes en cours et consultez votre historique') +
      '<div class="tabs" style="margin-bottom:16px">' +
        '<button data-t="active" class="on">En cours</button>' +
        '<button data-t="done">Terminées</button>' +
        '<button data-t="all">Toutes</button>' +
      '</div>' +
      '<div id="list"><div class="skel" style="height:110px"></div></div></div>';

    const list = view.querySelector('#list');

    async function load() {
      const all = await API.safe(() => API.orders({ scope: 'client' }), []);
      let rows = all;
      if (tab === 'active') rows = all.filter(o => ACTIVE.indexOf(o.status) >= 0);
      if (tab === 'done') rows = all.filter(o => ACTIVE.indexOf(o.status) < 0);

      if (!rows.length) {
        list.innerHTML = UI.empty('📦',
          tab === 'active' ? 'Aucune commande en cours' : 'Aucune commande',
          tab === 'active' ? 'Vos commandes en cours apparaîtront ici en temps réel.' : 'Vous n’avez pas encore commandé.',
          '<a class="btn btn-primary" href="#/restaurants">Commander maintenant</a>');
        return;
      }

      list.innerHTML = rows.map(o => Cmp.orderCard(o, {
        footer: '<div class="divider"></div>' +
          '<div class="row-between">' +
            '<span class="tiny">' + U.dt(o.created_at) + '</span>' +
            '<span class="btn btn-ghost btn-sm">Suivre →</span>' +
          '</div>'
      })).join('');

      list.querySelectorAll('[data-order]').forEach(el =>
        el.onclick = () => Router.go('/order/' + el.dataset.order));
    }

    view.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      tab = b.dataset.t;
      view.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b));
      load();
    });

    await load();
    const off = API.onChange(t => { if (t === 'orders' || t === '*') load(); });
    return off;   // nettoyage au changement de page
  }, { auth: true, roles: ['client'] });

  /* ======================================================================
     SUIVI D'UNE COMMANDE
     ====================================================================== */
  Router.add('/order/:id', async function (params, query, view) {
    view.innerHTML = '<div class="wrap-sm page"><div class="skel" style="height:300px"></div></div>';

    async function load() {
      const o = await API.safe(() => API.order(params.id), null);
      if (!o) {
        view.innerHTML = '<div class="wrap-sm page">' + UI.empty('🧾', 'Commande introuvable', '',
          '<a class="btn btn-primary" href="#/orders">Mes commandes</a>') + '</div>';
        return;
      }

      const canCancel = (o.status === 'pending' || o.status === 'accepted');
      const eta = etaText(o);
      const hasPos = U.hasCoords({ lat: o.address_lat, lng: o.address_lng });

      view.innerHTML = '<div class="wrap-sm page">' +

        '<div class="row" style="margin-bottom:14px">' +
          '<button class="icon-btn" id="back">←</button>' +
          '<div class="grow"><div class="h2">Commande <span class="ocode">#' + U.esc(o.code) + '</span></div>' +
          '<div class="tiny">' + U.dt(o.created_at) + '</div></div>' +
        '</div>' +

        /* ---- bandeau statut ---- */
        '<div class="card card-p" style="background:var(--brand-grad);color:#fff;border:none">' +
          '<div style="font-size:32px">' + U.statusIcon(o.status) + '</div>' +
          '<div class="h2" style="margin-top:8px">' + U.esc(U.statusLabel(o.status)) + '</div>' +
          '<div style="opacity:.9;font-size:13.5px;margin-top:5px">' + U.esc(eta) + '</div>' +
        '</div>' +

        /* ---- livreur ---- */
        (o.driver ?
          '<div class="card card-p" style="margin-top:14px">' +
            '<div class="row" style="gap:12px">' +
              UI.avatar(o.driver.full_name, null, 46) +
              '<div class="grow"><div class="tiny">Votre livreur</div>' +
              '<b>' + U.esc(o.driver.full_name) + '</b></div>' +
              (o.driver.phone ? '<a class="btn btn-soft btn-sm" href="tel:' + U.esc(o.driver.phone) + '">📞 Appeler</a>' : '') +
            '</div></div>' : '') +

        /* ---- timeline ---- */
        '<div class="card card-p" style="margin-top:14px">' +
          '<div class="h3" style="margin-bottom:14px">Suivi de la commande</div>' +
          Cmp.timeline(o) +
        '</div>' +

        /* ---- restaurant ---- */
        (o.restaurant ?
          '<div class="card card-p" style="margin-top:14px">' +
            '<div class="h3" style="margin-bottom:8px">Restaurant</div>' +
            '<b>' + U.esc(o.restaurant.name) + '</b>' +
            '<div class="tiny" style="margin-top:4px">📍 ' + U.esc(o.restaurant.address || '') + '</div>' +
            (o.restaurant.phone ? '<div class="tiny" style="margin-top:4px">📞 <a href="tel:' + U.esc(o.restaurant.phone) +
              '" style="color:var(--brand);font-weight:650">' + U.esc(o.restaurant.phone) + '</a></div>' : '') +
          '</div>' : '') +

        /* ---- détail ---- */
        '<div class="card card-p" style="margin-top:14px">' +
          '<div class="h3" style="margin-bottom:10px">Détail</div>' +
          Cmp.orderLines(o) +
          '<div class="divider"></div>' +
          Cmp.orderTotals(o) +
        '</div>' +

        /* ---- livraison ---- */
        '<div class="card card-p" style="margin-top:14px">' +
          '<div class="h3" style="margin-bottom:8px">Livraison</div>' +
          (hasPos ? '<div class="map-preview" id="omap" style="margin-bottom:10px"></div>' : '') +
          '<div class="tiny stack" style="gap:5px">' +
            '<div>📍 ' + U.esc(o.address_street) + (o.address_details ? ' — ' + U.esc(o.address_details) : '') + '</div>' +
            '<div>🗺️ ' + U.esc(o.zone ? o.zone.name : '') + '</div>' +
            '<div>📞 ' + U.esc(o.client_phone) + '</div>' +
            (o.note ? '<div>📝 ' + U.esc(o.note) + '</div>' : '') +
            '<div>💵 Paiement à la livraison</div>' +
          '</div>' +
          (hasPos
            ? '<a class="btn btn-ghost btn-sm btn-block" style="margin-top:10px" target="_blank" rel="noopener" href="' +
              U.gmapsPin(o.address_lat, o.address_lng) + '">🗺️ Voir le point de livraison dans Google Maps</a>'
            : '<div class="banner banner-warn" style="margin-top:10px">Cette adresse n’a pas de position GPS. ' +
              'Ajoutez-en une dans votre compte pour aider le livreur à vous trouver.</div>') +
        '</div>' +

        /* ---- actions ---- */
        '<div class="stack" style="margin-top:16px">' +
          (o.status === 'delivered' && !o.client_confirmed
            ? '<button class="btn btn-ok btn-block btn-lg" id="confirmRecep">✅ J’ai bien reçu ma commande</button>' : '') +
          (o.status === 'delivered' && o.client_confirmed
            ? '<div class="banner banner-ok">🎉 Réception confirmée. Merci d’avoir commandé sur ' + U.esc(TALABI_CONFIG.APP_NAME) + ' !</div>' : '') +
          (canCancel ? '<button class="btn btn-danger btn-block" id="cancel">Annuler la commande</button>' : '') +
          '<a class="btn btn-ghost btn-block" href="#/orders">← Mes commandes</a>' +
        '</div>' +
      '</div>';

      view.querySelector('#back').onclick = () => Router.back();

      if (hasPos) MapPicker.preview(view.querySelector('#omap'), +o.address_lat, +o.address_lng);

      const cr = view.querySelector('#confirmRecep');
      if (cr) cr.onclick = async function () {
        UI.busy(this, true);
        await API.safe(() => API.confirmReception(o.id));
        UI.ok('Merci !', 'Bon appétit 😋');
        load();
      };

      const cb = view.querySelector('#cancel');
      if (cb) cb.onclick = async () => {
        const reason = await UI.prompt('Annuler la commande', 'Motif (facultatif)', 'Ex : erreur d’adresse');
        if (reason === null) return;
        await API.safe(() => API.updateOrderStatus(o.id, 'cancelled', { cancel_reason: reason }));
        UI.ok('Commande annulée');
        load();
      };
    }

    await load();

    // rafraîchissement temps réel + filet de sécurité toutes les 20 s
    const off = API.onChange(t => { if (t === 'orders' || t === '*') load(); });
    const timer = setInterval(load, 20000);
    return () => { off(); clearInterval(timer); };
  }, { auth: true });

  /* ------------------------------------------------------------ helpers */
  function etaText(o) {
    switch (o.status) {
      case 'pending': return 'En attente de confirmation du restaurant…';
      case 'accepted': return 'Le restaurant a accepté votre commande.';
      case 'preparing': return 'Préparation en cours — environ ' + ((o.restaurant && o.restaurant.prep_time_min) || 25) + ' min.';
      case 'ready': return 'Votre commande attend un livreur.';
      case 'driver_assigned': return 'Le livreur se rend au restaurant.';
      case 'delivering': return 'Votre commande arrive ! Préparez ' + U.money(o.total) + '.';
      case 'delivered': return 'Livrée le ' + U.dt(o.delivered_at || o.created_at) + '.';
      case 'rejected': return o.reject_reason || 'Le restaurant n’a pas pu honorer la commande.';
      case 'cancelled': return o.cancel_reason || 'Commande annulée.';
      default: return '';
    }
  }
})(window);
