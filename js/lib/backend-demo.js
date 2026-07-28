/* ==========================================================================
   Backend DÉMO — persiste tout dans localStorage.
   Reproduit fidèlement le comportement du backend Supabase (mêmes méthodes,
   mêmes règles métier, mêmes notifications) pour pouvoir tester sans serveur.
   ========================================================================== */
(function (w) {
  'use strict';

  // ⚠️ Incrémenter la version dès que les données de démo changent : les
  // navigateurs qui ont déjà ouvert le site repartent alors des nouvelles données.
  const KEY = 'talabi.db.v10';
  const SESSION_KEY = 'talabi.session.v10';
  let db = null;
  const listeners = [];

  /* ------------------------------------------------------------ stockage */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { db = JSON.parse(raw); return; }
    } catch (e) { /* stockage indisponible */ }
    db = JSON.parse(JSON.stringify(w.DEMO));
    save();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) {
      // quota dépassé : on prévient au lieu de perdre les données en silence
      if (w.UI) UI.err('Mémoire du navigateur pleine',
        'Les dernières données de démo n’ont pas pu être enregistrées. Réinitialisez la démo dans Réglages.');
      console.warn('localStorage plein', e);
    }
  }
  function emit(table) {
    listeners.forEach(l => { try { l(table); } catch (e) { console.error(e); } });
  }
  function commit(table) { save(); emit(table || '*'); }

  // null/undefined toléré : un restaurateur qui vient de s'inscrire n'a pas
  // encore de fiche, et JSON.parse("undefined") lèverait une exception qui
  // bloquerait toute la lecture de son profil.
  const clone = o => (o == null ? null : JSON.parse(JSON.stringify(o)));
  const byId = (arr, id) => arr.find(x => x.id === id) || null;
  const wait = (ms) => new Promise(r => setTimeout(r, ms == null ? 120 : ms));

  /* --------------------------------------------------------- session */
  let session = null;
  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      session = raw ? JSON.parse(raw) : null;
    } catch (e) { session = null; }
  }
  function writeSession(uid) {
    session = uid ? { user_id: uid } : null;
    try {
      if (uid) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* ignore */ }
  }
  function uid() { return session ? session.user_id : null; }
  function me() { return session ? byId(db.profiles, session.user_id) : null; }
  function requireUser() {
    const u = me();
    if (!u) throw new Error('Vous devez être connecté.');
    if (u.is_blocked) throw new Error('Votre compte a été bloqué. Contactez le support.');
    return u;
  }

  /* ---------------------------------------------------- notifications */
  function notify(userId, title, body, type, orderId) {
    if (!userId) return;
    db.notifications.unshift({
      id: U.uid(), user_id: userId, title: title, body: body || '',
      type: type || 'info', order_id: orderId || null, is_read: false,
      created_at: new Date().toISOString()
    });
    if (db.notifications.length > 300) db.notifications.length = 300;
  }

  /** Reproduit le trigger SQL on_order_change */
  function orderNotifications(order, prevStatus) {
    const rest = byId(db.restaurants, order.restaurant_id);
    const rname = rest ? rest.name : 'Le restaurant';
    const owner = rest ? rest.owner_id : null;

    if (prevStatus === null) {
      notify(owner, 'Nouvelle commande #' + order.code, "Une nouvelle commande vient d'arriver.", 'new_order', order.id);
      return;
    }
    if (order.status === prevStatus) return;

    switch (order.status) {
      case 'accepted':
        notify(order.client_id, 'Commande acceptée', rname + ' a accepté votre commande #' + order.code, 'accepted', order.id);
        break;
      case 'preparing':
        notify(order.client_id, 'Préparation en cours', 'Votre commande #' + order.code + ' est en préparation.', 'preparing', order.id);
        break;
      case 'ready':
        notify(order.client_id, 'Commande prête', "Votre commande est prête, recherche d'un livreur…", 'ready', order.id);
        db.drivers.filter(d => d.validation_status === 'approved' && d.status === 'available' &&
                               (!d.zone_id || d.zone_id === order.zone_id))
          .forEach(d => notify(d.id, 'Nouvelle livraison disponible', rname + ' — commande #' + order.code, 'delivery_available', order.id));
        break;
      case 'driver_assigned':
        notify(order.client_id, 'Livreur trouvé', 'Un livreur prend en charge votre commande #' + order.code, 'driver_assigned', order.id);
        notify(owner, 'Livreur assigné', 'Un livreur vient récupérer la commande #' + order.code, 'driver_assigned', order.id);
        break;
      case 'delivering':
        notify(order.client_id, 'En cours de livraison', 'Votre commande #' + order.code + ' est en route !', 'delivering', order.id);
        break;
      case 'delivered':
        notify(order.client_id, 'Commande livrée', 'Bon appétit ! Merci de confirmer la réception.', 'delivered', order.id);
        notify(owner, 'Commande livrée', 'La commande #' + order.code + ' a été livrée.', 'delivered', order.id);
        break;
      case 'rejected':
        notify(order.client_id, 'Commande refusée', order.reject_reason || 'Le restaurant ne peut pas honorer votre commande.', 'rejected', order.id);
        break;
      case 'cancelled':
        notify(owner, 'Commande annulée', 'Le client a annulé la commande #' + order.code, 'cancelled', order.id);
        break;
    }
  }

  function stamp(order, status) {
    const now = new Date().toISOString();
    const map = {
      accepted: 'accepted_at', ready: 'ready_at', driver_assigned: 'assigned_at',
      delivering: 'delivering_at', delivered: 'delivered_at'
    };
    if (map[status]) order[map[status]] = now;
  }

  /* ======================================================================
     BACKEND
     ====================================================================== */
  const Demo = {
    isDemo: true,

    async init() {
      load();
      readSession();
      // synchronisation entre onglets
      w.addEventListener('storage', e => {
        if (e.key === KEY) { load(); emit('*'); }
        if (e.key === SESSION_KEY) { readSession(); emit('session'); }
      });
      return true;
    },

    onChange(cb) { listeners.push(cb); return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); }; },

    /* ---------------------------------------------------------- AUTH */
    async getSession() {
      readSession();
      if (!session) return null;
      const p = me();
      return p ? { user: { id: p.id, email: p.email } } : null;
    },

    async signUp(data) {
      await wait();
      const email = String(data.email || '').toLowerCase().trim();
      if (!U.isEmail(email)) throw new Error('Adresse email invalide.');
      if ((data.password || '').length < 6) throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
      if (db.profiles.some(p => (p.email || '').toLowerCase() === email))
        throw new Error('Un compte existe déjà avec cet email.');

      const role = ['client', 'restaurant', 'driver'].indexOf(data.role) >= 0 ? data.role : 'client';
      const p = {
        id: U.uid(), email: email, full_name: data.full_name || email.split('@')[0],
        phone: data.phone ? U.normPhone(data.phone) : null, avatar_url: null,
        role: role, zone_id: data.zone_id || null, is_blocked: false,
        created_at: new Date().toISOString()
      };
      db.profiles.push(p);
      db.passwords[email] = data.password;

      if (role === 'driver') {
        db.drivers.push({
          id: p.id, vehicle: data.vehicle || 'moto', plate: null, zone_id: data.zone_id || null,
          status: 'offline', validation_status: 'pending', rating: 5.0,
          total_deliveries: 0, total_earnings: 0, created_at: p.created_at
        });
      }
      commit('profiles');
      writeSession(p.id);
      emit('session');
      return { user: { id: p.id, email: p.email } };
    },

    async signIn(email, password) {
      await wait();
      const e = String(email || '').toLowerCase().trim();
      const p = db.profiles.find(x => (x.email || '').toLowerCase() === e);
      if (!p || db.passwords[e] !== password) throw new Error('Email ou mot de passe incorrect.');
      if (p.is_blocked) throw new Error('Ce compte a été bloqué par l’administrateur.');
      writeSession(p.id);
      emit('session');
      return { user: { id: p.id, email: p.email } };
    },

    async signInGoogle() {
      throw new Error("La connexion Google nécessite Supabase. Configure-la dans config.js (voir GUIDE-INSTALLATION.md).");
    },

    async resetPassword() {
      await wait();
      throw new Error("La réinitialisation par email nécessite Supabase. En mode démo, le mot de passe des comptes de test est 123456.");
    },

    async signOut() { writeSession(null); emit('session'); },

    /* ------------------------------------------------------- PROFIL */
    async getProfile() {
      const p = me();
      if (!p) return null;
      const out = clone(p);
      if (p.role === 'driver') out.driver = clone(byId(db.drivers, p.id));
      if (p.role === 'restaurant') out.restaurant = clone(db.restaurants.find(r => r.owner_id === p.id));
      out.zone = byId(db.zones, p.zone_id);
      return out;
    },

    async updateProfile(patch) {
      const p = requireUser();

      // Le téléphone est figé 30 jours. La règle est appliquée ici, pas
      // seulement dans le formulaire : un champ désactivé se rouvre en deux
      // clics dans un navigateur.
      if (patch.phone !== undefined) {
        const nouveau = U.normPhone(patch.phone);
        if (nouveau !== p.phone) {
          const v = U.phoneLock(p);
          if (v.bloque)
            throw new Error('Votre numéro ne sera modifiable que dans ' + v.jours + ' jour' +
                            (v.jours > 1 ? 's' : '') + '.');
          p.phone_changed_at = new Date().toISOString();
        }
      }

      ['full_name', 'phone', 'zone_id', 'avatar_url'].forEach(k => {
        if (patch[k] !== undefined) p[k] = k === 'phone' ? U.normPhone(patch[k]) : patch[k];
      });
      commit('profiles');
      return clone(p);
    },

    /* ------------------------------------------------ RÉFÉRENTIELS */
    async zones() { return clone(db.zones.filter(z => z.is_active).sort((a, b) => a.sort_order - b.sort_order)); },
    async categories() { return clone(db.categories.filter(c => c.is_active).sort((a, b) => a.sort_order - b.sort_order)); },
    async settings() { return clone(db.settings); },

    /* --------------------------------------------------- RESTAURANTS */
    async restaurants(filter) {
      await wait(80);
      const f = filter || {};
      let list = db.restaurants.filter(r => r.status === 'approved');
      if (f.zone_id) list = list.filter(r => r.zone_id === f.zone_id);
      if (f.category_id) list = list.filter(r => (r.categories || []).indexOf(f.category_id) >= 0);
      if (f.q) {
        const q = f.q.toLowerCase();
        list = list.filter(r => r.name.toLowerCase().includes(q) ||
                                (r.description || '').toLowerCase().includes(q));
      }
      return list.map(decorate).sort((a, b) => (b.open_now - a.open_now) || (b.rating - a.rating));
    },

    async restaurant(id) {
      const r = byId(db.restaurants, id);
      return r ? decorate(r) : null;
    },

    async myRestaurant() {
      const u = me(); if (!u) return null;
      const r = db.restaurants.find(x => x.owner_id === u.id);
      return r ? decorate(r) : null;
    },

    async saveRestaurant(data) {
      const u = requireUser();
      let r = db.restaurants.find(x => x.owner_id === u.id);
      const fields = ['name', 'description', 'logo_url', 'cover_url', 'address', 'zone_id', 'phone',
                      'lat', 'lng', 'opens_at', 'closes_at', 'is_open', 'delivery_fee', 'min_order',
                      'prep_time_min', 'categories'];
      if (!r) {
        r = {
          id: U.uid(), owner_id: u.id, status: 'pending', rating: 4.5, rating_count: 0,
          is_open: true, delivery_fee: db.settings.default_delivery_fee, min_order: 0,
          prep_time_min: 25, categories: [], created_at: new Date().toISOString()
        };
        db.restaurants.push(r);
        db.profiles.filter(p => p.role === 'admin').forEach(a =>
          notify(a.id, 'Nouveau restaurant', (data.name || 'Un restaurant') + ' demande son inscription.', 'restaurant_pending', null));
      }
      fields.forEach(k => { if (data[k] !== undefined) r[k] = data[k]; });
      ['delivery_fee', 'min_order', 'prep_time_min'].forEach(k => r[k] = Math.max(0, parseInt(r[k], 10) || 0));
      commit('restaurants');
      return decorate(r);
    },

    /* ---------------------------------------------------------- MENU */
    async menuItems(restaurantId, opts) {
      const all = (opts && opts.includeHidden);
      const items = db.menu_items
        .filter(m => m.restaurant_id === restaurantId && (all || m.is_available))
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(m => {
          const o = clone(m);
          o.options = db.menu_options.filter(x => x.menu_item_id === m.id && x.is_active).map(clone);
          o.variants = (db.menu_variants || [])
            .filter(x => x.menu_item_id === m.id && x.is_active)
            .sort((a, b) => a.sort_order - b.sort_order).map(clone);
          return o;
        });
      return items;
    },

    async saveMenuItem(data) {
      const u = requireUser();
      const rest = db.restaurants.find(x => x.owner_id === u.id);
      if (!rest && u.role !== 'admin') throw new Error("Vous n'avez pas de restaurant.");
      let it = data.id ? byId(db.menu_items, data.id) : null;
      if (it && rest && it.restaurant_id !== rest.id) throw new Error('Accès refusé.');
      if (!it) {
        it = { id: U.uid(), restaurant_id: rest.id, sort_order: db.menu_items.length, created_at: new Date().toISOString() };
        db.menu_items.push(it);
      }
      ['category_id', 'name', 'description', 'price', 'image_url', 'is_available'].forEach(k => {
        if (data[k] !== undefined) it[k] = k === 'price' ? Math.max(0, parseInt(data[k], 10) || 0) : data[k];
      });
      if (it.is_available === undefined) it.is_available = true;

      if (data.options) {
        db.menu_options = db.menu_options.filter(o => o.menu_item_id !== it.id);
        data.options.forEach(o => {
          if (!o.name) return;
          db.menu_options.push({
            id: U.uid(), menu_item_id: it.id, name: o.name,
            extra_price: Math.max(0, parseInt(o.extra_price, 10) || 0), is_active: true
          });
        });
      }

      if (data.variants) {
        db.menu_variants = (db.menu_variants || []).filter(v => v.menu_item_id !== it.id);
        data.variants.filter(v => v.name).forEach((v, i) => db.menu_variants.push({
          id: U.uid(), menu_item_id: it.id, name: v.name,
          price: Math.max(0, parseInt(v.price, 10) || 0), sort_order: i, is_active: true
        }));
        // Le prix du plat devient celui du format le moins cher : c'est lui qui
        // s'affiche dans les listes et qui sert au tri et à la recherche.
        const mine = db.menu_variants.filter(v => v.menu_item_id === it.id);
        if (mine.length) it.price = mine.reduce((min, v) => Math.min(min, v.price), mine[0].price);
      }

      commit('menu_items');
      return clone(it);
    },

    async deleteMenuItem(id) {
      const u = requireUser();
      const it = byId(db.menu_items, id);
      if (!it) return;
      const rest = db.restaurants.find(x => x.owner_id === u.id);
      if (u.role !== 'admin' && (!rest || rest.id !== it.restaurant_id)) throw new Error('Accès refusé.');
      db.menu_items = db.menu_items.filter(m => m.id !== id);
      db.menu_options = db.menu_options.filter(o => o.menu_item_id !== id);
      db.menu_variants = (db.menu_variants || []).filter(v => v.menu_item_id !== id);
      commit('menu_items');
    },

    async searchDishes(q, zoneId) {
      const term = String(q || '').toLowerCase().trim();
      if (term.length < 2) return [];
      const okRest = {};
      db.restaurants.forEach(r => {
        if (r.status === 'approved' && (!zoneId || r.zone_id === zoneId)) okRest[r.id] = r;
      });
      return db.menu_items
        .filter(m => m.is_available && okRest[m.restaurant_id] &&
                     (m.name.toLowerCase().includes(term) || (m.description || '').toLowerCase().includes(term)))
        .slice(0, 40)
        .map(m => { const o = clone(m); o.restaurant = decorate(okRest[m.restaurant_id]); return o; });
    },

    /* ------------------------------------------------------ ADRESSES */
    async addresses() {
      const u = me(); if (!u) return [];
      return db.addresses.filter(a => a.user_id === u.id).map(clone);
    },

    async saveAddress(data) {
      const u = requireUser();
      let a = data.id ? byId(db.addresses, data.id) : null;
      if (a && a.user_id !== u.id) throw new Error('Accès refusé.');
      if (!a) { a = { id: U.uid(), user_id: u.id, created_at: new Date().toISOString() }; db.addresses.push(a); }
      ['label', 'zone_id', 'street', 'details', 'phone', 'lat', 'lng']
        .forEach(k => { if (data[k] !== undefined) a[k] = data[k]; });
      if (data.is_default) {
        db.addresses.filter(x => x.user_id === u.id).forEach(x => x.is_default = false);
        a.is_default = true;
      }
      commit('addresses');
      return clone(a);
    },

    async deleteAddress(id) {
      const u = requireUser();
      db.addresses = db.addresses.filter(a => !(a.id === id && a.user_id === u.id));
      commit('addresses');
    },

    /* ------------------------------------------------------ COMMANDES */
    async createOrder(payload) {
      await wait(250);
      const u = requireUser();
      const rest = byId(db.restaurants, payload.restaurant_id);
      if (!rest) throw new Error('Restaurant introuvable.');
      if (rest.status !== 'approved') throw new Error("Ce restaurant n'est pas disponible.");

      let subtotal = 0;
      /* Les prix sont TOUJOURS relus dans la base : format, suppléments et prix
         de base. Ce que le navigateur envoie ne sert qu'à désigner les choix,
         jamais à fixer un montant — sinon n'importe qui pourrait s'offrir une
         pizza à 0 DA en modifiant sa requête. */
      const lines = payload.items.map(li => {
        const it = byId(db.menu_items, li.menu_item_id);
        if (!it || !it.is_available) throw new Error('Un plat de votre panier n’est plus disponible.');

        const formats = (db.menu_variants || []).filter(v => v.menu_item_id === it.id && v.is_active);
        let base = it.price, vname = null;
        if (formats.length) {
          const chosen = formats.find(v => v.id === (li.variant && li.variant.id)) ||
                         formats.find(v => v.name === (li.variant && li.variant.name));
          if (!chosen) throw new Error('« ' + it.name + ' » se vend désormais en plusieurs formats. Retirez-le du panier et rajoutez-le en choisissant le vôtre.');
          base = chosen.price; vname = chosen.name;
        }

        const known = db.menu_options.filter(o => o.menu_item_id === it.id && o.is_active);
        const opts = (li.options || [])
          .map(o => known.find(k => k.name === o.name))
          .filter(Boolean)
          .map(k => ({ name: k.name, extra_price: k.extra_price }));
        const extra = opts.reduce((s, o) => s + o.extra_price, 0);

        const unit = base + extra;
        const lt = unit * li.quantity;
        subtotal += lt;
        return { menu_item_id: it.id, name: it.name, variant: vname, unit_price: unit,
                 quantity: li.quantity, options: opts, line_total: lt };
      });

      if (subtotal < (rest.min_order || 0))
        throw new Error('Minimum de commande : ' + U.money(rest.min_order));

      const totals = U.computeTotals(subtotal, rest.delivery_fee, db.settings);
      const order = Object.assign({
        id: U.uid(), code: U.orderCode(), client_id: u.id, restaurant_id: rest.id,
        driver_id: null, zone_id: payload.zone_id || rest.zone_id, status: 'pending',
        address_street: payload.address_street, address_details: payload.address_details || '',
        address_lat: payload.address_lat != null ? +payload.address_lat : null,
        address_lng: payload.address_lng != null ? +payload.address_lng : null,
        client_phone: U.normPhone(payload.client_phone), client_name: u.full_name,
        note: payload.note || '', payment_method: 'cash',
        reject_reason: null, cancel_reason: null, client_confirmed: false,
        created_at: new Date().toISOString(),
        accepted_at: null, ready_at: null, assigned_at: null, delivering_at: null, delivered_at: null
      }, totals);

      db.orders.unshift(order);
      lines.forEach(l => db.order_items.push(Object.assign({ id: U.uid(), order_id: order.id }, l)));
      orderNotifications(order, null);
      commit('orders');
      return clone(order);
    },

    async orders(filter) {
      const f = filter || {};
      const u = me();
      let list = db.orders.slice();

      if (f.scope === 'client')      list = list.filter(o => u && o.client_id === u.id);
      if (f.scope === 'restaurant') {
        // toutes les fiches du gérant, pour ne perdre aucune commande
        const mine = u ? db.restaurants.filter(x => x.owner_id === u.id).map(x => x.id) : [];
        list = mine.length ? list.filter(o => mine.indexOf(o.restaurant_id) >= 0) : [];
      }
      if (f.scope === 'driver')      list = list.filter(o => u && o.driver_id === u.id);
      if (f.scope === 'available') {
        const d = u ? byId(db.drivers, u.id) : null;
        if (!d || d.validation_status !== 'approved') return [];
        list = list.filter(o => o.status === 'ready' && !o.driver_id && (!d.zone_id || d.zone_id === o.zone_id));
      }
      if (f.status) list = list.filter(o => f.status.indexOf(o.status) >= 0);
      if (f.restaurant_id) list = list.filter(o => o.restaurant_id === f.restaurant_id);

      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (f.limit) list = list.slice(0, f.limit);
      return list.map(expandOrder);
    },

    async order(id) {
      const o = byId(db.orders, id);
      return o ? expandOrder(o) : null;
    },

    async updateOrderStatus(id, status, extra) {
      await wait(150);
      const u = requireUser();
      const o = byId(db.orders, id);
      if (!o) throw new Error('Commande introuvable.');
      const rest = byId(db.restaurants, o.restaurant_id);

      const isClient = o.client_id === u.id;
      const isOwner = rest && rest.owner_id === u.id;
      const isDriver = o.driver_id === u.id;
      const isAdmin = u.role === 'admin';
      if (!isClient && !isOwner && !isDriver && !isAdmin) throw new Error('Accès refusé.');

      // règles de transition
      const allowed = {
        restaurant: { pending: ['accepted', 'rejected'], accepted: ['preparing'], preparing: ['ready'] },
        driver:     { driver_assigned: ['delivering'], delivering: ['delivered'] },
        client:     { pending: ['cancelled'], accepted: ['cancelled'] }
      };
      if (!isAdmin) {
        const set = isOwner ? allowed.restaurant : isDriver ? allowed.driver : allowed.client;
        const next = set[o.status] || [];
        if (next.indexOf(status) < 0)
          throw new Error('Transition non autorisée (' + U.statusShort(o.status) + ' → ' + U.statusShort(status) + ').');
      }

      const prev = o.status;
      o.status = status;
      if (extra && extra.reject_reason) o.reject_reason = extra.reject_reason;
      if (extra && extra.cancel_reason) o.cancel_reason = extra.cancel_reason;
      stamp(o, status);

      if (status === 'delivered' && o.driver_id) {
        const d = byId(db.drivers, o.driver_id);
        if (d) { d.total_deliveries++; d.total_earnings += o.driver_earning; d.status = 'available'; }
      }
      if ((status === 'rejected' || status === 'cancelled') && o.driver_id) {
        const d = byId(db.drivers, o.driver_id);
        if (d) d.status = 'available';
      }
      orderNotifications(o, prev);
      commit('orders');
      return expandOrder(o);
    },

    async claimOrder(id) {
      await wait(200);
      const u = requireUser();
      const d = byId(db.drivers, u.id);
      if (!d || d.validation_status !== 'approved') throw new Error("Votre compte livreur n'est pas encore validé.");
      const o = byId(db.orders, id);
      if (!o || o.status !== 'ready' || o.driver_id)
        throw new Error("Cette commande vient d'être prise par un autre livreur.");
      o.driver_id = u.id;
      o.status = 'driver_assigned';
      stamp(o, 'driver_assigned');
      d.status = 'busy';
      orderNotifications(o, 'ready');
      commit('orders');
      return expandOrder(o);
    },

    async confirmReception(id) {
      const u = requireUser();
      const o = byId(db.orders, id);
      if (!o || o.client_id !== u.id) throw new Error('Accès refusé.');
      o.client_confirmed = true;
      commit('orders');
      return expandOrder(o);
    },

    /* -------------------------------------------------------- LIVREUR */
    async getDriver() {
      const u = me(); if (!u) return null;
      const d = byId(db.drivers, u.id);
      if (!d) return null;
      const o = clone(d);
      o.zone = byId(db.zones, d.zone_id);
      return o;
    },

    async saveDriver(patch) {
      const u = requireUser();
      let d = byId(db.drivers, u.id);
      if (!d) { d = { id: u.id, vehicle: 'moto', status: 'offline', validation_status: 'pending', rating: 5, total_deliveries: 0, total_earnings: 0, created_at: new Date().toISOString() }; db.drivers.push(d); }
      ['vehicle', 'plate', 'zone_id', 'id_card_url'].forEach(k => { if (patch[k] !== undefined) d[k] = patch[k]; });
      if (patch.status !== undefined) {
        if (d.validation_status !== 'approved' && patch.status !== 'offline')
          throw new Error("Votre compte doit d'abord être validé par l'administrateur.");
        d.status = patch.status;
      }
      commit('drivers');
      return clone(d);
    },

    /* ------------------------------------------------ SUIVI EN DIRECT */

    /** Le livreur envoie sa position pendant une course. */
    async updateMyPosition(lat, lng) {
      const u = me(); if (!u) return null;
      const d = byId(db.drivers, u.id);
      if (!d) return null;
      d.last_lat = +lat; d.last_lng = +lng;
      d.last_position_at = new Date().toISOString();
      commit('drivers');
      return { lat: d.last_lat, lng: d.last_lng, at: d.last_position_at };
    },

    /**
     * Position du livreur d'une commande.
     * N'est renvoyée que pendant la livraison et qu'aux personnes concernées.
     */
    async driverPosition(orderId) {
      const u = me(); if (!u) return null;
      const o = byId(db.orders, orderId);
      if (!o || !o.driver_id) return null;
      if (['driver_assigned', 'delivering'].indexOf(o.status) < 0) return null;

      const rest = byId(db.restaurants, o.restaurant_id);
      const allowed = o.client_id === u.id || o.driver_id === u.id ||
                      (rest && rest.owner_id === u.id) || u.role === 'admin';
      if (!allowed) return null;

      const d = byId(db.drivers, o.driver_id);
      if (!d || d.last_lat == null) return null;
      return { lat: d.last_lat, lng: d.last_lng, at: d.last_position_at };
    },

    /* --------------------------------------------------- NOTIFICATIONS */
    async notifications(limit) {
      const u = me(); if (!u) return [];
      return db.notifications.filter(n => n.user_id === u.id).slice(0, limit || 40).map(clone);
    },

    async unreadCount() {
      const u = me(); if (!u) return 0;
      return db.notifications.filter(n => n.user_id === u.id && !n.is_read).length;
    },

    async markNotificationsRead(ids) {
      const u = me(); if (!u) return;
      db.notifications.forEach(n => {
        if (n.user_id === u.id && (!ids || ids.indexOf(n.id) >= 0)) n.is_read = true;
      });
      commit('notifications');
    },

    /* ---------------------------------------------------------- ADMIN */
    async adminUsers(filter) {
      requireAdmin();
      const f = filter || {};
      let list = db.profiles.slice();
      if (f.role) list = list.filter(p => p.role === f.role);
      if (f.q) {
        const q = f.q.toLowerCase();
        list = list.filter(p => (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q));
      }
      return list.map(p => {
        const o = clone(p);
        o.zone = byId(db.zones, p.zone_id);
        if (p.role === 'driver') o.driver = clone(byId(db.drivers, p.id));
        return o;
      });
    },

    async adminRestaurants(status) {
      requireAdmin();
      let list = db.restaurants.slice();
      if (status) list = list.filter(r => r.status === status);
      return list.map(r => { const o = decorate(r); o.owner = clone(byId(db.profiles, r.owner_id)); return o; });
    },

    async adminDrivers(status) {
      requireAdmin();
      let list = db.drivers.slice();
      if (status) list = list.filter(d => d.validation_status === status);
      return list.map(d => {
        const o = clone(d);
        o.profile = clone(byId(db.profiles, d.id));
        o.zone = byId(db.zones, d.zone_id);
        return o;
      });
    },

    async adminOrders(filter) {
      requireAdmin();
      const f = filter || {};
      let list = db.orders.slice();
      if (f.status) list = list.filter(o => f.status.indexOf(o.status) >= 0);
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return list.slice(0, f.limit || 200).map(expandOrder);
    },

    async setRestaurantStatus(id, status, reason) {
      requireAdmin();
      const r = byId(db.restaurants, id);
      if (!r) throw new Error('Restaurant introuvable.');
      r.status = status;
      r.reject_reason = reason || null;
      notify(r.owner_id,
        status === 'approved' ? 'Restaurant validé ✅' : 'Inscription refusée',
        status === 'approved' ? 'Votre restaurant est maintenant visible par les clients.' : (reason || 'Contactez le support.'),
        'restaurant_status', null);
      commit('restaurants');
      return decorate(r);
    },

    async setDriverStatus(id, status, reason) {
      requireAdmin();
      const d = byId(db.drivers, id);
      if (!d) throw new Error('Livreur introuvable.');
      d.validation_status = status;
      d.reject_reason = reason || null;
      if (status !== 'approved') d.status = 'offline';
      notify(id,
        status === 'approved' ? 'Compte livreur validé ✅' : 'Compte livreur refusé',
        status === 'approved' ? 'Vous pouvez maintenant accepter des livraisons.' : (reason || 'Contactez le support.'),
        'driver_status', null);
      commit('drivers');
      return clone(d);
    },

    /** L'admin corrige une fiche restaurant (position, horaires, frais…). */
    async adminUpdateRestaurant(id, patch) {
      requireAdmin();
      const r = byId(db.restaurants, id);
      if (!r) throw new Error('Restaurant introuvable.');
      ['name', 'address', 'zone_id', 'phone', 'lat', 'lng', 'opens_at', 'closes_at',
       'delivery_fee', 'min_order', 'prep_time_min', 'is_open'].forEach(k => {
        if (patch[k] !== undefined) r[k] = patch[k];
      });
      if (patch.lat !== undefined) r.gps_verified = true;
      commit('restaurants');
      return decorate(r);
    },

    async setUserBlocked(id, blocked) {
      requireAdmin();
      const p = byId(db.profiles, id);
      if (!p) throw new Error('Utilisateur introuvable.');
      if (p.role === 'admin') throw new Error('Impossible de bloquer un administrateur.');
      p.is_blocked = !!blocked;
      commit('profiles');
      return clone(p);
    },

    async adminUpdateUser(id, patch) {
      requireAdmin();
      const p = byId(db.profiles, id);
      if (!p) throw new Error('Utilisateur introuvable.');
      ['full_name', 'phone', 'role', 'zone_id'].forEach(k => { if (patch[k] !== undefined) p[k] = patch[k]; });
      commit('profiles');
      return clone(p);
    },

    async adminStats() {
      requireAdmin();
      const delivered = db.orders.filter(o => o.status === 'delivered');
      return {
        users: db.profiles.length,
        clients: db.profiles.filter(p => p.role === 'client').length,
        restaurants: db.restaurants.filter(r => r.status === 'approved').length,
        pending_restaurants: db.restaurants.filter(r => r.status === 'pending').length,
        drivers: db.drivers.filter(d => d.validation_status === 'approved').length,
        pending_drivers: db.drivers.filter(d => d.validation_status === 'pending').length,
        orders: db.orders.length,
        active_orders: db.orders.filter(o => ['pending', 'accepted', 'preparing', 'ready', 'driver_assigned', 'delivering'].indexOf(o.status) >= 0).length,
        delivered: delivered.length,
        gmv: delivered.reduce((s, o) => s + o.total, 0),
        revenue: delivered.reduce((s, o) => s + o.commission, 0)
      };
    },

    async saveZone(data) {
      requireAdmin();
      let z = data.id ? byId(db.zones, data.id) : null;
      if (!z) { z = { id: U.uid(), is_active: true, sort_order: db.zones.length, created_at: new Date().toISOString() }; db.zones.push(z); }
      ['name', 'wilaya', 'is_active'].forEach(k => { if (data[k] !== undefined) z[k] = data[k]; });
      commit('zones');
      return clone(z);
    },

    async deleteZone(id) {
      requireAdmin();
      db.zones = db.zones.filter(z => z.id !== id);
      commit('zones');
    },

    async saveCategory(data) {
      requireAdmin();
      let c = data.id ? byId(db.categories, data.id) : null;
      if (!c) { c = { id: U.uid(), sort_order: db.categories.length, is_active: true }; db.categories.push(c); }
      ['slug', 'name_fr', 'name_ar', 'icon', 'image_url', 'is_active']
        .forEach(k => { if (data[k] !== undefined) c[k] = data[k]; });
      if (!c.slug) c.slug = (c.name_fr || 'cat').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      commit('categories');
      return clone(c);
    },

    async deleteCategory(id) {
      requireAdmin();
      db.categories = db.categories.filter(c => c.id !== id);
      commit('categories');
    },

    async saveSettings(patch) {
      requireAdmin();
      ['commission_rate', 'driver_share', 'default_delivery_fee'].forEach(k => {
        if (patch[k] !== undefined) db.settings[k] = +patch[k];
      });
      commit('settings');
      return clone(db.settings);
    },

    /* --------------------------------------------------------- IMAGES */
    /**
     * En démo, l'image est gardée dans localStorage : on la redimensionne
     * d'abord (max 900 px, JPEG) pour ne pas saturer le quota du navigateur.
     */
    async uploadImage(file) {
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(new Error('Lecture du fichier impossible.'));
        fr.readAsDataURL(file);
      });

      return new Promise(res => {
        const img = new Image();
        img.onload = () => {
          const max = 900;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          try { res(c.toDataURL('image/jpeg', 0.72)); }
          catch (e) { res(dataUrl); }   // image d'origine si le canvas est bloqué
        };
        img.onerror = () => res(dataUrl);
        img.src = dataUrl;
      });
    },

    /* ======================================================================
       OUTILS DE TEST — mode démo uniquement.
       En démo, tout le monde partage la même base locale : on peut donc
       basculer d'un compte à l'autre sans mot de passe pour dérouler un
       scénario complet (client → restaurant → livreur) dans un seul onglet.
       ====================================================================== */

    /** Tous les comptes de la base locale, regroupables par rôle. */
    demoAccounts() {
      const current = uid();
      return db.profiles.map(p => {
        const d = p.role === 'driver' ? byId(db.drivers, p.id) : null;
        const r = p.role === 'restaurant' ? db.restaurants.find(x => x.owner_id === p.id) : null;
        return {
          id: p.id, email: p.email, full_name: p.full_name, role: p.role,
          is_current: p.id === current,
          is_blocked: p.is_blocked,
          pending: d ? d.validation_status === 'pending' : r ? r.status === 'pending' : false,
          // infos livreur, utiles pour comprendre pourquoi une course n'apparaît pas
          driver_status: d ? d.status : null,
          driver_approved: d ? d.validation_status === 'approved' : null,
          restaurant_name: r ? r.name : null,
          zone_id: d ? d.zone_id : (r ? r.zone_id : p.zone_id),
          zone_name: (byId(db.zones, d ? d.zone_id : (r ? r.zone_id : p.zone_id)) || {}).name || null
        };
      });
    },

    /** Rend un livreur immédiatement opérationnel sur une commande donnée. */
    demoReadyDriver(driverId, zoneId) {
      const d = byId(db.drivers, driverId);
      if (!d) throw new Error('Ce compte n’est pas un livreur.');
      d.validation_status = 'approved';
      if (zoneId) d.zone_id = zoneId;
      if (d.status === 'offline') d.status = 'available';
      commit('drivers');
      return clone(d);
    },

    /** Bascule instantanée vers un compte (sans mot de passe). */
    demoSwitchTo(userId) {
      const p = byId(db.profiles, userId);
      if (!p) throw new Error('Compte introuvable.');
      writeSession(p.id);
      emit('session');
      return clone(p);
    },

    /** Valide d'un coup les livreurs et restaurants en attente. */
    demoApproveAll() {
      let n = 0;
      db.drivers.forEach(d => {
        if (d.validation_status === 'pending') {
          d.validation_status = 'approved';
          notify(d.id, 'Compte livreur validé ✅', 'Vous pouvez maintenant accepter des livraisons.', 'driver_status', null);
          n++;
        }
      });
      db.restaurants.forEach(r => {
        if (r.status === 'pending') {
          r.status = 'approved';
          notify(r.owner_id, 'Restaurant validé ✅', 'Votre restaurant est maintenant visible par les clients.', 'restaurant_status', null);
          n++;
        }
      });
      if (n) commit('*');
      return n;
    },

    /** La commande la plus récente, pour guider le scénario de test. */
    demoLastOrder() {
      const o = db.orders.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      if (!o) return null;
      const out = expandOrder(o);
      const rest = byId(db.restaurants, o.restaurant_id);
      out.owner_id = rest ? rest.owner_id : null;
      return out;
    },

    /** Remet la base de démo à zéro */
    resetDemo() {
      try { localStorage.removeItem(KEY); localStorage.removeItem(SESSION_KEY); } catch (e) {}
      load(); writeSession(null); emit('*');
    }
  };

  /* ---------------------------------------------------------- helpers */
  function requireAdmin() {
    const u = me();
    if (!u || u.role !== 'admin') throw new Error('Accès réservé aux administrateurs.');
    return u;
  }

  function decorate(r) {
    const o = clone(r);
    o.zone = byId(db.zones, r.zone_id);
    o.open_now = !!(r.is_open && U.withinHours(r.opens_at, r.closes_at)) ? 1 : 0;
    o.category_list = (r.categories || []).map(id => byId(db.categories, id)).filter(Boolean);
    return o;
  }

  function expandOrder(o) {
    const out = clone(o);
    out.items = db.order_items.filter(i => i.order_id === o.id).map(clone);
    const r = byId(db.restaurants, o.restaurant_id);
    out.restaurant = r ? {
      id: r.id, name: r.name, address: r.address, phone: r.phone, logo_url: r.logo_url,
      zone_id: r.zone_id, prep_time_min: r.prep_time_min, lat: r.lat, lng: r.lng
    } : null;
    const c = byId(db.profiles, o.client_id);
    out.client = c ? { id: c.id, full_name: c.full_name, phone: c.phone } : null;
    const d = o.driver_id ? byId(db.profiles, o.driver_id) : null;
    out.driver = d ? { id: d.id, full_name: d.full_name, phone: d.phone } : null;
    out.zone = byId(db.zones, o.zone_id);
    return out;
  }

  w.BackendDemo = Demo;
})(window);
