/* ==========================================================================
   VUES CLIENT — historique des commandes & suivi en temps réel
   ========================================================================== */
(function (w) {
  'use strict';

  const ACTIVE = ['pending', 'accepted', 'preparing', 'ready', 'driver_assigned', 'delivering'];

  /* ----------------------------------------------------------------------
     La carte d'une commande, telle que la maquette la dessine.

     Elle ne réutilise pas Cmp.orderCard : cette fonction sert aussi au
     restaurant et à l'administration, où la même commande se lit tout
     autrement — on y cherche un client et une action, pas un suivi. Les
     faire cohabiter dans un seul gabarit aurait donné une carte qui ne
     convient nulle part.
     ---------------------------------------------------------------------- */
  function carte(o) {
    const d = new Date(o.created_at);
    const jour = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' });
    const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    return '<article class="ord-card" data-order="' + U.esc(o.id) + '">' +
      '<span class="coin" aria-hidden="true"></span>' +
      '<span class="filigrane" aria-hidden="true">' + UI.icon('package', 74) + '</span>' +

      '<div class="ord-top">' +
        '<span class="ord-code">#' + U.esc(o.code) + '</span>' +
        '<span class="ord-etat">' + U.statusIcon(o.status) + ' ' +
          U.esc(U.statusLabel(o.status)) + '</span>' +
        '<span class="ord-age">' + U.esc(U.ago(o.created_at)) + '</span>' +
      '</div>' +

      '<div class="ord-resto">' + U.esc(o.restaurant ? o.restaurant.name : '') + '</div>' +
      '<div class="ord-meta">' +
        (o.items ? o.items.length : 0) + ' article(s)' +
        '<span class="pt"></span>' + U.money(o.total) +
      '</div>' +

      '<div class="ord-bas">' +
        '<span class="quand">' +
          UI.icon('calendar', 16) + ' ' + U.esc(jour) +
          '<span class="sep"></span>' +
          UI.icon('clock', 16) + ' ' + U.esc(heure) +
        '</span>' +
        '<span class="btn btn-primary ord-suivre">Suivre ' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
            'stroke-linecap="round" stroke-linejoin="round" width="17" height="17">' +
            '<path d="M5 12h13"/><path d="M13 6l6 6-6 6"/></svg></span>' +
      '</div>' +
    '</article>';
  }

  /* ======================================================================
     HISTORIQUE DES COMMANDES
     ====================================================================== */
  Router.add('/orders', async function (params, query, view) {
    let tab = 'active';

    /* Le titre de la maquette porte un petit trait orange sous « Mes ». Il
       n'est pas repris : c'est le seul élément de la page demandé en moins.
       La ligne d'explication, elle, reste — c'est bien « la sous-ligne » du
       titre qui devait sauter, pas la phrase. */
    view.innerHTML = '<div class="orders-page">' +
      /* Les dessins en filigrane de la maquette. Ils sont posés là et non en
         image de fond : à cette taille et cette opacité, une image serait un
         fichier à charger pour quelque chose qu'on ne regarde jamais
         vraiment — alors que ces pictogrammes sont déjà dans la page. */
      '<span class="ord-decor" aria-hidden="true">' +
        '<i style="top:6%;left:-4%">'   + UI.icon('burger', 120) + '</i>' +
        '<i style="top:2%;right:-6%">'  + UI.icon('pizza', 130)  + '</i>' +
        '<i style="bottom:16%;left:-5%">' + UI.icon('cart', 110)  + '</i>' +
        '<i style="bottom:6%;right:-4%">' + UI.icon('utensils', 115) + '</i>' +
      '</span>' +
      '<div class="wrap-sm page">' +
      '<div class="h1">Mes <span class="accent">commandes</span></div>' +
      '<p class="sub ord-sub">Suivez vos commandes en cours et consultez votre historique</p>' +
      /* Pictogrammes au trait plutôt qu'emoji : les emoji changent de dessin
         d'un téléphone à l'autre et n'obéissent pas à la couleur de l'onglet
         actif, qui reste alors le seul élément à ne pas passer en orange. */
      '<div class="ord-tabs">' +
        '<button data-t="active" class="on">' + UI.icon('clock', 18) + ' En cours</button>' +
        '<button data-t="done">' + UI.icon('check', 18) + ' Terminées</button>' +
        '<button data-t="all">' + UI.icon('receipt', 18) + ' Toutes</button>' +
      '</div>' +
      '<div id="list"><div class="skel" style="height:110px"></div></div></div></div>';

    const list = view.querySelector('#list');

    async function load() {
      const all = await API.safe(() => API.orders({ scope: 'client' }), []);
      let rows = all;
      if (tab === 'active') rows = all.filter(o => ACTIVE.indexOf(o.status) >= 0);
      if (tab === 'done') rows = all.filter(o => ACTIVE.indexOf(o.status) < 0);

      if (!rows.length) {
        list.innerHTML =
          '<div class="empty-scene compact">' +
            '<img class="scene-art" src="' + U.asset('assets/img/bg/commandes-vide.png') + '" alt="" aria-hidden="true">' +
            '<div class="h2 scene-title">' +
              (tab === 'active' ? 'Aucune commande en cours' : 'Aucune commande') + '</div>' +
            '<p class="scene-sub">' +
              (tab === 'active'
                ? 'Vos commandes en cours apparaîtront ici en temps réel.'
                : 'Vous n’avez pas encore commandé.') + '</p>' +
            '<div class="scene-cta">' +
              '<a class="btn btn-primary btn-lg" href="#/restaurants">' +
                UI.icon('cart', 19) + ' Commander maintenant</a>' +
            '</div>' +
          '</div>';
        return;
      }

      list.innerHTML = '<div class="ord-list">' + rows.map(carte).join('') + '</div>';

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
      const isLive = !!o.driver && ['driver_assigned', 'delivering'].indexOf(o.status) >= 0;

      /* suivi-page : c'est par cette classe que la page reprend l'orange de
         Talabi là où le vert de validation n'a rien à dire (voir app.css). */
      view.innerHTML = '<div class="wrap-sm page suivi-page">' +

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
          // le client voit le temps qu'il reste au restaurant : il sait qu'il
          // n'attendra pas indéfiniment, et pourquoi
          (o.status === 'pending' && o.respond_deadline
            ? Cmp.countdown(o.respond_deadline, 'Réponse du restaurant sous', 60)
            : '') +
        '</div>' +

        /* ---- livreur + suivi en direct ---- */
        (o.driver ?
          '<div class="card card-p" style="margin-top:14px">' +
            '<div class="row" style="gap:12px">' +
              UI.avatar(o.driver.full_name, null, 46) +
              '<div class="grow"><div class="tiny">Votre livreur</div>' +
              '<b>' + U.esc(o.driver.full_name) + '</b>' +
              '<div class="tiny" id="drvInfo">Recherche de sa position…</div></div>' +
              (o.driver.phone ? '<a class="btn btn-soft btn-sm" href="tel:' + U.esc(o.driver.phone) + '">📞 Appeler</a>' : '') +
            '</div>' +
            (isLive
              ? '<div class="live-map" id="liveMap" style="margin-top:12px"></div>' +
                '<div class="row" style="gap:8px;margin-top:8px">' +
                  '<span class="tag tag-ok" id="liveTag">🔴 Suivi en direct</span>' +
                  '<button class="btn btn-ghost btn-sm" id="recenter" style="margin-left:auto">Recentrer</button>' +
                '</div>' +
                /* Cette page dit tout de la commande : les plats, l'adresse,
                   le total. Suivre un livreur qui roule demande l'inverse —
                   une carte et trois chiffres. D'où la porte vers l'écran
                   plein écran, au lieu d'agrandir celle-ci. */
                '<a class="btn btn-primary btn-block" style="margin-top:10px" ' +
                  'href="#/live/' + U.esc(o.id) + '">' + UI.icon('navigation', 18) +
                  ' Suivre en plein écran</a>'
              : '') +
          '</div>' : '') +

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
            '<div class="tiny" style="margin-top:4px">' + UI.pin(13) + ' ' + U.esc(o.restaurant.address || '') + '</div>' +
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
            '<div>' + UI.pin() + ' ' + U.esc(o.address_street) + (o.address_details ? ' — ' + U.esc(o.address_details) : '') + '</div>' +
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

      currentStatus = o.status;
      if (hasPos) MapPicker.preview(view.querySelector('#omap'), +o.address_lat, +o.address_lng);
      isLive ? startLive(o) : stopLive();

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

    /* ------------------------------------------------ suivi en direct */
    let liveMap = null, posTimer = null, currentStatus = null;

    function stopLive() {
      if (liveMap) { liveMap.destroy(); liveMap = null; }
      if (posTimer) { clearInterval(posTimer); posTimer = null; }
    }

    function startLive(o) {
      stopLive();
      const el = view.querySelector('#liveMap');
      if (!el) return;

      const client = { lat: o.address_lat, lng: o.address_lng };
      liveMap = MapPicker.live(el, { restaurant: o.restaurant, client: client });

      const rc = view.querySelector('#recenter');
      if (rc) rc.onclick = () => liveMap && liveMap.recenter();

      const refresh = async () => {
        const p = await API.safe(() => API.driverPosition(o.id), null);
        const info = view.querySelector('#drvInfo');
        const tag = view.querySelector('#liveTag');
        if (!info) return;   // la page a changé

        if (!p) {
          info.textContent = 'Position pas encore partagée par le livreur.';
          if (tag) { tag.className = 'tag tag-muted'; tag.textContent = '⚪ En attente du signal'; }
          return;
        }

        if (liveMap) liveMap.update({ restaurant: o.restaurant, client: client, driver: p });
        if (tag) { tag.className = 'tag tag-ok'; tag.textContent = '🔴 Suivi en direct'; }

        // distance restante et temps estimé (≈ 22 km/h en ville)
        if (U.hasCoords(client)) {
          const km = U.haversine(p.lat, p.lng, +client.lat, +client.lng) * 1.3;
          const min = Math.max(1, Math.round(km / 22 * 60));
          info.innerHTML = '🛵 à <b>' + km.toFixed(1) + ' km</b> — environ <b>' + min + ' min</b>' +
                           ' <span style="opacity:.6">(' + U.ago(p.at) + ')</span>';
        } else {
          info.textContent = 'Position mise à jour ' + U.ago(p.at);
        }
      };

      refresh();
      posTimer = setInterval(refresh, 12000);
    }

    await load();

    // rafraîchissement à chaque évènement temps réel
    const off = API.onChange(t => { if (t === 'orders' || t === '*') load(); });

    // filet de sécurité : on ne re-rend la page que si le statut a changé,
    // pour ne pas casser la carte de suivi toutes les 20 secondes
    const guard = setInterval(async () => {
      const cur = await API.safe(() => API.order(params.id), null);
      if (cur && cur.status !== currentStatus) load();
    }, 20000);

    return () => { off(); clearInterval(guard); stopLive(); };
  }, { auth: true });

  /* ======================================================================
     SUIVI EN DIRECT — PLEIN ÉCRAN (client)
     ----------------------------------------------------------------------
     Le suivi tenait dans une carte de 200 px au milieu d'une page qui
     défile : pour voir où en était son livreur, le client faisait défiler,
     et la carte remontait hors de l'écran dès qu'il touchait autre chose.
     Or c'est l'écran qu'on rouvre toutes les deux minutes en attendant son
     repas. Il occupe donc tout, et ne dit que quatre choses : dans combien
     de temps, où l'on en est, qui apporte, combien préparer.
     ====================================================================== */
  Router.add('/live/:id', async function (params, query, view) {
    let o = await API.safe(() => API.order(params.id), null);
    if (!o) return Router.go('/orders', true);

    /* Un suivi n'existe qu'entre l'attribution et la livraison. Avant, il n'y
       a rien à suivre ; après, il n'y a plus rien à voir — et une carte vide
       plein écran, sans retour possible vers le détail, est un piège. */
    const suivable = o => ['driver_assigned', 'delivering'].indexOf(o.status) >= 0;
    if (!suivable(o)) return Router.go('/order/' + params.id, true);

    const client = { lat: o.address_lat, lng: o.address_lng };
    let pos = null;                       // dernière position connue du livreur

    const ETAPES = ['Prête', 'Livreur assigné', 'En livraison', 'Livrée'];

    const ecran = LiveScreen.open(view, {
      code: '#' + (o.code || ''),
      back: '/order/' + params.id,

      points: () => ({
        restaurant: o.restaurant && U.hasCoords(o.restaurant)
          ? { lat: +o.restaurant.lat, lng: +o.restaurant.lng } : null,
        client: U.hasCoords(client) ? client : null,
        driver: pos,
        /* Le trajet qui reste, dans l'ordre. Avant le retrait il passe par le
           restaurant : c'est ce qui explique au client pourquoi son livreur
           s'éloigne parfois de chez lui. */
        chemin: o.status === 'delivering'
          ? ['driver', 'client']
          : ['driver', 'restaurant', 'client']
      }),

      /* Le statut est relu en même temps que la position : c'est lui qui fait
         basculer « passe au restaurant » en « arrive chez vous », et qui
         ferme l'écran quand la course se termine. */
      fetch: async () => {
        const frais = await API.safe(() => API.order(params.id), null);
        if (frais) o = frais;
        pos = await API.safe(() => API.driverPosition(params.id), null);
        if (!suivable(o)) Router.go('/order/' + params.id, true);
      },

      /* Trois raisons pour qu'une carte reste vide, et chacune se répare
         ailleurs que sur cet écran. Les nommer évite au client de conclure
         que l'application est cassée — et de nous appeler pour ça. */
      etat: () => {
        const ic = t => '<span class="ic">' + t + '</span>';
        if (!pos)
          return ic('📡') + '<span class="tx">En attente du signal de votre livreur' +
            '<small>Sa position apparaîtra dès qu’il se met en route.</small></span>';
        if (!U.hasCoords(client))
          return ic(UI.icon('pin', 17)) + '<span class="tx">Votre adresse n’a pas de position GPS' +
            '<small>Le livreur ne peut pas être guidé jusqu’à votre porte. ' +
            'Ajoutez-la dans Mon compte.</small></span>';
        if (!o.restaurant || !U.hasCoords(o.restaurant))
          return ic('🏪') + '<span class="tx">Le restaurant n’a pas de position sur la carte' +
            '<small>Le trajet affiché commence donc à votre livreur.</small></span>';
        return '';
      },

      sheet: () => {
        const idx = { driver_assigned: 1, delivering: 2, delivered: 3 }[o.status] || 1;

        /* Avant le retrait, le livreur doit d'abord passer au restaurant :
           annoncer la seule distance qui le sépare du client donnerait un
           chiffre deux fois trop optimiste. */
        const versResto = LiveScreen.trajet(pos, o.restaurant);
        const restoClient = LiveScreen.trajet(o.restaurant, client);
        const versClient = LiveScreen.trajet(pos, client);

        let valeur = '—', apres = '', titre = 'Arrivée estimée';
        if (o.status === 'delivering' && versClient) {
          valeur = versClient.min + ' min';
          apres = versClient.texte;
        } else if (versResto && restoClient) {
          valeur = (versResto.min + restoClient.min) + ' min';
          apres = 'passe au restaurant d’abord';
        } else if (!pos) {
          valeur = 'En route';
          apres = 'position pas encore partagée';
          titre = 'Votre livreur';
        }

        return LiveScreen.grab() +
          LiveScreen.eta(titre, valeur, apres) +
          LiveScreen.progress(ETAPES, idx) +
          LiveScreen.person({
            name: (o.driver && o.driver.full_name) || 'Votre livreur',
            /* Ni note ni véhicule : la plateforme ne les connaît pas. Un
               « ★ 4.9 » inventé se retournerait contre nous le jour où le
               client comparerait. Ce qu'on sait vraiment, c'est la
               fraîcheur du signal — et c'est ce qui l'intéresse ici. */
            meta: pos
              ? '🛵 Livreur · signal ' + U.esc(U.ago(pos.at))
              : '🛵 Livreur · en attente du signal',
            phone: o.driver && o.driver.phone
          }) +
          LiveScreen.note(UI.icon('wallet', 18),
            'Préparez <b>' + U.esc(U.money(o.total)) + '</b> en espèces');
      }
    });

    const off = API.onChange(t => { if (t === 'orders' || t === '*') ecran.repaint(); });
    return () => { off(); ecran.destroy(); };
  }, { auth: true, roles: ['client'] });

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
