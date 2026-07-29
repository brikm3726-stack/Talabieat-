/* ==========================================================================
   VUES — Authentification (connexion, inscription, mot de passe oublié)
   ========================================================================== */
(function (w) {
  'use strict';

  const GOOGLE_ICON =
    '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">' +
    '<path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z"/>' +
    '<path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.4c-.5 2.9-2.2 5.4-4.7 7l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.2z"/>' +
    '<path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.3 0 20 0 24s1 7.7 2.6 10.8l7.8-6.1z"/>' +
    '<path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.4 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';

  /* img : logo du rôle. L'emoji reste le repli si l'image ne charge pas. */
  const ROLE_IMG = 'assets/img/roles/';
  const ROLES = [
    { v: 'client',     i: '🍔', img: ROLE_IMG + 'client.jpg',     t: 'Client',     d: 'Commander des repas et me faire livrer' },
    { v: 'restaurant', i: '🏪', img: ROLE_IMG + 'restaurant.jpg', t: 'Restaurant', d: 'Vendre mes plats sur la plateforme' },
    { v: 'driver',     i: '🛵', img: ROLE_IMG + 'driver.jpg',     t: 'Livreur',    d: 'Livrer des commandes et gagner de l’argent' }
  ];

  function roleIcon(r) {
    return r.img
      ? '<div class="ic has-img" style="background-image:url(' + U.escUrl(r.img) + ')"></div>'
      : '<div class="ic">' + r.i + '</div>';
  }

  /* Le nom de la marque passe en orange partout où il apparaît dans un titre,
     comme sur la maquette (« Bienvenue sur Talabi »). */
  function brandify(t) {
    const nom = TALABI_CONFIG.APP_NAME;
    const i = String(t).indexOf(nom);
    if (i < 0) return U.esc(t);
    return U.esc(t.slice(0, i)) + '<span class="accent">' + U.esc(nom) + '</span>' + U.esc(t.slice(i + nom.length));
  }

  /* Thème des pages de compte : fond blanc-orangé, formes organiques, titre et
     formulaire à gauche, livreur à scooter en haut à droite.
     Sous 900 px l'illustration disparaît : il n'y a plus la place. */
  function shell(title, subtitle, inner) {
    return '<div class="auth-page">' +
      '<span class="auth-blob a" aria-hidden="true"></span>' +
      '<span class="auth-blob b" aria-hidden="true"></span>' +
      '<span class="auth-blob c" aria-hidden="true"></span>' +
      '<div class="auth-in">' +
        '<div class="auth-head">' +
          '<div class="auth-headtext">' +
            '<div class="auth-brandrow">' +
              // « multiply » : le logo est sur fond blanc, il se fond dans le fond
              '<img src="assets/img/logo.jpg" alt="' + U.esc(TALABI_CONFIG.APP_NAME) + '" ' +
                'class="auth-logo">' +
              boutonInstaller() +
            '</div>' +
            '<div class="h1">' + brandify(title) + '</div>' +
            '<div class="sub" style="margin-top:8px">' + U.esc(subtitle) + '</div>' +
          '</div>' +
          '<img class="auth-rider" src="assets/img/bg/auth-rider.png" alt="" aria-hidden="true">' +
        '</div>' +
        '<div class="auth-col">' + inner + '</div>' +
      '</div>' +
    '</div>';
  }

  /* Bouton d'installation, posé à côté du logo.
     Le libellé dit la vérité selon le téléphone : sur Android il installe
     vraiment, sur iPhone il explique comment faire — Apple n'offre aucun
     moyen d'installer une page web autrement qu'à la main. Une fois
     l'application installée, le bouton n'a plus de raison d'être. */
  function boutonInstaller() {
    if (!w.Install || !Install.aProposer) return '';
    const ios = Install.plateforme === 'ios';
    return '<button class="btn-install" id="btnInstall" ' +
      'title="' + (ios ? 'Ajouter Talabi à votre écran d’accueil'
                       : 'Installer Talabi sur votre téléphone') + '">' +
      UI.icon(ios ? 'plus' : 'upload', 17) +
      '<span>' + (ios ? 'Ajouter à l’écran d’accueil' : 'Installer l’appli') + '</span>' +
    '</button>';
  }

  /* Le bouton doit réapparaître si le navigateur annonce l'installation
     APRÈS le premier affichage de la page — l'évènement arrive quand il veut. */
  function brancherInstall(view) {
    const b = view.querySelector('#btnInstall');
    if (b) b.onclick = () => Install.demander();
    if (!w.Install) return null;
    return Install.onChange(() => {
      const rangee = view.querySelector('.auth-brandrow');
      if (!rangee) return;
      const actuel = rangee.querySelector('#btnInstall');
      if (actuel) actuel.remove();
      rangee.insertAdjacentHTML('beforeend', boutonInstaller());
      const n = rangee.querySelector('#btnInstall');
      if (n) n.onclick = () => Install.demander();
    });
  }

  function afterLogin() {
    let target = null;
    try { target = sessionStorage.getItem('talabi.after_login'); sessionStorage.removeItem('talabi.after_login'); } catch (e) {}
    return target || Router.homeFor(Store.role);
  }

  /* ======================================================================
     CONNEXION
     ====================================================================== */
  Router.add('/login', async function (params, query, view) {
    if (Store.isLogged) return Router.go(Router.homeFor(Store.role), true);

    view.innerHTML = shell('Bienvenue sur ' + TALABI_CONFIG.APP_NAME,
      'Commandez vos repas préférés en quelques minutes.',
      '<div class="card card-p stack">' +
        '<button class="btn btn-google btn-block" id="gbtn">' + GOOGLE_ICON + ' Continuer avec Google</button>' +
        '<div class="row" style="gap:12px"><div style="flex:1;height:1px;background:var(--line)"></div>' +
          '<span class="tiny">ou</span><div style="flex:1;height:1px;background:var(--line)"></div></div>' +
        '<form id="f" class="stack" novalidate>' +
          '<div class="field"><label>Adresse email</label>' +
            '<input class="input" type="email" name="email" placeholder="exemple@gmail.com" autocomplete="email" required></div>' +
          '<div class="field"><label>Mot de passe</label>' +
            '<input class="input" type="password" name="password" placeholder="••••••••" autocomplete="current-password" required></div>' +
          '<div class="row-between"><a class="tiny" style="color:var(--brand);font-weight:650" href="#/forgot">Mot de passe oublié ?</a></div>' +
          '<button class="btn btn-primary btn-block btn-lg" type="submit">Se connecter</button>' +
        '</form>' +
        '<div class="center tiny">Pas encore de compte ? ' +
          '<a href="#/signup" style="color:var(--brand);font-weight:700">Créer un compte</a></div>' +
      '</div>');

    view.querySelector('#gbtn').onclick = async function () {
      UI.busy(this, true, 'Redirection…');
      try { await API.signInGoogle('client'); }
      catch (e) { UI.busy(this, false); UI.err(e.message); }
    };

    view.querySelector('#f').onsubmit = async function (e) {
      e.preventDefault();
      const btn = this.querySelector('[type=submit]');
      const d = UI.formData(this);
      if (!U.isEmail(d.email)) return UI.err('Adresse email invalide');
      if (!d.password) return UI.err('Saisissez votre mot de passe');
      UI.busy(btn, true, 'Connexion…');
      try {
        await API.signIn(d.email, d.password);
        await Store.refreshProfile();
        UI.ok('Bienvenue ' + (Store.profile.full_name || '') + ' !');
        Router.go(afterLogin(), true);
      } catch (err) {
        UI.busy(btn, false);
        UI.err(err.message);
      }
    };

    return brancherInstall(view);
  });

  /* ======================================================================
     INSCRIPTION
     ====================================================================== */
  Router.add('/signup', async function (params, query, view) {
    let role = ROLES.some(r => r.v === query.role) ? query.role : 'client';

    // Déjà connecté : on explique au lieu de renvoyer en silence vers l'accueil
    // (c'est ce qui donnait l'impression que « Ajouter mon restaurant » ne
    // faisait rien quand on était connecté en client).
    if (Store.isLogged) return alreadyLogged(view, role);

    view.innerHTML = shell('Créer un compte', 'Choisissez votre type de compte',
      '<div class="card card-p stack">' +

        '<div class="stack" style="gap:9px" id="roles">' +
          ROLES.map(r => '<div class="role-card" data-role="' + r.v + '">' +
            roleIcon(r) +
            '<div class="grow"><b>' + r.t + '</b><div class="tiny">' + U.esc(r.d) + '</div></div>' +
            '<div data-check style="color:var(--brand);font-weight:800"></div></div>').join('') +
        '</div>' +

        '<div id="roleNote"></div>' +

        '<button class="btn btn-google btn-block" id="gbtn">' + GOOGLE_ICON + ' S’inscrire avec Google</button>' +
        '<div class="row" style="gap:12px"><div style="flex:1;height:1px;background:var(--line)"></div>' +
          '<span class="tiny">ou avec un email</span><div style="flex:1;height:1px;background:var(--line)"></div></div>' +

        '<form id="f" class="stack" novalidate>' +
          '<div class="field"><label>Nom complet</label>' +
            '<input class="input" name="full_name" placeholder="Ex : Amine Belkacem" autocomplete="name" required></div>' +
          '<div class="field"><label>Adresse email</label>' +
            '<input class="input" type="email" name="email" placeholder="exemple@gmail.com" autocomplete="email" required></div>' +
          '<div class="field"><label>Numéro de téléphone</label>' +
            '<input class="input" name="phone" placeholder="0555 12 34 56" inputmode="tel" autocomplete="tel" required></div>' +
          Cmp.zoneSelect('zone_id', Store.zoneId, 'Mon quartier', true) +
          '<div class="field"><label>Mot de passe</label>' +
            '<input class="input" type="password" name="password" placeholder="6 caractères minimum" autocomplete="new-password" required></div>' +
          '<button class="btn btn-primary btn-block btn-lg" type="submit">Créer mon compte</button>' +
          '<div class="tiny center">En continuant vous acceptez les conditions d’utilisation de ' +
            U.esc(TALABI_CONFIG.APP_NAME) + '.</div>' +
        '</form>' +

        '<div class="center tiny">Déjà inscrit ? <a href="#/login" style="color:var(--brand);font-weight:700">Se connecter</a></div>' +
      '</div>');

    const notes = {
      restaurant: '<div class="banner banner-info">🏪 Aucun restaurant n’est mis en ligne automatiquement. ' +
        'Après l’inscription, complétez votre fiche : nous vérifions que l’établissement existe réellement, ' +
        'et <b>votre compte est validé sous 24 h</b>.</div>',
      driver:     '<div class="banner banner-warn">🛵 Votre compte livreur est vérifié par un administrateur ' +
        'avant de pouvoir accepter des courses. <b>Comptez 24 h.</b></div>'
    };

    function paint() {
      view.querySelectorAll('[data-role]').forEach(el => {
        const on = el.dataset.role === role;
        el.classList.toggle('on', on);
        el.querySelector('[data-check]').textContent = on ? '✓' : '';
      });
      view.querySelector('#roleNote').innerHTML = notes[role] || '';
    }
    view.querySelectorAll('[data-role]').forEach(el => el.onclick = () => { role = el.dataset.role; paint(); });
    paint();

    view.querySelector('#gbtn').onclick = async function () {
      UI.busy(this, true, 'Redirection…');
      try { await API.signInGoogle(role); }
      catch (e) { UI.busy(this, false); UI.err(e.message); }
    };

    view.querySelector('#f').onsubmit = async function (e) {
      e.preventDefault();
      const btn = this.querySelector('[type=submit]');
      const d = UI.formData(this);

      if (!d.full_name || d.full_name.length < 3) return UI.err('Indiquez votre nom complet');
      if (!U.isEmail(d.email)) return UI.err('Adresse email invalide');
      if (!U.isPhoneDZ(d.phone)) return UI.err('Numéro invalide', 'Format attendu : 05 / 06 / 07 xx xx xx xx');
      if (!d.zone_id) return UI.err('Choisissez votre zone');
      if ((d.password || '').length < 6) return UI.err('Mot de passe trop court', '6 caractères minimum');

      UI.busy(btn, true, 'Création…');
      try {
        d.role = role;
        const res = await API.signUp(d);
        if (res && res.needsConfirmation) {
          UI.busy(btn, false);
          return view.querySelector('.card').innerHTML =
            '<div class="center" style="padding:20px 0">' +
              '<div style="font-size:46px">📬</div>' +
              '<div class="h2" style="margin-top:10px">Vérifiez votre email</div>' +
              '<p class="sub" style="margin-top:8px">Nous avons envoyé un lien de confirmation à <b>' + U.esc(d.email) + '</b>. ' +
              'Cliquez dessus pour activer votre compte, puis connectez-vous.</p>' +
              '<a class="btn btn-primary" style="margin-top:16px" href="#/login">Aller à la connexion</a></div>';
        }
        await Store.refreshProfile();
        if (Store.zoneId !== d.zone_id) Store.setZone(d.zone_id);
        /* Un client entre tout de suite. Un restaurant ou un livreur doit
           savoir, avant d'aller plus loin, que rien n'est encore actif : une
           simple notification passerait inaperçue. */
        if (role === 'restaurant' || role === 'driver') {
          UI.busy(btn, false);
          return pendingScreen(view, role);
        }
        UI.ok('Compte créé !', 'Bienvenue sur ' + TALABI_CONFIG.APP_NAME);
        Router.go('/', true);
      } catch (err) {
        UI.busy(btn, false);
        UI.err(err.message);
      }
    };

    return brancherInstall(view);
  });

  /* ----------------------------------------------------------------------
     Écran de fin d'inscription pour un restaurant ou un livreur.
     Aucun compte professionnel n'est actif sans validation d'un administrateur.
     ---------------------------------------------------------------------- */
  function pendingScreen(view, role) {
    const resto = role === 'restaurant';
    const suite = resto ? '/r/profile' : '/d/profile';

    view.innerHTML = shell(
      'Compte créé — en attente de validation',
      resto ? 'Votre restaurant n’est pas encore visible des clients'
            : 'Vous ne pouvez pas encore accepter de courses',
      '<div class="card card-p stack">' +
        '<div class="banner banner-warn">⏳ <div><b>Validation sous 24 h.</b><br>' +
          (resto
            ? 'Nous vérifions que votre établissement existe réellement avant de le mettre en ligne. '
            : 'Un administrateur vérifie votre profil avant de vous ouvrir les courses. ') +
          'Vous recevrez une notification dès que c’est fait.</div></div>' +

        '<div class="h3">En attendant, préparez tout</div>' +
        '<ol class="stack" style="gap:8px;padding-left:18px;margin:0;font-size:14px">' +
          (resto
            ? '<li>Complétez votre fiche : logo, photo de couverture, adresse et position sur la carte.</li>' +
              '<li>Montez votre menu : plats, photos, prix, formats et suppléments.</li>' +
              '<li>Dès la validation, votre restaurant apparaît et les commandes arrivent.</li>'
            : '<li>Renseignez votre véhicule, votre quartier et votre téléphone.</li>' +
              '<li>Dès la validation, mettez-vous « disponible » pour voir les courses.</li>') +
        '</ol>' +

        '<a class="btn btn-primary btn-block btn-lg" href="#' + suite + '">' +
          (resto ? 'Compléter ma fiche restaurant' : 'Compléter mon profil livreur') + '</a>' +
        '<a class="btn btn-ghost btn-block" href="#/">Retour à l’accueil</a>' +
      '</div>');
  }

  /* ----------------------------------------------------------------------
     L'utilisateur est déjà connecté et clique sur « Ajouter mon restaurant »
     ou « Devenir livreur ». Un compte = un rôle : on lui montre la marche à
     suivre au lieu de le renvoyer sans explication.
     ---------------------------------------------------------------------- */
  function alreadyLogged(view, wanted) {
    const info = ROLES.find(r => r.v === wanted) || ROLES[0];
    const same = Store.role === wanted;
    const home = Router.homeFor(Store.role);

    view.innerHTML = shell(
      same ? 'Vous y êtes déjà' : info.t + ' — compte requis',
      same ? '' : 'Un compte Talabi correspond à un seul rôle',
      '<div class="card card-p stack">' +

        '<div class="role-card on">' + roleIcon(info) +
          '<div class="grow"><b>' + U.esc(info.t) + '</b>' +
          '<div class="tiny">' + U.esc(info.d) + '</div></div></div>' +

        (same
          ? '<p class="sub">Votre compte <b>' + U.esc(Store.profile.email || '') + '</b> est déjà un compte ' +
            U.esc(info.t.toLowerCase()) + '. Rendez-vous dans votre espace pour continuer.</p>' +
            '<a class="btn btn-primary btn-block btn-lg" href="#' + home + '">Ouvrir mon espace</a>'
          : '<p class="sub">Vous êtes connecté en tant que <b>' +
            U.esc(ROLES.find(r => r.v === Store.role) ? ROLES.find(r => r.v === Store.role).t : Store.role) +
            '</b> avec <b>' + U.esc(Store.profile.email || '') + '</b>. ' +
            'Pour devenir ' + U.esc(info.t.toLowerCase()) + ', créez un compte séparé avec une autre adresse email.</p>' +
            '<button class="btn btn-primary btn-block btn-lg" id="switch">' +
              'Se déconnecter et créer un compte ' + U.esc(info.t.toLowerCase()) + '</button>' +
            '<a class="btn btn-ghost btn-block" href="#' + home + '">Rester sur mon compte actuel</a>') +
      '</div>');

    const sw = view.querySelector('#switch');
    if (sw) sw.onclick = async function () {
      UI.busy(this, true, 'Déconnexion…');
      await API.signOut();
      Store.clearCart(true);
      await Store.refreshProfile();
      Router.go('/signup?role=' + wanted, true);
    };
  }

  /* ======================================================================
     MOT DE PASSE OUBLIÉ
     ====================================================================== */
  Router.add('/forgot', async function (params, query, view) {
    view.innerHTML = shell('Mot de passe oublié', 'Nous vous enverrons un lien de réinitialisation',
      '<div class="card card-p stack">' +
        '<form id="f" class="stack" novalidate>' +
          '<div class="field"><label>Adresse email</label>' +
            '<input class="input" type="email" name="email" placeholder="exemple@gmail.com" required></div>' +
          '<button class="btn btn-primary btn-block btn-lg" type="submit">Envoyer le lien</button>' +
        '</form>' +
        '<div class="center tiny"><a href="#/login" style="color:var(--brand);font-weight:700">Retour à la connexion</a></div>' +
      '</div>');

    view.querySelector('#f').onsubmit = async function (e) {
      e.preventDefault();
      const btn = this.querySelector('[type=submit]');
      const d = UI.formData(this);
      if (!U.isEmail(d.email)) return UI.err('Adresse email invalide');
      UI.busy(btn, true, 'Envoi…');
      try {
        await API.resetPassword(d.email);
        UI.busy(btn, false);
        UI.ok('Email envoyé', 'Consultez votre boîte de réception');
        view.querySelector('#f').reset();
      } catch (err) { UI.busy(btn, false); UI.err(err.message); }
    };
  });

  /* ======================================================================
     NOUVEAU MOT DE PASSE (retour du lien email Supabase)
     ====================================================================== */
  Router.add('/reset', async function (params, query, view) {
    view.innerHTML = shell('Nouveau mot de passe', 'Choisissez un mot de passe sûr',
      '<div class="card card-p stack">' +
        '<form id="f" class="stack" novalidate>' +
          '<div class="field"><label>Nouveau mot de passe</label>' +
            '<input class="input" type="password" name="password" placeholder="6 caractères minimum" required></div>' +
          '<div class="field"><label>Confirmer</label>' +
            '<input class="input" type="password" name="confirm" required></div>' +
          '<button class="btn btn-primary btn-block btn-lg" type="submit">Enregistrer</button>' +
        '</form></div>');

    view.querySelector('#f').onsubmit = async function (e) {
      e.preventDefault();
      const btn = this.querySelector('[type=submit]');
      const d = UI.formData(this);
      if ((d.password || '').length < 6) return UI.err('Mot de passe trop court');
      if (d.password !== d.confirm) return UI.err('Les deux mots de passe ne correspondent pas');
      UI.busy(btn, true);
      try {
        await API.updatePassword(d.password);
        UI.ok('Mot de passe modifié');
        Router.go('/login', true);
      } catch (err) { UI.busy(btn, false); UI.err(err.message); }
    };
  });

})(window);
