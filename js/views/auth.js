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
  const ROLE_IMG = 'assets/img/roles/';   // passé à U.asset() au moment de l'affichage
  const ROLES = [
    { v: 'client',     i: '🍔', img: ROLE_IMG + 'client.jpg',     t: 'Client',     d: 'Commander des repas et me faire livrer' },
    { v: 'driver',     i: '🛵', img: ROLE_IMG + 'driver.jpg',     t: 'Livreur',    d: 'Livrer des commandes et gagner de l’argent' }
  ];

  function roleIcon(r) {
    return r.img
      ? '<div class="ic has-img" style="background-image:url(' + U.escUrl(r.img) + ')"></div>'
      : '<div class="ic">' + r.i + '</div>';
  }

  const MOT_ROLE = { client: 'client', restaurant: 'restaurant', driver: 'livreur', admin: 'administrateur' };
  function roleMot(r) { return MOT_ROLE[r] || r; }

  /* Dans un espace professionnel, celui qui n'a rien à y faire doit repartir
     avec une adresse en main, pas avec une porte fermée. */
  function liensVersLesAutresApplications() {
    const autres = ['client', 'driver']
      .filter(id => !App.est(id))
      .map(id => '<a class="tiny" style="color:var(--muted);font-weight:650" ' +
                 'href="' + App.lien(id) + '">' + U.esc(App.def(id).nom) + ' →</a>');
    if (!autres.length) return '';
    return '<div class="center stack" style="margin-top:14px;gap:6px">' +
      '<div class="tiny">Vous cherchez plutôt :</div>' + autres.join('') + '</div>';
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
     Sous 900 px l'illustration disparaît : il n'y a plus la place.

     `nuit` — variante sombre, maquette « inscription page ». La STRUCTURE est
     exactement la même : la maquette montre le quartier et « Connexion » dans
     la barre du haut, puis le logo et « Ajouter à l'écran d'accueil », puis le
     titre, puis la carte du formulaire. Tout cela existait déjà. Ce qui change
     est la peau, et le scooter qui reste visible au téléphone au lieu de
     disparaître : c'est lui qui fait l'écran.
     Un seul écran la demande pour l'instant (l'inscription cliente), donc un
     paramètre plutôt qu'un test sur l'application : les autres pages de compte
     — mot de passe oublié, saisie du code, espaces professionnels — restent
     claires tant qu'elles n'ont pas été reprises une par une. */
  function shell(title, subtitle, inner, nuit) {

    /* LE MOT-MARQUE EN TEXTE SUR LE THÈME SOMBRE, PAS LE LOGO.
       `assets/img/logo.jpg` est un JPEG sur fond blanc. Le thème clair le
       fond dans la page avec `mix-blend-mode:multiply` — mais multiplier par
       du noir donne du noir : sur fond sombre, le logo disparaîtrait
       purement et simplement. Le mot-marque reconstruit en texte règle les
       deux problèmes d'un coup : rien à fondre, et net à toute densité. */
    const marque = nuit
      ? '<span class="auth-mot" aria-label="' + U.esc(TALABI_CONFIG.APP_NAME) + '">' +
          '<span class="arc">' + ENT_ARC + '</span>' +
          '<span class="mot">tala<i>bi</i></span></span>'
      : '<img src="' + U.asset('assets/img/logo.jpg') + '" alt="' +
          U.esc(TALABI_CONFIG.APP_NAME) + '" class="auth-logo">';

    return '<div class="auth-page' + (nuit ? ' auth-nuit' : '') + '">' +
      /* Les trois taches floues du thème clair coûtent trois `filter:blur()`
         sur de grandes surfaces — c'est ce qui se paie en images par seconde
         sur un téléphone d'entrée de gamme. Le thème sombre s'en passe : sa
         lueur est un dégradé radial, dessiné une fois, gratuit ensuite. */
      (nuit ? '' :
        '<span class="auth-blob a" aria-hidden="true"></span>' +
        '<span class="auth-blob b" aria-hidden="true"></span>' +
        '<span class="auth-blob c" aria-hidden="true"></span>') +
      '<div class="auth-in">' +
        '<div class="auth-head">' +
          '<div class="auth-headtext">' +
            '<div class="auth-brandrow">' + marque + boutonInstaller() + '</div>' +
            '<div class="h1">' + brandify(title) + '</div>' +
            '<div class="sub" style="margin-top:8px">' + U.esc(subtitle) + '</div>' +
          '</div>' +
          /* Sur le thème sombre le scooter est un décor de coin, posé en CSS
             sur la page elle-même (`.auth-nuit::before`) : un décor n'a pas à
             occuper une colonne dans la mise en page, et un pseudo-élément ne
             peut décaler aucun texte. */
          (nuit ? '' :
            '<img class="auth-rider" src="' + U.asset('assets/img/bg/auth-rider.png') + '" ' +
              'decoding="async" alt="" aria-hidden="true">') +
        '</div>' +
        '<div class="auth-col">' + inner + '</div>' +
      '</div>' +
    '</div>';
  }

  /* Un champ avec son pictogramme à gauche, comme sur la maquette.
     `.input-ic` existe déjà dans l'application (écran Compte) : on le réemploie
     au lieu d'en créer un second qui aurait divergé. */
  function champIcone(label, icone, html) {
    return '<div class="field"><label>' + U.esc(label) + '</label>' +
      '<div class="input-ic"><span>' + UI.icon(icone, 17) + '</span>' + html + '</div></div>';
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
  /* La soumission du formulaire email, partagée par les deux écrans de
     connexion — la porte sombre du client et l'écran clair des espaces
     professionnels. Écrite une fois : deux copies auraient divergé au premier
     message d'erreur modifié.

     `view` est passé en paramètre parce que l'écran de saisie du code en a
     besoin pour se substituer à l'écran courant. */
  function connexionEmailPour(view) {
    return async function (e) {
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
        // compte créé mais jamais confirmé : on l'amène au bon écran au lieu
        // de lui répéter une erreur sans issue
        if (/pas encore confirmé/i.test(err.message))
          return ecranCode(view, { email: d.email }, 'client');
        // un compte créé par Google n'a pas de mot de passe : le dire, plutôt
        // que de laisser l'utilisateur réessayer indéfiniment
        if (/incorrect/i.test(err.message))
          return UI.err('Email ou mot de passe incorrect',
            'Si vous vous êtes inscrit avec Google, utilisez le bouton Google ci-dessus.');
        UI.err(err.message);
      }
    };
  }

  /* ======================================================================
     LA PORTE D'ENTRÉE — écran sombre, maquette « sinscrire »
     ----------------------------------------------------------------------
     Le premier écran d'un visiteur sans compte. Un carrefour, pas un
     formulaire : le mot-marque, un scooter de nuit, et trois chemins.

     TOUT EST EN TEXTE ET EN CSS, VOLONTAIREMENT.
     La maquette fournie fait 852 × 1846, soit du 1×. La coller en image de
     fond l'aurait fait agrandir d'un facteur 1,4 sur un écran de 1179 px, et
     tout aurait été mou — exactement l'inverse du but. Reconstruit, le même
     écran est net à n'importe quelle densité pour quelques kilo-octets. Seul
     le scooter est une photo, parce qu'une photo ne se dessine pas en CSS.

     Le mot-marque aussi est du texte : `assets/img/logo.jpg` est un JPEG sur
     fond blanc, il aurait posé un rectangle blanc au milieu du noir.

     LE FORMULAIRE N'APPARAÎT QUE SI ON LE DEMANDE.
     Trois champs affichés d'emblée sur un écran d'accueil, c'est un péage.
     « Se connecter » les révèle en place — mêmes champs, mêmes contrôles,
     même code de soumission qu'avant.
     ====================================================================== */
  /* `currentColor` et non une teinte figée : l'arc suit `--brand`, qui n'a pas
     la même valeur sur le thème clair (#FF4D2D) et sur le thème sombre
     (#FF6500). Écrit en dur, il jurait d'un ton avec le mot qu'il coiffe. */
  const ENT_ARC =
    '<svg viewBox="0 0 132 26" aria-hidden="true">' +
      '<path d="M6 24C6 24 24 4 66 4s60 20 60 20" fill="none" ' +
        'stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg>';

  const ENT_PERSONNE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="12" cy="7" r="4"/></svg>';

  const ENT_ENTRER =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>' +
      '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>';

  function porteDentree(view) {
    let voie = 'choix';          // choix | email

    function paint() {
      view.innerHTML = '<div class="ent"><div class="ent-in">' +

        '<span class="ent-mark">' + ENT_ARC + '</span>' +
        '<div class="ent-word">tala<i>bi</i></div>' +

        '<h1 class="ent-t">' + (voie === 'choix' ? 'Créer un compte' : 'Se connecter') + '</h1>' +
        '<p class="ent-s">' + (voie === 'choix'
          ? 'Rejoignez Talabi et faites-vous livrer vos plats préférés'
          : 'Entrez l’email et le mot de passe de votre compte') + '</p>' +

        (voie === 'choix'
          ? '<div class="ent-art">' +
              '<img src="' + U.asset('assets/img/bg/scooter-nuit.jpg') + '" ' +
                'width="1120" height="1500" decoding="async" alt="" aria-hidden="true">' +
            '</div>' +

            '<div class="ent-actions">' +
              '<a class="ent-b ent-b1" href="#/signup">' + ENT_PERSONNE + ' S’inscrire</a>' +
              '<button class="ent-b ent-b2" id="versEmail">' + ENT_ENTRER + ' Se connecter</button>' +
              '<div class="ent-ou">ou</div>' +
              '<button class="ent-b ent-b3" id="gbtn">' + GOOGLE_ICON + ' Continuer avec Google</button>' +
              (App.publique
                ? '<button class="ent-retour" id="sansCompte">Voir les restaurants sans compte →</button>'
                : '') +
            '</div>'

          : '<div class="ent-actions">' +
              '<form id="f" class="ent-form stack" novalidate>' +
                '<div class="field"><label>Adresse email</label>' +
                  '<input class="input" type="email" name="email" placeholder="exemple@gmail.com" ' +
                    'autocomplete="email" required></div>' +
                '<div class="field"><label>Mot de passe</label>' +
                  '<input class="input" type="password" name="password" placeholder="••••••••" ' +
                    'autocomplete="current-password" required></div>' +
                '<div style="margin:-2px 0 4px"><a class="ent-lien" style="font-size:13.5px" ' +
                  'href="#/forgot">Mot de passe oublié ?</a></div>' +
                '<button class="ent-b ent-b1" type="submit">' + ENT_ENTRER + ' Se connecter</button>' +
              '</form>' +
              '<div class="ent-ou">ou</div>' +
              '<button class="ent-b ent-b3" id="gbtn">' + GOOGLE_ICON + ' Continuer avec Google</button>' +
              '<button class="ent-retour" id="retour">← Retour</button>' +
            '</div>') +

      '</div></div>';

      const ve = view.querySelector('#versEmail');
      if (ve) ve.onclick = () => { voie = 'email'; paint(); };
      const re = view.querySelector('#retour');
      if (re) re.onclick = () => { voie = 'choix'; paint(); };
      const sc = view.querySelector('#sansCompte');
      if (sc) sc.onclick = () => Router.go('/');

      view.querySelector('#gbtn').onclick = async function () {
        UI.busy(this, true, 'Redirection…');
        try { await API.signInGoogle(App.role); }
        catch (e) { UI.busy(this, false); UI.err(e.message); }
      };

      const f = view.querySelector('#f');
      if (f) f.onsubmit = connexionEmailPour(view);
    }

    paint();
  }

  Router.add('/login', async function (params, query, view) {
    if (Store.isLogged) return Router.go(Router.homeFor(Store.role), true);

    /* L'application cliente reçoit la porte d'entrée sombre. Les espaces
       professionnels gardent l'écran clair : leurs utilisateurs y arrivent avec
       un compte déjà créé par l'administration, ils n'ont pas de carrefour à
       traverser — et un livreur doit lire son écran en plein soleil. */
    if (App.publique) {
      porteDentree(view);
      /* La classe peint le noir jusqu'aux bords et masque les deux barres :
         cet écran est une porte, pas une page de l'application. Elle est
         retirée au départ de la route, sinon le reste de l'application
         resterait sur fond noir sans ses barres. */
      document.body.classList.add('ent-open');
      /* Le mode nuit en plus, pour deux raisons visibles à l'œil nu : la barre
         d'état du téléphone passe au noir avec l'écran, et l'orange devient
         celui des deux autres écrans sombres (#FF6500). Sans lui, cet écran
         restait en #FF4D2D et le changement de ton se voyait au passage sur
         « S'inscrire », juste à côté. */
      UI.nuit('entree');
      const off = brancherInstall(view);
      return () => {
        document.body.classList.remove('ent-open');
        UI.nuit('');
        if (off) off();
      };
    }

    view.innerHTML = shell(App.titre, App.sousTitre,
      '<div class="card card-p stack">' +
        '<button class="btn btn-google btn-block btn-lg" id="gbtn">' + GOOGLE_ICON + ' Continuer avec Google</button>' +

        '<div class="row" style="gap:12px"><div style="flex:1;height:1px;background:var(--line)"></div>' +
          '<span class="tiny">ou avec votre email</span><div style="flex:1;height:1px;background:var(--line)"></div></div>' +

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

      /* Regarder la carte ne demande pas de compte : celui-ci ne devient
         nécessaire qu'au moment de commander. Fermer la porte d'entrée à un
         visiteur qui voulait juste voir les prix serait absurde.
         Dans les espaces professionnels, il n'y a rien à regarder sans compte. */
      (App.publique
        ? '<div class="center" style="margin-top:14px">' +
            '<a class="tiny" style="color:var(--muted);font-weight:650" href="#/">' +
              'Voir les restaurants sans compte →</a></div>'
        : liensVersLesAutresApplications()));

    view.querySelector('#gbtn').onclick = async function () {
      UI.busy(this, true, 'Redirection…');
      // le rôle créé dépend de la porte d'entrée : Talabi Livreur crée un
      // livreur, jamais un client
      try { await API.signInGoogle(App.role); }
      catch (e) { UI.busy(this, false); UI.err(e.message); }
    };

    view.querySelector('#f').onsubmit = connexionEmailPour(view);

    return brancherInstall(view);
  });

  /* ======================================================================
     INSCRIPTION
     ====================================================================== */
  Router.add('/signup', async function (params, query, view) {
    /* Plus aucun choix de rôle : c'est la porte d'entrée qui décide. Chaque
       métier a son application, et lui demander ce qu'il est alors qu'il vient
       d'ouvrir Talabi Livreur serait une question sans objet. */
    const role = App.role;

    // Déjà connecté : on explique au lieu de renvoyer en silence vers l'accueil
    // (c'est ce qui donnait l'impression que « Ajouter mon restaurant » ne
    // faisait rien quand on était connecté en client).
    if (Store.isLogged) return alreadyLogged(view, role);

    /* L'inscription cliente passe au thème sombre (maquette « inscription
       page »). Les espaces professionnels gardent l'écran clair : un livreur
       lit son téléphone en plein soleil. */
    /* Le sombre n'est plus imposé : il suit la préférence de l'utilisateur
       (interrupteur dans Réglages). Sans ce test, l'inscription resterait
       noire alors que tout le reste serait passé au clair. */
    const nuit = App.est('client') && UI.sombreVoulu();
    if (nuit) UI.nuit('inscription');

    view.innerHTML = shell(
      'Créer un compte ' + roleMot(role),
      App.est('client') ? 'Commandez vos repas préférés en quelques minutes.' : App.sousTitre,
      '<div class="card card-p stack">' +

        '<div id="roleNote"></div>' +

        '<button class="btn btn-google btn-block btn-lg" id="gbtn">' + GOOGLE_ICON + ' Continuer avec Google</button>' +
        '<div class="tiny center">Le plus rapide : rien à remplir, ' +
          'juste votre téléphone et votre quartier ensuite.</div>' +

        '<div class="auth-ou"><span>ou avec un email</span></div>' +

        '<form id="f" class="stack" novalidate>' +
          champIcone('Nom complet', 'user',
            '<input class="input" name="full_name" placeholder="Ex : Amine Belkacem" ' +
              'autocomplete="name" required>') +
          champIcone('Adresse email', 'mail',
            '<input class="input" type="email" name="email" placeholder="exemple@gmail.com" ' +
              'autocomplete="email" required>') +
          champIcone('Numéro de téléphone', 'phone',
            '<input class="input" name="phone" placeholder="0555 12 34 56" ' +
              'inputmode="tel" autocomplete="tel" required>') +
          /* Le quartier n'est pas sur la maquette, et il reste : c'est lui qui
             décide quels restaurants livrent chez vous. Un écran plus court au
             prix d'une adresse inconnue n'est pas un gain. */
          Cmp.zoneSelect('zone_id', Store.zoneId, 'Mon quartier', true, 'pin') +
          champIcone('Mot de passe', 'lock',
            '<input class="input" type="password" name="password" id="pw" ' +
              'placeholder="6 caractères minimum" autocomplete="new-password" required>' +
            /* Sur un téléphone, on tape son mot de passe à l'aveugle avec un
               clavier qui corrige tout seul : sans ce bouton, la seule façon
               de vérifier ce qu'on a écrit est de se tromper. */
            '<button type="button" class="champ-oeil" id="voirPw" ' +
              'aria-label="Afficher le mot de passe" ' +
              'title="Afficher le mot de passe">' + UI.icon('eye', 19) + '</button>') +
          '<button class="btn btn-primary btn-block btn-lg" type="submit">S’inscrire</button>' +
        '</form>' +

        '<div class="tiny center">En continuant vous acceptez les conditions d’utilisation de ' +
          U.esc(TALABI_CONFIG.APP_NAME) + '.</div>' +

        '<div class="center tiny">Déjà inscrit ? <a href="#/login" style="color:var(--brand);font-weight:700">Se connecter</a></div>' +
      '</div>', nuit);

    const notes = {
      driver:     '<div class="banner banner-warn">🛵 Votre compte livreur est vérifié par un administrateur ' +
        'avant de pouvoir accepter des courses. <b>Comptez 24 h.</b></div>'
    };

    // avertissement propre au métier : un professionnel doit savoir avant de
    // s'inscrire que son compte passera par une validation
    view.querySelector('#roleNote').innerHTML = notes[role] || '';

    view.querySelector('#gbtn').onclick = async function () {
      UI.busy(this, true, 'Redirection…');
      try { await API.signInGoogle(role); }
      catch (e) { UI.busy(this, false); UI.err(e.message); }
    };

    /* Afficher / masquer le mot de passe. Le libellé du bouton change avec
       l'état : un lecteur d'écran qui annonce toujours « Afficher » sur un mot
       de passe déjà affiché dit le contraire de la vérité. */
    const oeil = view.querySelector('#voirPw');
    const pw = view.querySelector('#pw');
    if (oeil && pw) oeil.onclick = () => {
      const vu = pw.type === 'text';
      pw.type = vu ? 'password' : 'text';
      oeil.classList.toggle('on', !vu);
      const t = vu ? 'Afficher le mot de passe' : 'Masquer le mot de passe';
      oeil.setAttribute('aria-label', t);
      oeil.setAttribute('title', t);
    };

    view.querySelector('#f').onsubmit = async function (e) {
      e.preventDefault();
      const btn = this.querySelector('[type=submit]');
      const d = UI.formData(this);

      if (!d.full_name || d.full_name.length < 3) return UI.err('Indiquez votre nom complet');
      if (!U.isEmail(d.email)) return UI.err('Adresse email invalide');
      if (!U.isPhoneDZ(d.phone)) return UI.err('Numéro invalide', 'Format attendu : 05 / 06 / 07 xx xx xx xx');
      if (!d.zone_id) return UI.err('Choisissez votre quartier');
      if ((d.password || '').length < 6) return UI.err('Mot de passe trop court', '6 caractères minimum');

      UI.busy(btn, true, 'Création…');
      try {
        d.role = role;
        const res = await API.signUp(d);

        // confirmation activée : le compte n'est pas ouvert tant que le code
        // reçu par email n'est pas saisi
        if (res && res.needsConfirmation) {
          UI.busy(btn, false);
          return ecranCode(view, d, role);
        }

        await Store.refreshProfile();
        if (Store.zoneId !== d.zone_id) Store.setZone(d.zone_id);

        /* Un client entre tout de suite. Un restaurant ou un livreur doit
           savoir, avant d'aller plus loin, que rien n'est encore actif : une
           simple notification passerait inaperçue. */
        if (role === 'driver') {
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

    const off = brancherInstall(view);
    return () => { UI.nuit(''); if (off) off(); };
  });

  /* L'ancienne page de secours a fusionné avec /login : le formulaire email +
     mot de passe y est revenu. On garde l'adresse pour ne pas casser un lien
     déjà envoyé à quelqu'un. */
  Router.add('/motdepasse', async function () { return Router.go('/login', true); });

  /* ======================================================================
     SORTIE DE SECOURS

     Une déconnexion qui dépend d'un bouton dépend aussi de l'écran qui le
     porte, du menu qui y mène, et de la modale qui la confirme. Cette adresse
     ne dépend de rien : on la tape, elle déconnecte, sans question.
     ====================================================================== */
  Router.add('/logout', async function (params, query, view) {
    view.innerHTML = '<div class="wrap-sm page center" style="padding-top:60px">' +
      '<div class="spinner dark" style="margin:0 auto"></div>' +
      '<p class="sub" style="margin-top:14px">Déconnexion…</p></div>';
    try { await API.signOut(); Store.clearCart(true); await Store.refreshProfile(); } catch (e) {}
    Router.go('/login', true);
  });

  /* ======================================================================
     BIENVENUE — ce que Google ne nous donne pas

     Google fournit le nom et l'adresse email, rien d'autre. Or on ne peut ni
     livrer ni appeler quelqu'un sans son téléphone et son quartier. Cette page
     réclame donc ces deux informations, une seule fois, juste après la
     première connexion — et le routeur y ramène tant qu'elles manquent.
     ====================================================================== */
  Router.add('/bienvenue', async function (params, query, view) {
    if (!Store.isLogged) return Router.go('/login', true);

    const p = Store.profile || {};
    const pro = p.role === 'driver';

    view.innerHTML = shell('Bienvenue ' + (p.full_name || '') + ' !',
      'Encore deux informations et c’est terminé',
      '<div class="card card-p stack">' +
        '<div class="banner banner-info">' +
          (p.role === 'driver'
            ? '🛵 Votre quartier détermine les courses que vous verrez.'
            : '🏠 Votre téléphone sert au livreur pour vous joindre à l’arrivée.') +
        '</div>' +

        '<form id="f" class="stack" novalidate>' +
          '<div class="field"><label>Nom complet</label>' +
            '<input class="input" name="full_name" value="' + U.esc(p.full_name || '') + '" ' +
              'placeholder="Ex : Amine Belkacem" autocomplete="name" required></div>' +
          '<div class="field"><label>Numéro de téléphone</label>' +
            '<input class="input" name="phone" value="' + U.esc(p.phone || '') + '" ' +
              'placeholder="0555 12 34 56" inputmode="tel" autocomplete="tel" required></div>' +
          Cmp.zoneSelect('zone_id', p.zone_id || Store.zoneId, 'Mon quartier', true) +
          '<button class="btn btn-primary btn-block btn-lg" type="submit">Terminer</button>' +
        '</form>' +

        '<div class="tiny center">Connecté avec <b>' + U.esc(p.email || '') + '</b> — ' +
          '<a href="#" id="out" style="color:var(--brand);font-weight:650">changer de compte</a></div>' +
      '</div>');

    view.querySelector('#out').onclick = async function (e) {
      e.preventDefault();
      await API.signOut();
      Router.go('/login', true);
    };

    view.querySelector('#f').onsubmit = async function (e) {
      e.preventDefault();
      const btn = this.querySelector('[type=submit]');
      const d = UI.formData(this);

      if (!d.full_name || d.full_name.length < 3) return UI.err('Indiquez votre nom complet');
      if (!U.isPhoneDZ(d.phone)) return UI.err('Numéro invalide', 'Format attendu : 05 / 06 / 07 xx xx xx xx');
      if (!d.zone_id) return UI.err('Choisissez votre quartier');

      UI.busy(btn, true, 'Enregistrement…');
      try {
        await API.updateProfile({ full_name: d.full_name, phone: d.phone, zone_id: d.zone_id });
        await Store.refreshProfile();
        if (Store.zoneId !== d.zone_id) Store.setZone(d.zone_id);

        /* Un client entre tout de suite. Un restaurant ou un livreur doit
           savoir, avant d'aller plus loin, que rien n'est encore actif : une
           simple notification passerait inaperçue. */
        if (pro) { UI.busy(btn, false); return pendingScreen(view, p.role); }

        UI.ok('Compte prêt !', 'Bienvenue sur ' + TALABI_CONFIG.APP_NAME);
        Router.go(afterLogin(), true);
      } catch (err) {
        UI.busy(btn, false);
        UI.err(err.message);
      }
    };
  });

  /* ======================================================================
     MAUVAISE PORTE

     Les quatre applications partagent la même session : ouvrir Talabi Resto
     avec un compte livreur est vite arrivé. Plutôt qu'une page vide ou un
     « accès refusé », on nomme le problème et on donne l'adresse de la bonne
     application, en un bouton.
     ====================================================================== */
  Router.add('/espace', async function (params, query, view) {
    if (!Store.isLogged) return Router.go('/login', true);

    const bonne = App.pourRole(Store.role);
    const d = App.def(bonne);

    view.innerHTML = shell('Ce n’est pas votre espace',
      'Votre compte est un compte ' + roleMot(Store.role),
      '<div class="card card-p stack">' +
        '<div class="banner banner-info">' +
          'Vous êtes connecté avec <b>' + U.esc(Store.profile && Store.profile.email || '') + '</b>, ' +
          'un compte <b>' + roleMot(Store.role) + '</b>. Cette application est réservée ' +
          'aux comptes ' + roleMot(App.role) + 's.' +
        '</div>' +
        '<a class="btn btn-primary btn-block btn-lg" href="' + App.lien(bonne, Router.homeFor(Store.role)) + '">' +
          'Ouvrir ' + U.esc(d.nom) + '</a>' +
        '<button class="btn btn-ghost btn-block" id="out">Me déconnecter</button>' +
        '<div class="tiny center">Chaque compte a un seul rôle. Pour être à la fois ' +
          'client et livreur, il faut deux comptes, avec deux adresses email.</div>' +
      '</div>');

    view.querySelector('#out').onclick = async function () {
      await API.signOut();
      await Store.refreshProfile();
      Router.go('/login', true);
    };
  });

  /* Deux gardes, dans l'ordre où elles comptent :
     1. le rôle du compte correspond-il à l'application ouverte ?
     2. le profil est-il complet (téléphone et quartier) ?
     Un administrateur est dispensé de la seconde : il ne commande pas et ne se
     fait pas livrer. */
  Router.beforeEach = function (path) {
    if (!Store.isLogged || !Store.profile) return null;

    if (Store.role !== App.role && path !== '/espace') return '/espace';

    if (path === '/bienvenue' || path === '/espace' || Store.role === 'admin') return null;
    if (Store.profile.phone && Store.profile.zone_id) return null;
    return '/bienvenue';
  };

  /* ----------------------------------------------------------------------
     CONFIRMATION DE L'EMAIL PAR CODE À 6 CHIFFRES

     Un lien de confirmation oblige à quitter l'application, à ouvrir sa boîte
     mail, puis à revenir — et sur téléphone le lien s'ouvre souvent dans un
     autre navigateur, où la session ne suit pas. Le code se recopie sans
     quitter la page : l'inscription se termine là où elle a commencé.
     ---------------------------------------------------------------------- */
  function ecranCode(view, d, role) {
    /* Cet écran remplace le contenu SANS changer de route : le nettoyage de
       l'inscription ne se déclenche donc pas, et le thème sombre resterait
       posé sur une page claire — du texte blanc sur du blanc. */
    UI.nuit('');
    view.innerHTML = shell('Confirmez votre email',
      'Le code vient de partir par email',
      '<div class="card card-p stack">' +
        '<div class="center" style="padding:6px 0 2px">' +
          '<div style="font-size:44px">📬</div>' +
          '<p class="sub" style="margin-top:10px">Code envoyé à <b>' + U.esc(d.email) + '</b>.<br>' +
            'Il est valable 1 heure. Pensez à regarder dans les spams.</p>' +
        '</div>' +

        '<form id="cf" class="stack" novalidate>' +
          '<div class="field"><label>Code de confirmation</label>' +
            /* La longueur du code se règle dans Supabase (6 à 10 chiffres) :
               on ne la fige pas ici. Un champ limité à 6 tronquait un code de
               8 et vérifiait un nombre qui n'existait pas. */
            '<input class="input input-code" name="code" inputmode="numeric" autocomplete="one-time-code" ' +
              'maxlength="10" placeholder="— — — — — —" required></div>' +
          '<button class="btn btn-primary btn-block btn-lg" type="submit">Confirmer mon compte</button>' +
        '</form>' +

        '<button class="btn btn-ghost btn-block" id="again">Je n’ai rien reçu — renvoyer un code</button>' +
        '<div class="center tiny">Mauvaise adresse ? <a href="#/signup" style="color:var(--brand);font-weight:700">Recommencer</a></div>' +
      '</div>');

    const champ = view.querySelector('[name=code]');
    champ.focus();

    /* Le champ n'accepte que des chiffres, et ne part tout seul que sur un
       COLLAGE — reconnaissable au bond de plusieurs caractères d'un coup.
       Sur une frappe au clavier on attend le bouton : partir dès qu'un seuil
       est atteint reviendrait à vérifier un code encore incomplet. */
    let avant = 0;
    champ.oninput = function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 10);
      const saut = this.value.length - avant;
      avant = this.value.length;
      if (saut >= 4 && this.value.length >= 4) view.querySelector('#cf').requestSubmit();
    };

    view.querySelector('#cf').onsubmit = async function (e) {
      e.preventDefault();
      const btn = this.querySelector('[type=submit]');
      const code = champ.value;
      if (code.length < 4) return UI.err('Saisissez le code reçu par email');

      UI.busy(btn, true, 'Vérification…');
      try {
        await API.verifySignupCode(d.email, code, d);
        await Store.refreshProfile();
        if (d.zone_id && Store.zoneId !== d.zone_id) Store.setZone(d.zone_id);
        if (role === 'driver') return pendingScreen(view, role);
        UI.ok('Compte confirmé !', 'Bienvenue sur ' + TALABI_CONFIG.APP_NAME);
        Router.go('/', true);
      } catch (err) {
        UI.busy(btn, false);
        champ.select();
        UI.err(err.message);
      }
    };

    view.querySelector('#again').onclick = async function () {
      UI.busy(this, true, 'Envoi…');
      const btn = this;
      try {
        await API.resendSignupCode(d.email);
        UI.ok('Nouveau code envoyé', 'Vérifiez votre boîte mail, et les spams.');
      } catch (err) { UI.err(err.message); }
      UI.busy(btn, false);
    };
  }

  /* ----------------------------------------------------------------------
     Écran de fin d'inscription pour un livreur.
     Aucun compte livreur n'est actif sans validation d'un administrateur.
     ---------------------------------------------------------------------- */
  function pendingScreen(view, role) {
    // même raison que dans ecranCode : écran clair, sans changement de route
    UI.nuit('');
    view.innerHTML = shell(
      'Compte créé — en attente de validation',
      'Vous ne pouvez pas encore accepter de courses',
      '<div class="card card-p stack">' +
        '<div class="banner banner-warn">⏳ <div><b>Validation sous 24 h.</b><br>' +
          'Un administrateur vérifie votre profil avant de vous ouvrir les courses. ' +
          'Vous recevrez une notification dès que c’est fait.</div></div>' +

        '<div class="h3">En attendant, préparez tout</div>' +
        '<ol class="stack" style="gap:8px;padding-left:18px;margin:0;font-size:14px">' +
          '<li>Renseignez votre véhicule, votre quartier et votre téléphone.</li>' +
          '<li>Rechargez votre portefeuille : la commission de chaque course y est prélevée.</li>' +
          '<li>Dès la validation, mettez-vous « disponible » pour voir les courses.</li>' +
        '</ol>' +

        '<a class="btn btn-primary btn-block btn-lg" href="#/d/profile">Compléter mon profil livreur</a>' +
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
      // le rôle ne se demande plus dans l'adresse : c'est l'application qui
      // l'impose, et on est déjà dans la bonne
      Router.go('/signup', true);
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
    /* Sans session ouverte par le lien reçu par email, ce formulaire ne peut
       rien enregistrer. Le dire tout de suite vaut mieux que de laisser
       remplir deux champs pour finir sur « Auth session missing ». */
    if (!Store.isLogged) {
      view.innerHTML = shell('Lien expiré', 'Ce lien de réinitialisation n’est plus valable',
        '<div class="card card-p stack">' +
          '<div class="banner banner-warn">⏳ Un lien de réinitialisation ne sert qu’une fois, ' +
            'et pas plus d’une heure. Demandez-en un nouveau.</div>' +
          '<a class="btn btn-primary btn-block btn-lg" href="#/forgot">Recevoir un nouveau lien</a>' +
          '<a class="btn btn-ghost btn-block" href="#/login">Retour à la connexion</a>' +
        '</div>');
      return;
    }

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
        /* Le lien de récupération a déjà ouvert la session : renvoyer vers la
           connexion ferait retaper un mot de passe qui vient d'être choisi. */
        await Store.refreshProfile();
        UI.ok('Mot de passe modifié', 'Vous êtes connecté.');
        Router.go(afterLogin(), true);
      } catch (err) { UI.busy(btn, false); UI.err(err.message); }
    };
  });

})(window);
