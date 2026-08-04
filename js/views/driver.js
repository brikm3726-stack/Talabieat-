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
  /* `lien` : la vignette devient cliquable. C'est par là qu'on atteint
     l'historique des courses depuis que « Passé » a quitté la barre du bas. */
  function drvStat(icone, label, valeur, legende, lien) {
    const dedans =
      '<span class="ic">' + icone + '</span>' +
      '<div class="grow"><div class="k">' + U.esc(label) + '</div>' +
        '<div class="v">' + valeur + '</div>' +
        '<div class="s">' + U.esc(legende) + '</div></div>' +
      (lien ? '<span class="go">›</span>' : '');
    return lien
      ? '<a class="card drv-stat lien" href="#' + lien + '">' + dedans + '</a>'
      : '<div class="card drv-stat">' + dedans + '</div>';
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

    /* ====================================================================
       SQUELETTE FIXE
       --------------------------------------------------------------------
       Le tableau de bord se rafraîchit toutes les 25 secondes. Il ne se
       réécrit pas en entier pour autant : la carte est posée dans un bloc
       qui n'est JAMAIS touché, entre deux zones qui, elles, se redessinent.

       Ce découpage n'est pas du confort. Une carte Google arrachée du
       document puis rebranchée perd ses tuiles et ne les redemande pas
       toujours — on se retrouve devant un rectangle gris. Et la recréer à
       chaque passage coûterait un « chargement de carte » facturé toutes
       les 25 secondes, par livreur.
       ==================================================================== */
    view.innerHTML = '<div class="driver-page"><div class="wrap page">' +
      '<div id="drvHaut"><div class="skel" style="height:220px"></div></div>' +
      '<div id="drvMapSlot" style="margin-top:14px"></div>' +
      '<div id="drvBas"></div>' +
    '</div></div>';

    const zoneHaut = view.querySelector('#drvHaut');
    const zoneBas  = view.querySelector('#drvBas');
    const slot     = view.querySelector('#drvMapSlot');

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

    /* La carte n'est construite qu'une fois le bloc DANS le document : une
       carte Google créée dans un élément détaché naît sans dimensions, et
       reste grise. */
    slot.appendChild(boite);

    /* Carte figée : le tableau de bord défile, et un doigt posé sur la carte
       doit faire défiler la page — pas déplacer la carte. */
    const live = MapPicker.live(boite.querySelector('#drvMap'), {}, {
      fige: true,
      /* Sans réseau, sans clé, ou si Google met plus de 12 secondes à
         répondre, la carte ne viendra pas. Le dire vaut mieux qu'un
         rectangle gris qu'on prend pour une panne de l'application. */
      /* Ce que voit un livreur doit tenir en deux lignes et parler de SON
         travail. Le détail technique — quelle case cocher dans Google Cloud —
         ne concerne que celui qui administre la plateforme : il est replié
         derrière un lien que personne d'autre n'ouvrira. */
      onEchec: function (raison) {
        const el = boite.querySelector('#drvMap');
        if (!el) return;
        el.classList.add('ko');
        el.innerHTML =
          '<div class="drv-mapko">' +
            '<span class="art">🗺️</span>' +
            '<b>La carte ne s’affiche pas</b>' +
            '<span>Votre position est bien envoyée : les courses proches vous ' +
              'sont proposées normalement.</span>' +
            (raison
              ? '<button type="button" class="drv-mapwhy" id="drvMapWhy">Détails techniques</button>' +
                '<span class="drv-mapdet" id="drvMapDet" hidden>' + U.esc(raison) + '</span>'
              : '') +
          '</div>';

        const b = el.querySelector('#drvMapWhy');
        if (b) b.onclick = function () {
          const d = el.querySelector('#drvMapDet');
          d.hidden = !d.hidden;
          this.textContent = d.hidden ? 'Détails techniques' : 'Masquer';
        };
      }
    });
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
      if (w.Sound) Sound.stop('searching');
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

      /* Le ping tourne pendant toute la recherche : 2,5 s de son, douze
         passages. Il ne réclame rien, il dit que ça travaille — c'est ce qui
         rend l'attente supportable quand on est arrêté au bord de la route. */
      if (w.Sound) Sound.play('searching', 12);

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

      /* ---- zone du haut : tout ce qui précède la carte ---- */
      zoneHaut.innerHTML =
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

        carteCredit(d);

      /* La carte occupe le bloc du milieu : elle n'est jamais réécrite. On se
         contente de la montrer ou de la cacher — un compte pas encore validé
         n'a rien à suivre. Au retour de l'invisible, il faut la réveiller :
         cachée, elle mesurait zéro. */
      const etaitCachee = slot.hidden;
      slot.hidden = !approved;
      if (etaitCachee && approved && live) live.nudge();

      /* ---- zone du bas : tout ce qui suit la carte ---- */
      zoneBas.innerHTML =
        '<div class="grid grid-stats drv-stats" style="margin-top:14px">' +
          drvStat('📅', 'Courses aujourd’hui', todayDone.length, 'Aujourd’hui') +
          drvStat('📦', 'Total livraisons', (d && d.total_deliveries) || 0,
                  'Voir l’historique', '/d/history') +
          drvStat('💰', 'Gains cumulés', U.money((d && d.total_earnings) || 0),
                  'Voir le détail', '/d/history') +
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
        '</div>';

      peindreCarte(d, active[0] || null);

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
     COURSE EN DIRECT — PLEIN ÉCRAN (livreur)
     ----------------------------------------------------------------------
     Le même écran que celui du client, vu de l'autre côté. Il en a plus
     besoin que lui : le client attend assis, le livreur roule. Sa carte de
     course vivait dans une page qui défile, entre le détail des gains et le
     bouton « Problème » — pour savoir où aller, il devait faire défiler d'une
     main au feu rouge.

     Ici, trois choses et rien d'autre : où je vais, qui je livre, et le geste
     du moment. Le reste — les gains, la commission, le détail — reste sur la
     page « Ma livraison », qu'on lit à l'arrêt.
     ====================================================================== */
  Router.add('/d/live/:id', async function (params, query, view) {
    const encours = o => ['driver_assigned', 'delivering'].indexOf(o.status) >= 0;

    let o = await API.safe(() => API.order(params.id), null);
    if (!o) return Router.go('/d/active', true);
    if (!encours(o)) return Router.go('/d/active', true);

    /* Le partage démarre avec l'écran : ouvrir son suivi sans envoyer sa
       position, c'est regarder une carte où l'on n'apparaît pas. */
    LiveTrack.start('course');
    LiveTrack.pushOnce().catch(() => {});

    const ETAPES = ['Acceptée', 'Au resto', 'Chez le client', 'Livrée'];

    const resto  = () => o.restaurant && U.hasCoords(o.restaurant)
      ? { lat: +o.restaurant.lat, lng: +o.restaurant.lng } : null;
    const chez   = () => U.hasCoords({ lat: o.address_lat, lng: o.address_lng })
      ? { lat: +o.address_lat, lng: +o.address_lng } : null;
    /* Sa propre position vient du téléphone, pas de la base : elle n'a pas
       fait l'aller-retour par le serveur, elle a donc quelques secondes
       d'avance — et c'est lui qui bouge. */
    const moi    = () => LiveTrack.state.pos;

    const ecran = LiveScreen.open(view, {
      code: '#' + (o.code || ''),
      back: '/d/active',

      points: () => ({
        restaurant: resto(), client: chez(), driver: moi(),
        chemin: o.status === 'delivering'
          ? ['driver', 'client']
          : ['driver', 'restaurant', 'client'],
        noms: {
          restaurant: o.restaurant && o.restaurant.name,
          client: o.client_name || (o.client && o.client.full_name) || 'Client'
        }
      }),

      fetch: async () => {
        const frais = await API.safe(() => API.order(params.id), null);
        if (frais) o = frais;
        /* Course terminée ou reprise par un autre : on ne laisse pas un
           livreur devant une carte qui ne le concerne plus. */
        if (!encours(o)) Router.go('/d/active', true);
      },

      /* Chez le livreur, la carte vide a presque toujours la même cause : le
         navigateur n'a pas la permission de le localiser. C'est réparable
         d'ici, en un bouton — et personne d'autre ne peut le faire pour lui. */
      etat: () => {
        const st = LiveTrack.state;
        if (!st.pos)
          return '<span class="ic">📡</span><span class="tx">' +
            U.esc(st.error || 'Position introuvable') +
            '<small>Le client ne vous voit pas avancer tant qu’elle manque.</small></span>' +
            '<button class="btn btn-primary btn-sm" id="lvGeo">Activer</button>';
        const cible = o.status === 'delivering' ? chez() : resto();
        if (!cible)
          return '<span class="ic">' + UI.icon('pin', 17) + '</span><span class="tx">' +
            (o.status === 'delivering'
              ? 'Cette adresse n’a pas de position GPS'
              : 'Ce restaurant n’a pas de position sur la carte') +
            '<small>Appelez pour vous faire guider : le trajet ne peut pas être calculé.</small></span>';
        return '';
      },

      bindEtat: bandeau => {
        const b = bandeau.querySelector('#lvGeo');
        if (b) b.onclick = async function () {
          UI.busy(this, true);
          try { await LiveTrack.pushOnce(); LiveTrack.start('course'); UI.ok('Position partagée'); }
          catch (e) { UI.err(e.message); }
          ecran.repaint();
        };
      },

      sheet: () => {
        /* La commande est récupérée : il roule vers le client. Sinon il roule
           encore vers le restaurant. */
        const versClient = o.status === 'delivering';
        const cible = versClient ? chez() : resto();
        const t = LiveScreen.trajet(moi(), cible);
        const st = LiveTrack.state;

        return LiveScreen.grab() +
          LiveScreen.eta(
            versClient ? 'Chez le client' : 'Au restaurant',
            t ? t.min + ' min' : (st.pos ? '—' : 'Position…'),
            t ? t.texte : (st.error ? 'activez la localisation' : 'recherche du signal')
          ) +
          LiveScreen.progress(ETAPES, versClient ? 2 : 1) +

          /* Avant le retrait, l'interlocuteur est le restaurant ; après, c'est
             le client. Afficher les deux mettrait le livreur devant un choix
             qu'il n'a pas à faire en roulant. */
          (versClient
            ? LiveScreen.person({
                name: o.client_name || (o.client && o.client.full_name) || 'Client',
                meta: U.esc(o.address_street || '') +
                      (o.zone ? ' · ' + U.esc(o.zone.name) : ''),
                phone: o.client_phone,
                route: chez() ? U.gmapsRoute(o.address_lat, o.address_lng) : null
              })
            : LiveScreen.person({
                name: (o.restaurant && o.restaurant.name) || 'Restaurant',
                meta: U.esc((o.restaurant && o.restaurant.address) || ''),
                phone: o.restaurant && o.restaurant.phone,
                route: resto() ? U.gmapsRoute(o.restaurant.lat, o.restaurant.lng) : null
              })) +

          /* L'argent, dans le sens où il circule à cet instant : au restaurant
             il avance de sa poche, chez le client il se rembourse. Le même
             chiffre, mais pas le même geste — et se tromper de sens coûte une
             course entière. */
          (versClient
            ? LiveScreen.note(UI.icon('wallet', 18),
                'Encaissez <b>' + U.esc(U.money(o.total)) + '</b> en espèces')
            : LiveScreen.note(UI.icon('wallet', 18),
                'À avancer au restaurant : <b>' +
                U.esc(U.money(o.total - (o.delivery_fee || 0))) + '</b>')) +

          (o.note ? LiveScreen.note('📝', U.esc(o.note)) : '') +

          LiveScreen.action(
            versClient ? '✅ Commande livrée' : '🚀 J’ai récupéré la commande',
            'data-dact="' + (versClient ? 'delivered' : 'delivering') + '" ' +
            'data-id="' + U.esc(o.id) + '"');
      },

      /* Le bouton de l'écran délègue au même code que la page « Ma
         livraison » : confirmation avant « livrée », son, arrêt du partage.
         Deux chemins pour changer un statut, c'est un jour où l'un des deux
         oublie d'arrêter le GPS. */
      bind: sheet => {
        bindDelivery(sheet, async () => {
          const frais = await API.safe(() => API.order(params.id), null);
          if (frais) o = frais;
          if (!encours(o)) return Router.go('/d/active');
          ecran.repaint();
        });
      }
    });

    /* Chaque relevé GPS redessine la feuille : les mètres qui restent
       diminuent pendant qu'il roule, sans attendre le tour de 12 secondes. */
    const offTrack = LiveTrack.onChange(() => ecran.repaint());
    const off = API.onChange(t => { if (t === 'orders' || t === '*') ecran.repaint(); });
    return () => { off(); offTrack(); ecran.destroy(); };
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

      /* L'ARGENT À AVANCER — le chiffre le plus important de cette carte.
         Le paiement se fait à la livraison : le livreur règle le restaurant
         au comptoir, de sa poche, et se rembourse chez le client. Accepter
         une course de 3 000 DA avec 500 DA en poche, c'est se retrouver
         bloqué devant la caisse. Il faut qu'il le voie avant d'accepter, pas
         après. */
      (isMine ? '' :
        '<div class="drv-avance">' +
          '<span class="ic">💵</span>' +
          '<span class="grow"><b>À avancer au restaurant</b>' +
            '<span class="tiny">Le client vous rembourse à la livraison</span></span>' +
          '<b class="v">' + U.money(o.total - (o.delivery_fee || 0)) + '</b>' +
        '</div>') +

      /* La course en direct, avant les boutons : c'est là qu'on va quand on
         remonte sur le scooter. Le détail au-dessus se lit à l'arrêt, une
         fois ; cet écran-là s'ouvre à chaque carrefour. */
      (isMine
        ? '<a class="btn btn-dark btn-block" style="margin-top:13px" href="#/d/live/' +
            U.esc(o.id) + '">' + UI.icon('navigation', 18) + ' Suivre en plein écran</a>'
        : '') +

      '<div class="row" style="gap:9px;margin-top:13px">' +
        (isMine
          ? '<button class="btn btn-ghost btn-sm" data-abandon="' + U.esc(o.id) + '">Problème</button>' +
            (next ? '<button class="btn btn-primary grow" data-dact="' + next[0] + '" data-id="' + U.esc(o.id) + '">' + next[1] + '</button>' : '')
          : '<button class="btn btn-ghost btn-sm" data-skip="' + U.esc(o.id) + '">Passer</button>' +
            '<button class="btn btn-primary grow" data-claim="' + U.esc(o.id) + '">✅ Accepter la course</button>') +
      '</div>' +
    '</div>';
  }

  /* ----------------------------------------------------------------------
     RENDRE UNE COURSE QU'ON NE PEUT PAS HONORER

     Restaurant fermé, plat épuisé, adresse introuvable : le livreur le
     découvre sur place, après avoir accepté et payé sa commission. Sans
     cette porte, il n'avait le choix qu'entre livrer l'impossible et
     laisser la course pourrir — et dans les deux cas il y perdait.

     La commission lui est rendue automatiquement : le remboursement écoute
     les annulations depuis le fichier 13.
     ---------------------------------------------------------------------- */
  const MOTIFS = [
    ['Restaurant fermé',        'Le restaurant n’est pas ouvert'],
    ['Plat indisponible',       'Un plat de la commande n’est plus servi'],
    ['Client injoignable',      'Personne ne répond à l’adresse'],
    ['Adresse introuvable',     'L’adresse ne mène nulle part'],
    ['Autre',                   'Je précise moi-même']
  ];

  function abandonSheet(orderId, onDone) {
    let choisi = null;
    UI.sheet({
      title: 'Un problème sur cette course ?',
      subtitle: 'La course sera annulée et votre commission vous sera rendue.',
      body:
        '<div class="stack" style="gap:8px" id="motifs">' +
          MOTIFS.map((m, i) =>
            '<div class="role-card" data-m="' + i + '">' +
              '<div class="grow"><b>' + U.esc(m[0]) + '</b>' +
                '<span class="tiny">' + U.esc(m[1]) + '</span></div>' +
              '<div data-check style="color:var(--brand);font-weight:800"></div>' +
            '</div>').join('') +
        '</div>' +
        '<div class="field" id="autreBox" hidden style="margin-top:12px">' +
          '<label>Précisez</label>' +
          '<input class="input" id="autre" placeholder="Ex : le restaurant a fermé plus tôt"></div>' +
        '<div class="banner banner-warn" style="margin-top:12px;font-size:12.5px">' +
          'Le client sera prévenu avec cette raison. Soyez précis : c’est ce ' +
          'qu’il lira, et c’est ce que la plateforme verra.</div>',
      footer: '<button class="btn btn-danger btn-block btn-lg" id="go" disabled>Annuler la course</button>',
      onMount(el, api) {
        const go = el.querySelector('#go');
        const autreBox = el.querySelector('#autreBox');
        el.querySelectorAll('[data-m]').forEach(c => c.onclick = function () {
          el.querySelectorAll('[data-m]').forEach(x => {
            x.classList.remove('on');
            x.querySelector('[data-check]').textContent = '';
          });
          this.classList.add('on');
          this.querySelector('[data-check]').textContent = '✓';
          choisi = MOTIFS[+this.dataset.m][0];
          autreBox.hidden = choisi !== 'Autre';
          go.disabled = false;
        });

        go.onclick = async function () {
          const libre = el.querySelector('#autre').value.trim();
          const motif = choisi === 'Autre' ? libre : choisi;
          if (!motif) return UI.err('Précisez la raison');
          UI.busy(this, true, 'Annulation…');
          try {
            await API.driverAbandon(orderId, motif);
            api.close();
            UI.ok('Course annulée', 'Votre commission vous a été rendue.');
            onDone && onDone();
          } catch (e) { UI.busy(this, false); UI.err(e.message); }
        };
      }
    });
  }

  function bindDelivery(view, reload) {
    view.querySelectorAll('[data-abandon]').forEach(b => b.onclick = function () {
      abandonSheet(this.dataset.abandon, reload);
    });

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
