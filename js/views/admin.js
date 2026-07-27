/* ==========================================================================
   ESPACE ADMINISTRATEUR
   ========================================================================== */
(function (w) {
  'use strict';

  const GUARD = { auth: true, roles: ['admin'] };

  function adminTabs(active) {
    const t = [
      ['/a', '📊 Tableau'], ['/a/restaurants', '🏪 Restaurants'], ['/a/drivers', '🛵 Livreurs'],
      ['/a/orders', '🧾 Commandes'], ['/a/users', '👥 Utilisateurs'], ['/a/settings', '⚙️ Réglages']
    ];
    return '<div class="tabs" style="margin-bottom:18px">' +
      t.map(x => '<button onclick="Router.go(\'' + x[0] + '\')" class="' + (x[0] === active ? 'on' : '') + '">' +
        x[1] + '</button>').join('') + '</div>';
  }

  /* ======================================================================
     TABLEAU DE BORD
     ====================================================================== */
  Router.add('/a', async function (params, query, view) {
    view.innerHTML = '<div class="wrap page">' + adminTabs('/a') + '<div class="skel" style="height:220px"></div></div>';

    const s = await API.safe(() => API.adminStats(), null);
    const recent = await API.safe(() => API.adminOrders({ limit: 8 }), []);
    if (!s) return;

    view.innerHTML = '<div class="wrap page">' +
      adminTabs('/a') +
      Cmp.pageHead('Vue d’ensemble', 'Activité de la plateforme ' + TALABI_CONFIG.APP_NAME) +

      '<div class="grid grid-stats">' +
        UI.stat('Utilisateurs', U.num(s.users), '👥') +
        UI.stat('Restaurants actifs', U.num(s.restaurants), '🏪') +
        UI.stat('Livreurs validés', U.num(s.drivers), '🛵') +
        UI.stat('Commandes totales', U.num(s.orders), '🧾') +
      '</div>' +

      '<div class="grid grid-stats" style="margin-top:14px">' +
        UI.stat('Commandes en cours', U.num(s.active_orders), '🔥') +
        UI.stat('Livrées', U.num(s.delivered), '✅') +
        UI.stat('Volume d’affaires', U.money(s.gmv), '💳') +
        UI.stat('Revenus plateforme', U.money(s.revenue), '💰') +
      '</div>' +

      ((s.pending_restaurants || s.pending_drivers)
        ? '<div class="card card-p" style="margin-top:18px;border-color:var(--warn)">' +
          '<div class="h3" style="margin-bottom:10px">⏳ En attente de validation</div>' +
          '<div class="row" style="gap:10px;flex-wrap:wrap">' +
            (s.pending_restaurants ? '<a class="btn btn-primary btn-sm" href="#/a/restaurants">' +
              s.pending_restaurants + ' restaurant(s)</a>' : '') +
            (s.pending_drivers ? '<a class="btn btn-primary btn-sm" href="#/a/drivers">' +
              s.pending_drivers + ' livreur(s)</a>' : '') +
          '</div></div>'
        : '') +

      '<div class="section-head"><div class="h2">Dernières commandes</div>' +
        '<a class="link" href="#/a/orders">Tout voir →</a></div>' +
      ordersTable(recent) +
    '</div>';
  }, GUARD);

  /* ======================================================================
     RESTAURANTS
     ====================================================================== */
  Router.add('/a/restaurants', async function (params, query, view) {
    let filter = '';

    view.innerHTML = '<div class="wrap page">' + adminTabs('/a/restaurants') +
      Cmp.pageHead('Restaurants', 'Validez les inscriptions et gérez les fiches') +
      '<div class="tabs" style="margin-bottom:16px">' +
        '<button data-f="" class="on">Tous</button>' +
        '<button data-f="pending">En attente</button>' +
        '<button data-f="approved">Validés</button>' +
        '<button data-f="rejected">Refusés</button>' +
      '</div><div id="list"><div class="skel" style="height:120px"></div></div></div>';

    const list = view.querySelector('#list');

    async function load() {
      const rows = await API.safe(() => API.adminRestaurants(filter || null), []);
      if (!rows.length) { list.innerHTML = UI.empty('🏪', 'Aucun restaurant', ''); return; }

      list.innerHTML = '<div class="stack">' + rows.map(r =>
        '<div class="card card-p">' +
          '<div class="row-between" style="align-items:flex-start;gap:12px">' +
            '<div class="grow"><div class="row" style="gap:9px">' +
              '<b style="font-size:15.5px">' + U.esc(r.name) + '</b>' +
              '<span class="tag ' + (r.status === 'approved' ? 'tag-ok' : r.status === 'rejected' ? 'tag-danger' : 'tag-warn') + '">' +
                (r.status === 'approved' ? 'Validé' : r.status === 'rejected' ? 'Refusé' : 'En attente') + '</span>' +
              (r.open_now ? '<span class="tag tag-info">Ouvert</span>' : '') +
            '</div>' +
            '<div class="tiny" style="margin-top:6px">📍 ' + U.esc(r.address || '—') +
              (r.zone ? ' — ' + U.esc(r.zone.name) : '') + '</div>' +
            '<div class="tiny">📞 ' + U.esc(r.phone || '—') + ' • 🛵 ' + U.money(r.delivery_fee) + '</div>' +
            '<div class="tiny">' + (U.hasCoords(r)
              ? (r.gps_verified === false
                  ? '<span style="color:var(--warn);font-weight:700">📍 position approximative — à vérifier</span>'
                  : '📍 <a target="_blank" rel="noopener" style="color:var(--brand);font-weight:650" href="' +
                    U.gmapsPin(r.lat, r.lng) + '">voir sur Google Maps ↗</a>')
              : '<span style="color:var(--danger);font-weight:700">📍 aucune position GPS</span>') + '</div>' +
            '<div class="tiny">👤 ' + U.esc(r.owner ? (r.owner.full_name + ' — ' + r.owner.email) : '—') + '</div>' +
            (r.reject_reason ? '<div class="tiny" style="color:var(--danger)">Motif : ' + U.esc(r.reject_reason) + '</div>' : '') +
            '</div>' +
          '</div>' +
          '<div class="row" style="gap:9px;margin-top:13px;flex-wrap:wrap">' +
            (r.status !== 'approved' ? '<button class="btn btn-ok btn-sm" data-ok="' + U.esc(r.id) + '">✅ Valider</button>' : '') +
            (r.status !== 'rejected' ? '<button class="btn btn-danger btn-sm" data-no="' + U.esc(r.id) + '">⛔ Refuser</button>' : '') +
            '<button class="btn btn-ghost btn-sm" data-pos="' + U.esc(r.id) + '">📍 Position</button>' +
            '<a class="btn btn-ghost btn-sm" href="#/resto/' + U.esc(r.id) + '">Voir la fiche</a>' +
          '</div>' +
        '</div>').join('') + '</div>';

      list.querySelectorAll('[data-pos]').forEach(b => b.onclick = function () {
        const r = rows.find(x => x.id === this.dataset.pos);
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

    view.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
      filter = b.dataset.f;
      view.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b));
      load();
    });
    await load();
  }, GUARD);

  /* ======================================================================
     LIVREURS
     ====================================================================== */
  Router.add('/a/drivers', async function (params, query, view) {
    let filter = '';

    view.innerHTML = '<div class="wrap page">' + adminTabs('/a/drivers') +
      Cmp.pageHead('Livreurs', 'Validez les comptes et suivez l’activité') +
      '<div class="tabs" style="margin-bottom:16px">' +
        '<button data-f="" class="on">Tous</button>' +
        '<button data-f="pending">En attente</button>' +
        '<button data-f="approved">Validés</button>' +
        '<button data-f="rejected">Refusés</button>' +
      '</div><div id="list"><div class="skel" style="height:120px"></div></div></div>';

    const list = view.querySelector('#list');

    async function load() {
      const rows = await API.safe(() => API.adminDrivers(filter || null), []);
      if (!rows.length) { list.innerHTML = UI.empty('🛵', 'Aucun livreur', ''); return; }

      list.innerHTML = '<div class="stack">' + rows.map(d => {
        const p = d.profile || {};
        return '<div class="card card-p">' +
          '<div class="row" style="gap:12px;align-items:flex-start">' +
            UI.avatar(p.full_name, p.avatar_url, 44) +
            '<div class="grow">' +
              '<div class="row" style="gap:9px"><b style="font-size:15px">' + U.esc(p.full_name || '—') + '</b>' +
                '<span class="tag ' + (d.validation_status === 'approved' ? 'tag-ok' :
                  d.validation_status === 'rejected' ? 'tag-danger' : 'tag-warn') + '">' +
                  (d.validation_status === 'approved' ? 'Validé' : d.validation_status === 'rejected' ? 'Refusé' : 'En attente') + '</span>' +
              '</div>' +
              '<div class="tiny" style="margin-top:5px">📧 ' + U.esc(p.email || '') + ' • 📞 ' + U.esc(p.phone || '—') + '</div>' +
              '<div class="tiny">' + U.esc(U.VEHICLES[d.vehicle] || d.vehicle) +
                (d.plate ? ' • ' + U.esc(d.plate) : '') + ' • 📍 ' + U.esc(d.zone ? d.zone.name : '—') + '</div>' +
              '<div class="tiny">📦 ' + (d.total_deliveries || 0) + ' livraisons • 💰 ' + U.money(d.total_earnings || 0) + '</div>' +
            '</div>' +
            (d.id_card_url ? '<a class="btn btn-ghost btn-sm" href="' + U.escUrl(d.id_card_url) + '" target="_blank" rel="noopener">Pièce ID</a>' : '') +
          '</div>' +
          '<div class="row" style="gap:9px;margin-top:13px;flex-wrap:wrap">' +
            (d.validation_status !== 'approved' ? '<button class="btn btn-ok btn-sm" data-ok="' + U.esc(d.id) + '">✅ Valider</button>' : '') +
            (d.validation_status !== 'rejected' ? '<button class="btn btn-danger btn-sm" data-no="' + U.esc(d.id) + '">⛔ Refuser</button>' : '') +
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

    view.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
      filter = b.dataset.f;
      view.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b));
      load();
    });
    await load();
  }, GUARD);

  /* ======================================================================
     COMMANDES
     ====================================================================== */
  Router.add('/a/orders', async function (params, query, view) {
    view.innerHTML = '<div class="wrap page">' + adminTabs('/a/orders') +
      Cmp.pageHead('Toutes les commandes', 'Suivi global de la plateforme') +
      '<div id="list"><div class="skel" style="height:200px"></div></div></div>';

    const rows = await API.safe(() => API.adminOrders({ limit: 200 }), []);
    view.querySelector('#list').innerHTML = rows.length
      ? ordersTable(rows)
      : UI.empty('🧾', 'Aucune commande', '');
  }, GUARD);

  function ordersTable(rows) {
    return '<div class="table-wrap"><table><thead><tr>' +
      '<th>Code</th><th>Client</th><th>Restaurant</th><th>Livreur</th>' +
      '<th>Total</th><th>Commission</th><th>Statut</th><th>Date</th>' +
      '</tr></thead><tbody>' +
      rows.map(o => '<tr>' +
        '<td><span class="ocode">#' + U.esc(o.code) + '</span></td>' +
        '<td>' + U.esc(o.client_name || (o.client && o.client.full_name) || '—') + '</td>' +
        '<td>' + U.esc(o.restaurant ? o.restaurant.name : '—') + '</td>' +
        '<td>' + U.esc(o.driver ? o.driver.full_name : '—') + '</td>' +
        '<td><b>' + U.money(o.total) + '</b></td>' +
        '<td>' + U.money(o.commission) + '</td>' +
        '<td>' + UI.tag(o.status) + '</td>' +
        '<td class="tiny">' + U.dt(o.created_at) + '</td>' +
      '</tr>').join('') + '</tbody></table></div>';
  }

  /* ======================================================================
     UTILISATEURS
     ====================================================================== */
  Router.add('/a/users', async function (params, query, view) {
    let role = '', term = '';

    view.innerHTML = '<div class="wrap page">' + adminTabs('/a/users') +
      Cmp.pageHead('Utilisateurs', 'Rôles, blocage et modification des comptes') +
      '<div class="search" style="margin-bottom:12px">' +
        '<input class="input" id="q" placeholder="Nom ou email…"></div>' +
      '<div class="tabs" style="margin-bottom:16px">' +
        '<button data-r="" class="on">Tous</button>' +
        '<button data-r="client">Clients</button>' +
        '<button data-r="restaurant">Restaurants</button>' +
        '<button data-r="driver">Livreurs</button>' +
        '<button data-r="admin">Admins</button>' +
      '</div><div id="list"><div class="skel" style="height:200px"></div></div></div>';

    const list = view.querySelector('#list');

    async function load() {
      const rows = await API.safe(() => API.adminUsers({ role: role || null, q: term || null }), []);
      if (!rows.length) { list.innerHTML = UI.empty('👥', 'Aucun utilisateur', ''); return; }

      list.innerHTML = '<div class="table-wrap"><table><thead><tr>' +
        '<th>Utilisateur</th><th>Rôle</th><th>Téléphone</th><th>Zone</th><th>Statut</th><th>Inscrit</th><th></th>' +
        '</tr></thead><tbody>' +
        rows.map(u => '<tr>' +
          '<td><b>' + U.esc(u.full_name || '—') + '</b><div class="tiny">' + U.esc(u.email || '') + '</div></td>' +
          '<td><span class="tag tag-info">' + U.esc(roleLabel(u.role)) + '</span></td>' +
          '<td>' + U.esc(u.phone || '—') + '</td>' +
          '<td>' + U.esc(u.zone ? u.zone.name : '—') + '</td>' +
          '<td>' + (u.is_blocked ? '<span class="tag tag-danger">Bloqué</span>' : '<span class="tag tag-ok">Actif</span>') + '</td>' +
          '<td class="tiny">' + U.dt(u.created_at) + '</td>' +
          '<td><div class="row" style="gap:6px">' +
            '<button class="btn btn-ghost btn-sm" data-edit="' + U.esc(u.id) + '">Modifier</button>' +
            (u.role !== 'admin'
              ? '<button class="btn ' + (u.is_blocked ? 'btn-ok' : 'btn-danger') + ' btn-sm" data-block="' + U.esc(u.id) +
                '" data-v="' + (u.is_blocked ? '0' : '1') + '">' + (u.is_blocked ? 'Débloquer' : 'Bloquer') + '</button>'
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
    view.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      role = b.dataset.r;
      view.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === b));
      load();
    });
    await load();
  }, GUARD);

  function roleLabel(r) {
    return { client: 'Client', restaurant: 'Restaurant', driver: 'Livreur', admin: 'Admin' }[r] || r;
  }

  function userSheet(u, onSaved) {
    UI.sheet({
      title: 'Modifier ' + (u.full_name || u.email),
      body: '<form id="uf" class="stack" novalidate>' +
        '<div class="field"><label>Nom complet</label>' +
          '<input class="input" name="full_name" value="' + U.esc(u.full_name || '') + '"></div>' +
        '<div class="field"><label>Téléphone</label>' +
          '<input class="input" name="phone" value="' + U.esc(u.phone || '') + '"></div>' +
        '<div class="field"><label>Rôle</label><select class="input" name="role">' +
          ['client', 'restaurant', 'driver', 'admin'].map(r =>
            '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + '>' + roleLabel(r) + '</option>').join('') +
        '</select></div>' +
        Cmp.zoneSelect('zone_id', u.zone_id, 'Zone') +
      '</form>',
      footer: '<button class="btn btn-primary btn-block" id="save">Enregistrer</button>',
      onMount(el, api) {
        el.querySelector('#save').onclick = async function () {
          const d = UI.formData(el.querySelector('#uf'));
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
      view.innerHTML = '<div class="wrap page">' + adminTabs('/a/settings') +
        Cmp.pageHead('Réglages de la plateforme', 'Commissions, zones de livraison et catégories') +

        /* --- commissions --- */
        '<form id="sf" class="card card-p stack">' +
          '<div class="h3">💰 Commissions</div>' +
          '<div class="field"><label>Commission plateforme (%)</label>' +
            '<input class="input" name="commission_rate" type="number" min="0" max="50" step="0.5" value="' +
            (((s.commission_rate != null ? s.commission_rate : 0.1) * 100).toFixed(1)) + '">' +
            '<div class="hint">Prélevée sur le sous-total de chaque commande livrée.</div></div>' +
          '<div class="field"><label>Part du livreur sur les frais de livraison (%)</label>' +
            '<input class="input" name="driver_share" type="number" min="0" max="100" step="1" value="' +
            (((s.driver_share != null ? s.driver_share : 0.8) * 100).toFixed(0)) + '"></div>' +
          '<div class="field"><label>Frais de livraison par défaut (DA)</label>' +
            '<input class="input" name="default_delivery_fee" type="number" min="0" step="50" value="' +
            (s.default_delivery_fee != null ? s.default_delivery_fee : 200) + '"></div>' +
          '<button class="btn btn-primary" type="submit">Enregistrer</button>' +
        '</form>' +

        /* --- zones --- */
        '<div class="card card-p" style="margin-top:16px">' +
          '<div class="row-between" style="margin-bottom:12px">' +
            '<div class="h3">🗺️ Quartiers de livraison</div>' +
            '<button class="btn btn-soft btn-sm" id="addZone">+ Ajouter</button></div>' +
          '<div class="chips" style="flex-wrap:wrap;overflow:visible">' +
            Store.zones.map(z => '<span class="chip" data-zone="' + U.esc(z.id) + '">📍 ' +
              U.esc(z.name) + ' <b style="opacity:.4">✕</b></span>').join('') +
          '</div></div>' +

        /* --- catégories --- */
        '<div class="card card-p" style="margin-top:16px">' +
          '<div class="row-between" style="margin-bottom:12px">' +
            '<div class="h3">🍽️ Catégories</div>' +
            '<button class="btn btn-soft btn-sm" id="addCat">+ Ajouter</button></div>' +
          '<div class="chips" style="flex-wrap:wrap;overflow:visible">' +
            Store.categories.map(c => '<span class="chip" data-cat2="' + U.esc(c.id) + '">' +
              c.icon + ' ' + U.esc(c.name_fr) + ' <b style="opacity:.4">✕</b></span>').join('') +
          '</div></div>' +

        (API.mode === 'demo'
          ? '<div class="card card-p" style="margin-top:16px;border-color:var(--warn)">' +
            '<div class="h3">🧪 Mode démo</div>' +
            '<p class="sub" style="margin:8px 0 12px">Les données sont stockées dans ce navigateur. ' +
            'Configurez Supabase dans <b>config.js</b> pour passer en production.</p>' +
            '<button class="btn btn-danger btn-sm" id="reset">Réinitialiser les données de démo</button></div>'
          : '') +
      '</div>';

      view.querySelector('#sf').onsubmit = async function (e) {
        e.preventDefault();
        const btn = this.querySelector('[type=submit]');
        const d = UI.formData(this);
        UI.busy(btn, true);
        const r = await API.safe(() => API.saveSettings({
          commission_rate: (+d.commission_rate || 0) / 100,
          driver_share: (+d.driver_share || 0) / 100,
          default_delivery_fee: +d.default_delivery_fee || 0
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

      const rst = view.querySelector('#reset');
      if (rst) rst.onclick = async () => {
        if (!(await UI.confirm('Réinitialiser la démo ?', 'Toutes les données locales seront effacées.', 'Réinitialiser', true))) return;
        API.resetDemo();
        location.hash = '#/';
        location.reload();
      };
    }

    paint();
  }, GUARD);
})(window);
