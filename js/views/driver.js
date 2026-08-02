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

    /* ====================================================================
       CARTE EN DIRECT — conservée d'un rafraîchissement à l'autre
       --------------------------------------------------------------------
       Le tableau de bord se redessine toutes les 25 secondes. Reconstruire
       une carte Google à chaque passage, ce serait un « chargement de carte »
       facturé toutes les 25 secondes et par livreur — plus un clignotement à
       l'écran. On fabrique donc ce bloc UNE fois, hors du innerHTML, et on le
       rebranche après chaque rendu : la carte survit, seuls les repères
       bougent.
       ==================================================================== */
    const boite = document.createElement('div');
    boite.className = 'card card-p drv-panel drv-mapcard';
    boite.innerHTML =
      '<div class="h2" id="drvMapTitle" style="margin-bottom:10px">📍 Ma position</div>' +
      '<div class="drv-mapwrap">' +
        '<div class="drv-map" id="drvMap"></div>' +
        /* Le recentrage quitte l'en-tête pour ce petit repère posé sur la
           carte : il ne sert qu'à réparer un déplacement du doigt, il n'a
           pas à occuper la place du bouton principal. */
        '<button type="button" class="drv-mapfit" id="drvMapFit" title="Recentrer">🎯</button>' +
      '</div>' +
      '<div id="drvMapInfo"></div>' +
      '<button class="btn btn-primary btn-block btn-lg drv-search" id="drvSearch">' +
        '🔎 Chercher une course</button>';

    const live = MapPicker.live(boite.querySelector('#drvMap'), {});
    boite.querySelector('#drvMapFit').onclick = () => live && live.recenter();

    const titre = boite.querySelector('#drvMapTitle');
    const infos = boite.querySelector('#drvMapInfo');

    /* Dernier état connu, pour redessiner la carte à chaque nouvelle position
       sans rappeler le serveur. */
    let dernierD = null, derniereCourse = null;

    /* ====================================================================
       CHERCHER UNE COURSE — 30 secondes de recherche active
       --------------------------------------------------------------------
       Le serveur propose déjà les courses tout seul. Ce bouton sert à autre
       chose : il donne au livreur un geste à faire au lieu d'attendre devant
       un écran vide. Ce qu'il déclenche vraiment, dans l'ordre :

         1. envoi immédiat de la position — le serveur choisit le plus proche
            du restaurant, autant qu'il sache où vous êtes AVANT de choisir ;
         2. pendant 30 secondes, un tour d'attribution est relancé toutes les
            3 secondes, et on regarde ce qui devient visible ;
         3. dès qu'une course apparaît, la recherche s'arrête et sonne.

       Le bouton reste bloqué pendant les 30 secondes : sans cela, un livreur
       nerveux relancerait un tour par seconde, ce qui ne ferait apparaître
       aucune commande de plus et chargerait la base pour rien.
       ==================================================================== */
    const btnCherche = boite.querySelector('#drvSearch');
    let recherche = null;      // { restant, minuteur, occupe } pendant la recherche

    function libelleBouton() {
      if (!recherche) {
        btnCherche.disabled = false;
        btnCherche.innerHTML = '🔎 Chercher une course';
        return;
      }
      btnCherche.disabled = true;
      btnCherche.innerHTML = '<span class="spinner"></span> Recherche… ' + recherche.restant + ' s';
    }

    function arreterRecherche() {
      if (!recherche) return;
      clearInterval(recherche.minuteur);
      recherche = null;
      libelleBouton();
    }

    async function chercherUneCourse() {
      if (recherche) return;

      const d = dernierD;
      if (!d || d.validation_status !== 'approved')
        return UI.err('Compte non validé', 'Vous pourrez chercher une course dès la validation.');
      if (d.status === 'busy')
        return UI.err('Livraison en cours', 'Terminez votre course avant d’en chercher une autre.');
      if (d.status !== 'available')
        return UI.err('Vous êtes hors ligne', 'Passez en disponible pour recevoir des courses.');

      recherche = { restant: 30, occupe: false, minuteur: null };
      libelleBouton();

      // la position d'abord, avant le premier tour d'attribution
      await LiveTrack.pushOnce().catch(() => {});

      recherche.minuteur = setInterval(async () => {
        if (!recherche) return;
        recherche.restant--;

        if (recherche.restant <= 0) {
          arreterRecherche();
          UI.err('Aucune course pour le moment',
                 'Restez en ligne : dès qu’un restaurant est prêt près de vous, ça sonne.');
          load();
          return;
        }
        libelleBouton();

        /* Un sondage toutes les 3 secondes, jamais deux en même temps :
           sur une connexion lente, un appel peut durer plus d'une seconde. */
        if (recherche.restant % 3 !== 0 || recherche.occupe) return;
        recherche.occupe = true;
        await API.safe(() => API.tick(), false);
        const rows = await API.safe(() => API.orders({ scope: 'available' }), []);
        if (!recherche) return;
        recherche.occupe = false;

        if (rows.length) {
          arreterRecherche();
          if (w.Sound) Sound.play('delivery', 1);
          UI.ok(rows.length > 1 ? rows.length + ' courses trouvées' : 'Une course pour vous !',
                'Elle apparaît juste en dessous.');
          load();
        }
      }, 1000);
    }

    btnCherche.onclick = chercherUneCourse;

    /** Repères et légende, à partir du livreur et de sa course éventuelle. */
    function peindreCarte(d, course) {
      if (d !== undefined) dernierD = d;
      if (course !== undefined) derniereCourse = course;
      d = dernierD; course = derniereCourse;
      if (!boite.isConnected) return;

      const st = LiveTrack.state;
      /* Le téléphone d'abord : sa position n'a pas fait l'aller-retour par le
         serveur, elle a donc quelques secondes d'avance. La base sert de
         secours tant que le premier relevé n'est pas arrivé. */
      const moi = st.pos ||
        (U.hasCoords({ lat: d && d.last_lat, lng: d && d.last_lng })
          ? { lat: +d.last_lat, lng: +d.last_lng } : null);

      const pts = {};
      if (moi) pts.driver = moi;

      let resto = null, client = null;
      if (course) {
        if (course.restaurant && U.hasCoords(course.restaurant))
          resto = pts.restaurant = { lat: +course.restaurant.lat, lng: +course.restaurant.lng };
        if (U.hasCoords({ lat: course.address_lat, lng: course.address_lng }))
          client = pts.client = { lat: +course.address_lat, lng: +course.address_lng };
      }
      if (live) live.update(pts);

      titre.textContent = course
        ? '🛵 Course #' + (course.code || '') + ' en direct'
        : '📍 Ma position';

      /* Chercher une course pendant qu'on en livre une n'a pas de sens : le
         serveur refuserait la seconde de toute façon. */
      btnCherche.style.display = course ? 'none' : '';
      if (course) arreterRecherche();

      /* --- pas encore de position : dire pourquoi, et comment y remédier */
      if (!moi) {
        infos.innerHTML = '<div class="banner banner-warn" style="margin-top:12px">' +
          '<div class="grow">📡 ' +
          U.esc(st.error || 'Position inconnue — activez le partage pour apparaître sur la carte.') +
          '</div><button class="btn btn-primary btn-sm" id="drvMapGeo">Activer</button></div>';
        const b = infos.querySelector('#drvMapGeo');
        if (b) b.onclick = async function () {
          UI.busy(this, true);
          try { await LiveTrack.pushOnce(); UI.ok('Position trouvée'); }
          catch (e) { UI.err(e.message); }
        };
        return;
      }

      /* --- en course : les deux étapes, leur distance, et l'itinéraire */
      if (course) {
        /* L'étape en cours est mise en avant : avant le retrait c'est le
           restaurant, une fois la commande récupérée c'est le client. Un
           livreur qui roule ne doit pas avoir à réfléchir pour savoir où il
           va. */
        const encours = course.status === 'delivering' ? 'client' : 'restaurant';

        const etape = (cle, icone, nom, p, adresse) => {
          if (!p) return '';
          const km = (U.haversine(moi.lat, moi.lng, p.lat, p.lng) * 1.3).toFixed(1);
          return '<div class="drv-step' + (cle === encours ? ' now' : '') + '">' +
            '<span class="art">' + icone + '</span>' +
            '<span class="grow"><b>' + U.esc(nom) + '</b>' +
              '<span class="tiny">' + U.esc(adresse || '') + '</span></span>' +
            '<span class="drv-km">' + km + ' km</span>' +
            '<a class="btn btn-dark btn-sm" target="_blank" rel="noopener" href="' +
              U.escUrl(U.gmapsRoute(p.lat, p.lng)) + '">Y aller</a>' +
          '</div>';
        };
        infos.innerHTML = '<div class="drv-steps">' +
          etape('restaurant', '🏪',
                (course.restaurant && course.restaurant.name) || 'Restaurant', resto,
                course.restaurant && course.restaurant.address) +
          etape('client', '🏠', 'Client', client, course.address_street) +
          '</div>';
        return;
      }

      /* --- en veille : ce que la plateforme sait de vous, et depuis quand */
      infos.innerHTML = '<div class="tiny" style="margin-top:12px;text-align:center">' +
        (st.running
          ? '🟢 Position partagée' + (st.lastSent ? ' — dernier envoi ' + U.ago(st.lastSent) : '') +
            (st.pos && st.pos.acc ? ' · précision ' + st.pos.acc + ' m' : '')
          : '⚪ Partage arrêté — passez en ligne pour recevoir les courses proches') +
        '</div>';
    }

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

        carteCredit(d) +

        /* La carte se glisse ici : sous le crédit, sous la disponibilité. */
        (approved ? '<div id="drvMapSlot" style="margin-top:14px"></div>' : '') +

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
                '<img class="scene-art" src="' + U.asset('assets/img/bg/livreur-vide.png') + '" alt="" aria-hidden="true">' +
                '<div class="h2 scene-title">Aucune course disponible pour le moment</div>' +
                '<p class="scene-sub">' +
                  (approved ? 'Restez disponible, les nouvelles courses de votre zone apparaîtront ici.'
                            : 'Votre compte doit être validé pour recevoir des courses.') + '</p>' +
                (approved ? '<div class="scene-cta">' +
                  '<button class="btn btn-primary btn-lg" id="refresh">⟳ Actualiser les courses</button></div>' : '') +
              '</div>') +
        '</div>' +
      '</div></div>';

      /* On rebranche la carte fabriquée plus haut, puis on la réveille : elle
         vient d'être détachée par la réécriture du tableau de bord. */
      const slot = view.querySelector('#drvMapSlot');
      if (slot) {
        slot.appendChild(boite);
        if (live) live.nudge();
        peindreCarte(d, active[0] || null);
      }

      /* Le régime de partage découle de ce qu'on vient de charger : inutile de
         repasser par LiveTrack.sync(), qui referait les deux mêmes requêtes. */
      if (active.length) LiveTrack.start('course');
      else if (approved && statut === 'available') LiveTrack.start('veille');
      else LiveTrack.stop();

      bindDelivery(view, load);

      const rf = view.querySelector('#refresh');
      if (rf) rf.onclick = function () { UI.busy(this, true, 'Recherche…'); load(); };

      const sw = view.querySelector('#availSw');
      if (sw && !sw.disabled) sw.onchange = async () => {
        const r = await API.safe(() => API.saveDriver({ status: sw.checked ? 'available' : 'offline' }), null);
        if (r) UI.ok(r.status === 'available' ? 'Vous êtes disponible' : 'Vous êtes indisponible');
        /* load() rallume ou coupe le partage de position selon le nouveau
           statut : c'est lui qui fait qu'une course tombant à côté vous
           revient plutôt qu'à un autre. */
        load();
      };
    }

    await load();
    const off = API.onChange(t => { if (t === 'orders' || t === 'drivers' || t === '*') load(); });
    /* Chaque nouvelle position redessine la carte seule, sans rappeler le
       serveur : le repère avance en direct entre deux chargements. */
    const offPos = LiveTrack.onChange(() => peindreCarte());
    const timer = setInterval(load, 25000);
    return () => {
      off(); offPos(); clearInterval(timer);
      arreterRecherche();
      if (live) live.destroy();
    };
  }, GUARD);

  /* ----------------------------------------------------------------------
     LE CRÉDIT

     Chaque course acceptée coûte la part plateforme des frais de livraison,
     prélevée à l'instant où le livreur accepte. À zéro, plus de course : le
     blocage est dans la base, pas ici — cet écran ne fait que l'annoncer
     avant qu'il ne survienne, pour que personne ne soit pris de court.
     ---------------------------------------------------------------------- */
  function carteCredit(d) {
    const solde = (d && d.credit_da) || 0;
    const alerte = (Store.settings && Store.settings.credit_alert_da) != null
      ? +Store.settings.credit_alert_da : 200;
    const bloque = solde <= 0;
    const bas = !bloque && solde <= alerte;

    return '<div class="card card-p" style="margin-top:14px' +
        (bloque ? ';border-color:var(--danger)' : bas ? ';border-color:var(--warn)' : '') + '">' +
      '<div class="row-between">' +
        '<div class="row" style="gap:12px">' +
          '<span style="font-size:26px">' + (bloque ? '🚫' : bas ? '⚠️' : '💳') + '</span>' +
          '<div><div class="tiny">Mon crédit</div>' +
            '<div class="h2">' + U.money(solde) + '</div></div>' +
        '</div>' +
        '<a class="btn btn-soft btn-sm" href="#/d/credit">Détail</a>' +
      '</div>' +
      (bloque
        ? '<div class="tiny" style="margin-top:10px"><b>Vous ne pouvez plus accepter de course.</b> ' +
          'Rechargez votre crédit auprès de la plateforme pour reprendre.</div>'
        : bas
          ? '<div class="tiny" style="margin-top:10px">Crédit bas : pensez à recharger avant d’être bloqué.</div>'
          : '<div class="tiny" style="margin-top:10px">La commission de chaque course est prélevée ici ' +
            'au moment où vous l’acceptez.</div>') +
    '</div>';
  }

  /* ======================================================================
     MON PORTEFEUILLE — solde, recharges et historiques
     ====================================================================== */
  const ONGLETS = [
    { k: 'tout',          l: 'Tout' },
    { k: 'recharge',      l: 'Recharges' },
    { k: 'commission',    l: 'Commissions' },
    { k: 'remboursement', l: 'Remboursements' },
    { k: 'demandes',      l: 'Mes demandes' }
  ];

  Router.add('/d/credit', async function (params, query, view) {
    let onglet = 'tout';

    view.innerHTML = '<div class="driver-page"><div class="wrap page">' +
      '<div class="card card-p drv-panel">' +
        drvHead('💳', 'Mon portefeuille', 'Commission prélevée à chaque course acceptée') +
        '<div id="box"><div class="skel" style="height:180px"></div></div>' +
      '</div></div></div>';

    const box = view.querySelector('#box');

    async function load() {
      const d = await API.safe(() => API.getDriver(), null);
      const lignes = await API.safe(() => API.myWallet(80), []);
      const demandes = await API.safe(() => API.myRecharges(30), []);
      const solde = (d && d.credit_da) || 0;
      const enAttente = demandes.filter(r => r.status === 'pending');

      const vues = onglet === 'tout' ? lignes : lignes.filter(l => l.kind === onglet);

      box.innerHTML =
        /* ---- solde ---- */
        '<div class="card card-p" style="text-align:center' +
          (solde <= 0 ? ';border-color:var(--danger)' : '') + '">' +
          '<div class="tiny">Solde actuel</div>' +
          '<div style="font-size:34px;font-weight:900;margin-top:4px">' + U.money(solde) + '</div>' +
          (solde <= 0
            ? '<div class="banner banner-warn" style="margin-top:12px">🚫 <div class="grow">' +
              'Compte bloqué : rechargez pour accepter de nouvelles courses.</div></div>'
            : '') +
          '<button class="btn btn-primary btn-block btn-lg" id="recharger" style="margin-top:14px">' +
            '💳 Recharger le portefeuille</button>' +
          (enAttente.length
            ? '<div class="tiny" style="margin-top:10px">⏳ ' + enAttente.length +
              ' demande' + (enAttente.length > 1 ? 's' : '') + ' en attente de validation</div>'
            : '') +
        '</div>' +

        /* ---- onglets ---- */
        '<div class="chips" style="margin:16px 0 10px;flex-wrap:wrap;overflow:visible">' +
          ONGLETS.map(o => '<button class="chip' + (onglet === o.k ? ' on' : '') +
            '" data-tab="' + o.k + '">' + o.l + '</button>').join('') +
        '</div>' +

        /* ---- historique ---- */
        (onglet === 'demandes'
          ? (demandes.length
              ? demandes.map(ligneDemande).join('')
              : UI.empty('📨', 'Aucune demande', 'Vos demandes de recharge apparaîtront ici.'))
          : (vues.length
              ? vues.map(ligneMouvement).join('')
              : UI.empty('🧾', 'Rien à afficher',
                  onglet === 'recharge' ? 'Aucune recharge pour l’instant.'
                  : onglet === 'commission' ? 'Aucune commission prélevée pour l’instant.'
                  : onglet === 'remboursement' ? 'Aucun remboursement — tant mieux.'
                  : 'Vos mouvements apparaîtront ici.')));

      box.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { onglet = b.dataset.tab; load(); });
      box.querySelector('#recharger').onclick = () => feuilleRecharge(load);
    }

    await load();
    const off = API.onChange(t => { if (t === 'drivers' || t === 'orders' || t === 'recharges' || t === '*') load(); });
    return () => off();
  }, GUARD);

  function ligneMouvement(l) {
    return '<div class="oline"><span class="l">' +
        '<b>' + U.esc(LIB_MOUVEMENT[l.kind] || l.kind) + '</b>' +
        (l.note ? '<br><span class="tiny">' + U.esc(l.note) + '</span>' : '') +
        '<br><span class="tiny">' + U.dt(l.created_at) + '</span>' +
      '</span>' +
      '<span style="text-align:right">' +
        '<b style="color:' + (l.amount >= 0 ? 'var(--ok)' : 'var(--danger)') + '">' +
          (l.amount >= 0 ? '+' : '') + U.money(l.amount) + '</b>' +
        '<br><span class="tiny">reste ' + U.money(l.balance_after) + '</span>' +
      '</span></div>';
  }

  const ETAT_DEMANDE = {
    pending:  ['⏳ En attente', 'tag-warn'],
    approved: ['✅ Validée', 'tag-ok'],
    rejected: ['⛔ Refusée', 'tag-danger']
  };

  function ligneDemande(r) {
    const e = ETAT_DEMANDE[r.status] || ['—', 'tag-muted'];
    return '<div class="oline"><span class="l">' +
        '<b>' + U.money(r.amount) + '</b> <span class="tag ' + e[1] + '">' + e[0] + '</span>' +
        '<br><span class="tiny">' + U.esc(LIB_METHODE[r.method] || r.method) +
          (r.reference ? ' • réf ' + U.esc(r.reference) : '') + '</span>' +
        (r.status === 'rejected' && r.reason
          ? '<br><span class="tiny" style="color:var(--danger)">' + U.esc(r.reason) + '</span>' : '') +
        '<br><span class="tiny">' + U.dt(r.created_at) + '</span>' +
      '</span></div>';
  }

  const LIB_METHODE = {
    baridimob: 'BaridiMob', ccp: 'Versement CCP',
    especes: 'Espèces', carte: 'Carte bancaire', autre: 'Autre'
  };

  /* ----------------------------------------------------------------------
     Demander une recharge

     Le livreur ne se crédite pas lui-même : il déclare un versement. Le
     portefeuille ne bouge qu'après vérification par un administrateur — le
     jour où les paiements par carte seront branchés, c'est la passerelle
     bancaire qui validera, et cet écran ne changera pas.
     ---------------------------------------------------------------------- */
  function feuilleRecharge(onSaved) {
    const MONTANTS = [1000, 2000, 5000, 10000];
    const infos = (Store.settings && Store.settings.payment_info) || '';

    UI.sheet({
      title: 'Recharger le portefeuille',
      subtitle: 'Versez le montant, puis déclarez-le ici',
      body:
        (infos
          ? '<div class="banner banner-info" style="white-space:pre-line">🏦 <div class="grow">' +
              U.esc(infos) + '</div></div>'
          : '<div class="banner banner-warn">🏦 <div class="grow">Contactez la plateforme au ' +
              U.esc(TALABI_CONFIG.SUPPORT_PHONE) + ' pour connaître les coordonnées de versement.</div></div>') +

        '<form id="rf" class="stack" style="margin-top:12px" novalidate>' +
          '<div class="field"><label>Montant versé</label>' +
            '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
              MONTANTS.map(v => '<button type="button" class="btn btn-soft btn-sm" data-m="' + v + '">' +
                U.money(v) + '</button>').join('') +
            '</div>' +
            '<input class="input" name="amount" type="number" min="100" step="100" ' +
              'placeholder="Montant personnalisé" required></div>' +

          '<div class="field"><label>Moyen utilisé</label>' +
            '<select class="input" name="method">' +
              '<option value="baridimob">BaridiMob</option>' +
              '<option value="ccp">Versement au guichet CCP</option>' +
              '<option value="especes">Espèces en main propre</option>' +
              '<option value="autre">Autre</option>' +
            '</select></div>' +

          '<div class="field"><label>Numéro d’opération <span class="tiny">(facultatif)</span></label>' +
            '<input class="input" name="reference" placeholder="Ex : 123456789"></div>' +

          UI.imageField('proof_url', '', 'Photo du reçu (recommandé)') +
        '</form>' +
        '<div class="tiny">Votre demande part à la plateforme. Le crédit est ajouté ' +
          'dès que le versement est vérifié.</div>',

      footer: '<button class="btn btn-primary btn-block btn-lg" id="ok">Envoyer ma demande</button>',

      onMount(el, api) {
        UI.bindImageFields(el);
        const champ = el.querySelector('[name=amount]');
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { champ.value = b.dataset.m; });

        el.querySelector('#ok').onclick = async function () {
          const d = UI.formData(el.querySelector('#rf'));
          const montant = Math.round(+d.amount || 0);
          if (montant < 100) return UI.err('Montant invalide', 'Indiquez au moins 100 DA.');

          UI.busy(this, true, 'Envoi…');
          try {
            await API.requestRecharge({
              amount: montant, method: d.method,
              reference: d.reference || null, proof_url: d.proof_url || null
            });
            api.close();
            UI.ok('Demande envoyée', 'Vous serez prévenu dès la validation.');
            onSaved && onSaved();
          } catch (e) { UI.busy(this, false); UI.err(e.message); }
        };
      }
    });
  }

  /** Part plateforme sur les frais de livraison — le même calcul qu'en base. */
  function commissionDe(o) {
    const part = (Store.settings && Store.settings.driver_share != null)
      ? +Store.settings.driver_share : 0.80;
    return Math.max(0, Math.round((o.delivery_fee || 0) * (1 - part)));
  }

  const LIB_MOUVEMENT = {
    recharge: 'Recharge',
    commission: 'Commission de course',
    remboursement: 'Remboursement',
    ajustement: 'Correction'
  };

  /* ======================================================================
     COURSES DISPONIBLES
     ====================================================================== */
  Router.add('/d/available', async function (params, query, view) {
    view.innerHTML = '<div class="driver-page"><div class="wrap page">' +
      '<div class="card card-p drv-panel">' +
        drvHead('🛍️', 'Courses disponibles', 'Commandes prêtes dans votre zone') +
        '<div id="posBox"></div>' +
        '<div id="list"><div class="skel" style="height:150px"></div></div>' +
      '</div></div></div>';

    const list = view.querySelector('#list');

    /* ---- pourquoi les courses vous arrivent, ou pas -------------------- */
    /* Le serveur propose chaque course au livreur le plus proche du
       restaurant. « Le plus proche » se calcule sur la dernière position
       reçue : sans partage, on ne sait pas où vous êtes et vous passez
       systématiquement derrière ceux qu'on situe. Le livreur a le droit de
       savoir ça — sinon il croit à un favoritisme de la plateforme. */
    function paintPos() {
      const box = view.querySelector('#posBox');
      if (!box) return;
      const st = LiveTrack.state;

      box.innerHTML = st.error
        ? '<div class="banner banner-warn" style="margin-bottom:14px"><div class="grow">📍 ' +
            U.esc(st.error) + '</div>' +
            '<button class="btn btn-primary btn-sm" id="posNow">Activer</button></div>'
        : st.running
          ? '<div class="banner banner-ok" style="margin-bottom:14px"><div class="grow">📍 ' +
              '<b>Position partagée</b> — les courses les plus proches de vous ' +
              'vous sont proposées en premier.</div></div>'
          : '<div class="banner banner-warn" style="margin-bottom:14px"><div class="grow">📍 ' +
              'Partagez votre position : les courses partent d’abord au livreur ' +
              'le plus proche du restaurant.</div>' +
              '<button class="btn btn-primary btn-sm" id="posNow">Activer</button></div>';

      const b = box.querySelector('#posNow');
      if (b) b.onclick = async function () {
        UI.busy(this, true);
        try { await LiveTrack.pushOnce(); LiveTrack.start('veille'); UI.ok('Position partagée'); }
        catch (e) { UI.err(e.message); }
        paintPos();
      };
    }

    async function load() {
      const d = await API.safe(() => API.getDriver(), null);
      const posBox = view.querySelector('#posBox');
      if (posBox) posBox.innerHTML = '';

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
      if (d.status !== 'available') {
        list.innerHTML = UI.empty('🌙', 'Vous êtes hors ligne',
          'Aucune course ne vous est proposée tant que vous n’êtes pas disponible.',
          '<a class="btn btn-primary" href="#/d">Passer en ligne</a>');
        return;
      }

      /* On sait déjà, deux lignes plus haut, qu'il est validé, en ligne et
         libre : inutile de repasser par sync() et ses deux requêtes toutes
         les quinze secondes. start() ne fait rien s'il tourne déjà. */
      LiveTrack.start('veille');
      paintPos();

      const rows = await API.safe(() => API.orders({ scope: 'available' }), []);
      list.innerHTML = rows.length
        ? '<div class="stack">' + rows.map(o => deliveryCard(o)).join('') + '</div>'
        : '<div class="empty-scene compact">' +
            '<img class="scene-art" src="' + U.asset('assets/img/bg/courses-vide.png') + '" alt="" aria-hidden="true">' +
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
    const offPos = LiveTrack.onChange(paintPos);
    const timer = setInterval(load, 15000);
    return () => { off(); offPos(); clearInterval(timer); };
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
                '<img class="scene-art" src="' + U.asset('assets/img/bg/livraison-vide.png') + '" alt="" aria-hidden="true">' +
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
              '<img class="scene-art" src="' + U.asset('assets/img/bg/livraison-vide.png') + '" alt="" aria-hidden="true">' +
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

      /* Ce que la course va coûter en crédit, dit AVANT d'accepter. Découvrir
         le prélèvement après coup, c'est la première source de litige. */
      (isMine ? '' :
        '<div class="oline"><span class="l">Commission prélevée</span>' +
          '<b>− ' + U.money(commissionDe(o)) + '</b></div>') +

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
