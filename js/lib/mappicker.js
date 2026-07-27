/* ==========================================================================
   SÉLECTEUR DE POSITION SUR CARTE
   --------------------------------------------------------------------------
   • Carte OpenStreetMap via Leaflet — gratuit, aucune clé API
   • Bouton "Ma position" via le GPS du téléphone (navigator.geolocation)
   • Recherche et adresse automatique via Nominatim (OpenStreetMap)
   • Le point choisi est ensuite ouvrable dans Google Maps pour la navigation
   ========================================================================== */
(function (w) {
  'use strict';

  // Centre de la ville de Tizi Ouzou
  const CITY = { lat: 36.7118, lng: 4.0458 };
  const NOMINATIM = 'https://nominatim.openstreetmap.org';

  const MapPicker = {

    /** La librairie de carte a-t-elle bien été chargée ? (nécessite internet) */
    get available() { return !!w.L; },

    /**
     * MapPicker.open({ lat, lng, title, onPick })
     * onPick reçoit { lat, lng, address }
     */
    open(opts) {
      const o = opts || {};
      let lat = U.hasCoords(o) ? +o.lat : CITY.lat;
      let lng = U.hasCoords(o) ? +o.lng : CITY.lng;
      let label = '';

      if (!MapPicker.available) return fallback(o);

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
            '<div class="mp-pin">📍</div>' +
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

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          // la carte est créée dans un panneau animé : il faut la remesurer
          setTimeout(() => map.invalidateSize(), 320);

          const addrBox = el.querySelector('#mpaddr');
          const resBox = el.querySelector('#mpres');

          /* ------------------------------------------- adresse du centre */
          const refresh = U.debounce(async () => {
            const c = map.getCenter();
            lat = +c.lat.toFixed(6); lng = +c.lng.toFixed(6);
            addrBox.innerHTML = '<span class="spinner dark"></span> Recherche de l’adresse…';
            label = await reverse(lat, lng);
            addrBox.innerHTML = label
              ? '<b>📍 ' + U.esc(label) + '</b>'
              : '<b>📍 Position sélectionnée</b>' +
                '<div class="tiny">' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '</div>';
          }, 550);

          map.on('move', () => el.querySelector('.mp-pin').classList.add('moving'));
          map.on('moveend', () => {
            el.querySelector('.mp-pin').classList.remove('moving');
            refresh();
          });
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

            const list = await search(term);
            if (!list.length) {
              resBox.innerHTML = '<div class="mp-item tiny">Aucun résultat</div>';
              return;
            }
            resBox.innerHTML = list.map((r, i) =>
              '<div class="mp-item" data-r="' + i + '">📍 ' + U.esc(r.display_name) + '</div>').join('');
            resBox.querySelectorAll('[data-r]').forEach(item => item.onclick = () => {
              const r = list[+item.dataset.r];
              map.setView([+r.lat, +r.lon], 17);
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
     * Retourne { update(points), destroy() } — les repères bougent sans
     * recréer la carte, ce qui évite le clignotement à chaque rafraîchissement.
     */
    live(container, points) {
      if (!MapPicker.available || !container) return null;

      const map = L.map(container, { zoomControl: true, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      const icon = (emoji, cls) => L.divIcon({
        className: '', iconSize: [38, 38], iconAnchor: [19, 19],
        html: '<div class="lm-pin ' + (cls || '') + '">' + emoji + '</div>'
      });

      const markers = {};
      const defs = {
        restaurant: ['🏪', 'lm-resto', 'Restaurant'],
        client:     ['🏠', 'lm-client', 'Vous'],
        driver:     ['🛵', 'lm-driver', 'Livreur']
      };
      let first = true;

      function update(pts) {
        const bounds = [];
        Object.keys(defs).forEach(k => {
          const p = pts && pts[k];
          if (!p || !U.hasCoords(p)) {
            if (markers[k]) { map.removeLayer(markers[k]); delete markers[k]; }
            return;
          }
          const ll = [+p.lat, +p.lng];
          bounds.push(ll);
          if (markers[k]) markers[k].setLatLng(ll);
          else markers[k] = L.marker(ll, { icon: icon(defs[k][0], defs[k][1]), title: defs[k][2] }).addTo(map);
        });

        if (!bounds.length) { map.setView([CITY.lat, CITY.lng], 13); return; }
        if (first) {
          bounds.length > 1
            ? map.fitBounds(bounds, { padding: [42, 42], maxZoom: 16 })
            : map.setView(bounds[0], 16);
          first = false;
        }
      }

      update(points);
      setTimeout(() => map.invalidateSize(), 260);

      return {
        update: update,
        recenter() {
          const b = Object.keys(markers).map(k => markers[k].getLatLng());
          if (b.length > 1) map.fitBounds(b, { padding: [42, 42], maxZoom: 16 });
          else if (b.length) map.setView(b[0], 16);
        },
        destroy() { try { map.remove(); } catch (e) {} }
      };
    },

    /** Petite carte non modifiable, pour afficher une position */
    preview(container, lat, lng) {
      if (!MapPicker.available || !U.hasCoords({ lat: lat, lng: lng })) return null;
      const map = L.map(container, {
        zoomControl: false, dragging: false, scrollWheelZoom: false,
        doubleClickZoom: false, attributionControl: false, keyboard: false
      }).setView([lat, lng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      L.marker([lat, lng]).addTo(map);
      setTimeout(() => map.invalidateSize(), 250);
      return map;
    }
  };

  /* ====================================================== OpenStreetMap */

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
  async function reverse(lat, lng) {
    try {
      const r = await fetch(NOMINATIM + '/reverse?format=jsonv2&zoom=18&accept-language=fr' +
        '&lat=' + lat + '&lon=' + lng);
      if (!r.ok) return '';
      const j = await r.json();
      const a = j.address || {};
      const parts = [
        a.road || a.pedestrian || a.residential || a.neighbourhood,
        a.suburb || a.quarter,
        a.city || a.town || a.village
      ].filter(Boolean);
      return parts.length ? parts.join(', ') : (j.display_name || '').split(',').slice(0, 3).join(', ');
    } catch (e) { return ''; }
  }

  /** Texte → liste de lieux (limité à l'Algérie) */
  async function search(term) {
    try {
      const r = await fetch(NOMINATIM + '/search?format=jsonv2&limit=6&countrycodes=dz' +
        '&accept-language=fr&q=' + encodeURIComponent(term));
      if (!r.ok) return [];
      return await r.json();
    } catch (e) { return []; }
  }

  function geoError(err) {
    if (err.code === 1) return 'Autorisez l’accès à votre position dans le navigateur.';
    if (err.code === 2) return 'Signal GPS indisponible. Placez le repère à la main.';
    if (err.code === 3) return 'Le GPS met trop de temps à répondre. Réessayez dehors.';
    return 'Placez le repère à la main sur la carte.';
  }

  /* ----------------------------- secours : pas de carte (hors connexion) */
  function fallback(o) {
    return UI.sheet({
      title: o.title || 'Choisir la position',
      body: '<div class="banner banner-warn">🗺️ La carte n’a pas pu se charger (connexion internet). ' +
            'Vous pouvez quand même enregistrer votre position GPS.</div>',
      footer: '<button class="btn btn-primary btn-block" id="fbgeo">📍 Utiliser ma position actuelle</button>',
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
