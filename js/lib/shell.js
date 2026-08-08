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
        : '<img src="' + U.asset('assets/img/logo.jpg') + '" alt="' +
            U.esc(TALABI_CONFIG.APP_NAME) + '" class="brand-logo">';

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

    /* -------------------------------------------------------- notifications */
    async notifPanel() {
      const nb = Store.unread || 0;
      const m = UI.sheet({
        title: 'Notifications',
        subtitle: nb ? (nb > 1 ? nb + ' non lues' : '1 non lue') : 'Tout est à jour',
        icon: '<span class="notif-tete-ic">' + UI.icon('bell', 19) + '</span>',
        body: '<div id="nlist">' +
              '<div class="skel" style="height:72px;margin-bottom:10px;border-radius:16px"></div>' +
              '<div class="skel" style="height:72px;border-radius:16px"></div></div>',
        footer: nb ? '<button class="btn btn-ghost btn-block" id="markAll">' +
                     UI.icon('check', 17) + ' Tout marquer comme lu</button>' : ''
      });

      const list = await API.safe(() => API.notifications(40), []);
      const box = m.el.querySelector('#nlist');

      if (!list.length) {
        box.innerHTML = '<div class="notif-vide">' +
          '<div class="notif-vide-ic">' + UI.icon('bell', 30) + '</div>' +
          '<b>Rien pour le moment</b>' +
          '<p>Vous serez prévenu ici à chaque étape de vos commandes.</p></div>';
      } else {
        box.style.margin = '-18px -18px -6px';
        /* Les avis sont regroupés par jour : « aujourd'hui » d'abord. Sans
           ces repères, quinze lignes d'affilée se lisent comme un mur, et
           « il y a 3 h » ne dit plus rien à côté de « il y a 3 j ». */
        let jour = '';
        box.innerHTML = '<div class="notif-liste">' + list.map(n => {
          const j = U.dayLabel ? U.dayLabel(n.created_at) : '';
          let tete = '';
          if (j && j !== jour) { jour = j; tete = '<div class="notif-jour">' + U.esc(j) + '</div>'; }
          return tete +
            '<button type="button" class="notif-item' + (n.is_read ? '' : ' unread') + '"' +
              ' data-o="' + U.esc(n.order_id || '') + '" data-t="' + U.esc(n.type || '') + '">' +
              iconFor(n.type) +
              '<span class="notif-txt">' +
                '<span class="notif-h">' + U.esc(n.title) + '</span>' +
                (n.body ? '<span class="notif-b">' + U.esc(n.body) + '</span>' : '') +
                '<span class="notif-t">' + U.esc(U.ago(n.created_at)) + '</span>' +
              '</span>' +
              (n.is_read ? '' : '<span class="notif-neuf" aria-label="Non lu"></span>') +
              (n.order_id ? '<span class="notif-fl">' + UI.icon('chevron', 16) + '</span>' : '') +
            '</button>';
        }).join('') + '</div>';

        box.querySelectorAll('[data-o]').forEach(el => el.onclick = () => {
          const id = el.dataset.o, t = el.dataset.t;
          if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
          /* La navigation attend que le panneau ait rendu son entrée
             d'historique : sinon le « retour » de l'écran qu'on vient
             d'ouvrir ramènerait sur cet écran-ci, pas sur le précédent. */
          m.close(id ? () => Router.go(targetFor(id, t)) : null);
        });
      }

      const tout = m.el.querySelector('#markAll');
      if (tout) tout.onclick = async () => {
        /* Les pastilles s'éteignent tout de suite, sous le doigt : attendre
           le serveur pour un geste dont l'issue ne fait aucun doute donne
           l'impression que le bouton n'a pas répondu. */
        m.el.querySelectorAll('.notif-item.unread').forEach(el => {
          el.classList.remove('unread');
          const p = el.querySelector('.notif-neuf'); if (p) p.remove();
        });
        tout.disabled = true;
        await API.safe(() => API.markNotificationsRead());
        await Store.refreshUnread();
        Shell.renderTop();
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
