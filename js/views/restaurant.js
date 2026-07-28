/* ==========================================================================
   ESPACE RESTAURANT — tableau de bord, commandes, menu, profil
   ========================================================================== */
(function (w) {
  'use strict';

  const GUARD = { auth: true, roles: ['restaurant'] };
  const LIVE = ['pending', 'accepted', 'preparing', 'ready', 'driver_assigned', 'delivering'];

  /** Bandeau affiché tant que le restaurant n'est pas créé / validé */
  function gate(rest) {
    if (!rest) {
      return '<div class="card card-p" style="text-align:center">' +
        '<div style="font-size:42px">🏪</div>' +
        '<div class="h2" style="margin-top:10px">Créez la fiche de votre restaurant</div>' +
        '<p class="sub" style="margin-top:8px">Nom, adresse, horaires, logo… Votre fiche sera ensuite validée par notre équipe.</p>' +
        '<a class="btn btn-primary btn-lg" style="margin-top:16px" href="#/r/profile">Commencer</a></div>';
    }
    if (rest.status === 'pending') {
      return '<div class="banner banner-warn" style="margin-bottom:16px">⏳ Votre restaurant est en attente de validation. ' +
        'Nous vérifions que l’établissement existe réellement : <b>votre compte sera validé sous 24 h</b>. ' +
        'Vous pouvez déjà préparer votre menu — il sera visible des clients dès la validation.</div>';
    }
    if (rest.status === 'rejected') {
      return '<div class="banner banner-danger" style="margin-bottom:16px">⛔ Inscription refusée' +
        (rest.reject_reason ? ' : ' + U.esc(rest.reject_reason) : '') +
        '. Corrigez votre fiche puis contactez le support.</div>';
    }
    return '';
  }

  /* ======================================================================
     TABLEAU DE BORD
     ====================================================================== */
  Router.add('/r', async function (params, query, view) {
    view.innerHTML = '<div class="wrap page"><div class="skel" style="height:200px"></div></div>';

    const rest = await API.safe(() => API.myRestaurant(), null);
    if (!rest) { view.innerHTML = '<div class="wrap-sm page">' + gate(null) + '</div>'; return; }

    async function load() {
      const orders = await API.safe(() => API.orders({ scope: 'restaurant' }), []);
      const delivered = orders.filter(o => o.status === 'delivered');
      const live = orders.filter(o => LIVE.indexOf(o.status) >= 0);
      const today = orders.filter(o => sameDay(o.created_at, new Date()));
      const revenue = delivered.reduce((s, o) => s + o.subtotal, 0);

      // top produits
      const tally = {};
      delivered.forEach(o => (o.items || []).forEach(i => {
        tally[i.name] = (tally[i.name] || 0) + i.quantity;
      }));
      const top = Object.keys(tally).map(k => ({ name: k, n: tally[k] }))
        .sort((a, b) => b.n - a.n).slice(0, 5);

      view.innerHTML = '<div class="wrap page">' +
        gate(rest) +

        '<div class="row-between" style="margin-bottom:16px;flex-wrap:wrap;gap:12px">' +
          '<div><div class="h1">' + U.esc(rest.name) + '</div>' +
            '<div class="sub">' + U.esc(rest.zone ? rest.zone.name : '') + ' • ' +
            U.hhmm(rest.opens_at) + '–' + U.hhmm(rest.closes_at) + '</div></div>' +
          '<label class="row" style="gap:10px;background:#fff;border:1px solid var(--line);padding:9px 14px;border-radius:14px">' +
            '<span class="strong" style="font-size:13.5px">' + (rest.is_open ? 'Ouvert' : 'Fermé') + '</span>' +
            '<span class="switch"><input type="checkbox" id="openSw" ' + (rest.is_open ? 'checked' : '') + '>' +
            '<span class="track"><span class="knob"></span></span></span></label>' +
        '</div>' +

        '<div class="grid grid-stats">' +
          UI.stat('Commandes aujourd’hui', today.length, '📅') +
          UI.stat('En cours', live.length, '🔥') +
          UI.stat('Terminées', delivered.length, '✅') +
          UI.stat('Chiffre d’affaires', U.money(revenue), '💰') +
        '</div>' +

        '<div class="section-head"><div class="h2">Commandes en cours</div>' +
          '<a class="link" href="#/r/orders">Tout voir →</a></div>' +
        (live.length
          ? '<div class="stack">' + live.slice(0, 4).map(o => orderCard(o)).join('') + '</div>'
          : UI.empty('😴', 'Aucune commande en cours', 'Les nouvelles commandes apparaîtront ici automatiquement.')) +

        '<div class="grid" style="grid-template-columns:1fr;margin-top:26px">' +
          '<div class="card card-p">' +
            '<div class="h3" style="margin-bottom:12px">🏆 Produits les plus vendus</div>' +
            (top.length
              ? top.map((t, i) =>
                  '<div class="oline"><span class="l"><b>' + (i + 1) + '.</b> ' + U.esc(t.name) + '</span>' +
                  '<b>' + t.n + ' vendus</b></div>').join('')
              : '<div class="tiny">Pas encore de ventes.</div>') +
          '</div>' +
        '</div>' +
      '</div>';

      bindOrderActions(view, load);

      const sw = view.querySelector('#openSw');
      if (sw) sw.onchange = async () => {
        const r = await API.safe(() => API.saveRestaurant({ is_open: sw.checked }), null);
        if (r) { rest.is_open = r.is_open; UI.ok(r.is_open ? 'Restaurant ouvert' : 'Restaurant fermé'); load(); }
      };
    }

    await load();
    const off = API.onChange(t => { if (t === 'orders' || t === '*') load(); });
    return off;
  }, GUARD);

  /* ======================================================================
     COMMANDES
     ====================================================================== */
  Router.add('/r/orders', async function (params, query, view) {
    let tab = 'new';
    const rest = await API.safe(() => API.myRestaurant(), null);
    if (!rest) { view.innerHTML = '<div class="wrap-sm page">' + gate(null) + '</div>'; return; }

    view.innerHTML = '<div class="wrap page">' +
      Cmp.pageHead('Commandes', 'Vous gérez « ' + rest.name + ' » — seules ses commandes apparaissent ici') +
      '<div class="tabs" style="margin-bottom:16px">' +
        '<button data-t="new" class="on">Nouvelles</button>' +
        '<button data-t="progress">En préparation</button>' +
        '<button data-t="ready">Prêtes / en livraison</button>' +
        '<button data-t="done">Historique</button>' +
      '</div>' +
      '<div id="list"><div class="skel" style="height:120px"></div></div></div>';

    const list = view.querySelector('#list');

    async function load() {
      const all = await API.safe(() => API.orders({ scope: 'restaurant' }), []);
      const map = {
        new: o => o.status === 'pending',
        progress: o => o.status === 'accepted' || o.status === 'preparing',
        ready: o => ['ready', 'driver_assigned', 'delivering'].indexOf(o.status) >= 0,
        done: o => ['delivered', 'rejected', 'cancelled'].indexOf(o.status) >= 0
      };
      const rows = all.filter(map[tab]);

      list.innerHTML = rows.length
        ? '<div class="stack">' + rows.map(o => orderCard(o, true)).join('') + '</div>'
        : UI.empty('📭', 'Aucune commande',
            all.length
              ? 'Rien dans cette catégorie pour le moment.'
              : 'Ce compte gère « ' + rest.name +' ». Une commande passée dans un autre ' +
                'restaurant arrive chez son propre gérant, pas ici.');

      bindOrderActions(view, load);
    }

    view.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      tab = b.dataset.t;
      view.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b));
      load();
    });

    await load();
    const off = API.onChange(t => { if (t === 'orders' || t === '*') load(); });
    return off;
  }, GUARD);

  /* -------------------------------------------------------- carte commande */
  function orderCard(o, full) {
    const next = {
      pending: [['accepted', '✅ Accepter', 'btn-ok'], ['rejected', '⛔ Refuser', 'btn-danger']],
      accepted: [['preparing', '👨‍🍳 Démarrer la préparation', 'btn-primary']],
      preparing: [['ready', '🛍️ Commande prête', 'btn-primary']]
    }[o.status] || [];

    return '<div class="order-card">' +
      '<div class="row-between">' +
        '<div class="row" style="gap:9px"><span class="ocode">#' + U.esc(o.code) + '</span>' + UI.tag(o.status) + '</div>' +
        '<span class="tiny">' + U.ago(o.created_at) + '</span>' +
      '</div>' +

      '<div style="margin-top:10px">' + Cmp.orderLines(o) + '</div>' +
      '<div class="divider"></div>' +
      '<div class="oline"><span class="l">Total</span><b class="price">' + U.money(o.total) + '</b></div>' +

      (full ?
        '<div class="divider"></div>' +
        '<div class="tiny stack" style="gap:4px">' +
          '<div>👤 ' + U.esc(o.client_name || (o.client && o.client.full_name) || '') + ' — 📞 ' +
            '<a href="tel:' + U.esc(o.client_phone) + '" style="color:var(--brand);font-weight:650">' + U.esc(o.client_phone) + '</a></div>' +
          '<div>📍 ' + U.esc(o.address_street) + (o.address_details ? ' — ' + U.esc(o.address_details) : '') +
            (U.hasCoords({ lat: o.address_lat, lng: o.address_lng })
              ? ' — <a target="_blank" rel="noopener" style="color:var(--brand);font-weight:700" href="' +
                U.gmapsPin(o.address_lat, o.address_lng) + '">carte ↗</a>' : '') + '</div>' +
          (o.note ? '<div>📝 ' + U.esc(o.note) + '</div>' : '') +
          (o.driver ? '<div>🛵 Livreur : <b>' + U.esc(o.driver.full_name) + '</b> — ' + U.esc(o.driver.phone || '') + '</div>' : '') +
        '</div>' : '') +

      (next.length
        ? '<div class="row" style="gap:9px;margin-top:13px">' +
          next.map(n => '<button class="btn ' + n[2] + ' grow btn-sm" data-act="' + n[0] + '" data-id="' + U.esc(o.id) + '">' +
            n[1] + '</button>').join('') + '</div>'
        : '') +
    '</div>';
  }

  function bindOrderActions(view, reload) {
    view.querySelectorAll('[data-act]').forEach(b => b.onclick = async function () {
      const status = this.dataset.act, id = this.dataset.id;
      let extra = null;
      if (status === 'rejected') {
        const reason = await UI.prompt('Refuser la commande', 'Motif du refus (visible par le client)',
          'Ex : plat en rupture, trop de commandes…', true);
        if (reason === null) return;
        extra = { reject_reason: reason || 'Le restaurant ne peut pas honorer cette commande.' };
      }
      UI.busy(this, true);
      const r = await API.safe(() => API.updateOrderStatus(id, status, extra), null);
      if (r) UI.ok(U.statusLabel(status));
      reload();
    });
  }

  /* ======================================================================
     MENU
     ====================================================================== */
  Router.add('/r/menu', async function (params, query, view) {
    const rest = await API.safe(() => API.myRestaurant(), null);
    if (!rest) { view.innerHTML = '<div class="wrap-sm page">' + gate(null) + '</div>'; return; }

    view.innerHTML = '<div class="wrap page">' +
      Cmp.pageHead('Mon menu', 'Ajoutez, modifiez et activez vos plats',
        '<button class="btn btn-primary" id="add">+ Ajouter un plat</button>') +
      '<div id="menuNav" class="menu-tabs chips" hidden></div>' +
      '<div id="list"><div class="skel" style="height:110px"></div></div></div>';

    const nav = view.querySelector('#menuNav');
    const list = view.querySelector('#list');
    /* Catégorie ouverte, retenue par identifiant : elle survit aux
       rechargements déclenchés par un ajout, une bascule ou une suppression. */
    let activeCat = null;

    async function load() {
      const items = await API.safe(() => API.menuItems(rest.id, { includeHidden: true }), []);
      if (!items.length) {
        nav.hidden = true;
        list.innerHTML = UI.empty('🍕', 'Votre menu est vide', 'Ajoutez votre premier plat pour commencer à vendre.',
          '<button class="btn btn-primary" id="add2">+ Ajouter un plat</button>');
        const a2 = list.querySelector('#add2');
        if (a2) a2.onclick = () => itemSheet(null, load);
        return;
      }

      const byCat = {};
      items.forEach(i => { (byCat[i.category_id || 'other'] = byCat[i.category_id || 'other'] || []).push(i); });

      /* Ordre des onglets = ordre officiel des catégories (Store.categories est
         déjà trié). Les clés d'un objet ne garantissent aucun ordre. */
      const groups = Store.categories
        .filter(c => byCat[c.id])
        .map(c => ({ id: c.id, name: c.name_fr, cat: c, items: byCat[c.id] }));
      if (byCat.other) groups.push({ id: 'other', name: 'Autres', cat: { icon: '🍽️' }, items: byCat.other });

      if (!groups.some(g => g.id === activeCat)) activeCat = groups[0].id;

      const gIcon = (g, big) => g.cat.image_url
        ? '<span class="g-ic' + (big ? ' big' : '') + '" style="background-image:url(' + U.escUrl(g.cat.image_url) + ')"></span>'
        : '<span class="g-ic emoji' + (big ? ' big' : '') + '">' + (g.cat.icon || '🍽️') + '</span>';

      nav.hidden = groups.length < 2;
      nav.innerHTML = groups.map(g =>
        '<button class="chip ' + (g.id === activeCat ? 'on' : '') + '" data-tab="' + U.esc(g.id) + '">' +
          gIcon(g) + U.esc(g.name) + '<span class="chip-n">' + g.items.length + '</span></button>').join('');
      nav.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
        activeCat = b.dataset.tab;
        paint();
        b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        if (nav.getBoundingClientRect().top <= 60) nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      paint();

      function paint() {
        const g = groups.find(x => x.id === activeCat) || groups[0];
        const c = g.cat;
        nav.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === g.id));

        list.innerHTML = '<div class="section-head"><div class="h3">' +
          gIcon(g, true) + U.esc(g.name) + '</div>' +
          '<span class="tiny">' + g.items.length + ' plat(s)</span></div>' +
          '<div class="stack">' + g.items.map(m =>
            '<div class="dish ' + (m.is_available ? '' : 'off') + '">' +
              '<div class="dish-img" style="' +
                (m.image_url ? 'background-image:url(' + U.escUrl(m.image_url) + ')'
                  : c.image_url ? 'background-image:url(' + U.escUrl(c.image_url) + ');background-size:74%;background-color:#fff'
                  : '') + '">' +
                (m.image_url || c.image_url ? '' : (c.icon || '🍽️')) + '</div>' +
              '<div class="dish-body">' +
                '<div class="row-between"><div class="dish-name">' + U.esc(m.name) + '</div>' +
                  '<span class="switch"><input type="checkbox" data-toggle="' + U.esc(m.id) + '" ' +
                  (m.is_available ? 'checked' : '') + '><span class="track"><span class="knob"></span></span></span></div>' +
                (m.description ? '<div class="dish-desc">' + U.esc(m.description) + '</div>' : '') +
                ((m.variants && m.variants.length)
                  ? '<div class="tiny" style="margin-top:4px">Formats : ' +
                    U.esc(m.variants.map(v => v.name + ' ' + U.money(v.price)).join(' · ')) + '</div>' : '') +
                ((m.options && m.options.length)
                  ? '<div class="tiny" style="margin-top:4px">Suppléments : ' +
                    U.esc(m.options.map(o => o.name).join(', ')) + '</div>' : '') +
                '<div class="row-between mt-auto" style="padding-top:9px">' +
                  '<span class="price">' + ((m.variants && m.variants.length > 1)
                    ? '<span class="tiny" style="font-weight:600">dès </span>' : '') + U.money(m.price) + '</span>' +
                  '<span class="row" style="gap:6px">' +
                    '<button class="btn btn-ghost btn-sm" data-edit="' + U.esc(m.id) + '">Modifier</button>' +
                    '<button class="btn btn-danger btn-sm" data-del="' + U.esc(m.id) + '">🗑</button>' +
                  '</span>' +
                '</div>' +
              '</div></div>').join('') + '</div>';

        /* La liste est reconstruite à chaque changement d'onglet :
           les écouteurs doivent l'être aussi. */
        list.querySelectorAll('[data-edit]').forEach(b => b.onclick = () =>
          itemSheet(items.find(x => x.id === b.dataset.edit), load));

        list.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          const it = items.find(x => x.id === b.dataset.del);
          if (await UI.confirm('Supprimer « ' + it.name + ' » ?', 'Cette action est définitive.', 'Supprimer', true)) {
            await API.safe(() => API.deleteMenuItem(it.id));
            UI.ok('Plat supprimé');
            load();
          }
        });

        list.querySelectorAll('[data-toggle]').forEach(sw => sw.onchange = async () => {
          await API.safe(() => API.saveMenuItem({ id: sw.dataset.toggle, is_available: sw.checked }));
          UI.ok(sw.checked ? 'Plat activé' : 'Plat désactivé');
          load();
        });
      }
    }

    view.querySelector('#add').onclick = () => itemSheet(null, load);
    await load();
  }, GUARD);

  /* --------------------------------------------------- formulaire plat */
  /* Un bouton par format courant : on appuie sur ceux dont on a besoin et on
     saisit le prix de chacun. Rien n'oblige à les utiliser — « + Autre » permet
     n'importe quel nom (Grande, Familiale, 6 pièces…). */
  const QUICK_FORMATS = [
    'Solo', 'Menu',                                        // tacos, burgers, sandwichs
    'Small', 'Medium', 'Large', 'Extra-Large',             // pizzas
    'S', 'M', 'L', 'XL'                                    // versions courtes
  ];

  function itemSheet(item, onSaved) {
    const it = item || {};
    let opts = (it.options || []).map(o => ({ name: o.name, extra_price: o.extra_price }));
    let vars = (it.variants || []).map(v => ({ name: v.name, price: v.price }));

    function optRows() {
      return opts.map((o, i) =>
        '<div class="row" style="gap:8px" data-orow="' + i + '">' +
          '<input class="input grow" data-oname="' + i + '" placeholder="Nom du supplément" value="' + U.esc(o.name) + '">' +
          '<input class="input" data-oprice="' + i + '" style="width:110px" type="number" min="0" step="10" ' +
            'placeholder="0" value="' + (o.extra_price || 0) + '">' +
          '<button type="button" class="btn btn-danger btn-sm" data-orm="' + i + '">✕</button>' +
        '</div>').join('');
    }

    function varRows() {
      if (!vars.length) return '';
      return vars.map((v, i) =>
        '<div class="row" style="gap:8px" data-vrow="' + i + '">' +
          '<input class="input grow" data-vname="' + i + '" placeholder="Ex : Méga" value="' + U.esc(v.name) + '">' +
          '<input class="input" data-vprice="' + i + '" style="width:110px" type="number" min="0" step="10" ' +
            'placeholder="Prix" value="' + (v.price || 0) + '">' +
          '<button type="button" class="btn btn-danger btn-sm" data-vrm="' + i + '">✕</button>' +
        '</div>').join('');
    }

    UI.sheet({
      title: item ? 'Modifier le plat' : 'Nouveau plat',
      body: '<form id="mf" class="stack" novalidate>' +
        UI.imageField('image_url', it.image_url, 'Photo du plat') +
        '<div class="field"><label>Nom du plat *</label>' +
          '<input class="input" name="name" placeholder="Ex : Tacos Poulet" value="' + U.esc(it.name || '') + '" required></div>' +
        '<div class="field"><label>Description</label>' +
          '<textarea class="input" name="description" placeholder="Ingrédients, accompagnement…">' + U.esc(it.description || '') + '</textarea></div>' +
        Cmp.categorySelect('category_id', it.category_id, 'Catégorie') +

        /* ---------------------------------------------------- FORMATS */
        '<div class="field"><label>Formats <span class="tiny">(le client en choisit un seul)</span></label>' +
          '<div class="chips" style="flex-wrap:wrap;overflow:visible;margin-bottom:8px">' +
            QUICK_FORMATS.map(n => '<button type="button" class="chip" data-quick="' + U.esc(n) + '">' +
              U.esc(n) + '</button>').join('') +
            '<button type="button" class="chip" data-vadd>+ Autre</button>' +
          '</div>' +
          '<div class="stack" style="gap:8px" id="vars">' + varRows() + '</div>' +
          '<div class="hint" id="varHint"></div></div>' +

        /* ------------------------------------------------------ PRIX */
        '<div class="field" id="priceField"><label>Prix (DZD) *</label>' +
          '<input class="input" name="price" type="number" min="0" step="10" value="' + (it.price || '') + '" required>' +
          '<div class="hint">Prix unique de ce plat.</div></div>' +

        /* ----------------------------------------------- SUPPLÉMENTS */
        '<div class="field"><label>Suppléments <span class="tiny">(facultatif, cumulables)</span></label>' +
          '<div class="stack" style="gap:8px" id="opts">' + optRows() + '</div>' +
          '<button type="button" class="btn btn-ghost btn-sm" id="addOpt" style="margin-top:8px">+ Ajouter un supplément</button>' +
          '<div class="hint">Le prix saisi s’ajoute au prix du plat (ex : Cheddar +80).</div></div>' +

        '<label class="row" style="gap:9px;cursor:pointer"><input type="checkbox" name="is_available" ' +
          (it.is_available === false ? '' : 'checked') + ' style="width:18px;height:18px;accent-color:var(--brand)">' +
          '<span class="tiny">Plat disponible à la vente</span></label>' +
      '</form>',
      footer: '<button class="btn btn-primary btn-block" id="save">Enregistrer</button>',

      onMount(el, api) {
        UI.bindImageFields(el);
        const box = el.querySelector('#opts');
        const vbox = el.querySelector('#vars');
        const priceField = el.querySelector('#priceField');
        const hint = el.querySelector('#varHint');

        /* ------------------------------------------------ suppléments */
        function readOpts() {
          opts = Array.prototype.slice.call(box.querySelectorAll('[data-orow]')).map(row => ({
            name: row.querySelector('[data-oname]').value.trim(),
            extra_price: +row.querySelector('[data-oprice]').value || 0
          })).filter(o => o.name);
        }
        function repaintOpts() { box.innerHTML = optRows(); bindOpts(); }
        function bindOpts() {
          box.querySelectorAll('[data-orm]').forEach(b => b.onclick = () => {
            readOpts(); opts.splice(+b.dataset.orm, 1); repaintOpts();
          });
        }
        bindOpts();
        el.querySelector('#addOpt').onclick = () => { readOpts(); opts.push({ name: '', extra_price: 0 }); repaintOpts(); };

        /* ---------------------------------------------------- formats */
        function readVars() {
          vars = Array.prototype.slice.call(vbox.querySelectorAll('[data-vrow]')).map(row => ({
            name: row.querySelector('[data-vname]').value.trim(),
            price: +row.querySelector('[data-vprice]').value || 0
          }));
        }
        /* Le champ « Prix » n'a de sens que sans format : sinon c'est le format
           qui porte le prix, et laisser les deux visibles ferait douter. */
        function repaintVars() {
          vbox.innerHTML = varRows();
          const on = vars.length > 0;
          priceField.hidden = on;
          priceField.querySelector('[name=price]').required = !on;

          const prix = vars.filter(v => v.price > 0).map(v => v.price);
          hint.textContent = on
            ? (prix.length
                ? 'Chaque format a son propre prix total, pas un supplément. Le menu affichera « dès ' +
                  U.money(Math.min.apply(null, prix)) + ' ».'
                : 'Indiquez le prix de chaque format.')
            : 'Appuyez sur un format si ce plat existe en plusieurs tailles. Sinon, laissez vide et donnez un prix unique.';

          // un bouton allumé = ce format est déjà dans la liste
          el.querySelectorAll('[data-quick]').forEach(b =>
            b.classList.toggle('on', vars.some(v => v.name === b.dataset.quick)));

          vbox.querySelectorAll('[data-vrm]').forEach(b => b.onclick = () => {
            readVars(); vars.splice(+b.dataset.vrm, 1); repaintVars();
          });
          vbox.querySelectorAll('[data-vprice]').forEach(i => i.onchange = () => { readVars(); repaintVars(); });
          vbox.querySelectorAll('[data-vname]').forEach(i => i.onchange = () => { readVars(); repaintVars(); });
        }

        /* Chaque bouton ajoute son format, ou le retire si on rappuie dessus. */
        el.querySelectorAll('[data-quick]').forEach(b => b.onclick = () => {
          readVars();
          const nom = b.dataset.quick;
          const i = vars.findIndex(v => v.name === nom);
          if (i >= 0) vars.splice(i, 1);
          else {
            // on reprend le prix unique déjà saisi comme point de départ
            const base = +el.querySelector('[name=price]').value || 0;
            vars.push({ name: nom, price: base });
          }
          repaintVars();
        });
        el.querySelector('[data-vadd]').onclick = () => { readVars(); vars.push({ name: '', price: 0 }); repaintVars(); };
        repaintVars();

        /* ---------------------------------------------- enregistrement */
        el.querySelector('#save').onclick = async function () {
          const f = el.querySelector('#mf');
          const d = UI.formData(f);
          if (!d.name || d.name.length < 2) return UI.err('Indiquez le nom du plat');
          readOpts();
          readVars();

          const named = vars.filter(v => v.name);
          if (vars.length && named.length !== vars.length)
            return UI.err('Nommez chaque format', 'Ex : Solo, Menu, Méga… ou supprimez la ligne vide.');
          if (named.length === 1)
            return UI.err('Un seul format ne sert à rien', 'Ajoutez-en un deuxième, ou supprimez-le et indiquez un prix unique.');
          if (named.some(v => !(v.price > 0)))
            return UI.err('Chaque format doit avoir un prix');
          const noms = named.map(v => v.name.toLowerCase());
          if (noms.some((n, i) => noms.indexOf(n) !== i))
            return UI.err('Deux formats portent le même nom');

          if (named.length) d.price = named.reduce((m, v) => Math.min(m, v.price), named[0].price);
          else {
            if (!(+d.price >= 0) || d.price === '') return UI.err('Indiquez un prix valide');
            d.price = +d.price;
          }

          d.is_available = !!f.querySelector('[name=is_available]').checked;
          d.options = opts;
          d.variants = named;
          if (item) d.id = item.id;
          UI.busy(this, true);
          try {
            await API.saveMenuItem(d);
            api.close();
            UI.ok(item ? 'Plat modifié' : 'Plat ajouté');
            onSaved && onSaved();
          } catch (e) { UI.busy(this, false); UI.err(e.message); }
        };
      }
    });
  }

  /* ======================================================================
     PROFIL DU RESTAURANT
     ====================================================================== */
  Router.add('/r/profile', async function (params, query, view) {
    const rest = await API.safe(() => API.myRestaurant(), null);
    const r = rest || {};
    const selectedCats = r.categories || [];

    view.innerHTML = '<div class="wrap-sm page">' +
      Cmp.pageHead(rest ? 'Ma fiche restaurant' : 'Créer mon restaurant',
        'Ces informations sont visibles par les clients') +
      (rest ? gate(rest) : '') +

      '<form id="rf" class="card card-p stack" novalidate>' +
        UI.imageField('logo_url', r.logo_url, 'Logo') +
        UI.imageField('cover_url', r.cover_url, 'Photo de couverture', 'wide') +

        '<div class="field"><label>Nom du restaurant *</label>' +
          '<input class="input" name="name" placeholder="Ex : Meliza Tacos" value="' + U.esc(r.name || '') + '" required></div>' +

        '<div class="field"><label>Description</label>' +
          '<textarea class="input" name="description" placeholder="Spécialités, ambiance…">' + U.esc(r.description || '') + '</textarea></div>' +

        '<div class="field"><label>Adresse complète *</label>' +
          '<input class="input" name="address" placeholder="Rue, cité, repère…" value="' + U.esc(r.address || '') + '" required></div>' +

        '<div class="field"><label>Position sur la carte *</label>' +
          '<div id="posBox"></div>' +
          '<div class="hint">Indispensable : c’est ce point que le livreur ouvre dans Google Maps ' +
          'et qui sert à calculer la distance de la course.</div></div>' +

        Cmp.zoneSelect('zone_id', r.zone_id, 'Quartier *', true) +

        '<div class="field"><label>Téléphone *</label>' +
          '<input class="input" name="phone" inputmode="tel" placeholder="0550 12 34 56" value="' + U.esc(r.phone || '') + '" required></div>' +

        '<div class="row" style="gap:10px">' +
          '<div class="field grow"><label>Ouverture</label>' +
            '<input class="input" name="opens_at" type="time" value="' + U.esc(U.hhmm(r.opens_at) || '10:00') + '"></div>' +
          '<div class="field grow"><label>Fermeture</label>' +
            '<input class="input" name="closes_at" type="time" value="' + U.esc(U.hhmm(r.closes_at) || '23:00') + '"></div>' +
        '</div>' +

        '<div class="row" style="gap:10px">' +
          '<div class="field grow"><label>Frais de livraison (DA)</label>' +
            '<input class="input" name="delivery_fee" type="number" min="0" step="50" value="' +
            (r.delivery_fee != null ? r.delivery_fee : TALABI_CONFIG.DEFAULT_DELIVERY_FEE) + '"></div>' +
          '<div class="field grow"><label>Minimum commande</label>' +
            '<input class="input" name="min_order" type="number" min="0" step="50" value="' + (r.min_order || 0) + '"></div>' +
        '</div>' +

        '<div class="field"><label>Temps de préparation (min)</label>' +
          '<input class="input" name="prep_time_min" type="number" min="5" max="120" step="5" value="' + (r.prep_time_min || 25) + '"></div>' +

        '<div class="field"><label>Catégories de nourriture</label>' +
          '<div class="chips" style="flex-wrap:wrap;overflow:visible" id="cats">' +
            Store.categories.map(c => '<button type="button" class="chip ' +
              (selectedCats.indexOf(c.id) >= 0 ? 'on' : '') + '" data-c="' + c.id + '">' +
              c.icon + ' ' + U.esc(c.name_fr) + '</button>').join('') +
          '</div></div>' +

        '<button class="btn btn-primary btn-block btn-lg" type="submit">' +
          (rest ? 'Enregistrer les modifications' : 'Créer mon restaurant') + '</button>' +
      '</form></div>';

    UI.bindImageFields(view);

    /* ------------------------------------------- position du restaurant */
    let pos = U.hasCoords(r) ? { lat: +r.lat, lng: +r.lng } : null;
    const posBox = view.querySelector('#posBox');

    function paintPos() {
      posBox.innerHTML = pos
        ? '<div class="map-preview" id="rprev"></div>' +
          '<div class="row" style="gap:8px;margin-top:8px">' +
            '<button type="button" class="btn btn-ghost btn-sm grow" id="rpick">🗺️ Modifier la position</button>' +
            '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' +
              U.gmapsPin(pos.lat, pos.lng) + '">Google Maps ↗</a></div>'
        : '<button type="button" class="btn btn-primary btn-block" id="rpick">' +
          '📍 Placer mon restaurant sur la carte</button>';

      if (pos) MapPicker.preview(posBox.querySelector('#rprev'), pos.lat, pos.lng);

      posBox.querySelector('#rpick').onclick = () => MapPicker.open({
        title: 'Où se trouve votre restaurant ?',
        lat: pos && pos.lat, lng: pos && pos.lng,
        onPick(p) {
          pos = { lat: p.lat, lng: p.lng };
          const addr = view.querySelector('[name=address]');
          if (p.address && !addr.value.trim()) addr.value = p.address;
          paintPos();
        }
      });
    }
    paintPos();

    const chosen = selectedCats.slice();
    view.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
      const i = chosen.indexOf(b.dataset.c);
      if (i >= 0) chosen.splice(i, 1); else chosen.push(b.dataset.c);
      b.classList.toggle('on');
    });

    view.querySelector('#rf').onsubmit = async function (e) {
      e.preventDefault();
      const btn = this.querySelector('[type=submit]');
      const d = UI.formData(this);
      if (!d.name || d.name.length < 2) return UI.err('Indiquez le nom du restaurant');
      if (!d.address || d.address.length < 5) return UI.err('Indiquez une adresse complète');
      if (!d.zone_id) return UI.err('Choisissez votre quartier');
      if (!U.isPhoneDZ(d.phone)) return UI.err('Numéro de téléphone invalide');
      if (!pos) return UI.err('Position manquante', 'Placez votre restaurant sur la carte.');

      d.lat = pos.lat; d.lng = pos.lng;
      d.categories = chosen;
      ['delivery_fee', 'min_order', 'prep_time_min'].forEach(k => d[k] = +d[k] || 0);

      UI.busy(btn, true, 'Enregistrement…');
      try {
        await API.saveRestaurant(d);
        await Store.refreshProfile();
        UI.ok(rest ? 'Fiche mise à jour' : 'Restaurant créé', rest ? '' : 'En attente de validation');
        Router.go('/r');
      } catch (err) { UI.busy(btn, false); UI.err(err.message); }
    };
  }, GUARD);

  /* ---------------------------------------------------------- helpers */
  function sameDay(a, b) {
    const x = new Date(a), y = new Date(b);
    return x.getDate() === y.getDate() && x.getMonth() === y.getMonth() && x.getFullYear() === y.getFullYear();
  }
})(window);
