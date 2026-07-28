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

      view.innerHTML = '<div class="wrap-sm page">' +

        /* ---- en-tête profil ---- */
        '<div class="card card-p">' +
          '<div class="row" style="gap:14px">' +
            UI.avatar(p.full_name, p.avatar_url, 58) +
            '<div class="grow"><div class="h2">' + U.esc(p.full_name || '—') + '</div>' +
              '<div class="tiny">' + U.esc(p.email || '') + '</div>' +
              '<span class="tag tag-info" style="margin-top:6px">' + U.esc(ROLE_LABEL[p.role] || p.role) + '</span></div>' +
          '</div>' +
        '</div>' +

        /* ---- accès rapide ---- */
        (p.role === 'restaurant'
          ? quickLinks([['#/r', '📊', 'Tableau de bord'], ['#/r/menu', '🍕', 'Gérer mon menu'], ['#/r/profile', '🏪', 'Ma fiche restaurant']])
          : p.role === 'driver'
          ? quickLinks([['#/d', '📊', 'Tableau de bord'], ['#/d/profile', '🛵', 'Mon profil livreur'], ['#/d/history', '📜', 'Historique']])
          : p.role === 'admin'
          ? quickLinks([['#/a', '📊', 'Tableau de bord'], ['#/a/settings', '⚙️', 'Réglages plateforme']])
          : quickLinks([['#/orders', '📦', 'Mes commandes'], ['#/restaurants', '🍽️', 'Commander']])) +

        /* ---- informations personnelles ---- */
        '<form id="pf" class="card card-p stack" style="margin-top:16px">' +
          '<div class="h3">Informations personnelles</div>' +
          UI.imageField('avatar_url', p.avatar_url, 'Photo de profil') +
          '<div class="field"><label>Nom complet</label>' +
            '<input class="input" name="full_name" value="' + U.esc(p.full_name || '') + '" required></div>' +
          '<div class="field"><label>Téléphone</label>' +
            '<input class="input" name="phone" inputmode="tel" placeholder="0555 12 34 56" value="' +
              U.esc(p.phone || '') + '"' + (verrou.bloque ? ' disabled style="background:var(--bg)"' : '') + '>' +
            (verrou.bloque
              ? '<div class="hint">🔒 Votre numéro a été enregistré il y a moins de 30 jours. ' +
                'Il sera modifiable dans <b>' + verrou.jours + ' jour' + (verrou.jours > 1 ? 's' : '') + '</b>. ' +
                'Le téléphone de chaque adresse de livraison, lui, reste libre.</div>'
              : '<div class="hint">Une fois modifié, il sera bloqué 30 jours.</div>') +
          '</div>' +
          Cmp.zoneSelect('zone_id', p.zone_id, 'Ma zone') +
          '<div class="field"><label>Email</label>' +
            '<input class="input" value="' + U.esc(p.email || '') + '" disabled style="background:var(--bg)"></div>' +
          '<button class="btn btn-primary" type="submit">Enregistrer</button>' +
        '</form>' +

        /* ---- adresses (clients) ---- */
        (p.role === 'client'
          ? '<div class="card card-p" style="margin-top:16px">' +
            '<div class="row-between" style="margin-bottom:12px">' +
              '<div class="h3">Adresses de livraison</div>' +
              '<button class="btn btn-primary btn-sm" id="addAddr">📍 Ajouter une adresse</button></div>' +
            (addresses.length
              ? '<div class="stack" style="gap:9px">' + addresses.map(a =>
                  '<div class="role-card">' +
                    '<div class="ic">📍</div>' +
                    '<div class="grow"><b>' + U.esc(a.label) +
                      (a.is_default ? ' <span class="tag tag-ok">Par défaut</span>' : '') +
                      (U.hasCoords(a) ? '' : ' <span class="tag tag-warn">sans GPS</span>') + '</b>' +
                      '<div class="tiny">' + U.esc(a.street) + (a.details ? ' — ' + U.esc(a.details) : '') + '</div>' +
                      '<div class="tiny">' + U.esc(zoneName(a.zone_id)) + ' • ' + U.esc(a.phone || '') +
                        (U.hasCoords(a) ? ' • <a target="_blank" rel="noopener" style="color:var(--brand);font-weight:700" href="' +
                          U.gmapsPin(a.lat, a.lng) + '">carte ↗</a>' : '') + '</div></div>' +
                    '<div class="row" style="gap:6px">' +
                      '<button class="btn btn-ghost btn-sm" data-ae="' + U.esc(a.id) + '">✏️</button>' +
                      '<button class="btn btn-danger btn-sm" data-ad="' + U.esc(a.id) + '">🗑</button></div>' +
                  '</div>').join('') + '</div>'
              : '<div class="tiny">Aucune adresse enregistrée. Ajoutez-en une depuis ' +
                'votre position : c’est le point que le livreur ouvrira dans Google Maps.</div>') +
          '</div>'
          : '') +

        /* ---- infos plateforme ---- */
        '<div class="card card-p" style="margin-top:16px">' +
          '<div class="h3" style="margin-bottom:10px">Assistance</div>' +
          '<a class="btn btn-ghost btn-block" href="tel:' + U.esc(TALABI_CONFIG.SUPPORT_PHONE) + '" style="justify-content:flex-start">' +
            '📞 Support : ' + U.esc(TALABI_CONFIG.SUPPORT_PHONE) + '</a>' +
          '<div class="tiny" style="margin-top:10px">Mode : <b>' +
            (API.mode === 'demo' ? 'Démonstration (données locales)' : 'Production (Supabase)') + '</b></div>' +
        '</div>' +

        '<button class="btn btn-danger btn-block btn-lg" style="margin-top:16px" id="logout">Se déconnecter</button>' +
      '</div>';

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
  function quickLinks(items) {
    return '<div class="grid grid-2" style="margin-top:14px">' +
      items.map(i => '<a class="card card-p card-hover" href="' + i[0] + '" style="text-align:center">' +
        '<div style="font-size:24px">' + i[1] + '</div>' +
        '<div class="strong" style="font-size:13.5px;margin-top:6px">' + U.esc(i[2]) + '</div></a>').join('') +
    '</div>';
  }

  w.zoneName = function (id) {
    const z = Store.zones.find(x => x.id === id);
    return z ? z.name : '';
  };
})(window);
