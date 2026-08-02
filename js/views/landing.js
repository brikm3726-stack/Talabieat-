/* ==========================================================================
   VUE — Page d'accueil publique / client
   --------------------------------------------------------------------------
   Mise en page reprise de la maquette « theme talabi 3d plat » : pensée pour
   un téléphone tenu à une main, de haut en bas —

     héro (titre + plat)  →  recherche  →  trois raccourcis  →  bandeau de
     chiffres  →  catégories  →  promesse de livraison  →  le reste

   Les emoji des catégories viennent de la base et sont rendus en grand plutôt
   que leurs vignettes : les vignettes sont des écussons sombres, qui jurent
   avec les cartes blanches de la maquette.
   ========================================================================== */
(function (w) {
  'use strict';

  /* « Vos plats préférés, livrés chez vous » : la seconde moitié passe en
     orange, comme sur la maquette. On coupe à la virgule ; sans virgule, le
     titre reste d'un seul tenant. */
  function tagline() {
    const t = String(TALABI_CONFIG.APP_TAGLINE || '');
    const i = t.indexOf(',');
    if (i < 0) return U.esc(t);
    return U.esc(t.slice(0, i + 1)) +
      '<span class="accent">' + U.esc(t.slice(i + 1).trim()) + '</span>';
  }

  /** Un raccourci : pastille pêche, deux lignes de texte, chevron. */
  function raccourci(icone, l1, l2, href) {
    return '<a class="h3d-q" href="' + href + '">' +
      '<span class="ic">' + icone + '</span>' +
      '<span class="tx">' + U.esc(l1) + '<br>' + U.esc(l2) + '</span>' +
      '<span class="ch">' + UI.icon('chevron', 17) + '</span></a>';
  }

  Router.add('/', async function (params, query, view) {

    /* Cette vitrine n'a de sens que dans l'application client. Ouverte depuis
       Talabi Resto ou Talabi Livreur, elle proposerait de commander un repas à
       quelqu'un venu travailler. */
    if (!App.est('client'))
      return Router.go(Store.isLogged ? Router.homeFor(Store.role) : '/login', true);

    // les comptes pro sont redirigés vers leur espace
    if (Store.isLogged && Store.role !== 'client') return Router.go(Router.homeFor(Store.role), true);

    const zoneLabel = Store.zoneName() || 'toute la ville';

    /* Un client connecté n'a rien à faire des appels à recruter des livreurs
       ou des restaurants : on lui propose les trois actions qui le concernent. */
    const isClient = Store.isLogged && Store.role === 'client';

    view.innerHTML = '<div class="home3d">' +

      /* ---------------------------------------------------------- HÉRO */
      '<section class="h3d-hero"><div class="wrap h3d-hin">' +
        '<div class="h3d-txt">' +
          '<h1>' + tagline() + '</h1>' +
          '<p>Les meilleurs restaurants de Tizi Ouzou livrés chez vous en ' +
            'quelques minutes. Paiement à la livraison.</p>' +
        '</div>' +
        /* le plat de la maquette, découpé au vol et fondu sur les bords : voir
           la note dans app.css (.h3d-bol) */
        '<span class="h3d-bol" aria-hidden="true"></span>' +
      '</div></section>' +

      '<div class="wrap h3d-body">' +

        /* ----------------------------------------------------- RECHERCHE */
        '<div class="h3d-search">' +
          '<span class="lo">' + UI.icon('search', 20) + '</span>' +
          '<input id="q" placeholder="Rechercher un restaurant ou un plat…" autocomplete="off">' +
          '<button class="btn btn-primary" id="goSearch">Rechercher</button>' +
        '</div>' +

        /* --------------------------------------------------- RACCOURCIS */
        '<div class="h3d-quick">' +
          raccourci(UI.icon('utensils', 22), 'Choisis ton', 'restaurant', '#/restaurants') +
          raccourci(UI.icon('cart', 22), 'Commander', 'maintenant',
                    Store.cartCount ? '#/cart' : '#/restaurants') +
          raccourci(UI.icon('scooter', 22), 'Le livreur', 't’attend',
                    isClient ? '#/orders' : App.lien('driver')) +
        '</div>' +

        /* ------------------------------------------------------ CHIFFRES */
        '<div class="h3d-stats" id="heroStats"></div>' +

        /* ---------------------------------------------------- CATÉGORIES */
        '<div class="h3d-head">' +
          '<div class="h2">Que voulez-vous manger ?</div>' +
          '<a class="h3d-all" href="#/restaurants">Voir tout ' + UI.icon('chevron', 15) + '</a>' +
        '</div>' +
        '<div class="h3d-cats" id="cats"></div>' +

        /* -------------------------------------------------------- PROMESSE */
        '<div class="h3d-promo">' +
          '<div class="tx">' +
            '<span class="ic">⚡</span>' +
            '<div class="h2">Livraison rapide<br><span class="accent">à votre porte</span></div>' +
            '<p>Fraîcheur garantie, où que vous soyez.</p>' +
          '</div>' +
          '<span class="scoot" aria-hidden="true"></span>' +
        '</div>' +

        /* ------------------------------------------------ RESTAURANTS */
        '<div class="section-head">' +
          '<div><div class="h2">Restaurants populaires</div>' +
          '<div class="sub">Livraison à ' + U.esc(zoneLabel) + '</div></div>' +
          '<a class="link" href="#/restaurants">Tout voir →</a>' +
        '</div>' +
        '<div id="popular">' + UI.skeletonCards(4) + '</div>' +

        /* -------------------------------------------- COMMENT ÇA MARCHE */
        '<div class="section-head" style="margin-top:34px"><div class="h2">Comment ça marche ?</div></div>' +
        '<div class="grid grid-auto">' +
          step('1', UI.icon('pin', 21), 'Choisissez votre quartier', 'Indiquez où vous êtes pour voir les restaurants qui livrent chez vous.') +
          step('2', '🛒', 'Composez votre panier', 'Parcourez les menus, ajoutez vos plats et vos suppléments.') +
          step('3', '👨‍🍳', 'Le restaurant prépare', 'Vous êtes prévenu dès que la commande est acceptée puis prête.') +
          step('4', '🛵', 'Un livreur vous l’apporte', 'Suivez la livraison en direct et payez à la réception.') +
        '</div>' +

        /* -------------------------------------------------------- PARTENAIRES */
        /* masqué pour un client connecté : il a déjà son compte */
        (isClient ? '' :
          '<div class="grid grid-auto" style="margin-top:34px">' +
            promo('🏪', 'Vous avez un restaurant ?', 'Rejoignez Talabi, recevez des commandes dès aujourd’hui et gérez votre menu en toute autonomie.', 'Ajouter mon restaurant', App.lien('restaurant'), 'assets/img/roles/restaurant.jpg') +
            promo('🛵', 'Vous voulez livrer ?', 'Travaillez quand vous voulez dans votre quartier et gagnez sur chaque course.', 'Devenir livreur', App.lien('driver'), 'assets/img/roles/driver.jpg') +
          '</div>') +
      '</div>' +

      /* -------------------------------------------------------------- PIED */
      '<footer class="footer"><div class="wrap">' +
        '<div class="row-between" style="flex-wrap:wrap;gap:18px">' +
          '<div><img src="' + U.asset('assets/img/logo.jpg') + '" alt="' + U.esc(TALABI_CONFIG.APP_NAME) + '" ' +
            'style="height:52px;border-radius:12px;background:#fff;padding:5px">' +
          '<div class="tiny" style="color:rgba(255,255,255,.6);margin-top:8px;max-width:320px">' +
            'Plateforme algérienne de livraison de repas. Paiement à la livraison.</div></div>' +
          '<div class="stack" style="gap:6px">' +
            '<a href="#/restaurants">Restaurants</a>' +
            (isClient
              ? '<a href="#/orders">Mes commandes</a><a href="#/account">Mon compte</a>'
              : '<a href="' + App.lien('driver') + '">Devenir livreur</a>' +
                '<a href="' + App.lien('restaurant') + '">Inscrire mon restaurant</a>') +
            '<a href="tel:' + U.esc(TALABI_CONFIG.SUPPORT_PHONE.replace(/\s/g, '')) + '">' +
              '📞 ' + U.esc(TALABI_CONFIG.SUPPORT_PHONE) + '</a>' +
            (TALABI_CONFIG.SUPPORT_EMAIL
              ? '<a href="mailto:' + U.esc(TALABI_CONFIG.SUPPORT_EMAIL) + '">' +
                  '✉️ ' + U.esc(TALABI_CONFIG.SUPPORT_EMAIL) + '</a>'
              : '') +
          '</div>' +
        '</div>' +
        '<div class="tiny" style="color:rgba(255,255,255,.45);margin-top:24px">© ' + new Date().getFullYear() + ' ' +
          U.esc(TALABI_CONFIG.APP_NAME) + ' — Tous droits réservés.</div>' +
      '</div></footer>' +
    '</div>';

    /* ------------------------------------------------------ interactions */
    const q = view.querySelector('#q');
    const search = () => {
      const v = q.value.trim();
      Router.go('/restaurants' + (v ? '?q=' + encodeURIComponent(v) : ''));
    };
    view.querySelector('#goSearch').onclick = search;
    q.onkeydown = e => { if (e.key === 'Enter') search(); };

    /* ---------------------------------------------------- catégories */
    /* « Tout » d'abord, en pastille pleine, puis les catégories de la base.
       On rend l'emoji, pas la vignette : les vignettes sont des écussons
       sombres qui jurent avec les cartes blanches. */
    view.querySelector('#cats').innerHTML =
      '<a class="h3d-cat on" href="#/restaurants">' +
        '<span class="ic">' + UI.icon('grid', 26) + '</span>' +
        '<span class="nm">Tout</span></a>' +
      Store.categories.map(c =>
        '<a class="h3d-cat" href="#/restaurants?cat=' + encodeURIComponent(c.id) + '">' +
          '<span class="em">' + (c.icon || '🍽️') + '</span>' +
          '<span class="nm">' + U.esc(c.name_fr) + '</span></a>').join('');

    /* -------------------------------------------------------- données */
    const list = await API.safe(() => API.restaurants({ zone_id: Store.zoneId }), []);
    Cmp.restoGrid(list.slice(0, 6), view.querySelector('#popular'));

    const chiffre = (icone, valeur, label) =>
      '<div><span class="ic">' + icone + '</span>' +
      '<b>' + U.esc(valeur) + '</b><span class="lb">' + U.esc(label) + '</span></div>';

    view.querySelector('#heroStats').innerHTML =
      chiffre(UI.icon('store', 20), list.length + '+', 'Restaurants') +
      chiffre(UI.icon('pin', 20), String(Store.zones.length), 'Quartiers couverts') +
      chiffre(UI.icon('clock', 20), '25 min', 'Livraison moyenne');
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

  /* img : logo du rôle sur pastille blanche (les logos sont sur fond blanc,
     ils seraient illisibles à même le dégradé sombre de la carte). */
  function promo(icon, title, text, cta, href, img) {
    return '<div class="card card-p" style="background:linear-gradient(140deg,#14161A,#26292F);color:#fff;border:none">' +
      (img
        ? '<div style="width:62px;height:62px;border-radius:18px;background:#fff center/78% no-repeat;' +
          'background-image:url(' + U.escUrl(img) + ')"></div>'
        : '<div style="font-size:32px">' + icon + '</div>') +
      '<div class="h2" style="margin-top:10px">' + U.esc(title) + '</div>' +
      '<p style="opacity:.75;font-size:14px;margin-top:8px">' + U.esc(text) + '</p>' +
      '<a class="btn btn-primary" style="margin-top:16px" href="' + href + '">' + U.esc(cta) + '</a></div>';
  }
})(window);
