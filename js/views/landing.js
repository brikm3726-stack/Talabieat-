/* ==========================================================================
   VUE — Page d'accueil publique / client
   ========================================================================== */
(function (w) {
  'use strict';

  Router.add('/', async function (params, query, view) {

    // les comptes pro sont redirigés vers leur espace
    if (Store.isLogged && Store.role !== 'client') return Router.go(Router.homeFor(Store.role), true);

    const zoneLabel = Store.zoneName() || 'toute la ville';

    view.innerHTML =
      /* ---------------------------------------------------------- HÉRO */
      '<section class="hero"><div class="wrap hero-in">' +
        '<h1>' + U.esc(TALABI_CONFIG.APP_TAGLINE) + '</h1>' +
        '<p>Les meilleurs restaurants de Tizi Ouzou livrés chez vous en quelques minutes. Paiement à la livraison.</p>' +
        '<div class="hero-search">' +
          '<input id="q" placeholder="Rechercher un restaurant ou un plat…" autocomplete="off">' +
          '<button class="btn btn-dark" id="goSearch">Rechercher</button>' +
        '</div>' +
        '<div class="hero-cta">' +
          '<a class="btn btn-lg" style="background:#fff;color:var(--brand)" href="#/restaurants">🍽️ Commander maintenant</a>' +
          '<a class="btn btn-lg" style="background:rgba(255,255,255,.18);color:#fff;backdrop-filter:blur(4px)" href="#/signup?role=driver">🛵 Devenir livreur</a>' +
          '<a class="btn btn-lg" style="background:rgba(255,255,255,.18);color:#fff;backdrop-filter:blur(4px)" href="#/signup?role=restaurant">🏪 Ajouter mon restaurant</a>' +
        '</div>' +
        '<div class="hero-stats" id="heroStats"></div>' +
      '</div></section>' +

      '<div class="wrap page">' +

        /* ------------------------------------------------- CATÉGORIES */
        '<div class="section-head"><div class="h2">Que voulez-vous manger ?</div></div>' +
        '<div id="cats"></div>' +

        /* ------------------------------------------------ RESTAURANTS */
        '<div class="section-head">' +
          '<div><div class="h2">Restaurants populaires</div>' +
          '<div class="sub">Livraison à ' + U.esc(zoneLabel) + '</div></div>' +
          '<a class="link" href="#/restaurants">Tout voir →</a>' +
        '</div>' +
        '<div id="popular">' + UI.skeletonCards(4) + '</div>' +

        /* -------------------------------------------------- COMMENT ÇA MARCHE */
        '<div class="section-head" style="margin-top:34px"><div class="h2">Comment ça marche ?</div></div>' +
        '<div class="grid grid-auto">' +
          step('1', '📍', 'Choisissez votre quartier', 'Indiquez où vous êtes pour voir les restaurants qui livrent chez vous.') +
          step('2', '🛒', 'Composez votre panier', 'Parcourez les menus, ajoutez vos plats et vos suppléments.') +
          step('3', '👨‍🍳', 'Le restaurant prépare', 'Vous êtes prévenu dès que la commande est acceptée puis prête.') +
          step('4', '🛵', 'Un livreur vous l’apporte', 'Suivez la livraison en direct et payez à la réception.') +
        '</div>' +

        /* -------------------------------------------------------- PARTENAIRES */
        '<div class="grid grid-auto" style="margin-top:34px">' +
          promo('🏪', 'Vous avez un restaurant ?', 'Rejoignez Talabi, recevez des commandes dès aujourd’hui et gérez votre menu en toute autonomie.', 'Ajouter mon restaurant', '#/signup?role=restaurant') +
          promo('🛵', 'Vous voulez livrer ?', 'Travaillez quand vous voulez dans votre quartier et gagnez sur chaque course.', 'Devenir livreur', '#/signup?role=driver') +
        '</div>' +
      '</div>' +

      /* -------------------------------------------------------------- PIED */
      '<footer class="footer"><div class="wrap">' +
        '<div class="row-between" style="flex-wrap:wrap;gap:18px">' +
          '<div><img src="assets/img/logo.jpg" alt="' + U.esc(TALABI_CONFIG.APP_NAME) + '" ' +
            'style="height:52px;border-radius:12px;background:#fff;padding:5px">' +
          '<div class="tiny" style="color:rgba(255,255,255,.6);margin-top:8px;max-width:320px">' +
            'Plateforme algérienne de livraison de repas. Paiement à la livraison.</div></div>' +
          '<div class="stack" style="gap:6px">' +
            '<a href="#/restaurants">Restaurants</a>' +
            '<a href="#/signup?role=driver">Devenir livreur</a>' +
            '<a href="#/signup?role=restaurant">Inscrire mon restaurant</a>' +
            '<a href="tel:' + U.esc(TALABI_CONFIG.SUPPORT_PHONE) + '">Support : ' + U.esc(TALABI_CONFIG.SUPPORT_PHONE) + '</a>' +
          '</div>' +
        '</div>' +
        '<div class="tiny" style="color:rgba(255,255,255,.45);margin-top:24px">© ' + new Date().getFullYear() + ' ' +
          U.esc(TALABI_CONFIG.APP_NAME) + ' — Tous droits réservés.</div>' +
      '</div></footer>';

    /* ------------------------------------------------------ interactions */
    const q = view.querySelector('#q');
    const search = () => {
      const v = q.value.trim();
      Router.go('/restaurants' + (v ? '?q=' + encodeURIComponent(v) : ''));
    };
    view.querySelector('#goSearch').onclick = search;
    q.onkeydown = e => { if (e.key === 'Enter') search(); };

    const cats = Cmp.categoryScroller(null, id => Router.go('/restaurants' + (id ? '?cat=' + id : '')));
    view.querySelector('#cats').innerHTML = cats.html;
    cats.bind(view);

    /* -------------------------------------------------------- données */
    const list = await API.safe(() => API.restaurants({ zone_id: Store.zoneId }), []);
    Cmp.restoGrid(list.slice(0, 6), view.querySelector('#popular'));

    view.querySelector('#heroStats').innerHTML =
      '<div><b>' + list.length + '+</b><span>Restaurants</span></div>' +
      '<div><b>' + Store.zones.length + '</b><span>Quartiers couverts</span></div>' +
      '<div><b>25 min</b><span>Livraison moyenne</span></div>';
  });

  /* ---------------------------------------------------------- fragments */
  function step(n, icon, title, text) {
    return '<div class="card card-p">' +
      '<div class="row" style="gap:12px">' +
        '<div style="width:44px;height:44px;border-radius:14px;background:var(--brand-soft);display:grid;place-items:center;font-size:21px;flex:none">' + icon + '</div>' +
        '<div><div class="tiny" style="font-weight:800;color:var(--brand)">ÉTAPE ' + n + '</div>' +
        '<div class="h3">' + U.esc(title) + '</div></div>' +
      '</div>' +
      '<p class="sub" style="margin-top:10px">' + U.esc(text) + '</p></div>';
  }

  function promo(icon, title, text, cta, href) {
    return '<div class="card card-p" style="background:linear-gradient(140deg,#14161A,#26292F);color:#fff;border:none">' +
      '<div style="font-size:32px">' + icon + '</div>' +
      '<div class="h2" style="margin-top:10px">' + U.esc(title) + '</div>' +
      '<p style="opacity:.75;font-size:14px;margin-top:8px">' + U.esc(text) + '</p>' +
      '<a class="btn btn-primary" style="margin-top:16px" href="' + href + '">' + U.esc(cta) + '</a></div>';
  }
})(window);
