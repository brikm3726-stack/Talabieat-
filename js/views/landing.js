/* ==========================================================================
   VUE — Page d'accueil publique / client
   --------------------------------------------------------------------------
   Mise en page reprise de la maquette « theme talabi 3d plat » : pensée pour
   un téléphone tenu à une main, de haut en bas —

     accroche  →  « nous arrivons bientôt à … »  →  commande en cours  →
     recherche  →  trois raccourcis  →  bandeau de chiffres  →  promesse de
     livraison  →  restaurants  →  les 3 étapes

   Les catégories (Tout, Pizza, Tacos, Burger…) ne sont plus ici : elles vivent
   sur la page Restaurants, où elles filtrent réellement une liste. La recherche
   a pris leur place, et la ligne des villes à venir a pris celle de la
   recherche.
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

    /* Le prénom seul : « Bonjour Amine » se lit comme quelqu'un qui vous
       parle, « Bonjour Amine Belkacem » comme une administration. */
    const prenom = isClient
      ? ((Store.profile && Store.profile.full_name) || '').trim().split(' ')[0]
      : '';

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

        /* ----------------------------------------------- L'ACCROCHE
           Le prénom seul, pas le nom complet : « Bonjour Amine » se lit comme
           quelqu'un qui vous parle, « Bonjour Amine Belkacem » comme une
           administration. Et rien du tout pour un visiteur — le saluer par son
           absence de compte serait maladroit. */
        '<div class="h3d-accroche">' +
          '<div class="salut">Bonjour' +
            (prenom ? ' <b>' + U.esc(prenom) + '</b>' : '') + ' 👋</div>' +
          '<h1 class="titre">Que souhaitez-vous<br>manger aujourd’hui ?</h1>' +
        '</div>' +

        /* ------------------------------------------- LES VILLES QUI ARRIVENT
           À la place qu'occupait la recherche, une seule ligne, qui s'écrit et
           s'efface : « Nous arrivons bientôt à Alger », puis Oran, puis Sétif…
           les cinquante-huit wilayas les unes après les autres.

           Elle dit ce qu'aucune liste ne dirait aussi vite : Talabi ne s'arrête
           pas à une ville. Une ligne qui bouge à cet endroit tient la place
           haute de l'écran sans rien demander — pas de bouton, pas de choix,
           juste une promesse qui défile. */
        '<div class="h3d-bientot" id="h3dBientot">' +
          '<span class="ic">' + UI.icon('pin', 15) + '</span>' +
          '<span class="tx">Nous arrivons bientôt à ' +
            '<b id="hbVille"></b><i class="cur" aria-hidden="true"></i></span>' +
        '</div>' +

        /* ------------------------------------- LA COMMANDE EN COURS D'ABORD
           Quand une commande est en route, c'est LA question du moment : où en
           est-elle. Elle vivait dans l'onglet Commandes, à deux touches d'ici —
           on ouvrait l'accueil, on cherchait, on tapait deux fois. Elle passe
           donc devant tout le reste, et disparaît d'elle-même dès qu'il n'y a
           plus rien à suivre. Rien de nouveau n'est calculé : ce sont les
           commandes du client, déjà en base. */
        '<div id="hmSuivi"></div>' +

        /* ----------------------------------------------------- RECHERCHE
           LA RANGÉE DE CATÉGORIES (Tout, Pizza, Tacos, Burger…) ÉTAIT ICI. Elle
           est partie et la recherche prend sa place : six pastilles qui mènent
           toutes au même écran ne valent pas le tiers d'écran qu'elles
           occupaient, et le champ cherche déjà les mêmes mots — « pizza » tapé
           ici trouve les pizzerias ET les pizzas. Les catégories restent sur
           l'écran Restaurants, où elles filtrent une vraie liste.

           LA LOUPE EST LE BOUTON DE RECHERCHE, et le rond orange à droite mène
           aux réglages. C'est ce que montre la maquette, et le pictogramme le
           dit : des curseurs de réglage, pas une flèche.

           La loupe est donc un vrai <button> et non un décor : sans ça,
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

        /* ---- LES SUGGESTIONS, PENDANT QU'ON TAPE ----
           Elles cherchent pour de vrai, dans les restaurants ET les plats : les
           deux appels existent déjà et servent l'écran Restaurants. C'est ce que
           le brief appelle « suggestions intelligentes » — pas un devinement,
           une recherche qui répond avant qu'on ait fini.

           Ce que le brief demandait aussi et qui n'est pas là : la RECHERCHE
           VOCALE. Elle existe dans le navigateur (`webkitSpeechRecognition`)
           mais elle échoue en silence selon le moteur embarqué du téléphone, et
           je ne peux pas la vérifier sur un vrai appareil d'ici. Un micro qui ne
           répond pas est pire que pas de micro. */
        '<div class="h3d-sugg" id="sugg" hidden></div>' +

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

        /* ---- NOUVEAUX RESTAURANTS ----
           `restaurants.created_at` existe en base : « nouveau » veut donc dire
           quelque chose de vérifiable — inscrit il y a moins de trente jours —
           et non « celui qu'on veut mettre en avant ». La section disparaît
           entièrement s'il n'y en a aucun, plutôt que d'afficher un titre suivi
           du vide. */
        '<div id="nouveaux"></div>' +

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

        /* ---------------------------------------------------- C'EST QUOI TALABI */
        /* Les deux cartes « Vous avez un restaurant ? » et « Vous voulez
           livrer ? » étaient ici. Elles demandaient quelque chose à quelqu'un
           qui vient de chercher à manger : ce n'est pas le moment, et ce n'est
           pas sa question. Les deux chemins restent ouverts par le pied de page,
           où ils ont toujours été.

           À leur place, la réponse à la question que se pose vraiment quelqu'un
           qui découvre l'application. Elle est montrée à tout le monde, client
           connecté compris : savoir ce qu'on utilise ne dépend pas d'avoir un
           compte. */
        blocQuoi() +
      '</div>' +

      /* -------------------------------------------------------------- PIED */
      '<footer class="footer"><div class="wrap">' +
        '<div class="row-between" style="flex-wrap:wrap;gap:18px">' +
          '<div><img src="' + U.asset('assets/img/logo.jpg') + '" alt="' + U.esc(TALABI_CONFIG.APP_NAME) + '" ' +
            'width="1254" height="1254" decoding="async" ' +
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

    /* ---- « NOUS ARRIVONS BIENTÔT À … » ----------------------------------
       Les wilayas s'écrivent l'une après l'autre, à la façon d'une machine à
       écrire : une lettre à la fois, une pause le temps de lire, puis on efface
       et la suivante arrive. Cinquante-sept noms — la wilaya déjà couverte est
       retirée de la liste : annoncer qu'on arrive bientôt là où l'on est déjà
       ferait douter du reste.

       L'ORDRE EST TIRÉ AU HASARD à chaque ouverture. Dans l'ordre officiel, la
       ligne montrerait toujours Adrar, Chlef, Laghouat : trois wilayas de suite
       où presque personne ne regarde, et la promesse tomberait à plat. */
    const arretVilles = tickerVilles(view.querySelector('#h3dBientot'));

    /* ---- LES SUGGESTIONS ----
       Une vraie recherche, sur les deux appels qui servent déjà l'écran
       Restaurants : les enseignes ET les plats. Trois de chaque au plus — une
       liste qui recouvre l'écran fait fermer le clavier pour la lire.

       `U.debounce` à 280 ms : sans lui, taper « chawarma » lancerait huit
       requêtes dont sept déjà périmées à leur arrivée. Et un jeton croissant,
       parce qu'une réponse lente peut revenir APRÈS une plus récente et
       réafficher les résultats d'un mot qu'on a fini d'effacer. */
    const boiteSugg = view.querySelector('#sugg');
    let jeton = 0;

    function fermerSugg() {
      if (!boiteSugg) return;
      boiteSugg.hidden = true;
      boiteSugg.innerHTML = '';
    }

    const chercherSugg = U.debounce(async () => {
      if (!boiteSugg) return;
      const mot = (q && q.value || '').trim();
      if (mot.length < 2) return fermerSugg();
      const mien = ++jeton;

      const [restos, plats] = await Promise.all([
        API.safe(() => API.restaurants({ q: mot }), []),
        API.safe(() => API.searchDishes(mot, null), [])
      ]);
      if (mien !== jeton) return;              // une frappe plus récente a gagné

      const lignes =
        restos.slice(0, 3).map(r =>
          '<button type="button" class="sg" data-resto="' + U.esc(r.id) + '">' +
            '<span class="sg-ic">' + UI.icon('store', 17) + '</span>' +
            '<span class="sg-tx"><b>' + U.esc(r.name) + '</b>' +
              '<span>' + U.esc((r.zone && r.zone.name) || 'Restaurant') + '</span></span>' +
            '<span class="sg-fl">' + UI.icon('chevron', 16) + '</span></button>').join('') +
        plats.slice(0, 3).map(d =>
          '<button type="button" class="sg" data-resto="' + U.esc(d.restaurant.id) + '">' +
            '<span class="sg-ic plat">' + UI.icon('utensils', 17) + '</span>' +
            '<span class="sg-tx"><b>' + U.esc(d.name) + '</b>' +
              '<span>chez ' + U.esc(d.restaurant.name) + '</span></span>' +
            '<span class="sg-pr">' + U.esc(U.money(d.price)) + '</span></button>').join('');

      if (!lignes) {
        /* Dire qu'on n'a rien trouvé vaut mieux que refermer sans un mot :
           sinon on croit que la recherche n'a pas fonctionné. */
        boiteSugg.innerHTML = '<div class="sg-rien">Aucun résultat pour « ' +
          U.esc(mot) + ' »</div>';
      } else {
        boiteSugg.innerHTML = lignes;
      }
      boiteSugg.hidden = false;

      boiteSugg.querySelectorAll('[data-resto]').forEach(b => b.onclick = () => {
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
        Router.go('/resto/' + b.dataset.resto);
      });
    }, 280);

    const q = view.querySelector('#q');
    if (q) {
      q.addEventListener('input', chercherSugg);
      /* On referme en quittant le champ, mais APRÈS le clic : sans ce délai,
         la liste disparaît avant que la touche n'ait été enregistrée et rien
         ne s'ouvre. */
      q.addEventListener('blur', () => setTimeout(fermerSugg, 180));
    }

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
    /* Deux blocs attendent d'être vus, pour la même raison et par le même
       mécanisme : les trois cases de « Comment ça marche ? » et l'écriture de
       « C'est quoi Talabi ? ». Ce dernier est encore plus bas dans la page —
       lancer ses quatre secondes au chargement, c'est les jouer pour personne. */
    function auRegard(bloc, classe, seuil) {
      if (!bloc) return;
      const jouer = () => bloc.classList.add(classe);
      if (!w.IntersectionObserver) return jouer();
      const oeil = new IntersectionObserver(entrees => {
        entrees.forEach(e => {
          if (!e.isIntersecting) return;
          jouer();
          oeil.disconnect();
        });
      }, { threshold: seuil });
      oeil.observe(bloc);
    }

    auRegard(view.querySelector('#h3dSteps'), 'danse', .35);
    /* Seuil plus bas que pour les trois cases : ce bloc est plus haut qu'un
       écran de téléphone, il ne sera jamais visible à 35 %. Avec le même seuil,
       l'écriture n'aurait démarré qu'une fois le texte à moitié dépassé. */
    auRegard(view.querySelector('#talQuoi'), 'ecrit', .12);

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

      /* QUATRE CHIFFRES, TOUS COMPTÉS SUR LE CATALOGUE RÉEL.

         Le délai était écrit en dur — « 25 min » — donc faux le jour où les
         restaurants changent leur temps de préparation. Il est maintenant la
         moyenne de leurs temps annoncés, plus le trajet d'une course typique
         de 3 km calculé par la même fonction que partout ailleurs.

         La note moyenne est PONDÉRÉE par le nombre d'avis : sans cela, un
         restaurant noté 5 par une seule personne compterait autant qu'un
         autre noté 4,3 par cinquante. Et la tuile disparaît s'il n'y a aucun
         avis — « 0,0 / 5 » serait pire que rien.

         Le brief annonçait « 100+ restaurants », « 14 quartiers », « dès
         15 min » et « 4,9/5 ». Ces chiffres-là ne sont pas les nôtres : on
         affiche ceux de la base, quels qu'ils soient. Une vitrine qui gonfle
         ses chiffres se fait démentir par son propre catalogue, deux écrans
         plus loin. */
      const st = view.querySelector('#heroStats');
      if (st) {
        const prep = list.filter(r => +r.prep_time_min);
        const moyPrep = prep.length
          ? Math.round(prep.reduce((a, r) => a + (+r.prep_time_min), 0) / prep.length) : 0;
        const trajet = (U.deliveryFor(3, Store.settings).minutes || 0);

        st.innerHTML =
          chiffre(UI.icon('store', 20), list.length + (list.length > 1 ? '+' : ''), 'Restaurants') +
          chiffre(UI.icon('pin', 20), String(Store.zones.length), 'Quartiers couverts') +
          (moyPrep
            ? chiffre(UI.icon('clock', 20), (moyPrep + trajet) + ' min', 'Livraison moyenne') : '') +
          '';
      }
    })();

    /* ---- NOUVEAUX RESTAURANTS ----
       « Nouveau » veut dire inscrit il y a moins de trente jours, et rien
       d'autre : c'est vérifiable dans la base (`created_at`), donc personne ne
       peut être surpris de s'y trouver ou de ne pas s'y trouver. La section
       disparaît entièrement s'il n'y en a aucun — un titre suivi du vide est
       pire que pas de titre.

       Trois au maximum : au-delà, ce n'est plus une nouveauté, c'est le
       catalogue. */
    (async function nouveaux() {
      const boite = view.querySelector('#nouveaux');
      if (!boite) return;
      const list = await API.safe(() => API.restaurants({}), []);
      const seuil = Date.now() - 30 * 864e5;
      const neufs = list
        .filter(r => r.created_at && new Date(r.created_at).getTime() >= seuil)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 3);
      if (!neufs.length) { boite.innerHTML = ''; return; }

      boite.innerHTML =
        '<div class="section-head rc-head">' +
          '<span class="rc-head-ic">' + UI.icon('sparkle', 22) + '</span>' +
          '<div class="grow"><div class="h2">Nouveaux restaurants</div>' +
          '<div class="sub">Arrivés ce mois-ci</div></div>' +
        '</div>' +
        '<div id="nouveauxListe"></div>';
      Cmp.restoGrid(neufs, boite.querySelector('#nouveauxListe'));
    })();

    /* Le thème sombre s'éteint en quittant l'accueil : les autres écrans de
       l'application sont encore clairs, et les laisser en noir sur fond noir
       les rendrait illisibles. Et la ligne des villes s'arrête : une minuterie
       qui survivrait à la page continuerait de battre pour un élément détaché,
       à chaque passage sur l'accueil. */
    return () => { arretVilles(); UI.nuit(''); };
  });

  /* ======================================================================
     LES WILAYAS OÙ TALABI N'EST PAS ENCORE
     ----------------------------------------------------------------------
     Les cinquante-huit wilayas d'Algérie, dans l'ordre officiel des codes —
     c'est le seul ordre que personne ne peut contester, et il rend la liste
     vérifiable d'un coup d'œil. Elle est écrite ici et non en base : ce sont
     des noms de pays, ils ne changent pas avec le catalogue.
     ====================================================================== */
  const WILAYAS = [
    'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra',
    'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret',
    'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda',
    'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem',
    'M’Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi',
    'Bordj Bou Arréridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt',
    'El Oued', 'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla',
    'Naâma', 'Aïn Témouchent', 'Ghardaïa', 'Relizane', 'Timimoun',
    'Bordj Badji Mokhtar', 'Ouled Djellal', 'Béni Abbès', 'In Salah',
    'In Guezzam', 'Touggourt', 'Djanet', 'El M’Ghair', 'El Meniaa'
  ];

  /**
   * tickerVilles(bloc) — « Nous arrivons bientôt à … », un nom à la fois.
   *
   * Écrit le nom lettre par lettre, laisse le temps de le lire, l'efface, passe
   * au suivant. La cadence de frappe est irrégulière (46–90 ms) : une cadence
   * fixe s'entend comme une machine, une cadence irrégulière comme quelqu'un
   * qui tape.
   *
   * Rend la fonction qui arrête tout — à appeler au départ de la page.
   */
  function tickerVilles(bloc) {
    const rien = function () {};
    if (!bloc) return rien;
    const cible = bloc.querySelector('#hbVille');
    if (!cible) return rien;

    /* La wilaya déjà couverte n'a rien à faire dans une liste de villes à
       venir. La comparaison ignore accents, casse, espaces et apostrophes : la
       base peut écrire « TIZI-OUZOU » là où la liste écrit « Tizi Ouzou ».
       `NFD` sépare la lettre de son accent, et ne garder que a–z jette
       l'accent avec le reste — d'où « Béjaïa » et « bejaia » identiques. */
    const nu = s => String(s).normalize('NFD').toLowerCase().replace(/[^a-z]/g, '');
    const ici = nu(Store.wilayaName());
    const liste = WILAYAS.filter(v => nu(v) !== ici);

    /* Mélange de Fisher-Yates : chaque ouverture montre d'autres villes en
       premier. Sans lui, la ligne commencerait toujours par Adrar et Chlef. */
    for (let k = liste.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      const tmp = liste[k]; liste[k] = liste[r]; liste[r] = tmp;
    }
    if (!liste.length) return rien;

    /* Qui a demandé moins de mouvement lit un nom fixe : la phrase garde son
       sens, seule l'animation disparaît. */
    if (w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cible.textContent = liste[0];
      bloc.classList.add('fixe');
      return rien;
    }

    let i = 0, j = 0, efface = false, mort = false, t = null;
    const stop = () => { mort = true; clearTimeout(t); };

    const tic = () => {
      if (mort) return;
      // la vue a pu être remplacée entre deux battements
      if (!document.body.contains(cible)) return stop();
      // onglet caché : rien à écrire pour personne, on repasse plus tard
      if (document.hidden) { t = setTimeout(tic, 500); return; }

      const mot = liste[i % liste.length];
      if (!efface) {
        cible.textContent = mot.slice(0, ++j);
        if (j >= mot.length) { efface = true; t = setTimeout(tic, 1600); return; }
        t = setTimeout(tic, 46 + Math.random() * 44);
      } else {
        cible.textContent = mot.slice(0, --j);
        if (j <= 0) { efface = false; i++; t = setTimeout(tic, 320); return; }
        t = setTimeout(tic, 26);   // on efface plus vite qu'on n'écrit
      }
    };

    t = setTimeout(tic, 500);
    return stop;
  }

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

  /* ======================================================================
     « C'EST QUOI TALABI ? »
     ----------------------------------------------------------------------
     LE TEXTE EST ÉCRIT POUR ÊTRE VRAI, pas pour convaincre. Il dit ce que fait
     l'application, et il dit aussi ce qu'elle ne fait pas — nous ne couvrons
     pas l'Algérie, nous commençons par une ville. Un texte de présentation qui
     ne concède rien ne se croit pas ; celui-ci concède la seule chose que
     l'utilisateur peut vérifier lui-même en cherchant un restaurant.

     Aucun chiffre n'y figure. Ni nombre de restaurants, ni nombre de
     commandes, ni date de création : tout cela changerait sans que ce texte
     change, et un chiffre faux dans une présentation décrédibilise le reste.
     ====================================================================== */
  const QUOI = [
    'Talabi est née à Tizi Ouzou. L’idée tient en une phrase : commander un ' +
    'repas près de chez soi ne devrait demander ni dix appels téléphoniques, ' +
    'ni une carte bancaire.',

    'Trois personnes se rencontrent ici. Un restaurant qui cuisine. Un livreur ' +
    'qui roule dans votre quartier. Vous, qui avez faim. Talabi ne fait rien de ' +
    'plus que les mettre en relation — et vous montrer où en est votre ' +
    'commande, en direct, jusqu’à votre porte.',

    'Ce que nous ne vous dirons pas : que nous couvrons toute l’Algérie. Nous ' +
    'commençons par Tizi Ouzou, quartier par quartier, avec les restaurants qui ' +
    'acceptent de tenter le coup avec nous. Vous payez à la réception, en ' +
    'espèces : rien à avancer, rien à saisir.',

    'C’est jeune, c’est petit, et ça grandit avec ceux qui l’utilisent. Si ' +
    'quelque chose ne va pas, dites-le nous — c’est comme ça que la prochaine ' +
    'version sera meilleure.'
  ];

  /* Un mot par élément, avec son rang dans le style : c'est le rang que le CSS
     lit pour décaler l'arrivée de chaque mot. Sans découpage, on ne pourrait
     animer que des paragraphes entiers, et un paragraphe qui paraît d'un bloc
     n'a rien d'une écriture.

     Les éléments sont séparés par une VRAIE espace dans le HTML : elle porte la
     coupure de ligne et l'espacement entre les mots, ce qu'une marge n'aurait
     pas fait proprement en fin de ligne. */
  function motsAnimes(texte, rang) {
    return String(texte).split(' ').map((m, i) =>
      '<span class="tal-w" style="--i:' + (rang + i) + '">' + U.esc(m) + '</span>'
    ).join(' ');
  }

  const RESEAUX = [
    ['instagram', 'Instagram',
     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
       'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
       '<rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.4"/>' +
       '<circle cx="12" cy="12" r="4.1"/>' +
       '<circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none"/></svg>'],
    ['facebook', 'Facebook',
     '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
       '<path d="M13.6 21v-7.4h2.6l.4-3h-3V8.7c0-.87.24-1.46 1.5-1.46h1.6V4.55A21 21 0 0 0 14.87 4.4' +
         'c-2.3 0-3.87 1.4-3.87 3.98v2.22H8.4v3H11V21h2.6z"/></svg>'],
    ['youtube', 'YouTube',
     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
       'stroke-linejoin="round" aria-hidden="true">' +
       '<rect x="2.2" y="5.2" width="19.6" height="13.6" rx="4.2"/>' +
       '<path d="M10.4 9.5v5l4.3-2.5-4.3-2.5z" fill="currentColor" stroke="none"/></svg>']
  ];

  /* Un réseau sans adresse renseignée s'affiche éteint et n'est pas cliquable.
     C'est volontaire : un bouton absent laisse croire que le compte n'existe
     pas, un bouton qui mène à une page d'erreur fait douter du reste. Les
     adresses se collent dans config.js, section SOCIAL. */
  function reseaux() {
    const cfg = (TALABI_CONFIG && TALABI_CONFIG.SOCIAL) || {};
    return RESEAUX.map(r => {
      const url = cfg[r[0].toUpperCase()] || '';
      const dedans = r[2] + '<span>' + r[1] + '</span>';
      return url
        ? '<a class="tal-soc-b" href="' + U.escUrl(url) + '" target="_blank" rel="noopener" ' +
            'title="' + r[1] + '">' + dedans + '</a>'
        : '<span class="tal-soc-b off" role="link" aria-disabled="true" ' +
            'title="' + r[1] + ' — bientôt">' + dedans + '</span>';
    }).join('');
  }

  function blocQuoi() {
    /* Le compteur court d'un paragraphe au suivant, et saute de trois rangs
       entre deux : la respiration entre les paragraphes se lit comme une reprise
       de souffle, alors qu'un enchaînement sans écart donne un flux continu où
       les paragraphes ne se distinguent plus. */
    let rang = 0;
    const paras = QUOI.map(t => {
      const html = '<p class="tal-p">' + motsAnimes(t, rang) + '</p>';
      rang += t.split(' ').length + 3;
      return html;
    }).join('');

    /* `--n` est le nombre total de rangs : le CSS s'en sert pour faire arriver
       « Pour en savoir plus » et les trois boutons JUSTE APRÈS le dernier mot.
       Écrit ici plutôt que devine dans la feuille de style, parce que le texte
       peut changer et que le raccord ne doit pas être à recalculer à la main. */
    return '<section class="tal-quoi" id="talQuoi" style="--n:' + rang + '">' +
      '<span class="tal-lueur" aria-hidden="true"></span>' +
      '<div class="tal-tag">À propos</div>' +
      '<h2 class="tal-h"><span class="tal-hin">C’est quoi <i>Talabi</i> ?' +
        '<span class="tal-cur" aria-hidden="true"></span></span></h2>' +
      '<div class="tal-txt">' + paras + '</div>' +
      '<div class="tal-plus">Pour en savoir plus</div>' +
      '<div class="tal-soc">' + reseaux() + '</div>' +
      /* PLACE DU BOUTON « FONDATEUR » : il vient ici, après les réseaux, dans
         un `<div class="tal-fond">`. Le CSS de `.tal-soc-b` l'habillera déjà. */
    '</section>';
  }
})(window);
