/* ==========================================================================
   VUE — Mon compte (tous les rôles)
   ========================================================================== */
(function (w) {
  'use strict';

  const ROLE_LABEL = { client: 'Client', restaurant: 'Restaurant', driver: 'Livreur', admin: 'Administrateur' };

  Router.add('/account', async function (params, query, view) {
    const p = Store.profile;

    async function paint() {
      const addresses = p.role === 'client' ? await API.safe(() => API.addresses(), []) : [];
      const verrou = U.phoneLock(p);

      view.innerHTML = '<div class="account-page">' +
        '<span class="acc-dots a" aria-hidden="true"></span>' +
        '<span class="acc-dots b" aria-hidden="true"></span>' +
        '<span class="acc-leaf" aria-hidden="true">🌿</span>' +
        '<div class="wrap-sm page">' +

        /* ---- en-tête profil ---- */
        '<div class="card card-p acc-head">' +
          '<div class="row" style="gap:14px">' +
            UI.avatar(p.full_name, p.avatar_url, 72) +
            '<div class="grow"><div class="h2">' + U.esc(p.full_name || '—') + '</div>' +
              '<div class="tiny">' + U.esc(p.email || '') + '</div>' +
              '<span class="tag tag-soft" style="margin-top:7px">' + UI.icon('user', 14) + ' ' +
                U.esc(ROLE_LABEL[p.role] || p.role) + '</span></div>' +
            '<span class="acc-chev">' + UI.icon('chevron', 20) + '</span>' +
          '</div>' +
        '</div>' +

        /* ---- accès rapide ---- */
        (p.role === 'restaurant'
          ? quickLinks([['#/r', 'chart', 'Tableau de bord'], ['#/r/menu', 'pizza', 'Gérer mon menu'], ['#/r/profile', 'store', 'Ma fiche restaurant']])
          : p.role === 'driver'
          ? quickLinks([['#/d', 'chart', 'Tableau de bord'], ['#/d/profile', 'scooter', 'Mon profil livreur'], ['#/d/history', 'history', 'Historique']])
          : p.role === 'admin'
          ? quickLinks([['#/a', 'chart', 'Tableau de bord'], ['#/a/settings', 'settings', 'Réglages plateforme']])
          : quickLinks([['#/orders', 'package', 'Mes commandes', 'Suivre mes commandes'],
                        ['#/restaurants', 'utensils', 'Commander', 'Découvrir les restaurants']])) +

        /* ---- informations personnelles ---- */
        '<form id="pf" class="card card-p stack acc-block" style="margin-top:16px">' +
          bloc('user', 'Informations personnelles') +
          '<div class="acc-grid">' +
            UI.imageField('avatar_url', p.avatar_url, 'Photo de profil') +
            '<div class="field"><label>Nom complet</label>' +
              '<div class="input-ic"><span>' + UI.icon('user', 17) + '</span>' +
              '<input class="input" name="full_name" value="' + U.esc(p.full_name || '') + '" required></div></div>' +
            '<div class="field"><label>Téléphone</label>' +
              '<div class="input-ic"><span>' + UI.icon(verrou.bloque ? 'lock' : 'phone', 17) + '</span>' +
              '<input class="input" name="phone" inputmode="tel" placeholder="Entrez votre numéro" value="' +
                U.esc(p.phone || '') + '"' + (verrou.bloque ? ' disabled' : '') + '></div>' +
              // le compte à rebours est spécifique et important : il reste sous le
              // champ, en plus de la note générique sous le bouton
              (verrou.bloque
                ? '<div class="hint">Numéro enregistré il y a moins de 30 jours. Modifiable dans <b>' +
                  verrou.jours + ' jour' + (verrou.jours > 1 ? 's' : '') + '</b>. ' +
                  'Le téléphone de chaque adresse de livraison, lui, reste libre.</div>'
                : '') +
            '</div>' +
            Cmp.zoneSelect('zone_id', p.zone_id, 'Ma zone') +
            '<div class="field acc-full"><label>Email</label>' +
              '<div class="input-ic"><span>' + UI.icon('mail', 17) + '</span>' +
              '<input class="input" value="' + U.esc(p.email || '') + '" disabled></div></div>' +
          '</div>' +
          '<button class="btn btn-primary btn-block btn-lg" type="submit">' +
            UI.icon('save', 18) + ' Enregistrer les modifications</button>' +
          '<div class="tiny center" style="margin-top:2px">Une fois modifié, il sera bloqué 30 jours.</div>' +
        '</form>' +

        /* ---- adresses (clients) ---- */
        (p.role === 'client'
          ? '<div class="card card-p acc-block" style="margin-top:16px">' +
            '<div class="row-between" style="margin-bottom:14px">' +
              bloc('pin', 'Adresses de livraison') +
              '<button class="btn btn-soft btn-sm" id="addAddr">' + UI.icon('plus', 16) +
                ' Ajouter une adresse</button></div>' +
            (addresses.length
              ? '<div class="stack" style="gap:9px">' + addresses.map(a =>
                  '<div class="role-card addr-row">' +
                    '<div class="ic">' + UI.icon('pin', 20) + '</div>' +
                    '<div class="grow"><b>' + U.esc(a.label) +
                      (a.is_default ? ' <span class="tag tag-ok">' + UI.icon('check', 13) + ' Par défaut</span>' : '') +
                      (U.hasCoords(a) ? '' : ' <span class="tag tag-warn">' + UI.icon('warn', 13) + ' sans GPS</span>') + '</b>' +
                      '<div class="tiny">' + U.esc(a.street) + (a.details ? ' — ' + U.esc(a.details) : '') + '</div>' +
                      '<div class="tiny">' + U.esc(zoneName(a.zone_id)) + ' • ' + U.esc(a.phone || '') +
                        (U.hasCoords(a) ? ' • <a class="addr-map" target="_blank" rel="noopener" href="' +
                          U.gmapsPin(a.lat, a.lng) + '">carte ' + UI.icon('link', 12) + '</a>' : '') + '</div></div>' +
                    '<div class="row" style="gap:8px">' +
                      '<button class="icon-round" data-ae="' + U.esc(a.id) + '" title="Modifier">' +
                        UI.icon('pencil', 17) + '</button>' +
                      '<button class="icon-round danger" data-ad="' + U.esc(a.id) + '" title="Supprimer">' +
                        UI.icon('trash', 17) + '</button></div>' +
                  '</div>').join('') + '</div>'
              : '<div class="tiny">Aucune adresse enregistrée. Ajoutez-en une depuis ' +
                'votre position : c’est le point que le livreur ouvrira dans Google Maps.</div>') +
          '</div>'
          : '') +

        /* ---- infos plateforme ---- */
        '<div class="card card-p acc-block" style="margin-top:16px">' +
          bloc('headset', 'Assistance') +
          // le tel: ne supporte pas les espaces du numéro affiché
          '<a class="acc-link" href="tel:' + U.esc(TALABI_CONFIG.SUPPORT_PHONE.replace(/\s/g, '')) + '">' +
            '<span class="ic">' + UI.icon('phone', 18) + '</span>' +
            '<span class="grow"><b>Nous appeler</b>' +
              '<span class="tiny">' + U.esc(TALABI_CONFIG.SUPPORT_PHONE) + '</span></span>' +
            '<span class="acc-chev">' + UI.icon('chevron', 18) + '</span></a>' +
          (TALABI_CONFIG.SUPPORT_EMAIL
            ? '<a class="acc-link" href="mailto:' + U.esc(TALABI_CONFIG.SUPPORT_EMAIL) + '">' +
                '<span class="ic">' + UI.icon('mail', 18) + '</span>' +
                '<span class="grow"><b>Nous écrire</b>' +
                  '<span class="tiny">' + U.esc(TALABI_CONFIG.SUPPORT_EMAIL) + '</span></span>' +
                '<span class="acc-chev">' + UI.icon('chevron', 18) + '</span></a>'
            : '') +
        '</div>' +

        '<div class="acc-logout" style="margin-top:16px">' +
          '<button class="btn btn-block btn-lg" id="logout">' +
            UI.icon('logout', 18) + ' Se déconnecter</button></div>' +
      '</div></div>';

      /* ------------------------------------------------------ actions */
      UI.bindImageFields(view);

      view.querySelector('#pf').onsubmit = async function (e) {
        e.preventDefault();
        const btn = this.querySelector('[type=submit]');
        const d = UI.formData(this);
        if (!d.full_name || d.full_name.length < 3) return UI.err('Indiquez votre nom complet');
        // le champ est désactivé quand il est verrouillé : il n'arrive pas dans
        // le formulaire, on n'envoie donc rien qui serait refusé côté serveur
        if (d.phone && !U.isPhoneDZ(d.phone)) return UI.err('Numéro invalide');
        UI.busy(btn, true);
        try {
          await API.updateProfile(d);
          await Store.refreshProfile();
          UI.busy(btn, false);
          UI.ok('Profil mis à jour');
          Shell.renderTop();
        } catch (err) { UI.busy(btn, false); UI.err(err.message); }
      };

      /* Un seul geste : on demande la position, puis la carte s'ouvre déjà
         centrée dessus. L'utilisateur n'a plus qu'à confirmer le point. */
      const aa = view.querySelector('#addAddr');
      if (aa) aa.onclick = async function () {
        UI.busy(this, true, 'Localisation…');
        const pos = await askGeolocation();   // null si refusée : la carte s'ouvre sur la ville
        UI.busy(this, false);
        addressSheet(null, paint, pos);
      };

      view.querySelectorAll('[data-ae]').forEach(b => b.onclick = () =>
        addressSheet(addresses.find(a => a.id === b.dataset.ae), paint));

      view.querySelectorAll('[data-ad]').forEach(b => b.onclick = async () => {
        if (!(await UI.confirm('Supprimer cette adresse ?', '', 'Supprimer', true))) return;
        await API.safe(() => API.deleteAddress(b.dataset.ad));
        UI.ok('Adresse supprimée');
        paint();
      });

      view.querySelector('#logout').onclick = async () => {
        if (!(await UI.confirm('Se déconnecter ?', 'Vous devrez vous reconnecter pour commander.', 'Déconnexion', true))) return;
        await API.signOut();
        Store.clearCart(true);
        await Store.refreshProfile();
        UI.ok('À bientôt !');
        Router.go('/', true);
      };
    }

    await paint();
  }, { auth: true });

  /* ------------------------------------------------------------ helpers */

  /** Titre de bloc : pastille orange + intitulé */
  function bloc(icone, titre) {
    return '<div class="acc-title"><span class="ic">' + UI.icon(icone, 19) + '</span>' +
           '<span class="h3">' + U.esc(titre) + '</span></div>';
  }

  /* [href, icône, titre, sous-titre] — le sous-titre est facultatif.
     L'icône est un nom du jeu UI.ICONS, ou un emoji pour les autres rôles. */
  function quickLinks(items) {
    return '<div class="grid grid-2" style="margin-top:14px">' +
      items.map(i => '<a class="card card-p card-hover acc-quick" href="' + i[0] + '">' +
        '<span class="ic">' + (UI.ICONS[i[1]] ? UI.icon(i[1], 21) : i[1]) + '</span>' +
        '<span class="grow"><b>' + U.esc(i[2]) + '</b>' +
          (i[3] ? '<span class="tiny">' + U.esc(i[3]) + '</span>' : '') + '</span>' +
        '<span class="acc-chev">›</span></a>').join('') +
    '</div>';
  }

  w.zoneName = function (id) {
    const z = Store.zones.find(x => x.id === id);
    return z ? z.name : '';
  };
})(window);
