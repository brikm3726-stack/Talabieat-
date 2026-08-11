/* ==========================================================================
   LES DEUX MOTEURS DE CARTE — Google Maps, et OpenStreetMap en repli
   --------------------------------------------------------------------------
   POURQUOI DEUX, ET POURQUOI CE FICHIER

   Le module de cartes (mappicker.js) sait ce qu'il veut montrer : une position
   qu'on déplace, trois repères et un trajet, un aperçu figé. Il ne devrait pas
   savoir COMMENT on dessine une carte. Tant qu'il ne parlait qu'à Leaflet, la
   distinction n'avait pas d'intérêt ; le jour où il faut deux moteurs, elle
   devient la seule façon de ne pas écrire deux fois les mêmes six cents lignes
   d'interface.

   Ce fichier expose donc UN SEUL vocabulaire — `carte()`, `repere()`,
   `ligne()`, `cercle()`, `cadrer()` — et deux façons de le parler.

   POURQUOI GOOGLE REVIENT

   Il avait été écarté parce que Google exige une facturation active et que
   l'ajout de carte échouait en Algérie (OR_BACR2_44). Ce n'est plus le cas :
   vérifié le 10 août 2026 sur talabi.shop, la clé du projet charge l'API
   JavaScript, les tuiles de Tizi Ouzou arrivent, aucune erreur
   d'authentification, aucun filigrane « for development purposes only ».
   Ce que Google apporte ici et qu'OpenStreetMap ne donne pas : les rues, les
   commerces et les repères de Tizi Ouzou sont infiniment mieux renseignés —
   or toute cette application sert à trouver une porte.

   POURQUOI OPENSTREETMAP RESTE

   Une facturation peut être suspendue, une clé révoquée, un domaine changé.
   Le jour où cela arrive, Google n'affiche pas une erreur : il rend une carte
   grisée barrée d'un filigrane, ou rien. Sans repli, la commande devient
   impossible — on ne peut plus choisir son adresse. Le repli n'est donc pas
   une politesse d'ingénieur : c'est ce qui garde l'application utilisable un
   jour de panne, et il coûte les lignes qui étaient déjà écrites.

   LE CHOIX SE FAIT UNE FOIS PAR SESSION, et il est définitif : deux cartes de
   rendu différent dans un même écran se lisent comme un bug.
   ========================================================================== */
