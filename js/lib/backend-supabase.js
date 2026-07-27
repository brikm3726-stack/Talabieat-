/* ==========================================================================
   Backend SUPABASE — Postgres + Auth + Google OAuth + Realtime + Storage
   Expose exactement les mêmes méthodes que BackendDemo.
   ========================================================================== */
(function (w) {
  'use strict';

  let sb = null;
  let currentUser = null;
  const listeners = [];
  const cache = { zones: null, categories: null, settings: null };

  const emit = (t) => listeners.forEach(l => { try { l(t); } catch (e) { console.error(e); } });

  /** Déballe une réponse Supabase et transforme l'erreur en message lisible. */
  function unwrap(res) {
    if (res.error) throw new Error(translate(res.error.message || 'Erreur inconnue'));
    return res.data;
  }

  function translate(msg) {
    const m = String(msg);
    if (/Invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect.';
    if (/User already registered/i.test(m)) return 'Un compte existe déjà avec cet email.';
    if (/Password should be at least/i.test(m)) return 'Le mot de passe doit contenir au moins 6 caractères.';
    if (/Email not confirmed/i.test(m)) return "Confirme d'abord ton email (lien envoyé dans ta boîte de réception).";
    if (/row-level security|violates row-level/i.test(m)) return "Action non autorisée pour votre compte.";
    if (/duplicate key/i.test(m)) return 'Cet élément existe déjà.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Connexion au serveur impossible. Vérifie ta connexion internet.';
    return m;
  }

  const SB = {
    isDemo: false,

    /* ------------------------------------------------------------- INIT */
    async init() {
      const C = w.TALABI_CONFIG;
      if (!w.supabase || !w.supabase.createClient)
        throw new Error("La librairie Supabase n'a pas pu être chargée (vérifie ta connexion internet).");

      sb = w.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });

      const { data } = await sb.auth.getSession();
      currentUser = data && data.session ? data.session.user : null;

      sb.auth.onAuthStateChange((_e, s) => {
        currentUser = s ? s.user : null;
        emit('session');
        subscribeRealtime();
      });

      subscribeRealtime();
      return true;
    },

    onChange(cb) { listeners.push(cb); return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); }; },

    /* ------------------------------------------------------------- AUTH */
    async getSession() {
      const { data } = await sb.auth.getSession();
      currentUser = data && data.session ? data.session.user : null;
      return data && data.session ? { user: currentUser } : null;
    },

    async signUp(d) {
      const res = await sb.auth.signUp({
        email: d.email, password: d.password,
        options: {
          emailRedirectTo: window.location.origin + window.location.pathname,
          data: {
            full_name: d.full_name || '',
            phone: d.phone ? U.normPhone(d.phone) : '',
            role: ['client', 'restaurant', 'driver'].indexOf(d.role) >= 0 ? d.role : 'client'
          }
        }
      });
      const data = unwrap(res);
      // si la confirmation d'email est activée, il n'y a pas encore de session
      if (data.session) {
        currentUser = data.user;
        await patchProfileAfterSignup(d);
      }
      return { user: data.user, needsConfirmation: !data.session };
    },

    async signIn(email, password) {
      const data = unwrap(await sb.auth.signInWithPassword({ email: email, password: password }));
      currentUser = data.user;
      const p = await SB.getProfile();
      if (p && p.is_blocked) { await sb.auth.signOut(); throw new Error("Ce compte a été bloqué par l'administrateur."); }
      return { user: data.user };
    },

    async signInGoogle(role) {
      // le rôle choisi est mémorisé pour être appliqué au retour de Google
      try { if (role) sessionStorage.setItem('talabi.pending_role', role); } catch (e) {}
      unwrap(await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
      }));
      return { redirecting: true };
    },

    async resetPassword(email) {
      unwrap(await sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname + '#/reset'
      }));
      return true;
    },

    async updatePassword(newPassword) {
      unwrap(await sb.auth.updateUser({ password: newPassword }));
      return true;
    },

    async signOut() { await sb.auth.signOut(); currentUser = null; emit('session'); },

    /* ----------------------------------------------------------- PROFIL */
    async getProfile() {
      if (!currentUser) return null;
      const p = unwrap(await sb.from('profiles').select('*, zone:zones(*)').eq('id', currentUser.id).maybeSingle());
      if (!p) return null;
      if (p.role === 'driver')
        p.driver = unwrap(await sb.from('drivers').select('*').eq('id', p.id).maybeSingle());
      if (p.role === 'restaurant')
        p.restaurant = await SB.myRestaurant();
      return p;
    },

    async updateProfile(patch) {
      const body = {};
      ['full_name', 'phone', 'zone_id', 'avatar_url'].forEach(k => { if (patch[k] !== undefined) body[k] = k === 'phone' ? U.normPhone(patch[k]) : patch[k]; });
      body.updated_at = new Date().toISOString();
      return unwrap(await sb.from('profiles').update(body).eq('id', currentUser.id).select().single());
    },

    /* ---------------------------------------------------- RÉFÉRENTIELS */
    async zones() {
      if (cache.zones) return cache.zones;
      cache.zones = unwrap(await sb.from('zones').select('*').eq('is_active', true).order('sort_order'));
      return cache.zones;
    },

    async categories() {
      if (cache.categories) return cache.categories;
      cache.categories = unwrap(await sb.from('categories').select('*').eq('is_active', true).order('sort_order'));
      return cache.categories;
    },

    async settings() {
      if (cache.settings) return cache.settings;
      cache.settings = unwrap(await sb.from('platform_settings').select('*').eq('id', 1).maybeSingle()) || {};
      return cache.settings;
    },

    /* ------------------------------------------------------ RESTAURANTS */
    async restaurants(filter) {
      const f = filter || {};
      let q = sb.from('restaurants')
        .select('*, zone:zones(*), restaurant_categories(category_id)')
        .eq('status', 'approved');
      if (f.zone_id) q = q.eq('zone_id', f.zone_id);
      if (f.q) q = q.or('name.ilike.%' + f.q + '%,description.ilike.%' + f.q + '%');
      let list = unwrap(await q.order('rating', { ascending: false }).limit(100));
      list = list.map(decorate);
      if (f.category_id) list = list.filter(r => r.categories.indexOf(f.category_id) >= 0);
      return list.sort((a, b) => (b.open_now - a.open_now) || (b.rating - a.rating));
    },

    async restaurant(id) {
      const r = unwrap(await sb.from('restaurants')
        .select('*, zone:zones(*), restaurant_categories(category_id)').eq('id', id).maybeSingle());
      return r ? decorate(r) : null;
    },

    async myRestaurant() {
      if (!currentUser) return null;
      // limit(1) plutôt que maybeSingle() : si un gérant possédait deux fiches,
      // maybeSingle() lèverait une erreur et bloquerait tout son espace.
      const rows = unwrap(await sb.from('restaurants')
        .select('*, zone:zones(*), restaurant_categories(category_id)')
        .eq('owner_id', currentUser.id)
        .order('created_at', { ascending: true })
        .limit(1));
      return rows && rows.length ? decorate(rows[0]) : null;
    },

    async saveRestaurant(data) {
      const body = {};
      ['name', 'description', 'logo_url', 'cover_url', 'address', 'zone_id', 'phone', 'lat', 'lng',
       'opens_at', 'closes_at', 'is_open', 'delivery_fee', 'min_order', 'prep_time_min']
        .forEach(k => { if (data[k] !== undefined) body[k] = data[k]; });
      body.updated_at = new Date().toISOString();

      const existing = await SB.myRestaurant();
      let saved;
      if (existing) {
        saved = unwrap(await sb.from('restaurants').update(body).eq('id', existing.id).select().single());
      } else {
        body.owner_id = currentUser.id;
        saved = unwrap(await sb.from('restaurants').insert(body).select().single());
      }

      if (data.categories) {
        await sb.from('restaurant_categories').delete().eq('restaurant_id', saved.id);
        if (data.categories.length) {
          unwrap(await sb.from('restaurant_categories')
            .insert(data.categories.map(c => ({ restaurant_id: saved.id, category_id: c }))));
        }
      }
      return await SB.restaurant(saved.id);
    },

    /* -------------------------------------------------------------- MENU */
    async menuItems(restaurantId, opts) {
      let q = sb.from('menu_items')
        .select('*, options:menu_options(*), variants:menu_variants(*)')
        .eq('restaurant_id', restaurantId);
      if (!(opts && opts.includeHidden)) q = q.eq('is_available', true);
      const list = unwrap(await q.order('sort_order'));
      list.forEach(m => {
        m.options = (m.options || []).filter(o => o.is_active);
        m.variants = (m.variants || []).filter(v => v.is_active)
          .sort((a, b) => a.sort_order - b.sort_order);
      });
      return list;
    },

    async saveMenuItem(data) {
      const rest = await SB.myRestaurant();
      if (!rest) throw new Error("Vous n'avez pas encore créé votre restaurant.");
      const body = { restaurant_id: rest.id };
      ['category_id', 'name', 'description', 'price', 'image_url', 'is_available']
        .forEach(k => { if (data[k] !== undefined) body[k] = data[k]; });

      let item;
      if (data.id) item = unwrap(await sb.from('menu_items').update(body).eq('id', data.id).select().single());
      else item = unwrap(await sb.from('menu_items').insert(body).select().single());

      if (data.options) {
        await sb.from('menu_options').delete().eq('menu_item_id', item.id);
        const rows = data.options.filter(o => o.name).map(o => ({
          menu_item_id: item.id, name: o.name, extra_price: Math.max(0, parseInt(o.extra_price, 10) || 0)
        }));
        if (rows.length) unwrap(await sb.from('menu_options').insert(rows));
      }

      if (data.variants) {
        await sb.from('menu_variants').delete().eq('menu_item_id', item.id);
        const rows = data.variants.filter(v => v.name).map((v, i) => ({
          menu_item_id: item.id, name: v.name,
          price: Math.max(0, parseInt(v.price, 10) || 0), sort_order: i
        }));
        if (rows.length) {
          unwrap(await sb.from('menu_variants').insert(rows));
          // Le prix du plat suit le format le moins cher : c'est celui qui
          // s'affiche dans les listes et qui sert au tri et à la recherche.
          const low = rows.reduce((m, r) => Math.min(m, r.price), rows[0].price);
          if (low !== item.price)
            item = unwrap(await sb.from('menu_items').update({ price: low }).eq('id', item.id).select().single());
        }
      }
      return item;
    },

    async deleteMenuItem(id) { unwrap(await sb.from('menu_items').delete().eq('id', id)); },

    async searchDishes(q, zoneId) {
      const term = String(q || '').trim();
      if (term.length < 2) return [];
      const list = unwrap(await sb.from('menu_items')
        .select('*, restaurant:restaurants!inner(*, zone:zones(*), restaurant_categories(category_id))')
        .eq('is_available', true)
        .eq('restaurants.status', 'approved')
        .ilike('name', '%' + term + '%')
        .limit(40));
      return list
        .filter(m => m.restaurant && (!zoneId || m.restaurant.zone_id === zoneId))
        .map(m => { m.restaurant = decorate(m.restaurant); return m; });
    },

    /* ---------------------------------------------------------- ADRESSES */
    async addresses() {
      if (!currentUser) return [];
      return unwrap(await sb.from('addresses').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }));
    },

    async saveAddress(data) {
      const body = { user_id: currentUser.id };
      ['label', 'zone_id', 'street', 'details', 'phone', 'lat', 'lng', 'is_default']
        .forEach(k => { if (data[k] !== undefined) body[k] = data[k]; });
      if (body.is_default) await sb.from('addresses').update({ is_default: false }).eq('user_id', currentUser.id);
      if (data.id) return unwrap(await sb.from('addresses').update(body).eq('id', data.id).select().single());
      return unwrap(await sb.from('addresses').insert(body).select().single());
    },

    async deleteAddress(id) { unwrap(await sb.from('addresses').delete().eq('id', id)); },

    /* --------------------------------------------------------- COMMANDES */
    async createOrder(payload) {
      const rest = await SB.restaurant(payload.restaurant_id);
      if (!rest || rest.status !== 'approved') throw new Error("Ce restaurant n'est pas disponible.");
      const menu = await SB.menuItems(rest.id);
      const map = {}; menu.forEach(m => map[m.id] = m);

      let subtotal = 0;
      /* Les prix sont TOUJOURS relus dans la base : format, suppléments et prix
         de base. Ce que le navigateur envoie ne sert qu'à désigner les choix,
         jamais à fixer un montant. */
      const lines = payload.items.map(li => {
        const it = map[li.menu_item_id];
        if (!it) throw new Error('Un plat de votre panier n’est plus disponible.');

        const formats = it.variants || [];
        let base = it.price, vname = null;
        if (formats.length) {
          const chosen = formats.find(v => v.id === (li.variant && li.variant.id)) ||
                         formats.find(v => v.name === (li.variant && li.variant.name));
          if (!chosen) throw new Error('« ' + it.name + ' » se vend désormais en plusieurs formats. Retirez-le du panier et rajoutez-le en choisissant le vôtre.');
          base = chosen.price; vname = chosen.name;
        }

        const opts = (li.options || [])
          .map(o => (it.options || []).find(k => k.name === o.name))
          .filter(Boolean)
          .map(k => ({ name: k.name, extra_price: k.extra_price }));
        const extra = opts.reduce((s, o) => s + o.extra_price, 0);

        const unit = base + extra;
        subtotal += unit * li.quantity;
        return { name: it.name, menu_item_id: it.id, variant: vname, unit_price: unit,
                 quantity: li.quantity, options: opts, line_total: unit * li.quantity };
      });

      if (subtotal < (rest.min_order || 0)) throw new Error('Minimum de commande : ' + U.money(rest.min_order));

      const totals = U.computeTotals(subtotal, rest.delivery_fee, await SB.settings());
      const order = unwrap(await sb.from('orders').insert(Object.assign({
        client_id: currentUser.id, restaurant_id: rest.id,
        zone_id: payload.zone_id || rest.zone_id, status: 'pending',
        address_street: payload.address_street, address_details: payload.address_details || '',
        address_lat: payload.address_lat != null ? +payload.address_lat : null,
        address_lng: payload.address_lng != null ? +payload.address_lng : null,
        client_phone: U.normPhone(payload.client_phone), client_name: payload.client_name || '',
        note: payload.note || '', payment_method: 'cash'
      }, totals)).select().single());

      unwrap(await sb.from('order_items').insert(lines.map(l => Object.assign({ order_id: order.id }, l))));
      return order;
    },

    async orders(filter) {
      const f = filter || {};
      let q = sb.from('orders').select(ORDER_SELECT);

      if (f.scope === 'client') q = q.eq('client_id', currentUser.id);
      if (f.scope === 'driver') q = q.eq('driver_id', currentUser.id);
      if (f.scope === 'restaurant') {
        const mine = unwrap(await sb.from('restaurants').select('id').eq('owner_id', currentUser.id));
        if (!mine.length) return [];
        q = q.in('restaurant_id', mine.map(r => r.id));
      }
      if (f.scope === 'available') {
        const d = await SB.getDriver();
        if (!d || d.validation_status !== 'approved') return [];
        q = q.eq('status', 'ready').is('driver_id', null);
        if (d.zone_id) q = q.eq('zone_id', d.zone_id);
      }
      if (f.status) q = q.in('status', f.status);
      if (f.restaurant_id) q = q.eq('restaurant_id', f.restaurant_id);

      return unwrap(await q.order('created_at', { ascending: false }).limit(f.limit || 100));
    },

    async order(id) {
      return unwrap(await sb.from('orders').select(ORDER_SELECT).eq('id', id).maybeSingle());
    },

    async updateOrderStatus(id, status, extra) {
      const body = { status: status };
      if (extra && extra.reject_reason) body.reject_reason = extra.reject_reason;
      if (extra && extra.cancel_reason) body.cancel_reason = extra.cancel_reason;
      return unwrap(await sb.from('orders').update(body).eq('id', id).select(ORDER_SELECT).single());
    },

    async claimOrder(id) {
      const res = await sb.rpc('claim_order', { p_order: id });
      if (res.error) throw new Error(translate(res.error.message));
      return await SB.order(id);
    },

    async confirmReception(id) {
      return unwrap(await sb.from('orders').update({ client_confirmed: true }).eq('id', id).select(ORDER_SELECT).single());
    },

    /* ------------------------------------------------------------ LIVREUR */
    async getDriver() {
      if (!currentUser) return null;
      return unwrap(await sb.from('drivers').select('*, zone:zones(*)').eq('id', currentUser.id).maybeSingle());
    },

    async saveDriver(patch) {
      const body = {};
      ['vehicle', 'plate', 'zone_id', 'id_card_url', 'status'].forEach(k => { if (patch[k] !== undefined) body[k] = patch[k]; });
      body.updated_at = new Date().toISOString();
      const existing = await SB.getDriver();
      if (patch.status && (!existing || existing.validation_status !== 'approved') && patch.status !== 'offline')
        throw new Error("Votre compte doit d'abord être validé par l'administrateur.");
      if (existing) return unwrap(await sb.from('drivers').update(body).eq('id', currentUser.id).select().single());
      body.id = currentUser.id;
      return unwrap(await sb.from('drivers').insert(body).select().single());
    },

    /* --------------------------------------------------- SUIVI EN DIRECT */
    async updateMyPosition(lat, lng) {
      if (!currentUser) return null;
      const r = await sb.from('drivers').update({
        last_lat: +lat, last_lng: +lng, last_position_at: new Date().toISOString()
      }).eq('id', currentUser.id).select('last_lat, last_lng, last_position_at').maybeSingle();
      if (r.error) { console.warn(r.error.message); return null; }
      return r.data ? { lat: r.data.last_lat, lng: r.data.last_lng, at: r.data.last_position_at } : null;
    },

    async driverPosition(orderId) {
      const r = await sb.rpc('driver_position', { p_order: orderId });
      if (r.error) { console.warn(r.error.message); return null; }
      const row = Array.isArray(r.data) ? r.data[0] : r.data;
      return row && row.lat != null ? { lat: row.lat, lng: row.lng, at: row.at } : null;
    },

    /* ------------------------------------------------------ NOTIFICATIONS */
    async notifications(limit) {
      if (!currentUser) return [];
      return unwrap(await sb.from('notifications').select('*')
        .eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(limit || 40));
    },

    async unreadCount() {
      if (!currentUser) return 0;
      const res = await sb.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', currentUser.id).eq('is_read', false);
      if (res.error) return 0;
      return res.count || 0;
    },

    async markNotificationsRead(ids) {
      if (!currentUser) return;
      let q = sb.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false);
      if (ids) q = q.in('id', ids);
      await q;
      emit('notifications');
    },

    /* --------------------------------------------------------------- ADMIN */
    async adminUsers(filter) {
      const f = filter || {};
      let q = sb.from('profiles').select('*, zone:zones(*), driver:drivers(*)');
      if (f.role) q = q.eq('role', f.role);
      if (f.q) q = q.or('full_name.ilike.%' + f.q + '%,email.ilike.%' + f.q + '%');
      const list = unwrap(await q.order('created_at', { ascending: false }).limit(300));
      list.forEach(p => { if (Array.isArray(p.driver)) p.driver = p.driver[0] || null; });
      return list;
    },

    async adminRestaurants(status) {
      let q = sb.from('restaurants').select('*, zone:zones(*), owner:profiles!restaurants_owner_id_fkey(*), restaurant_categories(category_id)');
      if (status) q = q.eq('status', status);
      return unwrap(await q.order('created_at', { ascending: false })).map(decorate);
    },

    async adminDrivers(status) {
      let q = sb.from('drivers').select('*, zone:zones(*), profile:profiles!drivers_id_fkey(*)');
      if (status) q = q.eq('validation_status', status);
      return unwrap(await q.order('created_at', { ascending: false }));
    },

    async adminOrders(filter) {
      const f = filter || {};
      let q = sb.from('orders').select(ORDER_SELECT);
      if (f.status) q = q.in('status', f.status);
      return unwrap(await q.order('created_at', { ascending: false }).limit(f.limit || 200));
    },

    async setRestaurantStatus(id, status, reason) {
      const r = unwrap(await sb.from('restaurants').update({ status: status, reject_reason: reason || null }).eq('id', id).select().single());
      await sb.from('notifications').insert({
        user_id: r.owner_id,
        title: status === 'approved' ? 'Restaurant validé ✅' : 'Inscription refusée',
        body: status === 'approved' ? 'Votre restaurant est maintenant visible par les clients.' : (reason || 'Contactez le support.'),
        type: 'restaurant_status'
      });
      return r;
    },

    async setDriverStatus(id, status, reason) {
      const body = { validation_status: status, reject_reason: reason || null };
      if (status !== 'approved') body.status = 'offline';
      const d = unwrap(await sb.from('drivers').update(body).eq('id', id).select().single());
      await sb.from('notifications').insert({
        user_id: id,
        title: status === 'approved' ? 'Compte livreur validé ✅' : 'Compte livreur refusé',
        body: status === 'approved' ? 'Vous pouvez maintenant accepter des livraisons.' : (reason || 'Contactez le support.'),
        type: 'driver_status'
      });
      return d;
    },

    async adminUpdateRestaurant(id, patch) {
      const body = {};
      ['name', 'address', 'zone_id', 'phone', 'lat', 'lng', 'opens_at', 'closes_at',
       'delivery_fee', 'min_order', 'prep_time_min', 'is_open'].forEach(k => {
        if (patch[k] !== undefined) body[k] = patch[k];
      });
      body.updated_at = new Date().toISOString();
      return unwrap(await sb.from('restaurants').update(body).eq('id', id).select().single());
    },

    async setUserBlocked(id, blocked) {
      return unwrap(await sb.from('profiles').update({ is_blocked: !!blocked }).eq('id', id).select().single());
    },

    async adminUpdateUser(id, patch) {
      const body = {};
      ['full_name', 'phone', 'role', 'zone_id'].forEach(k => { if (patch[k] !== undefined) body[k] = patch[k]; });
      return unwrap(await sb.from('profiles').update(body).eq('id', id).select().single());
    },

    async adminStats() {
      const count = async (table, build) => {
        let q = sb.from(table).select('id', { count: 'exact', head: true });
        if (build) q = build(q);
        const r = await q;
        return r.count || 0;
      };
      const delivered = unwrap(await sb.from('orders').select('total, commission').eq('status', 'delivered').limit(5000));
      return {
        users: await count('profiles'),
        clients: await count('profiles', q => q.eq('role', 'client')),
        restaurants: await count('restaurants', q => q.eq('status', 'approved')),
        pending_restaurants: await count('restaurants', q => q.eq('status', 'pending')),
        drivers: await count('drivers', q => q.eq('validation_status', 'approved')),
        pending_drivers: await count('drivers', q => q.eq('validation_status', 'pending')),
        orders: await count('orders'),
        active_orders: await count('orders', q => q.in('status', ['pending', 'accepted', 'preparing', 'ready', 'driver_assigned', 'delivering'])),
        delivered: delivered.length,
        gmv: delivered.reduce((s, o) => s + (o.total || 0), 0),
        revenue: delivered.reduce((s, o) => s + (o.commission || 0), 0)
      };
    },

    async saveZone(data) {
      cache.zones = null;
      const body = {};
      ['name', 'wilaya', 'is_active'].forEach(k => { if (data[k] !== undefined) body[k] = data[k]; });
      if (data.id) return unwrap(await sb.from('zones').update(body).eq('id', data.id).select().single());
      return unwrap(await sb.from('zones').insert(body).select().single());
    },

    async deleteZone(id) { cache.zones = null; unwrap(await sb.from('zones').delete().eq('id', id)); },

    async saveCategory(data) {
      cache.categories = null;
      const body = {};
      ['slug', 'name_fr', 'name_ar', 'icon', 'image_url', 'is_active']
        .forEach(k => { if (data[k] !== undefined) body[k] = data[k]; });
      if (!body.slug && body.name_fr) body.slug = body.name_fr.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      if (data.id) return unwrap(await sb.from('categories').update(body).eq('id', data.id).select().single());
      return unwrap(await sb.from('categories').insert(body).select().single());
    },

    async deleteCategory(id) { cache.categories = null; unwrap(await sb.from('categories').delete().eq('id', id)); },

    async saveSettings(patch) {
      cache.settings = null;
      const body = { updated_at: new Date().toISOString() };
      ['commission_rate', 'driver_share', 'default_delivery_fee'].forEach(k => { if (patch[k] !== undefined) body[k] = +patch[k]; });
      return unwrap(await sb.from('platform_settings').update(body).eq('id', 1).select().single());
    },

    /* -------------------------------------------------------------- IMAGES */
    async uploadImage(file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = (currentUser ? currentUser.id : 'anon') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      const up = await sb.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false });
      if (up.error) throw new Error(translate(up.error.message));
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    },

    resetDemo() { UI.err('Indisponible', 'Cette action existe seulement en mode démo.'); }
  };

  /* ------------------------------------------------------------- helpers */
  const ORDER_SELECT =
    '*, restaurant:restaurants(id,name,address,phone,logo_url,zone_id,prep_time_min,lat,lng), ' +
    'client:profiles!orders_client_id_fkey(id,full_name,phone), ' +
    'driver:profiles!orders_driver_id_fkey(id,full_name,phone), ' +
    'zone:zones(*), items:order_items(*)';

  function decorate(r) {
    r.categories = (r.restaurant_categories || []).map(x => x.category_id);
    r.open_now = (r.is_open && U.withinHours(r.opens_at, r.closes_at)) ? 1 : 0;
    if (Array.isArray(r.owner)) r.owner = r.owner[0] || null;
    return r;
  }

  /** Applique le rôle/téléphone choisis après une inscription email ou Google. */
  async function patchProfileAfterSignup(d) {
    try {
      const body = {};
      if (d && d.phone) body.phone = U.normPhone(d.phone);
      if (d && d.zone_id) body.zone_id = d.zone_id;
      if (Object.keys(body).length)
        await sb.from('profiles').update(body).eq('id', currentUser.id);
    } catch (e) { /* le trigger a déjà créé l'essentiel */ }
  }

  /** Après un retour Google, applique le rôle choisi avant la redirection. */
  SB.applyPendingRole = async function () {
    let role = null;
    try { role = sessionStorage.getItem('talabi.pending_role'); } catch (e) {}
    if (!role || !currentUser) return;
    try { sessionStorage.removeItem('talabi.pending_role'); } catch (e) {}
    const p = unwrap(await sb.from('profiles').select('role, created_at').eq('id', currentUser.id).maybeSingle());
    // on ne change le rôle que pour un compte fraîchement créé et encore "client"
    if (p && p.role === 'client' && role !== 'client' && Date.now() - new Date(p.created_at).getTime() < 120000) {
      await sb.from('profiles').update({ role: role }).eq('id', currentUser.id);
      if (role === 'driver') await sb.from('drivers').upsert({ id: currentUser.id });
    }
  };

  /* ------------------------------------------------------------ REALTIME */
  let channel = null;
  function subscribeRealtime() {
    if (!sb) return;
    if (channel) { sb.removeChannel(channel); channel = null; }
    if (!currentUser) return;
    channel = sb.channel('talabi-' + currentUser.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => emit('orders'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + currentUser.id }, () => emit('notifications'))
      .subscribe();
  }

  w.BackendSupabase = SB;
})(window);
