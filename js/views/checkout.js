/* ==========================================================================
   VUE — Validation de la commande (adresse, téléphone, notes, confirmation)
   ========================================================================== */
(function (w) {
  'use strict';

  Router.add('/checkout', async function (params, query, view) {

    if (!Store.cartCount) return Router.go('/cart', true);

    const addresses = await API.safe(() => API.addresses(), []);
    let selected = addresses.find(a => a.is_default) || addresses[0] || null;
    const t = Store.cartTotals;

    function addrRow(a) {
      return '<label class="role-card ' + (selected && selected.id === a.id ? 'on' : '') + '" data-addr="' + U.esc(a.id) + '">' +
        '<div class="ic">📍</div>' +
        '<div class="grow"><b>' + U.esc(a.label) + '</b>' +
          (U.hasCoords(a) ? ' <span class="tag tag-ok">GPS</span>' : ' <span class="tag tag-warn">sans GPS</span>') +
          '<div class="tiny">' + U.esc(a.street) + (a.details ? ' — ' + U.esc(a.details) : '') + '</div>' +
          '<div class="tiny">' + U.esc(zoneName(a.zone_id)) + ' • ' + U.esc(a.phone || Store.profile.phone || '') + '</div></div>' +
        '<div style="color:var(--brand);font-weight:800">' + (selected && selected.id === a.id ? '✓' : '') + '</div>' +
      '</label>';
    }

    function paint() {
      view.innerHTML = '<div class="wrap-sm page">' +
        Cmp.pageHead('Finaliser la commande', Store.cart.restaurant_name || '') +

        /* ---- adresse ---- */
        '<div class="card card-p">' +
          '<div class="row-between" style="margin-bottom:12px">' +
            '<div class="h3">Adresse de livraison</div>' +
            '<button class="btn btn-soft btn-sm" id="addAddr">+ Nouvelle</button>' +
          '</div>' +
          (addresses.length
            ? '<div class="stack" style="gap:9px" id="addrList">' + addresses.map(addrRow).join('') + '</div>'
            : '<div class="center" style="padding:6px 0 2px">' +
                '<div style="font-size:38px">🗺️</div>' +
                '<b style="display:block;margin-top:8px">Où doit-on vous livrer ?</b>' +
                '<p class="sub" style="margin:6px 0 14px">Placez le repère sur votre porte : le livreur ouvrira ' +
                  'l’itinéraire directement dans Google Maps.</p>' +
                '<button class="btn btn-primary btn-block btn-lg" id="pickNow">' +
                  '📍 Choisir ma position sur la carte</button>' +
              '</div>') +
        '</div>' +

        /* ---- contact + note ---- */
        '<div class="card card-p" style="margin-top:14px">' +
          '<div class="h3" style="margin-bottom:12px">Contact & instructions</div>' +
          '<div class="stack">' +
            '<div class="field"><label>Numéro de téléphone</label>' +
              '<input class="input" id="phone" inputmode="tel" placeholder="0555 12 34 56" value="' +
              U.esc((selected && selected.phone) || Store.profile.phone || '') + '"></div>' +
            '<div class="field"><label>Note pour le livreur <span class="tiny">(facultatif)</span></label>' +
              '<textarea class="input" id="note" placeholder="Ex : Sonner deux fois, 3e étage, immeuble bleu…"></textarea></div>' +
          '</div>' +
        '</div>' +

        /* ---- récapitulatif ---- */
        '<div class="card card-p" style="margin-top:14px">' +
          '<div class="h3" style="margin-bottom:10px">Récapitulatif</div>' +
          Store.cart.items.map(l =>
            '<div class="oline"><span class="l"><b>' + l.quantity + '×</b> ' + U.esc(l.name) +
            ((l.options && l.options.length) ? '<br><span class="tiny">+ ' + U.esc(l.options.map(o => o.name).join(', ')) + '</span>' : '') +
            '</span><span>' + U.money(Store.lineTotal(l)) + '</span></div>').join('') +
          '<div class="divider"></div>' +
          '<div class="oline"><span class="l">Sous-total</span><span>' + U.money(t.subtotal) + '</span></div>' +
          '<div class="oline"><span class="l">Frais de livraison</span><span>' + U.money(t.delivery_fee) + '</span></div>' +
          '<div class="divider"></div>' +
          '<div class="oline" style="font-size:17px;font-weight:800"><span>Total à payer</span>' +
            '<span class="price">' + U.money(t.total) + '</span></div>' +
        '</div>' +

        /* ---- paiement ---- */
        '<div class="card card-p" style="margin-top:14px">' +
          '<div class="h3" style="margin-bottom:10px">Mode de paiement</div>' +
          '<div class="role-card on"><div class="ic">💵</div>' +
            '<div class="grow"><b>Paiement à la livraison</b>' +
            '<div class="tiny">Réglez en espèces au livreur à la réception.</div></div>' +
            '<div style="color:var(--brand);font-weight:800">✓</div></div>' +
        '</div>' +

        '<button class="btn btn-primary btn-block btn-lg" style="margin-top:18px" id="confirm">' +
          '✅ Confirmer la commande • ' + U.money(t.total) + '</button>' +
        '<div class="tiny center" style="margin-top:10px">Le restaurant confirmera votre commande dans quelques instants.</div>' +
      '</div>';

      view.querySelectorAll('[data-addr]').forEach(el => el.onclick = () => {
        selected = addresses.find(a => a.id === el.dataset.addr);
        paint();
      });
      const newAddr = () => addressSheet(null, saved => {
        addresses.push(saved); selected = saved; paint();
      });
      view.querySelector('#addAddr').onclick = newAddr;
      const pn = view.querySelector('#pickNow');
      if (pn) pn.onclick = newAddr;

      view.querySelector('#confirm').onclick = submit;
    }

    async function submit() {
      const btn = view.querySelector('#confirm');
      const phone = view.querySelector('#phone').value.trim();
      const note = view.querySelector('#note').value.trim();

      if (!selected) return UI.err('Adresse manquante', 'Ajoutez une adresse de livraison.');
      if (!U.isPhoneDZ(phone)) return UI.err('Numéro invalide', 'Format : 05 / 06 / 07 xx xx xx xx');

      UI.busy(btn, true, 'Envoi de la commande…');
      try {
        const order = await API.createOrder({
          restaurant_id: Store.cart.restaurant_id,
          zone_id: selected.zone_id || Store.cart.zone_id || Store.zoneId,
          address_street: selected.street,
          address_details: selected.details || '',
          address_lat: selected.lat, address_lng: selected.lng,
          client_phone: phone,
          client_name: Store.profile.full_name,
          note: note,
          items: Store.cart.items.map(l => ({
            menu_item_id: l.menu_item_id, quantity: l.quantity, options: l.options || []
          }))
        });
        Store.clearCart();
        Shell.renderNav();
        UI.ok('Commande envoyée !', 'Numéro #' + order.code);
        Router.go('/order/' + order.id, true);
      } catch (e) {
        UI.busy(btn, false);
        UI.err(e.message);
      }
    }

    paint();
  }, { auth: true, roles: ['client'] });

  /* ======================================================================
     Formulaire d'adresse (réutilisé dans le compte client)
     La position sur la carte est l'élément central : c'est elle qui permet
     au livreur d'ouvrir directement l'itinéraire dans Google Maps.
     ====================================================================== */
  function addressSheet(existing, onSaved) {
    const a = existing || {};
    let pos = U.hasCoords(a) ? { lat: +a.lat, lng: +a.lng } : null;

    const m = UI.sheet({
      title: existing ? 'Modifier l’adresse' : 'Nouvelle adresse',
      body: '<form id="af" class="stack" novalidate>' +

        /* ---- position sur la carte ---- */
        '<div class="field"><label>Position exacte *</label><div id="posBox"></div></div>' +

        '<div class="field"><label>Nom de l’adresse</label>' +
          '<input class="input" name="label" placeholder="Domicile, Travail…" value="' + U.esc(a.label || 'Domicile') + '" required></div>' +
        Cmp.zoneSelect('zone_id', a.zone_id || Store.zoneId, 'Quartier', true) +
        '<div class="field"><label>Adresse écrite</label>' +
          '<input class="input" name="street" placeholder="Cité, rue, numéro…" value="' + U.esc(a.street || '') + '" required>' +
          '<div class="hint">Remplie automatiquement depuis la carte, modifiable.</div></div>' +
        '<div class="field"><label>Complément <span class="tiny">(très utile au livreur)</span></label>' +
          '<input class="input" name="details" placeholder="Étage, bâtiment, couleur du portail…" value="' + U.esc(a.details || '') + '"></div>' +
        '<div class="field"><label>Téléphone</label>' +
          '<input class="input" name="phone" inputmode="tel" placeholder="0555 12 34 56" value="' +
          U.esc(a.phone || (Store.profile && Store.profile.phone) || '') + '" required></div>' +
        '<label class="row" style="gap:9px;cursor:pointer"><input type="checkbox" name="is_default" ' +
          (a.is_default || !existing ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:var(--brand)">' +
          '<span class="tiny">Utiliser comme adresse par défaut</span></label>' +
      '</form>',

      footer: '<button class="btn btn-primary btn-block" id="save">Enregistrer</button>',

      onMount(el, api) {
        const box = el.querySelector('#posBox');
        const streetInput = el.querySelector('[name=street]');

        function paintPos() {
          if (!pos) {
            box.innerHTML =
              '<button type="button" class="btn btn-primary btn-block btn-lg" id="pick">' +
                '📍 Choisir ma position sur la carte</button>' +
              '<div class="hint" style="margin-top:6px">Le livreur ouvrira ce point directement dans Google Maps.</div>';
          } else {
            box.innerHTML =
              '<div class="map-preview" id="prev"></div>' +
              '<div class="row" style="gap:8px;margin-top:8px">' +
                '<button type="button" class="btn btn-ghost btn-sm grow" id="pick">🗺️ Modifier la position</button>' +
                '<a class="btn btn-ghost btn-sm" href="' + U.gmapsPin(pos.lat, pos.lng) +
                  '" target="_blank" rel="noopener">Google Maps ↗</a>' +
              '</div>';
            MapPicker.preview(box.querySelector('#prev'), pos.lat, pos.lng);
          }

          box.querySelector('#pick').onclick = () => {
            MapPicker.open({
              title: 'Où livrer ?',
              lat: pos && pos.lat, lng: pos && pos.lng,
              onPick(p) {
                pos = { lat: p.lat, lng: p.lng };
                // on ne remplace le texte que s'il est vide : l'utilisateur reste maître
                if (p.address && !streetInput.value.trim()) streetInput.value = p.address;
                paintPos();
              }
            });
          };
        }
        paintPos();

        el.querySelector('#save').onclick = async function () {
          const f = el.querySelector('#af');
          const d = UI.formData(f);
          if (!pos) return UI.err('Position manquante', 'Choisissez votre position sur la carte.');
          if (!d.street || d.street.length < 5) return UI.err('Adresse trop courte');
          if (!d.zone_id) return UI.err('Choisissez votre quartier');
          if (!U.isPhoneDZ(d.phone)) return UI.err('Numéro invalide');
          d.is_default = !!f.querySelector('[name=is_default]').checked;
          d.lat = pos.lat; d.lng = pos.lng;
          if (existing) d.id = existing.id;
          UI.busy(this, true);
          try {
            const saved = await API.saveAddress(d);
            api.close();
            UI.ok('Adresse enregistrée');
            onSaved && onSaved(saved);
          } catch (e) { UI.busy(this, false); UI.err(e.message); }
        };
      }
    });

    // sur une nouvelle adresse, on ouvre la carte tout de suite
    if (!existing) setTimeout(() => {
      const b = m.el.querySelector('#pick');
      if (b) b.click();
    }, 380);
  }

  w.addressSheet = addressSheet;
})(window);
