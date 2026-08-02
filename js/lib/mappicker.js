/* ==========================================================================
   SÉLECTEUR DE POSITION SUR CARTE — Google Maps
   --------------------------------------------------------------------------
   • Carte, recherche d'adresse et adresse inverse : Google Maps
   • Bouton « Ma position » via le GPS du téléphone (navigator.geolocation)
   • Navigation du livreur : liens Google Maps (aucune clé requise pour ça)

   LA CLÉ
   La clé vit dans config.js (GOOGLE_MAPS_KEY) et part donc dans le navigateur
   de chaque visiteur — c'est inévitable, une carte s'affiche côté client. Elle
   DOIT être restreinte à talabi.shop dans la console Google Cloud, sinon
   n'importe qui peut la reprendre et faire tourner son propre site à vos
   frais. La restriction, pas le secret, est la seule protection réelle.

   CHARGEMENT À LA DEMANDE
   Le script Google n'est téléchargé qu'à la première carte affichée. Un client
   qui parcourt les menus sans jamais ouvrir de carte ne paie ni le temps de
   chargement, ni l'appel facturé.

   SANS CLÉ, OU SANS RÉSEAU
   Tout continue de fonctionner en mode dégradé : on peut enregistrer sa
   position par le GPS, sans voir la carte. Une adresse sans carte vaut mieux
   qu'un écran bloqué.
   ========================================================================== */
