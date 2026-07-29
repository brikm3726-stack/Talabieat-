/* ==========================================================================
   Utilitaires génériques
   ========================================================================== */
(function (w) {
  'use strict';

  const CFG = w.TALABI_CONFIG;

  const U = {

    /* ---------------------------------------------------------- formatage */
    money(v) {
      const n = Math.round(Number(v) || 0);
      return n.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ') + ' ' + CFG.CURRENCY;
    },

    num(v) { return (Number(v) || 0).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' '); },

    /** Échappe le HTML — À UTILISER pour toute donnée venant d'un utilisateur. */
    esc(s) {
      if (s === null || s === undefined) return '';
      return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    /**
     * Nettoie une URL avant de l'injecter dans un src ou un url() CSS.
     * On bloque les schémas dangereux (javascript:, vbscript:…) tout en
     * acceptant les chemins relatifs du projet — « assets/img/… ».
     */
    escUrl(s) {
      if (!s) return '';
      const v = String(s).trim();
      const scheme = v.match(/^([a-z][a-z0-9+.\-]*):/i);
      if (scheme && !/^(https?|data)$/i.test(scheme[1])) return '';
      if (/^data:/i.test(v) && !/^data:image\//i.test(v)) return '';
      return v.replace(/["'\\<>\s]/g, '');
    },

    /* -------------------------------------------------------------- dates */
    dt(v) {
      if (!v) return '—';
      const d = new Date(v);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' • ' +
             d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    },

    time(v) {
      if (!v) return '—';
      return new Date(v).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    },

    ago(v) {
      if (!v) return '';
      const s = Math.floor((Date.now() - new Date(v).getTime()) / 1000);
      if (s < 60) return "à l'instant";
      if (s < 3600) return 'il y a ' + Math.floor(s / 60) + ' min';
      if (s < 86400) return 'il y a ' + Math.floor(s / 3600) + ' h';
      return 'il y a ' + Math.floor(s / 86400) + ' j';
    },

    /** "10:00" + "23:00" -> le restaurant est-il dans ses horaires ? */
    withinHours(opens, closes) {
      if (!opens || !closes) return true;
      const now = new Date();
      const cur = now.getHours() * 60 + now.getMinutes();
      const p = (t) => { const [h, m] = String(t).split(':'); return (+h) * 60 + (+m || 0); };
      const o = p(opens), c = p(closes);
      return o <= c ? (cur >= o && cur <= c) : (cur >= o || cur <= c); // gère 22:00 -> 02:00
    },

    hhmm(t) { return t ? String(t).slice(0, 5) : ''; },

    /* --------------------------------------------------------------- divers */
    uid() {
      if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    },

    orderCode() {
      const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let o = '';
      for (let i = 0; i < 6; i++) o += s[Math.floor(Math.random() * s.length)];
      return o;
    },

    initials(name) {
      if (!name) return '?';
      return name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
    },

    debounce(fn, ms) {
      let t;
      return function () { clearTimeout(t); const a = arguments, c = this; t = setTimeout(() => fn.apply(c, a), ms || 300); };
    },

    /* ------------------------------------------------- comptes à rebours */

    /** Secondes restantes avant une échéance ISO. Jamais négatif. */
    secondsLeft(deadline) {
      if (!deadline) return 0;
      const s = Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000);
      return s > 0 ? s : 0;
    },

    /** 245 → « 4:05 ». Toujours deux chiffres pour les secondes, sinon
        l'affichage saute d'une largeur à l'autre à chaque seconde. */
    mmss(sec) {
      const s = Math.max(0, Math.round(sec));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },

    /**
     * Durée en toutes lettres, pour un message lu par un humain.
     * Arrondir en minutes ne marche pas : un délai de 30 s donnerait
     * « 1 minute », et un délai de 20 s « 0 minute ».
     */
    dureeTexte(sec) {
      const s = Math.max(0, Math.round(sec));
      if (s < 60) return s + ' seconde' + (s > 1 ? 's' : '');
      const m = Math.round(s / 60);
      if (s % 60 === 0 || s > 120) return m + ' minute' + (m > 1 ? 's' : '');
      // entre 1 et 2 minutes, la minute ronde serait trompeuse
      return Math.floor(s / 60) + ' min ' + (s % 60) + ' s';
    },

    /* ------------------------------------------------- géolocalisation */

    /** Distance réelle à vol d'oiseau entre 2 points GPS, en km. */
    haversine(lat1, lng1, lat2, lng2) {
      const R = 6371, rad = Math.PI / 180;
      const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    },

    /**
     * Distance restaurant → client.
     * Utilise le GPS quand les deux points sont connus, sinon retombe sur une
     * estimation par quartier (même quartier = court, sinon plus long).
     */
    distanceOf(order) {
      const r = order.restaurant;
      if (r && r.lat != null && r.lng != null && order.address_lat != null && order.address_lng != null) {
        // ×1,3 : les rues ne sont pas des lignes droites
        return { km: +(U.haversine(r.lat, r.lng, order.address_lat, order.address_lng) * 1.3).toFixed(1), exact: true };
      }
      const same = r && r.zone_id && order.zone_id && r.zone_id === order.zone_id;
      return { km: same ? 2.0 : 4.5, exact: false };
    },

    /** Lien d'itinéraire Google Maps (s'ouvre dans l'app mobile si installée) */
    gmapsRoute(lat, lng) {
      return 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng;
    },

    /** Lien de repérage Google Maps */
    gmapsPin(lat, lng) {
      return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
    },

    hasCoords(o) {
      return o && o.lat != null && o.lng != null && !isNaN(+o.lat) && !isNaN(+o.lng);
    },

    /* --------------------------------------------------------- validations */
    isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim()); },

    /** Numéros algériens : 05/06/07 xx xx xx xx, +213 accepté */
    isPhoneDZ(v) {
      const c = String(v || '').replace(/[\s.\-()]/g, '');
      return /^(?:\+213|00213|0)(5|6|7)\d{8}$/.test(c);
    },

    /* Le numéro de téléphone est figé 30 jours après sa dernière saisie.
       Le compte à rebours part de la dernière modification, ou à défaut de la
       création du compte — c'est le numéro donné à l'inscription. */
    PHONE_LOCK_DAYS: 30,
    phoneLock(profile) {
      if (!profile) return { bloque: false, jours: 0 };
      const depuis = profile.phone_changed_at || profile.created_at;
      if (!profile.phone || !depuis) return { bloque: false, jours: 0 };
      const ecoules = (Date.now() - new Date(depuis).getTime()) / 86400000;
      const reste = Math.ceil(U.PHONE_LOCK_DAYS - ecoules);
      return reste > 0 ? { bloque: true, jours: reste } : { bloque: false, jours: 0 };
    },

    normPhone(v) {
      const c = String(v || '').replace(/[\s.\-()]/g, '');
      if (c.startsWith('+213')) return '0' + c.slice(4);
      if (c.startsWith('00213')) return '0' + c.slice(5);
      return c;
    },

    /* --------------------------------------------------- libellés métier */
    ORDER_FLOW: ['pending', 'accepted', 'preparing', 'ready', 'driver_assigned', 'delivering', 'delivered'],

    STATUS: {
      pending:         { label: 'Commande envoyée',    short: 'En attente',   icon: '📨', tag: 'tag-warn' },
      accepted:        { label: 'Acceptée par le restaurant', short: 'Acceptée', icon: '✅', tag: 'tag-info' },
      preparing:       { label: 'Préparation en cours', short: 'En préparation', icon: '👨‍🍳', tag: 'tag-info' },
      ready:           { label: 'Commande prête',       short: 'Prête',        icon: '🛍️', tag: 'tag-info' },
      driver_assigned: { label: 'Livreur trouvé',       short: 'Livreur assigné', icon: '🛵', tag: 'tag-info' },
      delivering:      { label: 'En cours de livraison', short: 'En livraison', icon: '🚀', tag: 'tag-info' },
      delivered:       { label: 'Livrée',               short: 'Livrée',       icon: '🎉', tag: 'tag-ok' },
      rejected:        { label: 'Refusée par le restaurant', short: 'Refusée', icon: '⛔', tag: 'tag-danger' },
      cancelled:       { label: 'Annulée',              short: 'Annulée',      icon: '🚫', tag: 'tag-danger' }
    },

    statusLabel(s) { return (U.STATUS[s] || { label: s }).label; },
    statusShort(s) { return (U.STATUS[s] || { short: s }).short; },
    statusTag(s)   { return (U.STATUS[s] || { tag: 'tag-muted' }).tag; },
    statusIcon(s)  { return (U.STATUS[s] || { icon: '•' }).icon; },

    VEHICLES: { moto: '🏍️ Moto', voiture: '🚗 Voiture', velo: '🚲 Vélo', autre: '📦 Autre' },

    /** Calcule les montants d'une commande */
    computeTotals(subtotal, deliveryFee, settings) {
      const s = settings || {};
      const commissionRate = s.commission_rate != null ? +s.commission_rate : CFG.COMMISSION_RATE;
      const driverShare    = s.driver_share    != null ? +s.driver_share    : CFG.DRIVER_SHARE;
      const fee = Math.round(deliveryFee || 0);
      return {
        subtotal: Math.round(subtotal),
        delivery_fee: fee,
        commission: Math.round(subtotal * commissionRate),
        driver_earning: Math.round(fee * driverShare),
        total: Math.round(subtotal) + fee
      };
    }
  };

  w.U = U;
})(window);
