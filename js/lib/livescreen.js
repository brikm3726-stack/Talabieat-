/* ==========================================================================
   ÉCRAN DE SUIVI EN DIRECT — plein écran, carte au fond, feuille devant
   --------------------------------------------------------------------------
   Le suivi existait déjà des deux côtés, mais en petite carte posée dans une
   page qui défile : le client faisait défiler pour retrouver son livreur, et
   le livreur devait passer par son tableau de bord pour voir où il allait.
   Or c'est l'écran qu'on garde ouvert — celui qu'on regarde au feu rouge,
   celui qu'on rouvre toutes les deux minutes en attendant sa commande. Il ne
   doit rien demander d'autre que de regarder.

   D'où cette forme, reprise de la maquette 2a : la carte occupe tout, une
   feuille blanche tient le reste — les minutes qui restent, où l'on en est,
   la personne à joindre, et le seul geste qui compte.

   Le module ne sait rien du client ni du livreur : il pose le décor et le
   cycle de rafraîchissement, chaque rôle écrit sa feuille. Sans ça, deux
   écrans presque identiques auraient divergé au premier correctif.
   ========================================================================== */
(function (w) {
  'use strict';

  const LiveScreen = {

    /**
     * LiveScreen.open(view, cfg) → { repaint(), destroy() }
     *
     *   code    numéro de commande affiché dans la barre du haut
     *   back    adresse du bouton retour (par défaut : page précédente)
     *   points  () => { restaurant, client, driver } — les repères de la carte
     *   sheet   () => HTML de la feuille du bas, redessinée à chaque tour
     *   bind    (feuille) => void — branche les boutons après chaque dessin
     *   etat    () => HTML | '' — ce qui manque, posé sur la carte
     *   bindEtat(bandeau) => void — branche le bouton du bandeau, s'il y en a
     *   fetch   async () => void — va chercher les données, avant chaque dessin
     *   every   millisecondes entre deux tours (défaut 12 000)
     */
    open(view, cfg) {
      cfg = cfg || {};

      /* Le plein écran passe par <body> : la barre du haut et celle du bas
         vivent hors de #view, la page ne peut pas les cacher elle-même. */
      document.body.classList.add('lv-open');

      view.innerHTML =
        '<div class="lv">' +
          '<div class="lv-map" id="lvMap"></div>' +

          '<div class="lv-top">' +
            '<button class="lv-glass" id="lvBack" title="Retour" aria-label="Retour">' +
              '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M15 18l-6-6 6-6"/></svg></button>' +
            '<span class="lv-glass lv-code"><i class="lv-dot"></i>' +
              U.esc(cfg.code || '') + '</span>' +
            '<button class="lv-glass lv-fit" id="lvFit" title="Recentrer" aria-label="Recentrer">' +
              UI.icon('navigation', 19) + '</button>' +
          '</div>' +

          /* Ce qui manque, dit sur la carte elle-même. Une carte de Tizi Ouzou
             sans le moindre repère est le pire des affichages : elle a l'air
             cassée alors qu'elle attend simplement une position que personne
             ne lui a encore donnée. */
          '<div class="lv-etat" id="lvEtat" hidden></div>' +

          '<div class="lv-sheet" id="lvSheet"></div>' +
        '</div>';

      const sheet = view.querySelector('#lvSheet');
      const etatEl = view.querySelector('#lvEtat');

      /* Carte libre, pas figée : l'écran ne défile pas, le doigt n'a donc rien
         d'autre à faire dessus que déplacer la carte.

         `suit` : elle se recadre à chaque position reçue — c'est tout l'objet
         de l'écran. `marges` lui dit où elle est vraiment visible : sans ça
         elle centre sur la zone entière et place le livreur sous la feuille,
         c'est-à-dire nulle part. La hauteur est relue à chaque cadrage,
         puisque la feuille grandit avec son contenu. */
      const map = MapPicker.live(view.querySelector('#lvMap'), points(), {
        suit: true,
        marges: () => ({
          tl: [22, 74],
          br: [22, (sheet.offsetHeight || 320) + 28]
        }),
        onEchec(raison) {
          const el = view.querySelector('#lvMap');
          if (!el) return;
          el.classList.add('ko');
          el.innerHTML = '<div class="lv-mapko"><span class="art">🗺️</span>' +
            '<b>La carte ne s’affiche pas</b>' +
            '<span>Le suivi continue : les informations ci-dessous restent à jour.</span>' +
            (raison ? '<span class="tiny">' + U.esc(raison) + '</span>' : '') + '</div>';
        }
      });

      function points() { return (cfg.points && cfg.points()) || {}; }

      view.querySelector('#lvBack').onclick = () =>
        cfg.back ? Router.go(cfg.back) : Router.back();
      view.querySelector('#lvFit').onclick = () => map && map.recenter();

      function repaint() {
        if (!sheet.isConnected) return;
        sheet.innerHTML = (cfg.sheet && cfg.sheet()) || '';
        if (cfg.bind) cfg.bind(sheet);

        const etat = cfg.etat && cfg.etat();
        etatEl.innerHTML = etat || '';
        etatEl.hidden = !etat;
        if (cfg.bindEtat && etat) cfg.bindEtat(etatEl);

        if (map) map.update(points());
      }

      let timer = null;
      async function tour() {
        if (!sheet.isConnected) return;
        if (cfg.fetch) await cfg.fetch();
        repaint();
      }

      repaint();
      tour();
      timer = setInterval(tour, cfg.every || 12000);

      return {
        repaint: repaint,
        destroy() {
          document.body.classList.remove('lv-open');
          if (timer) { clearInterval(timer); timer = null; }
          if (map) map.destroy();
        }
      };
    },

    /* ================================================== morceaux de feuille
       Communs aux deux rôles : c'est ce qui fait que le livreur et le client
       regardent le même écran, et non deux écrans qui se ressemblent. */

    /** La poignée : elle dit que le panneau est une feuille posée sur la carte. */
    grab() { return '<div class="lv-grab"><span></span></div>'; },

    /**
     * Le chiffre qu'on vient chercher, en grand — 8 min — et ce qui le
     * nuance en petit à côté. Un libellé en capitales au-dessus, parce que
     * « 8 min » seul ne dit pas de quoi il s'agit.
     */
    eta(titre, valeur, apres) {
      return '<div class="lv-k">' + U.esc(titre) + '</div>' +
        '<div class="lv-eta"><b>' + U.esc(valeur) + '</b>' +
        (apres ? '<span>· ' + U.esc(apres) + '</span>' : '') + '</div>';
    },

    /**
     * Où l'on en est : quatre segments et leurs noms. Le segment courant est
     * plein et son nom en gras — la frise verticale de Cmp.timeline dirait la
     * même chose, mais elle prendrait la moitié de la feuille.
     */
    progress(etapes, idx) {
      return '<div class="lv-bars">' +
          etapes.map((_, i) => '<i class="' + (i <= idx ? 'on' : '') + '"></i>').join('') +
        '</div>' +
        '<div class="lv-steps">' +
          etapes.map((e, i) => '<span class="' + (i === idx ? 'on' : '') + '">' +
            U.esc(e) + '</span>').join('') +
        '</div>';
    },

    /**
     * La personne d'en face : le livreur pour le client, le client pour le
     * livreur. Le téléphone est un bouton, pas un numéro à recopier — on
     * l'appelle en roulant, ou avec un sac dans l'autre main.
     *
     * `meta` est du HTML (une ligne peut porter une icône ou du gras) : c'est
     * à l'appelant d'échapper ce qui vient de la base. `name` est échappé ici.
     */
    person(p) {
      p = p || {};
      return '<div class="lv-who">' +
        '<span class="lv-ini">' + U.esc(U.initials(p.name || '')) + '</span>' +
        '<div class="grow"><div class="n">' + U.esc(p.name || '') + '</div>' +
          (p.meta ? '<div class="m">' + p.meta + '</div>' : '') + '</div>' +
        (p.phone
          ? '<a class="lv-call" href="tel:' + U.esc(p.phone) + '" title="Appeler" ' +
              'aria-label="Appeler ' + U.esc(p.name || '') + '">' + UI.icon('phone', 21) + '</a>'
          : '') +
        (p.route
          ? '<a class="lv-nav" href="' + U.escUrl(p.route) + '" target="_blank" rel="noopener" ' +
              'title="Itinéraire" aria-label="Itinéraire">' + UI.icon('navigation', 20) + '</a>'
          : '') +
      '</div>';
    },

    /** Un rappel encadré, sous la personne : l'argent à préparer, une consigne. */
    note(icone, html) {
      return '<div class="lv-note"><span class="ic">' + icone + '</span>' +
        '<span class="tx">' + html + '</span></div>';
    },

    /**
     * Le seul geste de l'écran, pleine largeur.
     * `attrs` reçoit les attributs de branchement du rôle (data-…) : c'est le
     * bouton lui-même qui les porte, pour que le témoin d'attente s'affiche
     * dessus et empêche le second appui.
     */
    action(libelle, attrs, cls) {
      return '<button class="btn ' + (cls || 'btn-primary') + ' btn-block btn-lg lv-act" ' +
        (attrs || '') + '>' + libelle + '</button>';
    },

    /* ------------------------------------------------------------ distances
       Une distance à vol d'oiseau majorée d'un tiers : les rues ne vont pas
       droit. Approximation assumée — annoncer 800 m puis en faire rouler
       1 200 use plus la confiance qu'un chiffre prudent. */
    trajet(de, vers) {
      if (!de || !vers || !U.hasCoords(de) || !U.hasCoords(vers)) return null;
      const km = U.haversine(+de.lat, +de.lng, +vers.lat, +vers.lng) * 1.3;
      return {
        km: km,
        /* ~22 km/h : la vitesse d'un scooter en ville, feux et piétons
           compris. Jamais moins d'une minute — « 0 min » ne veut rien dire. */
        min: Math.max(1, Math.round(km / 22 * 60)),
        texte: km < 1 ? Math.round(km * 1000) + ' m restants' : km.toFixed(1) + ' km restants'
      };
    }
  };

  w.LiveScreen = LiveScreen;
})(window);
