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
    guest: [
      { p: '/',              i: 'home',     l: 'Accueil' },
      { p: '/restaurants',   i: 'burger',   l: 'Restaurants' },
      { p: '/cart',          i: 'cart',     l: 'Panier', badge: 'cart' },
      { p: '/login',         i: 'user',     l: 'Connexion' }
    ],
    /* Visiteur d'un espace professionnel (resto/, livreur/, admin/) :
       il n'y a rien à visiter tant qu'on n'est pas connecté. */
    invitePro: [
      { p: '/login',         i: 'user',     l: 'Connexion' },
      { p: '/signup',        i: 'plus',     l: 'Créer un compte' }
    ],
    restaurant: [
      { p: '/r',             i: 'chart',    l: 'Tableau' },
      { p: '/r/orders',      i: 'receipt',  l: 'Commandes' },
      { p: '/r/menu',        i: 'pizza',    l: 'Menu' },
      { p: '/r/profile',     i: 'store',    l: 'Restaurant' },
      { p: '/account',       i: 'user',     l: 'Compte' }
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
    renderSide() {
      const side = document.getElementById('sidenav');
      if (!side) return;
      const on = Store.isLogged && Store.role === 'restaurant';
      side.hidden = !on;
      document.body.classList.toggle('has-side', on);
      if (!on) { side.innerHTML = ''; return; }

      const rest = Store.profile && Store.profile.restaurant;
      side.innerHTML =
        '<a class="side-brand" href="#/r">' +
          (rest && rest.logo_url
            ? '<img src="' + U.escUrl(rest.logo_url) + '" alt="">'
            : '<img src="' + U.asset('assets/img/logo.jpg') + '" alt="">') +
        '</a>' +
        '<nav class="side-nav">' +
          NAV.restaurant.filter(x => x.p !== '/account').map(x =>
            '<a href="#' + x.p + '" class="' + (Shell.isActive(x.p) ? 'on' : '') + '">' +
              '<span class="ic">' + UI.icon(x.i, 20) + '</span>' +
              '<span>' + U.esc(x.l) + '</span></a>').join('') +
        '</nav>' +
        '<div class="side-foot">' +
          '<a href="#/account" class="' + (Shell.isActive('/account') ? 'on' : '') + '" title="Mon compte">' +
            '<span class="ic">' + UI.icon('user', 20) + '</span><span>Compte</span></a>' +
          '<button id="sideOut" title="Se déconnecter">' +
            '<span class="ic">' + UI.icon('logout', 20) + '</span>' +
            '<span>Quitter</span></button>' +
        '</div>';

      const out = side.querySelector('#sideOut');
      if (out) out.onclick = async () => {
        if (!(await UI.confirm('Se déconnecter ?', 'Vous devrez vous reconnecter pour gérer votre restaurant.',
              'Déconnexion', true))) return;
        await API.signOut();
        await Store.refreshProfile();
        UI.ok('À bientôt !');
        Router.go('/', true);
      };
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
        : '<img src="' + U.asset('assets/img/logo.jpg') + '" alt="' +
            U.esc(TALABI_CONFIG.APP_NAME) + '" class="brand-logo">';

      bar.innerHTML =
        '<div class="wrap topbar-in">' +
          /* Application client : pas de marque dans la barre. L'écran
             d'ouverture vient de l'afficher en grand, et une pastille seule
             au-dessus du quartier faisait une rangée pour un seul bouton.
             La maison de la barre du bas ramène à l'accueil. */
          (App.est('client') ? '' :
            '<a class="brand" href="#' + (Store.isLogged ? Router.homeFor(Store.role) : App.accueil) + '" ' +
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
              /* La sonnerie avait son interrupteur ici, à côté de la cloche des
                 notifications : deux pictogrammes voisins, l'un qui informe et
                 l'autre qui règle, qu'on confondait sans cesse. Le réglage a
                 rejoint les autres réglages ; cette place revient à un accès
                 direct aux paramètres. */
              ? '<a class="icon-btn" href="#/account" title="Paramètres">' + UI.icon('settings', 19) + '</a>' +
                '<button class="icon-btn" id="notifBtn" title="Notifications">' + UI.icon('bell', 19) +
                  (Store.unread ? '<span class="badge-dot">' + (Store.unread > 9 ? '9+' : Store.unread) + '</span>' : '') +
                '</button>' +
                '<a class="icon-btn" href="#/profil" title="Mes informations" style="overflow:hidden;padding:0">' +
                  UI.avatar(Store.profile.full_name, Store.profile.avatar_url, 38) + '</a>'
              : '<a class="btn btn-primary btn-sm" href="#/login">Connexion</a>') +
          '</div>' +
        '</div>';

      const zb = document.getElementById('zoneBtn');
      if (zb) zb.onclick = async function () {
        const avant = this.innerHTML;
        this.innerHTML = '<span class="spinner dark"></span> Localisation…';
        const nom = await Store.detectWilaya(true);
        if (nom) UI.ok('Vous êtes à ' + nom);
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
    renderNav() {
      const nav = document.getElementById('bottomnav');

      nav.innerHTML = Shell.navItems().map(x => {
        /* Deux marques, deux sens. Le panier compte des articles, donc un
           nombre. Les commandes n'ont rien à compter — « il y a du nouveau »
           se dit avec un point, et un point ne se lit pas, il se remarque. */
        let marque = '';
        if (x.badge === 'cart' && Store.cartCount)
          marque = '<span class="nav-badge">' + (Store.cartCount > 99 ? '99+' : Store.cartCount) + '</span>';
        else if (x.p === '/orders' && Store.unread)
          marque = '<span class="nav-dot"></span>';

        return '<a href="#' + x.p + '" class="' + (Shell.isActive(x.p) ? 'on' : '') + '" ' +
               'title="' + U.esc(x.l) + '">' +
               '<span class="ic">' +
                 '<span class="cap" aria-hidden="true"></span>' +
                 UI.icon(x.i, 23) + marque +
               '</span>' +
               '<span class="lb">' + U.esc(x.c || x.l) + '</span></a>';
      }).join('');

      /* --- onde au doigt, et petite vibration ---------------------------
         L'onde part du point touché, pas du centre de l'onglet : c'est ce
         qui la fait ressentir comme une réponse au geste plutôt que comme
         une animation qui se déclenche. Elle est purement décorative, donc
         retirée dès qu'elle a fini — un nœud de plus par appui, gardé, se
         compterait en centaines au bout d'une soirée. */
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
           qui ne l'expose pas au web — on ne le simule pas, une animation
           de remplacement serait pire que rien. */
        a.addEventListener('click', () => {
          if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
        });
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

    /* -------------------------------------------------------- notifications */
    async notifPanel() {
      const m = UI.sheet({
        title: 'Notifications',
        body: '<div id="nlist"><div class="skel" style="height:70px;margin-bottom:8px"></div>' +
              '<div class="skel" style="height:70px"></div></div>',
        footer: '<button class="btn btn-ghost btn-block" id="markAll">Tout marquer comme lu</button>'
      });

      const list = await API.safe(() => API.notifications(40), []);
      const box = m.el.querySelector('#nlist');

      if (!list.length) {
        box.innerHTML = UI.empty(UI.icon('bell', 34), 'Aucune notification', 'Vous serez prévenu ici à chaque étape de vos commandes.');
      } else {
        box.style.margin = '-18px';
        box.innerHTML = list.map(n =>
          '<div class="notif-item ' + (n.is_read ? '' : 'unread') + '" data-o="' + U.esc(n.order_id || '') +
            '" data-t="' + U.esc(n.type || '') + '">' +
            '<div class="notif-ic">' + iconFor(n.type) + '</div>' +
            '<div class="grow"><b style="font-size:14px">' + U.esc(n.title) + '</b>' +
            '<div class="tiny" style="margin-top:2px">' + U.esc(n.body || '') + '</div>' +
            '<div class="tiny" style="margin-top:4px;opacity:.7">' + U.ago(n.created_at) + '</div></div>' +
          '</div>').join('');

        box.querySelectorAll('[data-o]').forEach(el => el.onclick = () => {
          const id = el.dataset.o;
          m.close();
          if (id) Router.go(targetFor(id, el.dataset.t));
        });
      }

      m.el.querySelector('#markAll').onclick = async () => {
        await API.safe(() => API.markNotificationsRead());
        await Store.refreshUnread();
        Shell.renderTop();
        m.close();
        UI.ok('Notifications marquées comme lues');
      };

      // marquer lu à l'ouverture (après un court délai, comme les vraies apps)
      setTimeout(async () => {
        await API.safe(() => API.markNotificationsRead());
        await Store.refreshUnread();
        Shell.renderTop();
      }, 1500);
    }
  };

  /* Où mène une notification.
     Le rôle ne suffit pas : un livreur prévenu qu'une COURSE EST À PRENDRE
     était envoyé sur « Ma livraison », l'écran de la course qu'il a déjà
     acceptée — donc vide. Il recevait l'alerte et ne trouvait rien. C'est le
     type de la notification qui dit où aller, pas la fonction de celui qui la
     reçoit. */
  function targetFor(orderId, type) {
    if (Store.role === 'driver')
      return type === 'delivery_available' ? '/d/available' : '/d/active';
    if (Store.role === 'restaurant') return '/r/orders';
    if (Store.role === 'admin') return '/a/orders';
    return '/order/' + orderId;
  }

  function iconFor(type) {
    const m = {
      new_order: '🧾', accepted: '✅', preparing: '👨‍🍳', ready: '🛍️',
      delivery_available: UI.icon('pin', 17), driver_assigned: '🛵', delivering: '🚀',
      delivered: '🎉', rejected: '⛔', cancelled: '🚫',
      restaurant_status: '🏪', restaurant_pending: '🏪', driver_status: '🛵'
    };
    return m[type] || '🔔';
  }

  w.Shell = Shell;
})(window);
