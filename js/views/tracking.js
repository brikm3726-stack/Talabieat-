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

    /* Thème sombre ou clair : UI.nuit() décide, et nomme l'écran dans les
       deux cas. */
    UI.nuit('commandes');

    /* ---- LE VISITEUR SANS COMPTE EST ACCUEILLI, PAS RENVOYÉ ----
       La garde `auth:true` a été retirée de cette route : elle renvoyait vers
       la connexion sans un mot, et un visiteur qui touche « Commandes » se
       retrouvait devant un formulaire sans comprendre pourquoi. Il voit
       maintenant l'écran, il comprend à quoi il sert, et il décide.

       Le rôle reste protégé plus bas : un livreur connecté n'a rien à faire
       ici, c'est la garde `roles` qui s'en charge — elle ne s'applique qu'aux
       personnes connectées. */
    if (!Store.isLogged) {
      view.innerHTML = '<div class="orders-page">' +
        '<span class="ord-decor" aria-hidden="true">' +
          '<i style="top:6%;left:-4%">'     + UI.icon('burger', 120)   + '</i>' +
          '<i style="top:2%;right:-6%">'    + UI.icon('pizza', 130)    + '</i>' +
          '<i style="bottom:16%;left:-5%">' + UI.icon('cart', 110)     + '</i>' +
          '<i style="bottom:6%;right:-4%">' + UI.icon('utensils', 115) + '</i>' +
        '</span>' +
        '<div class="wrap-sm page">' +
          '<div class="h1">Mes <span class="accent">commandes</span></div>' +
          '<p class="sub ord-sub">Suivez vos commandes en cours et consultez votre historique</p>' +
          '<div class="empty-scene compact">' +
            '<span class="scene-ic" aria-hidden="true">' + UI.icon('package', 40) + '</span>' +
            '<div class="h2 scene-title">Connectez-vous pour voir vos commandes</div>' +
            '<p class="scene-sub">Vos commandes en cours et votre historique vous ' +
              'attendent ici. Suivez votre livreur sur la carte, retrouvez ce que ' +
              'vous avez commandé, et recommandez en deux touches.</p>' +
            '<div class="scene-cta">' +
              '<a class="btn btn-primary btn-lg" id="versConnexion" href="#/login">' +
                UI.icon('user', 19) + ' Se connecter</a>' +
              '<a class="btn btn-ghost btn-lg" href="#/restaurants">' +
                'Voir les restaurants</a>' +
            '</div>' +
          '</div>' +
        '</div></div>';

      /* Après la connexion, on revient ICI et non à l'accueil : c'est ce que
         la personne voulait voir. Le mécanisme existe déjà — auth.js le lit à
         la connexion (voir afterLogin). */
      const vc = view.querySelector('#versConnexion');
      if (vc) vc.onclick = () => {
        try { sessionStorage.setItem('talabi.after_login', '/orders'); } catch (e) {}
      };

      return () => UI.nuit('');
    }

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
            /* L'ILLUSTRATION A CÉDÉ LA PLACE À UN PICTOGRAMME, ET C'EST
               DÉLIBÉRÉ. `commandes-vide.png` est dessinée sur fond quasi
               blanc : le thème clair la fondait dans la page avec
               `mix-blend-mode:multiply`, mais multiplier par du noir donne du
               noir — sur cet écran sombre elle n'aurait laissé qu'un
               rectangle éteint, ou, sans le fondu, un bloc blanc au milieu de
               la page. Le panier vide, lui, a bien reçu sa version sombre :
               elle existait dans la maquette fournie, celle-ci non.
               Un pictogramme dans une pastille qui rayonne est net à toute
               densité, ne pèse rien, et dit la même chose. */
            (UI.sombreVoulu()
              ? '<span class="scene-ic" aria-hidden="true">' + UI.icon('bag', 40) + '</span>'
              : '<img class="scene-art" src="' + U.asset('assets/img/bg/commandes-vide.png') + '" ' +
                  'alt="" aria-hidden="true">') +
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
    /* DEUX CHOSES À DÉFAIRE, PAS UNE : l'abonnement temps réel ET le thème
       sombre. En ne rendant que `off`, le noir restait collé au body après
       avoir quitté Commandes, et l'écran suivant s'affichait en texte sombre
       sur fond sombre. */
    return () => { off(); UI.nuit(''); };
    /* `auth` retiré, `roles` conservé : la garde de rôle ne s'applique qu'aux
       personnes connectées (voir js/lib/router.js), donc un visiteur passe et
       un livreur est renvoyé chez lui. C'est exactement ce qu'on veut. */
  }, { roles: ['client'] });

  /* ======================================================================
     SUIVI D'UNE COMMANDE
     ====================================================================== */
  Router.add('/order/:id', async function (params, query, view) {
    /* Thème sombre, comme l'onglet Commandes d'où l'on arrive. */
    UI.nuit('suivi');

    view.innerHTML = '<div class="wrap-sm page"><div class="skel" style="height:300px"></div></div>';

    async function load() {
      const o = await API.safe(() => API.order(params.id), null);
      if (!o) {
        view.innerHTML = '<div class="wrap-sm page">' + UI.empty('🧾', 'Commande introuvable', '',
          '<a class="btn btn-primary" href="#/orders">Mes commandes</a>') + '</div>';
        return;
      }

      /* ANNULER TANT QU'AUCUN LIVREUR N'A PRIS LA COURSE.
         C'était limité à « en attente » et « acceptée ». Une commande passée en
         préparation, ou prête et sans preneur, devenait donc impossible à
         annuler depuis l'application : le client restait devant un écran qui
         tourne sans issue, et finissait par appeler le support pour un geste
         qu'il pouvait faire lui-même. Or rien ne s'y oppose — la politique
         SQL laisse le client modifier sa commande, et aucun livreur n'a encore
         engagé de frais ni avancé d'argent.

         Le partage se fait au livreur : dès qu'il est assigné, il a peut-être
         déjà payé le restaurant de sa poche. À partir de là, l'annulation
         passe par le support, comme avant. */
      const sansLivreur = !o.driver_id && !o.driver;
      const canCancel = sansLivreur &&
        ['pending', 'accepted', 'preparing', 'ready'].indexOf(o.status) >= 0;
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

        /* ---- bandeau statut ----
           En attente du restaurant, il cède la place à l'écran 3a : voir
           `blocEnvoyee`. Un bandeau qui répète « en attente » sans dire ce
           qu'on attend, ni combien de temps, ni ce qui vient après, laisse le
           client seul devant une horloge. */
        (o.status === 'pending' ? blocEnvoyee(o) :
         sansLivreur && o.status === 'ready' ? blocRecherche(o) :
          '<div class="card card-p" style="background:var(--brand-grad);color:#fff;border:none">' +
            '<div style="font-size:32px">' + U.statusIcon(o.status) + '</div>' +
            '<div class="h2" style="margin-top:8px">' + U.esc(U.statusLabel(o.status)) + '</div>' +
            '<div style="opacity:.9;font-size:13.5px;margin-top:5px">' + U.esc(eta) + '</div>' +
          '</div>') +

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
          /* Le libellé dit POURQUOI c'est encore possible : sans cette
             précision, un client hésite à toucher un bouton rouge de peur
             d'être facturé, et attend une livraison qu'il ne veut plus. */
          (canCancel
            ? '<button class="btn btn-danger btn-block" id="cancel">' +
                'Annuler la commande</button>' +
              '<div class="tiny center" style="margin-top:8px">Gratuit : aucun ' +
                'livreur n’a encore pris votre commande.</div>'
            : '') +
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

    /* Quatre choses à défaire : l'abonnement temps réel, le filet de
       sécurité, le suivi en direct — et le thème sombre. En oublier un seul
       laisse l'écran suivant en texte sombre sur fond sombre. */
    return () => { off(); clearInterval(guard); stopLive(); UI.nuit(''); };
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
    /* L'ÉCRAN RESTE OUVERT JUSQU'À LA CONFIRMATION.
       Il se fermait dès que le livreur marquait « livrée » : le client était
       renvoyé sur la page de commande à la seconde exacte où l'écran d'arrivée
       — le montant à remettre, le bouton de réception — avait enfin quelque
       chose à dire. Le seul écran conçu pour ce moment ne s'affichait donc
       jamais. Il ne se ferme plus qu'une fois la réception confirmée. */
    const suivable = o =>
      ['driver_assigned', 'delivering'].indexOf(o.status) >= 0 ||
      (o.status === 'delivered' && !o.client_confirmed);
    if (!suivable(o)) return Router.go('/order/' + params.id, true);

    const client = { lat: o.address_lat, lng: o.address_lng };
    let pos = null;                       // dernière position connue du livreur


    const resto = () => o.restaurant && U.hasCoords(o.restaurant)
      ? { lat: +o.restaurant.lat, lng: +o.restaurant.lng } : null;

    /**
     * AU MOMENT DU RETRAIT, LE LIVREUR EST AU RESTAURANT.
     *
     * Sa position n'arrive que toutes les quinze secondes, et il peut très bien
     * n'en avoir envoyé aucune depuis qu'il roule. Le client lisait donc
     * « commande récupérée » avec la moto dessinée trois rues plus loin, à
     * l'endroit où le livreur se trouvait avant d'arriver au restaurant — ce
     * qui donne l'impression que l'application raconte n'importe quoi.
     *
     * Dès que la commande est récupérée, si le dernier relevé est plus ancien
     * que le retrait lui-même, on le place au restaurant : c'est ce qu'on sait
     * de plus sûr sur lui à cette seconde, et c'est vrai. Le relevé suivant le
     * fera repartir de là.
     */
    const positionLivreur = () => {
      if (o.status !== 'delivering') return pos;
      const perime = !pos || !pos.at || (o.delivering_at &&
        new Date(pos.at).getTime() < new Date(o.delivering_at).getTime());
      return perime ? (resto() || pos) : pos;
    };

    const ecran = LiveScreen.open(view, {
      code: '#' + (o.code || ''),
      back: '/order/' + params.id,

      /* Six secondes au lieu de douze. Le livreur envoie sa position toutes les
         huit : à douze, on en manquait une sur deux et la moto avançait par
         bonds irréguliers. C'est une requête légère, et c'est le seul écran de
         l'application dont on attend qu'il bouge tout seul. */
      every: 6000,

      points: () => ({
        restaurant: resto(),
        client: U.hasCoords(client) ? client : null,
        driver: positionLivreur(),
        /* Le trajet qui reste, dans l'ordre. Avant le retrait il passe par le
           restaurant : c'est ce qui explique au client pourquoi son livreur
           s'éloigne parfois de chez lui. */
        chemin: o.status === 'delivering'
          ? ['driver', 'client']
          : ['driver', 'restaurant', 'client'],
        /* Les deux repères fixes portent leur nom. Le livreur, non : le
           scooter qui bat se reconnaît seul, et la feuille du bas le nomme
           déjà juste en dessous. */
        noms: {
          restaurant: o.restaurant && o.restaurant.name,
          client: 'Chez vous'
        },
        /* L'enseigne à la place du pictogramme : c'est la seule chose que le
           client cherche sur cette carte, puisqu'il sait déjà où il habite.
           Sans logo en base, le repère reprend son pictogramme — jamais un
           cercle vide. */
        logos: { restaurant: o.restaurant && o.restaurant.logo_url }
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

      /* LE CHEMIN, EN FOND D'ÉCRAN — le livreur, le restaurant, chez vous.
         Il occupe la place que la carte laissait vide. Avant le retrait, le
         tronçon en cours mène au restaurant et celui d'après revient vers le
         client : c'est ce qui explique d'un regard pourquoi le livreur
         s'éloigne parfois. Après, il n'en reste qu'un, droit sur le client.

         `bas` réserve le tiers inférieur : la feuille le recouvre, et un
         livreur dessiné dessous n'existe pas. */
      plan: () => {
        const nomResto = (o.restaurant && o.restaurant.name) || 'Restaurant';
        const r = resto();
        const cible = U.hasCoords(client) ? client : null;
        /* Le même point que sur la carte : au retrait, le livreur est au
           restaurant tant qu'aucun relevé plus récent n'est arrivé. */
        const moi = positionLivreur();
        const reste = LiveScreen.trajet(moi, cible);
        const versR = LiveScreen.trajet(moi, r);
        const rc = LiveScreen.trajet(r, cible);
        const opts = { plein: true, bas: 34 };

        /* Des pictogrammes du jeu de l'application, pas des emojis : 🏪 est un
           magasin et non un restaurant, et chaque téléphone dessine les emojis
           à sa façon — le repère changeait d'allure d'un appareil à l'autre. */
        const logoResto = o.restaurant && o.restaurant.logo_url;
        const IC = {
          resto: UI.icon('dome', 20),
          moi: UI.icon('scooter', 20),
          chez: UI.icon('home', 20)
        };

        return {
          opts: opts,
          etapes: o.status === 'delivering'
            ? [
                /* Le tronçon déjà parcouru reste sombre : l'orange désigne
                   toujours ce qui se fait maintenant, jamais ce qui est fini. */
                { p: r, ic: IC.resto, logo: logoResto, t: nomResto, s: 'commande récupérée',
                  fait: true, vers: { on: false, txt: '' } },
                { p: moi, ic: IC.moi, t: 'Votre livreur', ici: true,
                  vers: { on: true, txt: reste ? reste.texte : '' } },
                { p: cible, ic: IC.chez, t: 'Chez vous' }
              ]
            : [
                { p: moi, ic: IC.moi, t: 'Votre livreur', ici: true,
                  vers: { on: true, txt: versR ? versR.texte : '' } },
                { p: r, ic: IC.resto, logo: logoResto, t: nomResto, s: 'il prend votre commande',
                  vers: { on: false, txt: rc ? rc.texte : '' } },
                { p: cible, ic: IC.chez, t: 'Chez vous' }
              ]
        };
      },

      /* Le bouton de réception : le même appel que la page de commande, pour
         qu'un client puisse confirmer d'où il veut. */
      bind: feuille => {
        const b = feuille.querySelector('#lvRecu');
        if (!b) return;
        b.onclick = async function () {
          UI.busy(this, true);
          await API.safe(() => API.confirmReception(o.id));
          o.client_confirmed = true;
          UI.ok('Merci !', 'Bon appétit 😋');
          ecran.repaint();
          /* On laisse la confirmation à l'écran deux secondes, puis on propose
             de noter : c'est le seul moment où le client a le repas en main et
             le livreur en tête. Une heure plus tard, il ne se souvient plus si
             c'était chaud. */
          setTimeout(() => Router.go('/avis/' + params.id), 2000);
        };
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
        /* ============================================ LE LIVREUR EST ARRIVÉ
           Maquette 3b — l'écran qui manquait, celui de la porte.

           À cent cinquante mètres et la commande récupérée, la feuille change
           de sujet : il n'y a plus de trajet à suivre, il y a de l'argent à
           sortir et une porte à ouvrir. Le MONTANT PASSE DEVANT TOUT, avant
           même le bouton — c'est ce qu'on cherche des yeux en descendant
           l'escalier, et le chercher dans un récapitulatif à ce moment-là est
           exactement ce qui fait attendre le livreur en bas.

           L'arrivée n'est pas un statut en base : elle se déduit de la
           distance, comme les deux étapes de la timeline. Personne ne coche
           « je suis devant la porte » en portant deux sacs. */
        /* Deux façons d'être arrivé, et la seconde est la plus fréquente :
             • le livreur est à moins de cent cinquante mètres — il descend la
               rue, on peut déjà préparer l'argent ;
             • il a marqué la commande livrée — il est à la porte, ou déjà
               reparti, et il ne reste qu'à confirmer.
           La première dépend d'un GPS qui peut manquer ; la seconde n'en
           dépend pas, et c'est elle qui garantit que cet écran s'affiche. */
        const arrive =
          (o.status === 'delivered' && !o.client_confirmed) ||
          (o.status === 'delivering' && (() => {
            const t = LiveScreen.trajet(positionLivreur(), client);
            return t && t.km < 0.15;
          })());

        if (arrive) {
          const liv2 = o.driver || {};
          const f2 = liv2.driver || {};
          const p2 = (liv2.full_name || '').split(' ')[0];
          return LiveScreen.grab() +
            LiveScreen.eta('À remettre en espèces', U.money(o.total),
              p2 ? p2 + ' est en bas' : 'Votre livreur est en bas') +
            LiveScreen.note(UI.icon('info', 18),
              'Il vous attend quelques minutes. Descendez, ou indiquez-lui ' +
              'comment monter.') +
            LiveScreen.person({
              name: liv2.full_name || 'Votre livreur',
              photo: liv2.avatar_url,
              meta: [
                f2.rating ? '<span class="et">★</span>' + U.esc((+f2.rating).toFixed(1)) : '',
                f2.vehicle ? U.esc({ moto: 'Scooter', voiture: 'Voiture', velo: 'Vélo' }[f2.vehicle] || 'Véhicule') : ''
              ].filter(Boolean).join(' · '),
              phone: liv2.phone,
              sms: liv2.phone
            }) +
            /* Le geste de fin, et la seule porte de sortie s'il y a un
               problème : le support par téléphone, qui existe déjà. On
               n'invente pas un formulaire de litige qui n'irait nulle part. */
            (o.client_confirmed
              ? '<div class="lv-recu">' + UI.icon('check-circle', 20) +
                ' Réception confirmée · merci !</div>'
              : LiveScreen.action('J’ai bien reçu ma commande', 'id="lvRecu"')) +
            '<a class="lv-souci" href="tel:' +
              U.esc(String(TALABI_CONFIG.SUPPORT_PHONE || '').replace(/\s/g, '')) + '">' +
              'Un problème avec la commande ?</a>';
        }

        /* Avant le retrait, le livreur doit d'abord passer au restaurant :
           annoncer la seule distance qui le sépare du client donnerait un
           chiffre deux fois trop optimiste.

           Les distances partent du même point que le plan et la carte — au
           retrait, le restaurant : trois chiffres calculés depuis trois
           endroits différents finiraient par se contredire à l'écran. */
        const depuis = positionLivreur();
        const versResto = LiveScreen.trajet(depuis, o.restaurant);
        const restoClient = LiveScreen.trajet(o.restaurant, client);
        const versClient = LiveScreen.trajet(depuis, client);

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

        const totalMin = o.status === 'delivering'
          ? (versClient ? versClient.min : 0)
          : ((versResto ? versResto.min : 0) + (restoClient ? restoClient.min : 0));

        /* Le livreur tel que la base le connaît : sa fiche est imbriquée dans
           son profil (voir ORDER_SELECT). Rien n'est inventé — ce qui manque ne
           s'affiche pas. */
        const liv = o.driver || {};
        const fiche = liv.driver || {};
        const VEHIC = { moto: 'Scooter', voiture: 'Voiture', velo: 'Vélo', autre: 'Véhicule' };
        const meta = [
          fiche.rating ? '<span class="et">★</span>' + U.esc((+fiche.rating).toFixed(1)) : '',
          fiche.vehicle ? U.esc(VEHIC[fiche.vehicle] || 'Véhicule') : '',
          pos ? 'signal ' + U.esc(U.ago(pos.at)) : 'en attente du signal'
        ].filter(Boolean).join(' · ');

        /* LA FEUILLE DISAIT TROIS FOIS LA MÊME CHOSE.
           Les minutes restantes en grand, puis « Restant : 47 min » en case ;
           la distance dans la ligne du haut, puis « Distance » en case ; les
           quatre segments de la frise, puis les six étapes de la timeline qui
           les contiennent. La feuille avait fini par couvrir l'écran, et c'est
           la carte qu'on venait voir.

           Ne reste qu'une occurrence de chaque : le grand chiffre pour le temps
           et la distance, la timeline en six étapes pour l'avancement — plus
           précise que les quatre segments, donc c'est elle qui reste. L'heure de
           récupération rejoint la ligne du haut, où sont déjà les autres
           heures. */
        return LiveScreen.grab() +
          /* « 47 min » se périme dans la tête de celui qui le lit, « vers
             20:45 » reste vrai. Les morceaux sont assemblés, jamais concaténés à
             la main — sinon un morceau vide laisse un séparateur orphelin. */
          LiveScreen.eta(titre, valeur,
            [apres,
             LiveScreen.heureArrivee(totalMin),
             o.delivering_at ? 'récupérée à ' + U.time(o.delivering_at) : ''
            ].filter(Boolean).join(' · ')) +
          LiveScreen.timeline(jalons(depuis)) +
          LiveScreen.person({
            name: liv.full_name || 'Votre livreur',
            photo: liv.avatar_url,
            meta: meta,
            phone: liv.phone,
            sms: liv.phone
          }) +
          LiveScreen.note(UI.icon('wallet', 18),
            'Préparez <b>' + U.esc(U.money(o.total)) + '</b> en espèces');
      }
    });

    /* ------------------------------------------------------ les six jalons
       Quatre statuts en base, six étapes à l'écran : les deux qui manquent se
       déduisent de la géométrie, pas d'un minuteur. « En route » quand le
       livreur s'est éloigné du restaurant, « arrivé » quand il est à la porte.
       C'est plus juste qu'un statut que personne n'irait cocher en conduisant,
       et ça n'invente rien : ce sont les positions réelles qui le disent. */
    function jalons(depuis) {
      const km = (a, b) => (a && b && U.hasCoords(a) && U.hasCoords(b))
        ? U.haversine(+a.lat, +a.lng, +b.lat, +b.lng) : null;
      const dResto = km(depuis, o.restaurant);
      const dClient = km(depuis, client);
      const pris = !!o.delivering_at || o.status === 'delivering' || o.status === 'delivered';
      const enRoute = pris && dResto !== null && dResto > 0.15;
      const arrive = pris && dClient !== null && dClient < 0.15;
      const livre = o.status === 'delivered';

      const faits = [
        !!o.accepted_at || ['accepted', 'preparing', 'ready', 'driver_assigned', 'delivering', 'delivered'].indexOf(o.status) >= 0,
        !!o.ready_at || ['ready', 'driver_assigned', 'delivering', 'delivered'].indexOf(o.status) >= 0,
        pris, enRoute, arrive, livre
      ];
      const libelles = ['Commande acceptée', 'Restaurant prêt', 'Commande récupérée',
                        'En route', 'Arrivé chez vous', 'Livrée'];
      const heures = [o.accepted_at, o.ready_at, o.delivering_at, null, null, o.delivered_at];

      /* L'étape en cours est la première non franchie : c'est elle qui bat. */
      const encours = faits.indexOf(false);
      return libelles.map((t, i) => ({
        t: t,
        quand: heures[i] ? U.time(heures[i]) : '',
        fait: faits[i],
        ici: i === encours
      }));
    }

    const off = API.onChange(t => { if (t === 'orders' || t === '*') ecran.repaint(); });
    return () => { off(); ecran.destroy(); };
  }, { auth: true, roles: ['client'] });

  /* ======================================================================
     COMMANDE ENVOYÉE — maquette 3a
     ----------------------------------------------------------------------
     L'écran d'après « Commander ». Il ne remplace aucune donnée : le minuteur
     de réponse du restaurant existe déjà en base (supabase/09_delais.sql),
     l'heure d'envoi aussi. Ce qui manquait, c'est de les montrer ensemble.

     Un bandeau « en attente » ne dit ni ce qu'on attend, ni combien de temps,
     ni ce qui vient après : le client reste seul devant une horloge, et c'est
     là qu'il appelle le restaurant pour demander si sa commande est passée.
     Les trois étapes répondent aux trois questions d'un coup.
     ====================================================================== */
  function blocEnvoyee(o) {
    const resto = o.restaurant || {};
    const etape = (etat, titre, detail, quand) =>
      '<div class="ev-e ' + etat + '">' +
        '<span class="p"></span>' +
        '<span class="tx"><b>' + U.esc(titre) + '</b>' +
          '<span>' + detail + '</span></span>' +
        (quand ? '<span class="h">' + U.esc(quand) + '</span>' : '') +
      '</div>';

    return '<div class="card card-p ev">' +
      '<div class="ev-haut">' +
        '<span class="ev-ic">' + UI.icon('check-circle', 30) + '</span>' +
        '<div class="grow"><div class="h1">Commande envoyée</div>' +
          '<div class="sub">' + U.esc(resto.name || 'Le restaurant') +
            ' a reçu votre commande.</div></div>' +
      '</div>' +

      /* Le compte à rebours de la base, tel quel : c'est lui qui garantit
         qu'une commande sans réponse ne reste pas en attente toute la soirée. */
      (o.respond_deadline
        ? Cmp.countdown(o.respond_deadline, 'Il lui reste', 60)
        : '') +

      '<div class="ev-steps">' +
        etape('fait', 'Envoyée au restaurant',
              U.esc(resto.name || '') +
              (resto.address ? ' · ' + U.esc(resto.address) : ''),
              U.time(o.created_at)) +
        etape('ici', 'Acceptation en cours',
              'Réponse habituelle : ' +
              U.respondMinutes(Store.settings) + ' min') +
        etape('', 'Préparation, puis livreur',
              'Le livreur le plus proche est prévenu dès l’acceptation') +
      '</div>' +

      '<div class="ev-pied">' +
        '<div class="l">' +
          '<b>' + (o.items ? o.items.length : 0) + ' article' +
            ((o.items && o.items.length > 1) ? 's' : '') + ' · espèces</b>' +
          '<span>' + U.esc(o.address_street || '') +
            (o.address_details ? ' — ' + U.esc(o.address_details) : '') + '</span>' +
        '</div>' +
        '<b class="price">' + U.money(o.total) + '</b>' +
      '</div>' +
    '</div>';
  }

  /* ======================================================================
     RECHERCHE D'UN LIVREUR — les deux minutes qui décident de tout
     ----------------------------------------------------------------------
     Entre « commande enregistrée » et « livreur trouvé », le client était
     devant un bandeau immobile qui disait « Prête ». Prête à quoi ? Il ne
     savait ni qu'on cherchait quelqu'un, ni combien de temps ça prendrait,
     ni que la course passe d'un livreur au suivant toutes les trente
     secondes. C'est le moment où il rappelle, ou annule.

     Alors on montre le mécanisme tel qu'il est : un compte à rebours de deux
     minutes, et le nombre de livreurs déjà sollicités. Le chronomètre n'est
     pas un délai d'expiration — la recherche continue après — c'est la
     promesse d'une réponse claire au bout de deux minutes.

     Effet de bord utile : l'horloge de app.js relance expire_orders tant
     qu'un compte à rebours est à l'écran. Le client qui attend fait donc
     lui-même avancer la file, même si le planificateur du serveur dort.
     ====================================================================== */
  function blocRecherche(o) {
    const depart = o.search_since || o.created_at;
    const limite = new Date(new Date(depart).getTime() + 120000).toISOString();
    const reste  = U.secondsLeft(limite);
    // declined_by : les livreurs qui ont laissé passer leur tour. Le client n'a
    // pas à savoir QUI, seulement que la plateforme ne l'a pas oublié.
    const passes = (o.declined_by || []).length;

    return '<div class="card card-p ev">' +
      '<div class="ev-haut">' +
        '<span class="ev-ic">' + UI.icon('scooter', 30) + '</span>' +
        '<div class="grow"><div class="h1">Recherche d’un livreur</div>' +
          '<div class="sub">Votre commande est prête à partir. Nous prévenons ' +
            'le livreur le plus proche du restaurant.</div></div>' +
      '</div>' +

      (reste > 0
        ? Cmp.countdown(limite, 'Réponse dans moins de', 30)
        : '<div class="banner banner-warn" style="margin:12px 0">' +
            '<div class="grow"><b>La recherche continue.</b> Aucun livreur n’a ' +
            'encore accepté. Nous continuons d’en solliciter d’autres — vous ' +
            'pouvez aussi annuler sans frais.</div></div>') +

      '<div class="ev-steps">' +
        etapeR('fait', 'Commande enregistrée', 'Payable en espèces à la livraison',
               U.time(o.created_at)) +
        etapeR('ici', 'Le livreur le plus proche est prévenu',
               'Il a 30 secondes pour accepter' +
               (passes ? ' · ' + passes + ' livreur' + (passes > 1 ? 's' : '') +
                         ' ' + (passes > 1 ? 'ont' : 'a') + ' passé son tour' : '')) +
        etapeR('', 'Sinon, au suivant',
               'La course passe au livreur suivant, du plus proche au plus ' +
               'loin, jusqu’à ce qu’un livreur accepte') +
      '</div>' +

      '<div class="ev-pied">' +
        '<div class="l"><b>' + U.esc((o.restaurant && o.restaurant.name) || '') + '</b>' +
          '<span>' + U.esc(o.address_street || '') +
            (o.address_details ? ' — ' + U.esc(o.address_details) : '') + '</span>' +
        '</div>' +
        '<b class="price">' + U.money(o.total) + '</b>' +
      '</div>' +
    '</div>';
  }

  /* Même rangée que blocEnvoyee : les deux écrans se suivent dans le temps,
     ils doivent se ressembler à l'œil. */
  function etapeR(etat, titre, detail, quand) {
    return '<div class="ev-e ' + etat + '">' +
      '<span class="p"></span>' +
      '<span class="tx"><b>' + U.esc(titre) + '</b>' +
        '<span>' + detail + '</span></span>' +
      (quand ? '<span class="h">' + U.esc(quand) + '</span>' : '') +
    '</div>';
  }

  /* ======================================================================
     NOTER LA LIVRAISON — maquette 3c
     ----------------------------------------------------------------------
     Deux notes séparées, et c'est tout l'intérêt de cet écran : un repas
     froid n'est pas la faute du scooter, et un livreur charmant ne rattrape
     pas une pizza ratée. Une note unique mélangeait les deux et ne servait à
     personne — ni au restaurant, qui ne savait pas ce qu'on lui reprochait,
     ni au livreur, puni pour une cuisine qu'il n'a pas faite.

     « Plus tard » est aussi visible que « Envoyer » : un écran de notation
     dont on ne peut pas sortir se fait noter au hasard pour être fermé, et la
     moyenne ne veut plus rien dire.
     ====================================================================== */
  const COMPLIMENTS = ['Rapide', 'Aimable', 'Repas encore chaud'];

  Router.add('/avis/:id', async function (params, query, view) {
    const o = await API.safe(() => API.order(params.id), null);
    if (!o) return Router.go('/orders', true);
    if (o.status !== 'delivered') return Router.go('/order/' + params.id, true);

    /* Un avis déjà donné n'est pas un obstacle : on le recharge pour que le
       client corrige au lieu de repartir de zéro. */
    const deja = await API.safe(() => API.myReview(params.id), null);
    let nResto = (deja && deja.resto_note) || 0;
    let nLivreur = (deja && deja.driver_note) || 0;
    let choisis = (deja && deja.compliments) || [];

    const minutes = (o.delivered_at && o.created_at)
      ? Math.max(1, Math.round((new Date(o.delivered_at) - new Date(o.created_at)) / 60000))
      : null;

    const etoiles = (n, quoi) =>
      '<div class="av-et" data-et="' + quoi + '">' +
        [1, 2, 3, 4, 5].map(i =>
          '<button type="button" class="' + (i <= n ? 'on' : '') + '" data-n="' + i +
            '" aria-label="' + i + ' sur 5">' +
            /* L'étoile est pleine, pas au trait : une étoile en contour se lit
               mal à trente pixels, et c'est le remplissage qui dit la note. */
            '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">' +
            '<path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5L2.5 9.5l6.6-.9z"/>' +
            '</svg></button>').join('') +
      '</div>';

    function paint() {
      const liv = o.driver || {};
      const f = (liv.driver) || {};
      view.innerHTML = '<div class="wrap-sm page av-page">' +
        '<div class="av-head">' +
          '<div class="grow">' +
            '<div class="k">' + (minutes ? 'Livrée en ' + minutes + ' min' : 'Livrée') + '</div>' +
            '<div class="h1">Comment s’est passée la livraison ?</div>' +
          '</div>' +
          '<a class="av-plus" href="#/orders">Plus tard</a>' +
        '</div>' +
        '<p class="av-note">Deux taps. La note du livreur reste privée ; celle du ' +
          'restaurant s’affiche sur sa fiche.</p>' +

        (liv.full_name
          ? '<div class="card card-p av-bloc">' +
              '<div class="av-qui">' +
                '<span class="lv-ini"' +
                  (liv.avatar_url ? ' style="background-image:url(' + U.escUrl(liv.avatar_url) + ')"' : '') +
                  '>' + (liv.avatar_url ? '' : U.esc(U.initials(liv.full_name))) + '</span>' +
                '<div class="grow"><b>' + U.esc(liv.full_name) + '</b>' +
                  '<span class="tiny">Votre livreur' +
                  (f.vehicle ? ' · ' + U.esc({ moto: 'Scooter', voiture: 'Voiture', velo: 'Vélo' }[f.vehicle] || 'Véhicule') : '') +
                  '</span></div>' +
              '</div>' +
              etoiles(nLivreur, 'livreur') +
              '<div class="av-comps">' +
                COMPLIMENTS.map(c => '<button type="button" class="av-comp' +
                  (choisis.indexOf(c) >= 0 ? ' on' : '') + '" data-comp="' + U.esc(c) + '">' +
                  U.esc(c) + '</button>').join('') +
              '</div>' +
            '</div>'
          : '') +

        '<div class="card card-p av-bloc">' +
          '<div class="av-qui">' +
            '<span class="av-logo"' +
              (o.restaurant && o.restaurant.logo_url
                ? ' style="background-image:url(' + U.escUrl(o.restaurant.logo_url) + ')"' : '') +
              '>' + (o.restaurant && o.restaurant.logo_url ? '' : UI.icon('dome', 22)) + '</span>' +
            '<div class="grow"><b>' + U.esc((o.restaurant && o.restaurant.name) || 'Restaurant') + '</b>' +
              '<span class="tiny">' + (o.items ? o.items.length : 0) + ' article' +
              ((o.items && o.items.length > 1) ? 's' : '') + ' · ' +
              U.esc(U.money(o.total)) + '</span></div>' +
          '</div>' +
          etoiles(nResto, 'resto') +
          '<textarea class="input av-mot" id="avMot" rows="2" ' +
            'placeholder="Un mot sur les plats ? (facultatif)">' +
            U.esc((deja && deja.comment) || '') + '</textarea>' +
        '</div>' +

        '<button class="btn btn-primary btn-block btn-lg av-cta" id="avEnvoi">' +
          'Envoyer mon avis</button>' +
        '<button class="btn btn-ghost btn-block" id="avRepeat" style="margin-top:10px">' +
          'Recommander la même chose</button>' +
      '</div>';

      view.querySelectorAll('.av-et button').forEach(b => b.onclick = () => {
        const quoi = b.closest('[data-et]').dataset.et;
        const n = +b.dataset.n;
        /* Retoucher la même étoile efface la note : sans ça, un tap malheureux
           ne se reprend pas et on est forcé de noter. */
        if (quoi === 'resto') nResto = (nResto === n ? 0 : n);
        else nLivreur = (nLivreur === n ? 0 : n);
        paint();
      });

      view.querySelectorAll('[data-comp]').forEach(b => b.onclick = () => {
        const c = b.dataset.comp;
        const i = choisis.indexOf(c);
        if (i >= 0) choisis.splice(i, 1); else choisis.push(c);
        paint();
      });

      view.querySelector('#avEnvoi').onclick = async function () {
        const mot = view.querySelector('#avMot').value.trim();
        if (!nResto && !nLivreur && !mot && !choisis.length)
          return UI.err('Rien à envoyer', 'Touchez au moins une étoile.');
        UI.busy(this, true, 'Envoi…');
        const r = await API.safe(() => API.submitReview(o.id, {
          resto: nResto || null, livreur: nLivreur || null,
          compliments: choisis, comment: mot
        }), null);
        if (!r) return UI.busy(this, false);
        UI.ok('Merci pour votre avis !', 'Il aide le prochain client.');
        Router.go('/orders');
      };

      /* « Recommander la même chose » : le panier de la commande, tel quel.
         C'est le geste le plus fréquent après un bon repas, et il n'existait
         nulle part — il fallait retrouver le restaurant et tout recomposer. */
      view.querySelector('#avRepeat').onclick = () => {
        if (!o.restaurant) return Router.go('/restaurants');
        Router.go('/resto/' + o.restaurant.id);
      };
    }

    paint();
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