(function (w) {
  'use strict';

  // Centre de la ville de Tizi Ouzou
  const CITY = { lat: 36.7118, lng: 4.0458 };

  let promesse = null;

  /** Charge l'API Google Maps une seule fois. Résout false si c'est impossible. */
  function chargerGoogle() {
    if (w.google && w.google.maps && w.google.maps.Map) return Promise.resolve(true);
    if (promesse) return promesse;

    const cle = (w.TALABI_CONFIG && w.TALABI_CONFIG.GOOGLE_MAPS_KEY) || '';
    if (!cle) return Promise.resolve(false);

    promesse = new Promise(resolve => {
      const fini = ok => { clearTimeout(minuteur); resolve(ok); };
      // au-delà de 12 s, on considère que la carte ne viendra pas : le mode
      // dégradé vaut mieux qu'une attente sans fin
      const minuteur = setTimeout(() => fini(false), 12000);

      w.__talabiMapsPret = () => fini(true);
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://maps.googleapis.com/maps/api/js' +
              '?key=' + encodeURIComponent(cle) +
              '&language=fr&region=DZ&loading=async&callback=__talabiMapsPret';
      s.onerror = () => fini(false);
      document.head.appendChild(s);
    });
    return promesse;
  }

  /* Style sobre : la carte sert à repérer une porte, pas à découvrir la ville.
     On efface les points d'intérêt commerciaux, qui encombrent le centre. */
  const STYLE = [
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] }
  ];

  const OPTIONS = {
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: 'greedy',   // un doigt suffit à déplacer la carte
    clickableIcons: false,
    styles: STYLE
  };

  const MapPicker = {

    /** Une carte peut-elle s'afficher ? (la clé est-elle renseignée) */
    get available() {
      return !!((w.google && w.google.maps) ||
                (w.TALABI_CONFIG && w.TALABI_CONFIG.GOOGLE_MAPS_KEY));
    },

    /**
     * MapPicker.open({ lat, lng, title, onPick })
     * onPick reçoit { lat, lng, address }
     */
    async open(opts) {
      const o = opts || {};
      let lat = U.hasCoords(o) ? +o.lat : CITY.lat;
      let lng = U.hasCoords(o) ? +o.lng : CITY.lng;
      let label = '';

      if (!(await chargerGoogle())) return fallback(o);

      const sheet = UI.sheet({
        title: o.title || 'Choisir la position',
        body:
          '<div class="mp-search search">' +
            '<input class="input" id="mpq" autocomplete="off" ' +
              'placeholder="Rue, repère, ou coordonnées Google Maps…">' +
          '</div>' +
          '<div class="tiny" style="margin:-2px 0 8px">💡 Astuce : dans Google Maps, appuie longuement sur le ' +
            'lieu, copie les coordonnées (ex. <b>36.7132, 4.0438</b>) et colle-les ici.</div>' +
          '<div id="mpres" class="mp-results"></div>' +

          '<div class="mp-map">' +
            '<div id="mpmap"></div>' +
            '<div class="mp-pin">' + UI.icon('pin', 38) + '</div>' +
            '<button type="button" class="mp-loc" id="mploc" title="Ma position">🎯</button>' +
          '</div>' +

          '<div class="mp-hint">Déplacez la carte pour placer le repère sur votre porte exacte.</div>' +
          '<div class="mp-addr" id="mpaddr"><span class="spinner dark"></span> Localisation…</div>',

        footer:
          '<button class="btn btn-primary btn-block btn-lg" id="mpok">✅ Confirmer cette position</button>',

        onMount(el, api) {
          const map = new google.maps.Map(el.querySelector('#mpmap'), Object.assign({}, OPTIONS, {
            center: { lat: lat, lng: lng },
            zoom: U.hasCoords(o) ? 17 : 14
          }));

          const geocodeur = new google.maps.Geocoder();
          const addrBox = el.querySelector('#mpaddr');
          const resBox = el.querySelector('#mpres');
          const pin = el.querySelector('.mp-pin');

          /* ------------------------------------------- adresse du centre */
          const refresh = U.debounce(async () => {
            const c = map.getCenter();
            lat = +c.lat().toFixed(6); lng = +c.lng().toFixed(6);
            addrBox.innerHTML = '<span class="spinner dark"></span> Recherche de l’adresse…';
            label = await inverse(geocodeur, lat, lng);
            addrBox.innerHTML = label
              ? '<b>' + UI.pin(16) + ' ' + U.esc(label) + '</b>'
              : '<b>' + UI.pin(16) + ' Position sélectionnée</b>' +
                '<div class="tiny">' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '</div>';
          }, 550);

          map.addListener('dragstart', () => pin.classList.add('moving'));
          map.addListener('idle', () => { pin.classList.remove('moving'); refresh(); });
          refresh();

          /* --------------------------------------------- ma position GPS */
          el.querySelector('#mploc').onclick = function () {
            if (!navigator.geolocation)
              return UI.err('GPS indisponible', 'Votre navigateur ne gère pas la géolocalisation.');
            const btn = this;
            btn.innerHTML = '<span class="spinner dark"></span>';
            navigator.geolocation.getCurrentPosition(
              pos => {
                btn.innerHTML = '🎯';
                map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                map.setZoom(18);
                UI.ok('Position trouvée', 'Ajustez le repère si besoin');
              },
              err => {
                btn.innerHTML = '🎯';
                UI.err('Position introuvable', geoError(err));
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
            );
          };

          /* ----------------------------------------------- recherche */
          const q = el.querySelector('#mpq');
          q.oninput = U.debounce(async () => {
            const term = q.value.trim();
            if (term.length < 3) { resBox.innerHTML = ''; return; }

            // coordonnées ou lien Google Maps collés : on y va directement
            const c = parseCoords(term);
            if (c) {
              map.setCenter({ lat: c.lat, lng: c.lng });
              map.setZoom(18);
              resBox.innerHTML = '';
              q.value = '';
              UI.ok('Position appliquée', c.lat.toFixed(5) + ', ' + c.lng.toFixed(5));
              return;
            }

            const list = await chercher(geocodeur, term);
            if (!list.length) {
              resBox.innerHTML = '<div class="mp-item tiny">Aucun résultat</div>';
              return;
            }
            resBox.innerHTML = list.map((r, i) =>
              '<div class="mp-item" data-r="' + i + '">' + UI.pin() + ' ' + U.esc(r.adresse) + '</div>').join('');
            resBox.querySelectorAll('[data-r]').forEach(item => item.onclick = () => {
              const r = list[+item.dataset.r];
              map.setCenter({ lat: r.lat, lng: r.lng });
              map.setZoom(17);
              resBox.innerHTML = '';
              q.value = '';
            });
          }, 500);

          /* ------------------------------------------------- validation */
          el.querySelector('#mpok').onclick = function () {
            UI.busy(this, true);
            api.close();
            o.onPick && o.onPick({ lat: lat, lng: lng, address: label });
          };
        }
      });

      return sheet;
    },

    /**
     * Carte de suivi : restaurant, client et livreur sur la même vue.
     * MapPicker.live(el, { restaurant:{lat,lng}, client:{lat,lng}, driver:{lat,lng} })
     * Retourne { update(points), recenter(), destroy() } — les repères bougent
     * sans recréer la carte, ce qui évite le clignotement à chaque
     * rafraîchissement.
     *
     * L'objet est rendu tout de suite, avant même que Google ait répondu : les
     * appels reçus entre-temps sont gardés et appliqués à l'ouverture.
     */
    live(container, points, opts) {
      if (!container) return null;

      /* fige : la carte ne réagit plus au doigt. Indispensable dans une page
         qui défile — sinon, sur téléphone, le doigt posé sur la carte fait
         glisser la carte au lieu de faire défiler la page, et l'utilisateur
         se retrouve coincé devant un plan qui s'échappe. Elle reste vivante :
         les repères bougent, la vue suit. */
      const fige = !!(opts && opts.fige);

      let map = null, markers = {}, attendus = points, premier = true, mort = false;

      const defs = {
        restaurant: ['🏪', 'lm-resto', 'Restaurant'],
        client:     ['🏠', 'lm-client', 'Vous'],
        driver:     ['🛵', 'lm-driver', 'Livreur']
      };

      function appliquer(pts) {
        if (!map) return;
        const bounds = new google.maps.LatLngBounds();
        let n = 0;

        Object.keys(defs).forEach(k => {
          const p = pts && pts[k];
          if (!p || !U.hasCoords(p)) {
            if (markers[k]) { markers[k].setMap(null); delete markers[k]; }
            return;
          }
          const ll = { lat: +p.lat, lng: +p.lng };
          bounds.extend(ll); n++;
          if (markers[k]) markers[k].setPosition(ll);
          else markers[k] = new google.maps.Marker({
            position: ll, map: map, title: defs[k][2],
            label: { text: defs[k][0], fontSize: '20px' },
            icon: {
              path: google.maps.SymbolPath.CIRCLE, scale: 18,
              fillColor: '#ffffff', fillOpacity: 1,
              /* la clé est « restaurant », pas « resto » : écrit ainsi, le
                 repère du restaurant prenait le bleu du client */
              strokeColor: k === 'driver' ? '#12A150' : k === 'restaurant' ? '#FF4D2D' : '#1E6BE6',
              strokeWeight: 3
            }
          });
        });

        if (!n) { map.setCenter(CITY); map.setZoom(13); return; }

        /* Carte figée avec un seul repère : la vue le suit, sinon le livreur
           qui roule sortirait du cadre sans pouvoir y revenir au doigt. */
        if (fige && n === 1 && !premier) { map.setCenter(bounds.getCenter()); return; }

        if (premier) {
          if (n > 1) { map.fitBounds(bounds, 42); }
          else { map.setCenter(bounds.getCenter()); map.setZoom(16); }
          premier = false;
        }
      }

      chargerGoogle().then(ok => {
        if (mort) return;
        if (!ok) { if (opts && opts.onEchec) opts.onEchec(); return; }
        map = new google.maps.Map(container, Object.assign({}, OPTIONS, {
          center: CITY, zoom: 13
        }, fige ? {
          gestureHandling: 'none',
          zoomControl: false,
          keyboardShortcuts: false
        } : null));
        appliquer(attendus);
      });

      return {
        update(pts) { attendus = pts; appliquer(pts); },
        /* À appeler quand le conteneur a été détaché puis rebranché dans la
           page : la carte a pu perdre ses tuiles pendant le déplacement.
           Bien moins cher qu'en recréer une — un « chargement de carte » est
           facturé, un redimensionnement non. */
        nudge() {
          if (!map) return;
          const c = map.getCenter();
          google.maps.event.trigger(map, 'resize');
          map.setCenter(c);
        },
        recenter() {
          if (!map) return;
          const b = new google.maps.LatLngBounds();
          let n = 0;
          Object.keys(markers).forEach(k => { b.extend(markers[k].getPosition()); n++; });
          if (n > 1) map.fitBounds(b, 42);
          else if (n) { map.setCenter(b.getCenter()); map.setZoom(16); }
        },
        destroy() { mort = true; Object.keys(markers).forEach(k => markers[k].setMap(null)); markers = {}; map = null; }
      };
    },

    /** Petite carte non modifiable, pour afficher une position */
    preview(container, lat, lng) {
      if (!container || !U.hasCoords({ lat: lat, lng: lng })) return null;

      chargerGoogle().then(ok => {
        if (!ok) return;
        const pos = { lat: +lat, lng: +lng };
        const map = new google.maps.Map(container, {
          center: pos, zoom: 16,
          disableDefaultUI: true, gestureHandling: 'none',
          keyboardShortcuts: false, clickableIcons: false, styles: STYLE
        });
        new google.maps.Marker({ position: pos, map: map });
      });

      return null;
    }
  };

  /* ====================================================== outils Google */

  /**
   * Reconnaît une position collée par l'utilisateur :
   *   « 36.7132, 4.0438 »
   *   https://www.google.com/maps/@36.7132,4.0438,17z
   *   https://maps.google.com/?q=36.7132,4.0438
   *   …!3d36.7132!4d4.0438…
   * Renvoie {lat,lng} ou null.
   */
  function parseCoords(text) {
    const s = String(text).trim();
    const pairs = [
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,          // lien de partage Google Maps
      /[@?&=/](-?\d{1,2}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})/,
      /^(-?\d{1,2}(?:\.\d+)?)[,;\s]+(-?\d{1,3}(?:\.\d+)?)$/
    ];
    for (const rx of pairs) {
      const m = s.match(rx);
      if (!m) continue;
      const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
      if (isFinite(lat) && isFinite(lng) &&
          lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat: lat, lng: lng };
      }
    }
    return null;
  }

  /** Coordonnées → adresse lisible */
  function inverse(geocodeur, lat, lng) {
    return new Promise(resolve => {
      geocodeur.geocode({ location: { lat: lat, lng: lng } }, (res, statut) => {
        if (statut !== 'OK' || !res || !res.length) return resolve('');
        /* Google classe du plus précis au plus large : le premier résultat est
           l'adresse de la porte. On coupe le pays et le code postal, qui
           n'apprennent rien à quelqu'un qui commande dans sa propre ville. */
        const parts = String(res[0].formatted_address).split(',')
          .map(x => x.trim())
          .filter(x => x && !/^\d{5}$/.test(x) && !/alg[ée]rie/i.test(x));
        resolve(parts.slice(0, 3).join(', '));
      });
    });
  }

  /** Texte → liste de lieux (limités à l'Algérie) */
  function chercher(geocodeur, term) {
    return new Promise(resolve => {
      geocodeur.geocode({
        address: term,
        componentRestrictions: { country: 'dz' }
      }, (res, statut) => {
        if (statut !== 'OK' || !res) return resolve([]);
        resolve(res.slice(0, 6).map(r => ({
          adresse: r.formatted_address,
          lat: r.geometry.location.lat(),
          lng: r.geometry.location.lng()
        })));
      });
    });
  }

  function geoError(err) {
    if (err.code === 1) return 'Autorisez l’accès à votre position dans le navigateur.';
    if (err.code === 2) return 'Signal GPS indisponible. Placez le repère à la main.';
    if (err.code === 3) return 'Le GPS met trop de temps à répondre. Réessayez dehors.';
    return 'Placez le repère à la main sur la carte.';
  }

  /* ------------------- secours : pas de carte (clé absente, hors ligne) */
  function fallback(o) {
    return UI.sheet({
      title: o.title || 'Choisir la position',
      body: '<div class="banner banner-warn">🗺️ La carte n’a pas pu se charger. ' +
            'Vous pouvez quand même enregistrer votre position GPS.</div>',
      footer: '<button class="btn btn-primary btn-block" id="fbgeo">' + UI.icon('pin', 17) + ' Utiliser ma position actuelle</button>',
      onMount(el, api) {
        el.querySelector('#fbgeo').onclick = function () {
          if (!navigator.geolocation) return UI.err('GPS indisponible');
          UI.busy(this, true, 'Localisation…');
          const btn = this;
          navigator.geolocation.getCurrentPosition(
            pos => {
              api.close();
              o.onPick && o.onPick({
                lat: +pos.coords.latitude.toFixed(6),
                lng: +pos.coords.longitude.toFixed(6),
                address: ''
              });
            },
            err => { UI.busy(btn, false); UI.err('Position introuvable', geoError(err)); },
            { enableHighAccuracy: true, timeout: 10000 }
          );
        };
      }
    });
  }

  MapPicker.parseCoords = parseCoords;   // exposé pour les tests

  w.MapPicker = MapPicker;
})(window);
