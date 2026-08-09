/* ==========================================================================
   SHELL — barre supérieure, navigation, panneau de notifications
   ========================================================================== */
(function (w) {
  'use strict';

  /* `i` est un nom d'icône du jeu UI.ICONS, jamais du HTML : NAV est évalué au
     chargement du fichier, et appeler UI.icon ici créerait une dépendance à
     l'ordre des <script>. La résolution se fait au moment de l'affichage. */
  const NAV = {
    client: [
      { p: '/',              i: 'home',     l: 'Accueil' },
      { p: '/restaurants',   i: 'burger',   l: 'Restaurants' },
      { p: '/cart',          i: 'cart',     l: 'Panier', badge: 'cart' },
      { p: '/orders',        i: 'package',  l: 'Commandes' },
      { p: '/account',       i: 'user',     l: 'Compte' }
    ],
    /* CINQ RUBRIQUES POUR UN VISITEUR AUSSI, ET DANS LE MÊME ORDRE.
       Il n'en avait que quatre : « Commandes » n'apparaissait qu'après la
       connexion. La barre changeait donc de forme au moment où l'on se
       connecte — le panier passait de la 3e à la 3e place mais la 4e devenait
       la 5e, et le pouce ne retrouvait plus ses repères. Surtout, un visiteur
       n'avait aucun moyen de savoir que l'application suit les commandes : la
       rubrique qui le dit était cachée derrière l'inscription qu'elle sert à
       justifier.
       L'écran, lui, l'accueille sans compte et lui propose de se connecter —
       voir /orders dans js/views/tracking.js. */
    guest: [
      { p: '/',              i: 'home',     l: 'Accueil' },
      { p: '/restaurants',   i: 'burger',   l: 'Restaurants' },
      { p: '/cart',          i: 'cart',     l: 'Panier', badge: 'cart' },
      { p: '/orders',        i: 'package',  l: 'Commandes' },
      { p: '/login',         i: 'user',     l: 'Connexion' }
    ],
    /* Visiteur d'un espace professionnel (resto/, livreur/, admin/) :
       il n'y a rien à visiter tant qu'on n'est pas connecté. */
    invitePro: [
      { p: '/login',         i: 'user',     l: 'Connexion' },
      { p: '/signup',        i: 'plus',     l: 'Créer un compte' }
    ],
    /* Quatre rubriques, contre six auparavant. Ne restent que les écrans
       qu'un livreur ouvre pendant son service :
         • « Passé » ouvrait l'historique, qu'on atteint depuis les gains
           cumulés du tableau de bord ;
         • « Compte » doublonnait le bouton Paramètres de la barre du haut,
           qui mène au même écran.
       Deux rubriques de moins, c'est la moitié d'une case de largeur rendue
       à chacune des autres — sur un téléphone tenu à bout de bras, ça se
       voit. */
    driver: [
      { p: '/d',             i: 'chart',    l: 'Tableau' },
      { p: '/d/available',   i: 'pin',      l: 'Courses' },
      { p: '/d/active',      i: 'scooter',  l: 'En cours' },
      { p: '/d/credit',      i: 'wallet',   l: 'Crédit' }
    ],
    /* `c` : libellé court pour la barre du bas. Six rubriques sur 390 px font
       65 px chacune ; « Utilisateurs » et « Restaurants » s'y touchaient. */
    admin: [
      { p: '/a',             i: 'chart',    l: 'Tableau' },
      { p: '/a/restaurants', i: 'store',    l: 'Restaurants',  c: 'Restos' },
      { p: '/a/drivers',     i: 'scooter',  l: 'Livreurs' },
      { p: '/a/credits',     i: 'wallet',   l: 'Crédits' },
      { p: '/a/orders',      i: 'receipt',  l: 'Commandes' },
      { p: '/a/users',       i: 'users',    l: 'Utilisateurs', c: 'Comptes' },
      // Réglages manquait ici : la page n'était atteignable que par la barre
      // d'onglets répétée dans chaque page, qui doublonnait ce menu
      { p: '/a/settings',    i: 'settings', l: 'Réglages' }
    ]
  };

  /* L'arc orange du mot-marque. En SVG et non en image : net à n'importe
     quelle densité d'écran, et il prend la couleur qu'on lui donne. */
  const ARC =
    '<svg viewBox="0 0 132 26" aria-hidden="true">' +
      '<path d="M6 24C6 24 24 4 66 4s60 20 60 20" fill="none" ' +
        'stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg>';

  const Shell = {

    navItems() {
      /* Un visiteur non connecté dans un espace professionnel n'a qu'une chose
         à faire : se connecter. Lui proposer « Panier » et « Restaurants »
         l'enverrait vers des pages qui n'existent pas ici. */
      if (!Store.isLogged) return App.publique ? NAV.guest : NAV.invitePro;
      return NAV[Store.role] || NAV.client;
    },

    /* Le chemin d'un tableau de bord est le préfixe de tous les autres de son
       espace (/r contient /r/orders, /r/menu…). Sans le second test, Tableau
       restait allumé sur toutes les pages du restaurant, en même temps que
       l'onglet réellement ouvert. Un préfixe ne compte donc que si aucune
       autre entrée du menu ne correspond mieux. */
    isActive(p) {
      const cur = Router.path().split('?')[0];
      if (cur === p) return true;
      if (p === '/' || cur.indexOf(p + '/') !== 0) return false;
      return !Shell.navItems().some(x =>
        x.p.length > p.length && (cur === x.p || cur.indexOf(x.p + '/') === 0));
    },

    render() {
      Shell.renderTop();
      Shell.renderNav();
      Shell.renderSide();
    },

    /* ------------------------------------------------------- barre latérale
       Navigation verticale de l'espace restaurant, sur grand écran seulement.
       Sur mobile la barre du bas reste la seule navigation : une colonne fixe
       mangerait la moitié de l'écran. */
    /* La barre latérale était la navigation du gérant sur grand écran. Sans
       espace restaurant, elle n'a plus personne à servir : on la vide et on
       la cache, plutôt que de garder un menu qui pointe vers des pages
       supprimées. */
    renderSide() {
      const side = document.getElementById('sidenav');
      if (!side) return;
      side.hidden = true;
      side.innerHTML = '';
      document.body.classList.remove('has-side');
    },

    /* ------------------------------------------------------------ topbar */
    renderTop() {
      const bar = document.getElementById('topbar');
      const items = Shell.navItems();
      // le quartier ne sert qu'à filtrer un catalogue : il n'existe que dans
      // l'application client
      const showZone = App.est('client') && (!Store.isLogged || Store.role === 'client');
      // la console d'administration est sombre, jusqu'à la barre du haut
      const admin = Store.isLogged && Store.role === 'admin';
      document.body.classList.toggle('role-admin', admin);
      /* L'espace livreur est bleu de bout en bout — barre du haut, barre du
         bas, boutons. Sans cette classe sur <body>, seul l'intérieur des
         pages (.driver-page) changeait de couleur et les deux barres
         restaient orange : l'application avait l'air d'être à moitié
         repeinte. */
      document.body.classList.toggle('role-driver',
        Store.isLogged && Store.role === 'driver');

      /* Dans l'application client, la barre se déplie sur deux rangées au
         téléphone : la marque seule d'abord, puis le quartier et les boutons.
         Sur une seule rangée, « Mon quartier » et trois pastilles se
         disputaient 390 px et le nom du quartier finissait tronqué. */
      const marque = App.est('client')
        ? '<span class="brand-mark3d" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" ' +
              'stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M5 8h14l-1.1 11.1a2 2 0 0 1-2 1.8H8.1a2 2 0 0 1-2-1.8z"/>' +
              '<path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>' +
              '<path d="M10 12v4M14 12v4"/>' +
            '</svg></span>'
        /* `width` et `height` portent les dimensions RÉELLES du fichier
           (1254 × 1254), pas la taille affichée — c'est le CSS qui décide de
           celle-ci. Elles servent au navigateur à réserver le bon rectangle
           avant l'arrivée de l'image : sans elles, la page saute quand elle
           atterrit, et c'est le défaut qui trahit le plus sûrement une
           application bâclée. */
        : '<img src="' + U.asset('assets/img/logo.jpg') + '" alt="' +
            U.esc(TALABI_CONFIG.APP_NAME) + '" class="brand-logo" ' +
            'width="1254" height="1254" decoding="async">';

      bar.innerHTML =
        '<div class="wrap topbar-in">' +
          /* Application client : le mot-marque, en TEXTE et en SVG.
             Il est masqué par défaut (voir `.brand-nuit` dans le CSS) et ne
             s'affiche que sur l'accueil sombre, comme sur la maquette. Les
             autres écrans de l'application cliente gardent leur barre nue :
             l'écran d'ouverture vient d'afficher la marque en grand, et une
             pastille seule au-dessus du quartier faisait une rangée pour un
             seul bouton.

             En texte, et pas `assets/img/logo.jpg` : ce fichier est un JPEG
             sur fond blanc, il aurait posé un rectangle blanc au milieu du
             noir. Et un mot-marque en texte reste net à toute densité. */
          (App.est('client')
            ? '<a class="brand-nuit" href="#/" title="' + U.esc(TALABI_CONFIG.APP_NAME) + '">' +
                '<span class="arc">' + ARC + '</span>' +
                '<span class="mot">tala<i>bi</i></span></a>'
            : '<a class="brand" href="#' + (Store.isLogged ? Router.homeFor(Store.role) : App.accueil) + '" ' +
                'title="' + U.esc(TALABI_CONFIG.APP_NAME) + '">' + marque + '</a>') +

          /* Plus de liste de quartiers à dérouler : la barre annonce la wilaya
             où l'on se trouve, que le téléphone connaît déjà. Un appui la
             redemande, pour qui se déplace ou a refusé la première fois. */
          (showZone ?
            '<button class="zone-pick" id="zoneBtn" title="Actualiser ma position">' +
              UI.pin(15) + ' <span>' + U.esc(Store.wilayaName()) + '</span></button>' : '') +

          /* Un bouton « Mes commandes » occupait le bout de la première
             rangée. Il doublonnait l'onglet du même nom dans la barre du
             bas, à deux centimètres du pouce. */

          '<nav class="deskmenu">' +
            items.filter(x => x.p !== '/account' && x.p !== '/login')
                 .map(x => '<a href="#' + x.p + '" class="' + (Shell.isActive(x.p) ? 'on' : '') + '">' +
                   // l'admin gère six rubriques : sans pictogramme, le menu
                   // devient une rangée de mots difficile à balayer
                   (admin ? UI.icon(x.i, 17) + ' ' : '') + x.l + '</a>').join('') +
          '</nav>' +

          '<div class="top-actions">' +
            (Store.isLogged
              /* LA CLOCHE SEULE DANS L'APPLICATION CLIENTE (maquette « new
                 theme accueil »). Les deux autres boutons qui étaient ici —
                 les réglages et l'avatar — doublonnaient l'onglet Compte de la
                 barre du bas, à deux centimètres du pouce. Trois pastilles
                 volaient aussi la place du mot-marque, que la maquette veut au
                 centre. Les réglages sont désormais au bout du champ de
                 recherche, et « Mes informations » sous Compte → Mon compte.
                 Les espaces professionnels gardent les trois : ils n'ont pas
                 d'onglet Compte dans leur barre du bas. */
              ? (App.est('client') ? '' :
                  '<a class="icon-btn" href="#/account" title="Paramètres">' + UI.icon('settings', 19) + '</a>') +
                '<button class="icon-btn" id="notifBtn" title="Notifications">' + UI.icon('bell', 19) +
                  (Store.unread ? '<span class="badge-dot">' + (Store.unread > 9 ? '9+' : Store.unread) + '</span>' : '') +
                '</button>' +
                (App.est('client') ? '' :
                  '<a class="icon-btn" href="#/profil" title="Mes informations" style="overflow:hidden;padding:0">' +
                    UI.avatar(Store.profile.full_name, Store.profile.avatar_url, 38) + '</a>')
              : '<a class="btn btn-primary btn-sm" href="#/login">Connexion</a>') +
          '</div>' +
        '</div>';

      const zb = document.getElementById('zoneBtn');
      if (zb) zb.onclick = async function () {
        const avant = this.innerHTML;
        this.innerHTML = '<span class="spinner dark"></span> Localisation…';
        const nom = await Store.detectWilaya(true);
        if (nom) UI.place(nom);
        else {
          this.innerHTML = avant;
          UI.err('Position introuvable',
                 'Autorisez la localisation pour que Talabi trouve votre wilaya.');
        }
        Shell.renderTop();
      };
      const nb = document.getElementById('notifBtn');
      if (nb) nb.onclick = Shell.notifPanel;
    },

    /* --------------------------------------------------------- bottom nav */
    /* ------------------------------------------------------- barre du bas
       CE QUI SUIT EST ÉCRIT UNE FOIS, PUIS PLUS JAMAIS RECONSTRUIT.

       L'ancienne version réécrivait `nav.innerHTML` à chaque appel — et
       elle est appelée depuis sept endroits, dont chaque évènement du
       serveur et chaque changement de panier. Conséquence, invisible mais
       constante : on appuyait sur un onglet, un rafraîchissement passait
       entre l'appui et le relâchement, et le lien qu'on tenait n'existait
       plus. Le clic partait dans le vide. C'est ce qu'on ressentait comme
       « le bouton a du retard » ou « ça ouvre la mauvaise page ».

       Les liens sont donc créés une seule fois, à la première ouverture et
       à chaque changement de rôle. Ensuite on ne touche plus qu'à ce qui
       change vraiment : l'onglet actif, le compteur du panier, le point des
       commandes. Aucun nœud n'est détruit sous le doigt.
       -------------------------------------------------------------------- */
    renderNav() {
      const nav = document.getElementById('bottomnav');
      if (!nav) return;
      const items = Shell.navItems();

      /* La signature ne change que si les rubriques elles-mêmes changent —
         c'est-à-dire à la connexion, à la déconnexion, au changement de
         rôle. Pas à chaque commande qui arrive. */
      const signature = items.map(x => x.p).join('|');
      if (nav.dataset.signature === signature) return Shell.majNav(items);

      /* `data-p` : le chemin de l'onglet, porté par le lien lui-même. C'est ce
         qui permet au CSS de désigner UN onglet précis — le panier, que la
         maquette veut en pastille orange saillante — sans compter les positions
         à la main. `:nth-child(3)` aurait marché aujourd'hui et cassé au
         premier onglet ajouté ou retiré. */
      nav.innerHTML = items.map(x =>
        '<a href="#' + x.p + '" data-p="' + U.esc(x.p) + '" title="' + U.esc(x.l) + '">' +
          '<span class="ic">' +
            '<span class="cap" aria-hidden="true"></span>' +
            UI.icon(x.i, 23) +
            '<span class="marque"></span>' +
          '</span>' +
          '<span class="lb">' + U.esc(x.c || x.l) + '</span></a>').join('');
      nav.dataset.signature = signature;

      /* --- onde au doigt, et petite vibration ---------------------------
         L'onde part du point touché, pas du centre de l'onglet : c'est ce
         qui la fait ressentir comme une réponse au geste plutôt que comme
         une animation qui se déclenche. Elle est purement décorative, donc
         retirée dès qu'elle a fini. */
      nav.querySelectorAll('a').forEach(a => {
        a.addEventListener('pointerdown', e => {
          if (w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
          const r = a.getBoundingClientRect();
          const onde = document.createElement('span');
          onde.className = 'nav-onde';
          onde.style.left = (e.clientX - r.left) + 'px';
          onde.style.top  = (e.clientY - r.top) + 'px';
          a.appendChild(onde);
          setTimeout(() => onde.remove(), 520);
        }, { passive: true });

        /* Retour haptique : 8 ms, le minimum perceptible. Ignoré par iOS,
           qui ne l'expose pas au web — on ne le simule pas. */
        a.addEventListener('click', () => {
          if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
        });
      });

      Shell.majNav(items);
    },

    /** Met à jour ce qui change, sans rien recréer. */
    majNav(items) {
      const nav = document.getElementById('bottomnav');
      if (!nav) return;
      (items || Shell.navItems()).forEach((x, i) => {
        const a = nav.children[i];
        if (!a) return;
        a.classList.toggle('on', Shell.isActive(x.p));

        /* Deux marques, deux sens. Le panier compte des articles, donc un
           nombre. Les commandes n'ont rien à compter — « il y a du nouveau »
           se dit avec un point, et un point ne se lit pas, il se remarque. */
        const m = a.querySelector('.marque');
        if (!m) return;
        let cls = '', txt = '';
        if (x.badge === 'cart' && Store.cartCount) {
          cls = 'nav-badge';
          txt = Store.cartCount > 99 ? '99+' : String(Store.cartCount);
        } else if (x.p === '/orders' && Store.unread) {
          cls = 'nav-dot';
        }
        /* On n'écrit que si ça a changé : réécrire une pastille identique
           relancerait son animation d'apparition à chaque rafraîchissement,
           soit un clignotement toutes les quelques secondes. */
        if (m.dataset.etat === cls + ':' + txt) return;
        m.dataset.etat = cls + ':' + txt;
        m.className = 'marque ' + cls;
        m.textContent = txt;
      });
    },

    /* -------------------------------------------------------- sélecteur zone */
    zonePicker() {
      /* Une ligne par quartier : bouton radio à gauche, pastille, nom, chevron.
         Le choix courant se voit d'un coup d'œil, pas au détour d'une coche. */
      function ligne(id, nom, sous, icone) {
        const on = (Store.zoneId || '') === id;
        return '<button class="zone-row' + (on ? ' on' : '') + '" data-z="' + U.esc(id) + '">' +
          '<span class="radio"></span>' +
          '<span class="ic">' + icone + '</span>' +
          '<span class="grow"><b>' + U.esc(nom) + '</b>' +
            (sous ? '<span class="tiny">' + U.esc(sous) + '</span>' : '') + '</span>' +
          '<span class="mark">' + (on ? '✓' : '›') + '</span>' +
        '</button>';
      }

      UI.sheet({
        title: 'Mon quartier de livraison',
        icon: UI.icon('pin', 21),
        subtitle: 'Sélectionnez votre zone de livraison',
        body:
          '<div class="zone-list">' +
            ligne('', 'Toute la ville', 'Livraison disponible partout', '🏙️') +
            Store.zones.map(z => ligne(z.id, z.name, '', UI.icon('pin', 18))).join('') +
          '</div>' +
          '<div class="zone-foot">' +
            '<span class="art">🛵</span>' +
            '<span class="grow"><b>Livraison rapide et fiable</b>' +
              '<span class="tiny">Vos plats préférés livrés chez vous en un rien de temps !</span></span>' +
            '<span class="chip-round">⏱️</span>' +
          '</div>',
        onMount(el, api) {
          el.querySelectorAll('[data-z]').forEach(b => b.onclick = () => {
            Store.setZone(b.dataset.z || null);
            api.close();
            Shell.renderTop();
            Router.render();
          });
        }
      });
    },

    /* -------------------------------------------------------- notifications
       ------------------------------------------------------------------------
       CE QUE LE BRIEF DEMANDAIT ET QUI N'EXISTE PAS DANS TALABI :

       - Filtres « Promotions », « Favoris », « Récompenses » : il n'y a ni
         promotions, ni favoris, ni programme de fidélité. Aucun avis de ces
         types n'est jamais écrit en base — les quatorze types existants
         concernent tous les commandes, la livraison ou le compte. Un filtre qui
         ne peut rien montrer se touche une fois, puis plus jamais, et fait
         douter des autres.
       - « Paramètres des notifications » : aucun réglage n'existe. Ni par type,
         ni par canal.
       - Statistiques « Promotions : 4 » et « Récompenses : 2 » : mêmes absents.
         Les trois tuiles comptent donc ce qui est réellement là.
       - « Appui long : plus d'options » : ses seules options seraient ouvrir,
         marquer comme lu et supprimer — que la touche et les deux glissements
         font déjà. Un menu qui répète trois gestes ajoute une étape.

       CE QUI EXISTE ET QUE PERSONNE N'UTILISAIT : la politique `notif_delete`
       autorise depuis toujours chacun à supprimer ses propres avis. Il ne
       manquait que l'appel. « Tout supprimer » et le glissement vers la gauche
       marchent donc pour de vrai, sans migration.

       UN CHANGEMENT DE COMPORTEMENT, ASSUMÉ. Le panneau marquait tout comme lu
       AUTOMATIQUEMENT 1,5 seconde après son ouverture. Cela rendait décoratifs
       à la fois l'état « non lu » et le bouton qui l'efface : la pastille
       s'éteignait parce qu'on avait laissé le panneau ouvert, pas parce qu'on
       avait vu quelque chose. Le marquage est désormais explicite — par le
       bouton, ou par un glissement sur une ligne. « Non lu » veut dire « je n'ai
       pas encore regardé », ce qui est le seul sens utile.
       ------------------------------------------------------------------------ */

    async notifPanel() {
      let filtre = 'tout';
      let liste = [];

      const m = UI.sheet({
        /* En-tête à part : le titre, le sous-titre, le badge et les actions
           demandent plus de place que n'en offre l'en-tête standard. Le bouton
           de fermeture porte `data-x`, ce qui suffit à UI.sheet pour le brancher
           — la mécanique du panneau, de l'historique et du retour du téléphone
           reste exactement celle de toutes les autres feuilles. */
        title: false,
        body: '<div class="nt"><div id="ntCorps"></div></div>'
      });

      const corps = m.el.querySelector('#ntCorps');

      function tete(nonLues, stats) {
        return '<header class="nt-tete">' +
          '<span class="nt-ic" aria-hidden="true">' + UI.icon('bell', 21) + '</span>' +
          '<div class="nt-tete-txt">' +
            '<h2>Notifications' +
              (nonLues ? '<span class="nt-badge">' + (nonLues > 99 ? '99+' : nonLues) + '</span>' : '') +
            '</h2>' +
            '<p>Restez informé de vos commandes et activités</p>' +
          '</div>' +
          '<button type="button" class="nt-x" data-x aria-label="Fermer">' +
            '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" ' +
              'stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
        '</header>' +

        /* Trois chiffres, tous comptés sur la liste chargée. Aucun n'est une
           estimation, et aucun ne mesure ce qui n'existe pas. */
        '<div class="nt-stats">' +
          '<div class="nt-stat"><span class="k">' + UI.icon('package', 17) + ' Commandes</span>' +
            '<b>' + stats.commandes + '</b></div>' +
          '<div class="nt-stat"><span class="k">' + UI.icon('navigation', 17) + ' Livraison</span>' +
            '<b>' + stats.livraison + '</b></div>' +
          '<div class="nt-stat"><span class="k">' + UI.icon('bell', 17) + ' Non lues</span>' +
            '<b>' + stats.nonLues + '</b></div>' +
        '</div>';
      }

      function actions(nonLues, total) {
        return '<div class="nt-actions">' +
          '<button type="button" class="nt-act" id="ntTout"' + (nonLues ? '' : ' disabled') + '>' +
            UI.icon('check', 16) + ' Tout marquer comme lu</button>' +
          '<button type="button" class="nt-act rouge" id="ntVider"' + (total ? '' : ' disabled') + '>' +
            UI.icon('trash', 16) + ' Tout supprimer</button>' +
        '</div>';
      }

      function filtres(compte) {
        return '<div class="nt-filtres" id="ntFiltres">' +
          NT_FILTRES.map(f => {
            const n = f[0] === 'tout' ? liste.length : compte[f[0]] || 0;
            return '<button type="button" class="nt-f' + (filtre === f[0] ? ' on' : '') + '" ' +
              'data-f="' + f[0] + '" aria-pressed="' + (filtre === f[0] ? 'true' : 'false') + '">' +
              UI.icon(f[2], 16) + ' ' + f[1] +
              '<span class="nt-f-n">' + n + '</span></button>';
          }).join('') +
        '</div>';
      }

      /* Une ligne. Le glissement demande trois couches : les deux actions
         posées au fond, la carte par-dessus, et un conteneur qui découpe. Sans
         le découpage, les deux actions dépasseraient de chaque côté au repos. */
      function ligne(n) {
        const a = avisDe(n.type);
        return '<div class="nt-glis" data-id="' + U.esc(n.id) + '">' +
          '<span class="nt-fond gauche" aria-hidden="true">' + UI.icon('check', 19) + ' Lu</span>' +
          '<span class="nt-fond droite" aria-hidden="true">' + UI.icon('trash', 19) + ' Supprimer</span>' +
          '<button type="button" class="nt-c' + (n.is_read ? '' : ' neuf') + '" ' +
            'data-o="' + U.esc(n.order_id || '') + '" data-t="' + U.esc(n.type || '') + '">' +
            '<span class="nt-c-ic t-' + a[1] + '">' + UI.icon(a[0], 21) + '</span>' +
            '<span class="nt-c-txt">' +
              '<span class="nt-c-h">' + U.esc(n.title) + '</span>' +
              (n.body ? '<span class="nt-c-b">' + U.esc(n.body) + '</span>' : '') +
              '<span class="nt-c-t">' + U.esc(U.ago(n.created_at)) + '</span>' +
            '</span>' +
            (n.is_read ? '' : '<span class="nt-point" aria-label="Non lu"></span>') +
            (n.order_id ? '<span class="nt-c-fl">' + UI.icon('chevron', 17) + '</span>' : '') +
          '</button>' +
        '</div>';
      }

      function vide(filtré) {
        return '<div class="nt-vide">' +
          '<div class="nt-scene" aria-hidden="true">' +
            '<span class="nt-scene-ombre"></span>' +
            '<span class="nt-scene-cloche">' + UI.icon('bell', 46) + '</span>' +
            '<span class="nt-bulle a">' + UI.icon('package', 20) + '</span>' +
            '<span class="nt-bulle b">' + UI.icon('sparkle', 18) + '</span>' +
          '</div>' +
          '<div class="nt-vide-t">' +
            (filtré ? 'Rien dans cette catégorie' : 'Aucune notification') + '</div>' +
          '<p class="nt-vide-s">' +
            (filtré ? 'Changez de filtre pour voir le reste.'
                    : 'Les nouvelles activités apparaîtront ici.') + '</p>' +
          (filtré ? '' : '<button type="button" class="nt-go" id="ntExplorer">' +
            UI.icon('utensils', 19) + ' Explorer Talabi</button>') +
        '</div>';
      }

      function peindre() {
        const compte = {};
        liste.forEach(n => { const f = ntFamille(n.type); compte[f] = (compte[f] || 0) + 1; });
        const nonLues = liste.filter(n => !n.is_read).length;
        const stats = {
          commandes: compte.commandes || 0,
          livraison: compte.livraison || 0,
          nonLues: nonLues
        };

        const vues = filtre === 'tout' ? liste : liste.filter(n => ntFamille(n.type) === filtre);

        let html = tete(nonLues, stats) + actions(nonLues, liste.length) + filtres(compte);

        if (!vues.length) {
          html += vide(filtre !== 'tout');
        } else {
          let groupe = '';
          html += '<div class="nt-liste">' + vues.map(n => {
            const g = ntGroupe(n.created_at);
            let entete = '';
            if (g !== groupe) { groupe = g; entete = '<div class="nt-jour">' + U.esc(g) + '</div>'; }
            return entete + ligne(n);
          }).join('') + '</div>';
        }

        corps.innerHTML = html;
        brancher();
      }

      /* ---- les gestes ----
         Un glissement et une touche partent du même appui : on ne décide qu'au
         mouvement. En deçà de 10 px on ne bouge rien, et un déplacement plus
         vertical qu'horizontal laisse la liste défiler — sinon le panneau se
         bloquerait dès qu'on tente de le parcourir. */
      function glissement(boite) {
        const carte = boite.querySelector('.nt-c');
        if (!carte) return;
        let x0 = 0, y0 = 0, dx = 0, actif = false, decide = false;

        carte.addEventListener('pointerdown', e => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          x0 = e.clientX; y0 = e.clientY; dx = 0; actif = true; decide = false;
          carte.style.transition = 'none';
        });

        carte.addEventListener('pointermove', e => {
          if (!actif) return;
          const ax = e.clientX - x0, ay = e.clientY - y0;
          if (!decide) {
            if (Math.abs(ax) < 10 && Math.abs(ay) < 10) return;
            /* La direction est fixée une fois pour toutes au premier
               dépassement : un doigt qui part de travers ne doit pas faire
               hésiter la ligne entre glisser et défiler. */
            decide = true;
            if (Math.abs(ay) > Math.abs(ax)) { actif = false; return; }
            try { carte.setPointerCapture(e.pointerId); } catch (err) {}
          }
          dx = Math.max(-140, Math.min(140, ax));
          carte.style.transform = 'translateX(' + dx + 'px)';
          boite.classList.toggle('vers-droite', dx > 0);
          boite.classList.toggle('vers-gauche', dx < 0);
        });

        const relacher = async () => {
          if (!actif) { remettre(); return; }
          actif = false;
          const id = boite.dataset.id;
          const seuil = 78;
          if (dx >= seuil)  { remettre(); await marquerUne(id); return; }
          if (dx <= -seuil) { await supprimerUne(id, boite); return; }
          remettre();
        };
        const remettre = () => {
          carte.style.transition = 'transform .22s cubic-bezier(.3,.8,.3,1)';
          carte.style.transform = '';
          boite.classList.remove('vers-droite', 'vers-gauche');
        };
        carte.addEventListener('pointerup', relacher);
        carte.addEventListener('pointercancel', () => { actif = false; remettre(); });

        /* Un glissement ne doit pas ouvrir la commande : on n'ouvre que si le
           doigt n'a pratiquement pas bougé. */
        carte.addEventListener('click', () => {
          if (Math.abs(dx) > 6) return;
          const id = carte.dataset.o, t = carte.dataset.t;
          if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
          m.close(id ? () => Router.go(targetFor(id, t)) : null);
        });
      }

      async function marquerUne(id) {
        const n = liste.find(x => String(x.id) === String(id));
        if (!n || n.is_read) return;
        n.is_read = true;                       // l'affichage suit tout de suite
        peindre();
        await API.safe(() => API.markNotificationsRead([id]));
        await Store.refreshUnread();
        Shell.renderTop();
      }

      async function supprimerUne(id, boite) {
        boite.classList.add('part');
        /* On attend la fin de l'animation avant de retirer la ligne : sans ce
           délai, elle disparaît d'un coup et on ne voit pas ce qui s'est passé. */
        await new Promise(r => setTimeout(r, 200));
        liste = liste.filter(x => String(x.id) !== String(id));
        peindre();
        try { await API.deleteNotifications([id]); }
        catch (e) { UI.err('Suppression impossible', e.message); charger(); }
        await Store.refreshUnread();
        Shell.renderTop();
      }

      function brancher() {
        corps.querySelectorAll('.nt-glis').forEach(glissement);

        corps.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
          if (b.dataset.f === filtre) return;
          filtre = b.dataset.f;
          peindre();
        });

        const tout = corps.querySelector('#ntTout');
        if (tout) tout.onclick = async () => {
          tout.disabled = true;
          liste.forEach(n => { n.is_read = true; });
          peindre();
          await API.safe(() => API.markNotificationsRead());
          await Store.refreshUnread();
          Shell.renderTop();
          UI.ok('Notifications marquées comme lues');
        };

        const vider = corps.querySelector('#ntVider');
        if (vider) vider.onclick = async () => {
          /* Une suppression totale se confirme : c'est le seul geste de ce
             panneau qu'on ne peut pas défaire. */
          if (!(await UI.confirm('Tout supprimer ?',
                'Vos ' + liste.length + ' notification' + (liste.length > 1 ? 's' : '') +
                ' seront effacées. Vos commandes, elles, ne changent pas.',
                'Tout supprimer', true))) return;
          const avant = liste.slice();
          liste = [];
          peindre();
          try { await API.deleteNotifications(); UI.ok('Notifications supprimées'); }
          catch (e) { liste = avant; peindre(); UI.err('Suppression impossible', e.message); }
          await Store.refreshUnread();
          Shell.renderTop();
        };

        const exp = corps.querySelector('#ntExplorer');
        if (exp) exp.onclick = () => m.close(() => Router.go('/restaurants'));
      }

      async function charger() {
        liste = await API.safe(() => API.notifications(40), []);
        peindre();
      }

      corps.innerHTML = '<div class="nt-chargement">' +
        '<div class="skel nt-skel"></div><div class="skel nt-skel"></div>' +
        '<div class="skel nt-skel"></div></div>';
      await charger();
    }
  };

  /* Les cinq groupes de dates. `U.dayLabel` en donne d'autres — le nom du jour
     de la semaine, puis la date — ce qui convient à une commande mais fait une
     vingtaine de sections sur un historique d'avis. Un regroupement plus large
     est écrit ici, pour cet écran seulement. */
  function ntGroupe(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Plus ancien';
    const jour = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const ecart = Math.round((jour(new Date()) - jour(d)) / 86400000);
    if (ecart <= 0) return 'Aujourd’hui';
    if (ecart === 1) return 'Hier';
    if (ecart < 7) return 'Cette semaine';
    if (ecart < 31) return 'Ce mois-ci';
    return 'Plus ancien';
  }

  /* Les familles servent aux filtres ET aux statistiques : une seule table de
     correspondance, sinon un avis compterait dans « Commandes » et se
     retrouverait sous le filtre « Livraison ». */
  const NT_FAMILLE = {
    new_order: 'commandes', accepted: 'commandes', preparing: 'commandes',
    ready: 'commandes', rejected: 'commandes', cancelled: 'commandes',
    delivered: 'commandes',
    delivery_available: 'livraison', driver_assigned: 'livraison',
    delivering: 'livraison', no_driver: 'livraison',
    restaurant_status: 'compte', restaurant_pending: 'compte',
    driver_status: 'compte'
  };
  function ntFamille(t) { return NT_FAMILLE[t] || 'compte'; }

  const NT_FILTRES = [
    ['tout',      'Toutes',    'inbox'],
    ['commandes', 'Commandes', 'package'],
    ['livraison', 'Livraison', 'navigation'],
    ['compte',    'Compte',    'user']
  ];


  /* Où mène une notification.
     Le rôle ne suffit pas : un livreur prévenu qu'une COURSE EST À PRENDRE
     était envoyé sur « Ma livraison », l'écran de la course qu'il a déjà
     acceptée — donc vide. Il recevait l'alerte et ne trouvait rien. C'est le
     type de la notification qui dit où aller, pas la fonction de celui qui la
     reçoit. */
  function targetFor(orderId, type) {
    if (Store.role === 'driver')
      return type === 'delivery_available' ? '/d/available' : '/d/active';
    if (Store.role === 'admin') return '/a/orders';
    return '/order/' + orderId;
  }

  /* Chaque type d'avis a un dessin ET une teinte. La teinte porte le sens
     avant même la lecture : vert, ça a avancé ; orange, ça bouge maintenant ;
     rouge, c'est arrêté. On reconnaît une notification de loin, sans lire. */
  const AVIS = {
    new_order:           ['receipt',      'or'],
    accepted:            ['check-circle', 'vert'],
    preparing:           ['chef',         'bleu'],
    ready:               ['bag',          'or'],
    delivery_available:  ['pin',          'or'],
    driver_assigned:     ['scooter',      'bleu'],
    delivering:          ['navigation',   'or'],
    delivered:           ['sparkle',      'vert'],
    rejected:            ['ban',          'rouge'],
    cancelled:           ['ban',          'rouge'],
    restaurant_status:   ['store',        'bleu'],
    restaurant_pending:  ['store',        'bleu'],
    driver_status:       ['scooter',      'bleu'],
    no_driver:           ['clock',        'rouge']
  };

  function avisDe(type) { return AVIS[type] || ['bell', 'gris']; }

  function iconFor(type) {
    const a = avisDe(type);
    return '<span class="notif-ic t-' + a[1] + '">' + UI.icon(a[0], 20) + '</span>';
  }

  w.Shell = Shell;
})(window);
