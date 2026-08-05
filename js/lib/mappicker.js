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

  /* Leaflet est DANS le dépôt, et le CDN ne sert plus que de secours.
     Il arrivait d'unpkg.com : une carte qui dépend d'un domaine étranger est
     une carte qui ne s'affiche pas quand ce domaine est lent, filtré ou
     simplement injoignable — ce qui arrive ici, et laisse le client devant un
     rectangle vide au moment où il attend son repas. Servi depuis notre
     propre domaine, il est aussi mis en cache par le service worker : la
     carte s'ouvre alors même sans réseau, sur les tuiles déjà vues. */
  const LEAFLET_CSS = U.asset('assets/vendor/leaflet/leaflet.css');
  const LEAFLET_JS  = U.asset('assets/vendor/leaflet/leaflet.js');
  const LEAFLET_CSS_SECOURS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS_SECOURS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

  const TUILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  // La licence OpenStreetMap impose de citer la source sur toute carte
  // affichée. Ce n'est pas décoratif : c'est la contrepartie du service.
  const CREDIT = '© OpenStreetMap';

  let promesse = null;

  function feuilleDeStyle(href) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = href;
    css.setAttribute('data-leaflet', '');
    document.head.appendChild(css);
  }

  /**
   * Charge Leaflet. Résout false si c'est impossible.
   *
   * Le fichier local d'abord, le CDN ensuite : deux chances valent mieux
   * qu'une, et la seconde ne coûte rien tant que la première suffit.
   *
   * Un échec n'est PAS mémorisé. La promesse était gardée telle quelle : une
   * seule tentative ratée au démarrage — le temps que le réseau du téléphone
   * se réveille — condamnait toutes les cartes de la session, y compris
   * celle du suivi ouverte dix minutes plus tard avec une connexion revenue.
   */
  function chargerLeaflet() {
    if (w.L && w.L.map) return Promise.resolve(true);
    if (promesse) return promesse;

    promesse = new Promise(resolve => {
      let fait = false;
      const fini = ok => {
        if (fait) return;
        fait = true;
        clearTimeout(minuteur);
        if (!ok) promesse = null;        // on pourra réessayer plus tard
        resolve(ok);
      };
      // au-delà de 12 s, on considère que la carte ne viendra pas : le mode
      // dégradé vaut mieux qu'une attente sans fin
      const minuteur = setTimeout(() => fini(false), 12000);

      if (!document.querySelector('link[data-leaflet]')) feuilleDeStyle(LEAFLET_CSS);

      const charger = (src, secours) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => fini(!!(w.L && w.L.map));
        s.onerror = () => {
          if (!secours) return fini(false);
          feuilleDeStyle(LEAFLET_CSS_SECOURS);
          charger(secours, null);
        };
        document.head.appendChild(s);
      };
      charger(LEAFLET_JS, LEAFLET_JS_SECOURS);
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
        if (!m) return { maxZoom: 16, padding: [ecart, ecart] };

        /* Des marges plus grandes que la carte ne laissent aucune place aux
           repères : Leaflet calcule alors une zone de largeur négative et
           part en zoom infini — la carte reste grise. Sur un écran court,
           barre du haut plus feuille du bas dépassent vite la hauteur
           disponible, donc on plafonne à trois quarts de chaque dimension et
           on rabote la marge du bas, la seule qui varie. */
        const t = map ? map.getSize() : null;
        let tl = m.tl.slice(), br = m.br.slice();
        if (t && t.y > 0) {
          const max = t.y * .75;
          if (tl[1] + br[1] > max) br[1] = Math.max(0, max - tl[1]);
        }
        if (t && t.x > 0) {
          const max = t.x * .75;
          if (tl[0] + br[0] > max) { tl[0] = max / 2; br[0] = max / 2; }
        }
        return { maxZoom: 16, paddingTopLeft: tl, paddingBottomRight: br };
      };

      let map = null, markers = {}, attendus = points, premier = true, mort = false;
      /* Le cap du livreur, et la position depuis laquelle il a été calculé. */
      let cap = 0, capDe = null;
      /* Les trois traits du trajet : le tronçon en cours, les pointillés qui
         filent dessus, et le tronçon d'après. */
      const voies = { encours: null, flux: null, apres: null };
      /* Dès que le doigt déplace la carte, on arrête de la recadrer : quelqu'un
         qui regarde le quartier d'à côté ne veut pas être ramené de force
         toutes les quinze secondes. Le bouton de recentrage rend la main. */
      let libre = false;

      /* Les pictogrammes du jeu de l'application plutôt que des emojis : 🏪 est
         un magasin et non un restaurant, et chaque téléphone dessine les emojis
         à sa façon — le repère changeait d'allure d'un appareil à l'autre, et
         paraissait plat sur certains Android. */
      const defs = {
        restaurant: [UI.icon('dome', 18), 'lm-resto', 'Restaurant'],
        client:     [UI.icon('home', 17),     'lm-client', 'Client'],
        driver:     [UI.icon('scooter', 18),  'lm-driver', 'Livreur']
      };

      /**
       * Un repère de carte.
       *
       * `logo` : l'enseigne du restaurant, à la place du pictogramme. Un rond
       * générique dit « il y a un restaurant ici » ; le logo dit LEQUEL — et
       * c'est la seule chose que le client cherche sur cette carte, puisqu'il
       * sait déjà où il habite. Le cercle blanc et son ombre détachent
       * l'enseigne du fond, quelle que soit la couleur du logo.
       *
       * L'étiquette n'apparaît que si l'appelant fournit un nom : « Livreur »
       * posé à côté d'un scooter n'apprend rien, et trois étiquettes sur une
       * petite carte se recouvrent.
       */
      const repere = (icone, cls, titre, sous, logo) => L.divIcon({
        className: '', iconSize: [44, 44], iconAnchor: [22, 22],
        html: '<div class="lm-pin ' + (cls || '') + (logo ? ' lm-logo' : '') + '"' +
            (logo ? ' style="background-image:url(' + U.escUrl(logo) + ')"' : '') + '>' +
            (logo ? '' : '<span>' + icone + '</span>') +
          '</div>' +
          (sous
            ? '<span class="lm-tag"><b>' + U.esc(titre || '') + '</b>' +
              U.esc(sous) + '</span>'
            : '')
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
            icon: repere(defs[k][0], defs[k][1], defs[k][2],
                         pts && pts.noms && pts.noms[k],
                         pts && pts.logos && pts.logos[k]),
            title: defs[k][2],
            /* Le livreur passe devant : c'est lui qu'on suit, et une épingle
               fixe ne doit pas le recouvrir quand il arrive à destination. */
            zIndexOffset: k === 'driver' ? 1000 : 0
          }).addTo(map);
        });

        /* LE SCOOTER TOURNE VERS LÀ OÙ IL VA.
           Une icône qui glisse latéralement en regardant toujours à droite ne
           ressemble à rien ; orientée, elle raconte le virage qu'il vient de
           prendre. Le cap se déduit de deux positions successives — aucun
           téléphone ne nous donne la direction, mais le déplacement la dit.
           Sous quinze mètres on garde le cap précédent : à l'arrêt, le bruit
           du GPS ferait tourner le scooter sur lui-même. */
        const d = pts && pts.driver;
        if (d && U.hasCoords(d)) {
          if (capDe && U.haversine(+capDe.lat, +capDe.lng, +d.lat, +d.lng) > 0.015) {
            cap = Math.atan2(
              (+d.lng - +capDe.lng) * Math.cos((+d.lat + +capDe.lat) / 2 * Math.PI / 180),
              (+d.lat - +capDe.lat)
            ) * 180 / Math.PI;
            capDe = { lat: +d.lat, lng: +d.lng };
          } else if (!capDe) {
            capDe = { lat: +d.lat, lng: +d.lng };
          }
          const el = markers.driver && markers.driver.getElement();
          const pin = el && el.querySelector('.lm-pin');
          if (pin) pin.style.setProperty('--cap', cap.toFixed(0) + 'deg');
        }

        /* LE CLIENT S'ANIME QUAND LE LIVREUR APPROCHE.
           À trois cents mètres, le repère de la maison se met à battre : c'est
           le moment d'aller ouvrir. Rien d'autre sur l'écran ne dit « c'est
           maintenant » — les minutes restantes descendent trop lentement pour
           qu'on les surveille. */
        const cl = pts && pts.client;
        const maison = markers.client && markers.client.getElement();
        if (maison) {
          const proche = d && cl && U.hasCoords(d) && U.hasCoords(cl) &&
            U.haversine(+d.lat, +d.lng, +cl.lat, +cl.lng) < 0.3;
          const pin = maison.querySelector('.lm-pin');
          if (pin) pin.classList.toggle('proche', !!proche);
        }

        /* LA MISSION EN DEUX TRONÇONS
           -------------------------------------------------------------------
           Le trajet n'est pas une ligne, c'est une suite : le livreur va
           d'abord au restaurant, ensuite chez le client. Un seul trait de la
           même couleur laissait croire qu'il venait droit sur le client, et
           rendait incompréhensible le moment où il s'en éloigne.

           Le tronçon EN COURS est plein et orange, avec des pointillés blancs
           qui filent dessus dans le sens de la marche — c'est ce qui se lit
           comme « en direct » sans écrire le mot. Le tronçon D'APRÈS est
           sombre et discret : il existe, il n'est pas commencé.

           À vol d'oiseau, faute d'un service d'itinéraire : le trait ne
           prétend pas dire par où passer, seulement dans quel sens ça va. */
        const etapes = (pts && pts.chemin || []).map(k => markers[k])
          .filter(Boolean).map(m => m.getLatLng());

        const pose = (garde, coords, style) => {
          if (coords.length < 2) {
            if (voies[garde]) { map.removeLayer(voies[garde]); voies[garde] = null; }
            return;
          }
          if (voies[garde]) voies[garde].setLatLngs(coords);
          else voies[garde] = L.polyline(coords, style).addTo(map);
        };

        /* UNE SEULE COULEUR, DEUX OPACITÉS, comme la maquette : le tronçon en
           cours plein, celui d'après à 22 %. Il était sombre et pointillé —
           deux traits qui ne se ressemblent pas se lisent comme deux choses
           différentes, alors que c'est un seul trajet dont une partie n'est pas
           encore faite. */
        pose('encours', etapes.slice(0, 2), {
          color: '#FF4D2D', weight: 7, opacity: 1,
          lineCap: 'round', lineJoin: 'round'
        });
        pose('flux', etapes.slice(0, 2), {
          color: '#fff', weight: 3, opacity: .95,
          lineCap: 'round', dashArray: '2 14', className: 'lm-flux'
        });
        pose('apres', etapes.slice(1), {
          color: '#FF4D2D', weight: 7, opacity: .22,
          lineCap: 'round', lineJoin: 'round'
        });

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

      /* Toute panne passe par ici : une carte qui échoue en silence est la
         pire des pannes, parce qu'on la prend pour une application cassée. */
      const echec = raison => { if (opts && opts.onEchec) opts.onEchec(raison); };

      /* Combien de tuiles sont arrivées, et combien ont échoué. Lu par la
         sentinelle ci-dessous, qui n'a aucun autre moyen de savoir si la
         carte est vraiment là. */
      let rates = 0, recues = 0;

      /* LA SENTINELLE
         Une carte peut rester vide sans que rien n'échoue : moteur qui ne
         répond jamais, tuiles muettes, écran refermé entre-temps. Aucun de ces
         cas ne déclenchait quoi que ce soit — on restait devant un rectangle
         beige, et personne, moi compris, ne pouvait dire pourquoi. Au bout de
         sept secondes, la carte dit où elle en est. */
      const sentinelle = setTimeout(() => {
        if (mort) return;
        if (!map) return echec('Le moteur de carte n’a pas répondu.');
        if (!recues) return echec(rates
          ? 'Les tuiles de la carte sont refusées (' + rates + ' essais).'
          : 'Les tuiles de la carte n’arrivent pas.');
      }, 7000);

      chargerLeaflet().then(ok => {
        if (mort) return;
        if (!ok)
          return echec('Le moteur de carte n’a pas pu être chargé.');

        try {
          map = L.map(container, Object.assign({
            zoomControl: true, attributionControl: true
          }, fige ? {
            dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
            touchZoom: false, boxZoom: false, keyboard: false,
            zoomControl: false, tap: false
          } : null));

          /* La carte existe : le message d'attente posé par l'appelant n'a plus
             lieu d'être, et Leaflet ne le retire pas lui-même — il ajoute ses
             calques par-dessus. */
          if (opts && opts.onPret) opts.onPret();

          const tuiles = L.tileLayer(TUILES, { maxZoom: 19, attribution: CREDIT });

          /* Le moteur peut très bien se charger et les tuiles ne jamais
             arriver : filtrage, coupure, quota. On voyait alors un rectangle
             gris sans explication. Quelques échecs de suite sans une seule
             tuile reçue, et on le dit. */
          tuiles.on('tileload', () => { recues++; });
          tuiles.on('tileerror', () => {
            if (++rates >= 6 && !recues)
              echec('Le fond de carte ne répond pas — vérifiez votre connexion.');
          });
          tuiles.addTo(map);

          /* Le doigt reprend la main : à partir de là, la carte ne se recadre
             plus toute seule. */
          if (suit) map.on('dragstart', () => { libre = true; });
          appliquer(attendus);
          setTimeout(() => { if (map) map.invalidateSize(); }, 260);
        } catch (e) {
          console.error(e);
          echec(e.message || 'La carte n’a pas pu être construite.');
        }
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
          clearTimeout(sentinelle);
          try { if (map) map.remove(); } catch (e) {}
          markers = {}; map = null;
          voies.encours = voies.flux = voies.apres = null;
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
