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

  /* Le slogan et son plat en 3D ont quitté l'accueil : une demi-page pour une
     phrase que personne ne lit deux fois. La fonction qui coloriait ce titre
     n'a donc plus rien à colorier. */

  /** Une puce du bandeau de livraison : pictogramme orange, un mot. */
  function puce(icone, mot) {
    return '<span class="p">' + UI.icon(icone, 14) + U.esc(mot) + '</span>';
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

    /* L'accueil est sombre — avec compte ou sans, c'est le même écran. La
       classe est posée AVANT d'écrire la page : sinon le crème apparaîtrait
       le temps d'une image, et un clignotement blanc à chaque ouverture est
       le défaut le plus visible qu'on puisse offrir. Elle est retirée par le
       nettoyage rendu en fin de route. */
    UI.nuit('accueil');

    view.innerHTML = '<div class="home3d nuit">' +

      /* Le héros publicitaire est parti (maquette 1b) : une demi-page pour une
         phrase que personne ne lit deux fois, et qui repoussait le premier
         restaurant sous la ligne de flottaison.

         L'adresse de livraison ne le remplace pas non plus : la barre du haut
         l'annonce déjà et permet de la redétecter. Deux fois le même bouton à
         quinze centimètres l'un de l'autre, c'est une hésitation offerte à
         chaque ouverture — la recherche prend la place. */
      '<div class="wrap h3d-body">' +

        /* ----------------------------------------------------- RECHERCHE */
        /* ---- la barre de recherche, d'après la maquette « new theme accueil »
           LA LOUPE EST LE BOUTON DE RECHERCHE, et le rond orange à droite mène
           aux réglages. C'est ce que montre la maquette, et le pictogramme le
           dit : des curseurs de réglage, pas une flèche.

           La loupe devient donc un vrai <button> et non un décor : sans ça,
           quelqu'un qui tape « pizza » puis cherche où appuyer ne trouverait
           qu'un bouton qui l'emmène ailleurs. La touche Entrée cherche aussi. */
        '<div class="h3d-search">' +
          '<button class="lo" id="goSearch" title="Rechercher" ' +
            'aria-label="Rechercher">' + UI.icon('search', 20) + '</button>' +
          '<input id="q" placeholder="Rechercher un restaurant ou un plat…" autocomplete="off">' +
          /* Les réglages quittent la barre du haut, où ils doublonnaient
             l'onglet Compte. Ils prennent la place que la maquette leur donne :
             au bout du champ de recherche, en pastille orange. */
          '<a class="h3d-go" href="#/account" title="Réglages" ' +
            'aria-label="Réglages">' + UI.icon('settings', 21) + '</a>' +
        '</div>' +

        /* ------------------------------------- LA COMMANDE EN COURS D'ABORD
           Quand une commande est en route, c'est LA question du moment : où en
           est-elle. Elle vivait dans l'onglet Commandes, à deux touches d'ici —
           on ouvrait l'accueil, on cherchait, on tapait deux fois. Elle passe
           donc devant tout le reste, et disparaît d'elle-même dès qu'il n'y a
           plus rien à suivre. Rien de nouveau n'est calculé : ce sont les
           commandes du client, déjà en base. */
        '<div id="hmSuivi"></div>' +

        /* --------------------------------------------------- RACCOURCIS */
        '<div class="h3d-quick">' +
          raccourci(UI.icon('utensils', 22), 'Choisis ton', 'restaurant', '#/restaurants') +
          raccourci(UI.icon('cart', 22), 'Commander', 'maintenant',
                    Store.cartCount ? '#/cart' : '#/restaurants') +
          /* Le libellé suit la destination. Pour un visiteur sans compte, ce
             raccourci ouvre l'application Livreur : « Le livreur t'attend »
             annonçait donc une chose et en ouvrait une autre. */
          (isClient
            ? raccourci(UI.icon('scooter', 22), 'Le livreur', 't’attend', '#/orders')
            : raccourci(UI.icon('scooter', 22), 'Devenir', 'livreur', App.lien('driver'))) +
        '</div>' +

        /* ------------------------------------------------------ CHIFFRES */
        '<div class="h3d-stats" id="heroStats"></div>' +

        /* Les catégories vivaient ici. Elles sont désormais uniquement sur la
           page Restaurants, où elles servent réellement à filtrer une liste :
           sur l'accueil, elles renvoyaient vers cette même page — un détour
           pour arriver au même endroit. */

        /* -------------------------------------------------------- PROMESSE
           C'ÉTAIT UNE IMAGE AVEC SON TEXTE DESSINÉ DEDANS (moto.jpg,
           1693 × 586, orange sur crème). Trois défauts, tous visibles :

           — le texte était de l'image : mou dès qu'un écran l'agrandissait,
             impossible à sélectionner, invisible pour un lecteur d'écran
             autrement qu'en recopiant la phrase dans un `alt` ;
           — il restait orange et crème au milieu d'un écran noir, et rien
             ne peut le repeindre — c'est un fichier ;
           — 86 Ko pour une phrase de six mots.

           Reconstruit en texte plus une photo : net à toute densité, il suit
           le thème, et la photo est celle de la porte d'entrée — déjà en
           cache par le service worker, donc zéro octet de plus. */
        '<div class="h3d-livr">' +
          '<div class="tx">' +
            '<div class="h2">Livraison rapide<br>' +
              '<span class="accent">à votre porte</span></div>' +
            '<p>Fraîcheur garantie, où que vous soyez.</p>' +
            '<div class="pc">' +
              puce('flame', 'Rapide') +
              puce('sparkle', 'Frais') +
              puce('check-circle', 'Fiable') +
            '</div>' +
          '</div>' +
          /* La photo est décorative : tout ce qu'elle raconte est déjà écrit
             à côté d'elle. Elle est donc posée en fond, hors du flux de
             lecture, et la hauteur de la carte est réservée d'avance — la
             page ne saute pas quand l'image arrive. */
          '<span class="ph" aria-hidden="true"></span>' +
        '</div>' +

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

    /* ---- la commande en cours, en tête d'accueil ------------------------
       Quatre étapes sur la frise, les mêmes que l'écran de suivi : ce bandeau
       n'invente pas un vocabulaire de plus, il montre en petit ce que le suivi
       montre en grand. */
    async function peindreSuivi() {
      const boite = view.querySelector('#hmSuivi');
      if (!boite || !isClient) return;
      const list = await API.safe(() => API.orders({ scope: 'client' }), []);
      const EN_COURS = ['pending', 'accepted', 'preparing', 'ready',
                        'driver_assigned', 'delivering'];
      const o = list.find(x => EN_COURS.indexOf(x.status) >= 0);
      if (!o) { boite.innerHTML = ''; return; }

      const etape = { ready: 1, driver_assigned: 2, delivering: 3, delivered: 4 }[o.status] || 1;
      /* En route : le prénom du livreur suffit — « Karim arrive » se lit plus
         vite que « votre livreur est en route ». Avant qu'il soit assigné, on
         annonce l'étape, pas une personne qui n'existe pas encore. */
      const prenom = (o.driver && (o.driver.full_name || '').split(' ')[0]) || '';
      const titre = o.status === 'delivering'
        ? (prenom ? prenom + ' arrive' : 'Votre commande arrive')
        : o.status === 'driver_assigned'
          ? (prenom ? prenom + ' va au restaurant' : 'Un livreur a pris votre commande')
          : o.status === 'ready' ? 'Prête — on cherche un livreur'
          : o.status === 'preparing' ? 'En préparation'
          : o.status === 'accepted' ? 'Commande acceptée'
          : 'En attente du restaurant';

      boite.innerHTML =
        '<a class="hm-suivi" href="#/order/' + U.esc(o.id) + '">' +
          '<span class="sheen" aria-hidden="true"></span>' +
          '<span class="ic">' + UI.icon('scooter', 26) + '</span>' +
          '<span class="tx">' +
            '<span class="etat"><i></i>' +
              U.esc(U.statusLabel(o.status)) + '</span>' +
            '<b>' + U.esc(titre) + '</b>' +
            '<span class="det">' +
              U.esc((o.restaurant && o.restaurant.name) || '') +
              ' · ' + (o.items ? o.items.length : 0) + ' article' +
              ((o.items && o.items.length > 1) ? 's' : '') +
              ' · ' + U.esc(U.money(o.total)) + '</span>' +
          '</span>' +
          '<span class="go">' + UI.icon('chevron', 18) + '</span>' +
          '<span class="frise">' +
            [0, 1, 2, 3].map(i => '<i class="' + (i < etape ? 'on' : '') + '"></i>').join('') +
          '</span>' +
        '</a>';
    }
    peindreSuivi();

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
       pas une liste déjà rétrécie par un réglage qu'il n'a pas fait.

       LE CATALOGUE NE BLOQUE PLUS LA FIN DE LA ROUTE, ET C'EST DÉLIBÉRÉ.
       Le routeur ne reçoit le nettoyage qu'au retour de la route. Tant que
       celle-ci attendait le réseau, quitter l'accueil pendant le chargement
       laissait l'écran suivant peint en noir jusqu'à l'arrivée des données :
       du texte sombre sur fond sombre, pendant une demi-seconde, à chaque
       fois qu'on appuyait vite sur un onglet.
       Écrire dans un conteneur déjà remplacé est sans effet — chaque
       affichage a le sien (voir Router.render). */
    (async function charger() {
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

      const st = view.querySelector('#heroStats');
      if (st) st.innerHTML =
        chiffre(UI.icon('store', 20), list.length + '+', 'Restaurants') +
        chiffre(UI.icon('pin', 20), String(Store.zones.length), 'Quartiers couverts') +
        chiffre(UI.icon('clock', 20), '25 min', 'Livraison moyenne');
    })();

    /* Le thème sombre s'éteint en quittant l'accueil : les autres écrans de
       l'application sont encore clairs, et les laisser en noir sur fond noir
       les rendrait illisibles. */
    return () => UI.nuit('');
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
