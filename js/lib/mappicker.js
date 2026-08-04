/* ==========================================================================
   SÉLECTEUR DE POSITION SUR CARTE — OpenStreetMap
   --------------------------------------------------------------------------
   • Carte OpenStreetMap via Leaflet — gratuit, aucune clé, aucun compte
   • Bouton « Ma position » via le GPS du téléphone (navigator.geolocation)
   • Recherche et adresse inverse via Nominatim (OpenStreetMap)
   • Navigation du livreur : liens Google Maps, qui ouvrent l'application du
     téléphone et ne demandent aucune clé

   POURQUOI PAS GOOGLE
   Google Maps exige une carte bancaire liée au projet, même pour rester dans
   le quota gratuit. En Algérie, l'ajout de carte échoue régulièrement
   (OR_BACR2_44), et la carte cesse alors de s'afficher du jour au lendemain
   sans que rien n'ait changé dans le code. Pour ce que la plateforme demande
   à une carte — montrer un plan, poser trois repères, suivre un livreur —
   OpenStreetMap fait le même travail sans compte à maintenir ni facture
   possible. Ce qu'on perd : un rendu un peu moins soigné, et une recherche
   d'adresse par texte moins fine sur les adresses algériennes.

   CHARGEMENT À LA DEMANDE
   Leaflet n'est téléchargé qu'à la première carte affichée. Un client qui
   parcourt les menus sans jamais ouvrir de carte ne paie pas ce temps de
   chargement.

   SANS RÉSEAU
   Tout continue en mode dégradé : on peut enregistrer sa position par le GPS,
   sans voir la carte. Une adresse sans carte vaut mieux qu'un écran bloqué.
   ========================================================================== */
