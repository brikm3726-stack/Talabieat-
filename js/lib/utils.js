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

    /**
     * Les suppl\u00e9ments d'une ligne, \u00e9crits comme on les lit : \u00ab Cheddar \u00d72,
     * Merguez \u00bb. La quantit\u00e9 n'appara\u00eet QUE si elle d\u00e9passe un \u2014 \u00ab Merguez \u00d71 \u00bb
     * se lit comme une pr\u00e9cision inutile, et le cuisinier a mieux \u00e0 faire.
     *
     * Un seul endroit pour cette phrase : elle est affich\u00e9e dans le panier, \u00e0
     * la validation, sur le ticket du restaurant et sur celui du livreur. Quatre
     * \u00e9critures s\u00e9par\u00e9es finiraient par ne plus dire la m\u00eame chose \u2014 et c'est
     * exactement ce qui arrive le jour o\u00f9 l'une oublie la quantit\u00e9.
     */
    optionsText(options) {
      return (options || []).map(o =>
        o.name + ((+o.qty || 1) > 1 ? ' \u00d7' + (+o.qty) : '')).join(', ');
    },

    /** Échappe le HTML — À UTILISER pour toute donnée venant d'un utilisateur. */
    esc(s) {
      if (s === null || s === undefined) return '';
      return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    /**
     * Chemin d'un fichier livré avec le site.
     *
     * Les quatre applications (client à la racine, resto/, livreur/, admin/)
     * partagent les mêmes images et les mêmes sons. Depuis un sous-dossier,
     * « assets/img/logo.jpg » pointerait vers un fichier inexistant : chaque
     * page annonce sa profondeur dans TALABI_BASE, et tout passe par ici.
     */
    asset(chemin) {
      return (w.TALABI_BASE || '') + String(chemin || '');
    },

    /**
     * Nettoie une URL avant de l'injecter dans un src ou un url() CSS.
     * On bloque les schémas dangereux (javascript:, vbscript:…) tout en
     * acceptant les chemins relatifs du projet — « assets/img/… ».
     *
     * Ces chemins relatifs viennent aussi de la base (image d'une catégorie,
     * par exemple) : ils reçoivent la même correction de profondeur, sinon
     * ils casseraient dans les applications rangées en sous-dossier.
     */
    escUrl(s) {
      if (!s) return '';
      const v = String(s).trim();
      const scheme = v.match(/^([a-z][a-z0-9+.\-]*):/i);
      if (scheme && !/^(https?|data)$/i.test(scheme[1])) return '';
      if (/^data:/i.test(v) && !/^data:image\//i.test(v)) return '';
      const propre = v.replace(/["'\\<>\s]/g, '');
      // relatif au projet (ni absolu, ni schéma) → on préfixe
      if (!scheme && propre.charAt(0) !== '/' && propre.charAt(0) !== '#')
        return (w.TALABI_BASE || '') + propre;
      return propre;
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

    /** Le jour d'une date, dit comme on le dit : « Aujourd'hui », « Hier »,
        puis la date. Sert à séparer une longue liste en tranches lisibles. */
    dayLabel(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return '';
      const jour = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
      const ecart = Math.round((jour(new Date()) - jour(d)) / 86400000);
      if (ecart <= 0) return "Aujourd'hui";
      if (ecart === 1) return 'Hier';
      if (ecart < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long' });
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
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

    /**
     * Le délai laissé au restaurant pour répondre, en minutes.
     *
     * Le réglage est en SECONDES en base (`platform_settings.resto_timeout_s`),
     * parce que c'est ainsi que le cron le consomme. Deux écrans l'annonçaient
     * au client en minutes en lisant un `accept_minutes` qui n'existe nulle
     * part : ils affichaient donc toujours la valeur de repli, et auraient
     * continué à annoncer cinq minutes même après un changement de réglage.
     */
    respondMinutes(settings) {
      const s = settings && +settings.resto_timeout_s;
      return s > 0 ? Math.max(1, Math.round(s / 60)) : 5;
    },

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
      /* « prête » ne veut plus dire « le restaurant a fini » : le restaurant
         n'a plus d'écran. Ça veut dire « la course cherche un livreur ». */
      ready:           { label: 'Recherche d’un livreur', short: 'En recherche', icon: '🔎', tag: 'tag-warn' },
      driver_assigned: { label: 'Livreur en route vers le restaurant', short: 'Livreur trouvé', icon: '🛵', tag: 'tag-info' },
      delivering:      { label: 'En cours de livraison', short: 'En livraison', icon: '🚀', tag: 'tag-info' },
      delivered:       { label: 'Livrée',               short: 'Livrée',       icon: '🎉', tag: 'tag-ok' },
      rejected:        { label: 'Commande refusée',      short: 'Refusée',      icon: '⛔', tag: 'tag-danger' },
      cancelled:       { label: 'Annulée',              short: 'Annulée',      icon: '🚫', tag: 'tag-danger' }
    },

    statusLabel(s) { return (U.STATUS[s] || { label: s }).label; },
    statusShort(s) { return (U.STATUS[s] || { short: s }).short; },
    statusTag(s)   { return (U.STATUS[s] || { tag: 'tag-muted' }).tag; },
    statusIcon(s)  { return (U.STATUS[s] || { icon: '•' }).icon; },

    /* Libellés seuls : les vues qui veulent un pictogramme en posent un
       elles-mêmes. Un emoji collé au texte se retrouvait doublé partout où
       une icône au trait précédait déjà le libellé. */
    VEHICLES: { moto: 'Moto', voiture: 'Voiture', velo: 'Vélo', autre: 'Autre' },

    /* ------------------------------------------------- frais de livraison */

    /**
     * Barème selon la distance, identique à celui de la base
     * (supabase/12_frais_distance.sql, qui fait foi).
     *
     *   jusqu'à near_km ...... fee_near_da
     *   de near_km à max_km .. fee_far_da
     *   au-delà .............. hors zone, la commande est refusée
     *
     * Le site l'applique pour AFFICHER le bon prix avant de commander ; le
     * serveur le réapplique à l'enregistrement. Les deux doivent dire la même
     * chose, sinon le client verrait un montant et paierait l'autre.
     */
    deliveryFor(km, settings) {
      const s = settings || {};
      const proche = s.fee_near_da != null ? +s.fee_near_da : 250;
      const loin   = s.fee_far_da  != null ? +s.fee_far_da  : 400;
      const kmNear = s.near_km     != null ? +s.near_km     : 10;
      const kmMax  = s.max_km      != null ? +s.max_km      : 15;

      /* Le temps de TRAJET, en minutes. 22 km/h est la vitesse moyenne d'un
         scooter en ville — feux et attentes comprises, pas la vitesse de pointe.
         Le plancher de 6 minutes existe parce qu'aucune course ne se fait en deux
         minutes même à 500 mètres : il faut sortir, trouver la porte, monter.

         Il vit ICI et non dans les vues : l'écran Commandes et l'écran de
         validation doivent annoncer la MÊME durée pour la même course. Deux
         calculs séparés finissent toujours par diverger, et c'est le genre
         d'écart qu'un client remarque. */
      const minutesDe = (d) => (d == null || !isFinite(d))
        ? null : Math.max(6, Math.round(d / 22 * 60));

      // distance inconnue : on annonce le tarif de base plutôt que le plus cher
      if (km == null || !isFinite(km))
        return { fee: proche, km: null, minutes: null, horsZone: false, loin: false };
      if (km > kmMax)
        return { fee: loin, km: km, minutes: minutesDe(km), horsZone: true, loin: true };
      const estLoin = km > kmNear;
      return { fee: estLoin ? loin : proche, km: km, minutes: minutesDe(km),
               horsZone: false, loin: estLoin };
    },

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
