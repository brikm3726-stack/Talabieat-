/* ==========================================================================
   VUES — Compte

   Trois écrans, et la séparation compte autant que le contenu :

     /account   les réglages — une liste de portes, rien d'autre
     /profil    les informations personnelles, et ce qui en dépend
     /securite  le mot de passe, prouvé par un code reçu par email

   Un écran de réglages qui contient aussi un formulaire oblige à faire défiler
   pour trouver ce qu'on cherche. Ici, on ouvre la porte qui nous concerne.
   ========================================================================== */
(function (w) {
  'use strict';

  const ROLE_LABEL = { client: T('Client'), restaurant: 'Restaurant', driver: T('Livreur'), admin: T('Administrateur') };
  const VEHICULES = ['moto', 'voiture', 'velo', 'autre'];
  const VEHICULE_ICON = { moto: 'scooter', voiture: 'car', velo: 'bike', autre: 'package' };

  /* ======================================================================
     RÉGLAGES — la page d'accueil du compte
     ====================================================================== */
  Router.add('/account', async function (params, query, view) {
    const p = Store.profile || {};
    /* Seuls ceux qu'on appelle entendent une sonnerie : le client, lui, n'a
       rien à couper. Et si le module audio n'a pas pu se charger, la ligne
       disparaît plutôt que de faire tomber la page entière. */
    const sonnerie = !!w.Sound && p.role === 'driver';

    function paint() {
      view.innerHTML = '<div class="account-page">' +
        '<span class="acc-dots a" aria-hidden="true"></span>' +
        '<span class="acc-dots b" aria-hidden="true"></span>' +
        '<div class="wrap-sm page">' +

        /* Pas de carte de profil en tête. Le nom, l'adresse et la photo
           s'affichaient à quelqu'un qui les connaît déjà, et exposaient son
           identité à qui regarde par-dessus son épaule. Ils sont dans
           « Mon compte », c'est-à-dire à un geste, volontaire. */

        '<div class="stack acc-reglages" style="gap:10px">' +

          /* 1 ---- mon compte ---- */
          porte('#/compte', 'user', T('Mon compte'),
                T('Vos informations personnelles et votre identité')) +

          /* 2 ---- sécurité ---- */
          porte('#/securite', 'lock', T('Sécurité'),
                T('Modifier mon mot de passe, vérifié par email')) +

          /* ---- sonnerie ---- */
          (sonnerie
            ? '<div class="card card-p acc-secu" style="cursor:default">' +
                '<span class="ic">' + UI.icon(Sound.muted ? 'mute' : 'sound', 20) + '</span>' +
                '<span class="grow"><b>Sonnerie</b>' +
                  '<span class="tiny">' +
                    (Sound.muted
                      ? 'Coupée — vous ne serez plus averti par un son'
                      : 'Vous êtes averti à chaque course disponible') +
                  '</span></span>' +
                '<label class="switch"><input type="checkbox" id="son"' +
                  (Sound.muted ? '' : ' checked') + '>' +
                  '<span class="track"><span class="knob"></span></span></label>' +
              '</div>'
            : '') +

          /* 3 ---- assistance ---- */
          /* Les deux contacts tenaient chacun une ligne pleine, avec chevron :
             autant de place qu'un réglage, pour un numéro qu'on appelle deux
             fois par an. Ils passent en deux boutons courts, côte à côte. */
          '<div class="card card-p acc-secu acc-aide" style="cursor:default">' +
            '<span class="ic">' + UI.icon('headset', 20) + '</span>' +
            '<span class="grow"><b>' + T('Assistance') + '</b>' +
              '<span class="tiny">' + T('Une question, un problème sur une commande') + '</span></span>' +
          '</div>' +
          '<div class="acc-aide-btns">' +
            // le tel: ne supporte pas les espaces du numéro affiché
            '<a class="btn btn-soft btn-sm" href="tel:' +
              U.esc(TALABI_CONFIG.SUPPORT_PHONE.replace(/\s/g, '')) + '">' +
              UI.icon('phone', 16) + ' ' + T('Nous appeler') + '</a>' +
            (TALABI_CONFIG.SUPPORT_EMAIL
              ? '<a class="btn btn-soft btn-sm" href="mailto:' + U.esc(TALABI_CONFIG.SUPPORT_EMAIL) + '">' +
                  UI.icon('mail', 16) + ' Nous écrire</a>'
              : '') +
          '</div>' +

          /* 4 ---- l'application ---- */
          porte('#/apropos', 'info', 'À propos de l’application',
                U.esc(TALABI_CONFIG.APP_NAME) + ' version ' + U.esc(TALABI_CONFIG.APP_VERSION || '1.0')) +

          /* 5 ---- confidentialité ---- */
          /* Ces deux-là vivaient dans « À propos ». Personne ne cherche la
             politique de confidentialité derrière un écran qui parle de
             numéro de version — et le Play Store exige qu'elle soit
             atteignable. Chacune a donc sa ligne, au même rang que les
             autres réglages. */
          '<a class="card card-p acc-secu" href="' +
              U.escUrl(U.asset('confidentialite.html')) + '" target="_blank" rel="noopener">' +
            '<span class="ic">' + UI.icon('lock', 20) + '</span>' +
            '<span class="grow"><b>Politique de confidentialité</b>' +
              '<span class="tiny">Quelles données, pourquoi, et comment les effacer</span></span>' +
            '<span class="acc-chev">' + UI.icon('chevron', 20) + '</span></a>' +

          /* 6 ---- signalement ---- */
          '<a class="card card-p acc-secu" href="mailto:' +
              U.esc(TALABI_CONFIG.SUPPORT_EMAIL || '') +
              '?subject=' + encodeURIComponent('Talabi — signalement') + '">' +
            '<span class="ic">' + UI.icon('warn', 20) + '</span>' +
            '<span class="grow"><b>Signaler un problème</b>' +
              '<span class="tiny">Décrivez ce que vous avez vu, on répond sous 7 jours</span></span>' +
            '<span class="acc-chev">' + UI.icon('chevron', 20) + '</span></a>' +

        '</div>' +

        '<div class="acc-logout" style="margin-top:16px">' +
          '<button class="btn btn-block btn-lg" id="logout">' +
            UI.icon('logout', 18) + ' Se déconnecter</button></div>' +
      '</div></div>';

      const son = view.querySelector('#son');
      if (son) son.onchange = function () {
        Sound.muted = !this.checked;
        UI.ok(Sound.muted ? 'Sonnerie coupée' : 'Sonnerie réactivée',
              Sound.muted ? 'Vous ne serez plus averti par un son.' : '');
        paint();
      };

      view.querySelector('#logout').onclick = deconnexion;
    }

    paint();
  }, { auth: true });

  /* ======================================================================
     INFORMATIONS PERSONNELLES
     ====================================================================== */
  Router.add('/profil', async function (params, query, view) {
    const p = Store.profile || {};

    async function paint() {
      const addresses = p.role === 'client' ? await API.safe(() => API.addresses(), []) : [];
      const d = p.role === 'driver' ? (p.driver || await API.safe(() => API.getDriver(), {}) || {}) : {};
      const verrou = U.phoneLock(p);
      let vehicule = d.vehicle || 'moto';

      view.innerHTML = '<div class="account-page">' +
        '<span class="acc-dots a" aria-hidden="true"></span>' +
        '<div class="wrap-sm page">' +

        entete(T('Informations personnelles')) +

        '<form id="pf" class="card card-p stack acc-block">' +
          '<div class="acc-grid">' +
            UI.imageField('avatar_url', p.avatar_url, T('Photo de profil')) +
            '<div class="field"><label>Nom complet</label>' +
              '<div class="input-ic"><span>' + UI.icon('user', 17) + '</span>' +
              '<input class="input" name="full_name" value="' + U.esc(p.full_name || '') + '" required></div></div>' +
            '<div class="field"><label>Téléphone</label>' +
              '<div class="input-ic"><span>' + UI.icon(verrou.bloque ? 'lock' : 'phone', 17) + '</span>' +
              '<input class="input" name="phone" inputmode="tel" placeholder="Entrez votre numéro" value="' +
                U.esc(p.phone || '') + '"' + (verrou.bloque ? ' disabled' : '') + '></div>' +
              (verrou.bloque
                ? '<div class="hint">Numéro enregistré il y a moins de 30 jours. Modifiable dans <b>' +
                  verrou.jours + ' jour' + (verrou.jours > 1 ? 's' : '') + '</b>. ' +
                  'Le téléphone de chaque adresse de livraison, lui, reste libre.</div>'
                : '') +
            '</div>' +
            Cmp.zoneSelect('zone_id', p.zone_id, p.role === 'driver' ? T('Mon quartier de livraison') : T('Ma zone')) +
            '<div class="field acc-full"><label>Email</label>' +
              '<div class="input-ic"><span>' + UI.icon('mail', 17) + '</span>' +
              '<input class="input" value="' + U.esc(p.email || '') + '" disabled></div></div>' +
          '</div>' +

          /* ---- moyen de transport : il appartient au livreur, pas à un
                  écran séparé qu'il faut aller chercher ---- */
          (p.role === 'driver'
            ? '<div class="divider"></div>' +
              '<div class="field"><label>Moyen de transport</label>' +
                '<div class="grid grid-2" style="gap:9px" id="vehic">' +
                  VEHICULES.map(k =>
                    '<div class="role-card ' + (vehicule === k ? 'on' : '') + '" data-v="' + k + '">' +
                      '<div class="ic">' + UI.icon(VEHICULE_ICON[k] || 'scooter', 20) + '</div>' +
                      '<div class="grow"><b>' + U.esc(U.VEHICLES[k]) + '</b></div>' +
                      '<div data-check style="color:var(--brand);font-weight:800">' +
                        (vehicule === k ? '✓' : '') + '</div></div>').join('') +
                '</div></div>' +
              '<div class="field"><label>Plaque d’immatriculation <span class="tiny">(facultatif)</span></label>' +
                '<input class="input" name="plate" placeholder="Ex : 16-1234-118" value="' + U.esc(d.plate || '') + '"></div>'
            : '') +

          '<button class="btn btn-primary btn-block btn-lg" type="submit">' +
            UI.icon('save', 18) + ' Enregistrer les modifications</button>' +
          (verrou.bloque ? '' :
            '<div class="tiny center" style="margin-top:2px">Une fois modifié, le téléphone sera bloqué 30 jours.</div>') +
        '</form>' +

        /* ---- adresses (clients) ---- */
        (p.role === 'client'
          ? '<div class="card card-p acc-block" style="margin-top:16px">' +
            '<div class="row-between" style="margin-bottom:14px">' +
              bloc('pin', T('Adresses de livraison')) +
              '<button class="btn btn-soft btn-sm" id="addAddr">' + UI.icon('plus', 16) +
                ' Ajouter</button></div>' +
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

      '</div></div>';

      /* ------------------------------------------------------ actions */
      UI.bindImageFields(view);

      view.querySelectorAll('[data-v]').forEach(el => el.onclick = () => {
        vehicule = el.dataset.v;
        view.querySelectorAll('[data-v]').forEach(x => {
          const on = x.dataset.v === vehicule;
          x.classList.toggle('on', on);
          x.querySelector('[data-check]').textContent = on ? '✓' : '';
        });
      });

      view.querySelector('#pf').onsubmit = async function (e) {
        e.preventDefault();
        const btn = this.querySelector('[type=submit]');
        const f = UI.formData(this);
        if (!f.full_name || f.full_name.length < 3) return UI.err('Indiquez votre nom complet');
        // le champ verrouillé n'arrive pas dans le formulaire : on n'envoie
        // donc rien que le serveur refuserait
        if (f.phone && !U.isPhoneDZ(f.phone)) return UI.err('Numéro invalide');

        UI.busy(btn, true);
        try {
          await API.updateProfile({
            full_name: f.full_name, phone: f.phone,
            zone_id: f.zone_id, avatar_url: f.avatar_url
          });
          if (p.role === 'driver')
            await API.saveDriver({ vehicle: vehicule, plate: f.plate, zone_id: f.zone_id });
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
        if (!(await UI.confirm('Supprimer cette adresse ?', '', T('Supprimer'), true))) return;
        await API.safe(() => API.deleteAddress(b.dataset.ad));
        UI.ok('Adresse supprimée');
        paint();
      });
    }

    await paint();
  }, { auth: true });

  /* ======================================================================
     MON COMPTE — qui je suis sur la plateforme, et comment en sortir
     ----------------------------------------------------------------------
     C'est le seul écran qui répond à « quel compte suis-je en train
     d'utiliser ? ». La question paraît triviale jusqu'au jour où quelqu'un
     tient deux comptes — un livreur qui teste, un gérant qui a aussi une
     adresse client — et ne sait plus lequel est ouvert.
     ====================================================================== */
  Router.add('/compte', async function (params, query, view) {
    const p = Store.profile || {};
    const d = p.role === 'driver' ? (await API.safe(() => API.getDriver(), null)) : null;

    const ligne = (icone, titre, valeur) =>
      '<div class="acc-link" style="cursor:default">' +
        '<span class="ic">' + UI.icon(icone, 18) + '</span>' +
        '<span class="grow"><b>' + U.esc(titre) + '</b>' +
          '<span class="tiny">' + U.esc(valeur || '—') + '</span></span></div>';

    view.innerHTML = '<div class="account-page">' +
      '<span class="acc-dots a" aria-hidden="true"></span>' +
      '<div class="wrap-sm page">' +

      entete(T('Mon compte')) +

      '<div class="card card-p acc-head">' +
        '<div class="row" style="gap:14px">' +
          UI.avatar(p.full_name, p.avatar_url, 72) +
          '<div class="grow"><div class="h2">' + U.esc(p.full_name || '—') + '</div>' +
            '<span class="tag tag-soft" style="margin-top:7px">' + UI.icon('user', 14) + ' ' +
              U.esc(ROLE_LABEL[p.role] || p.role) + '</span></div>' +
        '</div>' +
      '</div>' +

      '<div class="card card-p acc-block" style="margin-top:16px">' +
        bloc('user', T('Identité')) +
        ligne('mail', T('Email'), p.email) +
        ligne('phone', T('Téléphone'), p.phone) +
        ligne('calendar', T('Compte créé le'), p.created_at ? U.dt(p.created_at) : '') +
        (d ? ligne('scooter', T('Statut livreur'),
                   d.validation_status === 'approved' ? T('Validé') :
                   d.validation_status === 'rejected' ? T('Refusé') : T('En attente de validation')) : '') +
      '</div>' +

      /* « Informations personnelles » a quitté la liste des réglages pour
         venir ici : c'est le même sujet que l'identité affichée au-dessus, et
         la liste des réglages n'a pas à contenir deux portes vers le même
         propriétaire. */
      '<div class="card card-p acc-block" style="margin-top:16px">' +
        '<a class="acc-link" href="#/profil">' +
          '<span class="ic">' + UI.icon('pencil', 18) + '</span>' +
          '<span class="grow"><b>Informations personnelles</b>' +
            '<span class="tiny">Nom, téléphone, quartier' +
              (p.role === 'client' ? ', adresses de livraison' : '') +
              (p.role === 'driver' ? ', moyen de transport' : '') + '</span></span>' +
          '<span class="acc-chev">' + UI.icon('chevron', 18) + '</span></a>' +
        '<a class="acc-link" href="#/securite">' +
          '<span class="ic">' + UI.icon('lock', 18) + '</span>' +
          '<span class="grow"><b>Changer mon mot de passe</b>' +
            '<span class="tiny">Vérifié par un code reçu par email</span></span>' +
          '<span class="acc-chev">' + UI.icon('chevron', 18) + '</span></a>' +
      '</div>' +

      '<div class="acc-logout" style="margin-top:16px">' +
        '<button class="btn btn-block btn-lg" id="logout">' +
          UI.icon('logout', 18) + ' Se déconnecter</button></div>' +
    '</div></div>';

    view.querySelector('#logout').onclick = deconnexion;
  }, { auth: true });

  /* ======================================================================
     À PROPOS
     ====================================================================== */
  Router.add('/apropos', async function (params, query, view) {
    view.innerHTML = '<div class="account-page"><div class="wrap-sm page">' +
      entete('À propos') +

      '<div class="card card-p acc-block center">' +
        '<img src="' + U.asset('assets/img/logo.jpg') + '" alt="' + U.esc(TALABI_CONFIG.APP_NAME) + '" ' +
          'style="width:88px;border-radius:22px;margin:0 auto">' +
        '<div class="h2" style="margin-top:12px">' + U.esc(App.nom) + '</div>' +
        '<div class="tiny">Version ' + U.esc(TALABI_CONFIG.APP_VERSION || '1.0') + '</div>' +
        '<p class="sub" style="margin-top:12px">' +
          U.esc(TALABI_CONFIG.APP_TAGLINE) + '<br>Tizi Ouzou, Algérie.</p>' +
      '</div>' +

      /* La confidentialité et le signalement ont quitté cet écran pour la
         liste des réglages, où on les voit sans avoir à ouvrir « À propos ».
         Il ne reste ici que ce qui répond vraiment à « quelle application
         est-ce, et quelle version ». */

      '<div class="tiny center" style="margin-top:18px">© ' + new Date().getFullYear() + ' ' +
        U.esc(TALABI_CONFIG.APP_NAME) + '</div>' +
    '</div></div>';
  }, { auth: true });

  /* ======================================================================
     SÉCURITÉ — changer son mot de passe, prouvé par email

     Trois étapes, sur un seul écran : on demande un code, on le saisit, on
     choisit le nouveau mot de passe. Le code prouve que la boîte mail est
     bien celle de la personne assise devant l'écran — sans lui, quelqu'un
     qui trouverait un téléphone déverrouillé changerait le mot de passe et
     prendrait le compte.
     ====================================================================== */
  Router.add('/securite', async function (params, query, view) {
    const p = Store.profile || {};
    let etape = 'demande';        // demande → code

    function paint() {
      view.innerHTML = '<div class="account-page">' +
        '<span class="acc-dots a" aria-hidden="true"></span>' +
        '<div class="wrap-sm page">' +

        entete(T('Sécurité')) +

        '<div class="card card-p acc-block">' +
          bloc('lock', T('Mot de passe')) +

          (etape === 'demande'
            ? '<p class="sub">Pour changer votre mot de passe, nous envoyons un code à ' +
                '<b>' + U.esc(p.email || '') + '</b>. Il prouve que cette boîte mail est bien la vôtre.</p>' +
              '<button class="btn btn-primary btn-block btn-lg" id="envoyer" style="margin-top:14px">' +
                UI.icon('mail', 18) + ' Recevoir le code</button>'

            : '<p class="sub">Code envoyé à <b>' + U.esc(p.email || '') + '</b>. ' +
                'Valable 1 heure — pensez à regarder dans les spams.</p>' +
              '<form id="sf" class="stack" style="margin-top:14px" novalidate>' +
                '<div class="field"><label>Code reçu par email</label>' +
                  '<input class="input input-code" name="code" inputmode="numeric" ' +
                    'autocomplete="one-time-code" maxlength="10" placeholder="— — — — — —" required></div>' +
                '<div class="field"><label>Nouveau mot de passe</label>' +
                  '<div class="input-ic"><span>' + UI.icon('lock', 17) + '</span>' +
                  '<input class="input" type="password" name="password" ' +
                    'placeholder="6 caractères minimum" autocomplete="new-password" required></div></div>' +
                '<div class="field"><label>Confirmer le mot de passe</label>' +
                  '<div class="input-ic"><span>' + UI.icon('lock', 17) + '</span>' +
                  '<input class="input" type="password" name="confirm" ' +
                    'placeholder="Retapez-le" autocomplete="new-password" required></div></div>' +
                '<button class="btn btn-primary btn-block btn-lg" type="submit">' +
                  UI.icon('save', 18) + ' Enregistrer le nouveau mot de passe</button>' +
              '</form>' +
              '<button class="btn btn-ghost btn-block" id="renvoyer" style="margin-top:10px">' +
                'Je n’ai rien reçu — renvoyer un code</button>') +
        '</div>' +

        '<div class="tiny center" style="margin-top:14px">Vous vous connectez avec Google ? ' +
          'Définir un mot de passe ici vous ouvre une seconde façon d’entrer, ' +
          'sans rien retirer à la première.</div>' +

      '</div></div>';

      const env = view.querySelector('#envoyer');
      if (env) env.onclick = demander;
      const re = view.querySelector('#renvoyer');
      if (re) re.onclick = demander;
      const f = view.querySelector('#sf');
      if (f) f.onsubmit = enregistrer;
    }

    async function demander() {
      const btn = view.querySelector('#envoyer') || view.querySelector('#renvoyer');
      UI.busy(btn, true, 'Envoi…');
      try {
        await API.sendEmailCode(p.email);
        etape = 'code';
        paint();
        UI.ok('Code envoyé', 'Vérifiez votre boîte mail, et les spams.');
      } catch (e) { UI.busy(btn, false); UI.err(e.message); }
    }

    async function enregistrer(e) {
      e.preventDefault();
      const btn = this.querySelector('[type=submit]');
      const d = UI.formData(this);
      const code = String(d.code || '').replace(/\D/g, '');

      if (code.length < 4) return UI.err('Saisissez le code reçu par email');
      if ((d.password || '').length < 6) return UI.err('Mot de passe trop court', '6 caractères minimum');
      if (d.password !== d.confirm) return UI.err('Les deux mots de passe ne correspondent pas');

      UI.busy(btn, true, 'Vérification…');
      try {
        /* Le code d'abord : il rouvre une session fraîche, et c'est elle qui
           autorise le changement. Dans l'autre ordre, on modifierait le mot de
           passe sans avoir rien prouvé. */
        await API.verifyEmailCode(p.email, code);
        await API.updatePassword(d.password);
        UI.ok('Mot de passe modifié', 'Il est actif dès maintenant.');
        Router.go('/account', true);
      } catch (err) {
        UI.busy(btn, false);
        UI.err(err.message);
      }
    }

    paint();
  }, { auth: true });

  /* ------------------------------------------------------------ fragments */

  /** En-tête d'une sous-page : une flèche de retour et un titre. */
  function entete(titre) {
    return '<div class="row" style="gap:10px;margin-bottom:14px">' +
      '<a class="icon-round" href="#/account" title="Retour aux réglages">' +
        UI.icon('chevron', 18) + '</a>' +
      '<div class="h1" style="font-size:23px">' + U.esc(titre) + '</div></div>';
  }

  /** Une ligne de réglage qui mène ailleurs. */
  function porte(href, icone, titre, sous) {
    return '<a class="card card-p acc-secu" href="' + href + '">' +
      '<span class="ic">' + UI.icon(icone, 20) + '</span>' +
      '<span class="grow"><b>' + U.esc(titre) + '</b>' +
        '<span class="tiny">' + sous + '</span></span>' +
      '<span class="acc-chev">' + UI.icon('chevron', 20) + '</span></a>';
  }

  function bloc(icone, titre) {
    return '<div class="acc-title"><span class="ic">' + UI.icon(icone, 19) + '</span>' +
           '<span class="h3">' + U.esc(titre) + '</span></div>';
  }

  async function deconnexion() {
    if (!(await UI.confirm(T('Se déconnecter ?'), T('Vous devrez vous reconnecter pour continuer.'), T('Déconnexion'), true))) return;
    UI.busy(this, true, 'Déconnexion…');
    try {
      await API.signOut();
      Store.clearCart(true);
      await Store.refreshProfile();
      UI.ok('À bientôt !');
      Router.go(App.est('client') ? '/' : '/login', true);
    } catch (e) {
      /* Rien ne doit retenir quelqu'un dans son compte. Si un appel a échoué
         en route, on recharge : la session locale est déjà effacée. */
      console.error(e);
      location.reload();
    }
  }

  w.zoneName = function (id) {
    const z = Store.zones.find(x => x.id === id);
    return z ? z.name : '';
  };
})(window);
