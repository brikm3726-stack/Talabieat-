/* ==========================================================================
   VUES CLIENT — liste des restaurants, fiche restaurant, panier
   ========================================================================== */
(function (w) {
  'use strict';

  /* ======================================================================
     LISTE DES RESTAURANTS + RECHERCHE
     ====================================================================== */
  Router.add('/restaurants', async function (params, query, view) {
    let term = query.q || '';
    let cat = query.cat || null;
    let mode = 'resto';   // 'resto' | 'dish'

    /* Thème sombre, comme l'accueil (maquette « trer »). Posé avant d'écrire
       la page : sinon le crème apparaîtrait le temps d'une image. */
    UI.nuit('restaurants');

    view.innerHTML = '<div class="wrap page">' +
      Cmp.pageHead('Restaurants', Store.zoneName() ? 'Livraison à ' + Store.zoneName() : 'Toute la ville de Tizi Ouzou',
        '<button class="btn btn-ghost btn-sm" id="zoneBtn2">' + UI.pin(14) + ' ' + U.esc(Store.zoneName() || 'Mon quartier') + '</button>') +
      '<div class="search" style="margin-bottom:12px">' +
        '<input class="input" id="q" placeholder="Restaurant ou plat…" value="' + U.esc(term) + '" autocomplete="off">' +
      '</div>' +
      '<div class="tabs" style="margin-bottom:14px">' +
        '<button data-mode="resto" class="on">Restaurants</button>' +
        '<button data-mode="dish">Plats</button>' +
      '</div>' +
      '<div id="cats"></div>' +
      '<div id="results" style="margin-top:12px">' + UI.skeletonCards(6) + '</div>' +
    '</div>';

    view.querySelector('#zoneBtn2').onclick = Shell.zonePicker;

    const results = view.querySelector('#results');
    const catBox = view.querySelector('#cats');

    function paintCats() {
      const c = Cmp.categoryScroller(cat, id => { cat = id; paintCats(); load(); });
      catBox.innerHTML = c.html;
      c.bind(catBox);
      catBox.style.display = mode === 'resto' ? '' : 'none';
    }

    async function load() {
      /* Premier affichage : des squelettes, il n'y a rien à conserver.
         Changement de filtre : on garde la liste en place, estompée, et on
         fige sa hauteur le temps du chargement. Sans ça, la remplacer par
         quatre squelettes plus courts faisait remonter la page d'un coup —
         c'est ce saut qu'on voyait en passant de « Tout » à « Pizza ». */
      const dejaRempli = results.children.length > 0 && !results.querySelector('.skel');
      if (dejaRempli) {
        results.style.minHeight = results.offsetHeight + 'px';
        results.classList.add('en-chargement');
      } else {
        results.innerHTML = UI.skeletonCards(4);
      }

      const fini = () => {
        results.classList.remove('en-chargement');
        // la hauteur n'est figée que pendant le chargement, sinon la liste ne
        // pourrait plus jamais raccourcir
        requestAnimationFrame(() => { results.style.minHeight = ''; });
      };
      // quoi qu'il arrive — retour anticipé, résultat vide, erreur — la liste
      // retrouve son état normal
      try { await charger(); } finally { fini(); }
    }

    async function charger() {
      if (mode === 'dish') {
        if (term.trim().length < 2) {
          results.innerHTML = UI.empty('🔎', 'Recherchez un plat', 'Saisissez au moins 2 lettres (pizza, tacos, chawarma…).');
          return;
        }
        const dishes = await API.safe(() => API.searchDishes(term, null), []);
        if (!dishes.length) {
          results.innerHTML = UI.empty('🍽️', 'Aucun plat trouvé', 'Essayez un autre mot-clé.');
          return;
        }
        const catOf = id => Store.categories.find(c => c.id === id) || {};
        results.innerHTML = '<div class="stack">' + dishes.map(d =>
          '<div data-goto="' + U.esc(d.restaurant.id) + '">' +
            Cmp.dishRow(Object.assign({}, d, { is_available: true }), catOf(d.category_id)) +
            '<div class="tiny" style="margin:-6px 0 4px 13px">chez <b>' + U.esc(d.restaurant.name) + '</b> • ' +
              U.esc(d.restaurant.zone ? d.restaurant.zone.name : '') + '</div>' +
          '</div>').join('') + '</div>';
        results.querySelectorAll('[data-goto]').forEach(el =>
          el.onclick = () => Router.go('/resto/' + el.dataset.goto));
        return;
      }

      const q = term.trim();
      /* Plus de filtre par quartier : le catalogue montre toute la ville.
         Le quartier reste demandé à la commande, là où il sert — pas pour
         retrancher des restaurants a quelqu'un qui regarde. */
      const list = await searchRestaurants(q, null, cat);

      /* Le repli « rien dans votre quartier, mais des résultats ailleurs »
         vivait ici. Il n'a plus lieu d'être : la liste couvre déjà toute la
         ville, donc un résultat vide veut dire vide, pas « masqué par un
         filtre que vous avez oublié ». */
      Cmp.restoGrid(list, results);

      /* Les exemples du champ deviennent de vrais noms de la ville dès que
         la liste est là : voir défiler une enseigne qu'on connaît vaut
         mieux que n'importe quel exemple inventé. */
      if (machineR && list.length)
        machineR.mots(list.slice(0, 4).map(r => 'Ex : ' + r.name)
          .concat(['Ex : pizza margherita']));
    }

    /**
     * Recherche unifiée : un mot-clé peut désigner un restaurant OU un plat.
     * Le champ promet « restaurant ou plat » — il doit tenir les deux.
     */
    async function searchRestaurants(q, zoneId, catId) {
      const list = await API.safe(() => API.restaurants({
        zone_id: zoneId, category_id: catId, q: q || null
      }), []);

      if (q.length < 2) return list;

      const dishes = await API.safe(() => API.searchDishes(q, zoneId), []);
      const seen = {};
      list.forEach(r => seen[r.id] = true);

      dishes.forEach(d => {
        const rest = d.restaurant;
        if (!rest || seen[rest.id]) return;
        if (catId && (rest.categories || []).indexOf(catId) < 0) return;
        seen[rest.id] = true;
        rest.matched_dish = d.name;   // affiché sur la carte : « propose … »
        list.push(rest);
      });

      return list.sort((a, b) => (b.open_now - a.open_now) || (b.rating - a.rating));
    }

    const champ = view.querySelector('#q');
    const onType = U.debounce(() => { term = champ.value; load(); }, 320);
    champ.oninput = onType;

    /* Même repère qui s'écrit que sur l'accueil : la page Restaurants est
       souvent la première qu'on ouvre, et le champ y est encore plus muet
       — « Restaurant ou plat… » ne donne aucun exemple. Rien ne s'anime si
       le champ arrive déjà rempli (retour de recherche). */
    const machineR = UI.typewriter(champ, [
      'Ex : Melyza tacos', 'Ex : pizza margherita', 'Ex : burger poulet'
    ]);

    view.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
      mode = b.dataset.mode;
      view.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b));
      paintCats();
      load();
    });

    paintCats();
    /* Le chargement n'est plus attendu : le routeur ne reçoit le nettoyage
       qu'au retour de la route, et tant qu'il attendait le réseau, quitter
       cet écran pendant le chargement laissait le suivant peint en noir.
       Écrire dans un conteneur déjà remplacé est sans effet — chaque
       affichage a le sien (voir Router.render). */
    load();

    return () => UI.nuit('');
  });

  /* ======================================================================
     FICHE RESTAURANT
     ====================================================================== */
  Router.add('/resto/:id', async function (params, query, view) {
    /* La fiche suit la liste. Une liste sombre qui ouvre un menu blanc, c'est
       un éblouissement à chaque restaurant touché — et c'est le premier geste
       que fait tout le monde après avoir choisi. */
    UI.nuit('resto');

    view.innerHTML = '<div class="wrap page"><div class="skel" style="height:180px"></div>' +
      '<div class="skel" style="height:110px;margin-top:16px"></div></div>';

    const r = await API.safe(() => API.restaurant(params.id), null);
    if (!r) {
      view.innerHTML = '<div class="wrap page">' + UI.empty('🏪', 'Restaurant introuvable', '',
        '<a class="btn btn-primary" href="#/restaurants">Voir les restaurants</a>') + '</div>';
      // le thème doit s'éteindre même par ce chemin-là, sinon l'écran suivant
      // reste noir
      return () => UI.nuit('');
    }

    const menu = await API.safe(() => API.menuItems(r.id), []);
    const catsOfMenu = [];
    Store.categories.forEach(c => { if (menu.some(m => m.category_id === c.id)) catsOfMenu.push(c); });
    const others = menu.filter(m => !catsOfMenu.some(c => c.id === m.category_id));

    const cover = r.cover_url ? 'background-image:url(' + U.escUrl(r.cover_url) + ')' : '';
    const logo = r.logo_url ? 'background-image:url(' + U.escUrl(r.logo_url) + ')' : '';
    const emoji = (r.category_list && r.category_list[0] && r.category_list[0].icon) || '🍽️';

    view.innerHTML =
      /* Les mesures de la couverture, du bouton retour et de la fiche qui la
         chevauche sont passées de l'attribut `style` à des classes — mêmes
         valeurs, au pixel près. Un style en ligne l'emporte sur toute feuille :
         tant qu'il était là, aucun thème ne pouvait redessiner cette page. */
      '<div class="resto-cover rp-cover" style="' + cover + '">' +
        (cover ? '' : '<div style="height:100%;display:grid;place-items:center;font-size:64px;opacity:.3">' + emoji + '</div>') +
        '<button class="icon-btn rp-back" id="back">←</button>' +
        (r.open_now ? '' : '<div class="closed-ov">FERMÉ ACTUELLEMENT</div>') +
      '</div>' +

      '<div class="wrap page" style="padding-top:0">' +
        '<div class="card card-p rp-fiche">' +
          '<div class="row" style="gap:13px;align-items:flex-start">' +
            '<div style="width:58px;height:58px;border-radius:17px;background:#fff center/cover no-repeat;' + logo +
              ';border:1px solid var(--line);display:grid;place-items:center;font-size:26px;flex:none">' + (logo ? '' : emoji) + '</div>' +
            '<div class="grow">' +
              '<div class="h2">' + U.esc(r.name) + '</div>' +
              '<div class="resto-meta">' +
                '<span>⭐ <b>' + (+r.rating).toFixed(1) + '</b> (' + (r.rating_count || 0) + ')</span>' +
                '<span class="dot-sep">🕒 ' + r.prep_time_min + ' min</span>' +
                // le tarif dépend de la distance : on annonce le plancher, le montant
            // exact apparaît une fois l'adresse choisie
            '<span class="dot-sep">🛵 dès ' + U.money(U.deliveryFor(0, Store.settings).fee) + '</span>' +
              '</div>' +
            '</div>' +
            '<span class="tag ' + (r.open_now ? 'tag-ok' : 'tag-muted') + '">' + (r.open_now ? 'Ouvert' : 'Fermé') + '</span>' +
          '</div>' +
          (r.description ? '<p class="sub" style="margin-top:12px">' + U.esc(r.description) + '</p>' : '') +
          '<div class="divider"></div>' +
          '<div class="tiny stack" style="gap:5px">' +
            '<div>' + UI.pin() + ' ' + U.esc(r.address || '—') + (r.zone ? ' — ' + U.esc(r.zone.name) : '') + '</div>' +
            '<div>🕘 Horaires : ' + U.hhmm(r.opens_at) + ' – ' + U.hhmm(r.closes_at) + '</div>' +
            (r.phone ? '<div>📞 <a href="tel:' + U.esc(r.phone) + '" style="color:var(--brand);font-weight:650">' + U.esc(r.phone) + '</a></div>' : '') +
            (r.min_order ? '<div>🧾 Minimum de commande : <b>' + U.money(r.min_order) + '</b></div>' : '') +
          '</div>' +
        '</div>' +

        (r.open_now ? '' : '<div class="banner banner-warn" style="margin-top:14px">⏰ Ce restaurant est fermé. Vous pourrez commander dès sa réouverture (' + U.hhmm(r.opens_at) + ').</div>') +

        (menu.length
          ? '<div id="menuNav" class="menu-tabs chips"></div><div id="menu" class="stack" style="margin-top:6px"></div>'
          : '<div style="margin-top:20px">' + UI.empty('📋', 'Menu en préparation', 'Ce restaurant n’a pas encore publié ses plats.') + '</div>') +
      '</div>';

    view.querySelector('#back').onclick = () => Router.back();

    if (menu.length) {
      const groups = catsOfMenu.map(c => ({ id: c.id, name: c.name_fr, cat: c, items: menu.filter(m => m.category_id === c.id) }));
      if (others.length) groups.push({ id: 'other', name: 'Autres', cat: { icon: '🍽️' }, items: others });

      // logo de la catégorie, emoji seulement en repli
      const gIcon = (g, big) => g.cat.image_url
        ? '<span class="g-ic' + (big ? ' big' : '') + '" style="background-image:url(' + U.escUrl(g.cat.image_url) + ')"></span>'
        : '<span class="g-ic emoji' + (big ? ' big' : '') + '">' + (g.cat.icon || '🍽️') + '</span>';

      const nav = view.querySelector('#menuNav');
      const box = view.querySelector('#menu');
      /* Le menu ENTIER est passé au panneau : c'est lui qui alimente la section
         « Complétez votre repas » — boissons, accompagnements, desserts du même
         restaurant. Il est déjà chargé ici, le repasser ne coûte rien ; aller le
         rechercher depuis le panneau aurait fait un second appel réseau pour des
         plats qu'on a déjà en main. */
      const openDish = id => dishSheet(r, menu.find(m => m.id === id), menu);
      let active = 0;

      nav.innerHTML = groups.map((g, i) =>
        '<button class="chip" data-tab="' + i + '">' + gIcon(g) + U.esc(g.name) +
          '<span class="chip-n">' + g.items.length + '</span></button>').join('');

      /* Une seule catégorie affichée à la fois : les onglets remplacent le
         contenu au lieu de faire défiler une page unique. */
      function paintMenu() {
        const g = groups[active];
        nav.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', +b.dataset.tab === active));
        box.innerHTML =
          '<div class="section-head"><div class="h3">' + gIcon(g, true) + U.esc(g.name) + '</div>' +
          '<span class="tiny">' + g.items.length + ' plat(s)</span></div>' +
          '<div class="stack">' + g.items.map(m => Cmp.dishRow(m, g.cat)).join('') + '</div>';

        box.querySelectorAll('[data-dish]').forEach(el => el.onclick = e => {
          if (e.target.closest('[data-add]')) return;
          openDish(el.dataset.dish);
        });
        box.querySelectorAll('[data-add]').forEach(el => el.onclick = e => {
          e.stopPropagation();
          openDish(el.dataset.add);
        });
      }

      nav.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
        active = +b.dataset.tab;
        paintMenu();
        b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        // si on était descendu dans la liste précédente, on remonte en haut de
        // la nouvelle plutôt que d'atterrir au milieu du vide. La barre étant
        // collante, son sommet vaut 60 dès qu'on a défilé au-delà.
        if (nav.getBoundingClientRect().top <= 60) {
          nav.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      paintMenu();
    }

    renderCartBar(view);

    return () => UI.nuit('');
  });

  /* ======================================================================
     PERSONNALISATION DU PLAT — le panneau qui monte du bas
     ----------------------------------------------------------------------
     L'ANCIENNE VERSION ÉTAIT UNE LISTE DE CASES À COCHER. Elle marchait, et
     c'est tout ce qu'on pouvait en dire : un format en boutons radio, des
     suppléments en cases, un total qui n'apparaissait que dans le bouton. On ne
     voyait pas ce qu'on commandait, seulement ce qu'on avait coché.

     Celle-ci est construite autour de trois idées, et chacune répond à une
     question qu'on se pose vraiment devant un plat :

       « c'est quoi ? »      → la photo en grand, le nom, le restaurant, la
                               note, le délai, le prix de départ ;
       « je peux quoi ? »    → des cartes, pas des cases : chaque supplément
                               montre son emoji, son nom, son prix et son
                               compteur, et peut être pris DEUX fois ;
       « ça fait combien ? » → un récapitulatif qui se recalcule à chaque
                               touche, plus le montant dans le bouton.

     CE QUI VIENT DE LA BASE ET CE QUI VIENT D'ICI. Les formats, les suppléments
     et les plats proposés en complément sont ceux du restaurant — rien n'est
     inventé pour faire joli. Les emojis, eux, sont déduits du nom (« cheddar »
     → 🧀) : la base n'en stocke pas, et attendre que chaque restaurant en
     saisisse un aurait donné une grille à moitié vide.
     ====================================================================== */

  /* Un emoji par famille d'ingrédient. La première expression qui reconnaît le
     nom gagne, donc l'ordre compte : « sauce piquante » doit rencontrer
     « piquant » avant « sauce », sans quoi tous les piments deviendraient des
     bocaux. Ce qui n'est reconnu par rien reçoit l'emoji du plat. */
  const EMOJIS = [
    [/piquant|piment|harissa|spicy|samoura|épic|epic/i, '🌶️'],
    [/viande|hach[ée]|kefta|steak|b[œo]uf|agneau|kebab/i, '🥩'],
    [/merguez|saucisse|hot ?dog/i, '🌭'],
    [/poulet|escalope|chicken|dinde|nugget/i, '🍗'],
    [/thon|poisson|saumon|sardine/i, '🐟'],
    [/crevette|fruits de mer|calamar/i, '🦐'],
    [/champignon/i, '🍄'],
    [/cheddar|mozzar|camembert|gruy|fromage|raclette|ch[èe]vre|parmesan|emmental/i, '🧀'],
    [/olive/i, '🫒'],
    [/oignon/i, '🧅'],
    [/tomate|ketchup/i, '🍅'],
    [/poivron/i, '🫑'],
    /* Les mots courts prennent des limites de mot, et ce n'est pas de la
       prudence gratuite : sans elles, « Frites maison » contenait « mais » et
       recevait un épi de maïs, « gâteau » contenait « eau » et devenait une
       boisson. Trois lettres suffisent à traverser la moitié d'un menu. */
    [/\bma[ïi]s\b/i, '🌽'],
    [/\bail\b|garlic|blanche/i, '🧄'],
    [/[œo]uf/i, '🥚'],
    [/frite|potato|wedges/i, '🍟'],
    [/salade|verdure|roquette|crudit/i, '🥗'],
    [/ananas/i, '🍍'],
    [/avocat/i, '🥑'],
    [/miel/i, '🍯'],
    [/thon|tha[ïi]/i, '🐟'],
    [/coca|soda|boisson|jus|limonade|\beau\b|pepsi|fanta|sprite|selecto|hamoud|ifri/i, '🥤'],
    [/caf[ée]|\bth[ée]\b/i, '☕'],
    [/glace|dessert|tiramisu|cr[èe]me|g[âa]teau|cheesecake|tarte|flan/i, '🍰'],
    [/pizza/i, '🍕'],
    [/burger|hamburger/i, '🍔'],
    [/tacos|sandwich|wrap|chawarma|shawarma/i, '🌯'],
    [/p[âa]tes|spaghetti|penne|lasagne/i, '🍝'],
    [/\briz\b/i, '🍚'],
    [/soupe|chorba|harira/i, '🍲'],
    [/pain|baguette|galette|tortilla|panini/i, '🥖'],
    [/sauce|mayo|barbecue|bbq|alg[ée]rienne|biggy|curry/i, '🥫']
  ];

  /* ---- TOUS LES TÉLÉPHONES N'ONT PAS TOUS LES EMOJIS -------------------
     Le poivron (🫑) et l'olive (🫒) datent d'Unicode 13, publié en 2020. Sur un
     Android de 2018 — il y en a beaucoup ici — ils ne s'affichent pas : le
     système dessine le rectangle vide, le fameux « tofu ». Une grille
     d'ingrédients à moitié en rectangles est pire que pas d'emojis du tout.

     On ne peut pas deviner l'âge de la police depuis le navigateur, mais on
     peut LUI DEMANDER DE DESSINER : un caractère absent produit exactement la
     même image que n'importe quel autre caractère absent. On compare donc le
     dessin de l'emoji à celui de U+FFFF, qui n'existe dans aucune police. Deux
     dessins identiques : la police ne connaît ni l'un ni l'autre.

     Le résultat est retenu par caractère — une mesure, pas une par carte. */
  const _emojiVu = {};

  function emojiRendu(ch) {
    if (!ch) return false;
    if (_emojiVu[ch] !== undefined) return _emojiVu[ch];
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 26;
      const x = c.getContext('2d');
      if (!x) return (_emojiVu[ch] = true);
      x.textBaseline = 'top';
      x.font = '22px sans-serif';
      x.fillText(ch, 0, 0);
      const dessin = c.toDataURL();
      x.clearRect(0, 0, 26, 26);
      x.fillText('￿', 0, 0);        // absent de toutes les polices
      return (_emojiVu[ch] = dessin !== c.toDataURL());
    } catch (e) {
      /* Canvas refusé (mode très restreint) : on fait confiance à la police
         plutôt que de tout remplacer par le repli. */
      return (_emojiVu[ch] = true);
    }
  }

  /** Le premier des trois que la police sait dessiner. */
  function emojiSur(choix, repli) {
    if (emojiRendu(choix)) return choix;
    if (emojiRendu(repli)) return repli;
    return '🍽️';
  }

  function emojiDe(nom, repli) {
    const t = String(nom || '');
    for (let i = 0; i < EMOJIS.length; i++)
      if (EMOJIS[i][0].test(t)) return emojiSur(EMOJIS[i][1], repli || '🍽️');
    return emojiSur(repli || '🍽️', '🍽️');
  }

  /**
   * Les plats du MÊME restaurant qui complètent celui-ci : boissons,
   * accompagnements, desserts, sauces. Ce ne sont pas des « options » inventées
   * pour remplir une section — ce sont de vraies lignes de menu, qui partiront
   * au panier comme telles et que la cuisine verra.
   *
   * Un plat vendu en formats (une boisson en 33 cl et en 1 L) entre avec son
   * format le moins cher : on ne peut pas choisir un format depuis une vignette,
   * et proposer la grande bouteille par défaut serait vendre à la place du
   * client.
   */
  function extrasDuMenu(menu, item) {
    if (!menu || !menu.length) return [];
    const cats = {};
    (Store.categories || []).forEach(c => { cats[c.id] = c; });
    const complement = /boisson|dessert|accompagnement|extra|snack|sauce|frite|salade|entr[ée]e/i;

    return menu.filter(m => {
      if (m.id === item.id || m.is_available === false) return false;
      const c = cats[m.category_id];
      return complement.test((c && (c.name_fr || c.name)) || '');
    }).slice(0, 8).map(m => {
      const v = (m.variants || []).slice().sort((a, b) => a.price - b.price)[0] || null;
      const c = cats[m.category_id] || {};
      return {
        item: m, variant: v,
        nom: m.name + (v ? ' · ' + v.name : ''),
        prix: +(v ? v.price : m.price) || 0,
        // l'emoji de la catégorie sert de repli quand le nom ne dit rien :
        // « Ifri 1 L » n'évoque aucun ingrédient, sa catégorie si
        icone: c.icon || ''
      };
    });
  }

  /**
   * La description est parfois une PHRASE (« Notre pizza signature, cuite au
   * feu de bois. »), parfois une LISTE (« Tomate, mozzarella, basilic »). Une
   * liste mérite des pastilles, une phrase mérite un paragraphe — les deux dans
   * le même moule donneraient soit des pastilles absurdes, soit un mur de texte.
   *
   * Le point final tranche : une énumération n'en a pas.
   */
  function ingredients(texte) {
    const t = String(texte || '').trim();
    if (!t || t.indexOf('.') >= 0) return null;
    const parts = t.split(/\s*[,•·+]\s*/).map(s => s.trim()).filter(Boolean);
    return parts.length >= 3 && parts.every(p => p.length <= 24) ? parts : null;
  }

  /** Petite secousse — la même partout où l'on choisit quelque chose. */
  function vibrer(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) {} }
  }

  function dishSheet(resto, item, menu) {
    if (!item) return;

    const cat = (Store.categories || []).find(c => c.id === item.category_id) || {};
    const emojiPlat = cat.icon || emojiDe(item.name, '🍽️');
    /* « Personnalisez votre pizza » plutôt que « votre commande » : le nom de la
       catégorie du plat, en minuscules, quand il y en a une. */
    const quoi = cat.name_fr ? cat.name_fr.toLowerCase() : 'plat';

    const formats = (item.variants || []).slice();
    const supps   = (item.options  || []).slice();
    const extras  = extrasDuMenu(menu, item);
    const listeIng = ingredients(item.description);

    let qty = 1, vIdx = 0, note = '';
    const nSupp  = supps.map(() => 0);      // combien de fois chaque supplément
    const nExtra = extras.map(() => 0);

    const base       = () => +(formats.length ? formats[vIdx].price : item.price) || 0;
    const totSupp    = () => supps.reduce((s, o, i) => s + (+o.extra_price || 0) * nSupp[i], 0);
    const totExtra   = () => extras.reduce((s, e, i) => s + e.prix * nExtra[i], 0);
    /* CE QUI PART AU PANIER : le plat avec ses suppléments, multiplié par la
       quantité, plus les compléments qui sont des lignes à part entière. C'est
       ce montant que le bouton annonce — pas le total avec livraison, qui
       dépend d'une adresse que le client n'a pas encore donnée. */
    const totArticles = () => (base() + totSupp()) * qty + totExtra();

    const livraison = U.deliveryFor(null, Store.settings).fee;
    const depart = formats.length
      ? Math.min.apply(null, formats.map(v => +v.price || 0))
      : (+item.price || 0);

    const indispo = item.is_available === false;
    const ferme = !resto.open_now;

    /* ----------------------------------------------------------- fragments */

    /* « Obligatoire » est orange, « Facultatif » est gris : la couleur dit
       laquelle des deux mentions exige quelque chose du client, avant même
       d'être lue. */
    const sectionTete = (titre, sous, marque) =>
      '<div class="pz-st">' +
        '<div class="pz-st-tx"><h3>' + U.esc(titre) + '</h3>' +
          '<p>' + U.esc(sous) + '</p></div>' +
        (marque
          ? '<span class="pz-oblig' + (marque === 'Obligatoire' ? ' fort' : '') + '">' +
              U.esc(marque) + '</span>'
          : '') +
      '</div>';

    /* Une carte de format : l'emoji grandit avec la taille — c'est la
       différence de taille qu'on achète, autant la voir. */
    const carteFormat = (v, i) =>
      '<div class="pz-f' + (i === vIdx ? ' on' : '') + '" data-fmt="' + i + '" ' +
           'role="radio" tabindex="0" aria-checked="' + (i === vIdx ? 'true' : 'false') + '">' +
        '<span class="pz-f-em" style="font-size:' + (26 + Math.min(i, 3) * 5) + 'px">' + emojiPlat + '</span>' +
        '<b>' + U.esc(v.name) + '</b>' +
        '<span class="pz-f-p">' + U.money(v.price) + '</span>' +
        '<span class="pz-f-c">' + UI.icon('check', 13) + '</span>' +
      '</div>';

    /* Une carte de supplément ou de complément. Le bouton « + » devient un
       compteur dès qu'on a pris le premier : tant qu'il n'y en a aucun, un
       compteur affichant « 0 » demanderait de comprendre avant d'agir. */
    const carteChoix = (attr, i, emoji, nom, prix, n, gratuitLabel) =>
      '<div class="pz-c' + (n ? ' on' : '') + '" data-' + attr + '="' + i + '" ' +
           'role="button" tabindex="0" aria-pressed="' + (n ? 'true' : 'false') + '">' +
        '<span class="pz-c-em">' + emoji + '</span>' +
        '<span class="pz-c-tx"><b>' + U.esc(nom) + '</b>' +
          '<span>' + (prix ? '+ ' + U.money(prix) : U.esc(gratuitLabel || 'Offert')) + '</span></span>' +
        '<span class="pz-c-act">' +
          (n
            ? '<span class="pz-cpt">' +
                '<button type="button" data-moins="' + i + '" aria-label="Retirer">−</button>' +
                '<b>' + n + '</b>' +
                '<button type="button" data-plus="' + i + '" aria-label="Ajouter">+</button>' +
              '</span>'
            : '<span class="pz-add">' + UI.icon('plus', 16) + '</span>') +
        '</span>' +
      '</div>';

    const carteSupp  = (o, i) => carteChoix('supp', i, emojiDe(o.name, '🧂'),
                                            o.name, +o.extra_price || 0, nSupp[i], 'Offert');
    const carteExtra = (e, i) => carteChoix('extra', i, emojiDe(e.nom, e.icone || '🥤'),
                                            e.nom, e.prix, nExtra[i], 'Offert');

    /* ------------------------------------------------------------- panneau */

    UI.sheet({
      classe: 'pz-ov',
      title: false,                 // le panneau porte son propre en-tête
      body:
        '<div class="pz">' +

          /* La poignée et la croix restent au sommet du défilement : sur un
             panneau de cette hauteur, une croix qui part avec la photo oblige à
             tout remonter pour fermer. */
          /* LA BARRE DU HAUT EST TRANSPARENTE, PUIS ELLE NE L'EST PLUS.
             Tant qu'on regarde la photo, il n'y a qu'une croix posée dessus.
             Dès qu'on descend, la barre devient opaque et prend le nom du plat :
             on sait toujours ce qu'on est en train de composer, et surtout la
             croix cesse de flotter au-dessus des cartes — elle recouvrait le
             « + » du premier supplément visible, qui devenait intouchable. */
          '<div class="pz-fixe">' +
            '<div class="pz-bar">' +
              '<span class="pz-bar-t">' + U.esc(item.name) + '</span>' +
              '<button class="pz-x" data-x aria-label="Fermer">' + UI.icon('plus', 19) + '</button>' +
            '</div>' +
          '</div>' +

          /* ------------------------------------------------------- EN-TÊTE */
          '<div class="pz-hero' + (item.image_url ? '' : ' vide') + '"' +
              (item.image_url ? ' style="background-image:url(' + U.escUrl(item.image_url) + ')"' : '') + '>' +
            /* La poignée appartient à la photo et s'en va avec elle. Restée
               collée en haut, elle flottait au milieu des suppléments comme une
               barre grise sans objet. */
            '<span class="pz-poignee" aria-hidden="true"></span>' +
            (item.image_url ? '' : '<span class="pz-hero-em">' + emojiPlat + '</span>') +
            '<span class="pz-hero-voile" aria-hidden="true"></span>' +
            /* UNE SEULE PASTILLE, jamais deux : elles occupent le même coin.
               Le plat retiré de la carte passe devant l'horaire — c'est le
               refus le plus proche de ce qu'on essaie de faire. */
            (indispo
              ? '<span class="pz-ferme">Plat indisponible aujourd’hui</span>'
              : ferme
                ? '<span class="pz-ferme">Fermé · réouverture à ' + U.esc(U.hhmm(resto.opens_at)) + '</span>'
                : '') +
          '</div>' +

          '<div class="pz-titre">' +
            '<h2>' + U.esc(item.name) + '</h2>' +
            '<div class="pz-meta">' +
              '<span class="pz-resto">' + UI.icon('store', 14) + ' ' + U.esc(resto.name) + '</span>' +
              (+resto.rating ? '<span>⭐ <b>' + (+resto.rating).toFixed(1) + '</b></span>' : '') +
              (resto.prep_time_min ? '<span>🛵 ' + (+resto.prep_time_min) + ' min</span>' : '') +
            '</div>' +
            '<div class="pz-depart">À partir de <b>' + U.money(depart) + '</b></div>' +
          '</div>' +

          /* --------------------------------------------------- DESCRIPTION */
          ((item.description || listeIng)
            ? '<div class="pz-carte pz-desc">' +
                (listeIng
                  ? '<div class="pz-ing-t">Ingrédients</div>' +
                    '<div class="pz-ing">' + listeIng.map(p =>
                      '<span>' + emojiDe(p, '•') + ' ' + U.esc(p) + '</span>').join('') + '</div>'
                  : '<p>' + U.esc(item.description) + '</p>') +
              '</div>'
            : '') +

          /* ------------------------------------------------------- FORMATS */
          (formats.length
            ? '<div class="pz-sec">' +
                sectionTete('Choisissez votre format', 'Un seul format par plat', 'Obligatoire') +
                '<div class="pz-fmts" role="radiogroup" aria-label="Format">' +
                  formats.map(carteFormat).join('') +
                '</div>' +
              '</div>'
            : '') +

          /* --------------------------------------------------- SUPPLÉMENTS */
          (supps.length
            ? '<div class="pz-sec">' +
                sectionTete('Personnalisez votre ' + quoi, 'Ajoutez vos ingrédients préférés', 'Facultatif') +
                '<div class="pz-cartes" id="pzSupps">' + supps.map(carteSupp).join('') + '</div>' +
              '</div>'
            : '') +

          /* -------------------------------------------------------- EXTRAS */
          (extras.length
            ? '<div class="pz-sec">' +
                sectionTete('Complétez votre repas', 'Boissons, accompagnements et desserts du restaurant', '') +
                '<div class="pz-cartes" id="pzExtras">' + extras.map(carteExtra).join('') + '</div>' +
              '</div>'
            : '') +

          /* --------------------------------------------------------- NOTES */
          '<div class="pz-sec">' +
            sectionTete('Instructions spéciales', 'Le restaurant les lira avant de cuisiner', '') +
            '<div class="pz-note">' +
              '<textarea id="pzNote" maxlength="160" rows="2" ' +
                'placeholder="Sans oignons, cuisson bien cuite…"></textarea>' +
              '<span class="pz-note-n" id="pzNoteN">0/160</span>' +
            '</div>' +
          '</div>' +

          /* -------------------------------------------------- RÉCAPITULATIF */
          '<div class="pz-sec">' +
            '<div class="pz-carte pz-recap" id="pzRecap"></div>' +
          '</div>' +

        '</div>',

      footer:
        '<div class="pz-bas">' +
          '<div class="pz-qte">' +
            '<button type="button" data-m aria-label="Un de moins">−</button>' +
            '<b id="pzQ">1</b>' +
            '<button type="button" data-p aria-label="Un de plus">+</button>' +
          '</div>' +
          '<div class="pz-tot"><span>Total</span><b id="pzTot"></b></div>' +
          /* DEUX LIBELLÉS, UN SEUL VISIBLE. « Ajouter au panier » suivi de
             « 2 220 DA » ne tient pas sur un écran de 360 px : le texte se
             coupait en « Ajouter au pa… », ce qui est la seule chose du panneau
             qu'on ne doit jamais avoir à deviner. En dessous de 430 px, c'est
             « Ajouter » qui s'affiche — le montant, lui, ne bouge pas. Écrire
             les deux dans le HTML et laisser la feuille de style choisir évite
             de reconstruire le bouton à chaque rotation de l'appareil. */
          '<button class="pz-cta" id="pzAdd"' + ((ferme || indispo) ? ' disabled' : '') + '>' +
            (indispo || ferme
              ? '<span class="l">' + (indispo ? 'Indisponible' : 'Restaurant fermé') + '</span>'
              : '<span class="l long">Ajouter au panier</span>' +
                '<span class="l court">Ajouter</span>' +
                '<span class="m" id="pzCta"></span>') +
          '</button>' +
        '</div>',

      onMount(el, api) {
        const $ = s => el.querySelector(s);

        /* ---- le récapitulatif, recalculé à chaque geste ------------------
           Il est réécrit en entier plutôt que corrigé ligne à ligne : il ne
           contient ni champ ni focus à préserver, et une seule écriture ne peut
           pas se désynchroniser d'un total calculé ailleurs. */
        function recap() {
          const nSuppTotal = nSupp.reduce((s, n) => s + n, 0);
          const nExtraTotal = nExtra.reduce((s, n) => s + n, 0);
          const sousTotal = totArticles();

          const ligne = (ic, lab, val, cls) =>
            '<div class="pz-r' + (cls ? ' ' + cls : '') + '">' +
              '<span class="i">' + ic + '</span>' +
              '<span class="l">' + U.esc(lab) + '</span>' +
              '<span class="v">' + val + '</span>' +
            '</div>';

          $('#pzRecap').innerHTML =
            '<div class="pz-r-t">' + UI.icon('receipt', 17) + ' Votre commande</div>' +
            ligne(emojiPlat, item.name + (formats.length ? ' · ' + formats[vIdx].name : ''),
                  '<i>' + qty + '×</i> ' + U.money(base() * qty)) +
            (nSuppTotal
              ? ligne('➕', nSuppTotal + ' supplément' + (nSuppTotal > 1 ? 's' : ''),
                      U.money(totSupp() * qty)) : '') +
            (nExtraTotal
              ? ligne('🛍️', nExtraTotal + ' complément' + (nExtraTotal > 1 ? 's' : ''),
                      U.money(totExtra())) : '') +
            '<div class="pz-r-trait"></div>' +
            ligne('💰', 'Sous-total', U.money(sousTotal)) +
            /* La livraison est une ESTIMATION et le dit : le montant exact
               dépend de la distance jusqu'à l'adresse, qui n'est demandée qu'à
               la validation. Annoncer un total ferme ici, c'est promettre un
               prix qu'on ne tiendra pas à deux rues près. */
            ligne(UI.icon('scooter', 16), 'Livraison (estimation)', 'dès ' + U.money(livraison), 'doux') +
            /* Aucune réduction n'existe encore dans Talabi : ni code promo, ni
               remise. La ligne est écrite et prête, mais elle ne s'affichera que
               le jour où il y aura quelque chose à retrancher — un « −0 DA »
               permanent est une promesse vide. */
            '<div class="pz-r-trait"></div>' +
            '<div class="pz-r total"><span>Total estimé</span><b>' +
              U.money(sousTotal + livraison) + '</b></div>';
        }

        function rafraichir(secousse) {
          $('#pzQ').textContent = qty;
          $('#pzTot').textContent = U.money(totArticles());
          const cta = $('#pzCta');
          if (cta) cta.textContent = U.money(totArticles());
          recap();
          if (secousse) {
            const t = $('#pzTot');
            t.classList.remove('bat');
            void t.offsetWidth;          // relance l'animation même si elle jouait
            t.classList.add('bat');
          }
        }

        /* ---- les formats ---- */
        function peindreFormats() {
          el.querySelectorAll('[data-fmt]').forEach(c => {
            const on = +c.dataset.fmt === vIdx;
            c.classList.toggle('on', on);
            c.setAttribute('aria-checked', on ? 'true' : 'false');
          });
        }

        /* ---- une carte de choix se redessine seule ----
           Remplacer la grille entière ferait repartir l'animation de TOUTES les
           cartes à chaque touche.

           ET LE PLUS SOUVENT, RIEN N'EST REMPLACÉ DU TOUT : passer de 2 à 3 ne
           change qu'un chiffre. Reconstruire la carte pour ça détruirait le
           bouton « + » sur lequel le doigt est encore posé — le focus part, et
           au clavier la touche suivante tombe dans le vide. On ne reconstruit
           que lorsque la carte change de forme : quand le « + » devient un
           compteur, et quand le compteur redevient un « + ». */
        function peindreCarte(attr, i, emoji, nom, prix, n) {
          const vieille = el.querySelector('[data-' + attr + '="' + i + '"]');
          if (!vieille) return;

          const compteur = vieille.querySelector('.pz-cpt');
          if (compteur && n) { compteur.querySelector('b').textContent = n; return; }

          const neuf = document.createElement('div');
          neuf.innerHTML = carteChoix(attr, i, emoji, nom, prix, n, 'Offert');
          const carte = neuf.firstChild;
          vieille.parentNode.replaceChild(carte, vieille);
          if (n) carte.querySelector('.pz-c-act').classList.add('arrive');
        }

        const peindreSupp  = i => peindreCarte('supp', i, emojiDe(supps[i].name, '🧂'),
                                               supps[i].name, +supps[i].extra_price || 0, nSupp[i]);
        const peindreExtra = i => peindreCarte('extra', i, emojiDe(extras[i].nom, extras[i].icone || '🥤'),
                                               extras[i].nom, extras[i].prix, nExtra[i]);

        function bougerSupp(i, d) {
          nSupp[i] = Math.max(0, Math.min(20, nSupp[i] + d));
          peindreSupp(i); rafraichir(true); vibrer(8);
        }
        function bougerExtra(i, d) {
          nExtra[i] = Math.max(0, Math.min(20, nExtra[i] + d));
          peindreExtra(i); rafraichir(true); vibrer(8);
        }

        /* ---- UN SEUL ÉCOUTEUR POUR TOUTES LES CARTES ----
           Elles sont remplacées à chaque changement : des écouteurs posés carte
           par carte disparaîtraient avec elles au premier clic. La délégation
           survit à tous les remplacements. */
        el.addEventListener('click', e => {
          const moins = e.target.closest('[data-moins]');
          const plus  = e.target.closest('[data-plus]');
          const carte = e.target.closest('[data-supp],[data-extra]');
          const fmt   = e.target.closest('[data-fmt]');

          if (moins || plus) {
            e.stopPropagation();
            const i = +(moins || plus).dataset[moins ? 'moins' : 'plus'];
            const d = moins ? -1 : 1;
            return carte.hasAttribute('data-supp') ? bougerSupp(i, d) : bougerExtra(i, d);
          }
          if (carte) {
            /* La carte entière prend le premier exemplaire. Ensuite, seuls les
               boutons du compteur agissent : un ajout accidentel en effleurant
               la carte se corrige mal quand on ne sait pas ce qu'on a touché. */
            if (carte.hasAttribute('data-supp')) {
              const i = +carte.dataset.supp;
              if (!nSupp[i]) bougerSupp(i, 1);
            } else {
              const i = +carte.dataset.extra;
              if (!nExtra[i]) bougerExtra(i, 1);
            }
            return;
          }
          if (fmt) {
            vIdx = +fmt.dataset.fmt;
            peindreFormats(); rafraichir(true); vibrer(8);
          }
        });

        /* Ce qui se clique à la souris doit s'activer au clavier : ces cartes
           sont des `div` porteuses d'un rôle, pas des `button` — un compteur ne
           peut pas vivre à l'intérieur d'un bouton. */
        el.addEventListener('keydown', e => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          if (!e.target.closest) return;
          /* LES VRAIS BOUTONS GARDENT LEUR CLAVIER. Les « − » et « + » du
             compteur vivent DANS la carte : `closest` remonte jusqu'à elle et
             on aurait donc activé la carte à leur place. Or un `<button>` sait
             déjà répondre à Entrée et à Espace — on ne fait que lui couper
             l'herbe sous le pied en appelant preventDefault. */
          if (e.target.closest('button')) return;
          const c = e.target.closest('[data-supp],[data-extra],[data-fmt]');
          if (!c) return;
          e.preventDefault();
          c.click();
        });

        /* ---- la barre du haut s'opacifie quand la photo est passée ----
           Le seuil est la hauteur réelle de la photo moins celle de la barre :
           écrit en dur, il aurait été faux sur petit écran, où la photo est plus
           courte. `passive` parce qu'on ne fait que lire une position — sans
           lui, le navigateur attend de savoir si l'on va bloquer le défilement. */
        const corps = el.querySelector('.sheet-body');
        const bloc  = el.querySelector('.pz');
        const photo = el.querySelector('.pz-hero');
        if (corps && bloc && photo) {
          const seuil = Math.max(40, photo.offsetHeight - 64);
          corps.addEventListener('scroll', () => {
            bloc.classList.toggle('defile', corps.scrollTop > seuil);
          }, { passive: true });
        }

        /* ---- la quantité ---- */
        $('[data-m]').onclick = () => { qty = Math.max(1, qty - 1); rafraichir(true); vibrer(6); };
        $('[data-p]').onclick = () => { qty = Math.min(30, qty + 1); rafraichir(true); vibrer(6); };

        /* ---- l'instruction écrite ---- */
        const champNote = $('#pzNote');
        champNote.addEventListener('input', () => {
          note = champNote.value;
          $('#pzNoteN').textContent = note.length + '/160';
        });

        /* ---- au panier ---- */
        $('#pzAdd').onclick = async function () {
          if (indispo) return UI.err('Plat indisponible', 'Le restaurant l’a retiré de sa carte aujourd’hui.');
          if (ferme) return UI.err('Restaurant fermé', 'Réouverture à ' + U.hhmm(resto.opens_at));

          const v = formats.length ? formats[vIdx] : null;
          const choisis = supps.map((o, i) => nSupp[i]
            ? { name: o.name, extra_price: +o.extra_price || 0, qty: nSupp[i] } : null).filter(Boolean);

          const ok = await Store.addToCart(resto, item, qty, choisis, v, note.trim());
          if (!ok) return;              // panier d'un autre restaurant, refus assumé

          /* Les compléments sont des plats : chacun sa ligne, comme s'il avait
             été ajouté depuis la carte. Le premier ajout a déjà réglé la
             question du restaurant, ceux-ci ne la reposent pas. */
          for (let i = 0; i < extras.length; i++) {
            if (nExtra[i]) await Store.addToCart(resto, extras[i].item, nExtra[i], [], extras[i].variant, '');
          }

          const nExtraTotal = nExtra.reduce((s, n) => s + n, 0);
          api.close();
          vibrer(14);
          UI.ok(qty + '× ' + item.name + (v ? ' (' + v.name + ')' : '') + ' ajouté' +
                (nExtraTotal ? ' + ' + nExtraTotal + ' complément' + (nExtraTotal > 1 ? 's' : '') : ''),
                'Panier : ' + U.money(Store.cartSubtotal));
          Shell.renderNav();
          renderCartBar(document.getElementById('view'));
        };

        rafraichir(false);
      }
    });
  }

  /* -------------------------------------------- barre panier flottante */
  function renderCartBar(view) {
    const old = document.getElementById('cartBar');
    if (old) old.remove();
    if (!Store.cartCount) return;

    const bar = document.createElement('div');
    bar.className = 'sticky-bar';
    bar.id = 'cartBar';
    bar.innerHTML = '<div class="wrap">' +
      '<div class="grow"><b>' + Store.cartCount + ' article(s)</b>' +
      '<div class="tiny">' + U.esc(Store.cart.restaurant_name || '') + '</div></div>' +
      '<a class="btn btn-primary" href="#/cart">Voir le panier • ' + U.money(Store.cartSubtotal) + '</a></div>';
    document.body.appendChild(bar);
    void view;
  }

  // la barre disparaît quand on change de page
  window.addEventListener('hashchange', () => {
    const b = document.getElementById('cartBar');
    if (b) b.remove();
  });

  /* ======================================================================
     PANIER
     ====================================================================== */
  Router.add('/cart', async function (params, query, view) {

    /* Thème sombre (maquette « panier 43 »). */
    UI.nuit('panier');

    function paint() {
      if (!Store.cartCount) {
        view.innerHTML =
          '<div class="empty-scene"><div class="wrap">' +
            /* DEUX ILLUSTRATIONS, UNE PAR THÈME, et c'est nécessaire.
               La version claire est dessinée sur fond quasi blanc : le thème
               clair la fond dans la page avec `mix-blend-mode:multiply`, mais
               multiplier par du noir donne du noir — sur fond sombre elle
               n'aurait laissé qu'un rectangle éteint. La version sombre est
               découpée dans la maquette fournie ; posée sur du crème, elle
               ferait à l'inverse un bloc noir. Chacune ne va que sur son
               thème, donc on choisit selon la préférence. */
            (UI.sombreVoulu()
              ? '<img class="scene-art" src="' + U.asset('assets/img/bg/panier-vide-nuit.jpg') + '" ' +
                  'width="1672" height="1016" decoding="async" alt="" aria-hidden="true">'
              : '<img class="scene-art" src="' + U.asset('assets/img/bg/panier-vide.png') + '" ' +
                  'width="830" height="430" decoding="async" alt="" aria-hidden="true">') +
            '<div class="h1 scene-title">Votre panier est vide</div>' +
            '<p class="scene-sub">Ajoutez vos plats préférés parmi les meilleurs restaurants de votre ville.</p>' +
            '<div class="scene-cta">' +
              '<a class="btn btn-primary btn-lg" href="#/restaurants">Découvrir les restaurants →</a>' +
              '<a class="btn btn-ghost btn-lg" href="#/">Retour à l’accueil 🏠</a>' +
            '</div>' +
          '</div></div>';
        Shell.renderNav();
        return;
      }

      const t = Store.cartTotals;
      const below = Store.cart.min_order && t.subtotal < Store.cart.min_order;

      view.innerHTML = '<div class="wrap-sm page">' +
        Cmp.pageHead('Mon panier', Store.cart.restaurant_name || '',
          '<button class="btn btn-danger btn-sm" id="clear">Vider</button>') +

        '<div class="card card-p">' +
          Store.cart.items.map(l =>
            '<div class="cart-row">' +
              '<div class="dish-img" style="width:58px;height:58px;font-size:22px' +
                (l.image_url ? ';background-image:url(' + U.escUrl(l.image_url) + ')' : '') + '">' +
                (l.image_url ? '' : '🍽️') + '</div>' +
              '<div class="grow"><b style="font-size:14.5px">' + U.esc(l.name) + '</b>' +
                (l.variant ? ' <span class="tag tag-muted">' + U.esc(l.variant.name) + '</span>' : '') +
                ((l.options && l.options.length)
                  ? '<div class="tiny">+ ' + U.esc(U.optionsText(l.options)) + '</div>' : '') +
                (l.note ? '<div class="tiny">✎ ' + U.esc(l.note) + '</div>' : '') +
                '<div class="price" style="margin-top:3px">' + U.money(Store.lineTotal(l)) + '</div></div>' +
              '<div class="qty"><button data-dec="' + U.esc(l.key) + '">−</button>' +
                '<b>' + l.quantity + '</b>' +
                '<button data-inc="' + U.esc(l.key) + '">+</button></div>' +
            '</div>').join('') +
        '</div>' +

        '<div class="card card-p" style="margin-top:14px">' +
          '<div class="oline"><span class="l">Sous-total</span><span>' + U.money(t.subtotal) + '</span></div>' +
          '<div class="oline"><span class="l">Frais de livraison</span><span>' + U.money(t.delivery_fee) + '</span></div>' +
          '<div class="divider"></div>' +
          '<div class="oline" style="font-size:17px;font-weight:800"><span>Total</span>' +
            '<span class="price">' + U.money(t.total) + '</span></div>' +
        '</div>' +

        (below ? '<div class="banner banner-warn" style="margin-top:12px">🧾 Minimum de commande : ' +
          U.money(Store.cart.min_order) + '. Ajoutez encore ' + U.money(Store.cart.min_order - t.subtotal) + '.</div>' : '') +

        '<button class="btn btn-primary btn-block btn-lg" style="margin-top:16px" id="next"' +
          (below ? ' disabled' : '') + '>Continuer la commande →</button>' +

        '<a class="btn btn-ghost btn-block" style="margin-top:10px" href="#/resto/' + U.esc(Store.cart.restaurant_id) + '">' +
          '+ Ajouter d’autres plats</a>' +
      '</div>';

      view.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => {
        const l = Store.cart.items.find(x => x.key === b.dataset.inc);
        Store.setQuantity(l.key, l.quantity + 1); paint();
      });
      view.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => {
        const l = Store.cart.items.find(x => x.key === b.dataset.dec);
        Store.setQuantity(l.key, l.quantity - 1); paint();
      });
      view.querySelector('#clear').onclick = async () => {
        if (await UI.confirm('Vider le panier ?', 'Tous les articles seront retirés.', 'Vider', true)) {
          Store.clearCart(); paint();
        }
      };
      view.querySelector('#next').onclick = () => {
        if (!Store.isLogged) {
          try { sessionStorage.setItem('talabi.after_login', '/checkout'); } catch (e) {}
          UI.toast('Connectez-vous pour finaliser votre commande');
          return Router.go('/login');
        }
        Router.go('/checkout');
      };
      Shell.renderNav();
    }

    paint();

    return () => UI.nuit('');
  });
})(window);
