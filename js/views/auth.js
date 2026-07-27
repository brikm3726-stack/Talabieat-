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

  const ROLES = [
    { v: 'client',     i: '🍔', t: 'Client',     d: 'Commander des repas et me faire livrer' },
    { v: 'restaurant', i: '🏪', t: 'Restaurant', d: 'Vendre mes plats sur la plateforme' },
    { v: 'driver',     i: '🛵', t: 'Livreur',    d: 'Livrer des commandes et gagner de l’argent' }
  ];

  function shell(title, subtitle, inner) {
    return '<div class="wrap-sm page" style="max-width:460px">' +
      '<div class="center" style="margin:8px 0 22px">' +
        '<div class="brand-mark" style="width:52px;height:52px;font-size:25px;border-radius:17px;margin:0 auto 12px">🛵</div>' +
        '<div class="h1">' + U.esc(title) + '</div>' +
        '<div class="sub" style="margin-top:6px">' + U.esc(subtitle) + '</div>' +
      '</div>' + inner + '</div>';
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

    view.innerHTML = shell('Bon retour !', 'Connectez-vous pour continuer',
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
      '</div>' +
      (API.mode === 'demo' ? demoBox() : ''));

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

    bindDemoLogins(view);
  });

  /* ======================================================================
     INSCRIPTION
     ====================================================================== */
  Router.add('/signup', async function (params, query, view) {
    if (Store.isLogged) return Router.go(Router.homeFor(Store.role), true);

    let role = ROLES.some(r => r.v === query.role) ? query.role : 'client';

    view.innerHTML = shell('Créer un compte', 'Choisissez votre type de compte',
      '<div class="card card-p stack">' +

        '<div class="stack" style="gap:9px" id="roles">' +
          ROLES.map(r => '<div class="role-card" data-role="' + r.v + '">' +
            '<div class="ic">' + r.i + '</div>' +
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
      restaurant: '<div class="banner banner-info">🏪 Après l’inscription, complétez la fiche de votre restaurant. Elle sera visible par les clients une fois validée par notre équipe.</div>',
      driver:     '<div class="banner banner-warn">🛵 Votre compte livreur devra être validé par un administrateur avant de pouvoir accepter des courses.</div>'
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
        UI.ok('Compte créé !', 'Bienvenue sur ' + TALABI_CONFIG.APP_NAME);
        Router.go(role === 'restaurant' ? '/r/profile' : role === 'driver' ? '/d/profile' : '/', true);
      } catch (err) {
        UI.busy(btn, false);
        UI.err(err.message);
      }
    };
  });

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
      if (!API.updatePassword) return UI.err('Indisponible en mode démo');
      UI.busy(btn, true);
      try {
        await API.updatePassword(d.password);
        UI.ok('Mot de passe modifié');
        Router.go('/login', true);
      } catch (err) { UI.busy(btn, false); UI.err(err.message); }
    };
  });

  /* ======================================================================
     Aide au test — comptes de démonstration
     ====================================================================== */
  function demoBox() {
    return '<div class="card card-p" style="margin-top:14px;background:#FFFBF0;border-color:#FCE7B2">' +
      '<div class="row" style="gap:8px;margin-bottom:10px"><span>🧪</span>' +
      '<b style="font-size:14px">Mode démo — comptes de test</b></div>' +
      '<div class="grid grid-2" style="gap:8px">' +
        demoBtn('client@talabi.dz', '🍔 Client') +
        demoBtn('resto@talabi.dz', '🏪 Restaurant') +
        demoBtn('livreur@talabi.dz', '🛵 Livreur') +
        demoBtn('admin@talabi.dz', '⚙️ Admin') +
      '</div>' +
      '<div class="tiny" style="margin-top:10px">Mot de passe commun : <b>123456</b>. ' +
      'Les données sont stockées dans ce navigateur uniquement.</div></div>';
  }

  function demoBtn(email, label) {
    return '<button class="btn btn-ghost btn-sm" data-demo="' + email + '">' + label + '</button>';
  }

  function bindDemoLogins(view) {
    view.querySelectorAll('[data-demo]').forEach(b => b.onclick = async function () {
      UI.busy(this, true);
      try {
        await API.signIn(this.dataset.demo, '123456');
        await Store.refreshProfile();
        UI.ok('Connecté en tant que ' + Store.profile.full_name);
        Router.go(Router.homeFor(Store.role), true);
      } catch (e) { UI.busy(this, false); UI.err(e.message); }
    });
  }
})(window);
