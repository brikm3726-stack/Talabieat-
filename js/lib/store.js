/* ==========================================================================
   STORE — état global de l'application (profil, zone, panier)
   ========================================================================== */
(function (w) {
  'use strict';

  // v2 : les lignes portent désormais un format. Un panier enregistré avant
  // cette évolution n'en a pas et serait refusé à la commande — on repart de zéro
  // plutôt que de bloquer le client sur un message qu'il ne comprendrait pas.
  const CART_KEY = 'talabi.cart.v2';
  const ZONE_KEY = 'talabi.zone.v1';
  const WILAYA_KEY = 'talabi.wilaya.v1';

  const subs = [];

  const Store = {
    profile: null,     // profil connecté (null si visiteur)
    zones: [],
    categories: [],
    settings: null,
    zoneId: null,      // zone de livraison choisie par le client
    cart: { restaurant_id: null, restaurant_name: null, delivery_fee: 0, min_order: 0, items: [] },
    unread: 0,

    /* ------------------------------------------------------- abonnements */
    subscribe(cb) { subs.push(cb); return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; },
    notify(what) { subs.forEach(cb => { try { cb(what); } catch (e) { console.error(e); } }); },

    /* ------------------------------------------------------------ profil */
    get isLogged() { return !!Store.profile; },
    get role() { return Store.profile ? Store.profile.role : null; },

    async refreshProfile() {
      const s = await API.getSession();
      Store.profile = s ? await API.getProfile() : null;
      await Store.refreshUnread();
      Store.notify('profile');
      return Store.profile;
    },

    async refreshUnread() {
      Store.unread = Store.profile ? await API.unreadCount() : 0;
      Store.notify('unread');
    },

    /* -------------------------------------------------------------- zone */
    loadZone() {
      try { Store.zoneId = localStorage.getItem(ZONE_KEY) || null; } catch (e) { Store.zoneId = null; }
    },
    setZone(id) {
      Store.zoneId = id || null;
      try { id ? localStorage.setItem(ZONE_KEY, id) : localStorage.removeItem(ZONE_KEY); } catch (e) {}
      Store.notify('zone');
    },
    zoneName(id) {
      const z = Store.zones.find(x => x.id === (id || Store.zoneId));
      return z ? z.name : null;
    },

    /* ------------------------------------------------------------ wilaya */
    /* La barre du haut n'affiche plus un quartier à choisir dans une liste,
       mais la wilaya où se trouve la personne. Personne n'a envie de dérouler
       quatorze quartiers avant de regarder un menu, et neuf fois sur dix le
       téléphone connaît déjà la réponse.

       On la garde en mémoire locale : la question du GPS n'est posée qu'une
       fois, pas à chaque ouverture. Refus ou échec, on retombe sur la wilaya
       par défaut — l'application ne s'arrête jamais là-dessus. */
    wilaya: null,

    loadWilaya() {
      try { Store.wilaya = localStorage.getItem(WILAYA_KEY) || null; } catch (e) { Store.wilaya = null; }
      return Store.wilaya;
    },

    setWilaya(nom) {
      Store.wilaya = nom || null;
      try {
        nom ? localStorage.setItem(WILAYA_KEY, nom) : localStorage.removeItem(WILAYA_KEY);
      } catch (e) {}
      Store.notify('wilaya');
    },

    /** Nom à afficher : celui détecté, sinon la ville de la plateforme. */
    wilayaName() {
      return Store.wilaya || TALABI_CONFIG.DEFAULT_WILAYA || 'Tizi Ouzou';
    },

    /**
     * Demande la position et en déduit la wilaya.
     * @param {boolean} force  redemande même si une wilaya est déjà connue
     * @returns {Promise<string|null>} le nom trouvé, ou null
     */
    detectWilaya(force) {
      if (!force && Store.wilaya) return Promise.resolve(Store.wilaya);
      if (!navigator.geolocation) return Promise.resolve(null);

      return new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(async pos => {
          try {
            /* Nominatim rend la wilaya dans « state » pour l'Algérie ; on
               garde deux replis, certaines communes ne remontant que county
               ou city. */
            const r = await fetch('https://nominatim.openstreetmap.org/reverse' +
              '?format=jsonv2&zoom=8&accept-language=fr' +
              '&lat=' + pos.coords.latitude + '&lon=' + pos.coords.longitude);
            if (!r.ok) return resolve(null);
            const a = (await r.json()).address || {};
            const nom = a.state || a.county || a.city || a.town || null;
            if (nom) Store.setWilaya(nom);
            resolve(nom);
          } catch (e) { resolve(null); }
        }, () => resolve(null), { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
      });
    },

    /* ------------------------------------------------------------ panier */
    loadCart() {
      try {
        const raw = localStorage.getItem(CART_KEY);
        if (raw) Store.cart = JSON.parse(raw);
      } catch (e) { /* panier vide */ }
      if (!Store.cart || !Array.isArray(Store.cart.items)) Store.clearCart(true);
    },

    saveCart() {
      try { localStorage.setItem(CART_KEY, JSON.stringify(Store.cart)); } catch (e) {}
      Store.notify('cart');
    },

    clearCart(silent) {
      Store.cart = { restaurant_id: null, restaurant_name: null, delivery_fee: 0, min_order: 0, items: [] };
      try { localStorage.removeItem(CART_KEY); } catch (e) {}
      if (!silent) Store.notify('cart');
    },

    /**
     * Ajoute un plat. Un panier = un seul restaurant (règle classique du secteur).
     * Retourne false si l'utilisateur a refusé de vider son panier.
     */
    async addToCart(restaurant, item, quantity, options, variant) {
      if (Store.cart.items.length && Store.cart.restaurant_id !== restaurant.id) {
        const ok = await UI.confirm(
          'Changer de restaurant ?',
          'Votre panier contient déjà des plats de « ' + Store.cart.restaurant_name + ' ». Il sera vidé.',
          'Vider et continuer', true);
        if (!ok) return false;
        Store.clearCart(true);
      }
      Store.cart.restaurant_id = restaurant.id;
      Store.cart.restaurant_name = restaurant.name;
      Store.cart.min_order = restaurant.min_order || 0;
      Store.cart.zone_id = restaurant.zone_id;
      /* Position du restaurant : les frais de livraison dépendent maintenant
         de la distance jusqu'au client, il faut donc garder le point de
         départ avec le panier. */
      Store.cart.lat = restaurant.lat != null ? +restaurant.lat : null;
      Store.cart.lng = restaurant.lng != null ? +restaurant.lng : null;

      const opts = (options || []).slice().sort((a, b) => a.name.localeCompare(b.name));
      /* Le format fait partie de l'identité de la ligne : une pizza Small et
         la même en Méga sont deux lignes distinctes, pas une quantité de 2. */
      const key = item.id + '|' + (variant ? variant.id : '') + '|' + opts.map(o => o.name).join(',');
      const found = Store.cart.items.find(l => l.key === key);
      if (found) found.quantity += (quantity || 1);
      else Store.cart.items.push({
        key: key, menu_item_id: item.id, name: item.name,
        price: variant ? variant.price : item.price,
        variant: variant ? { id: variant.id, name: variant.name } : null,
        image_url: item.image_url || null, options: opts, quantity: quantity || 1
      });
      Store.saveCart();
      return true;
    },

    setQuantity(key, q) {
      const l = Store.cart.items.find(x => x.key === key);
      if (!l) return;
      l.quantity = q;
      if (l.quantity <= 0) Store.cart.items = Store.cart.items.filter(x => x.key !== key);
      if (!Store.cart.items.length) return Store.clearCart();
      Store.saveCart();
    },

    lineTotal(l) {
      const extra = (l.options || []).reduce((s, o) => s + (+o.extra_price || 0), 0);
      return (l.price + extra) * l.quantity;
    },

    get cartCount() { return Store.cart.items.reduce((s, l) => s + l.quantity, 0); },
    get cartSubtotal() { return Store.cart.items.reduce((s, l) => s + Store.lineTotal(l), 0); },

    /**
     * Livraison pour une adresse donnée : distance, tarif, et refus au-delà
     * de la zone couverte. Sans adresse (page panier, avant le choix), on
     * annonce le tarif de base — le montant définitif apparaît à l'étape
     * suivante, quand on sait où livrer.
     */
    deliveryFor(address) {
      const c = Store.cart;
      let km = null;
      if (address && address.lat != null && address.lng != null && c.lat != null && c.lng != null) {
        // ×1,3 : les rues ne sont pas des lignes droites
        km = +(U.haversine(c.lat, c.lng, +address.lat, +address.lng) * 1.3).toFixed(1);
      }
      return U.deliveryFor(km, Store.settings);
    },

    /** Montants du panier pour une adresse (ou sans adresse choisie) */
    totalsFor(address) {
      return U.computeTotals(Store.cartSubtotal, Store.deliveryFor(address).fee, Store.settings);
    },

    get cartTotals() { return Store.totalsFor(null); },

    /* --------------------------------------------------------- démarrage */
    async boot() {
      Store.loadZone();
      Store.loadWilaya();
      Store.loadCart();
      const [z, c, s] = await Promise.all([
        API.zones().catch(() => []),
        API.categories().catch(() => []),
        API.settings().catch(() => null)
      ]);
      Store.zones = z; Store.categories = c; Store.settings = s;
      if (Store.zoneId && !z.some(x => x.id === Store.zoneId)) Store.setZone(null);
      await Store.refreshProfile();
    }
  };

  w.Store = Store;
})(window);
