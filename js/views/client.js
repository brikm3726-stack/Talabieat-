/* ==========================================================================
   VUES CLIENT — liste des restaurants, fiche restaurant, panier
   ========================================================================== */
(function (w) {
  'use strict';

  /* ======================================================================
     LISTE DES RESTAURANTS + RECHERCHE
     ====================================================================== */
  Router.add('/restaurants', async function (params, query, view) {
    let term = query.q || '';
    let cat = query.cat || null;
    let mode = 'resto';   // 'resto' | 'dish'

    view.innerHTML = '<div class="wrap page">' +
      Cmp.pageHead('Restaurants', Store.zoneName() ? 'Livraison à ' + Store.zoneName() : 'Toute la ville de Tizi Ouzou',
        '<button class="btn btn-ghost btn-sm" id="zoneBtn2">📍 ' + U.esc(Store.zoneName() || 'Mon quartier') + '</button>') +
      '<div class="search" style="margin-bottom:12px">' +
        '<input class="input" id="q" placeholder="Restaurant ou plat…" value="' + U.esc(term) + '" autocomplete="off">' +
      '</div>' +
      '<div class="tabs" style="margin-bottom:14px">' +
        '<button data-mode="resto" class="on">Restaurants</button>' +
        '<button data-mode="dish">Plats</button>' +
      '</div>' +
      '<div id="cats"></div>' +
      '<div id="results" style="margin-top:12px">' + UI.skeletonCards(6) + '</div>' +
    '</div>';

    view.querySelector('#zoneBtn2').onclick = Shell.zonePicker;

    const results = view.querySelector('#results');
    const catBox = view.querySelector('#cats');

    function paintCats() {
      const c = Cmp.categoryScroller(cat, id => { cat = id; paintCats(); load(); });
      catBox.innerHTML = c.html;
      c.bind(catBox);
      catBox.style.display = mode === 'resto' ? '' : 'none';
    }

    async function load() {
      results.innerHTML = UI.skeletonCards(4);

      if (mode === 'dish') {
        if (term.trim().length < 2) {
          results.innerHTML = UI.empty('🔎', 'Recherchez un plat', 'Saisissez au moins 2 lettres (pizza, tacos, chawarma…).');
          return;
        }
        const dishes = await API.safe(() => API.searchDishes(term, Store.zoneId), []);
        if (!dishes.length) {
          results.innerHTML = UI.empty('🍽️', 'Aucun plat trouvé', 'Essayez un autre mot-clé ou changez de quartier.');
          return;
        }
        results.innerHTML = '<div class="stack">' + dishes.map(d =>
          '<div data-goto="' + U.esc(d.restaurant.id) + '">' +
            Cmp.dishRow(Object.assign({}, d, { is_available: true })) +
            '<div class="tiny" style="margin:-6px 0 4px 13px">chez <b>' + U.esc(d.restaurant.name) + '</b> • ' +
              U.esc(d.restaurant.zone ? d.restaurant.zone.name : '') + '</div>' +
          '</div>').join('') + '</div>';
        results.querySelectorAll('[data-goto]').forEach(el =>
          el.onclick = () => Router.go('/resto/' + el.dataset.goto));
        return;
      }

      const q = term.trim();
      const list = await searchRestaurants(q, Store.zoneId, cat);

      // Rien dans le quartier choisi, mais des résultats ailleurs en ville :
      // on le dit au lieu d'afficher un vide qui ressemble à une panne.
      if (!list.length && Store.zoneId) {
        const city = await searchRestaurants(q, null, cat);
        if (city.length) {
          results.innerHTML = UI.empty('📍', 'Rien dans ' + Store.zoneName(),
            city.length + ' restaurant(s) correspondent ailleurs dans la ville.',
            '<button class="btn btn-primary" id="allCity">Chercher dans toute la ville</button>');
          results.querySelector('#allCity').onclick = () => { Store.setZone(null); Shell.renderTop(); load(); };
          return;
        }
      }
      Cmp.restoGrid(list, results);
    }

    /**
     * Recherche unifiée : un mot-clé peut désigner un restaurant OU un plat.
     * Le champ promet « restaurant ou plat » — il doit tenir les deux.
     */
    async function searchRestaurants(q, zoneId, catId) {
      const list = await API.safe(() => API.restaurants({
        zone_id: zoneId, category_id: catId, q: q || null
      }), []);

      if (q.length < 2) return list;

      const dishes = await API.safe(() => API.searchDishes(q, zoneId), []);
      const seen = {};
      list.forEach(r => seen[r.id] = true);

      dishes.forEach(d => {
        const rest = d.restaurant;
        if (!rest || seen[rest.id]) return;
        if (catId && (rest.categories || []).indexOf(catId) < 0) return;
        seen[rest.id] = true;
        rest.matched_dish = d.name;   // affiché sur la carte : « propose … »
        list.push(rest);
      });

      return list.sort((a, b) => (b.open_now - a.open_now) || (b.rating - a.rating));
    }

    const onType = U.debounce(() => { term = view.querySelector('#q').value; load(); }, 320);
    view.querySelector('#q').oninput = onType;

    view.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
      mode = b.dataset.mode;
      view.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b));
      paintCats();
      load();
    });

    paintCats();
    await load();
  });

  /* ======================================================================
     FICHE RESTAURANT
     ====================================================================== */
  Router.add('/resto/:id', async function (params, query, view) {
    view.innerHTML = '<div class="wrap page"><div class="skel" style="height:180px"></div>' +
      '<div class="skel" style="height:110px;margin-top:16px"></div></div>';

    const r = await API.safe(() => API.restaurant(params.id), null);
    if (!r) {
      view.innerHTML = '<div class="wrap page">' + UI.empty('🏪', 'Restaurant introuvable', '',
        '<a class="btn btn-primary" href="#/restaurants">Voir les restaurants</a>') + '</div>';
      return;
    }

    const menu = await API.safe(() => API.menuItems(r.id), []);
    const catsOfMenu = [];
    Store.categories.forEach(c => { if (menu.some(m => m.category_id === c.id)) catsOfMenu.push(c); });
    const others = menu.filter(m => !catsOfMenu.some(c => c.id === m.category_id));

    const cover = r.cover_url ? 'background-image:url(' + U.escUrl(r.cover_url) + ')' : '';
    const logo = r.logo_url ? 'background-image:url(' + U.escUrl(r.logo_url) + ')' : '';
    const emoji = (r.category_list && r.category_list[0] && r.category_list[0].icon) || '🍽️';

    view.innerHTML =
      '<div class="resto-cover" style="' + cover + ';aspect-ratio:auto;height:190px;border-radius:0">' +
        (cover ? '' : '<div style="height:100%;display:grid;place-items:center;font-size:64px;opacity:.3">' + emoji + '</div>') +
        '<button class="icon-btn" id="back" style="position:absolute;top:14px;left:14px">←</button>' +
        (r.open_now ? '' : '<div class="closed-ov">FERMÉ ACTUELLEMENT</div>') +
      '</div>' +

      '<div class="wrap page" style="padding-top:0">' +
        '<div class="card card-p" style="margin-top:-38px;position:relative;z-index:2">' +
          '<div class="row" style="gap:13px;align-items:flex-start">' +
            '<div style="width:58px;height:58px;border-radius:17px;background:#fff center/cover no-repeat;' + logo +
              ';border:1px solid var(--line);display:grid;place-items:center;font-size:26px;flex:none">' + (logo ? '' : emoji) + '</div>' +
            '<div class="grow">' +
              '<div class="h2">' + U.esc(r.name) + '</div>' +
              '<div class="resto-meta">' +
                '<span>⭐ <b>' + (+r.rating).toFixed(1) + '</b> (' + (r.rating_count || 0) + ')</span>' +
                '<span class="dot-sep">🕒 ' + r.prep_time_min + ' min</span>' +
                '<span class="dot-sep">🛵 ' + U.money(r.delivery_fee) + '</span>' +
              '</div>' +
            '</div>' +
            '<span class="tag ' + (r.open_now ? 'tag-ok' : 'tag-muted') + '">' + (r.open_now ? 'Ouvert' : 'Fermé') + '</span>' +
          '</div>' +
          (r.description ? '<p class="sub" style="margin-top:12px">' + U.esc(r.description) + '</p>' : '') +
          '<div class="divider"></div>' +
          '<div class="tiny stack" style="gap:5px">' +
            '<div>📍 ' + U.esc(r.address || '—') + (r.zone ? ' — ' + U.esc(r.zone.name) : '') + '</div>' +
            '<div>🕘 Horaires : ' + U.hhmm(r.opens_at) + ' – ' + U.hhmm(r.closes_at) + '</div>' +
            (r.phone ? '<div>📞 <a href="tel:' + U.esc(r.phone) + '" style="color:var(--brand);font-weight:650">' + U.esc(r.phone) + '</a></div>' : '') +
            (r.min_order ? '<div>🧾 Minimum de commande : <b>' + U.money(r.min_order) + '</b></div>' : '') +
          '</div>' +
        '</div>' +

        (r.open_now ? '' : '<div class="banner banner-warn" style="margin-top:14px">⏰ Ce restaurant est fermé. Vous pourrez commander dès sa réouverture (' + U.hhmm(r.opens_at) + ').</div>') +

        (menu.length
          ? '<div id="menuNav" class="chips" style="margin-top:18px"></div><div id="menu" class="stack" style="margin-top:6px"></div>'
          : '<div style="margin-top:20px">' + UI.empty('📋', 'Menu en préparation', 'Ce restaurant n’a pas encore publié ses plats.') + '</div>') +
      '</div>';

    view.querySelector('#back').onclick = () => Router.back();

    if (menu.length) {
      const groups = catsOfMenu.map(c => ({ id: c.id, title: c.icon + ' ' + c.name_fr, icon: c.icon, items: menu.filter(m => m.category_id === c.id) }));
      if (others.length) groups.push({ id: 'other', title: '🍽️ Autres', icon: '🍽️', items: others });

      view.querySelector('#menuNav').innerHTML = groups.map((g, i) =>
        '<button class="chip ' + (i === 0 ? 'on' : '') + '" data-jump="g' + g.id + '">' + U.esc(g.title) + '</button>').join('');

      view.querySelector('#menu').innerHTML = groups.map(g =>
        '<section id="g' + g.id + '" style="scroll-margin-top:76px">' +
          '<div class="section-head"><div class="h3">' + U.esc(g.title) + '</div>' +
          '<span class="tiny">' + g.items.length + ' plat(s)</span></div>' +
          '<div class="stack">' + g.items.map(m => Cmp.dishRow(m, g.icon)).join('') + '</div>' +
        '</section>').join('');

      view.querySelectorAll('[data-jump]').forEach(b => b.onclick = () => {
        view.querySelectorAll('[data-jump]').forEach(x => x.classList.toggle('on', x === b));
        const t = view.querySelector('#' + b.dataset.jump);
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      // ouverture de la fiche plat
      const openDish = id => dishSheet(r, menu.find(m => m.id === id));
      view.querySelectorAll('[data-dish]').forEach(el => el.onclick = e => {
        if (e.target.closest('[data-add]')) return;
        openDish(el.dataset.dish);
      });
      view.querySelectorAll('[data-add]').forEach(el => el.onclick = e => {
        e.stopPropagation();
        openDish(el.dataset.add);
      });
    }

    renderCartBar(view);
  });

  /* ---------------------------------------------------- fiche plat (sheet) */
  function dishSheet(resto, item) {
    if (!item) return;
    let qty = 1;
    const opts = item.options || [];

    UI.sheet({
      title: item.name,
      body:
        (item.image_url
          ? '<div style="height:170px;border-radius:16px;background:#EDF0F5 center/cover no-repeat;background-image:url(' + U.escUrl(item.image_url) + ');margin-bottom:14px"></div>'
          : '') +
        (item.description ? '<p class="sub" style="margin-bottom:14px">' + U.esc(item.description) + '</p>' : '') +
        '<div class="h2 price" style="margin-bottom:14px">' + U.money(item.price) + '</div>' +
        (opts.length
          ? '<div class="h3" style="margin-bottom:10px">Suppléments</div><div class="stack" style="gap:8px">' +
            opts.map((o, i) =>
              '<label class="row-between" style="padding:11px 13px;border:1.5px solid var(--line);border-radius:14px;cursor:pointer">' +
                '<span class="row" style="gap:10px"><input type="checkbox" data-opt="' + i + '" style="width:18px;height:18px;accent-color:var(--brand)">' +
                U.esc(o.name) + '</span>' +
                '<b class="' + (o.extra_price ? 'price' : 'tiny') + '">' + (o.extra_price ? '+ ' + U.money(o.extra_price) : 'Gratuit') + '</b>' +
              '</label>').join('') + '</div>'
          : ''),
      footer:
        '<div class="row" style="gap:12px">' +
          '<div class="qty"><button data-m>−</button><b id="q">1</b><button data-p>+</button></div>' +
          '<button class="btn btn-primary grow" id="add">Ajouter • <span id="tot">' + U.money(item.price) + '</span></button>' +
        '</div>',

      onMount(el, api) {
        const chosen = () => Array.prototype.slice.call(el.querySelectorAll('[data-opt]:checked'))
          .map(c => opts[+c.dataset.opt]);
        const refresh = () => {
          const extra = chosen().reduce((s, o) => s + (+o.extra_price || 0), 0);
          el.querySelector('#q').textContent = qty;
          el.querySelector('#tot').textContent = U.money((item.price + extra) * qty);
        };
        el.querySelector('[data-m]').onclick = () => { qty = Math.max(1, qty - 1); refresh(); };
        el.querySelector('[data-p]').onclick = () => { qty = Math.min(30, qty + 1); refresh(); };
        el.querySelectorAll('[data-opt]').forEach(c => c.onchange = refresh);

        el.querySelector('#add').onclick = async function () {
          if (!resto.open_now) return UI.err('Restaurant fermé', 'Réouverture à ' + U.hhmm(resto.opens_at));
          const ok = await Store.addToCart(resto, item, qty,
            chosen().map(o => ({ name: o.name, extra_price: o.extra_price })));
          if (!ok) return;
          api.close();
          UI.ok(qty + '× ' + item.name + ' ajouté', 'Panier : ' + U.money(Store.cartSubtotal));
          Shell.renderNav();
          renderCartBar(document.getElementById('view'));
        };
        refresh();
      }
    });
  }

  /* -------------------------------------------- barre panier flottante */
  function renderCartBar(view) {
    const old = document.getElementById('cartBar');
    if (old) old.remove();
    if (!Store.cartCount) return;

    const bar = document.createElement('div');
    bar.className = 'sticky-bar';
    bar.id = 'cartBar';
    bar.innerHTML = '<div class="wrap">' +
      '<div class="grow"><b>' + Store.cartCount + ' article(s)</b>' +
      '<div class="tiny">' + U.esc(Store.cart.restaurant_name || '') + '</div></div>' +
      '<a class="btn btn-primary" href="#/cart">Voir le panier • ' + U.money(Store.cartSubtotal) + '</a></div>';
    document.body.appendChild(bar);
    void view;
  }

  // la barre disparaît quand on change de page
  window.addEventListener('hashchange', () => {
    const b = document.getElementById('cartBar');
    if (b) b.remove();
  });

  /* ======================================================================
     PANIER
     ====================================================================== */
  Router.add('/cart', async function (params, query, view) {

    function paint() {
      if (!Store.cartCount) {
        view.innerHTML = '<div class="wrap page">' + Cmp.pageHead('Mon panier', '') +
          UI.empty('🛒', 'Votre panier est vide', 'Parcourez les restaurants et ajoutez vos plats préférés.',
            '<a class="btn btn-primary" href="#/restaurants">Voir les restaurants</a>') + '</div>';
        Shell.renderNav();
        return;
      }

      const t = Store.cartTotals;
      const below = Store.cart.min_order && t.subtotal < Store.cart.min_order;

      view.innerHTML = '<div class="wrap-sm page">' +
        Cmp.pageHead('Mon panier', Store.cart.restaurant_name || '',
          '<button class="btn btn-danger btn-sm" id="clear">Vider</button>') +

        '<div class="card card-p">' +
          Store.cart.items.map(l =>
            '<div class="cart-row">' +
              '<div class="dish-img" style="width:58px;height:58px;font-size:22px' +
                (l.image_url ? ';background-image:url(' + U.escUrl(l.image_url) + ')' : '') + '">' +
                (l.image_url ? '' : '🍽️') + '</div>' +
              '<div class="grow"><b style="font-size:14.5px">' + U.esc(l.name) + '</b>' +
                ((l.options && l.options.length)
                  ? '<div class="tiny">+ ' + U.esc(l.options.map(o => o.name).join(', ')) + '</div>' : '') +
                '<div class="price" style="margin-top:3px">' + U.money(Store.lineTotal(l)) + '</div></div>' +
              '<div class="qty"><button data-dec="' + U.esc(l.key) + '">−</button>' +
                '<b>' + l.quantity + '</b>' +
                '<button data-inc="' + U.esc(l.key) + '">+</button></div>' +
            '</div>').join('') +
        '</div>' +

        '<div class="card card-p" style="margin-top:14px">' +
          '<div class="oline"><span class="l">Sous-total</span><span>' + U.money(t.subtotal) + '</span></div>' +
          '<div class="oline"><span class="l">Frais de livraison</span><span>' + U.money(t.delivery_fee) + '</span></div>' +
          '<div class="divider"></div>' +
          '<div class="oline" style="font-size:17px;font-weight:800"><span>Total</span>' +
            '<span class="price">' + U.money(t.total) + '</span></div>' +
        '</div>' +

        (below ? '<div class="banner banner-warn" style="margin-top:12px">🧾 Minimum de commande : ' +
          U.money(Store.cart.min_order) + '. Ajoutez encore ' + U.money(Store.cart.min_order - t.subtotal) + '.</div>' : '') +

        '<button class="btn btn-primary btn-block btn-lg" style="margin-top:16px" id="next"' +
          (below ? ' disabled' : '') + '>Continuer la commande →</button>' +

        '<a class="btn btn-ghost btn-block" style="margin-top:10px" href="#/resto/' + U.esc(Store.cart.restaurant_id) + '">' +
          '+ Ajouter d’autres plats</a>' +
      '</div>';

      view.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => {
        const l = Store.cart.items.find(x => x.key === b.dataset.inc);
        Store.setQuantity(l.key, l.quantity + 1); paint();
      });
      view.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => {
        const l = Store.cart.items.find(x => x.key === b.dataset.dec);
        Store.setQuantity(l.key, l.quantity - 1); paint();
      });
      view.querySelector('#clear').onclick = async () => {
        if (await UI.confirm('Vider le panier ?', 'Tous les articles seront retirés.', 'Vider', true)) {
          Store.clearCart(); paint();
        }
      };
      view.querySelector('#next').onclick = () => {
        if (!Store.isLogged) {
          try { sessionStorage.setItem('talabi.after_login', '/checkout'); } catch (e) {}
          UI.toast('Connectez-vous pour finaliser votre commande');
          return Router.go('/login');
        }
        Router.go('/checkout');
      };
      Shell.renderNav();
    }

    paint();
  });
})(window);
