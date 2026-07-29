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
      { p: '/restaurants',   i: 'utensils', l: 'Restaurants' },
      { p: '/cart',          i: 'cart',     l: 'Panier', badge: 'cart' },
      { p: '/orders',        i: 'package',  l: 'Commandes' },
      { p: '/account',       i: 'user',     l: 'Compte' }
    ],
    guest: [
      { p: '/',              i: 'home',     l: 'Accueil' },
      { p: '/restaurants',   i: 'utensils', l: 'Restaurants' },
      { p: '/cart',          i: 'cart',     l: 'Panier', badge: 'cart' },
      { p: '/login',         i: 'user',     l: 'Connexion' }
    ],
    restaurant: [
      { p: '/r',             i: 'chart',    l: 'Tableau' },
      { p: '/r/orders',      i: 'receipt',  l: 'Commandes' },
      { p: '/r/menu',        i: 'pizza',    l: 'Menu' },
      { p: '/r/profile',     i: 'store',    l: 'Restaurant' },
      { p: '/account',       i: 'user',     l: 'Compte' }
    ],
    driver: [
      { p: '/d',             i: 'chart',    l: 'Tableau' },
      { p: '/d/available',   i: 'pin',      l: 'Courses' },
      { p: '/d/active',      i: 'scooter',  l: 'En cours' },
      { p: '/d/history',     i: 'history',  l: 'Historique' },
      { p: '/account',       i: 'user',     l: 'Compte' }
    ],
    /* `c` : libellé court pour la barre du bas. Six rubriques sur 390 px font
       65 px chacune ; « Utilisateurs » et « Restaurants » s'y touchaient. */
    admin: [
      { p: '/a',             i: 'chart',    l: 'Tableau' },
      { p: '/a/restaurants', i: 'store',    l: 'Restaurants',  c: 'Restos' },
      { p: '/a/drivers',     i: 'scooter',  l: 'Livreurs' },
      { p: '/a/orders',      i: 'receipt',  l: 'Commandes' },
      { p: '/a/users',       i: 'users',    l: 'Utilisateurs', c: 'Comptes' },
      // Réglages manquait ici : la page n'était atteignable que par la barre
      // d'onglets répétée dans chaque page, qui doublonnait ce menu
      { p: '/a/settings',    i: 'settings', l: 'Réglages' }
    ]
  };

  const Shell = {

    navItems() {
      if (!Store.isLogged) return NAV.guest;
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
            : '<img src="assets/img/logo.jpg" alt="">') +
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
      const showZone = !Store.isLogged || Store.role === 'client';
      // la console d'administration est sombre, jusqu'à la barre du haut
      const admin = Store.isLogged && Store.role === 'admin';
      document.body.classList.toggle('role-admin', admin);

      bar.innerHTML =
        '<div class="wrap topbar-in">' +
          '<a class="brand" href="#' + (Store.isLogged ? Router.homeFor(Store.role) : '/') + '" ' +
            'title="' + U.esc(TALABI_CONFIG.APP_NAME) + '">' +
            '<img src="assets/img/logo.jpg" alt="' + U.esc(TALABI_CONFIG.APP_NAME) + '" class="brand-logo">' +
          '</a>' +

          (showZone ?
            '<button class="zone-pick" id="zoneBtn">' + UI.pin(15) + ' <span>' +
              U.esc(Store.zoneName() || 'Mon quartier') + '</span> ▾</button>' : '') +

          '<nav class="deskmenu">' +
            items.filter(x => x.p !== '/account' && x.p !== '/login')
                 .map(x => '<a href="#' + x.p + '" class="' + (Shell.isActive(x.p) ? 'on' : '') + '">' +
                   // l'admin gère six rubriques : sans pictogramme, le menu
                   // devient une rangée de mots difficile à balayer
                   (admin ? UI.icon(x.i, 17) + ' ' : '') + x.l + '</a>').join('') +
          '</nav>' +

          '<div class="top-actions">' +
            (Store.isLogged
              // le son ne concerne que ceux qu'on appelle : restaurant et livreur
              // w.Sound && … : la barre du haut ne doit pas tomber si le module
              // audio n'a pas pu se charger
              ? ((w.Sound && (Store.role === 'restaurant' || Store.role === 'driver'))
                  ? '<button class="icon-btn" id="soundBtn" title="' +
                      (Sound.muted ? 'Réactiver la sonnerie' : 'Couper la sonnerie') + '">' +
                      UI.icon(Sound.muted ? 'mute' : 'sound', 19) + '</button>'
                  : '') +
                '<button class="icon-btn" id="notifBtn" title="Notifications">' + UI.icon('bell', 19) +
                  (Store.unread ? '<span class="badge-dot">' + (Store.unread > 9 ? '9+' : Store.unread) + '</span>' : '') +
                '</button>' +
                '<a class="icon-btn" href="#/account" title="Mon compte" style="overflow:hidden;padding:0">' +
                  UI.avatar(Store.profile.full_name, Store.profile.avatar_url, 38) + '</a>'
              : '<a class="btn btn-primary btn-sm" href="#/login">Connexion</a>') +
          '</div>' +
        '</div>';

      const zb = document.getElementById('zoneBtn');
      if (zb) zb.onclick = Shell.zonePicker;
      const nb = document.getElementById('notifBtn');
      if (nb) nb.onclick = Shell.notifPanel;
      const sb = document.getElementById('soundBtn');
      if (sb) sb.onclick = () => {
        Sound.muted = !Sound.muted;
        UI.ok(Sound.muted ? 'Sonnerie coupée' : 'Sonnerie réactivée',
              Sound.muted ? 'Vous ne serez plus averti par un son.' : '');
        Shell.renderTop();
      };
    },

    /* --------------------------------------------------------- bottom nav */
    renderNav() {
      const nav = document.getElementById('bottomnav');
      nav.innerHTML = Shell.navItems().map(x => {
        let badge = '';
        if (x.badge === 'cart' && Store.cartCount) badge = '<span class="badge-dot">' + Store.cartCount + '</span>';
        return '<a href="#' + x.p + '" class="' + (Shell.isActive(x.p) ? 'on' : '') + '" ' +
               'title="' + U.esc(x.l) + '">' +
               '<i style="position:relative">' + UI.icon(x.i, 22) + badge + '</i>' +
               '<span>' + U.esc(x.c || x.l) + '</span></a>';
      }).join('');
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
          '<div class="notif-item ' + (n.is_read ? '' : 'unread') + '" data-o="' + U.esc(n.order_id || '') + '">' +
            '<div class="notif-ic">' + iconFor(n.type) + '</div>' +
            '<div class="grow"><b style="font-size:14px">' + U.esc(n.title) + '</b>' +
            '<div class="tiny" style="margin-top:2px">' + U.esc(n.body || '') + '</div>' +
            '<div class="tiny" style="margin-top:4px;opacity:.7">' + U.ago(n.created_at) + '</div></div>' +
          '</div>').join('');

        box.querySelectorAll('[data-o]').forEach(el => el.onclick = () => {
          const id = el.dataset.o;
          m.close();
          if (id) Router.go(targetFor(id));
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

  function targetFor(orderId) {
    if (Store.role === 'restaurant') return '/r/orders';
    if (Store.role === 'driver') return '/d/active';
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
