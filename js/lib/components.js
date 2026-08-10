/* ==========================================================================
   COMPOSANTS réutilisables (cartes restaurant, plats, timeline, etc.)
   ========================================================================== */
(function (w) {
  'use strict';

  const Cmp = {

    /* ====================================================================
       CARTE RESTAURANT
       --------------------------------------------------------------------
       L'ancienne carte était une vignette de catalogue : photo en 16/9,
       petit logo posé en bas à gauche, puis quatre lignes de texte. Trois
       d'affilée se ressemblaient toutes — on ne reconnaissait un restaurant
       qu'en lisant son nom.

       Celle-ci est bâtie sur ce qu'on reconnaît réellement d'un
       établissement : son ENSEIGNE. Le bandeau la montre en grand à gauche,
       et la photo du plat arrive de la droite en se fondant dans le fond
       crème — l'enseigne n'est jamais posée sur une image chargée, donc
       elle reste lisible quelle que soit la photo envoyée.

       En dessous, la barre de décision : nom, note, temps, prix plancher,
       quartier, et la flèche qui dit qu'on peut entrer. Tout ce qui sert à
       choisir est réuni sur deux lignes, jamais mêlé au décor.
       ==================================================================== */
    restoCard(r, i) {
      const emoji = (r.category_list && r.category_list[0] && r.category_list[0].icon) || '🍽️';
      const cover = r.cover_url ? U.escUrl(r.cover_url) : '';
      const logo  = r.logo_url  ? U.escUrl(r.logo_url)  : '';
      const open  = r.open_now;
      const note  = (+r.rating || 0).toFixed(1);

      /* Le premier de la liste porte le cadre orange : dans une pile de
         cartes identiques, rien ne dit où commencer. Une seule mise en
         avant — deux ne mettraient plus rien en avant. */
      const cls = 'rcard' + (i === 0 ? ' feat' : '') + (open ? '' : ' clos');

      return '<article class="' + cls + '" data-resto="' + U.esc(r.id) + '" ' +
               'role="button" tabindex="0" aria-label="' + U.esc(r.name) + '">' +

        '<div class="rc-haut">' +
          (cover ? '<div class="rc-photo" style="background-image:url(' + cover + ')"></div>'
                 : '<div class="rc-photo rc-vide">' + emoji + '</div>') +

          '<div class="rc-enseigne">' +
            (logo ? '<img src="' + logo + '" alt="" loading="lazy">'
                  : '<span class="rc-emoji">' + emoji + '</span>') +
          '</div>' +

          '<span class="rc-note"><span class="et">★</span> ' + note + '</span>' +
          '<span class="rc-etat' + (open ? '' : ' ferme') + '">' +
            (open ? 'Ouvert' : 'Fermé') + '</span>' +
        '</div>' +

        '<div class="rc-bas">' +
          '<div class="rc-txt">' +
            '<div class="rc-nom">' + U.esc(r.name) + '</div>' +
            '<div class="rc-meta">' +
              '<span class="m"><span class="et">★</span> <b>' + note + '</b>' +
                '<i>(' + (r.rating_count || 0) + ')</i></span>' +
              '<span class="sep"></span>' +
              '<span class="m">' + UI.icon('clock', 15) + (r.prep_time_min || 25) + ' min</span>' +
              '<span class="sep"></span>' +
              /* le tarif dépend de la distance : on annonce le plancher, le
                 montant exact apparaît une fois l'adresse choisie */
              '<span class="m">' + UI.icon('scooter', 16) + 'dès ' +
                U.money(U.deliveryFor(0, Store.settings).fee) + '</span>' +
            '</div>' +
            (r.zone && r.zone.name
              ? '<div class="rc-lieu">' + UI.icon('pin', 15) + U.esc(r.zone.name) + '</div>' : '') +
            (r.matched_dish
              ? '<div class="rc-plat">' + UI.icon('utensils', 14) +
                'propose « ' + U.esc(r.matched_dish) + ' »</div>' : '') +
          '</div>' +
          '<span class="rc-go" aria-hidden="true">' + UI.icon('arrow-right', 20) + '</span>' +
        '</div>' +
      '</article>';
    },

    /** Rend une liste de restaurants + branche la navigation */
    restoGrid(list, container) {
      if (!list.length) {
        container.innerHTML = UI.empty('🍽️', 'Aucun restaurant',
          'Aucun restaurant ne correspond à votre recherche dans ce quartier.');
        return;
      }
      /* Une pile, plus une grille. Une carte de restaurant se juge à sa
         photo et à son enseigne : réduite à un tiers de largeur, il ne reste
         ni l'une ni l'autre. C'est aussi ce que font toutes les applications
         de livraison — on fait défiler, on ne balaye pas. */
      container.innerHTML = '<div class="rc-list">' +
        list.map((r, i) => Cmp.restoCard(r, i)).join('') + '</div>';

      const ouvrir = el => Router.go('/resto/' + el.dataset.resto);
      container.querySelectorAll('[data-resto]').forEach(el => {
        el.onclick = () => ouvrir(el);
        /* La carte n'est pas un lien : sans ceci elle serait inatteignable
           au clavier, et invisible pour un lecteur d'écran. */
        el.onkeydown = e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(el); }
        };
      });
    },

    /* ------------------------------------------------------------ plat */
    /* cat : la catégorie du plat. Quand le plat n'a pas sa propre photo,
       on affiche le logo de sa catégorie plutôt qu'un emoji ; l'emoji ne
       sert que si la catégorie n'a pas de logo non plus. */
    dishRow(m, cat) {
      cat = cat || {};
      const own = m.image_url ? U.escUrl(m.image_url) : '';
      const fb = !own && cat.image_url ? U.escUrl(cat.image_url) : '';
      const style = own ? 'background-image:url(' + own + ')'
        : fb ? 'background-image:url(' + fb + ');background-size:74%;background-color:#fff' : '';
      return '<div class="dish ' + (m.is_available ? '' : 'off') + '" data-dish="' + U.esc(m.id) + '">' +
        '<div class="dish-img" style="' + style + '">' + (own || fb ? '' : (cat.icon || '🍽️')) + '</div>' +
        '<div class="dish-body">' +
          '<div class="dish-name">' + U.esc(m.name) + '</div>' +
          (m.description ? '<div class="dish-desc">' + U.esc(m.description) + '</div>' : '') +
          '<div class="row-between mt-auto" style="padding-top:8px">' +
            // plusieurs formats : le prix affiché est celui du plus petit
            '<span class="price">' + ((m.variants && m.variants.length > 1)
              ? '<span class="tiny" style="font-weight:600">dès </span>' + U.money(m.price)
              : U.money(m.price)) + '</span>' +
            (m.is_available
              ? '<button class="add-btn" data-add="' + U.esc(m.id) + '">+</button>'
              : '<span class="tag tag-muted">Indisponible</span>') +
          '</div>' +
        '</div></div>';
    },

    /* ------------------------------------------------------- catégories */
    categoryScroller(activeId, onPick) {
      // pastille illustrée quand la catégorie a une image, emoji sinon
      const bubble = c => c.image_url
        ? '<div class="bubble has-img" style="background-image:url(' + U.escUrl(c.image_url) + ')"></div>'
        : '<div class="bubble">' + (c.icon || '🍽️') + '</div>';

      const html = '<div class="cat-scroll">' +
        '<div class="cat-item ' + (!activeId ? 'on' : '') + '" data-cat="">' +
          '<div class="bubble bubble-all">Tout</div><span>Tout</span></div>' +
        Store.categories.map(c =>
          '<div class="cat-item ' + (activeId === c.id ? 'on' : '') + '" data-cat="' + c.id + '">' +
            bubble(c) + '<span>' + U.esc(c.name_fr) + '</span></div>').join('') +
        '</div>';
      return {
        html: html,
        bind(root) {
          root.querySelectorAll('[data-cat]').forEach(el =>
            el.onclick = () => onPick(el.dataset.cat || null));
        }
      };
    },

    /* --------------------------------------------------- suivi de commande */
    timeline(order) {
      /* Quatre étapes, plus sept. « En attente », « acceptée » et « en
         préparation » supposaient un écran au restaurant : elles ne se
         produisent plus, et les laisser dans la frise aurait affiché trois
         jalons que la commande ne franchit jamais. */
      const flow = ['ready', 'driver_assigned', 'delivering', 'delivered'];
      if (order.status === 'rejected' || order.status === 'cancelled') {
        return '<div class="banner banner-danger">' + U.statusIcon(order.status) + ' ' +
               U.esc(U.statusLabel(order.status)) +
               (order.reject_reason ? ' — ' + U.esc(order.reject_reason) : '') +
               (order.cancel_reason ? ' — ' + U.esc(order.cancel_reason) : '') + '</div>';
      }
      const idx = flow.indexOf(order.status);
      const stamps = {
        pending: order.created_at, accepted: order.accepted_at, ready: order.ready_at,
        driver_assigned: order.assigned_at, delivering: order.delivering_at, delivered: order.delivered_at
      };
      return '<div class="timeline">' + flow.map((s, i) => {
        const cls = i < idx ? 'done' : i === idx ? 'active' : '';
        return '<div class="tl-step ' + cls + '">' +
          '<div class="tl-dot">' + (i < idx ? '✓' : U.statusIcon(s)) + '</div>' +
          '<div class="tl-txt"><b>' + U.esc(U.statusLabel(s)) + '</b>' +
          '<span>' + (stamps[s] ? U.time(stamps[s]) : (i === idx ? 'en cours…' : 'en attente')) + '</span></div>' +
        '</div>';
      }).join('') + '</div>';
    },

    /* -------------------------------------------------- résumé de commande */
    orderLines(order) {
      return (order.items || []).map(i =>
        '<div class="oline"><span class="l"><b>' + i.quantity + '×</b> ' + U.esc(i.name) +
        // le format compte autant que le nom : le cuisinier doit le voir
        (i.variant ? ' <span class="tag tag-muted">' + U.esc(i.variant) + '</span>' : '') +
        ((i.options && i.options.length)
          ? '<br><span class="tiny">+ ' + U.esc(U.optionsText(i.options)) + '</span>' : '') +
        '</span><span>' + U.money(i.line_total) + '</span></div>').join('');
    },

    orderTotals(order) {
      return '<div class="oline"><span class="l">Sous-total</span><span>' + U.money(order.subtotal) + '</span></div>' +
        '<div class="oline"><span class="l">Livraison</span><span>' + U.money(order.delivery_fee) + '</span></div>' +
        '<div class="divider"></div>' +
        '<div class="oline" style="font-size:16px;font-weight:800"><span>Total</span>' +
        '<span class="price">' + U.money(order.total) + '</span></div>';
    },

    /** Carte compacte de commande (listes) */
    orderCard(o, opts) {
      const O = opts || {};
      return '<div class="order-card" data-order="' + U.esc(o.id) + '">' +
        '<div class="row-between">' +
          '<div class="row" style="gap:9px">' +
            '<span class="ocode">#' + U.esc(o.code) + '</span>' + UI.tag(o.status) +
          '</div>' +
          '<span class="tiny">' + U.ago(o.created_at) + '</span>' +
        '</div>' +
        '<div style="margin-top:10px"><b>' + U.esc(O.showClient ? (o.client_name || (o.client && o.client.full_name) || 'Client')
                                                              : (o.restaurant ? o.restaurant.name : '')) + '</b>' +
          '<div class="tiny">' + (o.items ? o.items.length : 0) + ' article(s) • ' + U.money(o.total) + '</div>' +
        '</div>' +
        (O.footer || '') +
      '</div>';
    },

    /* ------------------------------------------------------- sélecteurs */
    /* `icone` : nom d'un pictogramme du jeu UI.ICONS, facultatif. Quand il est
       donné, le champ est habillé comme les autres champs illustrés du
       formulaire (`.input-ic`). Sans lui, la sortie est celle d'avant au
       caractère près — les sept autres appels du projet ne changent pas. */
    zoneSelect(name, selected, label, required, icone) {
      const av = icone ? '<div class="input-ic"><span>' + UI.icon(icone, 17) + '</span>' : '';
      const ap = icone ? '</div>' : '';
      return '<div class="field"><label>' + U.esc(label || 'Zone') + '</label>' + av +
        '<select class="input" name="' + name + '" ' + (required ? 'required' : '') + '>' +
        '<option value="">— Choisir —</option>' +
        // la wilaya n'est affichée que si elle sort du périmètre habituel
        Store.zones.map(z => '<option value="' + z.id + '"' + (selected === z.id ? ' selected' : '') + '>' +
          U.esc(z.name) +
          (z.wilaya && z.wilaya !== TALABI_CONFIG.DEFAULT_WILAYA ? ' (' + U.esc(z.wilaya) + ')' : '') +
          '</option>').join('') +
        '</select>' + ap + '</div>';
    },

    categorySelect(name, selected, label) {
      return '<div class="field"><label>' + U.esc(label || 'Catégorie') + '</label>' +
        '<select class="input" name="' + name + '">' +
        '<option value="">— Choisir —</option>' +
        Store.categories.map(c => '<option value="' + c.id + '"' + (selected === c.id ? ' selected' : '') + '>' +
          c.icon + ' ' + U.esc(c.name_fr) + '</option>').join('') +
        '</select></div>';
    },

    /**
     * Compte à rebours vivant.
     * Le HTML ne porte que l'échéance ; c'est l'horloge de app.js qui met le
     * texte à jour chaque seconde. Réafficher toute la page à chaque seconde
     * ferait sauter le défilement et perdrait le focus des champs.
     *
     * @param deadline échéance ISO
     * @param label    texte devant le chrono
     * @param alerte   secondes en dessous desquelles il passe en rouge
     */
    countdown(deadline, label, alerte) {
      const reste = U.secondsLeft(deadline);
      return '<div class="cdown' + (reste <= (alerte || 60) ? ' urgent' : '') + '" ' +
             'data-until="' + U.esc(deadline || '') + '" data-alert="' + (alerte || 60) + '">' +
        UI.icon('clock', 16) +
        '<span class="l">' + U.esc(label || '') + '</span>' +
        '<b class="t">' + U.mmss(reste) + '</b>' +
      '</div>';
    },

    /** Titre de section de page interne */
    pageHead(title, subtitle, actionHtml) {
      return '<div class="row-between" style="margin-bottom:16px;flex-wrap:wrap;gap:12px">' +
        '<div><div class="h1">' + U.esc(title) + '</div>' +
        (subtitle ? '<div class="sub" style="margin-top:4px">' + U.esc(subtitle) + '</div>' : '') + '</div>' +
        (actionHtml || '') + '</div>';
    }
  };

  w.Cmp = Cmp;
})(window);
