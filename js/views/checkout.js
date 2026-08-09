/* ==========================================================================
   VUE — Validation de la commande (adresse, téléphone, notes, confirmation)
   ========================================================================== */
(function (w) {
  'use strict';

  /* Les quatre consignes toutes prêtes. Elles ÉCRIVENT dans la note au lieu
     de la remplacer : « Laisser à la porte » et un numéro d'étage se cumulent
     très bien, et quelqu'un qui en touche deux ne doit pas perdre la première. */
  const CK_PROPS = [
    ['pin',     'Laisser à la porte'],
    ['phone',   'M’appeler en arrivant'],
    ['bell',    'Sonner'],
    ['store',   'Laisser à la réception']
  ];

  /* Une mini-carte de la course : un chiffre, ce qu'il mesure. */
  function ckMini(icone, cle, valeur) {
    return '<div class="ck-m">' +
      '<span class="ck-m-ic">' + UI.icon(icone, 18) + '</span>' +
      '<b>' + valeur + '</b>' +
      '<span>' + U.esc(cle) + '</span>' +
    '</div>';
  }

  Router.add('/checkout', async function (params, query, view) {

    if (!Store.cartCount) return Router.go('/cart', true);

    /* Thème sombre, comme le panier d'où l'on arrive. Posé avant tout appel
       réseau : sinon le crème apparaîtrait le temps du chargement des
       adresses, et un éclair blanc au moment de payer est le pire endroit
       pour en avoir un. */
    UI.nuit('commander');

    const addresses = await API.safe(() => API.addresses(), []);

    /* Le restaurant est demandé UNE FOIS, pour trois choses que le panier ne
       retient pas : sa note, son temps de préparation et sa position. C'est une
       requête de plus, mais elle remplace trois chiffres inventés — et sans
       elle, les mini-cartes afficheraient des tirets.

       `API.safe` avec `null` en repli : si l'appel échoue, l'écran s'affiche
       quand même et les trois chiffres montrent un tiret. Une commande ne doit
       pas devenir impossible parce qu'une note n'a pas pu être lue. */
    const resto = await API.safe(() => API.restaurant(Store.cart.restaurant_id), null);
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

      /* Le numéro affiché : celui de l'adresse s'il en a un, celui du profil
         sinon. Et sa validité, qui ne mesure que le FORMAT. */
      const telInitial = (selected && selected.phone) || Store.profile.phone || '';
      const telOk = U.isPhoneDZ(telInitial);

      view.innerHTML = '<div class="account-page prem ck">' +
        '<div class="wrap-sm page">' +

        /* ---- l'en-tête commune aux écrans premium ---- */
        '<header class="prem-tete">' +
          '<button class="prem-retour" id="ckBack" aria-label="Retour">' +
            UI.icon('chevron', 19) + '</button>' +
          '<span class="prem-vignette" aria-hidden="true">' + UI.icon('scooter', 25) + '</span>' +
          '<div class="prem-tete-txt">' +
            '<h1 class="prem-h1">Où livrer ?</h1>' +
            '<p class="prem-sub">Dernière étape avant votre commande</p>' +
          '</div>' +
        '</header>' +

        /* ---- LA POSITION D'ABORD : le plan, puis l'adresse ----
           Une adresse écrite se vérifie mal ; un repère sur un plan se vérifie
           d'un coup d'œil. C'est pour ça que la carte passe devant. */
        '<div class="ck-lieu">' +
          (selected && U.hasCoords(selected)
            ? '<div class="ck-map" id="ckMap"></div>'
            : '<div class="ck-map vide">' + UI.icon('pin', 30) +
              '<span>Aucune position sur cette adresse</span></div>') +

          (addresses.length
            ? '<div class="ck-adr">' +
                '<span class="ck-adr-ic">' + UI.icon('pin', 20) + '</span>' +
                '<div class="ck-adr-txt">' +
                  '<b>' + U.esc((selected && selected.label) || 'Adresse') + '</b>' +
                  '<span>' + U.esc((selected && selected.street) || '') +
                    (selected && selected.details ? ' — ' + U.esc(selected.details) : '') + '</span>' +
                '</div>' +
                '<button type="button" class="ck-changer" id="ckChanger">' +
                  (listeOuverte ? 'Fermer' : 'Modifier') + '</button>' +
              '</div>' +
              (listeOuverte
                ? '<div class="ck-liste" id="addrList">' +
                    addresses.map(addrRow).join('') +
                    '<button type="button" class="ck-ajout" id="addAddr">' +
                      UI.icon('plus', 16) + ' Nouvelle adresse</button>' +
                  '</div>'
                : '')
            : '<div class="ck-vide">' +
                '<b>Où doit-on vous livrer ?</b>' +
                '<p>Activez votre localisation : le livreur saura exactement où vous ' +
                  'trouver et ouvrira l’itinéraire dans Google Maps.</p>' +
                '<button type="button" class="prem-go" id="geoNow">' +
                  UI.icon('navigation', 19) + ' Activer ma localisation</button>' +
                '<button type="button" class="prem-go2" id="pickNow">' +
                  'Ou placer le repère à la main</button>' +
              '</div>') +
        '</div>' +

        /* ---- position manquante sur l'adresse choisie ---- */
        (selected && !U.hasCoords(selected)
          ? '<div class="ck-avert">' +
              '<span class="ck-avert-ic">' + UI.icon('warn', 21) + '</span>' +
              '<div class="ck-avert-txt"><b>Adresse sans position</b>' +
                '<span>Le livreur risque de vous chercher. Une position, et il ' +
                  'ouvre l’itinéraire directement.</span></div>' +
              '<button type="button" class="ck-avert-b" id="fixGeo">Activer</button>' +
            '</div>'
          : '') +

        /* ---- HORS ZONE ----
           Deux issues réelles, pas un message qui laisse sans rien faire :
           changer d'adresse, ou aller voir des restaurants plus proches. */
        (liv.horsZone
          ? '<div class="ck-hors">' +
              '<span class="ck-hors-ic">' + UI.icon('scooter', 24) + '</span>' +
              '<div class="ck-hors-t">Hors zone de livraison</div>' +
              '<p class="ck-hors-s">Cette adresse est à environ <b>' + liv.km +
                ' km</b> du restaurant, au-delà des ' +
                U.esc(String((Store.settings && Store.settings.max_km) || 15)) +
                ' km que nous couvrons aujourd’hui.</p>' +
              '<div class="ck-hors-b">' +
                '<button type="button" class="ck-hors-a" id="ckAutre">' +
                  UI.icon('pin', 17) + ' Choisir une autre adresse</button>' +
                '<a class="ck-hors-a" href="#/restaurants">' +
                  UI.icon('utensils', 17) + ' Restaurants plus proches</a>' +
              '</div>' +
            '</div>'
          : '') +

        /* ---- TROIS CHIFFRES DE LA COURSE ----
           Le temps vient de `U.deliveryFor`, la même fonction que l'écran
           Commandes : deux calculs séparés finiraient par annoncer deux durées
           différentes pour la même course. La préparation du restaurant s'y
           ajoute — ce qu'attend le client, c'est son repas, pas le scooter. */
        '<div class="ck-mini">' +
          ckMini('clock', 'Livraison estimée',
            (liv.minutes != null
              ? '~ ' + (liv.minutes + (resto && +resto.prep_time_min ? +resto.prep_time_min : 0)) + ' min'
              : '—')) +
          ckMini('navigation', 'Distance', liv.km != null ? liv.km + ' km' : '—') +
          ckMini('medal', 'Note du resto',
            (resto && +resto.rating) ? (+resto.rating).toFixed(1) + ' / 5' : '—') +
        '</div>' +

        /* ---- AIDER LE LIVREUR À VOUS TROUVER ----
           « Note pour le livreur » décrivait le champ ; ce titre-là dit à quoi il
           sert. Et les quatre propositions donnent une réponse à écrire, au lieu
           d'un rectangle vide devant lequel on ne trouve rien à dire. */
        '<div class="ck-carte">' +
          '<div class="ck-t">' + UI.icon('navigation', 18) +
            ' Aider le livreur à vous trouver</div>' +
          '<textarea class="prem-input ck-note" id="note" rows="3" ' +
            'placeholder="Appartement, étage, porte, interphone…"></textarea>' +
          '<div class="ck-props">' +
            CK_PROPS.map(p =>
              '<button type="button" class="ck-prop" data-prop="' + U.esc(p[1]) + '">' +
                UI.icon(p[0], 15) + ' ' + U.esc(p[1]) + '</button>').join('') +
          '</div>' +
        '</div>' +

        /* ---- le numéro ----
           L'indicateur dit « valide », pas « vérifié ». Il ne teste que le
           FORMAT : Talabi n'envoie aucun code SMS, et écrire « vérifié » sous un
           numéro que personne n'a confirmé est un mensonge affiché en vert. */
        '<div class="ck-carte">' +
          '<div class="ck-t">' + UI.icon('phone', 18) + ' Votre numéro</div>' +
          '<div class="prem-champ">' +
            '<div class="prem-boite">' +
              '<span class="prem-ic">' + UI.icon('phone', 18) + '</span>' +
              '<input class="prem-input" id="phone" inputmode="tel" ' +
                'placeholder="0X XX XX XX XX" value="' +
                U.esc(telInitial) + '">' +
            '</div>' +
            '<span class="prem-aide' + (telOk ? ' ok' : '') + '" id="ckTelAide">' +
              (verrou.bloque
                ? 'Modifiable dans ' + verrou.jours + ' jour' + (verrou.jours > 1 ? 's' : '') +
                  ' — le livreur vous appellera dessus'
                : telOk ? 'Le livreur vous appellera sur ce numéro'
                        : 'Numéro algérien : 0X XX XX XX XX') + '</span>' +
          '</div>' +
        '</div>' +

        /* ---- PAIEMENT ----
           Les espèces sont le seul moyen en service. La carte est montrée ÉTEINTE
           plutôt que cachée : un client qui ne la voit pas se demande si Talabi la
           prend un jour ; en la voyant marquée « bientôt », il sait à quoi s'en
           tenir. Rien sur un portefeuille Talabi, en revanche — il n'existe ni
           dans le code ni dans les projets. */
        '<div class="ck-carte">' +
          '<div class="ck-t">' + UI.icon('wallet', 18) + ' Mode de paiement</div>' +
          '<div class="ck-pay on">' +
            '<span class="ck-pay-ic">' + UI.icon('wallet', 20) + '</span>' +
            '<div class="ck-pay-txt"><b>Espèces à la réception</b>' +
              '<span>Vous payez le livreur à la remise du repas</span></div>' +
            '<span class="ck-pay-c">' + UI.icon('check', 15) + '</span>' +
          '</div>' +
          '<div class="ck-pay off">' +
            '<span class="ck-pay-ic">' + UI.icon('receipt', 20) + '</span>' +
            '<div class="ck-pay-txt"><b>Carte CIB / Edahabia</b>' +
              '<span>Paiement en ligne par SATIM</span></div>' +
            '<span class="ck-bientot">Bientôt</span>' +
          '</div>' +
        '</div>' +

        /* ---- le compte, ligne à ligne ---- */
        '<div class="ck-carte ck-recap">' +
          '<div class="ck-t">' + UI.icon('receipt', 18) + ' Récapitulatif</div>' +
          Store.cart.items.map(l =>
            '<div class="ck-ligne">' +
              '<span class="q">' + l.quantity + '×</span>' +
              '<span class="n">' + U.esc(l.name) +
                (l.variant ? ' <span class="ck-var">' + U.esc(l.variant.name) + '</span>' : '') +
                ((l.options && l.options.length)
                  ? '<span class="o">+ ' + U.esc(l.options.map(o => o.name).join(', ')) + '</span>' : '') +
              '</span>' +
              '<span class="p">' + U.money(Store.lineTotal(l)) + '</span>' +
            '</div>').join('') +
          '<div class="ck-trait"></div>' +
          '<div class="ck-som"><span>' + Store.cartCount + ' article' +
            (Store.cartCount > 1 ? 's' : '') + '</span><span>' + U.money(t.subtotal) + '</span></div>' +
          '<div class="ck-som"><span>Frais de livraison' +
            (liv.km != null ? ' · ' + liv.km + ' km' : '') + '</span><span>' +
            U.money(t.delivery_fee) + '</span></div>' +
          '<div class="ck-trait"></div>' +
          '<div class="ck-som total"><span>Total à payer</span>' +
            '<b>' + U.money(t.total) + '</b></div>' +
        '</div>' +

        /* ---- LA BARRE DU BAS : le geste, toujours à portée de pouce ----
           Le bouton était en bas du document : sur un long écran, il fallait
           faire défiler tout le récapitulatif pour l'atteindre. Il ne bouge plus,
           et le délai de réponse du restaurant est annoncé juste au-dessus —
           c'est la question qu'on se pose avant d'appuyer. */
        '<div class="ck-bas">' +
          '<div class="ck-delai">' + UI.icon('clock', 14) + ' ' +
            U.esc(Store.cart.restaurant_name || 'Le restaurant') +
            ' répond sous ' + U.respondMinutes(Store.settings) + ' minutes</div>' +
          '<button class="ck-cta" id="confirm"' + (liv.horsZone ? ' disabled' : '') + '>' +
            (liv.horsZone
              ? 'Adresse hors zone de livraison'
              : '<span>Confirmer la commande</span>' +
                '<span class="ck-cta-m">' + U.money(t.total) + '</span>') +
          '</button>' +
        '</div>' +

      '</div></div>';

      /* La vraie carte du projet, pas une esquisse : c'est le même
         MapPicker.preview que partout ailleurs, sur la position choisie. */
      /* La vraie carte du projet, avec deux repères et la zone couverte : on
         voit d'un coup si l'on est dedans, ce qu'un nombre de kilomètres ne
         montre pas. Le vol d'approche dit où l'on se trouve dans la ville avant
         de resserrer sur la rue — un plan qui s'ouvre déjà zoomé ne montre que
         du bitume. */
      const mp = view.querySelector('#ckMap');
      if (mp && selected) MapPicker.preview(mp, selected.lat, selected.lng, {
        resto: (Store.cart.lat != null && Store.cart.lng != null)
          ? { lat: Store.cart.lat, lng: Store.cart.lng,
              nom: Store.cart.restaurant_name || '' } : null,
        rayonKm: (Store.settings && +Store.settings.max_km) || 15,
        zoom: 15, vol: true
      });

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

      /* Hors zone : « choisir une autre adresse » ouvre la liste au lieu de
         renvoyer ailleurs. C'est le geste que la personne veut faire. */
      const au = view.querySelector('#ckAutre');
      if (au) au.onclick = () => { listeOuverte = true; paint(); };

      /* La validité du numéro se relit à la frappe : on voit qu'on s'est trompé
         d'un chiffre avant d'appuyer sur Confirmer, pas après. */
      const tel = view.querySelector('#phone');
      const telAide = view.querySelector('#ckTelAide');
      if (tel && telAide && !verrou.bloque) tel.oninput = () => {
        const bon = U.isPhoneDZ(tel.value);
        telAide.textContent = bon ? 'Le livreur vous appellera sur ce numéro'
          : tel.value ? 'Ce numéro ne ressemble pas à un numéro algérien'
          : 'Numéro algérien : 0X XX XX XX XX';
        telAide.className = 'prem-aide' + (bon ? ' ok' : tel.value ? ' non' : '');
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
