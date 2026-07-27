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
            '<input class="input" id="mpq" placeholder="Rechercher une rue, un repère…" autocomplete="off">' +
          '</div>' +
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

  w.MapPicker = MapPicker;
})(window);
