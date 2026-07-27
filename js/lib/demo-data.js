/* ==========================================================================
   Données de démonstration
   Utilisées uniquement quand Supabase n'est pas configuré (mode démo).
   ========================================================================== */
(function (w) {
  'use strict';

  const Z = (name, i) => ({ id: 'zone-' + i, name: name, wilaya: 'Tizi Ouzou', is_active: true, sort_order: i });

  // Quartiers de la VILLE de Tizi Ouzou uniquement (pas les communes de la wilaya)
  const ZONES = [
    'Centre-ville', 'Nouvelle Ville', 'M\'Douha', 'Redjaouna', 'Hasnaoua',
    'Bekkar', 'Haute Ville', 'Boukhalfa', 'Kef Naâdja', 'Sidi Belloua',
    'Timizart Loghbar', 'Tala Allam', 'Cité 20 Août', 'Oued Aïssi'
  ].map(Z);

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

  /* ------------------------------------------------------------ comptes démo */
  const PROFILES = [
    { id: 'u-client', email: 'client@talabi.dz',  full_name: 'Amine Belkacem', phone: '0550112233', role: 'client',     zone_id: 'zone-0', is_blocked: false, created_at: iso(-30) },
    { id: 'u-resto',  email: 'resto@talabi.dz',   full_name: 'Karim Meziane',  phone: '0661223344', role: 'restaurant', zone_id: 'zone-0', is_blocked: false, created_at: iso(-40) },
    { id: 'u-driver', email: 'livreur@talabi.dz', full_name: 'Sofiane Haddad', phone: '0770334455', role: 'driver',     zone_id: 'zone-0', is_blocked: false, created_at: iso(-20) },
    { id: 'u-admin',  email: 'admin@talabi.dz',   full_name: 'Administrateur', phone: '0555000000', role: 'admin',      zone_id: 'zone-0', is_blocked: false, created_at: iso(-60) },
    { id: 'u-r2',     email: 'pizza@talabi.dz',   full_name: 'Yacine Ould',    phone: '0662445566', role: 'restaurant', zone_id: 'zone-1', is_blocked: false, created_at: iso(-35) },
    { id: 'u-r3',     email: 'chawarma@talabi.dz',full_name: 'Nadir Cherif',   phone: '0663556677', role: 'restaurant', zone_id: 'zone-2', is_blocked: false, created_at: iso(-25) },
    { id: 'u-r4',     email: 'trad@talabi.dz',    full_name: 'Fatima Zohra',   phone: '0664667788', role: 'restaurant', zone_id: 'zone-4', is_blocked: false, created_at: iso(-15) },
    { id: 'u-r5',     email: 'burger@talabi.dz',  full_name: 'Riad Benali',    phone: '0665778899', role: 'restaurant', zone_id: 'zone-0', is_blocked: false, created_at: iso(-10) },
    { id: 'u-d2',     email: 'livreur2@talabi.dz',full_name: 'Bilal Kaci',     phone: '0771889900', role: 'driver',     zone_id: 'zone-1', is_blocked: false, created_at: iso(-8) }
  ];

  const PASSWORDS = {
    'client@talabi.dz': '123456',
    'resto@talabi.dz': '123456',
    'livreur@talabi.dz': '123456',
    'admin@talabi.dz': '123456',
    'pizza@talabi.dz': '123456',
    'chawarma@talabi.dz': '123456',
    'trad@talabi.dz': '123456',
    'burger@talabi.dz': '123456',
    'livreur2@talabi.dz': '123456'
  };

  /* ------------------------------------------------------------- restaurants */
  const RESTAURANTS = [
    r('r1', 'u-resto', 'Meliza Tacos',       'Tacos français généreux, sauces maison et frites fraîches.', 'zone-0', 'Rue Lamali Ahmed, Centre-ville',        '10:30', '23:30', 4.8, 214, 200, 400, 20, ['cat-tacos','cat-burger','cat-sand'], 36.7120, 4.0450),
    r('r2', 'u-r2',    'Pizza Napoli',       'Vraie pâte italienne cuite au feu de bois.',                 'zone-1', 'Boulevard Krim Belkacem, Nouvelle Ville','11:00', '23:00', 4.6, 168, 250, 600, 25, ['cat-pizza','cat-drink'], 36.7168, 4.0530),
    r('r3', 'u-r3',    'Chawarma House',     'Chawarma poulet & viande, assiettes et sandwichs.',          'zone-2', 'Cité des 600 Logements, M\'Douha',      '11:00', '00:30', 4.5, 302, 200, 350, 18, ['cat-sand','cat-poulet'], 36.7075, 4.0398),
    r('r4', 'u-r4',    'Dar Djurdjura',      'Cuisine kabyle et algérienne : couscous, chorba, tikourbabine.', 'zone-4', 'Route de Hasnaoua',                 '10:00', '22:00', 4.9, 121, 300, 800, 35, ['cat-trad','cat-dess'], 36.7042, 4.0632),
    r('r5', 'u-r5',    'Big Burger TO',      'Smash burgers, poulet croustillant et milkshakes.',          'zone-0', 'Place de l\'Olivier, Centre-ville',     '12:00', '01:00', 4.4, 189, 200, 500, 22, ['cat-burger','cat-poulet','cat-drink'], 36.7135, 4.0475),
    r('r6', 'u-r2',    'Sweet Corner',       'Pâtisserie orientale, crêpes, gaufres et jus naturels.',     'zone-1', 'Avenue Abane Ramdane, Nouvelle Ville',  '09:00', '22:30', 4.7, 96,  150, 300, 15, ['cat-dess','cat-drink'], 36.7180, 4.0505)
  ];
  // un restaurant en attente de validation (pour tester l'espace admin)
  RESTAURANTS.push(Object.assign(
    r('r7', 'u-r5', 'Snack El Wiam', 'Sandwichs et grillades — nouveau sur Talabi.', 'zone-3', 'Route de Redjaouna', '11:00', '23:00', 4.5, 0, 200, 0, 20, ['cat-sand'], 36.7255, 4.0410),
    { status: 'pending' }
  ));

  /* -------------------------------------------------------------- menus */
  const MENU = [];
  const OPTIONS = [];

  m('r1', 'cat-tacos',  'Tacos Simple',       'Viande au choix, frites, fromage, sauce maison.', 450, [['Supplément viande',150],['Cheddar',50],['Sauce algérienne',0]]);
  m('r1', 'cat-tacos',  'Tacos Double',       '2 viandes, frites, fromage, sauce.',               650, [['Supplément viande',150],['Cheddar',50]]);
  m('r1', 'cat-tacos',  'Tacos XXL',          '3 viandes, double fromage, frites.',               900, [['Cheddar',50],['Sauce blanche',0]]);
  m('r1', 'cat-burger', 'Burger Meliza',      'Steak 150g, cheddar, oignons caramélisés.',        550, [['Double steak',200],['Bacon de dinde',100]]);
  m('r1', 'cat-sand',   'Chawarma Poulet',    'Poulet mariné, crudités, sauce blanche.',          400, [['Frites dedans',50]]);
  m('r1', 'cat-drink',  'Coca-Cola 33cl',     'Canette fraîche.',                                 100, []);
  m('r1', 'cat-autre',  'Frites Maison',      'Portion généreuse, sauce au choix.',               200, [['Cheddar fondu',80]]);

  m('r2', 'cat-pizza',  'Pizza Margherita',   'Sauce tomate, mozzarella, basilic.',               700, [['Grande taille',300],['Olives',50]]);
  m('r2', 'cat-pizza',  'Pizza 4 Fromages',   'Mozzarella, gouda, cheddar, chèvre.',              1000, [['Grande taille',300]]);
  m('r2', 'cat-pizza',  'Pizza Poulet BBQ',   'Poulet, sauce BBQ, poivrons, oignons.',            950, [['Grande taille',300],['Extra poulet',200]]);
  m('r2', 'cat-pizza',  'Pizza Thon',         'Thon, olives, câpres, mozzarella.',                900, [['Grande taille',300]]);
  m('r2', 'cat-drink',  'Jus d\'orange frais', 'Pressé à la commande, 40cl.',                      250, []);

  m('r3', 'cat-sand',   'Chawarma Viande',    'Viande hachée, crudités, sauce algérienne.',       450, [['Fromage',60],['Frites dedans',50]]);
  m('r3', 'cat-sand',   'Chawarma Mixte',     'Poulet + viande, sauce maison.',                   550, [['Fromage',60]]);
  m('r3', 'cat-poulet', 'Assiette Chawarma',  'Chawarma, riz, salade et pain.',                   800, [['Supplément riz',100]]);
  m('r3', 'cat-poulet', 'Poulet Rôti (1/2)',  'Poulet fermier rôti, frites incluses.',            750, []);
  m('r3', 'cat-drink',  'Boisson gazeuse 1L', 'Coca / Fanta / Sprite.',                           180, []);

  m('r4', 'cat-trad',   'Couscous Royal',     'Semoule fine, agneau, légumes de saison.',        1200, [['Supplément viande',400]]);
  m('r4', 'cat-trad',   'Chorba Frik',        'Soupe traditionnelle à l\'agneau.',                350, []);
  m('r4', 'cat-trad',   'Rechta Algéroise',   'Pâtes fraîches maison, poulet, navets.',          1100, []);
  m('r4', 'cat-trad',   'Tadjine Zitoune',    'Poulet aux olives et champignons.',               1000, []);
  m('r4', 'cat-dess',   'Baklawa (4 pièces)', 'Amandes, miel, fait maison.',                      400, []);
  m('r4', 'cat-dess',   'Kalb El Louz',       'Dessert traditionnel à la semoule.',               300, []);

  m('r5', 'cat-burger', 'Smash Classic',      'Double steak smashé, cheddar, pickles.',           750, [['Triple steak',250],['Bacon de dinde',100]]);
  m('r5', 'cat-burger', 'Chicken Crispy',     'Filet de poulet pané, sauce spicy.',               700, [['Extra galette',200]]);
  m('r5', 'cat-poulet', 'Tenders (6 pcs)',    'Poulet croustillant, 2 sauces au choix.',          650, [['Sauce supplémentaire',50]]);
  m('r5', 'cat-autre',  'Menu Duo',           '2 burgers + 2 frites + 2 boissons.',              1900, []);
  m('r5', 'cat-drink',  'Milkshake Oreo',     'Onctueux, 40cl.',                                  400, []);

  m('r6', 'cat-dess',   'Crêpe Nutella',      'Nutella, banane, chantilly.',                      450, [['Amandes effilées',80]]);
  m('r6', 'cat-dess',   'Gaufre Belge',       'Sucre glace, sauce au choix.',                     400, [['Boule de glace',150]]);
  m('r6', 'cat-dess',   'Tiramisu',           'Recette italienne maison.',                        350, []);
  m('r6', 'cat-drink',  'Jus Cocktail',       'Fraise, banane, mangue, fruits secs.',             500, []);

  m('r7', 'cat-sand',   'Sandwich Merguez',   'Merguez grillées, frites, harissa.',               400, []);

  /* ------------------------------------------------------------- livreurs */
  const DRIVERS = [
    { id: 'u-driver', vehicle: 'moto',    plate: '16-1234-118', zone_id: 'zone-0', status: 'available',
      validation_status: 'approved', rating: 4.9, total_deliveries: 148, total_earnings: 23680, created_at: iso(-20) },
    { id: 'u-d2',     vehicle: 'voiture', plate: '09-5678-116', zone_id: 'zone-1', status: 'offline',
      validation_status: 'pending',  rating: 5.0, total_deliveries: 0,   total_earnings: 0,     created_at: iso(-8) }
  ];

  const ADDRESSES = [
    { id: 'a1', user_id: 'u-client', label: 'Domicile', zone_id: 'zone-0',
      street: 'Cité 20 Août, Bât C, Appt 12', details: '2e étage, porte gauche',
      lat: 36.7145, lng: 4.0490,
      phone: '0550112233', is_default: true, created_at: iso(-30) }
  ];

  /* -------------------------------------------------- helpers de fabrication */
  function iso(daysOffset) { return new Date(Date.now() + daysOffset * 86400000).toISOString(); }

  function r(id, owner, name, desc, zone, address, opens, closes, rating, rcount, fee, minOrder, prep, cats, lat, lng) {
    return {
      id: id, owner_id: owner, name: name, description: desc, logo_url: null, cover_url: null,
      address: address, zone_id: zone, lat: lat, lng: lng,
      phone: '026' + Math.floor(100000 + Math.random() * 899999),
      opens_at: opens, closes_at: closes, is_open: true, status: 'approved', reject_reason: null,
      rating: rating, rating_count: rcount, delivery_fee: fee, min_order: minOrder,
      prep_time_min: prep, categories: cats, created_at: iso(-45)
    };
  }

  function m(rid, cat, name, desc, price, opts) {
    const id = 'mi-' + (MENU.length + 1);
    MENU.push({
      id: id, restaurant_id: rid, category_id: cat, name: name, description: desc,
      price: price, image_url: null, is_available: true, sort_order: MENU.length, created_at: iso(-40)
    });
    (opts || []).forEach((o, i) => OPTIONS.push({
      id: id + '-o' + i, menu_item_id: id, name: o[0], extra_price: o[1], is_active: true
    }));
  }

  /* --------------------------------------------------- commandes d'exemple */
  const ORDERS = [];
  const ORDER_ITEMS = [];

  addOrder('o1', 'delivered', -3, 'r1', 'u-driver', [['mi-1', 2], ['mi-6', 2]]);
  addOrder('o2', 'delivered', -1, 'r4', 'u-driver', [['mi-18', 1]]);
  addOrder('o3', 'pending',   -0.02, 'r1', null,    [['mi-3', 1], ['mi-7', 1]]);

  function addOrder(id, status, daysAgo, rid, driver, lines) {
    const rest = RESTAURANTS.find(x => x.id === rid);
    let subtotal = 0;
    lines.forEach(l => {
      const it = MENU.find(x => x.id === l[0]);
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
      zone_id: 'zone-0', status: status,
      address_street: 'Cité 20 Août, Bât C, Appt 12', address_details: '2e étage',
      address_lat: 36.7145, address_lng: 4.0490,
      client_phone: '0550112233', client_name: 'Amine Belkacem',
      note: daysAgo < -2 ? 'Sonner deux fois svp' : '',
      payment_method: 'cash', reject_reason: null, cancel_reason: null,
      client_confirmed: status === 'delivered',
      created_at: iso(daysAgo),
      accepted_at: status === 'pending' ? null : iso(daysAgo),
      ready_at: null, assigned_at: null, delivering_at: null,
      delivered_at: status === 'delivered' ? iso(daysAgo) : null
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
