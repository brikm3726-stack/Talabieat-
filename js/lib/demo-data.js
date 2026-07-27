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
   Le menu de Melyza Tacos reprend ses vrais plats et prix. Ceux des autres
   restaurants sont des exemples de départ, à remplacer par les vraies cartes.
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
  const CATEGORIES = [
    { id: 'cat-pizza',  slug: 'pizza',        name_fr: 'Pizza',               icon: '🍕', sort_order: 1, is_active: true },
    { id: 'cat-tacos',  slug: 'tacos',        name_fr: 'Tacos',               icon: '🌯', sort_order: 2, is_active: true },
    { id: 'cat-burger', slug: 'burger',       name_fr: 'Burgers',             icon: '🍔', sort_order: 3, is_active: true },
    { id: 'cat-sand',   slug: 'sandwich',     name_fr: 'Sandwichs',           icon: '🥪', sort_order: 4, is_active: true },
    { id: 'cat-poulet', slug: 'poulet',       name_fr: 'Poulet',              icon: '🍗', sort_order: 5, is_active: true },
    { id: 'cat-trad',   slug: 'traditionnel', name_fr: 'Plats traditionnels', icon: '🥘', sort_order: 6, is_active: true },
    { id: 'cat-dess',   slug: 'dessert',      name_fr: 'Desserts',            icon: '🍰', sort_order: 7, is_active: true },
    { id: 'cat-drink',  slug: 'boisson',      name_fr: 'Boissons',            icon: '🥤', sort_order: 8, is_active: true },
    { id: 'cat-autre',  slug: 'autre',        name_fr: 'Autres',              icon: '🍽️', sort_order: 9, is_active: true }
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
      cats: ['cat-tacos', 'cat-burger', 'cat-sand']
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
      cats: ['cat-burger', 'cat-poulet', 'cat-drink']
    })
  ];

  /* ------------------------------------------------------------------ MENUS */
  const MENU = [];
  const OPTIONS = [];

  function m(rid, cat, name, desc, price, opts) {
    const id = 'mi-' + (MENU.length + 1);
    MENU.push({
      id: id, restaurant_id: rid, category_id: cat, name: name, description: desc,
      price: price, image_url: null, is_available: true, sort_order: MENU.length, created_at: iso(-38)
    });
    (opts || []).forEach((o, i) => OPTIONS.push({
      id: id + '-o' + i, menu_item_id: id, name: o[0], extra_price: o[1], is_active: true
    }));
  }

  /* --- Melyza Tacos : vrais plats et vrais prix (site officiel) --- */
  m('r-melyza', 'cat-tacos',  'Le Tacos Melyza',   'Viande au choix, frites, fromage fondu et sauce maison, le tout gratiné.', 750,
    [['Viande supplémentaire', 200], ['Cheddar', 80], ['Sauce algérienne', 0], ['Sauce blanche', 0]]);
  m('r-melyza', 'cat-burger', 'Mozzarella Burger', '2 steaks, jambon de dinde, mozzarella fondante, oignons caramélisés et champignons.', 850,
    [['Formule menu (frites + boisson)', 150], ['Steak supplémentaire', 200]]);
  m('r-melyza', 'cat-sand',   'Avocat Sandwich',   'Pain frais, thon, avocat, tomate et salade croquante.', 700,
    [['Formule menu (frites + boisson)', 200]]);
  m('r-melyza', 'cat-autre',  'Frites maison',     'Portion généreuse, sauce au choix.', 250, [['Cheddar fondu', 80]]);
  m('r-melyza', 'cat-drink',  'Boisson 33 cl',     'Canette fraîche au choix.', 100, []);

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
  m('r-atelier', 'cat-pizza',  'Pizza margherita',    'Sauce tomate, mozzarella, basilic.', 800, [['Grande taille', 300]]);
  m('r-atelier', 'cat-pizza',  'Pizza 4 fromages',    'Mozzarella, gouda, cheddar, chèvre.', 1100, [['Grande taille', 300]]);
  m('r-atelier', 'cat-dess',   'Pancakes',            'Sirop d’érable ou chocolat.', 550, []);
  m('r-atelier', 'cat-drink',  'Jus pressé',          'Orange ou citron, 40 cl.', 350, []);

  /* Poutines : prix relevés sur la communication officielle de The Twelve */
  m('r-twelve', 'cat-poulet', 'Poutine Poulet',      'Frites, cheddar fondu, poulet grillé et sauce maison.', 450,
    [['Supplément cheddar', 80]]);
  m('r-twelve', 'cat-poulet', 'Poutine Viande Hachée', 'Frites, cheddar fondu, viande hachée et ciboulette.', 500,
    [['Supplément cheddar', 80]]);
  m('r-twelve', 'cat-burger', 'The Twelve Burger', 'Double steak, cheddar, oignons croustillants.', 950,
    [['Formule menu', 250], ['Bacon de dinde', 120]]);
  m('r-twelve', 'cat-burger', 'Chicken Burger',    'Filet de poulet pané, sauce spicy.', 850, [['Formule menu', 250]]);
  m('r-twelve', 'cat-poulet', 'Tenders (6 pièces)','Poulet croustillant, 2 sauces au choix.', 700, [['Sauce supplémentaire', 60]]);
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
  const ADDRESSES = [
    { id: 'a1', user_id: 'u-client', label: 'Domicile', zone_id: 'z-centre',
      street: 'Cité 20 Août, Bât C, Appt 12', details: '2e étage, porte gauche',
      lat: 36.7145, lng: 4.0490, phone: '0550112233', is_default: true, created_at: iso(-30) }
  ];

  /* -------------------------------------------------------------- COMMANDES */
  const ORDERS = [];
  const ORDER_ITEMS = [];

  addOrder('o1', 'delivered', -3, 'r-melyza', 'u-driver', [['mi-1', 2], ['mi-5', 2]]);
  addOrder('o2', 'delivered', -1, 'r-atelier', 'u-driver', [['mi-14', 1]]);

  function addOrder(id, status, daysAgo, rid, driver, lines) {
    const rest = RESTAURANTS.find(x => x.id === rid);
    let subtotal = 0;
    lines.forEach(l => {
      const it = MENU.find(x => x.id === l[0]);
      if (!it) return;
      const lt = it.price * l[1];
      subtotal += lt;
      ORDER_ITEMS.push({
        id: 'oi-' + ORDER_ITEMS.length, order_id: id, menu_item_id: it.id, name: it.name,
        unit_price: it.price, quantity: l[1], options: [], line_total: lt
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
    restaurants: RESTAURANTS, menu_items: MENU, menu_options: OPTIONS,
    drivers: DRIVERS, addresses: ADDRESSES, orders: ORDERS, order_items: ORDER_ITEMS,
    notifications: [],
    settings: {
      commission_rate: 0.10, driver_share: 0.80,
      default_delivery_fee: 200, currency: 'DZD'
    }
  };
})(window);
