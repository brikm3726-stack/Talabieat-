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

    /* Thème sombre, comme l'accueil (maquette « trer »). Posé avant d'écrire
       la page : sinon le crème apparaîtrait le temps d'une image. */
    UI.nuit('restaurants');

    view.innerHTML = '<div class="wrap page">' +
      Cmp.pageHead('Restaurants', Store.zoneName() ? 'Livraison à ' + Store.zoneName() : 'Toute la ville de Tizi Ouzou',
        '<button class="btn btn-ghost btn-sm" id="zoneBtn2">' + UI.pin(14) + ' ' + U.esc(Store.zoneName() || 'Mon quartier') + '</button>') +
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
      /* Premier affichage : des squelettes, il n'y a rien à conserver.
         Changement de filtre : on garde la liste en place, estompée, et on
         fige sa hauteur le temps du chargement. Sans ça, la remplacer par
         quatre squelettes plus courts faisait remonter la page d'un coup —
         c'est ce saut qu'on voyait en passant de « Tout » à « Pizza ». */
      const dejaRempli = results.children.length > 0 && !results.querySelector('.skel');
      if (dejaRempli) {
        results.style.minHeight = results.offsetHeight + 'px';
        results.classList.add('en-chargement');
      } else {
        results.innerHTML = UI.skeletonCards(4);
      }

      const fini = () => {
        results.classList.remove('en-chargement');
        // la hauteur n'est figée que pendant le chargement, sinon la liste ne
        // pourrait plus jamais raccourcir
        requestAnimationFrame(() => { results.style.minHeight = ''; });
      };
      // quoi qu'il arrive — retour anticipé, résultat vide, erreur — la liste
      // retrouve son état normal
      try { await charger(); } finally { fini(); }
    }

    async function charger() {
      if (mode === 'dish') {
        if (term.trim().length < 2) {
          results.innerHTML = UI.empty('🔎', 'Recherchez un plat', 'Saisissez au moins 2 lettres (pizza, tacos, chawarma…).');
          return;
        }
        const dishes = await API.safe(() => API.searchDishes(term, null), []);
        if (!dishes.length) {
          results.innerHTML = UI.empty('🍽️', 'Aucun plat trouvé', 'Essayez un autre mot-clé.');
          return;
        }
        const catOf = id => Store.categories.find(c => c.id === id) || {};
        results.innerHTML = '<div class="stack">' + dishes.map(d =>
          '<div data-goto="' + U.esc(d.restaurant.id) + '">' +
            Cmp.dishRow(Object.assign({}, d, { is_available: true }), catOf(d.category_id)) +
            '<div class="tiny" style="margin:-6px 0 4px 13px">chez <b>' + U.esc(d.restaurant.name) + '</b> • ' +
              U.esc(d.restaurant.zone ? d.restaurant.zone.name : '') + '</div>' +
          '</div>').join('') + '</div>';
        results.querySelectorAll('[data-goto]').forEach(el =>
          el.onclick = () => Router.go('/resto/' + el.dataset.goto));
        return;
      }

      const q = term.trim();
      /* Plus de filtre par quartier : le catalogue montre toute la ville.
         Le quartier reste demandé à la commande, là où il sert — pas pour
         retrancher des restaurants a quelqu'un qui regarde. */
      const list = await searchRestaurants(q, null, cat);

      /* Le repli « rien dans votre quartier, mais des résultats ailleurs »
         vivait ici. Il n'a plus lieu d'être : la liste couvre déjà toute la
         ville, donc un résultat vide veut dire vide, pas « masqué par un
         filtre que vous avez oublié ». */
      Cmp.restoGrid(list, results);

      /* Les exemples du champ deviennent de vrais noms de la ville dès que
         la liste est là : voir défiler une enseigne qu'on connaît vaut
         mieux que n'importe quel exemple inventé. */
      if (machineR && list.length)
        machineR.mots(list.slice(0, 4).map(r => 'Ex : ' + r.name)
          .concat(['Ex : pizza margherita']));
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

    const champ = view.querySelector('#q');
    const onType = U.debounce(() => { term = champ.value; load(); }, 320);
    champ.oninput = onType;

    /* Même repère qui s'écrit que sur l'accueil : la page Restaurants est
       souvent la première qu'on ouvre, et le champ y est encore plus muet
       — « Restaurant ou plat… » ne donne aucun exemple. Rien ne s'anime si
       le champ arrive déjà rempli (retour de recherche). */
    const machineR = UI.typewriter(champ, [
      'Ex : Melyza tacos', 'Ex : pizza margherita', 'Ex : burger poulet'
    ]);

    view.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
      mode = b.dataset.mode;
      view.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b));
      paintCats();
      load();
    });

    paintCats();
    /* Le chargement n'est plus attendu : le routeur ne reçoit le nettoyage
       qu'au retour de la route, et tant qu'il attendait le réseau, quitter
       cet écran pendant le chargement laissait le suivant peint en noir.
       Écrire dans un conteneur déjà remplacé est sans effet — chaque
       affichage a le sien (voir Router.render). */
    load();

    return () => UI.nuit('');
  });

  /* ======================================================================
     FICHE RESTAURANT
     ====================================================================== */
  Router.add('/resto/:id', async function (params, query, view) {
    /* La fiche suit la liste. Une liste sombre qui ouvre un menu blanc, c'est
       un éblouissement à chaque restaurant touché — et c'est le premier geste
       que fait tout le monde après avoir choisi. */
    UI.nuit('resto');

    view.innerHTML = '<div class="wrap page"><div class="skel" style="height:180px"></div>' +
      '<div class="skel" style="height:110px;margin-top:16px"></div></div>';

    const r = await API.safe(() => API.restaurant(params.id), null);
    if (!r) {
      view.innerHTML = '<div class="wrap page">' + UI.empty('🏪', 'Restaurant introuvable', '',
        '<a class="btn btn-primary" href="#/restaurants">Voir les restaurants</a>') + '</div>';
      // le thème doit s'éteindre même par ce chemin-là, sinon l'écran suivant
      // reste noir
      return () => UI.nuit('');
    }

    const menu = await API.safe(() => API.menuItems(r.id), []);
    const catsOfMenu = [];
    Store.categories.forEach(c => { if (menu.some(m => m.category_id === c.id)) catsOfMenu.push(c); });
    const others = menu.filter(m => !catsOfMenu.some(c => c.id === m.category_id));

    const cover = r.cover_url ? 'background-image:url(' + U.escUrl(r.cover_url) + ')' : '';
    const logo = r.logo_url ? 'background-image:url(' + U.escUrl(r.logo_url) + ')' : '';
    const emoji = (r.category_list && r.category_list[0] && r.category_list[0].icon) || '🍽️';

    view.innerHTML =
      /* Les mesures de la couverture, du bouton retour et de la fiche qui la
         chevauche sont passées de l'attribut `style` à des classes — mêmes
         valeurs, au pixel près. Un style en ligne l'emporte sur toute feuille :
         tant qu'il était là, aucun thème ne pouvait redessiner cette page. */
      '<div class="resto-cover rp-cover" style="' + cover + '">' +
        (cover ? '' : '<div style="height:100%;display:grid;place-items:center;font-size:64px;opacity:.3">' + emoji + '</div>') +
        '<button class="icon-btn rp-back" id="back">←</button>' +
        (r.open_now ? '' : '<div class="closed-ov">FERMÉ ACTUELLEMENT</div>') +
      '</div>' +

      '<div class="wrap page" style="padding-top:0">' +
        '<div class="card card-p rp-fiche">' +
          '<div class="row" style="gap:13px;align-items:flex-start">' +
            '<div style="width:58px;height:58px;border-radius:17px;background:#fff center/cover no-repeat;' + logo +
              ';border:1px solid var(--line);display:grid;place-items:center;font-size:26px;flex:none">' + (logo ? '' : emoji) + '</div>' +
            '<div class="grow">' +
              '<div class="h2">' + U.esc(r.name) + '</div>' +
              '<div class="resto-meta">' +
                '<span>⭐ <b>' + (+r.rating).toFixed(1) + '</b> (' + (r.rating_count || 0) + ')</span>' +
                '<span class="dot-sep">🕒 ' + r.prep_time_min + ' min</span>' +
                // le tarif dépend de la distance : on annonce le plancher, le montant
            // exact apparaît une fois l'adresse choisie
            '<span class="dot-sep">🛵 dès ' + U.money(U.deliveryFor(0, Store.settings).fee) + '</span>' +
              '</div>' +
            '</div>' +
            '<span class="tag ' + (r.open_now ? 'tag-ok' : 'tag-muted') + '">' + (r.open_now ? 'Ouvert' : 'Fermé') + '</span>' +
          '</div>' +
          (r.description ? '<p class="sub" style="margin-top:12px">' + U.esc(r.description) + '</p>' : '') +
          '<div class="divider"></div>' +
          '<div class="tiny stack" style="gap:5px">' +
            '<div>' + UI.pin() + ' ' + U.esc(r.address || '—') + (r.zone ? ' — ' + U.esc(r.zone.name) : '') + '</div>' +
            '<div>🕘 Horaires : ' + U.hhmm(r.opens_at) + ' – ' + U.hhmm(r.closes_at) + '</div>' +
            (r.phone ? '<div>📞 <a href="tel:' + U.esc(r.phone) + '" style="color:var(--brand);font-weight:650">' + U.esc(r.phone) + '</a></div>' : '') +
            (r.min_order ? '<div>🧾 Minimum de commande : <b>' + U.money(r.min_order) + '</b></div>' : '') +
          '</div>' +
        '</div>' +

        (r.open_now ? '' : '<div class="banner banner-warn" style="margin-top:14px">⏰ Ce restaurant est fermé. Vous pourrez commander dès sa réouverture (' + U.hhmm(r.opens_at) + ').</div>') +

        (menu.length
          ? '<div id="menuNav" class="menu-tabs chips"></div><div id="menu" class="stack" style="margin-top:6px"></div>'
          : '<div style="margin-top:20px">' + UI.empty('📋', 'Menu en préparation', 'Ce restaurant n’a pas encore publié ses plats.') + '</div>') +
      '</div>';

    view.querySelector('#back').onclick = () => Router.back();

    if (menu.length) {
      const groups = catsOfMenu.map(c => ({ id: c.id, name: c.name_fr, cat: c, items: menu.filter(m => m.category_id === c.id) }));
      if (others.length) groups.push({ id: 'other', name: 'Autres', cat: { icon: '🍽️' }, items: others });

      // logo de la catégorie, emoji seulement en repli
      const gIcon = (g, big) => g.cat.image_url
        ? '<span class="g-ic' + (big ? ' big' : '') + '" style="background-image:url(' + U.escUrl(g.cat.image_url) + ')"></span>'
        : '<span class="g-ic emoji' + (big ? ' big' : '') + '">' + (g.cat.icon || '🍽️') + '</span>';

      const nav = view.querySelector('#menuNav');
      const box = view.querySelector('#menu');
      const openDish = id => dishSheet(r, menu.find(m => m.id === id));
      let active = 0;

      nav.innerHTML = groups.map((g, i) =>
        '<button class="chip" data-tab="' + i + '">' + gIcon(g) + U.esc(g.name) +
          '<span class="chip-n">' + g.items.length + '</span></button>').join('');

      /* Une seule catégorie affichée à la fois : les onglets remplacent le
         contenu au lieu de faire défiler une page unique. */
      function paintMenu() {
        const g = groups[active];
        nav.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', +b.dataset.tab === active));
        box.innerHTML =
          '<div class="section-head"><div class="h3">' + gIcon(g, true) + U.esc(g.name) + '</div>' +
          '<span class="tiny">' + g.items.length + ' plat(s)</span></div>' +
          '<div class="stack">' + g.items.map(m => Cmp.dishRow(m, g.cat)).join('') + '</div>';

        box.querySelectorAll('[data-dish]').forEach(el => el.onclick = e => {
          if (e.target.closest('[data-add]')) return;
          openDish(el.dataset.dish);
        });
        box.querySelectorAll('[data-add]').forEach(el => el.onclick = e => {
          e.stopPropagation();
          openDish(el.dataset.add);
        });
      }

      nav.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
        active = +b.dataset.tab;
        paintMenu();
        b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        // si on était descendu dans la liste précédente, on remonte en haut de
        // la nouvelle plutôt que d'atterrir au milieu du vide. La barre étant
        // collante, son sommet vaut 60 dès qu'on a défilé au-delà.
        if (nav.getBoundingClientRect().top <= 60) {
          nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      paintMenu();
    }

    renderCartBar(view);

    return () => UI.nuit('');
  });

  /* ---------------------------------------------------- fiche plat (sheet) */
  function dishSheet(resto, item) {
    if (!item) return;
    let qty = 1;
    const opts = item.options || [];
    const formats = item.variants || [];
    let vIdx = 0;                      // format retenu, le premier par défaut

    const basePrice = () => formats.length ? formats[vIdx].price : item.price;

    UI.sheet({
      title: item.name,
      body:
        /* Les mesures passent en classes — `.dish-hero`, `.opt-lab`, `.opt-row`,
           aux mêmes valeurs. Un style en ligne l'emporte sur toute feuille :
           tant que la bordure et le remplissage des lignes étaient écrits ici,
           aucun thème ne pouvait les redessiner. Les deux listes portent
           désormais la MÊME classe : le format et les suppléments se ressemblent
           déjà à l'œil, ils doivent se désigner pareil. */
        (item.image_url
          ? '<div class="dish-hero" style="background-image:url(' + U.escUrl(item.image_url) + ')"></div>'
          : '') +
        (item.description ? '<p class="sub" style="margin-bottom:14px">' + U.esc(item.description) + '</p>' : '') +
        (formats.length
          ? '<div class="h3 opt-lab">Format</div><div class="stack" style="gap:8px;margin-bottom:16px">' +
            formats.map((v, i) =>
              '<label class="row-between opt-row">' +
                '<span class="row" style="gap:10px"><input type="radio" name="fmt" data-fmt="' + i + '"' +
                  (i === 0 ? ' checked' : '') + '>' +
                U.esc(v.name) + '</span>' +
                '<b class="price">' + U.money(v.price) + '</b>' +
              '</label>').join('') + '</div>'
          : '<div class="h2 price" style="margin-bottom:14px">' + U.money(item.price) + '</div>') +
        (opts.length
          ? '<div class="h3 opt-lab">Suppléments <span class="tiny">(facultatif)</span></div>' +
            '<div class="stack" style="gap:8px">' +
            opts.map((o, i) =>
              '<label class="row-between opt-row">' +
                '<span class="row" style="gap:10px"><input type="checkbox" data-opt="' + i + '">' +
                U.esc(o.name) + '</span>' +
                '<b class="' + (o.extra_price ? 'price' : 'tiny') + '">' + (o.extra_price ? '+ ' + U.money(o.extra_price) : 'Gratuit') + '</b>' +
              '</label>').join('') + '</div>'
          : ''),
      footer:
        '<div class="row" style="gap:12px">' +
          '<div class="qty"><button data-m>−</button><b id="q">1</b><button data-p>+</button></div>' +
          '<button class="btn btn-primary grow" id="add">Ajouter • <span id="tot">' + U.money(basePrice()) + '</span></button>' +
        '</div>',

      onMount(el, api) {
        const chosen = () => Array.prototype.slice.call(el.querySelectorAll('[data-opt]:checked'))
          .map(c => opts[+c.dataset.opt]);
        const refresh = () => {
          const extra = chosen().reduce((s, o) => s + (+o.extra_price || 0), 0);
          el.querySelector('#q').textContent = qty;
          el.querySelector('#tot').textContent = U.money((basePrice() + extra) * qty);
        };
        el.querySelector('[data-m]').onclick = () => { qty = Math.max(1, qty - 1); refresh(); };
        el.querySelector('[data-p]').onclick = () => { qty = Math.min(30, qty + 1); refresh(); };
        el.querySelectorAll('[data-opt]').forEach(c => c.onchange = refresh);
        el.querySelectorAll('[data-fmt]').forEach(c => c.onchange = () => {
          if (c.checked) { vIdx = +c.dataset.fmt; refresh(); }
        });

        el.querySelector('#add').onclick = async function () {
          if (!resto.open_now) return UI.err('Restaurant fermé', 'Réouverture à ' + U.hhmm(resto.opens_at));
          const v = formats.length ? formats[vIdx] : null;
          const ok = await Store.addToCart(resto, item, qty,
            chosen().map(o => ({ name: o.name, extra_price: o.extra_price })), v);
          if (!ok) return;
          api.close();
          UI.ok(qty + '× ' + item.name + (v ? ' (' + v.name + ')' : '') + ' ajouté',
                'Panier : ' + U.money(Store.cartSubtotal));
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

    /* Thème sombre (maquette « panier 43 »). */
    UI.nuit('panier');

    function paint() {
      if (!Store.cartCount) {
        view.innerHTML =
          '<div class="empty-scene"><div class="wrap">' +
            /* DEUX ILLUSTRATIONS, UNE PAR THÈME, et c'est nécessaire.
               La version claire est dessinée sur fond quasi blanc : le thème
               clair la fond dans la page avec `mix-blend-mode:multiply`, mais
               multiplier par du noir donne du noir — sur fond sombre elle
               n'aurait laissé qu'un rectangle éteint. La version sombre est
               découpée dans la maquette fournie ; posée sur du crème, elle
               ferait à l'inverse un bloc noir. Chacune ne va que sur son
               thème, donc on choisit selon la préférence. */
            (UI.sombreVoulu()
              ? '<img class="scene-art" src="' + U.asset('assets/img/bg/panier-vide-nuit.jpg') + '" ' +
                  'width="1672" height="1016" decoding="async" alt="" aria-hidden="true">'
              : '<img class="scene-art" src="' + U.asset('assets/img/bg/panier-vide.png') + '" ' +
                  'width="830" height="430" decoding="async" alt="" aria-hidden="true">') +
            '<div class="h1 scene-title">Votre panier est vide</div>' +
            '<p class="scene-sub">Ajoutez vos plats préférés parmi les meilleurs restaurants de votre ville.</p>' +
            '<div class="scene-cta">' +
              '<a class="btn btn-primary btn-lg" href="#/restaurants">Découvrir les restaurants →</a>' +
              '<a class="btn btn-ghost btn-lg" href="#/">Retour à l’accueil 🏠</a>' +
            '</div>' +
          '</div></div>';
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
                (l.variant ? ' <span class="tag tag-muted">' + U.esc(l.variant.name) + '</span>' : '') +
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

    return () => UI.nuit('');
  });
})(window);
