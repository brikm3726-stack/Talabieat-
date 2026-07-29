/* ==========================================================================
   COMPOSANTS réutilisables (cartes restaurant, plats, timeline, etc.)
   ========================================================================== */
(function (w) {
  'use strict';

  const Cmp = {

    /* ------------------------------------------------------ carte restaurant */
    restoCard(r) {
      const emoji = (r.category_list && r.category_list[0] && r.category_list[0].icon) || '🍽️';
      const cover = r.cover_url ? 'background-image:url(' + U.escUrl(r.cover_url) + ')' : '';
      const logo = r.logo_url ? 'background-image:url(' + U.escUrl(r.logo_url) + ')' : '';
      const open = r.open_now;

      return '<article class="resto-card" data-resto="' + U.esc(r.id) + '">' +
        '<div class="resto-cover" style="' + cover + '">' +
          (cover ? '' : '<div style="height:100%;display:grid;place-items:center;font-size:52px;opacity:.35">' + emoji + '</div>') +
          (open ? '' : '<div class="closed-ov">FERMÉ ACTUELLEMENT</div>') +
          '<div class="resto-logo" style="' + logo + '">' + (logo ? '' : emoji) + '</div>' +
        '</div>' +
        '<div class="resto-body">' +
          '<div class="row-between" style="align-items:flex-start">' +
            '<div class="grow"><div class="h3">' + U.esc(r.name) + '</div></div>' +
            '<span class="tag ' + (open ? 'tag-ok' : 'tag-muted') + '">' + (open ? 'Ouvert' : 'Fermé') + '</span>' +
          '</div>' +
          '<div class="resto-meta">' +
            '<span>⭐ <b>' + (+r.rating).toFixed(1) + '</b> <span style="opacity:.7">(' + (r.rating_count || 0) + ')</span></span>' +
            '<span class="dot-sep">🕒 ' + (r.prep_time_min || 25) + ' min</span>' +
            '<span class="dot-sep">🛵 ' + U.money(r.delivery_fee) + '</span>' +
          '</div>' +
          '<div class="tiny" style="margin-top:6px">' + UI.pin() + ' ' + U.esc(r.zone ? r.zone.name : '') + '</div>' +
          (r.matched_dish
            ? '<div class="tiny" style="margin-top:5px;color:var(--brand);font-weight:650">' +
              '🍽️ propose « ' + U.esc(r.matched_dish) + ' »</div>' : '') +
        '</div></article>';
    },

    /** Rend une grille de restaurants + branche la navigation */
    restoGrid(list, container) {
      if (!list.length) {
        container.innerHTML = UI.empty('🍽️', 'Aucun restaurant',
          'Aucun restaurant ne correspond à votre recherche dans ce quartier.');
        return;
      }
      container.innerHTML = '<div class="grid grid-auto">' + list.map(Cmp.restoCard).join('') + '</div>';
      container.querySelectorAll('[data-resto]').forEach(el =>
        el.onclick = () => Router.go('/resto/' + el.dataset.resto));
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
      const flow = ['pending', 'accepted', 'preparing', 'ready', 'driver_assigned', 'delivering', 'delivered'];
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
          ? '<br><span class="tiny">+ ' + U.esc(i.options.map(o => o.name).join(', ')) + '</span>' : '') +
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
    zoneSelect(name, selected, label, required) {
      return '<div class="field"><label>' + U.esc(label || 'Zone') + '</label>' +
        '<select class="input" name="' + name + '" ' + (required ? 'required' : '') + '>' +
        '<option value="">— Choisir —</option>' +
        // la wilaya n'est affichée que si elle sort du périmètre habituel
        Store.zones.map(z => '<option value="' + z.id + '"' + (selected === z.id ? ' selected' : '') + '>' +
          U.esc(z.name) +
          (z.wilaya && z.wilaya !== TALABI_CONFIG.DEFAULT_WILAYA ? ' (' + U.esc(z.wilaya) + ')' : '') +
          '</option>').join('') +
        '</select></div>';
    },

    categorySelect(name, selected, label) {
      return '<div class="field"><label>' + U.esc(label || 'Catégorie') + '</label>' +
        '<select class="input" name="' + name + '">' +
        '<option value="">— Choisir —</option>' +
        Store.categories.map(c => '<option value="' + c.id + '"' + (selected === c.id ? ' selected' : '') + '>' +
          c.icon + ' ' + U.esc(c.name_fr) + '</option>').join('') +
        '</select></div>';
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
