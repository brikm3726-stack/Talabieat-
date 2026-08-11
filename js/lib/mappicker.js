/* ==========================================================================
   SÉLECTEUR DE POSITION SUR CARTE
   --------------------------------------------------------------------------
   • Le fond de carte vient de Google Maps, avec repli automatique sur
     OpenStreetMap — le choix se fait dans js/lib/mapengine.js, qui explique
     pourquoi il y a deux moteurs.
   • Bouton « Ma position » via le GPS du téléphone (navigator.geolocation)
   • Recherche et adresse inverse : Google quand ses services répondent,
     Nominatim (OpenStreetMap) sinon — voir « LES DEUX ANNUAIRES » plus bas.
   • Navigation du livreur : liens Google Maps, qui ouvrent l'application du
     téléphone et ne demandent aucune clé.

   CE FICHIER NE SAIT PLUS DESSINER UNE CARTE. Il sait ce qu'il veut montrer —
   une position qu'on déplace, trois repères et un trajet, un aperçu figé — et
   il le demande au moteur. C'est ce qui a permis d'ajouter Google sans
   réécrire les six cents lignes d'interface qui suivent.

   CHARGEMENT À LA DEMANDE
   Le moteur n'est téléchargé qu'à la première carte affichée. Un client qui
   parcourt les menus sans jamais ouvrir de carte ne paie ni le temps de
   chargement, ni — pour Google — le chargement facturé.

   SANS RÉSEAU
   Tout continue en mode dégradé : on peut enregistrer sa position par le GPS,
   sans voir la carte. Une adresse sans carte vaut mieux qu'un écran bloqué.
   ========================================================================== */
