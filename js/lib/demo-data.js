/* ==========================================================================
   Données de démonstration — ville de Tizi Ouzou
   Utilisées uniquement quand Supabase n'est pas configuré (mode démo).
   --------------------------------------------------------------------------
   ⚠️ POSITIONS GPS
   Seule celle de Melyza Tacos est certifiée (reprise de son propre site).
   Les quatre autres sont des approximations à partir de leur adresse : à
   corriger depuis l'espace Admin → Restaurants → « Position », en collant
   les coordonnées relevées sur Google Maps.

   ⚠️ MENUS
   Melyza Tacos : carte complète relevée sur ses affiches officielles
   (pizzas, tacos, burgers, sandwichs, chicken box, bowls, desserts, boissons).
   Les quatre autres restaurants n'ont que des exemples de départ, à remplacer
   par leurs vraies cartes.

   ⚠️ TAILLES
   La carte de Melyza propose deux formats (Small/Méga pour les pizzas,
   Solo/Menu pour le reste). Le modèle de données n'ayant qu'un prix de base
   et des suppléments, le prix affiché est celui du petit format et le grand
   format est proposé en supplément. Une seule limite : chez Melyza les
   suppléments de pizza comptent double en Méga, ce que le calcul ne sait pas
   encore faire — c'est signalé dans la description de chaque pizza.
   ========================================================================== */
