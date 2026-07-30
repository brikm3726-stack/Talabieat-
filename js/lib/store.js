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