(function (w) {
  'use strict';

  const CITY = MapEngine.CITY;
  const NOMINATIM = 'https://nominatim.openstreetmap.org';

  /* ------------------------------------------------------------------
     LES DEUX DESSINS DE LA FEUILLE « OÙ LIVRER ? »
     Écrits ici plutôt qu'appelés à travers UI.icon parce qu'ils servent
     chacun à deux endroits — l'un dans le HTML de départ, l'autre dans une
     remise à zéro après chargement. Deux tracés recopiés à la main auraient
     fini par diverger. */

  /* Le viseur du bouton « ma position ». En SVG et non en 🎯 : chaque
     téléphone dessine l'emoji à sa façon, et sur les Android du quartier il
     ressortait plat et délavé au milieu d'un bouton de verre. */
  const VISEUR =
    '<svg class="ico" width="21" height="21" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/>' +
      '<path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>';

  /* Le mot-marque des autres écrans : l'arc orange et « tala<i>bi</i> ». La
     classe .brand-nuit n'est pas reprise — une douzaine de règles la
     repositionnent selon l'écran, elle serait arrivée ici en absolu au milieu
     de la feuille. Même dessin, habillage à nous. */
  const MARQUE =
    '<span class="ou-marque" aria-hidden="true">' +
      '<span class="ou-arc"><svg viewBox="0 0 132 26"><path d="M6 24C6 24 24 4 66 4s60 20 60 20" ' +
        'fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg></span>' +
      '<span class="ou-mot">tala<i>bi</i></span>' +
    '</span>';

  /* ==================================================================
     LES DEUX ANNUAIRES — Google d'abord, Nominatim toujours prêt
     ------------------------------------------------------------------
     Traduire des coordonnées en adresse, et une adresse en coordonnées, est
     un service SÉPARÉ de l'affichage de la carte : il se facture à part et
     s'active à part dans la console Google. Au 10 août 2026, sur ce projet,
     l'API JavaScript répond mais « Geocoding » et « Places » sont désactivées
     — elles renvoient REQUEST_DENIED.

     D'où ce fonctionnement : on essaie Google, et au PREMIER refus on note
     qu'il ne sait pas faire et on ne le redemande plus de la session. Tout
     retombe alors sur Nominatim, qui est gratuit, sans clé, et qui fait
     tourner l'application aujourd'hui.

     L'intérêt de cette bascule : le jour où les deux API sont activées dans
     la console, la recherche devient celle de Google sans qu'une seule ligne
     change ici. Les adresses algériennes y sont infiniment mieux couvertes —
     c'est le vrai gain, plus encore que le rendu de la carte.
     ================================================================== */
  let googleAnnuaire = null;      // null = pas encore essayé, false = refusé
  let googleSuggestions = null;

  function geocodeur() {
    if (!(w.google && w.google.maps && w.google.maps.Geocoder)) return null;
    if (googleAnnuaire === false) return null;
    if (!googleAnnuaire) googleAnnuaire = new w.google.maps.Geocoder();
    return googleAnnuaire;
  }

  /** Une seule fois : Google a refusé, on ne le rappellera plus. */
  function googleRefuseLAnnuaire(statut) {
    if (statut === 'REQUEST_DENIED' || statut === 'OVER_QUERY_LIMIT') {
      googleAnnuaire = false;
      googleSuggestions = false;
      console.info('[carte] annuaire Google indisponible (' + statut +
                   ') — recherche par OpenStreetMap.');
      return true;
    }
    return false;
  }

  /* ------------------------------------------------ coordonnées → adresse */

  function inverseGoogle(lat, lng) {
    const g = geocodeur();
    if (!g) return Promise.resolve(null);
    return new Promise(res => {
      g.geocode({ location: { lat: +lat, lng: +lng }, language: 'fr' }, (rep, statut) => {
        if (statut !== 'OK' || !rep || !rep.length) {
          googleRefuseLAnnuaire(statut);
          return res(null);
        }
        /* Google range du plus précis au plus large. On veut la rue et le
           quartier, pas « Algérie » : le pays n'apprend rien à quelqu'un qui
           commande dans sa propre ville. */
        const c = rep[0].address_components || [];
        const bout = type => {
          const t = c.find(x => x.types.indexOf(type) >= 0);
          return t ? t.long_name : '';
        };
        const parts = [
          bout('route') || bout('neighborhood'),
          bout('sublocality') || bout('sublocality_level_1'),
          bout('locality') || bout('administrative_area_level_2')
        ].filter(Boolean);
        res(parts.length ? parts.join(', ')
                         : (rep[0].formatted_address || '').split(',').slice(0, 3).join(', '));
      });
    });
  }

  async function inverseOSM(lat, lng) {
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

  /** Coordonnées → adresse lisible */
  async function inverse(lat, lng) {
    const g = await inverseGoogle(lat, lng);
    if (g) return g;
    return inverseOSM(lat, lng);
  }

  /* ------------------------------------------------ texte → liste de lieux */

  function chercherGoogle(term) {
    const g = geocodeur();
    if (!g) return Promise.resolve(null);
    return new Promise(res => {
      g.geocode({
        address: term, language: 'fr',
        componentRestrictions: { country: 'dz' },
        /* Le résultat est trié en fonction de cette zone : sans elle, « rue
           de la gare » remonte d'abord à Alger, à cent kilomètres d'ici. */
        bounds: new w.google.maps.LatLngBounds(
          { lat: CITY.lat - .25, lng: CITY.lng - .25 },
          { lat: CITY.lat + .25, lng: CITY.lng + .25 })
      }, (rep, statut) => {
        if (statut !== 'OK' || !rep || !rep.length) {
          googleRefuseLAnnuaire(statut);
          return res(null);
        }
        res(rep.slice(0, 6).map(x => ({
          adresse: x.formatted_address,
          lat: x.geometry.location.lat(),
          lng: x.geometry.location.lng()
        })));
      });
    });
  }

  async function chercherOSM(term) {
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

  /** Texte → liste de lieux (limités à l'Algérie) */
  async function chercher(term) {
    const g = await chercherGoogle(term);
    if (g && g.length) return g;
    return chercherOSM(term);
  }

  /* ====================================================================== */

  const MapPicker = {

    /** Une carte peut-elle s'afficher ? On ne le sait qu'en essayant : ni
        Google ni OpenStreetMap ne le disent à l'avance. */
    get available() { return true; },

    /** Quel moteur dessine, une fois qu'une carte a été ouverte. */
    get moteur() { return MapEngine.nom; },

    /**
     * MapPicker.open({ lat, lng, title, onPick })
     * onPick reçoit { lat, lng, address }
     */
    async open(opts) {
      const o = opts || {};
      let lat = U.hasCoords(o) ? +o.lat : CITY.lat;
      let lng = U.hasCoords(o) ? +o.lng : CITY.lng;
      let label = '';

      if (!(await MapEngine.preparer())) return fallback(o);

      const sheet = UI.sheet({
        /* Pas de `sheet-head` : cette feuille écrit le sien, avec le
           mot-marque, un titre bien plus gros et une croix de verre. Le titre
           reste celui que l'appelant demande — « Où livrer ? » au moment de
           commander, « Où se trouve votre restaurant ? » à l'inscription. */
        title: false,
        classe: 'ou-ov',
        body:
          '<div class="ou">' +

            /* La poignée, la marque et la croix restent en haut pendant que
               le reste défile : sur un petit iPhone, la feuille est plus
               haute que l'écran, et une croix qui s'en va avec le titre
               enferme l'utilisateur dans la carte. */
            '<div class="ou-fixe">' +
              '<div class="ou-bar">' +
                '<div class="ou-poignee" aria-hidden="true"></div>' +
                MARQUE +
                '<button type="button" class="ou-x" data-x aria-label="Fermer">' +
                  '<svg class="ico" width="17" height="17" viewBox="0 0 24 24" fill="none" ' +
                    'stroke="currentColor" stroke-width="2.6" stroke-linecap="round">' +
                    '<path d="M6 6l12 12M18 6 6 18"/></svg>' +
                '</button>' +
              '</div>' +
            '</div>' +

            '<div class="ou-head">' +
              '<h2 class="ou-titre">' + U.esc(o.title || 'Choisir la position') + '</h2>' +
              /* « votre porte » est la bonne phrase pour un client qui se fait
                 livrer, et la mauvaise pour un restaurateur qui place son
                 enseigne — d'où `o.hint`, que l'appelant remplace. */
              '<p class="ou-sous">' +
                U.esc(o.hint || 'Déplacez la carte pour poser le repère sur votre porte.') +
              '</p>' +
            '</div>' +

            '<div class="ou-champ">' +
              '<span class="ou-champ-ic">' + UI.icon('search', 19) + '</span>' +
              '<input class="ou-input" id="mpq" autocomplete="off" ' +
                'placeholder="Rue, repère, ou coordonnées…">' +
            '</div>' +
            '<p class="ou-astuce">Vous pouvez coller des coordonnées Google Maps ' +
              '<b>36.7132, 4.0438</b></p>' +
            '<div id="mpres" class="ou-res"></div>' +

            '<div class="ou-map">' +
              '<div id="mpmap"></div>' +
              '<div class="ou-voile" aria-hidden="true"></div>' +
              '<div class="ou-pin">' + UI.icon('pin', 40) + '</div>' +
              '<button type="button" class="ou-loc" id="mploc" aria-label="Ma position">' +
                VISEUR + '</button>' +
            '</div>' +

            '<div class="ou-addr" id="mpaddr">' + adresseEnCours() + '</div>' +
          '</div>',

        footer:
          '<button class="ou-cta" id="mpok">' + UI.icon('check', 19) +
            ' Confirmer cette position</button>',

        onMount(el, api) {
          const carte = MapEngine.creer(el.querySelector('#mpmap'), {
            lat: lat, lng: lng, zoom: U.hasCoords(o) ? 17 : 14
          });
          if (!carte) { api.close(); fallback(o); return; }

          // la carte naît dans un panneau qui glisse : elle doit se remesurer
          // une fois l'animation terminée, sinon elle reste grise à moitié
          setTimeout(() => carte.remesurer(), 320);

          const addrBox = el.querySelector('#mpaddr');
          const resBox = el.querySelector('#mpres');
          const pin = el.querySelector('.ou-pin');

          /* ------------------------------------------- adresse du centre */
          const refresh = U.debounce(async () => {
            const c = carte.centre();
            lat = +c.lat.toFixed(6); lng = +c.lng.toFixed(6);
            addrBox.innerHTML = adresseEnCours();
            label = await inverse(lat, lng);
            addrBox.innerHTML = adresseTrouvee(label, lat, lng);
          }, 550);

          carte.sur('bouge', () => pin.classList.add('moving'));
          carte.sur('finBouge', () => { pin.classList.remove('moving'); refresh(); });
          refresh();

          /* --------------------------------------------- ma position GPS */
          el.querySelector('#mploc').onclick = function () {
            if (!navigator.geolocation)
              return UI.err('GPS indisponible', 'Votre navigateur ne gère pas la géolocalisation.');
            const btn = this;
            btn.innerHTML = '<span class="spinner dark"></span>';
            navigator.geolocation.getCurrentPosition(
              pos => {
                btn.innerHTML = VISEUR;
                carte.allerA(pos.coords.latitude, pos.coords.longitude, 18);
                UI.ok('Position trouvée', 'Ajustez le repère si besoin');
              },
              err => {
                btn.innerHTML = VISEUR;
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
              carte.allerA(c.lat, c.lng, 18);
              resBox.innerHTML = '';
              q.value = '';
              UI.ok('Position appliquée', c.lat.toFixed(5) + ', ' + c.lng.toFixed(5));
              return;
            }

            const list = await chercher(term);
            if (!list.length) {
              resBox.innerHTML = '<div class="ou-item vide">Aucun résultat</div>';
              return;
            }
            resBox.innerHTML = list.map((r, i) =>
              '<div class="ou-item" data-r="' + i + '">' +
                '<span class="ou-item-ic">' + UI.pin(15) + '</span>' +
                '<span class="ou-item-t">' + U.esc(r.adresse) + '</span></div>').join('');
            resBox.querySelectorAll('[data-r]').forEach(item => item.onclick = () => {
              const r = list[+item.dataset.r];
              carte.allerA(r.lat, r.lng, 17);
              resBox.innerHTML = '';
              q.value = '';
            });
          }, 500);

          /* ------------------------------------------------- validation */
          el.querySelector('#mpok').onclick = function () {
            UI.busy(this, true);
            api.close();
            carte.detruire();
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
     * L'objet est rendu tout de suite, avant même que le moteur soit chargé :
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
        if (!m) return ecart;

        /* Des marges plus grandes que la carte ne laissent aucune place aux
           repères : le moteur calcule alors une zone de largeur négative et
           part en zoom infini — la carte reste grise. Sur un écran court,
           barre du haut plus feuille du bas dépassent vite la hauteur
           disponible, donc on plafonne à trois quarts de chaque dimension et
           on rabote la marge du bas, la seule qui varie. */
        const t = container.getBoundingClientRect();
        let tl = m.tl.slice(), br = m.br.slice();
        if (t.height > 0) {
          const max = t.height * .75;
          if (tl[1] + br[1] > max) br[1] = Math.max(0, max - tl[1]);
        }
        if (t.width > 0) {
          const max = t.width * .75;
          if (tl[0] + br[0] > max) { tl[0] = max / 2; br[0] = max / 2; }
        }
        return { top: tl[1], left: tl[0], bottom: br[1], right: br[0] };
      };

      let carte = null, presents = {}, attendus = points, premier = true, mort = false;
      /* Le cap du livreur, et la position depuis laquelle il a été calculé. */
      let cap = 0, capDe = null;

      /* ================================================================
         LE VRAI TRACÉ, PAR-DESSUS LA LIGNE DROITE
         ----------------------------------------------------------------
         La ligne droite plus bas s'affiche IMMÉDIATEMENT — elle ne dépend
         de rien. Le tracé réel arrive une fraction de seconde après, une
         fois que Google a répondu, et la remplace en place.

         DEUX SEGMENTS AU PLUS : `encours` (le livreur vers son prochain
         arrêt) et `apres` (l'étape suivante, quand la course en compte
         trois). `apres` relie deux points qui ne bougent jamais le temps
         d'une course — le restaurant, le client — il n'est donc demandé
         qu'UNE FOIS. `encours` bouge avec le livreur : il n'est redemandé
         que s'il s'est éloigné de plus de soixante mètres du point qui a
         servi au dernier calcul, pour ne pas payer un appel à chaque
         relevé GPS. */
      const SEUIL_ENCOURS = 0.06;   // km
      const SEUIL_CIBLE = 0.03;     // km — la destination ne devrait pas bouger
      const itin = {};              // { encours: {a,b,points,enCours}, apres: {...} }

      function segmentReel(cle, a, b, seuil) {
        if (!a || !b) { delete itin[cle]; return null; }
        const c = itin[cle];
        const memeCible = c && U.haversine(c.b.lat, c.b.lng, b.lat, b.lng) < SEUIL_CIBLE;
        const aBouge = !c || !memeCible ||
          U.haversine(c.a.lat, c.a.lng, a.lat, a.lng) > seuil;

        if (aBouge && !(c && c.enCours)) {
          const requete = { a: a, b: b, points: (memeCible && c) ? c.points : null, enCours: true };
          itin[cle] = requete;
          MapEngine.itineraire(a, b).then(chemin => {
            if (mort || itin[cle] !== requete) return;   // dépassé entre-temps
            requete.points = chemin;
            requete.enCours = false;
            if (chemin) appliquer(attendus);   // remplace la ligne droite par le vrai tracé
          });
          return requete.points;
        }
        return c.points;
      }
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
        client:     [UI.icon('home', 17), 'lm-client', 'Client'],
        driver:     [UI.icon('scooter', 18), 'lm-driver', 'Livreur']
      };

      /**
       * Le HTML d'un repère.
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
      const html = (icone, cls, titre, sous, logo) =>
        '<div class="lm-pin ' + (cls || '') + (logo ? ' lm-logo' : '') + '"' +
          (logo ? ' style="background-image:url(' + U.escUrl(logo) + ')"' : '') + '>' +
          (logo ? '' : '<span>' + icone + '</span>') +
        '</div>' +
        (sous
          ? '<span class="lm-tag"><b>' + U.esc(titre || '') + '</b>' + U.esc(sous) + '</span>'
          : '');

      function appliquer(pts) {
        if (!carte) return;
        const bornes = [];

        Object.keys(defs).forEach(k => {
          const p = pts && pts[k];
          if (!p || !U.hasCoords(p)) {
            if (presents[k]) { carte.retirerRepere(k); delete presents[k]; }
            return;
          }
          bornes.push({ lat: +p.lat, lng: +p.lng });
          carte.repere(k, p,
            html(defs[k][0], defs[k][1], defs[k][2],
                 pts && pts.noms && pts.noms[k],
                 pts && pts.logos && pts.logos[k]),
            /* Le livreur passe devant : c'est lui qu'on suit, et une épingle
               fixe ne doit pas le recouvrir quand il arrive à destination. */
            k === 'driver' ? 1000 : 0);
          presents[k] = true;
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
          const el = carte.elementRepere('driver');
          const pin = el && el.querySelector('.lm-pin');
          if (pin) pin.style.setProperty('--cap', cap.toFixed(0) + 'deg');
        }

        /* LE CLIENT S'ANIME QUAND LE LIVREUR APPROCHE.
           À trois cents mètres, le repère de la maison se met à battre : c'est
           le moment d'aller ouvrir. Rien d'autre sur l'écran ne dit « c'est
           maintenant » — les minutes restantes descendent trop lentement pour
           qu'on les surveille. */
        const cl = pts && pts.client;
        const maison = carte.elementRepere('client');
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
           comme « en direct » sans écrire le mot. Le tronçon D'APRÈS est le
           même orange à 22 % : c'est un seul trajet dont une partie n'est pas
           encore faite, pas deux choses différentes.

           LE TRACÉ SUIT LES RUES QUAND GOOGLE LE SAIT (voir `segmentReel`
           plus haut) ; sinon, en ligne droite — le trait ne prétend alors
           pas dire par où passer, seulement dans quel sens ça va. */
        const etapes = (pts && pts.chemin || [])
          .filter(k => presents[k] && pts[k] && U.hasCoords(pts[k]))
          .map(k => ({ lat: +pts[k].lat, lng: +pts[k].lng }));

        const traceEncours = segmentReel('encours', etapes[0], etapes[1], SEUIL_ENCOURS) || etapes.slice(0, 2);
        const traceApres = segmentReel('apres', etapes[1], etapes[2], SEUIL_ENCOURS) || etapes.slice(1);

        carte.ligne('encours', traceEncours,
                    { couleur: '#FF4D2D', epaisseur: 7, opacite: 1 });
        carte.ligne('flux', traceEncours, { flux: true });
        carte.ligne('apres', traceApres,
                    { couleur: '#FF4D2D', epaisseur: 7, opacite: .22 });

        if (!bornes.length) { carte.allerA(CITY.lat, CITY.lng, 13); return; }

        /* Carte figée avec un seul repère : la vue le suit, sinon le livreur
           qui roule sortirait du cadre sans pouvoir y revenir au doigt. */
        if (fige && bornes.length === 1 && !premier) {
          carte.allerA(bornes[0].lat, bornes[0].lng);
          return;
        }

        if (premier) {
          if (bornes.length > 1) carte.cadrer(bornes, cadre(42), false);
          else carte.allerA(bornes[0].lat, bornes[0].lng, 16);
          premier = false;
          return;
        }

        /* Suivi : on garde tout le monde dans le cadre à chaque relevé. Le
           déplacement est animé — un saut sec à chaque position donne
           l'impression que la carte se recharge. */
        if (suit && !libre) carte.cadrer(bornes, cadre(56), true);
      }

      /* Toute panne passe par ici : une carte qui échoue en silence est la
         pire des pannes, parce qu'on la prend pour une application cassée. */
      const echec = raison => { if (opts && opts.onEchec) opts.onEchec(raison); };

      /* LA SENTINELLE
         Une carte peut rester vide sans que rien n'échoue : moteur qui ne
         répond jamais, tuiles muettes, écran refermé entre-temps. Aucun de ces
         cas ne déclenchait quoi que ce soit — on restait devant un rectangle
         beige, et personne ne pouvait dire pourquoi. Au bout de sept secondes,
         la carte dit où elle en est. */
      const sentinelle = setTimeout(() => {
        if (mort) return;
        if (!carte) return echec('Le moteur de carte n’a pas répondu.');
        if (!carte.tuilesRecues()) {
          const rates = carte.tuilesRatees ? carte.tuilesRatees() : 0;
          return echec(rates
            ? 'Les tuiles de la carte sont refusées (' + rates + ' essais).'
            : 'Les tuiles de la carte n’arrivent pas.');
        }
      }, 7000);

      function demarrer() {
      return MapEngine.preparer().then(moteur => {
        if (mort) return;
        if (!moteur) return echec('Le moteur de carte n’a pas pu être chargé.');

        try {
          carte = MapEngine.creer(container, {
            lat: CITY.lat, lng: CITY.lng, zoom: 13, fige: fige
          });
          if (!carte) return echec('La carte n’a pas pu être construite.');

          /* La carte existe : le message d'attente posé par l'appelant n'a plus
             lieu d'être, et le moteur ne le retire pas lui-même — il ajoute ses
             calques par-dessus. */
          if (opts && opts.onPret) opts.onPret();

          /* Le doigt reprend la main : à partir de là, la carte ne se recadre
             plus toute seule. */
          if (suit) carte.sur('traine', () => { libre = true; });

          appliquer(attendus);
          setTimeout(() => { if (carte) carte.remesurer(); }, 260);
        } catch (e) {
          console.error(e);
          echec(e.message || 'La carte n’a pas pu être construite.');
        }
      });
      }
      demarrer();

      /* GOOGLE VIENT DE REFUSER LA CLÉ : on jette ce qu'il a laissé et on
         refait la carte avec OpenStreetMap. Sans ceci, le repli ne servait
         qu'aux écrans suivants et celui-ci gardait son cadre gris — c'est
         exactement ce que les captures du 11 août montraient. `premier` est
         remis à vrai pour que la nouvelle carte se cadre comme une première
         fois, sinon elle s'ouvrirait sur le centre-ville par défaut. */
      const surRefus = function () {
        if (mort) return;
        try { if (carte) carte.detruire(); } catch (e) {}
        carte = null; presents = {}; premier = true;
        container.innerHTML = '';
        demarrer();
      };
      w.addEventListener('carte:refusee', surRefus);

      return {
        update(pts) { attendus = pts; appliquer(pts); },
        /* À appeler quand le conteneur a changé de taille ou est redevenu
           visible : un moteur mesure une fois et ne s'en aperçoit pas seul. */
        nudge() { if (carte) carte.remesurer(); },
        recenter() {
          if (!carte) return;
          libre = false;                 // le suivi automatique reprend
          const b = carte.positionsReperes();
          if (b.length > 1) carte.cadrer(b, cadre(42), true);
          else if (b.length) carte.allerA(b[0].lat, b[0].lng, 16);
        },
        destroy() {
          mort = true;
          clearTimeout(sentinelle);
          w.removeEventListener('carte:refusee', surRefus);
          try { if (carte) carte.detruire(); } catch (e) {}
          presents = {}; carte = null;
        }
      };
    },

    /**
     * Aperçu non interactif d'une position.
     *
     * `opts` est facultatif — les appels à trois arguments gardent exactement
     * l'ancien comportement :
     *   opts.resto   { lat, lng, nom }  le restaurant, en second repère
     *   opts.rayonKm  nombre            la zone couverte, tracée autour du resto
     *   opts.zoom     nombre            zoom d'arrivée (16 par défaut)
     *   opts.vol      booléen           approche zoomée, une seule fois
     */
    preview(container, lat, lng, opts) {
      if (!container || !U.hasCoords({ lat: lat, lng: lng })) return null;
      const o = opts || {};

      /* Le même repli que pour le suivi : si Google refuse la clé, l'aperçu se
         refait avec OpenStreetMap au lieu de rester sur le cadre gris. Il n'y a
         rien à défaire ici — un aperçu n'a ni écouteur ni minuterie — donc on
         se contente de vider le conteneur et de recommencer. */
      w.addEventListener('carte:refusee', function unefois() {
        w.removeEventListener('carte:refusee', unefois);
        if (!container.isConnected) return;
        container.innerHTML = '';
        MapPicker.preview(container, lat, lng, o);
      });

      MapEngine.preparer().then(moteur => {
        if (!moteur) return;
        const zoom = o.zoom || 16;
        const carte = MapEngine.creer(container, {
          lat: +lat, lng: +lng,
          zoom: o.vol ? Math.max(11, zoom - 3) : zoom,
          fige: true
        });
        if (!carte) return;

        /* La zone AVANT les repères : un cercle dessiné après les recouvrirait. */
        if (o.resto && U.hasCoords(o.resto) && o.rayonKm) {
          carte.cercle(o.resto, o.rayonKm * 1000, { couleur: '#FF6B00' });
        }

        /* Des repères en HTML plutôt que le marqueur par défaut du moteur :
           celui-ci est le même sur tous les sites du monde, et rien ne dit
           lequel des deux points est chez vous. Le CSS les habille
           (`.mp-repere`), donc ils suivent le thème sans qu'on écrive une
           couleur ici. */
        if (o.resto && U.hasCoords(o.resto)) {
          carte.repere('resto', o.resto, '<div class="mp-repere resto"></div>');
        }
        carte.repere('moi', { lat: +lat, lng: +lng }, '<div class="mp-repere moi"></div>');

        /* Le vol d'approche : une seule fois, à l'arrivée sur l'écran. Il dit où
           l'on se trouve dans la ville avant de resserrer sur la rue — un plan
           qui s'ouvre déjà zoomé ne montre que du bitume. Il est coupé si l'on
           a demandé moins de mouvement. */
        const doux = !(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (o.vol && doux) setTimeout(() => carte.voler(+lat, +lng, zoom), 380);
        else if (o.vol) carte.allerA(+lat, +lng, zoom);

        setTimeout(() => carte.remesurer(), 250);
      });

      return null;
    }
  };

  /* ------------------------------------------------------------------
     LA CARTE DE VERRE QUI ANNONCE L'ADRESSE

     Deux états, un seul gabarit : un disque à gauche, deux lignes à droite.
     C'est la même boîte qui change de contenu, jamais de taille — une carte
     qui grandit de dix pixels à chaque relevé fait sautiller la feuille
     entière, et le doigt qui visait « Confirmer » rate sa cible.

     L'attente n'affiche pas une phrase seule : une barre grise sous le texte
     dit qu'une deuxième ligne arrive, donc que la boîte ne bougera pas. */

  function adresseEnCours() {
    return '<span class="ou-addr-ic charge"><span class="spinner dark"></span></span>' +
           '<span class="ou-addr-t">' +
             '<b>Recherche de l’adresse…</b>' +
             '<span class="ou-skel"></span>' +
           '</span>';
  }

  function adresseTrouvee(label, lat, lng) {
    return '<span class="ou-addr-ic">' + UI.pin(17) + '</span>' +
           '<span class="ou-addr-t">' +
             '<b>' + (label ? U.esc(label) : 'Position sélectionnée') + '</b>' +
             '<span class="ou-addr-c">' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '</span>' +
           '</span>';
  }

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
