/* ==========================================================================
   VUE — Page d'accueil publique / client
   --------------------------------------------------------------------------
   Mise en page reprise de la maquette « theme talabi 3d plat » : pensée pour
   un téléphone tenu à une main, de haut en bas —

     héro (titre + plat)  →  recherche  →  trois raccourcis  →  bandeau de
     chiffres  →  promesse de livraison  →  restaurants  →  les 4 étapes

   Les catégories ne sont plus ici : elles vivent sur la page Restaurants, où
   elles filtrent réellement une liste.
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

    const ouLabel = Store.wilayaName();

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

        /* Les catégories vivaient ici. Elles sont désormais uniquement sur la
           page Restaurants, où elles servent réellement à filtrer une liste :
           sur l'accueil, elles renvoyaient vers cette même page — un détour
           pour arriver au même endroit. */

        /* -------------------------------------------------------- PROMESSE */
        /* Le bandeau fourni, tel quel. Le texte y est déjà composé — le
           reconstruire en HTML par-dessus l'aurait doublé. Il part donc en
           alt : lu par les lecteurs d'écran, et affiché si l'image manque. */
        '<img class="h3d-banner" src="' + U.escUrl(U.asset('assets/img/bg/moto.jpg')) + '" ' +
          'width="1693" height="586" loading="lazy" ' +
          'alt="Livraison rapide à votre porte — fraîcheur garantie, où que vous soyez. ' +
          'Rapide, frais, fiable.">' +

        /* ------------------------------------------------ RESTAURANTS */
        /* La médaille dit « classement », l'étoile aurait dit « note » —
           deux choses différentes, et la note vit déjà sur chaque carte. */
        '<div class="section-head rc-head">' +
          '<span class="rc-head-ic">' + UI.icon('medal', 22) + '</span>' +
          '<div class="grow"><div class="h2">Restaurants populaires</div>' +
          '<div class="sub">Livraison à ' + U.esc(ouLabel) + '</div></div>' +
          '<a class="rc-tout" href="#/restaurants">Tout voir ' +
            UI.icon('arrow-right', 16) + '</a>' +
        '</div>' +
        '<div id="popular">' + UI.skeletonCards(3) + '</div>' +

        /* -------------------------------------------- COMMENT ÇA MARCHE */
        /* Trois étapes, pas quatre. « Le restaurant prépare » décrivait ce que
           fait le restaurant, pas ce que fait le client : on lui demandait de
           lire une étape où il n'a rien à faire. */
        '<div class="h3d-steps" id="h3dSteps">' +
          '<div class="h2">Comment ça marche ?</div>' +
          '<p class="lead">Trois étapes, et votre repas est en route.</p>' +
          '<div class="rail">' +
            step('1', 'localisation', 'Votre position',
                 'Autorisez votre localisation et Talabi vous montre aussitôt les ' +
                 'restaurants les plus proches de vous.') +
            step('2', 'panier', 'Votre panier',
                 'Parcourez les menus, ajoutez vos plats et vos suppléments, puis ' +
                 'validez votre commande en une seule fois.') +
            step('3', 'livreur', 'Votre livreur',
                 'Un livreur récupère votre commande et vous l’apporte : suivez-le ' +
                 'en direct sur la carte et payez à la réception.') +
          '</div>' +
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

    /* ---- le champ montre quoi taper au lieu de le décrire ---------------
       « Un restaurant ou un plat » est une consigne : on la lit, on ne sait
       toujours pas quoi écrire. Des exemples qui s'écrivent tout seuls
       montrent la réponse — et disent au passage qu'il y a du monde
       derrière. Les vrais noms remplacent les exemples génériques dès que
       le catalogue est chargé, plus bas. */
    const machine = UI.typewriter(q, [
      'Ex : Melyza tacos', 'Ex : pizza margherita',
      'Ex : burger poulet', 'Ex : tacos viande hachée'
    ]);

    /* ---- les trois cases se rangent -------------------------------------
       Le bloc « Comment ça marche ? » est loin sous l'accueil. Lancer
       l'animation au chargement, c'est la jouer pour personne : le temps
       qu'on descende, elle est finie. Elle attend donc d'être VUE.

       Une seule fois par visite : ce qui étonne au premier passage agace au
       troisième, et on repasse par l'accueil à chaque retour. */
    const bloc = view.querySelector('#h3dSteps');
    if (bloc) {
      const jouer = () => bloc.classList.add('danse');
      if (!w.IntersectionObserver) jouer();
      else {
        const oeil = new IntersectionObserver(entrees => {
          entrees.forEach(e => {
            if (!e.isIntersecting) return;
            jouer();
            oeil.disconnect();
          });
        }, { threshold: .35 });
        oeil.observe(bloc);
      }
    }

    /* -------------------------------------------------------- données */
    /* Plus de filtre par quartier : on annonce la wilaya, on ne trie plus le
       catalogue dessus. Un client qui ouvre l'accueil veut voir ce qui existe,
       pas une liste déjà rétrécie par un réglage qu'il n'a pas fait. */
    const list = await API.safe(() => API.restaurants({}), []);
    Cmp.restoGrid(list.slice(0, 6), view.querySelector('#popular'));

    /* De vrais noms plutôt que des exemples inventés : un client qui voit
       défiler une enseigne qu'il connaît sait immédiatement que la recherche
       porte sur SA ville. On en garde quatre, mêlés à deux plats — le champ
       cherche les deux, il faut que ça se voie. */
    const enseignes = list.slice(0, 4).map(r => 'Ex : ' + r.name);
    if (enseignes.length)
      machine.mots(enseignes.concat(['Ex : pizza margherita', 'Ex : burger poulet']));

    const chiffre = (icone, valeur, label) =>
      '<div><span class="ic">' + icone + '</span>' +
      '<b>' + U.esc(valeur) + '</b><span class="lb">' + U.esc(label) + '</span></div>';

    view.querySelector('#heroStats').innerHTML =
      chiffre(UI.icon('store', 20), list.length + '+', 'Restaurants') +
      chiffre(UI.icon('pin', 20), String(Store.zones.length), 'Quartiers couverts') +
      chiffre(UI.icon('clock', 20), '25 min', 'Livraison moyenne');
  });

  /* ---------------------------------------------------------- fragments */
  /* Une étape : numéro en filigrane, pastille bleu nuit, titre, une phrase.
     Les trois sont reliées par un trait qui court derrière elles — c'est ce
     trait qui fait lire « une suite » plutôt que « trois cartes ».

     Les pictogrammes sont des images blanches sur fond bleu nuit : on les pose
     telles quelles, leur propre fond fait la pastille. Les détourer pour les
     mettre sur du blanc aurait demandé un second jeu de fichiers. */
  function step(n, image, titre, phrase) {
    return '<div class="h3d-step">' +
      '<span class="num">' + n + '</span>' +
      '<span class="ic" style="background-image:url(' +
        U.escUrl(U.asset('assets/img/steps/' + image + '.png')) + ')"></span>' +
      '<div class="tx">' +
        '<div class="h3">' + U.esc(titre) + '</div>' +
        '<p>' + U.esc(phrase) + '</p>' +
      '</div>' +
    '</div>';
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