(function (w) {
  'use strict';

  const CFG = w.TALABI_CONFIG || {};
  const CLE = CFG.GOOGLE_MAPS_KEY || '';

  /* Tizi Ouzou. Le centre de repli quand on n'a aucune position à montrer. */
  const CITY = { lat: 36.7118, lng: 4.0458 };

  /* ---- Leaflet, servi depuis le dépôt ----
     Il arrivait d'unpkg.com : une carte qui dépend d'un domaine étranger est
     une carte qui ne s'affiche pas quand ce domaine est lent, filtré ou
     injoignable — ce qui arrive ici. Le CDN ne sert plus que de secours. */
  const LEAFLET_CSS = U.asset('assets/vendor/leaflet/leaflet.css');
  const LEAFLET_JS  = U.asset('assets/vendor/leaflet/leaflet.js');
  const LEAFLET_CSS_SECOURS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS_SECOURS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  const TUILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  // La licence OpenStreetMap impose de citer la source sur toute carte
  // affichée. Ce n'est pas décoratif : c'est la contrepartie du service.
  const CREDIT = '© OpenStreetMap';

  /* ==================================================================
     L'HABILLAGE DE LA CARTE GOOGLE
     ------------------------------------------------------------------
     Google affiche par défaut tous ses points d'intérêt, ses transports et
     ses parcs. Sur une carte de 200 px où l'on cherche SA porte, ces
     étiquettes recouvrent la seule information utile. On garde les routes et
     leurs noms, on éteint le reste.

     Écrit ici en `styles` et non côté Google : un style hébergé exige un
     identifiant de carte créé dans la console, donc une manipulation de plus
     à refaire le jour où le projet change de compte.
     ================================================================== */
  const STYLE_GOOGLE = [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    // les restaurants restent : c'est le sujet de l'application
    { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] }
  ];

  /* ------------------------------------------------------------------
     CHARGEMENT — une seule fois, à la première carte demandée
     ------------------------------------------------------------------
     Un client qui parcourt les menus sans ouvrir de carte ne paie ni le
     téléchargement ni, pour Google, le chargement facturé.
     ------------------------------------------------------------------ */
  let promesseGoogle = null;
  let promesseLeaflet = null;

  function script(src) {
    return new Promise((ok, ko) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = ok; s.onerror = () => ko(new Error(src));
      document.head.appendChild(s);
    });
  }

  function feuilleDeStyle(href) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = href;
    css.setAttribute('data-leaflet', '');
    document.head.appendChild(css);
    return css;
  }

  /**
   * Google, et la seule façon fiable de savoir s'il fonctionne.
   *
   * `gm_authFailure` EST LE SEUL SIGNAL. Le script se charge toujours, même
   * avec une clé révoquée ou une facturation suspendue : Google construit
   * alors une carte grisée et appelle cette fonction globale. Sans elle, on
   * croirait la carte affichée alors qu'elle est inutilisable.
   *
   * Elle peut être appelée LONGTEMPS APRÈS le chargement — à la première
   * carte construite, pas au premier script lu. D'où le drapeau `refusé`,
   * consulté à chaque nouvelle carte, et non une simple promesse rejetée.
   */
  let googleRefuse = false;

  function chargerGoogle() {
    if (!CLE) return Promise.resolve(false);
    if (googleRefuse) return Promise.resolve(false);
    if (promesseGoogle) return promesseGoogle;

    promesseGoogle = new Promise(resolve => {
      /* Les cartes DÉJÀ construites au moment du refus restent grisées : rien
         ne peut les réparer sur place. C'est la carte SUIVANTE qui sera dessinée
         par OpenStreetMap, donc au plus tard au prochain écran. Un client qui
         tombe pile sur la panne voit une carte grise une fois ; celui qui
         arrive après ne voit rien d'anormal. */
      w.gm_authFailure = function () {
        googleRefuse = true;
        moteurChoisi = null;
        console.warn('[carte] Google a refusé la clé — repli sur OpenStreetMap.');

        /* ON PRÉVIENT LES CARTES DÉJÀ CONSTRUITES, ET C'EST LE CORRECTIF QUI
           MANQUAIT. Avant, le repli ne valait que pour la carte SUIVANTE :
           celle qui était à l'écran restait telle que Google l'avait laissée —
           un cadre gris portant « Une erreur s'est produite ». L'utilisateur
           n'avait aucune raison de naviguer ailleurs pour la réparer, et
           l'application paraissait cassée alors qu'un moteur de secours
           attendait juste d'être appelé.

           Le refus arrive une seconde environ après l'affichage : le temps que
           Google interroge son serveur d'authentification. Une carte grise
           pendant une seconde, puis une vraie carte, c'est acceptable — un
           cadre gris définitif ne l'est pas. */
        w.dispatchEvent(new Event('carte:refusee'));
      };

      /* IL FAUT UN `callback`, ET CE N'EST PAS UNE PRÉFÉRENCE DE STYLE.
         Avec `loading=async` — que Google réclame, sous peine d'inscrire un
         avertissement de performance à chaque chargement — le script se charge
         SANS construire `google.maps.Map` : la bibliothèque n'est montée qu'au
         moment où le rappel est appelé. Tester `google.maps.Map` dans `onload`
         le trouvait donc toujours absent, et l'application retombait sur
         OpenStreetMap alors que Google fonctionnait parfaitement. Le rappel est
         le seul instant où l'on peut répondre à la question « est-il prêt ? ».

         `region=DZ` change les frontières affichées et le classement des
         résultats, `language=fr` les étiquettes. */
      const rappel = '__carteGooglePrete';
      let repondu = false;
      w[rappel] = function () {
        repondu = true;
        resolve(!!(w.google && w.google.maps && w.google.maps.Map));
      };

      const url = 'https://maps.googleapis.com/maps/api/js' +
        '?key=' + encodeURIComponent(CLE) +
        '&v=weekly&loading=async&language=fr&region=DZ' +
        '&libraries=places,geometry&callback=' + rappel;

      script(url).catch(() => { if (!repondu) resolve(false); });

      /* Un rappel qui n'arrive jamais — réseau coupé en cours de route, script
         filtré, clé sans domaine autorisé — laisserait la promesse en suspens
         et l'écran sur son message d'attente. Au bout de huit secondes, on
         considère que Google ne viendra pas. */
      setTimeout(() => { if (!repondu) resolve(false); }, 8000);
    });
    return promesseGoogle;
  }

  function chargerLeaflet() {
    if (w.L) return Promise.resolve(true);
    if (promesseLeaflet) return promesseLeaflet;

    promesseLeaflet = new Promise(resolve => {
      if (!document.querySelector('link[data-leaflet]')) feuilleDeStyle(LEAFLET_CSS);
      script(LEAFLET_JS)
        .then(() => resolve(!!w.L))
        .catch(() => {
          feuilleDeStyle(LEAFLET_CSS_SECOURS);
          return script(LEAFLET_JS_SECOURS).then(() => resolve(!!w.L));
        })
        .catch(() => resolve(false));
    });
    return promesseLeaflet;
  }

  /* ==================================================================
     LE REPÈRE HTML DE GOOGLE
     ------------------------------------------------------------------
     Les repères de l'application sont du HTML : un rond, un pictogramme du
     jeu maison, parfois l'enseigne du restaurant en fond, un scooter qui
     tourne selon son cap, une maison qui bat quand la livraison approche.
     Tout cela vit dans le CSS (`.lm-pin`), et doit continuer d'y vivre — le
     redessiner en images perdrait l'animation et la netteté.

     Google propose `AdvancedMarkerElement`, qui accepte du HTML… mais exige
     un identifiant de carte créé dans la console Google. Une manipulation de
     plus, à refaire à chaque changement de compte, pour un résultat que
     `OverlayView` donne sans rien demander. On prend `OverlayView`.

     Le positionnement se fait au `transform` et jamais en `left/top` : ce
     dernier déclenche une mise en page à chaque image, et il y a jusqu'à
     trois repères qui bougent en même temps sur l'écran de suivi.
     ================================================================== */
  function fabriquerRepereGoogle(gm) {
    function Repere(position, html, zIndex) {
      this.position = position;
      this.enveloppe = document.createElement('div');
      this.enveloppe.className = 'gm-repere';
      if (zIndex) this.enveloppe.style.zIndex = zIndex;
      this.enveloppe.innerHTML = '<div class="gm-repere-in">' + html + '</div>';
    }
    Repere.prototype = Object.create(gm.OverlayView.prototype);

    Repere.prototype.onAdd = function () {
      /* `overlayMouseTarget` et non `overlayLayer` : c'est le seul calque où
         un repère reçoit les clics. Une enseigne de restaurant qu'on ne peut
         pas toucher n'est qu'un dessin. */
      this.getPanes().overlayMouseTarget.appendChild(this.enveloppe);
    };
    Repere.prototype.draw = function () {
      const proj = this.getProjection();
      if (!proj) return;
      const p = proj.fromLatLngToDivPixel(this.position);
      if (!p) return;
      this.enveloppe.style.transform =
        'translate3d(' + Math.round(p.x) + 'px,' + Math.round(p.y) + 'px,0)';
    };
    Repere.prototype.onRemove = function () {
      if (this.enveloppe.parentNode) this.enveloppe.parentNode.removeChild(this.enveloppe);
    };
    Repere.prototype.placer = function (position) {
      this.position = position;
      this.draw();
    };
    Repere.prototype.element = function () {
      return this.enveloppe.firstChild;
    };
    return Repere;
  }

  /* ==================================================================
     MOTEUR GOOGLE
     ================================================================== */
  function moteurGoogle(el, o) {
    const gm = w.google.maps;
    const Repere = fabriquerRepereGoogle(gm);
    const fige = !!o.fige;

    const carte = new gm.Map(el, {
      center: { lat: o.lat, lng: o.lng },
      zoom: o.zoom || 14,
      styles: STYLE_GOOGLE,
      /* Les commandes par défaut de Google encombrent une carte de 200 px :
         plein écran, petit bonhomme, choix satellite. On ne garde que le zoom,
         et seulement là où la carte se manipule. */
      disableDefaultUI: true,
      zoomControl: !fige,
      clickableIcons: false,
      keyboardShortcuts: !fige,
      /* `none` fige vraiment : la carte laisse passer le doigt à la page qui
         défile derrière elle. Sur une carte qui se manipule, `greedy` prend au
         contraire le doigt sans demander la double-touche — celle-ci fait
         perdre trois secondes à qui veut simplement déplacer le repère. */
      gestureHandling: fige ? 'none' : 'greedy',
      maxZoom: 20
    });

    const repères = {};
    const lignes = {};
    let cercle = null;
    const animations = [];

    /* Google ne dit pas « les tuiles ont échoué », il dit « les tuiles sont
       arrivées ». L'absence de ce signal est ce qui tient lieu d'échec. */
    let chargees = false;
    gm.event.addListenerOnce(carte, 'tilesloaded', () => { chargees = true; });

    const versLatLng = p => ({ lat: +p.lat, lng: +p.lng });

    return {
      nom: 'google',
      natif: carte,

      pret: cb => gm.event.addListenerOnce(carte, 'idle', cb),
      tuilesRecues: () => chargees,

      centre() {
        const c = carte.getCenter();
        return { lat: c.lat(), lng: c.lng() };
      },

      allerA(lat, lng, zoom) {
        carte.setCenter({ lat: +lat, lng: +lng });
        if (zoom) carte.setZoom(zoom);
      },

      /* Google n'a pas d'équivalent de `flyTo` : `panTo` glisse mais ne
         zoome pas. Le vol d'approche se fait donc en deux temps — on pose le
         zoom large, puis on laisse `panTo` glisser et on resserre. */
      voler(lat, lng, zoom) {
        carte.panTo({ lat: +lat, lng: +lng });
        if (zoom) setTimeout(() => carte.setZoom(zoom), 420);
      },

      sur(evt, fn) {
        const noms = { bouge: 'center_changed', finBouge: 'idle', traine: 'dragstart' };
        if (noms[evt]) carte.addListener(noms[evt], fn);
      },

      cadrer(points, marges, anime) {
        if (!points.length) return;
        if (points.length === 1) {
          carte[anime ? 'panTo' : 'setCenter'](versLatLng(points[0]));
          return;
        }
        const b = new gm.LatLngBounds();
        points.forEach(p => b.extend(versLatLng(p)));
        /* Google accepte les quatre marges séparément, ce qui sert exactement
           au même cas que dans Leaflet : en plein écran, une feuille couvre le
           bas et une barre le haut, et centrer sur la zone entière plaçait le
           livreur sous la feuille. */
        carte.fitBounds(b, marges || 42);

        /* GOOGLE N'A PAS DE `maxZoom` SUR LE CADRAGE, LEAFLET SI — et cette
           limite n'était pas décorative : quand le livreur arrive devant la
           porte, les deux repères se touchent, et un cadrage sans plafond
           zoome alors jusqu'au trottoir. On ne voit plus que du bitume au
           moment précis où l'on veut voir le quartier. Le plafond se remet
           après coup, une fois le cadrage calculé. */
        gm.event.addListenerOnce(carte, 'idle', () => {
          if (carte.getZoom() > 16) carte.setZoom(16);
        });
      },

      repere(cle, p, html, zIndex) {
        const pos = new gm.LatLng(+p.lat, +p.lng);
        if (repères[cle]) { repères[cle].placer(pos); return repères[cle]; }
        const r = new Repere(pos, html, zIndex);
        r.setMap(carte);
        repères[cle] = r;
        return r;
      },
      elementRepere(cle) { return repères[cle] ? repères[cle].element() : null; },
      retirerRepere(cle) {
        if (!repères[cle]) return;
        repères[cle].setMap(null);
        delete repères[cle];
      },
      positionsReperes() {
        return Object.keys(repères).map(k => ({
          lat: repères[k].position.lat(), lng: repères[k].position.lng()
        }));
      },

      /**
       * Un trait. `style.flux` demande les pointillés qui filent dessus.
       *
       * Leaflet animait les pointillés en CSS, sur le SVG. Google dessine ses
       * traits en canevas : il n'y a pas de SVG à animer, et la seule voie est
       * de décaler l'origine du motif à intervalle régulier. C'est la méthode
       * que Google documente lui-même pour les « symboles animés ».
       */
      ligne(cle, coords, style) {
        if (coords.length < 2) { this.retirerLigne(cle); return; }
        const chemin = coords.map(versLatLng);

        if (lignes[cle]) { lignes[cle].setPath(chemin); return; }

        const opts = {
          path: chemin, map: carte, clickable: false,
          strokeColor: style.couleur,
          strokeOpacity: style.flux ? 0 : style.opacite,
          strokeWeight: style.epaisseur,
          zIndex: style.flux ? 3 : 1
        };
        if (style.flux) {
          opts.icons = [{
            icon: {
              path: 'M 0,-1 0,1',
              strokeColor: '#fff', strokeOpacity: .95, strokeWeight: 3, scale: 3
            },
            offset: '0', repeat: '14px'
          }];
        }
        const l = new gm.Polyline(opts);
        lignes[cle] = l;

        /* Le mouvement des pointillés est coupé si l'appareil demande moins
           d'animation : c'est un ornement, pas une information. */
        const doux = !(w.matchMedia &&
                       w.matchMedia('(prefers-reduced-motion: reduce)').matches);
        if (style.flux && doux) {
          let pas = 0;
          const t = setInterval(() => {
            pas = (pas + 1) % 100;
            const ic = l.get('icons');
            if (!ic) return;
            ic[0].offset = pas + '%';
            l.set('icons', ic);
          }, 60);
          animations.push(t);
        }
      },
      retirerLigne(cle) {
        if (!lignes[cle]) return;
        lignes[cle].setMap(null);
        delete lignes[cle];
      },

      cercle(p, rayonM, style) {
        if (cercle) cercle.setMap(null);
        cercle = new gm.Circle({
          map: carte, center: versLatLng(p), radius: rayonM, clickable: false,
          strokeColor: style.couleur, strokeOpacity: .55, strokeWeight: 1.5,
          fillColor: style.couleur, fillOpacity: .07
        });
      },

      /* Google se remesure seul au redimensionnement de la fenêtre, mais pas
         quand c'est SON conteneur qui change de taille — une feuille qui
         s'ouvre, un onglet qui devient visible. Le centre est relu et reposé,
         sinon la carte se recadre sur le coin haut-gauche. */
      remesurer() {
        const c = carte.getCenter();
        gm.event.trigger(carte, 'resize');
        carte.setCenter(c);
      },

      detruire() {
        animations.forEach(clearInterval);
        Object.keys(repères).forEach(k => repères[k].setMap(null));
        Object.keys(lignes).forEach(k => lignes[k].setMap(null));
        if (cercle) cercle.setMap(null);
        gm.event.clearInstanceListeners(carte);
        el.innerHTML = '';
      }
    };
  }

  /* ==================================================================
     MOTEUR OPENSTREETMAP — le même vocabulaire, dit en Leaflet
     ================================================================== */
  function moteurOSM(el, o) {
    const fige = !!o.fige;

    const carte = L.map(el, Object.assign({
      zoomControl: !fige, attributionControl: true
    }, fige ? {
      dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
      touchZoom: false, boxZoom: false, keyboard: false, tap: false
    } : null)).setView([o.lat, o.lng], o.zoom || 14);

    let recues = 0, rates = 0;
    const tuiles = L.tileLayer(TUILES, { maxZoom: 19, attribution: CREDIT });
    tuiles.on('tileload', () => { recues++; });
    tuiles.on('tileerror', () => { rates++; });
    tuiles.addTo(carte);

    const repères = {};
    const lignes = {};
    let cercle = null;

    /* LE REPÈRE EST CENTRÉ PAR SON ENFANT, PAS PAR LEAFLET.
       Leaflet positionne l'élément du repère avec un `transform` : y ajouter
       le nôtre pour le centrer l'écraserait, et tous les repères se
       retrouveraient dans le coin haut-gauche de la carte. On lui donne donc
       une icône de taille nulle, ancrée sur le point, et c'est l'enfant qui se
       recentre — exactement le même enfant, avec la même classe, que du côté
       de Google. Une seule règle CSS habille les deux moteurs. */
    const icone = html => L.divIcon({
      className: '', html: '<div class="gm-repere-in">' + html + '</div>',
      iconSize: [0, 0], iconAnchor: [0, 0]
    });

    return {
      nom: 'osm',
      natif: carte,

      pret: cb => setTimeout(cb, 0),
      tuilesRecues: () => recues > 0,
      tuilesRatees: () => rates,

      centre() {
        const c = carte.getCenter();
        return { lat: c.lat, lng: c.lng };
      },
      allerA(lat, lng, zoom) { carte.setView([+lat, +lng], zoom || carte.getZoom()); },
      voler(lat, lng, zoom) { carte.flyTo([+lat, +lng], zoom || carte.getZoom(), { duration: 1.2 }); },

      sur(evt, fn) {
        const noms = { bouge: 'move', finBouge: 'moveend', traine: 'dragstart' };
        if (noms[evt]) carte.on(noms[evt], fn);
      },

      cadrer(points, marges, anime) {
        if (!points.length) return;
        if (points.length === 1) {
          carte[anime ? 'panTo' : 'setView'](
            [+points[0].lat, +points[0].lng],
            anime ? { animate: true, duration: .8 } : carte.getZoom());
          return;
        }
        const b = points.map(p => [+p.lat, +p.lng]);
        const m = marges && typeof marges === 'object'
          ? { maxZoom: 16, paddingTopLeft: [marges.left, marges.top],
              paddingBottomRight: [marges.right, marges.bottom] }
          : { maxZoom: 16, padding: [marges || 42, marges || 42] };
        if (anime) carte.flyToBounds(b, Object.assign(m, { duration: .8 }));
        else carte.fitBounds(b, m);
      },

      repere(cle, p, html, zIndex) {
        const ll = [+p.lat, +p.lng];
        if (repères[cle]) { repères[cle].setLatLng(ll); return repères[cle]; }
        repères[cle] = L.marker(ll, {
          icon: icone(html), zIndexOffset: zIndex || 0, interactive: true
        }).addTo(carte);
        return repères[cle];
      },
      /* L'élément rendu est l'ENFANT, celui qui porte le contenu — le même que
         du côté de Google. Les appelants y cherchent `.lm-pin` pour orienter le
         scooter ou faire battre la maison. */
      elementRepere(cle) {
        const e = repères[cle] && repères[cle].getElement();
        return e ? e.firstChild : null;
      },
      retirerRepere(cle) {
        if (!repères[cle]) return;
        carte.removeLayer(repères[cle]);
        delete repères[cle];
      },
      positionsReperes() {
        return Object.keys(repères).map(k => {
          const ll = repères[k].getLatLng();
          return { lat: ll.lat, lng: ll.lng };
        });
      },

      ligne(cle, coords, style) {
        if (coords.length < 2) { this.retirerLigne(cle); return; }
        const ll = coords.map(p => [+p.lat, +p.lng]);
        if (lignes[cle]) { lignes[cle].setLatLngs(ll); return; }
        lignes[cle] = L.polyline(ll, style.flux
          ? { color: '#fff', weight: 3, opacity: .95, lineCap: 'round',
              dashArray: '2 14', className: 'lm-flux' }
          : { color: style.couleur, weight: style.epaisseur, opacity: style.opacite,
              lineCap: 'round', lineJoin: 'round' }).addTo(carte);
      },
      retirerLigne(cle) {
        if (!lignes[cle]) return;
        carte.removeLayer(lignes[cle]);
        delete lignes[cle];
      },

      cercle(p, rayonM, style) {
        if (cercle) carte.removeLayer(cercle);
        cercle = L.circle([+p.lat, +p.lng], {
          radius: rayonM, color: style.couleur, weight: 1.5, opacity: .55,
          fillColor: style.couleur, fillOpacity: .07, interactive: false
        }).addTo(carte);
      },

      remesurer() { carte.invalidateSize(); },
      detruire() { try { carte.remove(); } catch (e) {} }
    };
  }

  /* ==================================================================
     LE CHOIX DU MOTEUR
     ================================================================== */
  let moteurChoisi = null;

  /**
   * Charge le meilleur moteur disponible et retourne son nom, ou null si
   * aucune carte n'est possible (hors ligne, scripts bloqués).
   *
   * Le choix est mémorisé : deux cartes de rendu différent dans la même
   * session se lisent comme un défaut, pas comme une adaptation.
   */
  async function preparer() {
    if (moteurChoisi && !(moteurChoisi === 'google' && googleRefuse)) return moteurChoisi;

    if (CLE && !googleRefuse && await chargerGoogle()) {
      moteurChoisi = 'google';
      return moteurChoisi;
    }
    if (await chargerLeaflet()) {
      moteurChoisi = 'osm';
      return moteurChoisi;
    }
    return null;
  }

  /** Construit une carte avec le moteur retenu. */
  function creer(el, opts) {
    const o = Object.assign({ lat: CITY.lat, lng: CITY.lng }, opts || {});
    if (moteurChoisi === 'google' && !googleRefuse) return moteurGoogle(el, o);
    if (w.L) return moteurOSM(el, o);
    return null;
  }

  /* ==================================================================
     L'ITINÉRAIRE PAR LES RUES — seulement chez Google
     ------------------------------------------------------------------
     Un trait droit entre le livreur et sa destination dit dans quel sens
     ça va, pas par où ça passe. Google le sait : la « Directions API »
     renvoie le VRAI tracé, celui qui suit les rues. C'est un service
     séparé de l'affichage de la carte — comme Geocoding et Places en
     leur temps — et il s'active À PART dans la console Google. Tant qu'il
     répond REQUEST_DENIED, cette fonction renvoie `null` et l'appelant
     (`MapPicker.live`) garde son trait droit : rien ne casse, on perd
     seulement la précision de rue.

     Le refus n'est demandé qu'UNE FOIS par session — même mécanique que
     l'annuaire d'adresses dans mappicker.js — pour ne pas cogner
     inutilement contre une API désactivée à chaque relevé de position.
     OpenStreetMap n'a pas d'équivalent gratuit et fiable ici : le trait
     droit reste son seul tracé, ce qui est cohérent avec son rôle de
     repli simple plutôt que de second moteur complet.
     ================================================================== */
  let directionsRefuse = false;
  let directionsService = null;

  function itineraire(a, b) {
    if (moteurChoisi !== 'google' || googleRefuse || directionsRefuse)
      return Promise.resolve(null);
    const gm = w.google && w.google.maps;
    if (!gm || !gm.DirectionsService) return Promise.resolve(null);
    if (!directionsService) directionsService = new gm.DirectionsService();

    return new Promise(resolve => {
      directionsService.route({
        origin: { lat: +a.lat, lng: +a.lng },
        destination: { lat: +b.lat, lng: +b.lng },
        travelMode: gm.TravelMode.DRIVING
      }, (rep, statut) => {
        if (statut !== 'OK' || !rep || !rep.routes || !rep.routes[0]) {
          if (statut === 'REQUEST_DENIED' || statut === 'OVER_QUERY_LIMIT') {
            directionsRefuse = true;
            console.info('[carte] Directions API indisponible (' + statut +
                         ') — trajets en ligne droite pour cette session.');
          }
          return resolve(null);
        }
        /* `overview_path` : déjà décodé en points {lat,lng}, assez détaillé
           pour suivre les rues visuellement sans demander la bibliothèque
           `geometry` ni décoder le polyline à la main. */
        const chemin = rep.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
        resolve(chemin.length >= 2 ? chemin : null);
      });
    });
  }

  w.MapEngine = {
    CITY: CITY,
    preparer: preparer,
    creer: creer,
    itineraire: itineraire,
    get nom() { return moteurChoisi; },
    get googleDispo() { return !!CLE && !googleRefuse; }
  };
})(window);