(function (w) {
  'use strict';

  // Centre de la ville de Tizi Ouzou
  const CITY = { lat: 36.7118, lng: 4.0458 };
  const NOMINATIM = 'https://nominatim.openstreetmap.org';

  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

  const TUILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  // La licence OpenStreetMap impose de citer la source sur toute carte
  // affichée. Ce n'est pas décoratif : c'est la contrepartie du service.
  const CREDIT = '© OpenStreetMap';

  let promesse = null;

  /** Charge Leaflet une seule fois. Résout false si c'est impossible. */
  function chargerLeaflet() {
    if (w.L && w.L.map) return Promise.resolve(true);
    if (promesse) return promesse;

    promesse = new Promise(resolve => {
      const fini = ok => { clearTimeout(minuteur); resolve(ok); };
      // au-delà de 12 s, on considère que la carte ne viendra pas : le mode
      // dégradé vaut mieux qu'une attente sans fin
      const minuteur = setTimeout(() => fini(false), 12000);

      if (!document.querySelector('link[data-leaflet]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = LEAFLET_CSS;
        css.setAttribute('data-leaflet', '');
        document.head.appendChild(css);
      }

      const s = document.createElement('script');
      s.src = LEAFLET_JS;
      s.async = true;
      s.onload  = () => fini(!!(w.L && w.L.map));
      s.onerror = () => fini(false);
      document.head.appendChild(s);
    });
    return promesse;
  }

  const MapPicker = {

    /** Une carte peut-elle s'afficher ? OpenStreetMap ne demande pas de clé :
        seule la connexion peut manquer, et on ne le sait qu'en essayant. */
    get available() { return true; },

    /**
     * MapPicker.open({ lat, lng, title, onPick })
     * onPick reçoit { lat, lng, address }
     */
    async open(opts) {
      const o = opts || {};
      let lat = U.hasCoords(o) ? +o.lat : CITY.lat;
      let lng = U.hasCoords(o) ? +o.lng : CITY.lng;
      let label = '';

      if (!(await chargerLeaflet())) return fallback(o);

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
          const map = L.map(el.querySelector('#mpmap'), {
            zoomControl: true, attributionControl: true
          }).setView([lat, lng], U.hasCoords(o) ? 17 : 14);

          L.tileLayer(TUILES, { maxZoom: 19, attribution: CREDIT }).addTo(map);

          // la carte naît dans un panneau qui glisse : elle doit se remesurer
          // une fois l'animation terminée, sinon elle reste grise à moitié
          setTimeout(() => map.invalidateSize(), 320);

          const addrBox = el.querySelector('#mpaddr');
          const resBox = el.querySelector('#mpres');
          const pin = el.querySelector('.mp-pin');

          /* ------------------------------------------- adresse du centre */
          const refresh = U.debounce(async () => {
            const c = map.getCenter();
            lat = +c.lat.toFixed(6); lng = +c.lng.toFixed(6);
            addrBox.innerHTML = '<span class="spinner dark"></span> Recherche de l’adresse…';
            label = await inverse(lat, lng);
            addrBox.innerHTML = label
              ? '<b>' + UI.pin(16) + ' ' + U.esc(label) + '</b>'
              : '<b>' + UI.pin(16) + ' Position sélectionnée</b>' +
                '<div class="tiny">' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '</div>';
          }, 550);

          map.on('move', () => pin.classList.add('moving'));
          map.on('moveend', () => { pin.classList.remove('moving'); refresh(); });
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
                map.setView([pos.coords.latitude, pos.coords.longitude], 18);
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
              map.setView([c.lat, c.lng], 18);
              resBox.innerHTML = '';
              q.value = '';
              UI.ok('Position appliquée', c.lat.toFixed(5) + ', ' + c.lng.toFixed(5));
              return;
            }

            const list = await chercher(term);
            if (!list.length) {
              resBox.innerHTML = '<div class="mp-item tiny">Aucun résultat</div>';
              return;
            }
            resBox.innerHTML = list.map((r, i) =>
              '<div class="mp-item" data-r="' + i + '">' + UI.pin() + ' ' + U.esc(r.adresse) + '</div>').join('');
            resBox.querySelectorAll('[data-r]').forEach(item => item.onclick = () => {
              const r = list[+item.dataset.r];
              map.setView([r.lat, r.lng], 17);
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
     * MapPicker.live(el, points, { fige, onEchec })
     *
     *   fige     la carte ne réagit plus au doigt — indispensable dans une
     *            page qui défile, sinon le doigt posé dessus fait glisser la
     *            carte au lieu de la page
     *   onEchec  appelé si la carte ne peut pas s'afficher, avec la raison
     *
     * Retourne { update(points), recenter(), nudge(), destroy() } : les
     * repères bougent sans recréer la carte, ce qui évite le clignotement à
     * chaque rafraîchissement.
     *
     * L'objet est rendu tout de suite, avant même que Leaflet soit chargé :
     * les appels reçus entre-temps sont gardés et appliqués à l'ouverture.
     */
    live(container, points, opts) {
      if (!container) return null;

      const fige = !!(opts && opts.fige);
      /* `suit` : la vue se recadre à CHAQUE position reçue, au lieu de se
         régler une fois pour toutes. C'est ce qui distingue une carte de
         suivi d'une carte de situation — le livreur roule, et sans ça il
         sort du cadre au bout de trois rues. */
      const suit = !!(opts && opts.suit);
      /* `marges` : où la carte est réellement visible. En plein écran, une
         feuille couvre le bas et une barre le haut ; centrer sur la zone
         entière plaçait le livreur sous la feuille, donc invisible. La valeur
         est demandée à chaque cadrage, parce que la hauteur de la feuille
         change avec son contenu. */
      const marges = (opts && opts.marges) || null;
      const cadre = ecart => {
        const m = typeof marges === 'function' ? marges() : marges;
        return Object.assign({ maxZoom: 16 }, m
          ? { paddingTopLeft: m.tl, paddingBottomRight: m.br }
          : { padding: [ecart, ecart] });
      };

      let map = null, markers = {}, attendus = points, premier = true, mort = false;
      let trace = null;
      /* Dès que le doigt déplace la carte, on arrête de la recadrer : quelqu'un
         qui regarde le quartier d'à côté ne veut pas être ramené de force
         toutes les quinze secondes. Le bouton de recentrage rend la main. */
      let libre = false;

      const defs = {
        restaurant: ['🏪', 'lm-resto', 'Restaurant'],
        client:     ['🏠', 'lm-client', 'Vous'],
        driver:     ['🛵', 'lm-driver', 'Livreur']
      };

      const repere = (emoji, cls) => L.divIcon({
        className: '', iconSize: [38, 38], iconAnchor: [19, 19],
        html: '<div class="lm-pin ' + (cls || '') + '">' + emoji + '</div>'
      });

      function appliquer(pts) {
        if (!map) return;
        const bornes = [];

        Object.keys(defs).forEach(k => {
          const p = pts && pts[k];
          if (!p || !U.hasCoords(p)) {
            if (markers[k]) { map.removeLayer(markers[k]); delete markers[k]; }
            return;
          }
          const ll = [+p.lat, +p.lng];
          bornes.push(ll);
          if (markers[k]) markers[k].setLatLng(ll);
          else markers[k] = L.marker(ll, {
            icon: repere(defs[k][0], defs[k][1]), title: defs[k][2]
          }).addTo(map);
        });

        /* Le chemin parcouru : un trait pointillé qui relie les repères dans
           l'ordre où on les visite. À vol d'oiseau, faute d'un service
           d'itinéraire — il ne prétend pas dire par où passer, seulement dans
           quel sens ça va. C'est ce qui fait lire « il monte vers le
           restaurant » plutôt que « trois épingles sur une carte ». */
        const chemin = (pts && pts.chemin || []).map(k => markers[k])
          .filter(Boolean).map(m => m.getLatLng());
        if (chemin.length > 1) {
          if (trace) trace.setLatLngs(chemin);
          else trace = L.polyline(chemin, {
            color: '#FF4D2D', weight: 4, opacity: .75,
            dashArray: '2 9', lineCap: 'round'
          }).addTo(map);
        } else if (trace) { map.removeLayer(trace); trace = null; }

        if (!bornes.length) { map.setView([CITY.lat, CITY.lng], 13); return; }

        /* Carte figée avec un seul repère : la vue le suit, sinon le livreur
           qui roule sortirait du cadre sans pouvoir y revenir au doigt. */
        if (fige && bornes.length === 1 && !premier) { map.setView(bornes[0]); return; }

        if (premier) {
          if (bornes.length > 1) map.fitBounds(bornes, cadre(42));
          else map.setView(bornes[0], 16);
          premier = false;
          return;
        }

        /* Suivi : on garde tout le monde dans le cadre à chaque relevé. Le
           déplacement est animé — un saut sec à chaque position donne
           l'impression que la carte se recharge. */
        if (suit && !libre) {
          if (bornes.length > 1)
            map.flyToBounds(bornes, Object.assign(cadre(56), { duration: .8 }));
          else map.panTo(bornes[0], { animate: true, duration: .8 });
        }
      }

      chargerLeaflet().then(ok => {
        if (mort) return;
        if (!ok) {
          if (opts && opts.onEchec)
            opts.onEchec('La carte n’a pas pu être téléchargée — vérifiez votre connexion.');
          return;
        }
        map = L.map(container, Object.assign({
          zoomControl: true, attributionControl: true
        }, fige ? {
          dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
          touchZoom: false, boxZoom: false, keyboard: false,
          zoomControl: false, tap: false
        } : null));

        L.tileLayer(TUILES, { maxZoom: 19, attribution: CREDIT }).addTo(map);
        /* Le doigt reprend la main : à partir de là, la carte ne se recadre
           plus toute seule. */
        if (suit) map.on('dragstart', () => { libre = true; });
        appliquer(attendus);
        setTimeout(() => map.invalidateSize(), 260);
      });

      return {
        update(pts) { attendus = pts; appliquer(pts); },
        /* À appeler quand le conteneur a changé de taille ou est redevenu
           visible : Leaflet mesure une fois et ne s'en aperçoit pas seul. */
        nudge() { if (map) map.invalidateSize(); },
        recenter() {
          if (!map) return;
          libre = false;                 // le suivi automatique reprend
          const b = Object.keys(markers).map(k => markers[k].getLatLng());
          if (b.length > 1) map.fitBounds(b, cadre(42));
          else if (b.length) map.setView(b[0], 16);
        },
        destroy() {
          mort = true;
          try { if (map) map.remove(); } catch (e) {}
          markers = {}; map = null; trace = null;
        }
      };
    },

    /** Petite carte non modifiable, pour afficher une position */
    preview(container, lat, lng) {
      if (!container || !U.hasCoords({ lat: lat, lng: lng })) return null;

      chargerLeaflet().then(ok => {
        if (!ok) return;
        const map = L.map(container, {
          zoomControl: false, dragging: false, scrollWheelZoom: false,
          doubleClickZoom: false, touchZoom: false, keyboard: false,
          attributionControl: true
        }).setView([+lat, +lng], 16);
        L.tileLayer(TUILES, { maxZoom: 19, attribution: CREDIT }).addTo(map);
        L.marker([+lat, +lng]).addTo(map);
        setTimeout(() => map.invalidateSize(), 250);
      });

      return null;
    }
  };

  /* ==================================================== OpenStreetMap */

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
  async function inverse(lat, lng) {
    try {
      const r = await fetch(NOMINATIM + '/reverse?format=jsonv2&zoom=18&accept-language=fr' +
        '&lat=' + lat + '&lon=' + lng);
      if (!r.ok) return '';
      const j = await r.json();
      const a = j.address || {};
      /* On garde la rue, le quartier et la ville. Le pays et le code postal
         n'apprennent rien à quelqu'un qui commande dans sa propre ville. */
      const parts = [
        a.road || a.pedestrian || a.residential || a.neighbourhood,
        a.suburb || a.quarter,
        a.city || a.town || a.village
      ].filter(Boolean);
      return parts.length ? parts.join(', ')
                          : (j.display_name || '').split(',').slice(0, 3).join(', ');
    } catch (e) { return ''; }
  }

  /** Texte → liste de lieux (limités à l'Algérie) */
  async function chercher(term) {
    try {
      const r = await fetch(NOMINATIM + '/search?format=jsonv2&limit=6&countrycodes=dz' +
        '&accept-language=fr&q=' + encodeURIComponent(term));
      if (!r.ok) return [];
      const l = await r.json();
      return (l || []).map(x => ({
        adresse: x.display_name, lat: +x.lat, lng: +x.lon
      }));
    } catch (e) { return []; }
  }

  function geoError(err) {
    if (err.code === 1) return 'Autorisez l’accès à votre position dans le navigateur.';
    if (err.code === 2) return 'Signal GPS indisponible. Placez le repère à la main.';
    if (err.code === 3) return 'Le GPS met trop de temps à répondre. Réessayez dehors.';
    return 'Placez le repère à la main sur la carte.';
  }

  /* ------------------- secours : pas de carte (hors connexion) */
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
