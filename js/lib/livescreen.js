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
     *   plan    () => { etapes, opts } — le plan de fond, sous la carte
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
          /* LE PLAN, AU FOND — c'est lui qu'on voit tant que la carte n'est pas
             là, et il occupe toute la place laissée libre. Cette zone restait
             vide pendant que la carte cherchait ses tuiles : la plus grande
             partie de l'écran ne disait rien, au moment précis où l'on regarde
             l'écran pour savoir quelque chose.

             La carte se pose par-dessus quand elle réussit — mais elle n'est
             plus le seul plan de l'écran, seulement le meilleur des deux. */
          '<div class="lv-fond" id="lvFond"></div>' +

          /* Le message d'attente n'est plus un panneau qui couvre tout : le
             fond a désormais quelque chose à montrer, et le masquer pour dire
             « je charge » serait un mauvais échange. */
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
          /* Juste après le bandeau, et non ailleurs : c'est cette adjacence qui
             permet à la pastille de descendre quand le bandeau occupe déjà sa
             hauteur (voir app.css). */
          '<div class="lv-etatcarte" id="lvEtatCarte">' +
            '<span class="spinner dark"></span>Carte…</div>' +

          '<div class="lv-sheet" id="lvSheet"></div>' +
        '</div>';

      const sheet = view.querySelector('#lvSheet');
      const etatEl = view.querySelector('#lvEtat');
      const fond = view.querySelector('#lvFond');
      const etatCarte = view.querySelector('#lvEtatCarte');

      /* Carte libre, pas figée : l'écran ne défile pas, le doigt n'a donc rien
         d'autre à faire dessus que déplacer la carte.

         `suit` : elle se recadre à chaque position reçue — c'est tout l'objet
         de l'écran. `marges` lui dit où elle est vraiment visible : sans ça
         elle centre sur la zone entière et place le livreur sous la feuille,
         c'est-à-dire nulle part. La hauteur est relue à chaque cadrage,
         puisque la feuille grandit avec son contenu. */
      /* La panne de la carte tient maintenant dans une pastille : le plan du
         fond répond déjà à la question, la carte n'est plus qu'un supplément.
         Dire la raison reste utile — c'est elle qui permet de réparer — mais
         elle n'a plus à occuper l'écran entier. */
      const panne = raison => {
        if (!etatCarte) return;
        etatCarte.classList.add('ko');
        etatCarte.innerHTML = '🗺️ ' + U.esc(raison || 'Carte indisponible');
      };

      const map = MapPicker.live(view.querySelector('#lvMap'), points(), {
        suit: true,
        /* La hauteur OCCUPÉE, pas la hauteur totale : quand la feuille est
           descendue, la place qu'elle libère revient à la carte. */
        marges: () => ({ tl: [22, 74], br: [22, occupe()] }),
        /* Leaflet est en place : la pastille d'attente disparaît. */
        onPret() { if (etatCarte) etatCarte.remove(); },
        onEchec: panne
      });

      /* Retour null : le conteneur manquait. C'était jusqu'ici la seule panne
         totalement muette — aucun message n'était même tenté. */
      if (!map) panne('Le cadre de la carte est introuvable.');

      function points() { return (cfg.points && cfg.points()) || {}; }

      view.querySelector('#lvBack').onclick = () =>
        cfg.back ? Router.go(cfg.back) : Router.back();
      view.querySelector('#lvFit').onclick = () => map && map.recenter();

      function repaint() {
        if (!sheet.isConnected) return;
        sheet.innerHTML = (cfg.sheet && cfg.sheet()) || '';
        if (cfg.bind) cfg.bind(sheet);

        /* Le plan du fond suit le même rythme, mais il n'est pas reconstruit :
           on ne déplace que ce qui a bougé, pour que le livreur glisse au lieu
           de se téléporter d'un relevé à l'autre. */
        if (cfg.plan && fond) {
          const p = cfg.plan();
          if (p) {
            /* La part réservée en bas est MESURÉE, pas fixée d'avance : c'est
               ce qui fait que le trajet se déplie quand on descend la feuille.
               Une valeur en dur laisserait les trois repères tassés en haut
               d'un écran devenu libre. */
            const h = w.innerHeight || 800;
            const opts = Object.assign({}, p.opts || {}, {
              bas: Math.max(6, Math.min(58, Math.round(occupe() / h * 100)))
            });
            LiveScreen.planMaj(fond, p.etapes || [], opts);
          }
        }

        const etat = cfg.etat && cfg.etat();
        etatEl.innerHTML = etat || '';
        etatEl.hidden = !etat;
        if (cfg.bindEtat && etat) cfg.bindEtat(etatEl);

        if (map) map.update(points());
      }

      /* ================================================== LA FEUILLE SE TIRE
         La poignée ressemblait à une poignée et n'en était pas une : on tirait
         dessus, rien ne bougeait, et le plan restait à moitié caché sous la
         feuille. Or c'est bien la carte qu'on veut voir en entier quand on
         suit un livreur — la feuille, on l'a déjà lue.

         Deux positions seulement, pas un curseur libre : en haut, tout se lit ;
         en bas, il reste l'essentiel — la poignée et les minutes restantes.
         Deux crans se retiennent, un réglage continu se re-règle sans cesse.

         Ce qui compte autant que le geste : la carte ET le plan se recadrent
         sur la place libérée. Descendre la feuille pour découvrir une carte
         cadrée comme si elle était encore haute n'aurait rien découvert. */
      let dy = 0;
      const RESTE = 112;                      // ce qui reste visible en bas
      const course = () => Math.max(0, sheet.offsetHeight - RESTE);
      /* Hauteur réellement occupée par la feuille, une fois descendue : c'est
         elle qui borne le cadrage, pas la hauteur totale. */
      const occupe = () => Math.max(0, sheet.offsetHeight - dy) + 28;

      function poser(v) {
        dy = Math.max(0, Math.min(course(), v));
        sheet.style.setProperty('--dy', dy + 'px');
      }

      /* Après un cran, on redonne à la carte et au plan la place gagnée. */
      function recadrer() {
        if (map) { map.nudge(); map.recenter(); }
        repaint();
      }

      /* Les écouteurs vivent sur la FEUILLE, pas sur la poignée : celle-ci est
         recréée à chaque rafraîchissement — toutes les six secondes — et un
         écouteur posé dessus disparaîtrait avec elle au premier tour.

         La zone de prise est la bande du haut. La saisir n'importe où
         empêcherait de faire défiler le contenu de la feuille quand il dépasse,
         et deux gestes dans la même zone finissent toujours par se marcher
         dessus. */
      const PRISE = 46;
      let depart = null;

      const prise = e => {
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        if (y - sheet.getBoundingClientRect().top > PRISE) return;
        depart = { y: y, dy: dy, bouge: false };
        sheet.classList.add('glisse');
      };
      const glisse = e => {
        if (!depart) return;
        const y = e.touches ? e.touches[0].clientY : e.clientY;
        if (Math.abs(y - depart.y) > 3) depart.bouge = true;
        poser(depart.dy + (y - depart.y));
        /* Sans quoi le geste fait aussi défiler la page derrière. */
        if (e.cancelable) e.preventDefault();
      };
      const lache = () => {
        if (!depart) return;
        sheet.classList.remove('glisse');
        /* Un appui sans glissement vaut bascule : c'est le geste le plus
           naturel sur une poignée, et il évite d'avoir à viser un mouvement. */
        if (!depart.bouge) poser(dy > 0 ? 0 : course());
        else poser(dy > course() / 2 ? course() : 0);
        depart = null;
        setTimeout(recadrer, 320);            // une fois le cran atteint
      };

      sheet.addEventListener('touchstart', prise, { passive: true });
      sheet.addEventListener('touchmove', glisse, { passive: false });
      sheet.addEventListener('touchend', lache);
      sheet.addEventListener('mousedown', e => {
        prise(e);
        if (!depart) return;
        const m = ev => glisse(ev);
        const u = () => {
          lache();
          document.removeEventListener('mousemove', m);
          document.removeEventListener('mouseup', u);
        };
        document.addEventListener('mousemove', m);
        document.addEventListener('mouseup', u);
      });

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
     * LA TIMELINE — six étapes, de l'acceptation à la porte.
     *
     * Les statuts de la base n'en comptent que quatre entre l'acceptation et la
     * livraison : le reste se déduit, et se déduit honnêtement.
     *
     *   Commande acceptée    ← accepted_at
     *   Restaurant prêt      ← ready_at
     *   Commande récupérée   ← delivering_at
     *   En route             ← récupérée, et le livreur a quitté le restaurant
     *   Arrivé chez le client← il est à moins de cent cinquante mètres
     *   Livrée               ← delivered_at
     *
     * Les deux étapes déduites le sont par la géométrie, pas par un minuteur :
     * « en route » quand il s'est éloigné du restaurant, « arrivé » quand il est
     * à la porte. Rien n'est inventé — ce sont les positions réelles qui le
     * disent, et c'est plus juste qu'un statut que personne n'irait cocher en
     * conduisant.
     *
     * etapes : [{ t, quand, fait, ici }]
     */
    timeline(etapes) {
      return '<div class="lv-tl">' + etapes.map((e, i) => {
        const cls = 'lv-tl-e' + (e.fait ? ' fait' : '') + (e.ici ? ' ici' : '');
        return '<div class="' + cls + '" style="animation-delay:' +
            (i * 60) + 'ms">' +
            '<span class="lv-tl-p"></span>' +
            '<span class="lv-tl-t">' + U.esc(e.t) + '</span>' +
            (e.quand ? '<span class="lv-tl-h">' + U.esc(e.quand) + '</span>' : '') +
          '</div>';
      }).join('') + '</div>';
    },

    /**
     * La personne d'en face : le livreur pour le client, le client pour le
     * livreur. Le téléphone est un bouton, pas un numéro à recopier — on
     * l'appelle en roulant, ou avec un sac dans l'autre main.
     *
     * `meta` est du HTML (une ligne peut porter une icône ou du gras) : c'est
     * à l'appelant d'échapper ce qui vient de la base. `name` est échappé ici.
     * `photo` remplace les initiales quand le livreur en a une ; `sms` ajoute le
     * bouton message à côté de l'appel.
     */
    person(p) {
      p = p || {};
      return '<div class="lv-who">' +
        /* La photo si elle existe, les initiales sinon — jamais une silhouette
           grise, qui donne l'impression d'un compte vide. */
        '<span class="lv-ini"' +
          (p.photo ? ' style="background-image:url(' + U.escUrl(p.photo) + ')"' : '') + '>' +
          (p.photo ? '' : U.esc(U.initials(p.name || ''))) + '</span>' +
        '<div class="grow"><div class="n">' + U.esc(p.name || '') + '</div>' +
          (p.meta ? '<div class="m">' + p.meta + '</div>' : '') + '</div>' +
        (p.sms
          ? '<a class="lv-msg" href="sms:' + U.esc(p.sms) + '" title="Message" ' +
              'aria-label="Envoyer un message">' + UI.icon('mail', 20) + '</a>'
          : '') +
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

    /**
     * LE CHEMIN EN 2D — livreur → restaurant → client.
     *
     * Un plan dessiné en SVG, à partir des vraies coordonnées : les positions
     * relatives sont donc justes — si le livreur est au nord-est du
     * restaurant, il apparaît au nord-est. Ce n'est pas une carte pour autant,
     * et ça ne cherche pas à l'être : pas de rues, pas de noms, pas de tuiles
     * à télécharger. Juste les trois points et la route entre eux.
     *
     * C'est précisément ce qui le rend increvable. Une carte dépend d'un
     * moteur, d'un fournisseur de tuiles et d'un réseau qui répond ; ce plan ne
     * dépend de rien. Il répond aux deux seules questions qu'on se pose en
     * attendant son repas — où en est-il, combien de temps encore — et il y
     * répond même au fond d'une cave.
     *
     * Le tracé est coudé, pas droit : on ne va jamais à vol d'oiseau, et deux
     * angles droits suffisent à faire lire « un trajet » plutôt qu'« une
     * distance ». Le tronçon en cours est orange et parcouru de pointillés
     * blancs dans le sens de la marche ; celui d'après est sombre et discret.
     *
     * etapes : [{ p:{lat,lng}, ic, t, ici, fait, vers:{ on, txt } }]
     * opts   : { plein, bas }
     *   plein  occupe tout l'espace au lieu d'un cadre de 158 px
     *   bas    part de hauteur, en %, laissée libre en bas — la feuille
     *          recouvre le bas de l'écran, et un livreur dessiné dessous
     *          n'existe pas
     */
    /**
     * Les positions, en centièmes du cadre. Séparé du dessin parce qu'on en a
     * besoin deux fois : pour construire le plan, et pour y faire GLISSER le
     * livreur sans le reconstruire — un élément recréé n'a pas de mouvement,
     * il apparaît déjà arrivé.
     */
    planGeo(etapes, opts) {
      opts = opts || {};
      /* Les marges gardent les épingles et leurs étiquettes à l'écart des
         bords, et `bas` retire du bas la part que la feuille recouvre — les
         deux axes ont donc leurs propres limites : partager la même rognait la
         moitié droite du plan. */
      const MINX = 10, MAXX = 90;
      const MINY = 12, MAXY = 100 - 12 - (+opts.bas || 0);
      const connus = etapes.filter(e => e.p && U.hasCoords(e.p));

      let xy;
      if (connus.length < 2) {
        /* Position inconnue — le plan s'affiche quand même, en escalier. Un
           trajet schématique dit encore l'ordre des étapes, ce qu'un cadre
           vide ne dit pas. Toute la raison d'être de ce composant est là :
           il ne renonce jamais. */
        const n = Math.max(1, etapes.length - 1);
        xy = etapes.map((e, i) => ({
          x: MINX + i * ((MAXX - MINX) / n),
          y: MAXY - i * ((MAXY - MINY) / n)
        }));
      } else {
        const lats = connus.map(e => +e.p.lat), lngs = connus.map(e => +e.p.lng);
        const laMin = Math.min.apply(null, lats), laMax = Math.max.apply(null, lats);
        const loMin = Math.min.apply(null, lngs), loMax = Math.max.apply(null, lngs);
        /* Un degré de longitude est plus court qu'un degré de latitude, et
           d'autant plus qu'on monte vers le pôle : sans ce facteur, un trajet
           est-ouest paraîtrait deux fois plus long qu'il ne l'est. */
        const k = Math.cos((laMin + laMax) / 2 * Math.PI / 180);
        /* Deux points quasi confondus donneraient une division par zéro puis
           un plan vide : on impose un écart minimal. */
        const dl = Math.max((laMax - laMin), 1e-4);
        const dg = Math.max((loMax - loMin) * k, 1e-4);
        xy = etapes.map(e => {
          if (!e.p || !U.hasCoords(e.p)) return null;
          return {
            x: MINX + (((+e.p.lng - loMin) * k) / dg) * (MAXX - MINX),
            /* La latitude croît vers le nord, l'axe des Y d'un écran vers le
               bas : sans l'inversion, le plan serait à l'envers. */
            y: MINY + (1 - (+e.p.lat - laMin) / dl) * (MAXY - MINY)
          };
        });
      }

      /* DEUX REPÈRES AU MÊME ENDROIT
         Au moment du retrait, le livreur EST au restaurant : les deux points se
         confondent, et les deux épingles se recouvrent — on n'en voit plus
         qu'une, et le client ne comprend plus qui est où. On écarte donc
         légèrement celle du dessus. Le décalage est visuel, jamais dans les
         distances annoncées : celles-là restent calculées sur les vraies
         coordonnées. */
      for (let i = 1; i < xy.length; i++) {
        if (!xy[i]) continue;
        for (let j = 0; j < i; j++) {
          if (!xy[j]) continue;
          const dx = xy[i].x - xy[j].x, dy = xy[i].y - xy[j].y;
          if (Math.sqrt(dx * dx + dy * dy) >= 10) continue;
          /* On s'écarte du côté où il reste de la place : contre un bord, un
             décalage aveugle serait annulé par le plafonnement et les deux
             épingles resteraient l'une sur l'autre. */
          xy[i] = {
            x: xy[i].x + 9 <= MAXX ? xy[i].x + 9 : xy[i].x - 9,
            y: xy[i].y - 9 >= MINY ? xy[i].y - 9 : xy[i].y + 9
          };
        }
      }

      return xy;
    },

    /**
     * La structure du plan, résumée. Deux plans de même signature ont les mêmes
     * éléments dans le même ordre : on peut alors se contenter de bouger ce qui
     * a bougé. Dès qu'elle change — une position qui apparaît, une étape
     * franchie — il faut reconstruire.
     */
    planSig(etapes) {
      return etapes.map(e =>
        (e.p && U.hasCoords(e.p) ? '1' : '0') + (e.ici ? 'i' : '') + (e.fait ? 'f' : '') +
        (e.vers ? (e.vers.on ? '>' : '-') + (e.vers.txt ? 'k' : '') : '')
      ).join('|');
    },

    /* Le coude : on part à l'horizontale jusqu'à mi-chemin, on descend, puis on
       repart à l'horizontale. Deux angles, arrondis par le tracé. */
    planCoude(a, b) {
      const mx = (a.x + b.x) / 2;
      return 'M' + a.x + ',' + a.y + ' L' + mx + ',' + a.y +
             ' L' + mx + ',' + b.y + ' L' + b.x + ',' + b.y;
    },

    /**
     * Deux étapes au même endroit — à quarante mètres près.
     *
     * Au moment du retrait, le livreur EST au restaurant. Son repère est écarté
     * de quelques unités pour rester visible, et on obtenait entre les deux un
     * moignon en pointillés qui se lit comme un défaut d'affichage, pas comme un
     * trajet. Le test porte sur les vraies coordonnées et non sur l'écart à
     * l'écran : celui-ci dépend de l'échelle du plan, qui change à chaque
     * relevé, et le moignon apparaissait ou non selon le zoom.
     */
    planMemeLieu(e1, e2) {
      if (!e1 || !e2 || !e1.p || !e2.p) return false;
      if (!U.hasCoords(e1.p) || !U.hasCoords(e2.p)) return false;
      return U.haversine(+e1.p.lat, +e1.p.lng, +e2.p.lat, +e2.p.lng) < 0.04;
    },

    plan(etapes, opts) {
      opts = opts || {};
      const xy = LiveScreen.planGeo(etapes, opts);
      const coude = LiveScreen.planCoude;

      let routes = '', pins = '';
      etapes.forEach((e, i) => {
        const a = xy[i], b = xy[i + 1];
        if (a && b && e.vers) {
          /* Tracé vide quand les deux étapes sont au même endroit : il garde sa
             place dans le dessin — les mises à jour comptent les tracés dans
             l'ordre, il ne doit jamais en manquer un. */
          const d = LiveScreen.planMemeLieu(e, etapes[i + 1]) ? '' : coude(a, b);
          /* Le halo passe AVANT le ruban : en SVG le dernier tracé recouvre les
             précédents, et un halo par-dessus troublerait la couleur pleine. */
          if (e.vers.on) routes += '<path class="lv-halo" d="' + d + '"/>';
          routes += '<path class="lv-route' + (e.vers.on ? ' on' : '') + '" d="' + d + '"/>';
        }
        if (!a) return;
        /* Ni nom ni distance sur les repères : la feuille du bas les dit déjà,
           et deux fois la même chose sur un si petit écran fait du bruit sans
           rien apprendre. Le plan ne répond qu'à « où », la feuille à
           « combien ». */
        pins += '<span class="lv-pp' + (e.ici ? ' ici' : '') +
          (e.fait ? ' fait' : '') + (e.logo ? ' logo' : '') +
          '" style="left:' + a.x.toFixed(1) +
          '%;top:' + a.y.toFixed(1) + '%" title="' + U.esc(e.t || '') + '">' +
          (e.ici ? '<u></u><u></u>' : '') +
          /* L'enseigne du restaurant quand elle existe, le pictogramme sinon :
             le plan de secours doit raconter la même chose que la carte, sans
             quoi passer de l'un à l'autre déroute. */
          '<i>' + (e.logo
            ? '<em style="background-image:url(' + U.escUrl(e.logo) + ')"></em>'
            : '<em>' + (e.ic || '') + '</em>') + '</i></span>';
      });

      return '<div class="lv-plan' + (opts.plein ? ' plein' : '') +
        '" data-sig="' + U.esc(LiveScreen.planSig(etapes)) + '">' +
        /* Un parc et un plan d'eau : deux taches de couleur qui suffisent à
           faire lire « une ville » plutôt qu'« un quadrillage ». Elles ne
           représentent rien de réel et ne le prétendent pas. */
        '<span class="lv-zone verte"></span><span class="lv-zone bleue"></span>' +
        '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
          routes +
        '</svg>' + pins +
      '</div>';
    },

    /**
     * LE LIVREUR GLISSE AU LIEU DE SAUTER.
     *
     * Redessiner le plan à chaque relevé remplaçait l'épingle par une neuve,
     * déjà arrivée : le scooter se téléportait toutes les quinze secondes, ce
     * qui ne ressemble pas à quelqu'un qui roule. Ici on garde les mêmes
     * éléments et on ne change que leur position — la transition CSS fait le
     * reste, et le mouvement se voit.
     *
     * On ne reconstruit que si la structure a changé (voir planSig) : une
     * position qui apparaît, une étape franchie. Le tracé, lui, suit d'un coup :
     * une route ne se déplace pas, c'est le scooter qu'on regarde avancer.
     */
    planMaj(hote, etapes, opts) {
      if (!hote) return;
      opts = opts || {};
      const racine = hote.querySelector('.lv-plan');
      if (!racine || racine.dataset.sig !== LiveScreen.planSig(etapes)) {
        hote.innerHTML = LiveScreen.plan(etapes, opts);
        return;
      }

      const xy = LiveScreen.planGeo(etapes, opts);
      const pins = racine.querySelectorAll('.lv-pp');
      const traces = racine.querySelectorAll('path');
      let ip = 0, it = 0;

      etapes.forEach((e, i) => {
        const a = xy[i], b = xy[i + 1];
        if (a && b && e.vers) {
          const d = LiveScreen.planMemeLieu(e, etapes[i + 1])
            ? '' : LiveScreen.planCoude(a, b);
          /* Même ordre qu'au dessin — halo puis ruban — sinon on écrirait le
             tracé de l'un dans l'autre. */
          if (e.vers.on) { if (traces[it]) traces[it].setAttribute('d', d); it++; }
          if (traces[it]) traces[it].setAttribute('d', d);
          it++;
        }
        if (!a) return;
        const el = pins[ip++];
        if (!el) return;
        el.style.left = a.x.toFixed(1) + '%';
        el.style.top = a.y.toFixed(1) + '%';
      });
    },

    /**
     * L'heure d'arrivée, pas seulement les minutes restantes. « 47 min » se
     * périme dans la tête de celui qui le lit : dix minutes plus tard, il ne
     * sait plus si c'était 47 depuis le début. « Vers 20:45 » reste vrai.
     */
    heureArrivee(min) {
      if (!min || min <= 0) return '';
      return 'arrivée vers ' + U.time(Date.now() + min * 60000);
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
