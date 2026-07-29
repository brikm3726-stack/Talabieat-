/* ==========================================================================
   ESPACE LIVREUR — tableau de bord, courses disponibles, livraison en cours
   ========================================================================== */
(function (w) {
  'use strict';

  const GUARD = { auth: true, roles: ['driver'] };

  const STATUS_LABEL = { offline: 'Indisponible', available: 'Disponible', busy: 'En livraison' };

  /* U.VEHICLES ne porte que le libellé : le pictogramme est choisi ici. */
  const VEHICLE_ICON = { moto: 'scooter', voiture: 'package', velo: 'bike', autre: 'package' };

  /** En-tête de page : pastille orange, titre, sous-titre. */
  function drvHead(icone, titre, sous) {
    return '<div class="drv-title">' +
      '<span class="ic">' + icone + '</span>' +
      '<div><div class="h1">' + U.esc(titre) + '</div>' +
        '<div class="sub">' + U.esc(sous) + '</div></div>' +
    '</div>';
  }

  /* Vignette de statistique : pastille, intitulé, valeur, légende. */
  function drvStat(icone, label, valeur, legende) {
    return '<div class="card drv-stat">' +
      '<span class="ic">' + icone + '</span>' +
      '<div class="grow"><div class="k">' + U.esc(label) + '</div>' +
        '<div class="v">' + valeur + '</div>' +
        '<div class="s">' + U.esc(legende) + '</div></div>' +
    '</div>';
  }

  function validationBanner(d) {
    if (!d) return '';
    if (d.validation_status === 'pending')
      return '<div class="banner banner-warn" style="margin-bottom:16px">⏳ Votre compte livreur est en attente de validation. ' +
             'Complétez votre profil : <b>il sera vérifié sous 24 h</b>. Vous serez prévenu dès la validation.</div>';
    if (d.validation_status === 'rejected')
      return '<div class="banner banner-danger" style="margin-bottom:16px">⛔ Compte refusé' +
             (d.reject_reason ? ' : ' + U.esc(d.reject_reason) : '') + '. Contactez le support.</div>';
    return '';
  }

  /* ======================================================================
     TABLEAU DE BORD LIVREUR
     ====================================================================== */
  Router.add('/d', async function (params, query, view) {
    view.innerHTML = '<div class="wrap page"><div class="skel" style="height:220px"></div></div>';

    async function load() {
      const d = await API.safe(() => API.getDriver(), null);
      const mine = await API.safe(() => API.orders({ scope: 'driver' }), []);
      const active = mine.filter(o => ['driver_assigned', 'delivering'].indexOf(o.status) >= 0);
      const done = mine.filter(o => o.status === 'delivered');
      const available = d && d.validation_status === 'approved'
        ? await API.safe(() => API.orders({ scope: 'available' }), []) : [];

      const todayDone = done.filter(o => sameDay(o.delivered_at || o.created_at, new Date()));
      const approved = d && d.validation_status === 'approved';

      const statut = (d && d.status) || 'offline';

      view.innerHTML = '<div class="driver-page"><div class="wrap page">' +
        validationBanner(d) +

        /* --- en-tête : avatar, salutation, quartier et véhicule --- */
        '<div class="drv-head">' +
          '<span class="drv-ava' + (statut === 'available' ? ' online' : '') + '">' +
            UI.avatar(Store.profile.full_name, Store.profile.avatar_url, 62) + '</span>' +
          '<div class="grow">' +
            '<div class="h1">Bonjour ' + U.esc((Store.profile.full_name || '').split(' ')[0]) + ' 👋</div>' +
            '<div class="sub drv-meta">' + UI.pin(15) + ' ' +
              U.esc((d && d.zone && d.zone.name) || 'Zone non définie') +
              '<span class="dot">•</span>' + UI.icon(VEHICLE_ICON[(d && d.vehicle) || 'moto'], 15) + ' ' + U.esc(U.VEHICLES[(d && d.vehicle) || 'moto']) + '</div>' +
          '</div>' +
        '</div>' +

        /* --- disponibilité --- */
        '<div class="card card-p drv-status ' + statut + '">' +
          '<div class="row-between">' +
            '<div class="row" style="gap:14px">' +
              '<span class="drv-badge">' + UI.icon(statut === 'available' ? 'check' : 'lock', 22) + '</span>' +
              '<div><div class="tiny">Mon statut</div>' +
                '<div class="h2 drv-state">' + U.esc(STATUS_LABEL[statut]) + '</div></div>' +
            '</div>' +
            '<div class="row" style="gap:12px">' +
              '<span class="drv-pill">' + (statut === 'available' ? 'En ligne' : 'Hors ligne') + ' ●</span>' +
              '<label class="switch" title="Disponibilité">' +
                '<input type="checkbox" id="availSw" ' + (statut === 'available' ? 'checked' : '') +
                (approved && statut !== 'busy' ? '' : ' disabled') + '>' +
                '<span class="track"><span class="knob"></span></span></label>' +
            '</div>' +
          '</div>' +
          (!approved ? '<div class="tiny" style="margin-top:10px">Disponible après validation de votre compte.</div>' :
            statut === 'busy' ? '<div class="tiny" style="margin-top:10px">Terminez votre livraison en cours pour redevenir disponible.</div>' : '') +
        '</div>' +

        '<div class="grid grid-stats drv-stats" style="margin-top:14px">' +
          drvStat('📅', 'Courses aujourd’hui', todayDone.length, 'Aujourd’hui') +
          drvStat('📦', 'Total livraisons', (d && d.total_deliveries) || 0, 'Livraisons effectuées') +
          drvStat('💰', 'Gains cumulés', U.money((d && d.total_earnings) || 0), 'Total des gains') +
          drvStat('⭐', 'Note', ((d && +d.rating) || 5).toFixed(1), 'Excellente note') +
        '</div>' +

        (active.length
          ? '<div class="card card-p drv-panel" style="margin-top:16px">' +
              '<div class="row-between" style="margin-bottom:12px">' +
                '<div class="h2">Livraison en cours</div>' +
                '<a class="link" href="#/d/active">Détails →</a></div>' +
              '<div class="stack">' + active.map(o => deliveryCard(o, true)).join('') + '</div>' +
            '</div>'
          : '') +

        '<div class="card card-p drv-panel" style="margin-top:16px">' +
          '<div class="row-between" style="margin-bottom:12px">' +
            '<div class="h2">Courses disponibles</div>' +
            '<a class="link" href="#/d/available">Tout voir →</a></div>' +
          (available.length
            ? '<div class="stack">' + available.slice(0, 3).map(o => deliveryCard(o)).join('') + '</div>'
            : '<div class="empty-scene compact">' +
                '<img class="scene-art" src="assets/img/bg/livreur-vide.png" alt="" aria-hidden="true">' +
                '<div class="h2 scene-title">Aucune course disponible pour le moment</div>' +
                '<p class="scene-sub">' +
                  (approved ? 'Restez disponible, les nouvelles courses de votre zone apparaîtront ici.'
                            : 'Votre compte doit être validé pour recevoir des courses.') + '</p>' +
                (approved ? '<div class="scene-cta">' +
                  '<button class="btn btn-primary btn-lg" id="refresh">⟳ Actualiser les courses</button></div>' : '') +
              '</div>') +
        '</div>' +
      '</div></div>';

      bindDelivery(view, load);

      const rf = view.querySelector('#refresh');
      if (rf) rf.onclick = function () { UI.busy(this, true, 'Recherche…'); load(); };

      const sw = view.querySelector('#availSw');
      if (sw && !sw.disabled) sw.onchange = async () => {
        const r = await API.safe(() => API.saveDriver({ status: sw.checked ? 'available' : 'offline' }), null);
        if (r) UI.ok(r.status === 'available' ? 'Vous êtes disponible' : 'Vous êtes indisponible');
        load();
      };
    }

    await load();
    const off = API.onChange(t => { if (t === 'orders' || t === 'drivers' || t === '*') load(); });
    const timer = setInterval(load, 25000);
    return () => { off(); clearInterval(timer); };
  }, GUARD);

  /* ======================================================================
     COURSES DISPONIBLES
     ====================================================================== */
  Router.add('/d/available', async function (params, query, view) {
    view.innerHTML = '<div class="driver-page"><div class="wrap page">' +
      '<div class="card card-p drv-panel">' +
        drvHead('🛍️', 'Courses disponibles', 'Commandes prêtes dans votre zone') +
        '<div id="list"><div class="skel" style="height:150px"></div></div>' +
      '</div></div></div>';

    const list = view.querySelector('#list');

    async function load() {
      const d = await API.safe(() => API.getDriver(), null);
      if (!d || d.validation_status !== 'approved') {
        list.innerHTML = validationBanner(d) + UI.empty('🔒', 'Compte non validé',
          'Vous pourrez accepter des courses dès la validation de votre profil.',
          '<a class="btn btn-primary" href="#/d/profile">Compléter mon profil</a>');
        return;
      }
      if (d.status === 'busy') {
        list.innerHTML = UI.empty('🛵', 'Livraison en cours',
          'Terminez votre livraison actuelle avant d’en accepter une nouvelle.',
          '<a class="btn btn-primary" href="#/d/active">Voir ma livraison</a>');
        return;
      }

      const rows = await API.safe(() => API.orders({ scope: 'available' }), []);
      list.innerHTML = rows.length
        ? '<div class="stack">' + rows.map(o => deliveryCard(o)).join('') + '</div>'
        : '<div class="empty-scene compact">' +
            '<img class="scene-art" src="assets/img/bg/courses-vide.png" alt="" aria-hidden="true">' +
            '<div class="drv-chip">📦 Aucune course disponible</div>' +
            '<p class="scene-sub">Restez disponible : dès qu’un restaurant de votre zone ' +
              'signale une commande prête, <b>elle apparaît ici</b>.</p>' +
            '<div class="drv-note">' +
              '<span class="art">🔔</span>' +
              '<span class="grow"><b>Restez disponible</b>' +
                '<span class="tiny">Activez les notifications pour ne manquer aucune course.</span></span>' +
              '<label class="switch"><input type="checkbox" id="soundOn"' +
                (w.Sound && Sound.muted ? '' : ' checked') + '>' +
                '<span class="track"><span class="knob"></span></span></label>' +
            '</div>' +
          '</div>';
      bindDelivery(view, load);

      const so = view.querySelector('#soundOn');
      if (so) so.onchange = () => {
        if (!w.Sound) return;
        Sound.muted = !so.checked;
        UI.ok(Sound.muted ? 'Sonnerie coupée' : 'Sonnerie réactivée');
        Shell.renderTop();
      };
    }

    await load();
    const off = API.onChange(t => { if (t === 'orders' || t === '*') load(); });
    const timer = setInterval(load, 15000);
    return () => { off(); clearInterval(timer); };
  }, GUARD);

  /* ======================================================================
     LIVRAISON EN COURS
     ====================================================================== */
  Router.add('/d/active', async function (params, query, view) {
    view.innerHTML = '<div class="wrap-sm page"><div class="skel" style="height:240px"></div></div>';

    async function load() {
      const mine = await API.safe(() => API.orders({ scope: 'driver' }), []);
      const active = mine.filter(o => ['driver_assigned', 'delivering'].indexOf(o.status) >= 0);

      view.innerHTML = '<div class="driver-page"><div class="wrap-sm page">' +
        '<div class="card card-p drv-panel">' +
          drvHead('🛵', 'Ma livraison', 'Suivez et validez chaque étape') +
          (active.length ? '<div id="shareBox" style="margin-bottom:14px"></div>' : '') +
          (active.length
            ? '<div class="stack">' + active.map(o => deliveryCard(o, true)).join('') + '</div>'
            : '<div class="empty-scene compact">' +
                '<img class="scene-art" src="assets/img/bg/livraison-vide.png" alt="" aria-hidden="true">' +
                '<div class="h2 scene-title">Aucune livraison en cours</div>' +
                '<p class="scene-sub">Acceptez une course pour la voir apparaître ici.</p>' +
                '<div class="scene-cta">' +
                  '<a class="btn btn-primary btn-lg" href="#/d/available">Voir les courses →</a></div>' +
              '</div>') +
        '</div>' +
      '</div></div>';
      bindDelivery(view, load);
      if (active.length) paintShare();
      LiveTrack.sync();
    }

    /* ------------------------------- bandeau de partage de position */
    function paintShare() {
      const box = view.querySelector('#shareBox');
      if (!box) return;
      const st = LiveTrack.state;

      box.innerHTML = st.error
        ? '<div class="banner banner-danger"><div class="grow">📡 ' + U.esc(st.error) +
          '</div><button class="btn btn-danger btn-sm" id="shareNow">Réessayer</button></div>'
        : st.running
          ? '<div class="banner banner-ok"><div class="grow">📡 <b>Position partagée</b> — le client suit ' +
            'votre progression en direct.' +
            (st.lastSent ? ' <span style="opacity:.75">Dernier envoi ' + U.ago(st.lastSent) + '.</span>' : '') +
            '</div></div>'
          : '<div class="banner banner-warn"><div class="grow">📡 Partagez votre position pour que le client ' +
            'vous suive.</div><button class="btn btn-primary btn-sm" id="shareNow">Activer</button></div>';

      const b = box.querySelector('#shareNow');
      if (b) b.onclick = async function () {
        UI.busy(this, true);
        try {
          await LiveTrack.pushOnce();
          LiveTrack.start();
          UI.ok('Position partagée');
        } catch (e) { UI.err(e.message); }
        paintShare();
      };
    }

    await load();
    const off = API.onChange(t => { if (t === 'orders' || t === '*') load(); });
    const offTrack = LiveTrack.onChange(paintShare);
    return () => { off(); offTrack(); };
  }, GUARD);

  /* ======================================================================
     HISTORIQUE
     ====================================================================== */
  Router.add('/d/history', async function (params, query, view) {
    const mine = await API.safe(() => API.orders({ scope: 'driver' }), []);
    const done = mine.filter(o => o.status === 'delivered');
    const total = done.reduce((s, o) => s + (o.driver_earning || 0), 0);

    view.innerHTML = '<div class="driver-page"><div class="wrap-sm page">' +
      drvHead('📈', 'Historique', done.length + ' livraison(s) effectuée(s)') +

      '<div class="drv-earn">' +
        '<div class="grow"><div class="k">GAINS CUMULÉS</div>' +
          '<div class="v">' + U.money(total) + '</div></div>' +
        '<span class="art">💰</span>' +
      '</div>' +

      (done.length
        ? '<div class="stack" style="margin-top:16px">' + done.map(o =>
            '<div class="card card-p drv-hist">' +
              '<div class="row-between">' +
                '<span class="ocode">#' + U.esc(o.code) + '</span>' +
                '<span class="tiny">' + U.dt(o.delivered_at || o.created_at) + '</span></div>' +
              '<div class="row-between" style="margin-top:10px;gap:12px">' +
                '<div class="grow"><b>' + U.esc(o.restaurant ? o.restaurant.name : '') + '</b>' +
                  '<div class="tiny">' + UI.pin(13) + ' ' + U.esc(o.address_street) + '</div></div>' +
                '<span class="drv-go">' + UI.icon('chevron', 17) + '</span></div>' +
              '<div class="divider"></div>' +
              '<div class="oline"><span class="l">Votre gain</span>' +
                '<b class="price">' + U.money(o.driver_earning) + '</b></div>' +
            '</div>').join('') + '</div>'
        : '<div class="card card-p drv-panel" style="margin-top:16px">' +
            '<div class="empty-scene compact">' +
              '<img class="scene-art" src="assets/img/bg/livraison-vide.png" alt="" aria-hidden="true">' +
              '<div class="h2 scene-title">Aucune livraison</div>' +
              '<p class="scene-sub">Vos livraisons terminées s’afficheront ici.</p>' +
              '<div class="scene-cta">' +
                '<a class="btn btn-primary btn-lg" href="#/d/available">Voir les courses →</a></div>' +
            '</div></div>') +
    '</div></div>';
  }, GUARD);

  /* ======================================================================
     PROFIL LIVREUR
     ====================================================================== */
  Router.add('/d/profile', async function (params, query, view) {
    const d = await API.safe(() => API.getDriver(), null) || {};
    const p = Store.profile;

    view.innerHTML = '<div class="wrap-sm page">' +
      Cmp.pageHead('Mon profil livreur', 'Ces informations sont vérifiées par l’administrateur') +
      validationBanner(d) +

      '<form id="df" class="card card-p stack" novalidate>' +
        '<div class="field"><label>Nom complet *</label>' +
          '<input class="input" name="full_name" value="' + U.esc(p.full_name || '') + '" required></div>' +
        '<div class="field"><label>Téléphone *</label>' +
          '<input class="input" name="phone" inputmode="tel" placeholder="0770 12 34 56" value="' + U.esc(p.phone || '') + '" required></div>' +

        Cmp.zoneSelect('zone_id', d.zone_id || p.zone_id, 'Quartier de livraison *', true) +

        '<div class="field"><label>Moyen de transport *</label>' +
          '<div class="stack" style="gap:8px" id="veh">' +
            Object.keys(U.VEHICLES).map(k =>
              '<div class="role-card ' + ((d.vehicle || 'moto') === k ? 'on' : '') + '" data-v="' + k + '">' +
                '<div class="ic">' + UI.icon(VEHICLE_ICON[k] || 'package', 22) + '</div>' +
                '<div class="grow"><b>' + U.esc(U.VEHICLES[k]) + '</b></div>' +
                '<div data-check style="color:var(--brand);font-weight:800">' +
                  ((d.vehicle || 'moto') === k ? '✓' : '') + '</div></div>').join('') +
          '</div></div>' +

        '<div class="field"><label>Plaque d’immatriculation <span class="tiny">(facultatif)</span></label>' +
          '<input class="input" name="plate" placeholder="Ex : 16-1234-118" value="' + U.esc(d.plate || '') + '"></div>' +

        UI.imageField('id_card_url', d.id_card_url, 'Pièce d’identité (photo)') +

        '<button class="btn btn-primary btn-block btn-lg" type="submit">Enregistrer</button>' +
      '</form>' +

      '<div class="card card-p" style="margin-top:14px">' +
        '<div class="h3" style="margin-bottom:10px">Statistiques</div>' +
        '<div class="oline"><span class="l">Livraisons effectuées</span><b>' + (d.total_deliveries || 0) + '</b></div>' +
        '<div class="oline"><span class="l">Gains cumulés</span><b>' + U.money(d.total_earnings || 0) + '</b></div>' +
        '<div class="oline"><span class="l">Note moyenne</span><b>' + ((+d.rating) || 5).toFixed(1) + ' ⭐</b></div>' +
        '<div class="oline"><span class="l">Statut du compte</span>' +
          '<span class="tag ' + (d.validation_status === 'approved' ? 'tag-ok' :
            d.validation_status === 'rejected' ? 'tag-danger' : 'tag-warn') + '">' +
            (d.validation_status === 'approved' ? 'Validé' : d.validation_status === 'rejected' ? 'Refusé' : 'En attente') +
          '</span></div>' +
      '</div></div>';

    UI.bindImageFields(view);

    let vehicle = d.vehicle || 'moto';
    view.querySelectorAll('[data-v]').forEach(el => el.onclick = () => {
      vehicle = el.dataset.v;
      view.querySelectorAll('[data-v]').forEach(x => {
        x.classList.toggle('on', x === el);
        x.querySelector('[data-check]').textContent = x === el ? '✓' : '';
      });
    });

    view.querySelector('#df').onsubmit = async function (e) {
      e.preventDefault();
      const btn = this.querySelector('[type=submit]');
      const f = UI.formData(this);
      if (!f.full_name || f.full_name.length < 3) return UI.err('Indiquez votre nom complet');
      if (!U.isPhoneDZ(f.phone)) return UI.err('Numéro invalide', 'Format : 05 / 06 / 07 xx xx xx xx');
      if (!f.zone_id) return UI.err('Choisissez votre zone de livraison');

      UI.busy(btn, true, 'Enregistrement…');
      try {
        await API.updateProfile({ full_name: f.full_name, phone: f.phone, zone_id: f.zone_id });
        await API.saveDriver({ vehicle: vehicle, plate: f.plate, zone_id: f.zone_id, id_card_url: f.id_card_url });
        await Store.refreshProfile();
        UI.ok('Profil enregistré');
        Router.go('/d');
      } catch (err) { UI.busy(btn, false); UI.err(err.message); }
    };
  }, GUARD);

  /* ======================================================================
     CARTE DE COURSE
     ====================================================================== */
  function deliveryCard(o, isMine) {
    const dist = U.distanceOf(o);
    const next = { driver_assigned: ['delivering', '🚀 J’ai récupéré la commande'], delivering: ['delivered', '✅ Commande livrée'] }[o.status];

    // itinéraires Google Maps — l'app mobile s'ouvre directement si installée
    const navResto = U.hasCoords(o.restaurant)
      ? '<a class="btn btn-dark btn-sm" href="' + U.gmapsRoute(o.restaurant.lat, o.restaurant.lng) +
        '" target="_blank" rel="noopener">🗺️ Y aller</a>' : '';
    const navClient = U.hasCoords({ lat: o.address_lat, lng: o.address_lng })
      ? '<a class="btn btn-dark btn-sm" href="' + U.gmapsRoute(o.address_lat, o.address_lng) +
        '" target="_blank" rel="noopener">🗺️ Y aller</a>' : '';

    // course proposée à ce livreur : il a 30 s, ensuite elle part au suivant
    const proposee = !isMine && o.offer_deadline && U.secondsLeft(o.offer_deadline) > 0;

    return '<div class="order-card' + (proposee ? ' offerte' : '') + '">' +
      '<div class="row-between">' +
        '<div class="row" style="gap:9px"><span class="ocode">#' + U.esc(o.code) + '</span>' + UI.tag(o.status) + '</div>' +
        '<span class="tiny">' + U.ago(o.created_at) + '</span>' +
      '</div>' +

      (proposee
        ? Cmp.countdown(o.offer_deadline, 'Elle est pour vous —', 10)
        : (!isMine ? '<div class="cdown libre">' + UI.icon('users', 16) +
            '<span class="l">Ouverte à tous les livreurs</span></div>' : '')) +

      '<div class="divider"></div>' +

      '<div class="row" style="gap:11px;align-items:flex-start">' +
        '<div style="width:30px;height:30px;border-radius:10px;background:var(--brand-soft);display:grid;place-items:center;flex:none">🏪</div>' +
        '<div class="grow"><b style="font-size:14.5px">' + U.esc(o.restaurant ? o.restaurant.name : '') + '</b>' +
          '<div class="tiny">' + U.esc(o.restaurant ? o.restaurant.address : '') + '</div>' +
          (isMine && o.restaurant && o.restaurant.phone
            ? '<a class="tiny" style="color:var(--brand);font-weight:700" href="tel:' + U.esc(o.restaurant.phone) + '">📞 ' + U.esc(o.restaurant.phone) + '</a>' : '') +
        '</div>' + navResto + '</div>' +

      '<div class="row" style="gap:11px;align-items:flex-start;margin-top:11px">' +
        '<div style="width:30px;height:30px;border-radius:10px;background:var(--info-soft);display:grid;place-items:center;flex:none">🏠</div>' +
        '<div class="grow"><b style="font-size:14.5px">' +
          U.esc(isMine ? (o.client_name || (o.client && o.client.full_name) || 'Client') : 'Client') + '</b>' +
          '<div class="tiny">' + U.esc(o.address_street) + (o.address_details ? ' — ' + U.esc(o.address_details) : '') + '</div>' +
          '<div class="tiny">' + U.esc(o.zone ? o.zone.name : '') + '</div>' +
          (isMine ? '<a class="tiny" style="color:var(--brand);font-weight:700" href="tel:' + U.esc(o.client_phone) + '">📞 ' + U.esc(o.client_phone) + '</a>' : '') +
        '</div>' + navClient + '</div>' +

      (o.note ? '<div class="banner banner-info" style="margin-top:11px;font-size:12.5px">📝 ' + U.esc(o.note) + '</div>' : '') +

      '<div class="divider"></div>' +
      '<div class="oline"><span class="l">Distance ' + (dist.exact ? 'restaurant → client' : 'estimée') + '</span>' +
        '<b>' + (dist.exact ? '' : '~ ') + dist.km + ' km</b></div>' +
      '<div class="oline"><span class="l">Montant de la commande</span><b>' + U.money(o.total) + '</b></div>' +
      '<div class="oline"><span class="l">Frais de livraison</span><b>' + U.money(o.delivery_fee) + '</b></div>' +
      '<div class="oline" style="font-size:15px"><span class="l"><b>Votre gain</b></span>' +
        '<b class="price">' + U.money(o.driver_earning) + '</b></div>' +

      '<div class="row" style="gap:9px;margin-top:13px">' +
        (isMine
          ? (next ? '<button class="btn btn-primary grow" data-dact="' + next[0] + '" data-id="' + U.esc(o.id) + '">' + next[1] + '</button>' : '')
          : '<button class="btn btn-ghost btn-sm" data-skip="' + U.esc(o.id) + '">Passer</button>' +
            '<button class="btn btn-primary grow" data-claim="' + U.esc(o.id) + '">✅ Accepter la course</button>') +
      '</div>' +
    '</div>';
  }

  function bindDelivery(view, reload) {
    view.querySelectorAll('[data-claim]').forEach(b => b.onclick = async function () {
      if (w.Sound) Sound.stop('delivery');       // le livreur a répondu : la sonnerie n'a plus lieu d'être
      UI.busy(this, true, 'Attribution…');
      try {
        await API.claimOrder(this.dataset.claim);
        // la course lui est bien attribuée — deux livreurs peuvent viser la
        // même, et celui qui perd ne doit surtout pas entendre l'accusé
        if (w.Sound) Sound.play('claimed', 1);
        // on partage la position tout de suite : le client voit le livreur
        // dès la prise en charge, sans attendre le premier cycle automatique
        LiveTrack.pushOnce().catch(() => {});
        LiveTrack.start();
        UI.ok('Course acceptée !', 'Rendez-vous au restaurant');
        Router.go('/d/active');
      } catch (e) { UI.busy(this, false); UI.err(e.message); reload(); }
    });

    view.querySelectorAll('[data-skip]').forEach(b => b.onclick = async function () {
      if (w.Sound) Sound.stop('delivery');       // « Passer » vaut réponse, au même titre qu'accepter
      const card = this.closest('.order-card');
      card.style.transition = '.2s'; card.style.opacity = '0';
      setTimeout(() => card.remove(), 200);
      // passer n'est plus un simple masquage local : la course part au livreur
      // suivant tout de suite, sans attendre la fin des 30 secondes
      await API.safe(() => API.declineOrder(this.dataset.skip), null);
    });

    view.querySelectorAll('[data-dact]').forEach(b => b.onclick = async function () {
      const status = this.dataset.dact;
      if (status === 'delivered' &&
          !(await UI.confirm('Confirmer la livraison', 'Avez-vous bien remis la commande et encaissé le paiement ?', 'Oui, livrée')))
        return;
      UI.busy(this, true);
      const r = await API.safe(() => API.updateOrderStatus(this.dataset.id, status), null);
      // accusé sonore au moment où la course est réellement enregistrée comme
      // livrée : jouer avant l'appel ferait sonner un échec
      if (r && status === 'delivered' && w.Sound) Sound.play('delivered', 1);
      if (r) UI.ok(status === 'delivered' ? 'Livraison terminée 🎉' : 'Statut mis à jour');
      if (status === 'delivering') LiveTrack.pushOnce().catch(() => {});
      LiveTrack.sync();   // s'arrête tout seul une fois la course livrée
      reload();
    });
  }

  function sameDay(a, b) {
    const x = new Date(a), y = new Date(b);
    return x.getDate() === y.getDate() && x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear();
  }
})(window);
