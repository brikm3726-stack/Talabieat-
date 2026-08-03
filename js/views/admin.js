/* ==========================================================================
   ESPACE ADMINISTRATEUR
   ========================================================================== */
(function (w) {
  'use strict';

  const GUARD = { auth: true, roles: ['admin'] };

  /* La barre d'onglets qui se trouvait ici répétait, dans chaque page, le menu
     déjà présent en haut de l'écran. Deux navigations identiques l'une sous
     l'autre, dont l'une renvoyait toujours au tableau de bord. Le menu du haut
     reste seul, complété de « Réglages » qui n'y figurait pas. */

  /** Ouverture de page : titre, sous-titre, et pictogramme de la rubrique. */
  function head(titre, sous) {
    return '<div class="adm-head"><div class="h1">' + U.esc(titre) + '</div>' +
      '<div class="sub">' + U.esc(sous) + '</div></div>';
  }

  /**
   * Filtres d'une liste : pictogramme, libellé et NOMBRE RÉEL d'éléments.
   * Le compte est calculé sur la liste complète, pas inventé : il indique
   * combien de fiches attendent réellement une décision.
   */
  function filterBar(attr, choix, actif) {
    return '<div class="adm-filters">' +
      choix.map(c => '<button data-' + attr + '="' + U.esc(c.v) + '"' +
        (c.v === actif ? ' class="on"' : '') + '>' +
        UI.icon(c.i, 17) + '<span>' + U.esc(c.l) + '</span>' +
        '<b class="n">' + c.n + '</b></button>').join('') +
    '</div>';
  }

  /** Enveloppe sombre commune aux six pages. */
  function page(contenu) {
    return '<div class="admin-page"><div class="wrap page">' + contenu + '</div></div>';
  }

  /* ======================================================================
     TABLEAU DE BORD
     ====================================================================== */
  Router.add('/a', async function (params, query, view) {
    view.innerHTML = page('<div class="skel" style="height:220px"></div>');

    const s = await API.safe(() => API.adminStats(), null);
    const recent = await API.safe(() => API.adminOrders({ limit: 8 }), []);
    if (!s) return;

    /* Vignette : intitulé, chiffre, légende. `chaud` met la vignette en avant
       quand elle appelle une action — des commandes qui attendent. */
    function tuile(label, valeur, note, icone, ton, chaud) {
      return '<div class="adm-stat' + (chaud ? ' hot' : '') + '">' +
        '<div class="row-between"><span class="k">' + U.esc(label) + '</span>' +
        '<span class="ic ' + (ton || '') + '">' + UI.icon(icone, 19) + '</span></div>' +
        '<div class="v">' + valeur + '</div>' +
        '<div class="s">' + U.esc(note) + '</div></div>';
    }

    view.innerHTML = page(
      head('Vue d’ensemble', 'Activité de la plateforme ' + TALABI_CONFIG.APP_NAME) +

      '<div class="adm-stats">' +
        tuile('Commandes en cours', U.num(s.active_orders), 'À traiter', 'flame', 'orange',
              s.active_orders > 0) +
        tuile('Livrées', U.num(s.delivered), 'Commandes réussies', 'check', 'vert') +
        tuile('Volume d’affaires', U.money(s.gmv), 'Total des commandes', 'wallet', 'orange') +
        tuile('Revenus plateforme', U.money(s.revenue), 'Total des commissions', 'tag', 'or') +
      '</div>' +

      '<div class="adm-stats" style="margin-top:14px">' +
        tuile('Utilisateurs', U.num(s.users), 'Comptes inscrits', 'users', 'bleu') +
        tuile('Restaurants actifs', U.num(s.restaurants), 'Fiches validées', 'store', 'orange') +
        tuile('Livreurs validés', U.num(s.drivers), 'Comptes approuvés', 'scooter', 'vert') +
        tuile('Commandes totales', U.num(s.orders), 'Depuis l’ouverture', 'receipt', 'or') +
      '</div>' +

      ((s.pending_restaurants || s.pending_drivers)
        ? '<div class="adm-alert">' +
          '<span class="ic">' + UI.icon('clock', 20) + '</span>' +
          '<div class="grow"><b>En attente de validation</b>' +
            '<div class="tiny">Des inscriptions attendent votre décision.</div></div>' +
            (s.pending_restaurants ? '<a class="btn btn-primary btn-sm" href="#/a/restaurants">' +
              s.pending_restaurants + ' restaurant(s)</a>' : '') +
            (s.pending_drivers ? '<a class="btn btn-primary btn-sm" href="#/a/drivers">' +
              s.pending_drivers + ' livreur(s)</a>' : '') +
          '</div>'
        : '') +

      '<div class="adm-section"><div class="h2">Dernières commandes</div>' +
        '<a class="link" href="#/a/orders">Tout voir →</a></div>' +
      ordersTable(recent));
  }, GUARD);

  /* ======================================================================
     RESTAURANTS
     ====================================================================== */
  Router.add('/a/restaurants', async function (params, query, view) {
    let filter = '', tous = [];

    /* C'est ici qu'un restaurant entre sur la plateforme : personne d'autre
       ne peut le faire depuis la disparition de l'espace gérant. Le bouton
       d'ajout est donc la première chose de la page, pas une action cachée
       en bas de liste. */
    view.innerHTML = page(
      head('Restaurants', 'Inscrivez les restaurants et tenez leurs fiches et leurs cartes') +
      '<a class="btn btn-primary" href="#/a/resto/nouveau" style="margin-bottom:16px">' +
        UI.icon('plus', 17) + ' Ajouter un restaurant</a>' +
      '<div id="filtres"></div>' +
      '<div id="list"><div class="skel" style="height:120px"></div></div>');

    const list = view.querySelector('#list');
    const filtres = view.querySelector('#filtres');

    function peindreFiltres() {
      const n = st => tous.filter(x => x.status === st).length;
      filtres.innerHTML = filterBar('f', [
        { v: '',         i: 'grid',  l: 'Tous',      n: tous.length },
        { v: 'pending',  i: 'clock', l: 'En attente', n: n('pending') },
        { v: 'approved', i: 'check', l: 'Validés',    n: n('approved') },
        { v: 'rejected', i: 'warn',  l: 'Refusés',    n: n('rejected') }
      ], filter);
      filtres.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
        filter = b.dataset.f; peindreFiltres(); peindre();
      });
    }

    async function load() {
      tous = await API.safe(() => API.adminRestaurants(null), []);
      peindreFiltres();
      peindre();
    }

    function peindre() {
      const rows = filter ? tous.filter(x => x.status === filter) : tous;
      if (!rows.length) { list.innerHTML = UI.empty(UI.icon('store', 40), 'Aucun restaurant', ''); return; }

      list.innerHTML = '<div class="stack">' + rows.map(r =>
        '<div class="adm-card">' +
          '<div class="adm-row">' +
            '<div class="adm-logo">' + (r.logo_url
              ? '<img src="' + U.escUrl(r.logo_url) + '" alt="">'
              : '<span>' + U.esc(U.initials(r.name)) + '</span>') + '</div>' +
            '<div class="grow"><div class="row" style="gap:9px;flex-wrap:wrap">' +
              '<b class="adm-name">' + U.esc(r.name) + '</b>' +
              (r.status === 'approved' ? '<span class="adm-verif" title="Fiche validée">' + UI.icon('check', 16) + '</span>' : '') +
              '<span class="tag ' + (r.status === 'approved' ? 'tag-ok' : r.status === 'rejected' ? 'tag-danger' : 'tag-warn') + '">' +
                (r.status === 'approved' ? 'Validé' : r.status === 'rejected' ? 'Refusé' : 'En attente') + '</span>' +
              (r.open_now ? '<span class="tag tag-info">Ouvert</span>' : '') +
            '</div>' +
            '<div class="adm-line">' + UI.icon('pin', 14) + ' ' + U.esc(r.address || '—') +
              (r.zone ? ' — ' + U.esc(r.zone.name) : '') + '</div>' +
            '<div class="adm-line">' + UI.icon('phone', 14) + ' ' + U.esc(r.phone || '—') +
              ' <span class="sep">•</span> ' + UI.icon('scooter', 14) + ' ' + U.money(r.delivery_fee) + '</div>' +
            '<div class="adm-line">' + (U.hasCoords(r)
              ? (r.gps_verified === false
                  ? '<span class="warn">' + UI.icon('warn', 14) + ' position approximative — à vérifier</span>'
                  : UI.icon('link', 14) + ' <a target="_blank" rel="noopener" class="lien" href="' +
                    U.gmapsPin(r.lat, r.lng) + '">voir sur Google Maps ↗</a>')
              : '<span class="danger">' + UI.icon('warn', 14) + ' aucune position GPS</span>') + '</div>' +
            '<div class="adm-line">' + UI.icon('user', 14) + ' ' +
              U.esc(r.owner ? (r.owner.full_name + ' — ' + r.owner.email) : '—') + '</div>' +
            (r.reject_reason ? '<div class="adm-line danger">Motif : ' + U.esc(r.reject_reason) + '</div>' : '') +
            '</div>' +
            '<div class="adm-acts">' +
              /* Les deux actions du quotidien d'abord : tenir la carte et
                 corriger la fiche. Valider et refuser ne servent plus qu'aux
                 rares fiches héritées de l'ancien parcours d'inscription. */
              '<a class="btn btn-primary btn-sm" href="#/a/resto/' + U.esc(r.id) + '/menu">' +
                UI.icon('grid', 15) + ' Carte (' + (r.menu_count != null ? r.menu_count : '…') + ')</a>' +
              '<a class="btn btn-soft btn-sm" href="#/a/resto/' + U.esc(r.id) + '">' +
                UI.icon('pencil', 15) + ' Fiche</a>' +
              '<button class="btn btn-ghost btn-sm" data-pos="' + U.esc(r.id) + '">' +
                UI.icon('pin', 15) + ' Position</button>' +
              '<a class="btn btn-ghost btn-sm" href="#/resto/' + U.esc(r.id) + '">' +
                UI.icon('eye', 15) + ' Aperçu client</a>' +
              (r.status !== 'approved' ? '<button class="btn btn-ok btn-sm" data-ok="' + U.esc(r.id) + '">' +
                UI.icon('check', 15) + ' Valider</button>' : '') +
              (r.status !== 'rejected' ? '<button class="btn btn-danger btn-sm" data-no="' + U.esc(r.id) + '">' +
                UI.icon('warn', 15) + ' Refuser</button>' : '') +
            '</div>' +
          '</div>' +
        '</div>').join('') + '</div>';

      list.querySelectorAll('[data-pos]').forEach(b => b.onclick = function () {
        const r = tous.find(x => x.id === this.dataset.pos);
        MapPicker.open({
          title: 'Position de ' + r.name,
          lat: r.lat, lng: r.lng,
          onPick: async p => {
            await API.safe(() => API.adminUpdateRestaurant(r.id, { lat: p.lat, lng: p.lng }));
            UI.ok('Position enregistrée', r.name);
            load();
          }
        });
      });

      list.querySelectorAll('[data-ok]').forEach(b => b.onclick = async function () {
        UI.busy(this, true);
        await API.safe(() => API.setRestaurantStatus(this.dataset.ok, 'approved'));
        UI.ok('Restaurant validé'); load();
      });
      list.querySelectorAll('[data-no]').forEach(b => b.onclick = async function () {
        const reason = await UI.prompt('Refuser le restaurant', 'Motif du refus', 'Ex : informations incomplètes', true);
        if (reason === null) return;
        await API.safe(() => API.setRestaurantStatus(this.dataset.no, 'rejected', reason));
        UI.ok('Restaurant refusé'); load();
      });
    }

    await load();
  }, GUARD);

  /* ======================================================================
     LIVREURS
     ====================================================================== */
  Router.add('/a/drivers', async function (params, query, view) {
    let filter = '', tous = [];

    view.innerHTML = page(
      head('Livreurs', 'Validez les comptes et suivez l’activité') +
      '<div id="filtres"></div>' +
      '<div id="list"><div class="skel" style="height:120px"></div></div>');

    const list = view.querySelector('#list');
    const filtres = view.querySelector('#filtres');

    function peindreFiltres() {
      const n = st => tous.filter(x => x.validation_status === st).length;
      filtres.innerHTML = filterBar('f', [
        { v: '',         i: 'grid',  l: 'Tous',       n: tous.length },
        { v: 'pending',  i: 'clock', l: 'En attente', n: n('pending') },
        { v: 'approved', i: 'check', l: 'Validés',    n: n('approved') },
        { v: 'rejected', i: 'warn',  l: 'Refusés',    n: n('rejected') }
      ], filter);
      filtres.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
        filter = b.dataset.f; peindreFiltres(); peindre();
      });
    }

    async function load() {
      tous = await API.safe(() => API.adminDrivers(null), []);
      peindreFiltres();
      peindre();
    }

    function peindre() {
      const rows = filter ? tous.filter(x => x.validation_status === filter) : tous;
      if (!rows.length) { list.innerHTML = UI.empty(UI.icon('scooter', 40), 'Aucun livreur', ''); return; }

      list.innerHTML = '<div class="stack">' + rows.map(d => {
        const p = d.profile || {};
        const etat = d.validation_status;
        return '<div class="adm-card drv ' + etat + '">' +
          '<div class="adm-row">' +
            UI.avatar(p.full_name, p.avatar_url, 62) +
            '<div class="grow">' +
              '<div class="row" style="gap:10px;flex-wrap:wrap">' +
                '<b class="adm-name">' + U.esc(p.full_name || '—') + '</b>' +
                '<span class="tag ' + (etat === 'approved' ? 'tag-ok' : etat === 'rejected' ? 'tag-danger' : 'tag-warn') + '">' +
                  (etat === 'approved' ? 'Validé' : etat === 'rejected' ? 'Refusé' : 'En attente') + '</span>' +
              '</div>' +
              '<div class="adm-line">' + UI.icon('mail', 14) + ' ' + U.esc(p.email || '—') +
                '<span class="sep">|</span>' + UI.icon('phone', 14) + ' ' + U.esc(p.phone || '—') + '</div>' +
              '<div class="adm-line">' + UI.icon('scooter', 14) + ' ' + U.esc(U.VEHICLES[d.vehicle] || d.vehicle) +
                (d.plate ? ' • ' + U.esc(d.plate) : '') +
                '<span class="sep">|</span>' + UI.icon('pin', 14) + ' ' + U.esc(d.zone ? d.zone.name : '—') + '</div>' +
              '<div class="adm-line">' + UI.icon('package', 14) + ' ' + (d.total_deliveries || 0) + ' livraisons' +
                '<span class="sep">|</span>' + UI.icon('wallet', 14) + ' ' + U.money(d.total_earnings || 0) + '</div>' +
              (d.reject_reason ? '<div class="adm-line danger">Motif : ' + U.esc(d.reject_reason) + '</div>' : '') +
            '</div>' +
            '<div class="adm-acts">' +
              (d.id_card_url ? '<a class="btn btn-ghost btn-sm" href="' + U.escUrl(d.id_card_url) +
                '" target="_blank" rel="noopener">' + UI.icon('image', 15) + ' Pièce ID</a>' : '') +
              (etat !== 'approved' ? '<button class="btn btn-ok btn-sm" data-ok="' + U.esc(d.id) + '">' +
                UI.icon('check', 15) + ' Valider</button>' : '') +
              (etat !== 'rejected' ? '<button class="btn btn-danger btn-sm" data-no="' + U.esc(d.id) + '">' +
                UI.icon('warn', 15) + ' Refuser</button>' : '') +
            '</div>' +
          '</div></div>';
      }).join('') + '</div>';

      list.querySelectorAll('[data-ok]').forEach(b => b.onclick = async function () {
        UI.busy(this, true);
        await API.safe(() => API.setDriverStatus(this.dataset.ok, 'approved'));
        UI.ok('Livreur validé'); load();
      });
      list.querySelectorAll('[data-no]').forEach(b => b.onclick = async function () {
        const reason = await UI.prompt('Refuser le livreur', 'Motif du refus', 'Ex : documents illisibles', true);
        if (reason === null) return;
        await API.safe(() => API.setDriverStatus(this.dataset.no, 'rejected', reason));
        UI.ok('Livreur refusé'); load();
      });
    }

    await load();
  }, GUARD);

  /* ======================================================================
     COMMANDES
     ====================================================================== */
  /* ======================================================================
     CRÉDITS DES LIVREURS

     Le livreur paie d'avance : chaque course acceptée prélève la part
     plateforme des frais de livraison. À zéro, il ne peut plus travailler.
     Cet écran sert à encaisser et à recharger — c'est ici que l'argent
     rentre vraiment.
     ====================================================================== */
  Router.add('/a/credits', async function (params, query, view) {
    /* page() : l'enveloppe qui porte le thème sombre de l'administration.
       Sans elle, cet écran reprenait la palette claire du site client et ses
       cartes ressortaient en blanc au milieu du noir. */
    view.innerHTML = page(
      head('Crédits des livreurs', 'Encaissez et rechargez les comptes') +
      '<div id="demandes"></div>' +
      '<div class="adm-search">' + UI.icon('search', 18) +
        '<input class="input" id="q" placeholder="Rechercher un livreur…" autocomplete="off"></div>' +
      '<div id="list"><div class="skel" style="height:180px"></div></div>');

    let term = '';
    let voirTout = false;          // demandes en attente, ou historique complet
    const list = view.querySelector('#list');

    /* Les demandes de recharge passent avant les soldes : c'est de l'argent
       qui attend d'être encaissé, et un livreur qui attend est un livreur
       qui ne travaille pas. */
    async function loadDemandes() {
      const dem = await API.safe(() => API.recharges(voirTout ? null : 'pending'), []);
      const box = view.querySelector('#demandes');
      if (!box) return;

      const enTete =
        '<div class="row-between" style="margin-bottom:8px">' +
          '<div class="h3">📨 Demandes de recharge' +
            (voirTout ? '' : dem.length ? ' (' + dem.length + ')' : '') + '</div>' +
          '<button class="btn btn-ghost btn-sm" id="bascule">' +
            (voirTout ? 'Voir les demandes en attente' : 'Voir l’historique') + '</button>' +
        '</div>';

      /* La section reste visible même vide : sans elle, un administrateur qui
         cherche « où valider une recharge ? » ne trouve rien et croit que la
         fonction n'existe pas. */
      if (!dem.length) {
        box.innerHTML = enTete +
          '<div class="card card-p" style="margin-bottom:14px">' +
            '<div class="tiny">' +
              (voirTout
                ? 'Aucune demande, ni en attente ni traitée.'
                : 'Aucune demande en attente. Les livreurs déclarent leurs versements ' +
                  'depuis leur portefeuille ; ils apparaîtront ici avec le reçu, ' +
                  'et vous validerez après vérification sur votre compte.') +
            '</div></div>';
        const b = box.querySelector('#bascule');
        if (b) b.onclick = () => { voirTout = !voirTout; loadDemandes(); };
        return;
      }

      box.innerHTML = enTete +
        dem.map(r => {
          const p = (r.driver && r.driver.profile) || {};
          const traitee = r.status !== 'pending';
          const etat = { approved: ['Validée', 'tag-ok'], rejected: ['Refusée', 'tag-danger'] }[r.status];
          return '<div class="card card-p" style="margin-bottom:10px' +
              (traitee ? '' : ';border-color:var(--warn)') + '">' +
            '<div class="row-between" style="gap:12px;flex-wrap:wrap">' +
              '<div><b>' + U.esc(p.full_name || p.email || 'Livreur') + '</b>' +
                (etat ? ' <span class="tag ' + etat[1] + '">' + etat[0] + '</span>' : '') +
                '<div class="tiny">' + U.esc(p.phone || '') + ' • ' + U.dt(r.created_at) + '</div>' +
                '<div class="tiny">' + U.esc(LIB_METHODE[r.method] || r.method) +
                  (r.reference ? ' • réf <b>' + U.esc(r.reference) + '</b>' : '') + '</div>' +
                '<div class="tiny">Crédit actuel : ' + U.money((r.driver && r.driver.credit_da) || 0) + '</div>' +
              '</div>' +
              '<div style="text-align:right"><div class="tiny">Montant déclaré</div>' +
                '<b style="font-size:19px">' + U.money(r.amount) + '</b></div>' +
            '</div>' +
            (r.proof_url
              ? '<a href="' + U.escUrl(r.proof_url) + '" target="_blank" rel="noopener" ' +
                'style="display:block;margin-top:10px">' +
                '<img src="' + U.escUrl(r.proof_url) + '" alt="Reçu" ' +
                'style="max-height:180px;border-radius:12px;border:1px solid var(--line)"></a>'
              : '<div class="tiny" style="margin-top:8px">Aucun reçu joint.</div>') +
            (traitee
              ? '<div class="tiny" style="margin-top:10px">Traitée le ' + U.dt(r.reviewed_at) +
                (r.reason ? ' — ' + U.esc(r.reason) : '') + '</div>'
              : '<div class="row" style="gap:9px;margin-top:12px">' +
                  '<button class="btn btn-ghost btn-sm" data-no="' + U.esc(r.id) + '">Refuser</button>' +
                  '<button class="btn btn-primary grow" data-yes="' + U.esc(r.id) + '">' +
                    '✅ Valider et créditer ' + U.money(r.amount) + '</button>' +
                '</div>') + '</div>';
        }).join('');

      const bascule = box.querySelector('#bascule');
      if (bascule) bascule.onclick = () => { voirTout = !voirTout; loadDemandes(); };

      box.querySelectorAll('[data-yes]').forEach(b => b.onclick = async function () {
        if (!(await UI.confirm('Créditer ce livreur ?',
              'Vérifiez que le versement est bien arrivé sur votre compte avant de valider.',
              'Valider', false))) return;
        UI.busy(this, true);
        try {
          const solde = await API.approveRecharge(this.dataset.yes);
          UI.ok('Recharge validée', 'Nouveau crédit : ' + U.money(solde));
          load();
        } catch (e) { UI.busy(this, false); UI.err(e.message); }
      });

      box.querySelectorAll('[data-no]').forEach(b => b.onclick = async function () {
        const motif = await UI.prompt('Refuser la demande', 'Motif communiqué au livreur',
          'Aucun versement retrouvé');
        if (motif === null) return;
        try {
          await API.rejectRecharge(this.dataset.no, motif);
          UI.ok('Demande refusée');
          load();
        } catch (e) { UI.err(e.message); }
      });
    }

    async function load() {
      await loadDemandes();
      const rows = await API.safe(() => API.driverCredits(), []);
      const t = term.toLowerCase();
      const vus = rows.filter(r => !t || (
        ((r.profile && r.profile.full_name) || '').toLowerCase().indexOf(t) >= 0 ||
        ((r.profile && r.profile.phone) || '').indexOf(t) >= 0 ||
        ((r.profile && r.profile.email) || '').toLowerCase().indexOf(t) >= 0));

      if (!vus.length) {
        list.innerHTML = UI.empty('💳', 'Aucun livreur',
          'Les comptes livreurs validés apparaîtront ici avec leur crédit.');
        return;
      }

      const bloques = vus.filter(r => (r.credit_da || 0) <= 0).length;

      list.innerHTML =
        (bloques
          ? '<div class="banner banner-warn" style="margin-bottom:12px">🚫 <div class="grow">' +
            '<b>' + bloques + ' livreur' + (bloques > 1 ? 's' : '') + ' bloqué' + (bloques > 1 ? 's' : '') +
            '</b> — crédit épuisé, ' + (bloques > 1 ? 'ils ne peuvent' : 'il ne peut') +
            ' plus accepter de course.</div></div>'
          : '') +
        vus.map(r => {
          const solde = r.credit_da || 0;
          const p = r.profile || {};
          return '<div class="card card-p" style="margin-bottom:10px' +
              (solde <= 0 ? ';border-color:var(--danger)' : '') + '">' +
            '<div class="row-between" style="gap:12px;flex-wrap:wrap">' +
              '<div class="row" style="gap:12px">' +
                UI.avatar(p.full_name, null, 42) +
                '<div><b>' + U.esc(p.full_name || p.email || 'Livreur') + '</b>' +
                  '<div class="tiny">' + U.esc(p.phone || '') +
                    (r.zone && r.zone.name ? ' • ' + U.esc(r.zone.name) : '') +
                    (r.validation_status !== 'approved'
                      ? ' • <span class="tag tag-warn">non validé</span>' : '') +
                  '</div></div>' +
              '</div>' +
              '<div class="row" style="gap:10px">' +
                '<div style="text-align:right">' +
                  '<div class="tiny">Crédit</div>' +
                  '<b style="font-size:17px;color:' + (solde <= 0 ? 'var(--danger)' : 'inherit') + '">' +
                    U.money(solde) + '</b></div>' +
                '<button class="btn btn-primary btn-sm" data-load="' + U.esc(r.id) + '">Recharger</button>' +
                '<button class="btn btn-ghost btn-sm" data-hist="' + U.esc(r.id) + '">Carnet</button>' +
              '</div>' +
            '</div></div>';
        }).join('');

      list.querySelectorAll('[data-load]').forEach(b => b.onclick = () =>
        rechargeSheet(vus.find(x => x.id === b.dataset.load), load));
      list.querySelectorAll('[data-hist]').forEach(b => b.onclick = () =>
        carnetSheet(vus.find(x => x.id === b.dataset.hist)));
    }

    view.querySelector('#q').oninput = U.debounce(function () { term = this.value.trim(); load(); }, 300);
    await load();
  }, GUARD);

  function rechargeSheet(r, onSaved) {
    const p = (r && r.profile) || {};
    UI.sheet({
      title: 'Recharger ' + (p.full_name || ''),
      subtitle: 'Crédit actuel : ' + U.money(r.credit_da || 0),
      body: '<form id="rf" class="stack" novalidate>' +
        '<div class="field"><label>Montant reçu (DA)</label>' +
          '<input class="input" name="amount" type="number" step="100" value="2000" required>' +
          '<div class="hint">Montant que le livreur vient de vous verser. ' +
            'Un montant négatif corrige une erreur de saisie.</div></div>' +
        '<div class="field"><label>Note <span class="tiny">(facultatif)</span></label>' +
          '<input class="input" name="note" placeholder="Ex : espèces, reçu n°12"></div>' +
        '<div class="row" style="gap:8px;flex-wrap:wrap">' +
          [1000, 2000, 3000, 5000].map(v =>
            '<button type="button" class="btn btn-soft btn-sm" data-quick="' + v + '">' +
              U.money(v) + '</button>').join('') +
        '</div>' +
      '</form>',
      footer: '<button class="btn btn-primary btn-block" id="ok">Enregistrer le versement</button>',
      onMount(el, api) {
        const champ = el.querySelector('[name=amount]');
        el.querySelectorAll('[data-quick]').forEach(b => b.onclick = () => { champ.value = b.dataset.quick; });

        el.querySelector('#ok').onclick = async function () {
          const d = UI.formData(el.querySelector('#rf'));
          const montant = Math.round(+d.amount || 0);
          if (!montant) return UI.err('Indiquez un montant');
          UI.busy(this, true);
          try {
            const solde = await API.rechargeDriver(r.id, montant, d.note || null);
            api.close();
            UI.ok('Versement enregistré', 'Nouveau crédit : ' + U.money(solde));
            onSaved && onSaved();
          } catch (e) { UI.busy(this, false); UI.err(e.message); }
        };
      }
    });
  }

  function carnetSheet(r) {
    const p = (r && r.profile) || {};
    const m = UI.sheet({
      title: 'Carnet de ' + (p.full_name || ''),
      subtitle: 'Crédit actuel : ' + U.money(r.credit_da || 0),
      body: '<div id="w"><div class="skel" style="height:120px"></div></div>'
    });

    API.safe(() => API.driverWallet(r.id, 60), []).then(lignes => {
      const box = m.el.querySelector('#w');
      if (!box) return;
      box.innerHTML = lignes.length
        ? lignes.map(l =>
            '<div class="oline"><span class="l"><b>' + U.esc(LIB_MVT[l.kind] || l.kind) + '</b>' +
              (l.note ? '<br><span class="tiny">' + U.esc(l.note) + '</span>' : '') +
              '<br><span class="tiny">' + U.dt(l.created_at) + '</span></span>' +
            '<span style="text-align:right"><b style="color:' +
              (l.amount >= 0 ? 'var(--ok)' : 'var(--danger)') + '">' +
              (l.amount >= 0 ? '+' : '') + U.money(l.amount) + '</b>' +
            '<br><span class="tiny">reste ' + U.money(l.balance_after) + '</span></span></div>').join('')
        : UI.empty('🧾', 'Aucun mouvement', 'Ce livreur n’a encore ni recharge ni course.');
    });
  }

  const LIB_MVT = {
    recharge: 'Recharge', commission: 'Commission de course',
    remboursement: 'Remboursement', ajustement: 'Correction'
  };

  const LIB_METHODE = {
    baridimob: 'BaridiMob', ccp: 'Versement CCP',
    especes: 'Espèces', carte: 'Carte bancaire', autre: 'Autre'
  };

  Router.add('/a/orders', async function (params, query, view) {
    view.innerHTML = page(
      head('Toutes les commandes', 'Suivi global de la plateforme') +
      '<div id="list"><div class="skel" style="height:200px"></div></div>');

    const rows = await API.safe(() => API.adminOrders({ limit: 200 }), []);
    view.querySelector('#list').innerHTML = rows.length
      ? ordersTable(rows)
      : UI.empty(UI.icon('receipt', 40), 'Aucune commande', '');
  }, GUARD);

  function ordersTable(rows) {
    return '<div class="adm-table"><table><thead><tr>' +
      '<th>Code</th><th>Client</th><th>Restaurant</th><th>Livreur</th>' +
      '<th>Total</th><th>Commission</th><th>Statut</th><th>Date</th>' +
      '</tr></thead><tbody>' +
      /* data-l : sur téléphone le tableau devient une liste de fiches, et
         c'est cet attribut qui réaffiche l'intitulé devant chaque valeur.
         La classe « tete » désigne la cellule qui sert de titre de fiche. */
      rows.map(o => '<tr>' +
        '<td class="tete"><span class="ocode">#' + U.esc(o.code) + '</span></td>' +
        '<td class="ic-cell" data-l="Client">' + UI.icon('user', 15) + ' ' +
          U.esc(o.client_name || (o.client && o.client.full_name) || '—') + '</td>' +
        '<td class="ic-cell" data-l="Restaurant">' + UI.icon('store', 15) + ' ' +
          U.esc(o.restaurant ? o.restaurant.name : '—') + '</td>' +
        '<td class="ic-cell" data-l="Livreur">' + (o.driver
          ? UI.icon('scooter', 15) + ' ' + U.esc(o.driver.full_name)
          : '<span class="vide">—</span>') + '</td>' +
        '<td data-l="Total"><b class="montant">' + U.money(o.total) + '</b></td>' +
        '<td data-l="Commission">' + U.money(o.commission) + '</td>' +
        '<td data-l="Statut">' + UI.tag(o.status) + '</td>' +
        '<td class="ic-cell tiny" data-l="Date">' + UI.icon('clock', 14) + ' ' + U.dt(o.created_at) + '</td>' +
      '</tr>').join('') + '</tbody></table></div>';
  }

  /* ======================================================================
     UTILISATEURS
     ====================================================================== */
  Router.add('/a/users', async function (params, query, view) {
    let role = '', term = '', tous = [];

    view.innerHTML = page(
      head('Utilisateurs', 'Gérez les comptes des utilisateurs de la plateforme') +
      '<div class="adm-search">' + UI.icon('search', 18) +
        '<input class="input" id="q" placeholder="Nom ou email…"></div>' +
      '<div id="filtres"></div>' +
      '<div id="list"><div class="skel" style="height:200px"></div></div>');

    const list = view.querySelector('#list');
    const filtres = view.querySelector('#filtres');

    function peindreFiltres() {
      const n = r => tous.filter(x => x.role === r).length;
      filtres.innerHTML = filterBar('r', [
        { v: '',           i: 'users',    l: 'Tous',        n: tous.length },
        { v: 'client',     i: 'user',     l: 'Clients',     n: n('client') },
        { v: 'restaurant', i: 'store',    l: 'Restaurants', n: n('restaurant') },
        { v: 'driver',     i: 'scooter',  l: 'Livreurs',    n: n('driver') },
        { v: 'admin',      i: 'settings', l: 'Admins',      n: n('admin') }
      ], role);
      filtres.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
        role = b.dataset.r; peindreFiltres(); load();
      });
    }

    async function load() {
      /* la recherche est faite par le backend ; les compteurs, eux, portent
         sur tout le résultat de la recherche, tous rôles confondus */
      tous = await API.safe(() => API.adminUsers({ q: term || null }), []);
      peindreFiltres();
      const rows = role ? tous.filter(x => x.role === role) : tous;
      if (!rows.length) { list.innerHTML = UI.empty(UI.icon('users', 40), 'Aucun utilisateur', ''); return; }

      list.innerHTML = '<div class="adm-table"><table><thead><tr>' +
        '<th>Utilisateur</th><th>Rôle</th><th>Téléphone</th><th>Zone</th><th>Statut</th><th>Inscrit</th><th>Actions</th>' +
        '</tr></thead><tbody>' +
        rows.map(u => '<tr' + (u.is_blocked ? ' class="bloque"' : '') + '>' +
          '<td class="tete"><div class="adm-user">' + UI.avatar(u.full_name, u.avatar_url, 38) +
            '<div><b>' + U.esc(u.full_name || '—') + '</b>' +
            '<div class="tiny">' + U.esc(u.email || '') + '</div></div></div></td>' +
          '<td data-l="Rôle"><span class="adm-role ' + U.esc(u.role) + '">' + UI.icon(ROLE_ICON[u.role] || 'user', 14) +
            ' ' + U.esc(roleLabel(u.role)) + '</span></td>' +
          '<td class="ic-cell" data-l="Téléphone">' + (u.phone ? UI.icon('phone', 15) + ' ' + U.esc(u.phone) : '<span class="vide">—</span>') + '</td>' +
          '<td class="ic-cell" data-l="Zone">' + (u.zone ? UI.icon('pin', 15) + ' ' + U.esc(u.zone.name) : '<span class="vide">—</span>') + '</td>' +
          '<td data-l="Statut">' + (u.is_blocked
            ? '<span class="tag tag-danger">● Bloqué</span>'
            : '<span class="tag tag-ok">● Actif</span>') + '</td>' +
          '<td class="ic-cell tiny" data-l="Inscrit">' + UI.icon('calendar', 14) + ' ' + U.dt(u.created_at) + '</td>' +
          '<td class="actions"><div class="row" style="gap:6px">' +
            '<button class="btn btn-ghost btn-sm" data-edit="' + U.esc(u.id) + '">' +
              UI.icon('pencil', 14) + ' Modifier</button>' +
            (u.role !== 'admin'
              ? '<button class="btn ' + (u.is_blocked ? 'btn-ok' : 'btn-danger') + ' btn-sm" data-block="' + U.esc(u.id) +
                '" data-v="' + (u.is_blocked ? '0' : '1') + '">' + UI.icon(u.is_blocked ? 'check' : 'trash', 14) +
                ' ' + (u.is_blocked ? 'Débloquer' : 'Bloquer') + '</button>'
              : '') +
          '</div></td>' +
        '</tr>').join('') + '</tbody></table></div>';

      list.querySelectorAll('[data-block]').forEach(b => b.onclick = async function () {
        const blocked = this.dataset.v === '1';
        if (blocked && !(await UI.confirm('Bloquer ce compte ?', 'L’utilisateur ne pourra plus se connecter.', 'Bloquer', true))) return;
        await API.safe(() => API.setUserBlocked(this.dataset.block, blocked));
        UI.ok(blocked ? 'Compte bloqué' : 'Compte débloqué'); load();
      });

      list.querySelectorAll('[data-edit]').forEach(b => b.onclick = () =>
        userSheet(rows.find(x => x.id === b.dataset.edit), load));
    }

    view.querySelector('#q').oninput = U.debounce(function () { term = this.value.trim(); load(); }, 300);
    await load();
  }, GUARD);

  function roleLabel(r) {
    return { client: 'Client', restaurant: 'Restaurant', driver: 'Livreur', admin: 'Admin' }[r] || r;
  }

  const ROLE_ICON = { client: 'user', restaurant: 'store', driver: 'scooter', admin: 'settings' };

  function userSheet(u, onSaved) {
    /* Se rétrograder soi-même ferme la porte de l'intérieur : plus d'espace
       admin, donc plus moyen de se redonner le rôle. Seul l'éditeur SQL de
       Supabase pourrait rattraper le coup. */
    const moi = Store.profile && u.id === Store.profile.id;

    UI.sheet({
      title: 'Modifier ' + (u.full_name || u.email),
      body: '<form id="uf" class="stack" novalidate>' +
        '<div class="field"><label>Nom complet</label>' +
          '<input class="input" name="full_name" value="' + U.esc(u.full_name || '') + '"></div>' +
        '<div class="field"><label>Téléphone</label>' +
          '<input class="input" name="phone" value="' + U.esc(u.phone || '') + '"></div>' +
        '<div class="field"><label>Rôle</label><select class="input" name="role"' +
          (moi ? ' disabled' : '') + '>' +
          ['client', 'restaurant', 'driver', 'admin'].map(r =>
            '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + roleLabel(r) + '</option>').join('') +
        '</select>' +
        (moi ? '<div class="tiny" style="margin-top:6px">C’est votre propre compte : ' +
               'vous ne pouvez pas changer votre rôle vous-même.</div>' : '') +
        '</div>' +
        Cmp.zoneSelect('zone_id', u.zone_id, 'Zone') +
      '</form>',
      footer: '<button class="btn btn-primary btn-block" id="save">Enregistrer</button>',
      onMount(el, api) {
        el.querySelector('#save').onclick = async function () {
          const d = UI.formData(el.querySelector('#uf'));
          // un champ désactivé n'est pas transmis : on ne touche pas au rôle
          if (moi) delete d.role;
          UI.busy(this, true);
          try {
            await API.adminUpdateUser(u.id, d);
            api.close(); UI.ok('Utilisateur mis à jour'); onSaved && onSaved();
          } catch (e) { UI.busy(this, false); UI.err(e.message); }
        };
      }
    });
  }

  /* ======================================================================
     RÉGLAGES (commissions, zones, catégories)
     ====================================================================== */
  Router.add('/a/settings', async function (params, query, view) {
    const s = await API.safe(() => API.settings(), {}) || {};

    function paint() {
      view.innerHTML = page(
        head('Réglages de la plateforme', 'Commissions, délais, zones de livraison et catégories') +

        /* --- commissions --- */
        '<form id="sf" class="card card-p stack">' +
          '<div class="h3">' + UI.icon('wallet', 18) + ' Commissions</div>' +
          '<div class="field"><label>Commission plateforme (%)</label>' +
            '<input class="input" name="commission_rate" type="number" min="0" max="50" step="0.5" value="' +
            (((s.commission_rate != null ? s.commission_rate : 0.1) * 100).toFixed(1)) + '">' +
            '<div class="hint">Prélevée sur le sous-total de chaque commande livrée.</div></div>' +
          '<div class="field"><label>Part du livreur sur les frais de livraison (%)</label>' +
            '<input class="input" name="driver_share" type="number" min="0" max="100" step="1" value="' +
            (((s.driver_share != null ? s.driver_share : 0.8) * 100).toFixed(0)) + '"></div>' +
          '<div class="divider"></div>' +

          /* --- barème de livraison --- */
          '<div class="h3">' + UI.icon('scooter', 18) + ' Frais de livraison</div>' +
          '<div class="hint" style="margin-bottom:8px">Le tarif dépend de la distance entre le ' +
            'restaurant et le client, mesurée sur leurs positions GPS. Un livreur qui traverse la ' +
            'ville n’est pas payé comme celui qui livre l’immeuble d’en face.</div>' +
          '<div class="grid grid-2" style="gap:10px">' +
            '<div class="field"><label>Courte distance (DA)</label>' +
              '<input class="input" name="fee_near_da" type="number" min="0" step="50" value="' +
              (s.fee_near_da != null ? s.fee_near_da : 250) + '"></div>' +
            '<div class="field"><label>Jusqu’à (km)</label>' +
              '<input class="input" name="near_km" type="number" min="1" max="100" step="0.5" value="' +
              (s.near_km != null ? s.near_km : 10) + '"></div>' +
            '<div class="field"><label>Longue distance (DA)</label>' +
              '<input class="input" name="fee_far_da" type="number" min="0" step="50" value="' +
              (s.fee_far_da != null ? s.fee_far_da : 400) + '"></div>' +
            '<div class="field"><label>Livraison max (km)</label>' +
              '<input class="input" name="max_km" type="number" min="1" max="100" step="0.5" value="' +
              (s.max_km != null ? s.max_km : 15) + '"></div>' +
          '</div>' +
          '<div class="hint">Au-delà de la distance maximale, la commande est refusée — au moment ' +
            'de la valider, pas après. Le client le voit avant de payer.</div>' +
          '<div class="divider"></div>' +

          /* --- coordonnées de versement --- */
          '<div class="h3">' + UI.icon('wallet', 18) + ' Coordonnées de versement</div>' +
          '<div class="field"><label>Affichées au livreur qui veut recharger</label>' +
            '<textarea class="input" name="payment_info" rows="4" ' +
              'placeholder="CCP : 0012345678 clé 45&#10;RIP : 007 99999 0012345678 45&#10;' +
              'Bénéficiaire : BRIK Mohamed">' +
              U.esc(s.payment_info || '') + '</textarea>' +
            '<div class="hint">Le livreur verse par BaridiMob ou au guichet, puis déclare son ' +
              'versement depuis son portefeuille. Vous validez après vérification sur votre compte.</div></div>' +
          '<div class="divider"></div>' +
          '<div class="h3">' + UI.icon('clock', 18) + ' Délais de réponse</div>' +
          '<div class="field"><label>Réponse du restaurant (minutes)</label>' +
            '<input class="input" name="resto_timeout_min" type="number" min="1" max="60" step="1" value="' +
            Math.round((s.resto_timeout_s != null ? s.resto_timeout_s : 300) / 60) + '">' +
            '<div class="hint">Passé ce délai, la commande est refusée automatiquement et le client ' +
            'est prévenu. Il vaut mieux un refus franc qu’une attente sans fin.</div></div>' +
          '<div class="field"><label>Réponse du livreur (secondes)</label>' +
            '<input class="input" name="driver_timeout_s" type="number" min="10" max="300" step="5" value="' +
            (s.driver_timeout_s != null ? s.driver_timeout_s : 30) + '">' +
            '<div class="hint">La course est proposée à un livreur à la fois. Sans réponse, elle passe ' +
            'au suivant — le plus proche du restaurant parmi ceux qui sont en ligne.</div></div>' +
          '<div class="grid grid-2" style="gap:10px">' +
            '<div class="field"><label>Rayon de proximité (km)</label>' +
              '<input class="input" name="driver_radius_km" type="number" min="1" max="30" step="0.5" value="' +
              (s.driver_radius_km != null ? s.driver_radius_km : 7) + '"></div>' +
            '<div class="field"><label>Position valable pendant (minutes)</label>' +
              '<input class="input" name="position_max_age_min" type="number" min="1" max="60" step="1" value="' +
              Math.round((s.position_max_age_s != null ? s.position_max_age_s : 600) / 60) + '"></div>' +
          '</div>' +
          '<div class="hint">La course part au livreur en ligne le plus proche du restaurant dans ce ' +
            'rayon. Un livreur dont la position n’a pas été reçue depuis ce délai est considéré comme ' +
            'non situé : il passe après ceux que l’on sait placer, jamais avant.</div>' +
          '<div class="field"><label>Nouvelle tentative si personne ne répond (secondes)</label>' +
            '<input class="input" name="redispatch_after_s" type="number" min="15" max="600" step="15" value="' +
            (s.redispatch_after_s != null ? s.redispatch_after_s : 60) + '">' +
            '<div class="hint">Quand tous les livreurs ont laissé passer leur tour, un tour complet ' +
            'est relancé après ce délai. Une course n’est jamais abandonnée.</div></div>' +
          '<button class="btn btn-primary" type="submit">Enregistrer</button>' +
        '</form>' +

        /* --- zones --- */
        '<div class="card card-p" style="margin-top:16px">' +
          '<div class="row-between" style="margin-bottom:12px">' +
            '<div class="h3">' + UI.icon('pin', 18) + ' Quartiers de livraison</div>' +
            '<button class="btn btn-soft btn-sm" id="addZone">+ Ajouter</button></div>' +
          '<div class="chips" style="flex-wrap:wrap;overflow:visible">' +
            Store.zones.map(z => '<span class="chip" data-zone="' + U.esc(z.id) + '">' + UI.pin(14) + ' ' +
              U.esc(z.name) + ' <b style="opacity:.4">✕</b></span>').join('') +
          '</div></div>' +

        /* --- catégories --- */
        '<div class="card card-p" style="margin-top:16px">' +
          '<div class="row-between" style="margin-bottom:12px">' +
            '<div class="h3">' + UI.icon('utensils', 18) + ' Catégories</div>' +
            '<button class="btn btn-soft btn-sm" id="addCat">+ Ajouter</button></div>' +
          '<div class="chips" style="flex-wrap:wrap;overflow:visible">' +
            Store.categories.map(c => '<span class="chip" data-cat2="' + U.esc(c.id) + '" ' +
              'style="display:inline-flex;align-items:center;gap:7px">' +
              (c.image_url
                ? '<img src="' + U.escUrl(c.image_url) + '" alt="" style="width:24px;height:24px;' +
                  'border-radius:50%;object-fit:cover">'
                : '<span>' + (c.icon || '🍽️') + '</span>') +
              U.esc(c.name_fr) + ' <b style="opacity:.4">✕</b></span>').join('') +
          '</div></div>');

      view.querySelector('#sf').onsubmit = async function (e) {
        e.preventDefault();
        const btn = this.querySelector('[type=submit]');
        const d = UI.formData(this);
        UI.busy(btn, true);
        const r = await API.safe(() => API.saveSettings({
          commission_rate: (+d.commission_rate || 0) / 100,
          driver_share: (+d.driver_share || 0) / 100,
          fee_near_da: +d.fee_near_da || 0,
          fee_far_da: +d.fee_far_da || 0,
          near_km: +d.near_km || 10,
          max_km: +d.max_km || 15,
          payment_info: d.payment_info || null,
          // saisi en minutes, stocké en secondes comme les deux autres délais
          resto_timeout_s: Math.max(60, (+d.resto_timeout_min || 5) * 60),
          driver_timeout_s: Math.max(10, +d.driver_timeout_s || 30),
          redispatch_after_s: Math.max(15, +d.redispatch_after_s || 60),
          driver_radius_km: Math.max(1, +d.driver_radius_km || 7),
          position_max_age_s: Math.max(60, (+d.position_max_age_min || 10) * 60)
        }), null);
        UI.busy(btn, false);
        if (r) { Store.settings = r; UI.ok('Réglages enregistrés'); }
      };

      view.querySelector('#addZone').onclick = async () => {
        const name = await UI.prompt('Nouveau quartier', 'Nom du quartier', 'Ex : Boukhalfa');
        if (!name) return;
        await API.safe(() => API.saveZone({ name: name, wilaya: TALABI_CONFIG.DEFAULT_WILAYA }));
        Store.zones = await API.zones();
        UI.ok('Zone ajoutée'); paint();
      };

      view.querySelectorAll('[data-zone]').forEach(el => el.onclick = async () => {
        const z = Store.zones.find(x => x.id === el.dataset.zone);
        if (!(await UI.confirm('Supprimer le quartier « ' + z.name + ' » ?',
          'Les restaurants et livreurs de ce quartier perdront leur rattachement.', 'Supprimer', true))) return;
        await API.safe(() => API.deleteZone(z.id));
        Store.zones = await API.zones();
        if (Store.zoneId === z.id) Store.setZone(null);
        UI.ok('Zone supprimée'); paint();
      });

      view.querySelector('#addCat').onclick = async () => {
        const name = await UI.prompt('Nouvelle catégorie', 'Nom de la catégorie', 'Ex : Poissons');
        if (!name) return;
        const icon = await UI.prompt('Icône', 'Un emoji représentatif', '🐟');
        await API.safe(() => API.saveCategory({ name_fr: name, icon: icon || '🍽️' }));
        Store.categories = await API.categories();
        UI.ok('Catégorie ajoutée'); paint();
      };

      view.querySelectorAll('[data-cat2]').forEach(el => el.onclick = async () => {
        const c = Store.categories.find(x => x.id === el.dataset.cat2);
        if (!(await UI.confirm('Supprimer « ' + c.name_fr + ' » ?', 'Les plats de cette catégorie deviendront « Autres ».', 'Supprimer', true))) return;
        await API.safe(() => API.deleteCategory(c.id));
        Store.categories = await API.categories();
        UI.ok('Catégorie supprimée'); paint();
      });
    }

    paint();
  }, GUARD);
})(window);
