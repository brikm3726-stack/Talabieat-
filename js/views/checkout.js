/* ==========================================================================
   VUE — Validation de la commande (adresse, téléphone, notes, confirmation)
   ========================================================================== */
(function (w) {
  'use strict';

  Router.add('/checkout', async function (params, query, view) {

    if (!Store.cartCount) return Router.go('/cart', true);

    /* Thème sombre, comme le panier d'où l'on arrive. Posé avant tout appel
       réseau : sinon le crème apparaîtrait le temps du chargement des
       adresses, et un éclair blanc au moment de payer est le pire endroit
       pour en avoir un. */
    UI.nuit('commander');

    const addresses = await API.safe(() => API.addresses(), []);
    let selected = addresses.find(a => a.is_default) || addresses[0] || null;
    /* La liste des adresses est repliée par défaut : on ne l'ouvre que si l'on
       veut changer. Voir la note dans paint(). */
    let listeOuverte = false;

    function addrRow(a) {
      return '<label class="role-card ' + (selected && selected.id === a.id ? 'on' : '') + '" data-addr="' + U.esc(a.id) + '">' +
        '<div class="ic">' + UI.icon('pin', 20) + '</div>' +
        '<div class="grow"><b>' + U.esc(a.label) + '</b>' +
          (U.hasCoords(a) ? ' <span class="tag tag-ok">GPS</span>' : ' <span class="tag tag-warn">sans GPS</span>') +
          '<div class="tiny">' + U.esc(a.street) + (a.details ? ' — ' + U.esc(a.details) : '') + '</div>' +
          '<div class="tiny">' + U.esc(zoneName(a.zone_id)) + ' • ' + U.esc(a.phone || Store.profile.phone || '') + '</div></div>' +
        '<div style="color:var(--brand);font-weight:800">' + (selected && selected.id === a.id ? '✓' : '') + '</div>' +
      '</label>';
    }

    function paint() {
      /* Les frais dépendent de l'adresse choisie : tout est recalculé à chaque
         changement d'adresse, sinon le client verrait le tarif de la
         précédente. */
      const liv = Store.deliveryFor(selected);
      const t = Store.totalsFor(selected);

      /* Le verrou de trente jours sur le numéro est annoncé SOUS le numéro,
         plutôt que découvert au moment d'essayer de le changer. C'est un
         déclencheur PostgreSQL qui l'applique : mieux vaut le dire avant. */
      const verrou = U.phoneLock(Store.profile);

      view.innerHTML = '<div class="wrap-sm page ck-page">' +

        /* ---- l'en-tête de la maquette 2b : la question, puis l'étape ---- */
        '<div class="ck-head">' +
          '<button class="ck-back" id="ckBack" aria-label="Retour">' +
            '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
              'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
              '<path d="M15 18l-6-6 6-6"/></svg></button>' +
          '<div class="grow"><div class="h1">Où livrer ?</div>' +
            '<div class="sub">Dernière étape · ' +
              U.esc(Store.cart.restaurant_name || '') + '</div></div>' +
        '</div>' +

        /* ---- LA POSITION D'ABORD : la carte, puis l'adresse ----
           Une adresse écrite se vérifie mal ; un repère sur un plan se vérifie
           d'un coup d'œil. C'est pour ça que la carte passe devant. */
        '<div class="card ck-lieu">' +
          (selected && U.hasCoords(selected)
            ? '<div class="ck-map" id="ckMap"></div>'
            : '<div class="ck-map ck-map-vide">' + UI.icon('pin', 30) +
              '<span>Aucune position sur cette adresse</span></div>') +
          (addresses.length
            ? '<div class="ck-adr">' +
                '<span class="ic">' + UI.icon('pin', 19) + '</span>' +
                '<div class="grow">' +
                  '<b>' + U.esc((selected && selected.label) || 'Adresse') + '</b>' +
                  '<span class="tiny">' +
                    U.esc((selected && selected.street) || '') +
                    (liv.km != null ? ' · ' + liv.km + ' km du restaurant' : '') +
                  '</span>' +
                '</div>' +
                '<button class="ck-changer" id="ckChanger">' +
                  (listeOuverte ? 'Fermer' : 'Changer') + '</button>' +
              '</div>' +
              (listeOuverte
                ? '<div class="ck-liste" id="addrList">' +
                    addresses.map(addrRow).join('') +
                    '<button class="btn btn-soft btn-block btn-sm" id="addAddr">' +
                      '+ Nouvelle adresse</button>' +
                  '</div>'
                : '')
            : '<div class="ck-vide">' +
                '<b>Où doit-on vous livrer ?</b>' +
                '<p class="sub">Activez votre localisation : le livreur saura ' +
                  'exactement où vous trouver et ouvrira l’itinéraire dans Google Maps.</p>' +
                '<button class="btn btn-primary btn-block btn-lg" id="geoNow">' +
                  UI.icon('navigation', 18) + ' Activer ma localisation</button>' +
                '<button class="btn btn-ghost btn-block btn-sm" id="pickNow" style="margin-top:9px">' +
                  'Ou placer le repère à la main</button>' +
              '</div>') +
        '</div>' +

        /* ---- position manquante sur l'adresse choisie ---- */
        (selected && !U.hasCoords(selected)
          ? '<div class="banner banner-warn" style="margin-top:12px">' +
            '<div class="grow">' + UI.pin(14) + ' Cette adresse n’a pas de position GPS — le livreur risque de vous chercher.</div>' +
            '<button class="btn btn-primary btn-sm" id="fixGeo">Activer</button></div>'
          : '') +

        /* ---- distance et tarif : annoncés avant de payer, jamais après ---- */
        (liv.horsZone
          ? '<div class="banner banner-warn" style="margin-top:12px">🛵 <div class="grow">' +
              '<b>Trop loin pour être livré</b><br>Cette adresse est à environ <b>' + liv.km +
              ' km</b> du restaurant, au-delà des ' +
              U.esc(String((Store.settings && Store.settings.max_km) || 15)) +
              ' km que nous couvrons. Choisissez une autre adresse ou un restaurant plus proche.' +
            '</div></div>'
          : liv.km != null
            ? '<div class="banner banner-info" style="margin-top:12px">🛵 <div class="grow">' +
                'Environ <b>' + liv.km + ' km</b> entre le restaurant et vous — ' +
                'livraison à <b>' + U.money(liv.fee) + '</b>' +
                (liv.loin ? ' <span class="tiny">(tarif longue distance)</span>' : '') +
              '</div></div>'
            : '') +

        /* ---- AIDER LE LIVREUR À VOUS TROUVER ----
           « Note pour le livreur » décrivait le champ ; ce titre-là dit à quoi
           il sert. Et les deux propositions donnent une réponse à écrire, au
           lieu d'un rectangle vide devant lequel on ne trouve rien à dire. */
        '<div class="card card-p ck-bloc">' +
          '<div class="ck-t">Aider le livreur à vous trouver</div>' +
          '<textarea class="input ck-note" id="note" rows="2" ' +
            'placeholder="Ex : 3e étage, porte à droite. Sonner deux fois."></textarea>' +
          '<div class="ck-props">' +
            '<button type="button" class="ck-prop" data-prop="Laisser à la porte">Laisser à la porte</button>' +
            '<button type="button" class="ck-prop" data-prop="M’appeler en arrivant">M’appeler en arrivant</button>' +
          '</div>' +
        '</div>' +

        /* ---- le numéro, et le verrou annoncé ---- */
        '<div class="card card-p ck-bloc">' +
          '<div class="ck-tel">' +
            '<span class="ic">' + UI.icon('phone', 19) + '</span>' +
            '<div class="grow">' +
              '<input class="ck-num" id="phone" inputmode="tel" placeholder="0555 12 34 56" value="' +
                U.esc((selected && selected.phone) || Store.profile.phone || '') + '">' +
              (verrou.bloque
                ? '<span class="tiny">Modifiable dans ' + verrou.jours + ' jour' +
                  (verrou.jours > 1 ? 's' : '') + '</span>'
                : '<span class="tiny">Le livreur vous appellera sur ce numéro</span>') +
            '</div>' +
            (U.isPhoneDZ((selected && selected.phone) || Store.profile.phone || '')
              ? '<span class="ck-ok">' + UI.icon('check', 13) + ' Vérifié</span>' : '') +
          '</div>' +
        '</div>' +

        /* ---- PAIEMENT : ce qui existe, et ce qui viendra ----
           La carte bancaire est montrée éteinte plutôt que cachée. Un client
           qui ne la voit pas se demande si Talabi la prend ; en la voyant
           marquée « Bientôt », il sait à quoi s'en tenir. */
        '<div class="card card-p ck-bloc">' +
          '<div class="ck-t">Paiement</div>' +
          '<div class="ck-pay on">' +
            '<span class="ck-radio"></span>' +
            '<span class="grow">Espèces à la réception</span>' +
            '<b>' + U.money(t.total) + '</b>' +
          '</div>' +
          '<div class="ck-pay off">' +
            '<span class="ck-radio"></span>' +
            '<span class="grow">Carte Edahabia / CIB</span>' +
            '<span class="ck-bientot">Bientôt</span>' +
          '</div>' +
        '</div>' +

        /* ---- le compte, ligne à ligne ---- */
        '<div class="card card-p ck-bloc ck-total">' +
          Store.cart.items.map(l =>
            '<div class="oline"><span class="l"><b>' + l.quantity + '×</b> ' + U.esc(l.name) +
            (l.variant ? ' <span class="tag tag-muted">' + U.esc(l.variant.name) + '</span>' : '') +
            ((l.options && l.options.length) ? '<br><span class="tiny">+ ' + U.esc(l.options.map(o => o.name).join(', ')) + '</span>' : '') +
            '</span><span>' + U.money(Store.lineTotal(l)) + '</span></div>').join('') +
          '<div class="divider"></div>' +
          '<div class="oline"><span class="l">' + Store.cartCount + ' article' +
            (Store.cartCount > 1 ? 's' : '') + '</span><span>' + U.money(t.subtotal) + '</span></div>' +
          '<div class="oline"><span class="l">Livraison' +
            (liv.km != null ? ' · ' + liv.km + ' km' : '') + '</span><span>' +
            U.money(t.delivery_fee) + '</span></div>' +
          '<div class="divider"></div>' +
          '<div class="ck-somme"><span>Total</span>' +
            '<span class="price">' + U.money(t.total) + '</span></div>' +
        '</div>' +

        /* ---- LA BARRE DU BAS : le geste, toujours à portée de pouce ----
           Le bouton était en bas du document : sur un long écran, il fallait
           faire défiler tout le récapitulatif pour l'atteindre. Il ne bouge
           plus, et le délai de réponse du restaurant est annoncé juste
           au-dessus — c'est la question qu'on se pose avant d'appuyer. */
        '<div class="ck-bas">' +
          '<div class="ck-delai">' + UI.icon('clock', 14) + ' ' +
            U.esc(Store.cart.restaurant_name || 'Le restaurant') +
            ' répond sous ' + U.respondMinutes(Store.settings) + ' minutes</div>' +
          '<button class="btn btn-primary btn-block btn-lg ck-cta" id="confirm"' +
            (liv.horsZone ? ' disabled' : '') + '>' +
            (liv.horsZone
              ? 'Adresse hors zone de livraison'
              : 'Commander · ' + U.money(t.total) +
                '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                  'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
                  '<path d="M4.5 12h15"/><path d="m13.2 5.4 6.6 6.6-6.6 6.6"/></svg>') +
          '</button>' +
        '</div>' +
      '</div>';

      /* La vraie carte du projet, pas une esquisse : c'est le même
         MapPicker.preview que partout ailleurs, sur la position choisie. */
      const mp = view.querySelector('#ckMap');
      if (mp && selected) MapPicker.preview(mp, selected.lat, selected.lng);

      view.querySelector('#ckBack').onclick = () => Router.back();

      /* La liste des adresses ne s'ouvre qu'à la demande : une seule adresse
         affichée suffit à valider, et cinq rangées repoussaient le total et le
         bouton hors de l'écran. */
      const ch = view.querySelector('#ckChanger');
      if (ch) ch.onclick = () => { listeOuverte = !listeOuverte; paint(); };

      /* Les deux propositions écrivent dans la note au lieu de la remplacer :
         « Laisser à la porte » et un étage se cumulent très bien. */
      view.querySelectorAll('[data-prop]').forEach(b => b.onclick = () => {
        const z = view.querySelector('#note');
        const t = z.value.trim();
        if (t.indexOf(b.dataset.prop) >= 0) return;
        z.value = t ? t.replace(/[.\s]*$/, '') + '. ' + b.dataset.prop : b.dataset.prop;
        z.focus();
      });

      view.querySelectorAll('[data-addr]').forEach(el => el.onclick = () => {
        selected = addresses.find(a => a.id === el.dataset.addr);
        listeOuverte = false;
        paint();
      });
      const newAddr = (initialPos) => addressSheet(null, saved => {
        addresses.push(saved); selected = saved; listeOuverte = false; paint();
      }, initialPos);

      const aa = view.querySelector('#addAddr');
      if (aa) aa.onclick = () => newAddr();

      const pn = view.querySelector('#pickNow');
      if (pn) pn.onclick = () => newAddr();

      // demande la permission de géolocalisation, puis ouvre la carte dessus
      const gn = view.querySelector('#geoNow');
      if (gn) gn.onclick = async function () {
        UI.busy(this, true, 'Localisation…');
        const p = await askGeolocation();
        UI.busy(this, false);
        newAddr(p);   // p peut être null : la carte s'ouvre alors sur la ville
      };

      // compléter la position d'une adresse déjà enregistrée
      const fg = view.querySelector('#fixGeo');
      if (fg) fg.onclick = async function () {
        UI.busy(this, true, 'Localisation…');
        const p = await askGeolocation();
        UI.busy(this, false);
        addressSheet(selected, saved => {
          const i = addresses.findIndex(a => a.id === saved.id);
          if (i >= 0) addresses[i] = saved;
          selected = saved; paint();
        }, p);
      };

      view.querySelector('#confirm').onclick = submit;
    }

    async function submit() {
      const btn = view.querySelector('#confirm');
      const phone = view.querySelector('#phone').value.trim();
      const note = view.querySelector('#note').value.trim();

      if (!selected) return UI.err('Adresse manquante', 'Ajoutez une adresse de livraison.');
      if (!U.isPhoneDZ(phone)) return UI.err('Numéro invalide', 'Format : 05 / 06 / 07 xx xx xx xx');

      const liv = Store.deliveryFor(selected);
      if (liv.horsZone)
        return UI.err('Adresse trop éloignée',
          'Environ ' + liv.km + ' km depuis le restaurant. Nous livrons jusqu’à ' +
          ((Store.settings && Store.settings.max_km) || 15) + ' km.');

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
            menu_item_id: l.menu_item_id, quantity: l.quantity,
            options: l.options || [], variant: l.variant || null
          }))
        });
        Store.clearCart();
        Shell.renderNav();
        // la commande est réellement enregistrée : on peut l'annoncer
        if (w.Sound) Sound.play('ordered', 1);
        UI.ok('Commande envoyée !', 'Numéro #' + order.code);
        Router.go('/order/' + order.id, true);
      } catch (e) {
        UI.busy(btn, false);
        UI.err(e.message);
      }
    }

    paint();

    return () => UI.nuit('');
  }, { auth: true, roles: ['client'] });

  /* ======================================================================
     Formulaire d'adresse (réutilisé dans le compte client)
     La position sur la carte est l'élément central : c'est elle qui permet
     au livreur d'ouvrir directement l'itinéraire dans Google Maps.
     ====================================================================== */
  /**
   * Demande la position au navigateur (déclenche « Autoriser la localisation »).
   * Renvoie {lat,lng} ou null — un refus n'est pas une erreur bloquante :
   * on retombe simplement sur le placement manuel du repère.
   */
  function askGeolocation() {
    return new Promise(resolve => {
      if (!navigator.geolocation) {
        UI.err('Géolocalisation indisponible', 'Placez le repère à la main sur la carte.');
        return resolve(null);
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) }),
        err => {
          UI.err(
            err.code === 1 ? 'Localisation refusée' : 'Position introuvable',
            err.code === 1
              ? 'Autorisez-la dans le navigateur, ou placez le repère à la main.'
              : 'Placez le repère à la main sur la carte.'
          );
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    });
  }

  function addressSheet(existing, onSaved, initialPos) {
    const a = existing || {};
    let pos = initialPos || (U.hasCoords(a) ? { lat: +a.lat, lng: +a.lng } : null);

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
                UI.icon('pin', 17) + ' Choisir ma position sur la carte</button>' +
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

    // nouvelle adresse, ou position tout juste captée : on ouvre la carte
    // immédiatement pour que l'utilisateur confirme le point exact
    if (!existing || initialPos) setTimeout(() => {
      const b = m.el.querySelector('#pick');
      if (b) b.click();
    }, 380);
  }

  w.addressSheet = addressSheet;
  w.askGeolocation = askGeolocation;
})(window);