(function (w) {
  'use strict';

  function iso(daysOffset) { return new Date(Date.now() + daysOffset * 86400000).toISOString(); }

  /* ------------------------------------------------------------------ ZONES */
  /* Quartiers de la VILLE de Tizi Ouzou uniquement (pas les communes). */
  const ZONE_NAMES = [
    ['z-centre',    'Centre-ville'],
    ['z-nouvelle',  'Nouvelle Ville'],
    ['z-bordj',     'El Bordj'],
    ['z-mdouha',    "M'Douha"],
    ['z-hasnaoua',  'Hasnaoua'],
    ['z-redjaouna', 'Redjaouna'],
    ['z-bekkar',    'Bekkar'],
    ['z-haute',     'Haute Ville'],
    ['z-boukhalfa', 'Boukhalfa'],
    ['z-kef',       'Kef Naâdja'],
    ['z-sidi',      'Sidi Belloua'],
    ['z-timizart',  'Timizart Loghbar'],
    ['z-tala',      'Tala Allam'],
    ['z-20aout',    'Cité 20 Août'],
    ['z-oued',      'Oued Aïssi']
  ];
  const ZONES = ZONE_NAMES.map((z, i) => ({
    id: z[0], name: z[1], wilaya: 'Tizi Ouzou', is_active: true, sort_order: i
  }));

  /* ------------------------------------------------------------ CATÉGORIES */
  /* image_url : pastille illustrée. L'emoji reste le repli quand il n'y en a pas. */
  const CAT_IMG = 'assets/img/categories/';
  const CATEGORIES = [
    { id: 'cat-pizza',  slug: 'pizza',        name_fr: 'Pizza',               icon: '🍕', image_url: CAT_IMG + 'pizza.jpg',        sort_order: 1, is_active: true },
    { id: 'cat-tacos',  slug: 'tacos',        name_fr: 'Tacos',               icon: '🌯', image_url: CAT_IMG + 'tacos.jpg',        sort_order: 2, is_active: true },
    { id: 'cat-burger', slug: 'burger',       name_fr: 'Burgers',             icon: '🍔', image_url: CAT_IMG + 'burger.jpg',       sort_order: 3, is_active: true },
    { id: 'cat-sand',   slug: 'sandwich',     name_fr: 'Sandwichs',           icon: '🥪', image_url: CAT_IMG + 'sandwich.jpg',     sort_order: 4, is_active: true },
    { id: 'cat-trad',   slug: 'traditionnel', name_fr: 'Plats traditionnels', icon: '🥘', image_url: CAT_IMG + 'traditionnel.jpg', sort_order: 5, is_active: true },
    { id: 'cat-dess',   slug: 'dessert',      name_fr: 'Desserts',            icon: '🍰', image_url: CAT_IMG + 'dessert.jpg',      sort_order: 6, is_active: true },
    { id: 'cat-drink',  slug: 'boisson',      name_fr: 'Boissons',            icon: '🥤', image_url: CAT_IMG + 'boisson.jpg',      sort_order: 7, is_active: true },
    { id: 'cat-autre',  slug: 'autre',        name_fr: 'Autres',              icon: '🍽️', image_url: null,                         sort_order: 8, is_active: true }
  ];

  /* --------------------------------------------------------------- COMPTES */
  /* Un compte gérant = un seul restaurant. */
  const PROFILES = [
    { id: 'u-client',    email: 'client@talabi.dz',    full_name: 'Amine Belkacem', phone: '0550112233', role: 'client',     zone_id: 'z-centre',   is_blocked: false, created_at: iso(-30) },
    { id: 'u-admin',     email: 'admin@talabi.dz',     full_name: 'Administrateur', phone: '0555000000', role: 'admin',      zone_id: 'z-centre',   is_blocked: false, created_at: iso(-60) },
    { id: 'u-driver',    email: 'livreur@talabi.dz',   full_name: 'Sofiane Haddad', phone: '0770334455', role: 'driver',     zone_id: 'z-centre',   is_blocked: false, created_at: iso(-20) },
    { id: 'u-d2',        email: 'livreur2@talabi.dz',  full_name: 'Bilal Kaci',     phone: '0771889900', role: 'driver',     zone_id: 'z-nouvelle', is_blocked: false, created_at: iso(-8) },

    { id: 'u-melyza',    email: 'resto@talabi.dz',     full_name: 'Gérant Melyza Tacos',   phone: '0560566117', role: 'restaurant', zone_id: 'z-centre',   is_blocked: false, created_at: iso(-40) },
    { id: 'u-sadoudi',   email: 'sadoudi@talabi.dz',   full_name: 'Gérant Maison Sadoudi', phone: null,         role: 'restaurant', zone_id: 'z-bordj',    is_blocked: false, created_at: iso(-38) },
    { id: 'u-ambassade', email: 'ambassade@talabi.dz', full_name: "Gérant L'Ambassade",    phone: '0555004173', role: 'restaurant', zone_id: 'z-centre',   is_blocked: false, created_at: iso(-36) },
    { id: 'u-atelier',   email: 'atelier@talabi.dz',   full_name: "Gérant L'Atelier",      phone: null,         role: 'restaurant', zone_id: 'z-nouvelle', is_blocked: false, created_at: iso(-34) },
    { id: 'u-twelve',    email: 'twelve@talabi.dz',    full_name: 'Gérant The Twelve',     phone: null,         role: 'restaurant', zone_id: 'z-nouvelle', is_blocked: false, created_at: iso(-32) }
  ];

  const PASSWORDS = {};
  PROFILES.forEach(p => { PASSWORDS[p.email] = '123456'; });

  /* ----------------------------------------------------------- RESTAURANTS */
  const IMG = 'assets/img/restaurants/';

  function r(o) {
    return {
      id: o.id, owner_id: o.owner, name: o.name, description: o.desc,
      logo_url: o.img ? IMG + o.img + '-logo.jpg' : null,
      cover_url: o.img ? IMG + o.img + '-cover.jpg' : null,
      address: o.address, zone_id: o.zone,
      lat: o.lat, lng: o.lng, gps_verified: !!o.verified,
      phone: o.phone || null,
      opens_at: o.opens || '11:00', closes_at: o.closes || '23:00',
      is_open: true, status: 'approved', reject_reason: null,
      rating: o.rating, rating_count: o.rcount,
      // Frais de livraison = valeur par défaut de la plateforme.
      // Minimum de commande à 0 : je n'ai aucune donnée réelle là-dessus,
      // chaque restaurant fixe le sien depuis son espace.
      delivery_fee: o.fee, min_order: 0, prep_time_min: o.prep || 25,
      categories: o.cats, created_at: iso(-40)
    };
  }

  const RESTAURANTS = [
    r({
      id: 'r-melyza', owner: 'u-melyza', name: 'Melyza Tacos', img: 'melyza',
      desc: 'French tacos, burgers et sandwichs préparés minute. The best corner.',
      address: '20, Rue Boudelal Arezki', zone: 'z-centre',
      lat: 36.713198, lng: 4.043767, verified: true,      // relevé sur son site officiel
      phone: '0560566117', opens: '11:00', closes: '23:30',
      rating: 4.8, rcount: 214, fee: 200, min: 400, prep: 20,
      cats: ['cat-tacos', 'cat-burger', 'cat-sand', 'cat-pizza', 'cat-dess', 'cat-drink']
    }),
    r({
      id: 'r-ambassade', owner: 'u-ambassade', name: "L'Ambassade", img: 'ambassade',
      desc: 'Restaurant depuis 1988. Cuisine bistronomique et fait maison, dressage soigné.',
      address: '14, Rue Douar Mohammed', zone: 'z-centre',
      lat: 36.7118, lng: 4.0455,                          // approximatif — à corriger
      phone: '0555004173', opens: '11:30', closes: '23:00',
      rating: 4.7, rcount: 168, fee: 250, min: 800, prep: 35,
      cats: ['cat-trad', 'cat-autre']
    }),
    r({
      id: 'r-sadoudi', owner: 'u-sadoudi', name: 'Maison Sadoudi', img: 'sadoudi',
      desc: 'Depuis 1985 — goûtez la différence. Grillades, plats du terroir et pâtisseries maison.',
      address: 'Lotissement El Bordj, Rue Abdenouri Saïd', zone: 'z-bordj',
      lat: 36.7085, lng: 4.0500,                          // approximatif — à corriger
      opens: '10:30', closes: '22:30',
      rating: 4.6, rcount: 121, fee: 250, min: 600, prep: 30,
      cats: ['cat-trad', 'cat-dess']
    }),
    r({
      id: 'r-atelier', owner: 'u-atelier', name: "L'Atelier en Ville", img: 'atelier',
      desc: 'Burgers, pizzas, planches et desserts dans une ambiance atelier. Ouvert de 7h à minuit.',
      address: 'Route vers Azib Ahmed, derrière la 2ᵉ porte Bastos', zone: 'z-nouvelle',
      lat: 36.6981, lng: 4.0574,                          // quartier Bastos (OpenStreetMap)
      opens: '07:00', closes: '23:59',
      rating: 4.5, rcount: 203, fee: 200, min: 500, prep: 25,
      cats: ['cat-burger', 'cat-pizza', 'cat-dess', 'cat-drink']
    }),
    r({
      id: 'r-twelve', owner: 'u-twelve', name: 'The Twelve', img: 'twelve',
      desc: 'Food & Coffee — poutines, burgers signature et poulet croustillant.',
      address: 'Nouvelle Ville, Tizi Ouzou', zone: 'z-nouvelle',
      lat: 36.7050, lng: 4.0530,                          // approximatif — à corriger
      opens: '11:30', closes: '00:30',
      rating: 4.5, rcount: 96, fee: 200, min: 500, prep: 25,
      cats: ['cat-burger', 'cat-autre', 'cat-drink']
    })
  ];

  /* ------------------------------------------------------------------ MENUS */
  const MENU = [];
  const OPTIONS = [];
  const VARIANTS = [];

  /* price : prix unique, ou tableau de formats [['Solo', 750], ['Menu', 950]].
     Avec des formats, menu_items.price vaut le moins cher — c'est lui qui
     s'affiche dans les listes et qui sert au tri et à la recherche. */
  function m(rid, cat, name, desc, price, opts) {
    const id = 'mi-' + (MENU.length + 1);
    const formats = Array.isArray(price) ? price : null;
    MENU.push({
      id: id, restaurant_id: rid, category_id: cat, name: name, description: desc,
      price: formats ? formats.reduce((mn, f) => Math.min(mn, f[1]), formats[0][1]) : price,
      image_url: null, is_available: true, sort_order: MENU.length, created_at: iso(-38)
    });
    (formats || []).forEach((f, i) => VARIANTS.push({
      id: id + '-v' + i, menu_item_id: id, name: f[0], price: f[1], sort_order: i, is_active: true
    }));
    (opts || []).forEach((o, i) => OPTIONS.push({
      id: id + '-o' + i, menu_item_id: id, name: o[0], extra_price: o[1], is_active: true
    }));
  }

  /* ==================================================================
     MELYZA TACOS — carte complète, relevée sur ses affiches officielles
     ================================================================== */

  /* Suppléments communs aux pizzas (250 DA l'unité sur la carte). */
  const SUP_PIZZA = [
    ['Viande hachée', 250], ['Merguez', 250], ['Poulet', 250], ['Thon', 250],
    ['Champignons', 250], ['Cheddar', 250], ['Mozzarella', 250],
    ['Camembert', 250], ['Gruyère', 250],
    ['Pâte américaine graines de sésame', 100],
    ['Pâte américaine fourrée au fromage fondu', 150]
  ];
  const MEGA_NOTE = ' Suppléments facturés ×2 en format Méga.';

  /* small = prix Small, mega = prix Méga (null si la pizza n'existe qu'en Méga). */
  function pizza(name, ing, small, mega) {
    m('r-melyza', 'cat-pizza', name, ing + MEGA_NOTE,
      mega ? [['Small', small], ['Méga', mega]] : small, SUP_PIZZA);
  }

  /* solo = prix seul, menu = prix avec frites et boisson. */
  function solo(cat, name, ing, prixSolo, prixMenu) {
    m('r-melyza', cat, name, ing,
      prixMenu ? [['Solo', prixSolo], ['Menu (frites + boisson)', prixMenu]] : prixSolo);
  }

  /* ---------------------------------------------------------- PIZZAS */
  pizza('Pizza Végétarienne', 'Sauce tomate, mozzarella, cheddar, champignons, tomates fraîches, poivrons, herbes de Provence.', 600, 1700);
  pizza('Pizza Thon',         'Sauce tomate, mozzarella, cheddar, thon, poivron, herbes de Provence.', 700, 1650);
  pizza('Pizza Chicken',      'Sauce tomate, mozzarella, cheddar, poulet, poivrons, herbes de Provence.', 750, 1950);
  pizza('Pizza Américaine',   'Sauce tomate, mozzarella, cheddar, viande hachée, poivrons, herbes de Provence.', 800, 2050);
  pizza('Pizza Tropicale',    'Sauce tomate, mozzarella, cheddar, poulet, champignons, poivrons, herbes de Provence.', 900, 2200);
  pizza('Pizza Orientale',    'Sauce tomate, mozzarella, cheddar, merguez, œuf, poivrons, herbes de Provence.', 900, 1950);
  pizza('Pizza Barbecue',     'Sauce tomate, mozzarella, cheddar, viande hachée épicée, oignons, poivrons, herbes de Provence.', 900, 2100);
  pizza('Pizza Spéciale',     'Sauce tomate, mozzarella, cheddar, viande hachée, poulet, merguez, poivrons, herbes de Provence.', 1100, 2250);
  pizza('Pizza Mix Spécial',  'Sauce tomate, mozzarella, cheddar, viande hachée, poulet, champignons, poivrons, herbes de Provence.', 1100, 2250);
  pizza('Pizza Fish House',   'Sauce tomate, mozzarella, cheddar, thon, crevettes, calamar, poivrons, herbes de Provence.', 1250, 2650);
  pizza('Pizza Classique',    'Sauce tomate, mozzarella, cheddar, crevettes, champignons, poivrons, herbes de Provence.', 1250, 2500);
  pizza('Pizza Queen',        'Sauce tomate, mozzarella, cheddar, poulet, ananas.', 900, 1650);
  pizza('Pizza 3 Fromages',   'Sauce blanche, mozzarella, cheddar, camembert, herbes de Provence.', 800, 1900);
  pizza('Pizza 4 Fromages',   'Sauce blanche, mozzarella, cheddar, gruyère, roquefort, herbes de Provence.', 1150, 2250);
  pizza('Pizza Parisienne',   'Sauce blanche, mozzarella, cheddar, poulet, herbes de Provence.', 850, 1950);
  pizza('Pizza Poulet Fumé',  'Sauce blanche, mozzarella, cheddar, poulet fumé, herbes de Provence.', 850, 1950);
  pizza('Pizza Chicago',      'Sauce blanche, mozzarella, cheddar, viande hachée, saucisson fumé, herbes de Provence.', 950, 2250);
  pizza('Pizza Chèvre Miel',  'Sauce blanche, gruyère, chèvre, miel, noix.', 900, 2200);
  pizza('Pizza Saumon',       'Sauce blanche, mozzarella, cheddar, saumon, herbes de Provence.', 1300, 2500);
  pizza('Pizza Spicy',        'Sauce tomate, cheddar, mozzarella, poulet épicé, huile piquante, poivron, herbes de Provence.', 900, 2150);
  pizza('Pizza Anchois',      'Sauce tomate, cheddar, mozzarella, câpres, anchois, huile d’olive, herbes de Provence.', 950, 2250);
  pizza('Pizza Boursin',      'Sauce blanche, boursin, mozzarella, cheddar, poulet fumé, herbes de Provence.', 950, 2200);
  pizza('Pizza Pepperonis',   'Sauce tomate, mozzarella, cheddar, pepperonis.', 1100, 2250);
  pizza('Pizza Végé Suprême', 'Sauce tomate, cheddar, mozzarella, tomate fraîche, champignons, maïs, oignon, poivron, herbes de Provence.', 700, 1800);
  pizza('Pizza Raclette',     'Sauce tomate, cheddar, mozzarella, raclette artisanale, herbes de Provence.', 900, 2200);
  pizza('Pizza Spéciale Melyza', 'La signature de la maison, garniture généreuse.', 1500, 3200);
  pizza('My Pizza',           'Six (6) ingrédients au choix, composez la vôtre.', 1600, 2800);
  pizza('Pizza Quatre Saisons', 'Poulet, viande hachée, merguez, champignons. Uniquement en format Méga.', 2600, null);

  /* ------------------------------------------------ TACOS SPÉCIAUX */
  solo('cat-tacos', 'Le Suisse',            'Escalope de poulet, fromage fondu, jambon de dinde, oignons caramélisés, gratiné cheddar, poivron, sauce au choix.', 750, 950);
  solo('cat-tacos', 'Gratiné Chèvre Miel',  'Au poulet, gratiné chèvre et miel.', 700, 900);
  solo('cat-tacos', 'Gratiné Boursin',      'Poulet, cheddar, boursin, sauce algérienne.', 750, 950);
  solo('cat-tacos', 'Le Frenchy',           'Viande hachée, camembert, salami, oignons caramélisés, sauce miel moutarde.', 800, 1000);
  solo('cat-tacos', 'Le Fumé',              'Cordon bleu, sauce barbecue, gratiné cheddar.', 700, 900);
  solo('cat-tacos', 'Tacos Tenders',        'Tenders croustillants, frites et sauce au choix.', 600, 800);
  /* Nouveautés */
  solo('cat-tacos', 'Le Mythique',          'Gratiné gouda, cordon bleu, sauce barbecue.', 750, 950);
  solo('cat-tacos', 'Le Légendaire',        'Gratiné mozzarella, nuggets, sauce burger.', 750, 950);
  solo('cat-tacos', 'Le Montagnard',        'Gratinée raclette, jambon de poulet, tenders, sauce au choix.', 750, 950);
  solo('cat-tacos', 'Le Fameux',            'Gratiné cheddar, viande hachée, champignons, sauce algérienne.', 850, 1050);

  /* ------------------------------------------------------- BURGERS */
  solo('cat-burger', 'Big Melyza',        '2 steaks, gruyère, champignons, cornichons, poivrons, sauce à l’ail.', 950, 1150);
  solo('cat-burger', 'Big Crispy',        'Poulet pané, salade, tomate, oignons.', 650, 850);
  solo('cat-burger', 'Franche Burger',    '2 steaks, camembert, cheddar, cornichons, sauce big burger.', 900, 1100);
  solo('cat-burger', 'Mozzarella Burger', '2 steaks, jambon de dinde, mozzarella, oignons caramélisés, champignons.', 850, 1050);
  solo('cat-burger', 'Big Fast',          '2 steaks, cheddar, œuf, oignons caramélisés.', 750, 950);
  solo('cat-burger', 'Le Poivre',         'Steak haché, poulet haché, gouda, oignons caramélisés, sauce au poivre.', 750, 950);

  /* ----------------------------------------------------- SANDWICHS */
  solo('cat-sand', 'Melyza Spécial',   'Steak haché, fromage blanc, cheddar, salade, tomate, cornichons, champignons, oignons caramélisés, omelette, frites.', 900, 1100);
  solo('cat-sand', 'Sandwich Avocat',  'Avocat, thon, tomate, salade, fromage à tartiner.', 700, 900);
  solo('cat-sand', 'Sandwich Poulet',  'Poulet, camembert, cheddar, salade, tomate, cornichons, oignons caramélisés, frites.', 700, 900);

  /* ------------------------------------------- CHICKEN BOX & BOWLS */
  m('r-melyza', 'cat-autre', 'Chicken Box', 'Tenders, nuggets et cordon bleu réunis dans un seau.', 600, []);
  /* Les trois tailles de la carte deviennent trois formats du même produit :
     le client en choisit un, il ne peut pas prendre M et XL à la fois. */
  m('r-melyza', 'cat-autre', 'Tenders',     'Poulet croustillant, sauce au choix.',
    [['M — 3 pièces', 350], ['L — 6 pièces', 550], ['XL — 12 pièces', 1100]]);
  m('r-melyza', 'cat-autre', 'Nuggets',     'Nuggets de poulet, sauce au choix.',
    [['M — 3 pièces', 300], ['L — 6 pièces', 400], ['XL — 12 pièces', 650]]);
  m('r-melyza', 'cat-autre', 'Cordon Bleu', 'Cordon bleu pané, sauce au choix.',
    [['M — 3 pièces', 450], ['L — 6 pièces', 850], ['XL — 12 pièces', 1550]]);
  solo('cat-autre', 'Tacos Bowl',              'Escalopes de poulet, cordon bleu, nuggets, tenders, sauces au choix.', 700, 900);
  solo('cat-autre', 'Bowl Chèvre Miel Poulet', 'Frites, poulet, sauce fromage, cheddar gratiné, chèvre, miel.', 850, 1050);
  solo('cat-autre', 'Spicy Bowl',              'Tenders, piment, sauce samouraï.', 800, 1000);

  /* ------------------------------------------------------- SALADES */
  m('r-melyza', 'cat-autre', 'Salade César',         'Salade, poulet, croûtons, parmesan.', 650, []);
  m('r-melyza', 'cat-autre', 'Salade de Thon',       'Thon, crudités et œuf.', 450, []);
  m('r-melyza', 'cat-autre', 'Salade Saumon Avocat', 'Saumon, avocat et crevettes.', 1050, []);
  m('r-melyza', 'cat-autre', 'Salade Melyza',        'La grande salade composée de la maison.', 950, []);
  m('r-melyza', 'cat-autre', 'Assiette de Fromages', 'Plateau de fromages affinés.', 1100, []);

  /* ------------------------------------------------------ DESSERTS */
  /* Suppléments desserts : 250 DA l'unité, boule de glace 100 DA. */
  const SUP_DESSERT = [
    ['Nutella', 250], ['Banane', 250], ['Fruits secs', 250], ['Ferrero', 250],
    ['M&M’s', 250], ['Twix', 250], ['Kit-Kat', 250], ['Lion', 250], ['Mars', 250],
    ['Snickers', 250], ['Bounty', 250], ['Raffaello', 250], ['Bueno', 250],
    ['Pistache', 250], ['Boule de glace', 100]
  ];
  const BOULE = [['Boule de glace', 100]];

  function dessert(name, desc, price, sups) {
    m('r-melyza', 'cat-dess', name, desc, price, sups || BOULE);
  }

  dessert('Cheesecake Fraise',  'Cheesecake maison, coulis de fraise.', 400, SUP_DESSERT);
  dessert('Cheesecake Lotus',   'Cheesecake maison, spéculoos Lotus.', 500, SUP_DESSERT);
  dessert('Cheesecake Oreo',    'Cheesecake maison, biscuits Oreo.', 500, SUP_DESSERT);
  dessert('Cheesecake Bueno',   'Cheesecake maison, Kinder Bueno.', 500, SUP_DESSERT);
  dessert('Cheesecake Citron',  'Cheesecake maison, citron.', 500, SUP_DESSERT);
  dessert('Cheesecake Nutella', 'Cheesecake maison, Nutella.', 600, SUP_DESSERT);
  dessert('Cheesecake Pistache','Cheesecake maison, pistache.', 700, SUP_DESSERT);

  dessert('Crêpe Nutella',     'Crêpe gourmande au Nutella.', 400, SUP_DESSERT);
  dessert('Crêpe Banane',      'Crêpe gourmande à la banane.', 550, SUP_DESSERT);
  dessert('Crêpe Pistache',    'Crêpe gourmande à la pistache.', 550, SUP_DESSERT);
  dessert('Crêpe Lotus',       'Crêpe gourmande au Lotus.', 600, SUP_DESSERT);
  dessert('Crêpe Fraise',      'Crêpe gourmande à la fraise.', 650, SUP_DESSERT);
  dessert('Crêpe Oreo',        'Crêpe gourmande aux Oreo.', 650, SUP_DESSERT);
  dessert('Crêpe Fruits Secs', 'Crêpe gourmande aux fruits secs.', 650, SUP_DESSERT);
  dessert('Crêpe Fruits',      'Crêpe gourmande aux fruits frais.', 700, SUP_DESSERT);
  dessert('Crêpe Bounty',      'Crêpe gourmande au Bounty.', 700, SUP_DESSERT);
  dessert('Crêpe Bueno',       'Crêpe gourmande au Kinder Bueno.', 800, SUP_DESSERT);
  dessert('Crêpe El Mordjene', 'Crêpe gourmande à la pâte El Mordjene.', 350, SUP_DESSERT);
  dessert('Crêpe Spéciale',    'La grande crêpe garnie de la maison.', 1000, SUP_DESSERT);

  dessert('Mousse au Chocolat',  'Mousse maison au chocolat noir.', 300);
  dessert('Crème Brûlée',        'Crème vanille, caramel craquant.', 350);
  dessert('Fondant au Chocolat', 'Cœur coulant, servi tiède.', 450);
  dessert('Maxi Fruits',         'Grande coupe de fruits frais.', 900);

  dessert('Tiramisu',          'Tiramisu classique au café.', 350);
  dessert('Tiramisu Pistache', 'Tiramisu à la pistache.', 400);
  dessert('Tiramisu Chocolat', 'Tiramisu au chocolat.', 350);
  dessert('Tiramisu Citron',   'Tiramisu au citron.', 350);

  /* ------------------------------------------------------ BOISSONS */
  function boisson(name, desc, price, opts) {
    m('r-melyza', 'cat-drink', name, desc, price, opts || []);
  }
  /* Les cafés lactés se déclinent vanille, caramel ou noisette (sans supplément). */
  const AROMES = [['Vanille', 0], ['Caramel', 0], ['Noisette', 0]];

  /* Boissons chaudes */
  boisson('Espresso',        'Café serré.', 150);
  boisson('Doppio',          'Double espresso.', 250);
  boisson('Espresso Kinder', 'Espresso façon Kinder.', 300);
  boisson('Americano',       'Café allongé, glacé ou nature.', 250);
  boisson('Affogato',        'Espresso versé sur une glace vanille.', 300);
  boisson('Thé Infusion',    'Infusion au choix.', 150);
  boisson('Cappuccino',      'Café, lait, mousse onctueuse.', 350, AROMES);
  boisson('Mocha',           'Café, chocolat et lait.', 350, AROMES);
  boisson('Flat White',      'Café, lait micro-moussé.', 350, AROMES);
  boisson('Latte',           'Café allongé au lait.', 350, AROMES);
  boisson('Dalgona Coffee',  'Café fouetté, glacé ou nature.', 350);
  boisson('Ice Tea',         'Thé glacé maison.', 250);

  /* Glaces */
  boisson('Boule de Glace',   'Une boule au parfum de votre choix.', 120);
  boisson('Boule de Fraise',  'Une boule à la fraise.', 140);
  boisson('Banana Split',     'Banane, glace, chantilly et chocolat.', 200);

  /* Milkshakes */
  boisson('Milkshake Vanille',              'Milkshake onctueux à la vanille.', 350);
  boisson('Milkshake Caramel Beurre Salé',  'Milkshake au caramel beurre salé.', 450);
  boisson('Milkshake Nutella',              'Milkshake au Nutella.', 450);
  boisson('Milkshake Nutella Banane',       'Milkshake Nutella et banane.', 550);
  boisson('Milkshake Snickers',             'Milkshake au Snickers.', 450);
  boisson('Milkshake Bueno',                'Milkshake au Kinder Bueno.', 450);
  boisson('Milkshake KitKat',               'Milkshake au KitKat.', 450);
  boisson('Milkshake Oreo',                 'Milkshake aux Oreo.', 550);
  boisson('Milkshake Avocat',               'Milkshake à l’avocat.', 800);

  /* Mojitos */
  boisson('Mojito Classique',        'Citron vert, menthe fraîche.', 450);
  boisson('Pink Mojito',             'Mojito version fruits rouges.', 500);
  boisson('Blue Mojito',             'Mojito au blue curaçao.', 500);
  boisson('Mojito Fraise Menthe',    'Fraise et menthe fraîche.', 600);
  boisson('Mojito Kiwi',             'Mojito au kiwi.', 700);
  boisson('Mojito Inspiration du Chef', 'La création mojito du moment.', 800);

  /* Jus naturels */
  boisson('Jus de Citron',      'Pressé minute.', 400);
  boisson('Jus d’Orange',       'Pressé minute.', 350);
  boisson('Jus de Banane',      'Fruit frais mixé.', 350);
  boisson('Jus de Fraise',      'Fruit frais mixé.', 400);
  boisson('Jus de Pêche',       'Fruit frais mixé.', 350);
  boisson('Jus de Grenade',     'Pressé minute.', 400);
  boisson('Cocktail de Fruits', 'Assortiment de fruits frais.', 500);

  /* Cocktails */
  boisson('Cocktail Florida',        'Orange, ananas, fraise, citron.', 450);
  boisson('Cocktail Rio',            'Citron, menthe, limonade, blue curaçao.', 450);
  boisson('Cocktail Fleur d’Amour',  'Mangue, fraise, lait de coco.', 600);
  boisson('Cocktail The Pink Lady',  'Ananas, goyave, fraise, citron.', 650);
  boisson('Cocktail Hawaï',          'Ananas, orange, lait de coco.', 650);
  boisson('Cocktail Bahama-Mama',    'Ananas, orange, fraise, grenadine.', 650);
  boisson('Cocktail Bora-Bora',      'Citron, fruit de la passion, Sprite.', 650);
  boisson('Cocktail Blue Lagoon',    'Limonade, citron, blue curaçao.', 650);
  boisson('Cocktail Pina Colada',    'Ananas, lait de coco.', 700);
  boisson('Cocktail Bahamas Kiwi',   'Kiwi et agrumes.', 750);
  boisson('Cocktail Blue Star',      'Limonade, fruits rouges, blue curaçao.', 750);
  boisson('Cocktail Strawberry Colada', 'Fraise, ananas.', 800);
  boisson('Cocktail Inspiration du Chef', 'La création du moment.', 800);

  /* Smoothies & frappuccinos */
  boisson('Smoothie Pomme Kiwi',     'Pomme et kiwi mixés.', 700);
  boisson('Smoothie Mangue Passion', 'Mangue et fruit de la passion.', 650);
  boisson('Morning Smoothie',        'Le smoothie vitaminé du matin.', 750);
  boisson('Frappé Noix',             'Frappé onctueux aux noix.', 700);
  boisson('Frappuccino Vanille',     'Café glacé fouetté, vanille.', 350);
  boisson('Frappuccino Caramel',     'Café glacé fouetté, caramel.', 350);
  boisson('Frappuccino Fraise',      'Frappé glacé à la fraise.', 400);
  boisson('Frappuccino Banane',      'Frappé glacé à la banane.', 400);

  /* --- Les cartes ci-dessous sont des EXEMPLES à remplacer --- */
  m('r-ambassade', 'cat-trad',  'Couscous royal',      'Semoule fine, agneau et légumes de saison.', 1400, []);
  m('r-ambassade', 'cat-trad',  'Tajine du chef',      'Recette maison du jour.', 1200, []);
  m('r-ambassade', 'cat-autre', 'Entrecôte grillée',   'Accompagnement au choix.', 1800, []);
  m('r-ambassade', 'cat-autre', 'Salade de saison',    'Produits frais du marché.', 600, []);

  m('r-sadoudi', 'cat-trad', 'Entrecôte grillée',    'Riz pilaf, gratin de pommes de terre et légumes du marché.', 1600, []);
  m('r-sadoudi', 'cat-trad', 'Couscous kabyle',      'Semoule, légumes et viande mijotée.', 1200, []);
  m('r-sadoudi', 'cat-trad', 'Chorba',               'Soupe traditionnelle.', 400, []);
  m('r-sadoudi', 'cat-dess', 'Pâtisseries maison',   'Assortiment de 4 pièces.', 500, []);

  m('r-atelier', 'cat-burger', 'Burger de l’Atelier', 'Steak maison, cheddar affiné, sauce signature.', 900,
    [['Double steak', 250], ['Bacon de dinde', 120]]);
  m('r-atelier', 'cat-pizza',  'Pizza margherita',    'Sauce tomate, mozzarella, basilic.',
    [['Small', 800], ['Grande', 1100]]);
  m('r-atelier', 'cat-pizza',  'Pizza 4 fromages',    'Mozzarella, gouda, cheddar, chèvre.',
    [['Small', 1100], ['Grande', 1400]]);
  m('r-atelier', 'cat-dess',   'Pancakes',            'Sirop d’érable ou chocolat.', 550, []);
  m('r-atelier', 'cat-drink',  'Jus pressé',          'Orange ou citron, 40 cl.', 350, []);

  /* Poutines : prix relevés sur la communication officielle de The Twelve */
  m('r-twelve', 'cat-autre','Poutine Poulet',      'Frites, cheddar fondu, poulet grillé et sauce maison.', 450,
    [['Supplément cheddar', 80]]);
  m('r-twelve', 'cat-autre','Poutine Viande Hachée', 'Frites, cheddar fondu, viande hachée et ciboulette.', 500,
    [['Supplément cheddar', 80]]);
  m('r-twelve', 'cat-burger', 'The Twelve Burger', 'Double steak, cheddar, oignons croustillants.',
    [['Solo', 950], ['Menu (frites + boisson)', 1200]], [['Bacon de dinde', 120]]);
  m('r-twelve', 'cat-burger', 'Chicken Burger',    'Filet de poulet pané, sauce spicy.',
    [['Solo', 850], ['Menu (frites + boisson)', 1100]]);
  m('r-twelve', 'cat-autre','Tenders (6 pièces)','Poulet croustillant, 2 sauces au choix.', 700, [['Sauce supplémentaire', 60]]);
  m('r-twelve', 'cat-drink',  'Milkshake',         'Vanille, chocolat ou Oreo, 40 cl.', 450, []);

  /* --------------------------------------------------------------- LIVREURS */
  const DRIVERS = [
    { id: 'u-driver', vehicle: 'moto', plate: '15-1234-118', zone_id: 'z-centre', status: 'available',
      validation_status: 'approved', rating: 4.9, total_deliveries: 148, total_earnings: 23680,
      last_lat: null, last_lng: null, last_position_at: null, created_at: iso(-20) },
    { id: 'u-d2', vehicle: 'voiture', plate: '15-5678-116', zone_id: 'z-nouvelle', status: 'offline',
      validation_status: 'pending', rating: 5.0, total_deliveries: 0, total_earnings: 0,
      last_lat: null, last_lng: null, last_position_at: null, created_at: iso(-8) }
  ];

  /* --------------------------------------------------------------- ADRESSES */
  /* Aucune adresse pré-remplie : le client ajoute la sienne depuis sa position
     réelle. Une adresse d'exemple donnerait un point GPS faux au livreur. */
  const ADDRESSES = [];

  /* -------------------------------------------------------------- COMMANDES */
  const ORDERS = [];
  const ORDER_ITEMS = [];

  /* Les plats sont désignés par leur nom : les identifiants « mi-N » dépendent
     de l'ordre d'insertion et changeraient à chaque retouche de la carte. */
  addOrder('o1', 'delivered', -3, 'r-melyza', 'u-driver', [['Le Suisse', 2], ['Milkshake Oreo', 2]]);
  addOrder('o2', 'delivered', -1, 'r-atelier', 'u-driver', [['Burger de l’Atelier', 1]]);

  function addOrder(id, status, daysAgo, rid, driver, lines) {
    const rest = RESTAURANTS.find(x => x.id === rid);
    let subtotal = 0;
    lines.forEach(l => {
      const it = MENU.find(x => x.restaurant_id === rid && x.name === l[0]);
      if (!it) throw new Error('Plat de démonstration introuvable : ' + l[0]);
      // un plat à formats est forcément vendu dans l'un d'eux : on prend le
      // premier, comme le ferait un client qui ne change pas le choix par défaut
      const fmt = VARIANTS.filter(v => v.menu_item_id === it.id)[0] || null;
      const unit = fmt ? fmt.price : it.price;
      const lt = unit * l[1];
      subtotal += lt;
      ORDER_ITEMS.push({
        id: 'oi-' + ORDER_ITEMS.length, order_id: id, menu_item_id: it.id, name: it.name,
        variant: fmt ? fmt.name : null,
        unit_price: unit, quantity: l[1], options: [], line_total: lt
      });
    });
    const t = U.computeTotals(subtotal, rest.delivery_fee, null);
    ORDERS.push(Object.assign({
      id: id, code: U.orderCode(), client_id: 'u-client', restaurant_id: rid, driver_id: driver,
      zone_id: 'z-centre', status: status,
      address_street: 'Cité 20 Août, Bât C, Appt 12', address_details: '2e étage',
      address_lat: 36.7145, address_lng: 4.0490,
      client_phone: '0550112233', client_name: 'Amine Belkacem',
      note: 'Sonner deux fois svp',
      payment_method: 'cash', reject_reason: null, cancel_reason: null,
      client_confirmed: true,
      created_at: iso(daysAgo), accepted_at: iso(daysAgo), ready_at: null,
      assigned_at: null, delivering_at: null, delivered_at: iso(daysAgo)
    }, t));
  }

  w.DEMO = {
    zones: ZONES, categories: CATEGORIES, profiles: PROFILES, passwords: PASSWORDS,
    restaurants: RESTAURANTS, menu_items: MENU, menu_options: OPTIONS, menu_variants: VARIANTS,
    drivers: DRIVERS, addresses: ADDRESSES, orders: ORDERS, order_items: ORDER_ITEMS,
    notifications: [],
    settings: {
      commission_rate: 0.10, driver_share: 0.80,
      default_delivery_fee: 200, currency: 'DZD'
    }
  };
})(window);
