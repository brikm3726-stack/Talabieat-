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

  const ROLE_LABEL = { client: 'Client', restaurant: 'Restaurant', driver: 'Livreur', admin: 'Administrateur' };
  const VEHICULES = ['moto', 'voiture', 'velo', 'autre'];
  const VEHICULE_ICON = { moto: 'scooter', voiture: 'car', velo: 'bike', autre: 'package' };

  /* Deux valeurs, en minuscules côté base — c'est ce que la contrainte
     `profiles_gender_chk` accepte (voir supabase/28_genre_et_naissance.sql).
     Les libellés affichés sont séparés des valeurs stockées : traduire l'écran
     un jour ne devra pas changer une seule ligne de la base. */
  /* Trois valeurs, et la base les accepte toutes les trois depuis la révision
     de 28_genre_et_naissance.sql — qui SUPPRIME et recrée sa contrainte, pour
     converger même sur une base où l'ancienne version a déjà tourné.

     Les pictogrammes ne distinguent pas Homme de Femme : le jeu d'icônes n'en a
     pas, et deux silhouettes dessinées à la va-vite se ressemblent plus qu'elles
     ne se distinguent. Ce sont les libellés qui portent le sens. */
  /* Deux valeurs, et le choix ne se fait QU UNE FOIS : dès qu'un genre est
     enregistré, les deux cartes se verrouillent. La règle tient aussi en base —
     un déclencheur de 28_genre_et_naissance.sql refuse le passage d'une valeur à
     une autre. Un verrou d'interface seul n'est pas une règle : il suffit
     d'appeler l'API directement pour le contourner.

     Les pictogrammes ne distinguent pas Homme de Femme : le jeu d'icônes n'en a
     pas, et deux silhouettes dessinées à la va-vite se ressemblent plus qu'elles
     ne se distinguent. Ce sont les libellés qui portent le sens. */
  const GENRES = [
    { v: 'homme', t: 'Homme', i: 'user' },
    { v: 'femme', t: 'Femme', i: 'user' }
  ];

  /* L'âge affiché sous la date de naissance. Il n'est jamais stocké : un âge
     en base est faux le lendemain de l'anniversaire. Le calcul retire une
     année si l'anniversaire n'est pas encore passé cette année-ci — sans quoi
     quelqu'un né en décembre se verrait vieilli de douze mois dès janvier. */
  function ageTexte(iso) {
    if (!iso) return 'Renseignez-la si vous le souhaitez.';
    const n = new Date(String(iso).slice(0, 10));
    if (isNaN(n.getTime())) return '';
    const h = new Date();
    let a = h.getFullYear() - n.getFullYear();
    const m = h.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < n.getDate())) a--;
    if (a < 0 || a > 130) return 'Cette date ne semble pas correcte.';
    return a + ' an' + (a > 1 ? 's' : '');
  }

  /* ======================================================================
     RÉGLAGES — la page d'accueil du compte
     ====================================================================== */
  /* ---------------------------------------------------------- MODE NUIT
     Les six écrans du compte partagent la classe `.account-page`. Le thème
     sombre est donc posé par chacun d'eux : un onglet Compte sombre dont
     toutes les lignes ouvrent un écran blanc, ce serait un éblouissement à
     chaque appui.

     Réservé au CLIENT. Le livreur partage ces mêmes écrans dans son
     application, et son thème est bleu clair — il lit son téléphone en plein
     soleil, à moto. La fonction renvoie directement le nettoyage à rendre au
     routeur. */
  function nuitCompte() {
    if (App.est('client') && Store.role === 'client') UI.nuit('compte');
    return () => UI.nuit('');
  }

  Router.add('/account', async function (params, query, view) {
    const finNuit = nuitCompte();
    const p = Store.profile || {};
    /* Seuls ceux qu'on appelle entendent une sonnerie : le client, lui, n'a
       rien à couper. Et si le module audio n'a pas pu se charger, la ligne
       disparaît plutôt que de faire tomber la page entière. */
    const sonnerie = !!w.Sound && p.role === 'driver';

    /* CET ÉCRAN EST PARTAGÉ PAR LES QUATRE ESPACES — client, restaurateur,
       livreur, administration. Le nouvel écran ne vaut que pour le client :
       lui seul a des commandes, un quartier de livraison et un thème sombre.
       Les trois autres gardent la liste d'origine, au caractère près. Les
       redessiner à l'aveugle aurait touché trois applications pour une demande
       qui n'en concernait qu'une. */
    const clientPremium = App.est('client') && Store.role === 'client';

    function paint() {
      view.innerHTML = clientPremium ? ecranClient(p, sonnerie) : '<div class="account-page">' +
        '<span class="acc-dots a" aria-hidden="true"></span>' +
        '<span class="acc-dots b" aria-hidden="true"></span>' +
        '<div class="wrap-sm page">' +

        /* Pas de carte de profil en tête. Le nom, l'adresse et la photo
           s'affichaient à quelqu'un qui les connaît déjà, et exposaient son
           identité à qui regarde par-dessus son épaule. Ils sont dans
           « Mon compte », c'est-à-dire à un geste, volontaire. */

        '<div class="stack acc-reglages" style="gap:10px">' +

          /* 1 ---- mon compte ----
             Sa description parlait d'« informations personnelles », or c'est
             désormais le rôle de la porte suivante. Cet écran-ci répond à une
             autre question, et à une seule : quel compte suis-je en train
             d'utiliser. */
          porte('#/compte', 'user', 'Mon compte',
                'Quel compte est ouvert, et depuis quand') +

          /* 2 ---- informations personnelles ----
             L'ÉCRAN EXISTAIT DÉJÀ ET N'ÉTAIT RELIÉ À RIEN. `/profil` se
             tapait à la main dans l'adresse, ou s'atteignait par l'avatar de
             la barre du haut — que la maquette a fait disparaître. Sans cette
             porte, plus aucun moyen de changer son nom ou son quartier. */
          porte('#/profil', 'pencil', 'Informations personnelles',
                'Nom, genre, âge, quartier et adresses de livraison') +

          /* 3 ---- sécurité ---- */
          porte('#/securite', 'lock', 'Sécurité',
                'Modifier mon mot de passe, vérifié par email') +

          /* ---- mode sombre ----
             Un interrupteur, comme la sonnerie juste en dessous : deux
             réglages du même genre doivent se manipuler pareil.

             Réservé à l'application cliente : c'est la seule dont les écrans
             ont une version sombre. L'espace livreur est bleu clair de bout en
             bout, volontairement — on le lit à moto, en plein soleil. */
          (App.est('client')
            ? '<div class="card card-p acc-secu" style="cursor:default">' +
                '<span class="ic">' + UI.icon(UI.sombreVoulu() ? 'sound' : 'image', 20) + '</span>' +
                '<span class="grow"><b>Mode sombre</b>' +
                  '<span class="tiny">' +
                    (UI.sombreVoulu()
                      ? 'Fond noir — reposant le soir et économe en batterie'
                      : 'Fond clair — plus lisible en plein soleil') +
                  '</span></span>' +
                '<label class="switch"><input type="checkbox" id="sombre"' +
                  (UI.sombreVoulu() ? ' checked' : '') + '>' +
                  '<span class="track"><span class="knob"></span></span></label>' +
              '</div>'
            : '') +

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
            '<span class="grow"><b>Assistance</b>' +
              '<span class="tiny">Une question, un problème sur une commande</span></span>' +
          '</div>' +
          '<div class="acc-aide-btns">' +
            // le tel: ne supporte pas les espaces du numéro affiché
            '<a class="btn btn-soft btn-sm" href="tel:' +
              U.esc(TALABI_CONFIG.SUPPORT_PHONE.replace(/\s/g, '')) + '">' +
              UI.icon('phone', 16) + ' Nous appeler</a>' +
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

      /* Le changement de thème se voit tout de suite : on réaffiche l'écran
         courant. Router.render() rejoue la route, qui repose ou non les
         classes sombres selon la nouvelle préférence — aucune vue n'a besoin
         de connaître le thème, c'est UI.nuit() qui décide. */
      const sw = view.querySelector('#sombre');
      if (sw) sw.onchange = function () {
        UI.choisirSombre(this.checked);
        UI.ok(this.checked ? 'Mode sombre activé' : 'Mode clair activé');
        Shell.renderTop();
        Router.render();
      };

      const son = view.querySelector('#son');
      if (son) son.onchange = function () {
        Sound.muted = !this.checked;
        UI.ok(Sound.muted ? 'Sonnerie coupée' : 'Sonnerie réactivée',
              Sound.muted ? 'Vous ne serez plus averti par un son.' : '');
        paint();
      };

      view.querySelector('#logout').onclick = deconnexion;

      /* Le raccourci vers les avis ouvre le panneau déjà écrit pour la cloche
         de la barre du haut : deux chemins vers la même chose, un seul code. */
      const cl = view.querySelector('#cptNotif');
      if (cl) cl.onclick = Shell.notifPanel;

      /* LE NOMBRE DE COMMANDES EST DEMANDÉ, PAS DEVINÉ.
         En cas d'échec on laisse le tiret : « 0 » et « je ne sais pas » ne sont
         pas la même chose, et afficher 0 à quelqu'un qui a commandé dix fois est
         pire que de ne rien afficher. C'est aussi pourquoi `API.safe` n'est pas
         utilisé ici — il rendrait un tableau vide en cas de panne, donc un zéro
         qui aurait l'air d'une réponse. */
      const nb = view.querySelector('#cptNb');
      if (nb) {
        (async function () {
          try {
            const l = await API.orders({ scope: 'client' });
            if (view.querySelector('#cptNb') !== nb) return;   // écran repeint
            nb.textContent = Array.isArray(l) ? String(l.length) : '—';
          } catch (e) { nb.textContent = '—'; }
        })();
      }
    }

    paint();

    return finNuit;
  }, { auth: true });

  /* ======================================================================
     INFORMATIONS PERSONNELLES — ÉCRAN DU CLIENT
     ----------------------------------------------------------------------
     Comme l'écran Compte, `/profil` est partagé : le livreur y règle aussi son
     véhicule et sa plaque. Le nouvel écran ne vaut donc que pour le client, et
     l'autre garde son formulaire au caractère près.

     LES CROCHETS SONT LES MÊMES QUE L'ANCIEN MARQUAGE — `#pf`, `[data-g]`,
     `[data-gcheck]`, `#bdate`, `#ageHint`, `#addAddr`, `[data-ae]`, `[data-ad]`,
     `data-imgfield`, `data-preview`, `data-pick`, `data-file`. Aucun
     gestionnaire n'est réécrit : c'est la peau qui change, pas la mécanique. Un
     écran refait qui casse l'enregistrement n'est pas un écran refait.

     CE QUE LE BRIEF DEMANDAIT ET QUI N'EXISTE PAS :

     - « Badge Vérifié » sur le téléphone : Talabi n'envoie pas de code SMS. Un
       badge « vérifié » qui ne vérifie rien est un mensonge affiché en vert.
     - « Bouton modifier » sur l'email : changer l'adresse de connexion demande
       une confirmation par email qui n'est pas implémentée. La ligne dit donc
       comment faire — nous écrire — au lieu d'ouvrir une porte qui ne mène nulle
       part.
     - « Récompenses Talabi » et « Paiement » : ni programme de fidélité, ni
       moyen de paiement enregistré. Le paiement se fait en espèces à la
       réception.

     Les quatre actions rapides sont donc quatre destinations qui existent
     vraiment. La grille 2×2 du brief est respectée ; c'est son contenu qui
     change.
     ====================================================================== */

  /* Le préfixe international, affiché SOUS le champ une fois le numéro valide.
     Le montrer DANS le champ, devant un numéro qui commence déjà par 0, aurait
     écrit « +213 0555… » — deux notations du même indicatif, dont une fausse. */
  function ipInternational(tel) {
    const n = String(tel || '').replace(/\D/g, '');
    if (!/^0[5-7]\d{8}$/.test(n)) return '';
    const r = n.slice(1);
    return '+213 ' + r.slice(0, 3) + ' ' + r.slice(3, 5) + ' ' + r.slice(5, 7) + ' ' + r.slice(7);
  }

  /* La complétion du profil. Sept renseignements, tous vérifiables : on ne
     compte pas un pourcentage inventé, on compte ce qui est rempli. Chaque
     manque porte son intitulé, et c'est cette liste qui devient la suggestion —
     « Profil complété à 71 % » sans dire ce qui manque ne sert à rien. */
  function ipCompletion(p, nbAdresses, baseAJour) {
    const items = [
      ['Votre photo',          !!p.avatar_url],
      ['Votre nom complet',    !!(p.full_name && p.full_name.length >= 3)],
      ['Votre téléphone',      !!p.phone],
      ['Votre zone',           !!p.zone_id],
      ['Une adresse de livraison', nbAdresses > 0]
    ];
    /* Genre et date de naissance ne comptent que si la base les connaît :
       sinon le profil serait plafonné à 71 % sans qu'on puisse rien y faire. */
    if (baseAJour) {
      items.push(['Votre genre', !!p.gender]);
      items.push(['Votre date de naissance', !!p.birth_date]);
    }
    const faits = items.filter(i => i[1]).length;
    return {
      pct: Math.round(faits / items.length * 100),
      manque: items.filter(i => !i[1]).map(i => i[0])
    };
  }

  function ipRac(o) {
    return '<a class="ip-rac" href="' + o.href + '"' +
      (o.neuf ? ' target="_blank" rel="noopener"' : '') +
      (o.id ? ' id="' + o.id + '"' : '') + '>' +
      '<span class="ip-rac-ic">' + UI.icon(o.icone, 21) + '</span>' +
      '<span class="ip-rac-t">' + U.esc(o.titre) + '</span>' +
      '<span class="ip-rac-c">' + UI.icon('chevron', 16) + '</span></a>';
  }

  function ipEcran(p, addresses, verrou, genre, baseAJour, fige) {
    const comp = ipCompletion(p, addresses.length, baseAJour);
    const inter = ipInternational(p.phone);

    return '<div class="account-page prem ip">' +
      '<div class="wrap-sm page">' +

      '<header class="prem-tete">' +
        '<a class="prem-retour" href="#/account" aria-label="Retour aux réglages">' +
          UI.icon('chevron', 19) + '</a>' +
        '<span class="prem-vignette" aria-hidden="true">' + UI.icon('user', 25) + '</span>' +
        '<div class="prem-tete-txt">' +
          '<h1 class="prem-h1">Informations personnelles</h1>' +
          '<p class="prem-sub">Gérez vos informations et personnalisez votre profil</p>' +
        '</div>' +
      '</header>' +

      '<form id="pf" class="ip-carte" novalidate>' +

        /* ---- photo ----
           Le marquage reprend les crochets de `UI.imageField` — `data-imgfield`,
           `data-preview`, `data-pick`, `data-file` et le champ caché — mais pas
           ses styles en ligne, qui imposaient un carré de 76 px et un liseré
           pointillé. Un style en ligne l'emporte sur toute feuille : il fallait
           le marquage à part pour obtenir un rond de 100 px. La mécanique
           d'envoi, elle, est celle de tout le monde. */
        '<div class="ip-photo-zone" data-imgfield="avatar_url">' +
          '<div class="ip-photo">' +
            '<span class="ip-photo-img" data-preview' +
              (p.avatar_url ? ' style="background-image:url(' + U.escUrl(p.avatar_url) + ')"' : '') +
              '>' + (p.avatar_url ? '' : U.esc(U.initials(p.full_name || '?'))) + '</span>' +
            '<button type="button" class="ip-cam" data-pick aria-label="Changer ma photo">' +
              UI.icon('camera', 18) + '</button>' +
          '</div>' +
          '<div class="ip-photo-nom">' + U.esc(p.full_name || 'Votre profil') + '</div>' +
          '<div class="ip-photo-aide">JPG ou PNG, 2 Mo maximum</div>' +
          '<input type="file" accept="image/*" hidden data-file>' +
          '<input type="hidden" name="avatar_url" value="' + U.esc(p.avatar_url || '') + '">' +
        '</div>' +

        /* ---- complétion ---- */
        '<div class="ip-etat' + (comp.pct === 100 ? ' plein' : '') + '">' +
          '<div class="ip-etat-h">' +
            '<b>Profil complété à ' + comp.pct + ' %</b>' +
            '<span>' + (comp.pct === 100 ? 'Tout est renseigné' : comp.manque.length + ' à compléter') + '</span>' +
          '</div>' +
          '<div class="ip-jauge"><span style="--p:' + comp.pct + '%"></span></div>' +
          (comp.manque.length
            ? '<div class="ip-etat-l">' + comp.manque.map(m =>
                '<span>' + UI.icon('plus', 13) + ' ' + U.esc(m) + '</span>').join('') + '</div>'
            : '') +
        '</div>' +

        /* ---- nom ---- */
        '<div class="prem-champ">' +
          '<label for="ipNom">Nom complet</label>' +
          '<div class="prem-boite">' +
            '<span class="prem-ic">' + UI.icon('user', 18) + '</span>' +
            '<input id="ipNom" class="prem-input" name="full_name" ' +
              'value="' + U.esc(p.full_name || '') + '" ' +
              'placeholder="Prénom et nom" autocomplete="name" required>' +
          '</div>' +
        '</div>' +

        /* ---- email ----
           Désactivé, et la ligne dessous dit pourquoi et quoi faire. Un champ
           grisé sans explication se lit comme un défaut. */
        '<div class="prem-champ">' +
          '<label for="ipMail">Email</label>' +
          '<div class="prem-boite">' +
            '<span class="prem-ic">' + UI.icon('mail', 18) + '</span>' +
            '<input id="ipMail" class="prem-input" value="' + U.esc(p.email || '') + '" disabled>' +
            '<span class="ip-verrou" aria-hidden="true">' + UI.icon('lock', 17) + '</span>' +
          '</div>' +
          '<span class="prem-aide">C’est l’adresse avec laquelle vous vous connectez. ' +
            'Pour la changer, <a href="mailto:' + U.esc(TALABI_CONFIG.SUPPORT_EMAIL || '') +
            '?subject=' + encodeURIComponent('Talabi — changer mon email') + '">écrivez-nous</a>.</span>' +
        '</div>' +

        /* ---- téléphone ---- */
        '<div class="prem-champ">' +
          '<label for="ipTel">Téléphone</label>' +
          '<div class="prem-boite">' +
            '<span class="prem-ic">' + UI.icon(verrou.bloque ? 'lock' : 'phone', 18) + '</span>' +
            '<input id="ipTel" class="prem-input" name="phone" inputmode="tel" ' +
              'placeholder="0X XX XX XX XX" value="' + U.esc(p.phone || '') + '"' +
              (verrou.bloque ? ' disabled' : '') + '>' +
          '</div>' +
          '<span class="prem-aide' + (inter ? ' ok' : '') + '" id="ipTelAide">' +
            (verrou.bloque
              ? 'Numéro enregistré il y a moins de 30 jours. Modifiable dans ' +
                verrou.jours + ' jour' + (verrou.jours > 1 ? 's' : '') + '.'
              : inter ? 'Soit ' + inter : 'Numéro algérien : 0X XX XX XX XX') +
          '</span>' +
        '</div>' +

        /* ---- genre et date de naissance ----
           LES DEUX CHAMPS N'APPARAISSENT QUE SI LA BASE LES CONNAÎT.
           `getProfile` lit la ligne entière : si la migration
           28_genre_et_naissance.sql n'a pas été exécutée, ces clés sont absentes
           de l'objet — et non pas nulles. Sans ce test, remplir son genre
           ferait échouer l'enregistrement ENTIER, nom et téléphone compris. */
        (baseAJour
          ? '<div class="prem-champ">' +
              '<label>Genre <span class="ip-fac">' +
                (fige ? 'définitif' : 'facultatif') + '</span></label>' +
              /* VERROUILLÉ dès qu'un genre est enregistré. Les cartes perdent
                 leur attribut `data-g` : sans lui, le gestionnaire de clic ne
                 s'accroche à rien, et il n'y a donc rien à désactiver ni à
                 penser à réactiver ailleurs. */
              '<div class="ip-genres' + (fige ? ' fige' : '') + '" id="genre">' +
                GENRES.map(g => {
                  const on = genre === g.v;
                  return '<' + (fige ? 'div' : 'button type="button"') +
                    ' class="ip-genre' + (on ? ' on' : '') + '"' +
                    (fige ? ' aria-disabled="true"' : ' data-g="' + g.v + '"' +
                      ' aria-pressed="' + (on ? 'true' : 'false') + '"') + '>' +
                    '<span class="ip-genre-ic">' + UI.icon(g.i, 22) + '</span>' +
                    '<span class="ip-genre-t">' + U.esc(g.t) + '</span>' +
                    '<span class="ip-genre-c" data-gcheck>' + (on ? '✓' : '') + '</span>' +
                    '</' + (fige ? 'div' : 'button') + '>';
                }).join('') +
              '</div>' +
              '<span class="prem-aide">' + (fige
                ? 'Le genre ne se choisit qu’une fois : il n’est plus modifiable.'
                : 'Une fois enregistré, il ne sera plus modifiable.') + '</span>' +
            '</div>' +

            '<div class="prem-champ">' +
              '<label for="bdate">Date de naissance <span class="ip-fac">facultatif</span></label>' +
              '<div class="prem-boite">' +
                '<span class="prem-ic">' + UI.icon('calendar', 18) + '</span>' +
                '<input id="bdate" class="prem-input" type="date" name="birth_date" ' +
                  'max="' + U.esc(new Date().toISOString().slice(0, 10)) + '" ' +
                  'value="' + U.esc((p.birth_date || '').slice(0, 10)) + '">' +
              '</div>' +
              '<span class="prem-aide" id="ageHint">' + U.esc(ageTexte(p.birth_date)) + '</span>' +
            '</div>'
          : '') +

        /* ---- zone ----
           Un menu déroulant natif, et non une liste avec recherche : Tizi Ouzou
           compte une poignée de quartiers. Un champ de recherche pour cinq
           entrées ajoute un geste au lieu d'en retirer un. */
        '<div class="prem-champ">' +
          '<label for="ipZone">Zone de livraison</label>' +
          '<div class="prem-boite">' +
            '<span class="prem-ic">' + UI.icon('pin', 18) + '</span>' +
            '<select id="ipZone" class="prem-input ip-select" name="zone_id">' +
              '<option value="">— Choisir mon quartier —</option>' +
              Store.zones.map(z => '<option value="' + U.esc(z.id) + '"' +
                (p.zone_id === z.id ? ' selected' : '') + '>' + U.esc(z.name) +
                (z.wilaya && z.wilaya !== TALABI_CONFIG.DEFAULT_WILAYA
                  ? ' (' + U.esc(z.wilaya) + ')' : '') + '</option>').join('') +
            '</select>' +
            '<span class="ip-chev" aria-hidden="true">' + UI.icon('chevron', 17) + '</span>' +
          '</div>' +
        '</div>' +

        /* ---- adresses ---- */
        '<div class="ip-sep" id="adrAncre"></div>' +
        '<div class="ip-bloc-h">' +
          '<div class="ip-bloc-t"><span>' + UI.icon('pin', 19) + '</span>Adresses de livraison</div>' +
          '<button type="button" class="ip-ajout" id="addAddr">' + UI.icon('plus', 16) +
            ' Ajouter</button>' +
        '</div>' +
        (addresses.length
          ? '<div class="ip-adrs">' + addresses.map(a =>
              '<div class="ip-adr">' +
                '<span class="ip-adr-ic">' + UI.icon('pin', 19) + '</span>' +
                '<div class="ip-adr-txt">' +
                  '<b>' + U.esc(a.label) +
                    (a.is_default ? '<span class="ip-pastille ok">' + UI.icon('check', 12) + ' Par défaut</span>' : '') +
                    (U.hasCoords(a) ? '' : '<span class="ip-pastille warn">' + UI.icon('warn', 12) + ' sans GPS</span>') +
                  '</b>' +
                  '<span>' + U.esc(a.street) + (a.details ? ' — ' + U.esc(a.details) : '') + '</span>' +
                  '<span>' + U.esc(zoneName(a.zone_id)) + ' • ' + U.esc(a.phone || '') +
                    (U.hasCoords(a) ? ' • <a class="addr-map" target="_blank" rel="noopener" href="' +
                      U.gmapsPin(a.lat, a.lng) + '">carte</a>' : '') + '</span>' +
                '</div>' +
                /* `type="button"` sur les deux : dans un <form>, un bouton sans
                   type VAUT « submit ». Sans cela, toucher le crayon d'une
                   adresse enregistrerait le profil au lieu de l'ouvrir. */
                '<div class="ip-adr-act">' +
                  '<button type="button" class="ip-rond" data-ae="' + U.esc(a.id) + '" ' +
                    'aria-label="Modifier cette adresse">' + UI.icon('pencil', 16) + '</button>' +
                  '<button type="button" class="ip-rond rouge" data-ad="' + U.esc(a.id) + '" ' +
                    'aria-label="Supprimer cette adresse">' + UI.icon('trash', 16) + '</button>' +
                '</div>' +
              '</div>').join('') + '</div>'
          : '<p class="ip-vide">Aucune adresse enregistrée. Ajoutez-en une depuis votre ' +
            'position : c’est le point que le livreur ouvrira dans Google Maps.</p>') +

        /* ---- boutons ---- */
        '<button class="prem-go" type="submit">' + UI.icon('save', 19) +
          ' Enregistrer les modifications</button>' +
        '<button class="prem-go2" type="button" id="ipAnnuler">Annuler</button>' +
        (verrou.bloque ? '' :
          '<p class="ip-note">Une fois modifié, le téléphone sera bloqué 30 jours.</p>') +
      '</form>' +

      /* ---- quatre actions rapides, quatre destinations réelles ---- */
      '<div class="ip-lab">Accès rapide</div>' +
      '<div class="ip-racs">' +
        ipRac({ href: '#adrAncre', icone: 'pin', titre: 'Mes adresses', id: 'ipVersAdr' }) +
        ipRac({ href: '#/securite', icone: 'lock', titre: 'Sécurité' }) +
        ipRac({ href: '#/orders', icone: 'package', titre: 'Mes commandes' }) +
        ipRac({ href: U.escUrl(U.asset('confidentialite.html')), neuf: true,
                icone: 'shield', titre: 'Confidentialité' }) +
      '</div>' +

      '</div></div>';
  }

  /* ======================================================================
     INFORMATIONS PERSONNELLES
     ====================================================================== */
  Router.add('/profil', async function (params, query, view) {
    const finNuit = nuitCompte();
    const p = Store.profile || {};

    async function paint() {
      const addresses = p.role === 'client' ? await API.safe(() => API.addresses(), []) : [];
      const d = p.role === 'driver' ? (p.driver || await API.safe(() => API.getDriver(), {}) || {}) : {};
      const verrou = U.phoneLock(p);
      let vehicule = d.vehicle || 'moto';
      /* Le genre se choisit comme le véhicule : deux cartes, pas un menu
         déroulant. Sur deux valeurs, un menu demande deux gestes là où deux
         cartes en demandent un — et on voit son choix sans l'ouvrir. */
      let genre = p.gender || '';
      /* Déjà renseigné en base = définitif. On lit `p.gender`, pas la variable
         `genre` : un genre choisi à l'instant et pas encore enregistré doit
         rester modifiable jusqu'à l'enregistrement. */
      const fige = !!p.gender;

      /* LES DEUX CHAMPS N'APPARAISSENT QUE SI LA BASE LES CONNAÎT.
         `getProfile` lit la ligne entière (`select('*')`) : si la migration
         28_genre_et_naissance.sql n'a pas encore été exécutée, ces clés sont
         absentes de l'objet — et non pas nulles. Ce test suffit donc à savoir
         où en est la base.

         Sans lui, quelqu'un remplirait son genre et son enregistrement
         échouerait sur une erreur de PostgREST incompréhensible. Là, les deux
         champs n'existent tout simplement pas encore, et tout le reste de
         l'écran fonctionne. Ils apparaîtront d'eux-mêmes après la migration,
         sans rien redéployer. */
      const baseAJour = !!p && ('gender' in p) && ('birth_date' in p);

      /* Le nouvel écran ne vaut que pour le client : le livreur règle ici son
         véhicule et sa plaque, et son formulaire reste celui d'avant, au
         caractère près. */
      const clientPremium = App.est('client') && p.role === 'client';

      view.innerHTML = clientPremium
        ? ipEcran(p, addresses, verrou, genre, baseAJour, fige)
        : '<div class="account-page">' +
        '<span class="acc-dots a" aria-hidden="true"></span>' +
        '<div class="wrap-sm page">' +

        entete('Informations personnelles') +

        '<form id="pf" class="card card-p stack acc-block">' +
          '<div class="acc-grid">' +
            UI.imageField('avatar_url', p.avatar_url, 'Photo de profil') +
            '<div class="field"><label>Nom complet</label>' +
              '<div class="input-ic"><span>' + UI.icon('user', 17) + '</span>' +
              '<input class="input" name="full_name" value="' + U.esc(p.full_name || '') + '" required></div></div>' +

            /* ---- genre et date de naissance (clients) ----
               Deux renseignements, jamais des conditions : on peut commander
               sans les remplir. D'où l'absence de `required` et la mention
               « facultatif », qui évite de faire hésiter quelqu'un devant un
               champ qu'il n'a pas envie de remplir. */
            (p.role === 'client' && baseAJour
              ? '<div class="field acc-full"><label>Genre ' +
                  '<span class="tiny">(facultatif)</span></label>' +
                  '<div class="grid grid-2" style="gap:9px" id="genre">' +
                    GENRES.map(g =>
                      '<div class="role-card' + (genre === g.v ? ' on' : '') + '" data-g="' + g.v + '">' +
                        '<div class="ic">' + UI.icon(g.i, 20) + '</div>' +
                        '<div class="grow"><b>' + U.esc(g.t) + '</b></div>' +
                        '<div data-gcheck style="color:var(--brand);font-weight:800">' +
                          (genre === g.v ? '✓' : '') + '</div></div>').join('') +
                  '</div></div>' +

                /* UNE DATE, PAS UN NOMBRE. Un âge saisi en chiffres est faux
                   dès le lendemain de l'anniversaire et rien ne peut le
                   rattraper ; la date reste vraie et l'âge s'en déduit. Le
                   même geste pour l'utilisateur, et l'âge s'affiche à côté
                   pour qu'il vérifie d'un coup d'œil. */
                '<div class="field"><label>Date de naissance ' +
                  '<span class="tiny">(facultatif)</span></label>' +
                  '<div class="input-ic"><span>' + UI.icon('calendar', 17) + '</span>' +
                  '<input class="input" type="date" name="birth_date" id="bdate" ' +
                    'max="' + U.esc(new Date().toISOString().slice(0, 10)) + '" ' +
                    'value="' + U.esc((p.birth_date || '').slice(0, 10)) + '"></div>' +
                  '<div class="hint" id="ageHint">' + ageTexte(p.birth_date) + '</div>' +
                '</div>'
              : '') +

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
            Cmp.zoneSelect('zone_id', p.zone_id, p.role === 'driver' ? 'Mon quartier de livraison' : 'Ma zone') +
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

          /* ---- adresses (clients) ----
             ELLES SONT MAINTENANT DANS LE FORMULAIRE, avant le bouton
             d'enregistrement : c'est l'ordre demandé, et il est plus juste —
             on remplit son identité, puis où l'on habite, puis on enregistre.

             Tous les boutons de ce bloc portent `type="button"`. Sans ça, à
             l'intérieur d'un <form>, un bouton sans type VAUT « submit » :
             toucher le crayon d'une adresse aurait enregistré le profil au
             lieu de l'ouvrir. Le bloc était dehors, le piège dormait. */
          (p.role === 'client'
            ? '<div class="divider"></div>' +
            '<div class="row-between" style="margin-bottom:14px">' +
              bloc('pin', 'Adresses de livraison') +
              '<button type="button" class="btn btn-soft btn-sm" id="addAddr">' + UI.icon('plus', 16) +
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
                      '<button type="button" class="icon-round" data-ae="' + U.esc(a.id) + '" title="Modifier">' +
                        UI.icon('pencil', 17) + '</button>' +
                      '<button type="button" class="icon-round danger" data-ad="' + U.esc(a.id) + '" title="Supprimer">' +
                        UI.icon('trash', 17) + '</button></div>' +
                  '</div>').join('') + '</div>'
              : '<div class="tiny">Aucune adresse enregistrée. Ajoutez-en une depuis ' +
                'votre position : c’est le point que le livreur ouvrira dans Google Maps.</div>')
            : '') +

          /* ---- et tout en bas, l'enregistrement ---- */
          '<button class="btn btn-primary btn-block btn-lg" type="submit" style="margin-top:4px">' +
            UI.icon('save', 18) + ' Enregistrer</button>' +
          (verrou.bloque ? '' :
            '<div class="tiny center" style="margin-top:2px">Une fois modifié, le téléphone sera bloqué 30 jours.</div>') +
        '</form>' +

      '</div></div>';

      /* ------------------------------------------------------ actions */
      UI.bindImageFields(view);

      /* ---- ce qui n'existe que sur l'écran du client ----
         Chaque greffe est gardée par sa propre présence : l'écran du livreur
         passe ici aussi, et n'a aucun de ces éléments. */

      /* Le nom sous la photo suit ce qu'on tape, sans attendre l'enregistrement :
         c'est le seul endroit de l'écran où l'on se voit soi-même. */
      const nom = view.querySelector('#ipNom');
      const nomVu = view.querySelector('.ip-photo-nom');
      if (nom && nomVu) nom.oninput = () => {
        nomVu.textContent = nom.value.trim() || 'Votre profil';
      };

      /* Le numéro se relit en notation internationale dès qu'il est valide. Ce
         n'est pas une vérification — Talabi n'envoie pas de SMS — mais une
         relecture : on voit tout de suite si on s'est trompé d'un chiffre. */
      const tel = view.querySelector('#ipTel');
      const telAide = view.querySelector('#ipTelAide');
      if (tel && telAide && !tel.disabled) tel.oninput = () => {
        const i = ipInternational(tel.value);
        telAide.textContent = i ? 'Soit ' + i
          : tel.value ? 'Ce numéro ne ressemble pas à un numéro algérien'
          : 'Numéro algérien : 0X XX XX XX XX';
        telAide.className = 'prem-aide' + (i ? ' ok' : tel.value ? ' non' : '');
      };

      /* « Annuler » remet les valeurs enregistrées : on repeint depuis le
         profil en mémoire, qui n'a pas été touché. Rien à défaire champ par
         champ, donc rien à oublier. */
      const ann = view.querySelector('#ipAnnuler');
      if (ann) ann.onclick = () => { paint(); UI.toast('Modifications annulées'); };

      /* Le raccourci « Mes adresses » descend dans la page au lieu de changer
         d'écran : elles sont dans ce formulaire, et les sortir dans un écran à
         part obligerait à enregistrer avant d'y aller. */
      /* Arrivée depuis « Mes adresses » de l'écran Mon compte : on descend
         directement au bon endroit. Le repère est CONSOMMÉ, pas seulement lu —
         sans quoi chaque retour sur cet écran ferait sauter la page vers le bas
         sans qu'on ait rien demandé. */
      let versAdr = false;
      try {
        versAdr = sessionStorage.getItem('talabi.vers_adresses') === '1';
        if (versAdr) sessionStorage.removeItem('talabi.vers_adresses');
      } catch (e) {}
      if (versAdr) {
        const ancre = view.querySelector('#adrAncre');
        if (ancre) setTimeout(() => ancre.scrollIntoView({ behavior: 'smooth', block: 'start' }), 260);
      }

      const va = view.querySelector('#ipVersAdr');
      if (va) va.onclick = e => {
        e.preventDefault();
        const cible = view.querySelector('#adrAncre');
        if (cible) cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

      /* ---- le genre : deux cartes, un seul choix ----
         Le même geste que pour le véhicule du livreur, volontairement : deux
         listes qui se ressemblent doivent se manipuler pareil. Un second appui
         sur la carte déjà choisie l'annule — sans ça, quelqu'un qui a touché
         par erreur ne pourrait plus revenir à « non renseigné ». */
      view.querySelectorAll('[data-g]').forEach(el => el.onclick = () => {
        /* Retour haptique : 8 ms, le minimum perceptible. Ignoré par iOS, qui ne
           l'expose pas au web — on ne le simule pas. */
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
        genre = (genre === el.dataset.g) ? '' : el.dataset.g;
        view.querySelectorAll('[data-g]').forEach(x => {
          const on = x.dataset.g === genre;
          x.classList.toggle('on', on);
          x.querySelector('[data-gcheck]').textContent = on ? '✓' : '';
        });
      });

      /* L'âge se recalcule à chaque changement de date : on vérifie ce qu'on a
         saisi sans attendre l'enregistrement. */
      const bd = view.querySelector('#bdate');
      const ah = view.querySelector('#ageHint');
      if (bd && ah) bd.oninput = () => { ah.textContent = ageTexte(bd.value); };

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
        /* La date est facultative, mais si elle est là elle doit être
           plausible : la contrainte SQL refuserait l'année 2998 avec un
           message que personne ne comprendrait. */
        if (f.birth_date) {
          const n = new Date(f.birth_date);
          if (isNaN(n.getTime()) || n >= new Date() || n.getFullYear() < 1900)
            return UI.err('Date de naissance invalide', 'Elle doit être dans le passé.');
        }

        UI.busy(btn, true);
        try {
          const patch = {
            full_name: f.full_name, phone: f.phone,
            zone_id: f.zone_id, avatar_url: f.avatar_url
          };
          /* Le genre ne vient pas du formulaire — c'est une carte, pas un
             champ — donc il est joint depuis la variable qui le suit.

             Et les deux champs ne partent QUE si la base les connaît : envoyer
             une colonne inexistante fait échouer l'enregistrement entier, nom
             et téléphone compris. Tant que la migration n'est pas passée,
             l'écran continue donc de fonctionner comme avant. */
          if (baseAJour) {
            patch.gender = genre;
            patch.birth_date = f.birth_date || '';
          }
          await API.updateProfile(patch);
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
        if (!(await UI.confirm('Supprimer cette adresse ?', '', 'Supprimer', true))) return;
        await API.safe(() => API.deleteAddress(b.dataset.ad));
        UI.ok('Adresse supprimée');
        paint();
      });
    }

    await paint();

    return finNuit;
  }, { auth: true });

  /* ======================================================================
     MON COMPTE — ÉCRAN DU CLIENT
     ----------------------------------------------------------------------
     Sixième écran sur le même jeu de briques : `prem-tete`, `prem-go`,
     `prem-go2` et les six jetons de couleur viennent du lot commun. Seul ce qui
     n'existe que là est écrit ici.

     CE QUE LE BRIEF DEMANDAIT ET QUI N'EXISTE PAS :

     - « Niveau utilisateur : Client Premium, Gold » : il n'y a pas de paliers.
       Inventer un « Gold » sur un compte qui n'en a pas fait douter du reste de
       la carte — c'est la seule ligne qu'on ne peut pas vérifier soi-même.
     - « Points fidélité », « Récompenses », « Économies réalisées » : aucun
       programme, aucune remise. Les quatre tuiles comptent donc quatre choses
       réelles, toutes tirées des commandes.
     - « Talabi Plus » : pas d'abonnement, et le paiement en espèces à la
       livraison ne permet aucun encaissement récurrent.
     - « Moyens de paiement » : on paie à la réception, il n'y a rien à
       enregistrer.
     - « Langue et région » : l'application cliente n'existe qu'en français, et
       ne livre qu'à Tizi Ouzou.
     - « Centre d'aide » et « Conditions d'utilisation » : ces deux pages
       n'existent pas. Le support, lui, existe — téléphone et email.

     CE QUI EXISTAIT ET QUE PERSONNE NE LISAIT : Supabase sait depuis toujours si
     l'adresse a été confirmée (`email_confirmed_at` sur la session). Le badge
     « vérifié » du brief est donc réel sur l'email. Il n'y en a pas sur le
     téléphone : aucun code SMS n'est envoyé, et un badge qui ne vérifie rien est
     un mensonge affiché en vert.
     ====================================================================== */

  /* Les quatre chiffres, tous comptés sur les commandes de la personne. Rendus
     à part de l'affichage pour que le calcul se lise d'un coup — et pour qu'on
     voie qu'aucun n'est une estimation. */
  function mcChiffres(commandes) {
    const finies = commandes.filter(o => o.status === 'delivered');
    const encours = commandes.filter(o =>
      ['pending', 'accepted', 'preparing', 'ready', 'driver_assigned', 'delivering']
        .indexOf(o.status) >= 0);
    const restos = {};
    finies.forEach(o => { if (o.restaurant && o.restaurant.id) restos[o.restaurant.id] = 1; });
    return {
      finies: finies.length,
      encours: encours.length,
      /* Seules les commandes LIVRÉES comptent dans le total dépensé : une
         commande annulée n'a rien coûté, et l'inclure gonflerait un chiffre que
         la personne peut recompter elle-même sur son historique. */
      depense: finies.reduce((s, o) => s + (+o.total || 0), 0),
      restos: Object.keys(restos).length
    };
  }

  function mcTuile(icone, cle, valeur) {
    return '<div class="mc-tuile">' +
      '<span class="mc-tuile-ic">' + UI.icon(icone, 19) + '</span>' +
      '<b>' + valeur + '</b>' +
      '<span>' + U.esc(cle) + '</span>' +
    '</div>';
  }

  /* Une ligne d'information : elle ne mène nulle part, elle montre. Le badge
     n'apparaît que si l'on sait vraiment. */
  function mcInfo(icone, cle, valeur, badge) {
    return '<div class="mc-l fixe">' +
      '<span class="mc-l-ic">' + UI.icon(icone, 19) + '</span>' +
      '<span class="mc-l-txt"><b>' + U.esc(cle) + '</b>' +
        '<span>' + U.esc(valeur || '—') + '</span></span>' +
      (badge ? '<span class="mc-verif">' + UI.icon('check', 13) + ' Vérifié</span>' : '') +
    '</div>';
  }

  function mcPorte(o) {
    const dedans =
      '<span class="mc-l-ic' + (o.ton ? ' ' + o.ton : '') + '">' + UI.icon(o.icone, 19) + '</span>' +
      '<span class="mc-l-txt"><b>' + U.esc(o.titre) + '</b>' +
        (o.sous ? '<span>' + U.esc(o.sous) + '</span>' : '') + '</span>' +
      '<span class="mc-l-chev">' + UI.icon('chevron', 18) + '</span>';
    if (o.id) return '<button type="button" class="mc-l" id="' + o.id + '">' + dedans + '</button>';
    return '<a class="mc-l" href="' + o.href + '"' +
      (o.neuf ? ' target="_blank" rel="noopener"' : '') + '>' + dedans + '</a>';
  }

  function mcLab(t) { return '<div class="mc-lab">' + U.esc(t) + '</div>'; }
  function mcGrp(l) { return '<div class="mc-grp">' + l.filter(Boolean).join('') + '</div>'; }

  /* « Membre depuis » en mois, pas en date : sur cette carte, ce qui compte est
     l'ancienneté. Le premier mois se dit « ce mois-ci » — « depuis 0 mois » ne
     veut rien dire. */
  function mcAnciennete(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const h = new Date();
    let mois = (h.getFullYear() - d.getFullYear()) * 12 + (h.getMonth() - d.getMonth());
    if (h.getDate() < d.getDate()) mois--;
    if (mois < 1) return 'Membre depuis ce mois-ci';
    if (mois < 12) return 'Membre depuis ' + mois + ' mois';
    const ans = Math.floor(mois / 12);
    return 'Membre depuis ' + ans + ' an' + (ans > 1 ? 's' : '');
  }

  function mcEcran(p, chiffres, emailOk) {
    return '<div class="account-page prem mc">' +
      '<div class="wrap-sm page">' +

      '<header class="prem-tete">' +
        '<a class="prem-retour" href="#/account" aria-label="Retour aux réglages">' +
          UI.icon('chevron', 19) + '</a>' +
        '<span class="prem-vignette" aria-hidden="true">' + UI.icon('user', 25) + '</span>' +
        '<div class="prem-tete-txt">' +
          '<h1 class="prem-h1">Mon compte</h1>' +
          '<p class="prem-sub">Gérez votre profil et vos préférences</p>' +
        '</div>' +
      '</header>' +

      /* ---- carte de profil ---- */
      '<div class="mc-carte">' +
        '<div class="mc-photo">' +
          '<span class="mc-photo-img"' +
            (p.avatar_url ? ' style="background-image:url(' + U.escUrl(p.avatar_url) + ')"' : '') +
            '>' + (p.avatar_url ? '' : U.esc(U.initials(p.full_name || '?'))) + '</span>' +
          /* Le badge n'est posé que si l'adresse est réellement confirmée. */
          (emailOk ? '<span class="mc-photo-b" title="Adresse email confirmée">' +
            UI.icon('check', 14) + '</span>' : '') +
        '</div>' +
        '<div class="mc-nom">' + U.esc(p.full_name || 'Votre profil') + '</div>' +
        '<div class="mc-role">' + UI.icon('user', 13) + ' ' +
          U.esc(ROLE_LABEL[p.role] || p.role) + '</div>' +
        (mcAnciennete(p.created_at)
          ? '<div class="mc-anc">' + UI.icon('calendar', 14) + ' ' +
            U.esc(mcAnciennete(p.created_at)) + '</div>' : '') +
        '<a class="prem-go mc-modif" href="#/profil">' + UI.icon('pencil', 18) +
          ' Modifier le profil</a>' +
      '</div>' +

      /* ---- quatre chiffres ---- */
      '<div class="mc-tuiles">' +
        mcTuile('package',  'Commandes livrées', chiffres.finies) +
        mcTuile('clock',    'En cours',          chiffres.encours) +
        mcTuile('wallet',   'Total dépensé',     U.esc(U.money(chiffres.depense))) +
        mcTuile('store',    'Restaurants',       chiffres.restos) +
      '</div>' +

      /* ---- identité ---- */
      mcLab('Identité') +
      mcGrp([
        mcInfo('mail', 'Email', p.email, emailOk),
        mcInfo('phone', 'Téléphone', p.phone, false),
        mcInfo('calendar', 'Compte créé le', p.created_at ? U.dt(p.created_at) : '', false)
      ]) +

      /* ---- réglages ---- */
      mcLab('Paramètres du compte') +
      mcGrp([
        mcPorte({ href: '#/profil', icone: 'pencil', titre: 'Informations personnelles',
                  sous: 'Nom, photo, genre, âge et quartier' }),
        mcPorte({ href: '#/securite', icone: 'lock', titre: 'Sécurité et mot de passe',
                  sous: 'Changer mon mot de passe' }),
        /* Les adresses vivent DANS « Informations personnelles » : ce raccourci
           y descend directement, sinon les deux lignes mèneraient au même
           endroit sans qu'on comprenne pourquoi il y en a deux. */
        mcPorte({ id: 'mcAdr', icone: 'pin', titre: 'Mes adresses',
                  sous: 'Où vous faire livrer' }),
        mcPorte({ id: 'mcNotif', icone: 'bell', titre: 'Notifications',
                  sous: 'Voir et gérer vos avis' })
      ]) +

      /* ---- aide ---- */
      mcLab('Aide') +
      mcGrp([
        mcPorte({ href: 'tel:' + U.esc(TALABI_CONFIG.SUPPORT_PHONE.replace(/\s/g, '')),
                  icone: 'headset', titre: 'Appeler le support',
                  sous: TALABI_CONFIG.SUPPORT_PHONE }),
        (TALABI_CONFIG.SUPPORT_EMAIL
          ? mcPorte({ href: 'mailto:' + U.esc(TALABI_CONFIG.SUPPORT_EMAIL),
                      icone: 'mail', titre: 'Écrire au support',
                      sous: TALABI_CONFIG.SUPPORT_EMAIL })
          : ''),
        /* La fiche Play de l'application cliente. C'est un vrai lien, vérifiable
           — le paquet est `shop.talabi.client`. */
        mcPorte({ href: 'https://play.google.com/store/apps/details?id=shop.talabi.client',
                  neuf: true, icone: 'sparkle', titre: 'Noter l’application',
                  sous: 'Sur Google Play' }),
        mcPorte({ href: U.escUrl(U.asset('confidentialite.html')), neuf: true,
                  icone: 'shield', titre: 'Confidentialité',
                  sous: 'Quelles données, pourquoi, et comment les effacer' })
      ]) +

      /* ---- zone à part ----
         Les deux gestes irréversibles, ensemble mais pas semblables : se
         déconnecter se défait en se reconnectant, supprimer son compte ne se
         défait pas. Le second est donc dessiné autrement, et son écran demande
         une seconde confirmation avant d'agir. */
      '<div class="mc-zone">' +
        '<div class="mc-zone-t">' + UI.icon('warn', 15) + ' Zone sensible</div>' +
        '<button type="button" class="mc-sortie" id="logout">' + UI.icon('logout', 18) +
          ' Se déconnecter</button>' +
        '<a class="mc-suppr" href="#/supprimer-compte">' + UI.icon('trash', 17) +
          ' Supprimer mon compte</a>' +
        '<p class="mc-zone-n">La suppression est définitive et vous sera reconfirmée ' +
          'sur l’écran suivant.</p>' +
      '</div>' +

      '</div></div>';
  }

  /* ======================================================================
     MON COMPTE — qui je suis sur la plateforme, et comment en sortir
     ----------------------------------------------------------------------
     C'est le seul écran qui répond à « quel compte suis-je en train
     d'utiliser ? ». La question paraît triviale jusqu'au jour où quelqu'un
     tient deux comptes — un livreur qui teste, un gérant qui a aussi une
     adresse client — et ne sait plus lequel est ouvert.
     ====================================================================== */
  Router.add('/compte', async function (params, query, view) {
    const finNuit = nuitCompte();
    const p = Store.profile || {};
    const d = p.role === 'driver' ? (await API.safe(() => API.getDriver(), null)) : null;

    /* Le nouvel écran ne vaut que pour le client : le livreur voit ici son
       statut de validation, et son écran reste celui d'avant. */
    if (App.est('client') && p.role === 'client') {
      const cmds = await API.safe(() => API.orders({ scope: 'client' }), []);
      const emailOk = !!(API.emailConfirmed && API.emailConfirmed());
      view.innerHTML = mcEcran(p, mcChiffres(cmds), emailOk);

      view.querySelector('#logout').onclick = deconnexion;

      const cl = view.querySelector('#mcNotif');
      if (cl) cl.onclick = Shell.notifPanel;

      /* « Mes adresses » descend directement sur le bloc des adresses de
         l'écran suivant. Le repère passe par sessionStorage plutôt que par
         l'adresse : le routeur ne lit pas de paramètre après un chemin en
         dièse, et un faux paramètre ignoré est un piège pour plus tard. */
      const ad = view.querySelector('#mcAdr');
      if (ad) ad.onclick = () => {
        try { sessionStorage.setItem('talabi.vers_adresses', '1'); } catch (e) {}
        Router.go('/profil');
      };

      return finNuit;
    }

    const ligne = (icone, titre, valeur) =>
      '<div class="acc-link" style="cursor:default">' +
        '<span class="ic">' + UI.icon(icone, 18) + '</span>' +
        '<span class="grow"><b>' + U.esc(titre) + '</b>' +
          '<span class="tiny">' + U.esc(valeur || '—') + '</span></span></div>';

    view.innerHTML = '<div class="account-page">' +
      '<span class="acc-dots a" aria-hidden="true"></span>' +
      '<div class="wrap-sm page">' +

      entete('Mon compte') +

      '<div class="card card-p acc-head">' +
        '<div class="row" style="gap:14px">' +
          UI.avatar(p.full_name, p.avatar_url, 72) +
          '<div class="grow"><div class="h2">' + U.esc(p.full_name || '—') + '</div>' +
            '<span class="tag tag-soft" style="margin-top:7px">' + UI.icon('user', 14) + ' ' +
              U.esc(ROLE_LABEL[p.role] || p.role) + '</span></div>' +
        '</div>' +
      '</div>' +

      '<div class="card card-p acc-block" style="margin-top:16px">' +
        bloc('user', 'Identité') +
        ligne('mail', 'Email', p.email) +
        ligne('phone', 'Téléphone', p.phone) +
        ligne('calendar', 'Compte créé le', p.created_at ? U.dt(p.created_at) : '') +
        (d ? ligne('scooter', 'Statut livreur',
                   d.validation_status === 'approved' ? 'Validé' :
                   d.validation_status === 'rejected' ? 'Refusé' : 'En attente de validation') : '') +
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

      /* SUPPRIMER SON COMPTE — tout en bas, discret, et jamais caché.
         Google Play exige ce chemin dans l'application depuis 2023. Le mettre
         à côté de « Se déconnecter » serait une faute d'ergonomie : les deux
         boutons ne se ressemblent pas du tout dans leurs conséquences. Il est
         donc plus bas, en petit, séparé — trouvable par qui le cherche, pas
         par qui cherche autre chose. */
      '<div class="center" style="margin-top:22px">' +
        '<a class="tiny" href="#/supprimer-compte" ' +
          'style="color:var(--muted);text-decoration:underline">' +
          'Supprimer mon compte</a></div>' +
    '</div></div>';

    view.querySelector('#logout').onclick = deconnexion;

    return finNuit;
  }, { auth: true });

  /* ======================================================================
     SUPPRIMER SON COMPTE
     ----------------------------------------------------------------------
     Un écran qui dit la vérité avant d'agir. Ce qui part, ce qui reste, et
     pourquoi : les commandes passées sont conservées sans nom ni adresse
     parce qu'elles font la comptabilité de la plateforme et les revenus
     déclarés des livreurs. Le cacher pour faire plus propre serait mentir sur
     ce qui se passe vraiment.

     La même opération existe sur une page web publique
     (talabi.shop/supprimer-compte.html) : Google Play demande les deux, une
     personne qui a désinstallé l'application doit pouvoir la demander aussi.
     ====================================================================== */
  Router.add('/supprimer-compte', async function (params, query, view) {
    const finNuit = nuitCompte();
    const p = Store.profile || {};

    view.innerHTML = '<div class="account-page"><div class="wrap-sm page">' +
      entete('Supprimer mon compte') +

      '<div class="card card-p acc-block">' +
        '<div class="h2">Cette action est définitive</div>' +
        '<p class="sub" style="margin-top:8px">Votre compte <b>' +
          U.esc(p.email || p.phone || '') + '</b> sera supprimé et vous serez ' +
          'déconnecté immédiatement. Vous pourrez recréer un compte plus tard ' +
          'avec la même adresse email, mais rien ne sera récupéré.</p>' +

        '<div class="divider"></div>' +

        '<div class="h3">Ce qui est effacé</div>' +
        '<ul class="sub" style="margin:8px 0 0;padding-left:20px;line-height:1.9">' +
          '<li>Votre nom, votre téléphone et votre photo</li>' +
          '<li>Vos adresses de livraison enregistrées</li>' +
          '<li>Vos notifications</li>' +
          '<li>Votre compte et votre mot de passe</li>' +
        '</ul>' +

        '<div class="h3" style="margin-top:16px">Ce qui est conservé, sans votre nom</div>' +
        '<p class="sub" style="margin-top:8px">Les <b>montants et les dates</b> de ' +
          'vos commandes passées restent dans nos comptes : ils font le chiffre ' +
          'd’affaires des restaurants et les revenus déclarés des livreurs, que ' +
          'la loi nous oblige à conserver. Le nom, le téléphone, l’adresse et le ' +
          'point GPS en sont retirés — ces lignes ne désignent plus personne.</p>' +
      '</div>' +

      '<div class="card card-p acc-block" style="margin-top:14px">' +
        '<div class="h3">Deux cas où la suppression est refusée</div>' +
        '<p class="sub" style="margin-top:8px">Si une <b>commande est en cours</b>, ' +
          'attendez la fin de la livraison ou annulez-la : un livreur est peut-être ' +
          'déjà en route. Si vous êtes livreur et qu’il <b>reste du crédit</b> sur ' +
          'votre compte, contactez-nous d’abord pour le récupérer — c’est votre ' +
          'argent, il ne doit pas disparaître d’un clic.</p>' +
      '</div>' +

      '<button class="btn btn-block btn-lg" id="del" ' +
        'style="margin-top:18px;background:var(--danger);color:#fff;border:none">' +
        'Supprimer définitivement mon compte</button>' +

      '<div class="center" style="margin-top:14px">' +
        '<a class="tiny" href="#/compte">Annuler, revenir à mon compte</a></div>' +
    '</div></div>';

    view.querySelector('#del').onclick = async function () {
      /* Double confirmation : le bouton rouge ne suffit pas pour un geste
         irréversible qu'on peut déclencher d'un pouce dans un bus. */
      if (!(await UI.confirm('Supprimer votre compte ?',
            'C’est définitif. Vos adresses, votre nom et votre téléphone seront ' +
            'effacés, et vous serez déconnecté.', 'Supprimer', true))) return;

      UI.busy(this, true, 'Suppression…');
      try {
        const message = await API.deleteMyAccount();
        Store.clearCart(true);
        await Store.refreshProfile();
        UI.ok('Compte supprimé', message);
        Router.go(App.est('client') ? '/' : '/login', true);
      } catch (e) {
        UI.busy(this, false);
        UI.err('Suppression impossible', e.message);
      }
    };

    return finNuit;
  }, { auth: true });

  /* ======================================================================
     À PROPOS
     ====================================================================== */
  Router.add('/apropos', async function (params, query, view) {
    const finNuit = nuitCompte();
    view.innerHTML = '<div class="account-page"><div class="wrap-sm page">' +
      entete('À propos') +

      '<div class="card card-p acc-block center">' +
        '<img src="' + U.asset('assets/img/logo.jpg') + '" alt="' + U.esc(TALABI_CONFIG.APP_NAME) + '" ' +
          'width="1254" height="1254" decoding="async" ' +
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

    return finNuit;
  }, { auth: true });

  /* ======================================================================
     SÉCURITÉ — MOT DE PASSE
     ----------------------------------------------------------------------
     Deux chemins, et le plus simple d'abord. Celui du mot de passe actuel ne
     dépend que de la base ; celui du code par email dépend d'un serveur SMTP
     extérieur. Le jour où celui-ci a refusé les identifiants (erreur 535),
     l'unique porte de l'époque passait par un service en panne et plus personne
     ne pouvait changer de mot de passe. C'est pourquoi le chemin par email est
     désormais le second, sous « Mot de passe oublié ? ».

     CE QUE LE BRIEF DEMANDAIT ET QUI N'EXISTE PAS : authentification à deux
     facteurs, appareils connectés, historique des connexions, sessions actives.
     Aucun des quatre n'a de table, d'écran ni d'appel côté serveur. Les afficher
     en lignes mortes sur un écran qui s'appelle « Sécurité » serait le pire
     endroit pour le faire : c'est précisément là qu'on vient vérifier que le
     compte est protégé. Une porte qui ne s'ouvre pas y ferait douter du reste.

     UNE PRÉCISION SUR LES QUATRE CONDITIONS. Le brief les liste avec des coches.
     Si les quatre étaient obligatoires, tout mot de passe accepté serait « fort »
     et l'indicateur de force n'aurait plus rien à mesurer. La longueur est donc
     exigée — c'est un « minimum » — et les trois autres sont recommandées et
     alimentent l'indicateur. Chaque ligne dit laquelle elle est : une coche qui
     ne bloque rien sans le dire est un mensonge poli.
     ====================================================================== */

  /* Un champ de mot de passe : pictogramme à gauche, œil à droite. L'œil est un
     bouton et non une case à cocher, avec `tabindex="-1"` : au clavier, on passe
     d'un champ au suivant sans buter sur lui. */
  function secChamp(o) {
    return '<div class="prem-champ' + (o.large ? ' large' : '') + '">' +
      '<label for="' + o.id + '">' + U.esc(o.label) + '</label>' +
      '<div class="prem-boite">' +
        '<span class="prem-ic">' + UI.icon(o.icone || 'lock', 18) + '</span>' +
        '<input id="' + o.id + '" class="prem-input" type="' + (o.type || 'password') + '" ' +
          'name="' + o.nom + '" placeholder="' + U.esc(o.repere || '') + '" ' +
          (o.mode ? 'inputmode="' + o.mode + '" ' : '') +
          (o.max ? 'maxlength="' + o.max + '" ' : '') +
          'autocomplete="' + (o.auto || 'off') + '" required>' +
        (o.type === 'text' ? '' :
          '<button type="button" class="prem-oeil" data-oeil="' + o.id + '" tabindex="-1" ' +
            'aria-label="Afficher le mot de passe">' + UI.icon('eye', 19) + '</button>') +
      '</div>' +
      (o.aide ? '<span class="prem-aide" id="' + o.id + '-aide"></span>' : '') +
    '</div>';
  }

  /* Les quatre conditions. `dur` marque celle qui bloque l'enregistrement. */
  const SEC_COND = [
    ['long',    'Au moins 8 caractères',  true],
    ['maj',     'Une majuscule',          false],
    ['chiffre', 'Un chiffre',             false],
    ['special', 'Un caractère spécial',   false]
  ];

  function secExamen(mdp) {
    const m = String(mdp || '');
    const c = {
      long:    m.length >= 8,
      maj:     /[A-Z]/.test(m),
      chiffre: /[0-9]/.test(m),
      special: /[^A-Za-z0-9]/.test(m)
    };
    const n = SEC_COND.reduce((s, k) => s + (c[k[0]] ? 1 : 0), 0);
    return {
      c: c, n: n,
      /* Trois niveaux pour quatre conditions : une seule remplie n'est pas un
         mot de passe, quatre en est un bon, et entre les deux il y a un vrai
         entre-deux qu'il serait malhonnête d'appeler « fort ». */
      niveau: n <= 1 ? 'faible' : n <= 3 ? 'moyen' : 'fort',
      mot:    n <= 1 ? 'Faible' : n <= 3 ? 'Moyen' : 'Fort'
    };
  }

  function secConditions() {
    return '<ul class="sec-cond" id="secCond">' +
      SEC_COND.map(k =>
        '<li data-c="' + k[0] + '">' +
          '<span class="p" aria-hidden="true">' + UI.icon('check', 14) + '</span>' +
          '<span class="t">' + U.esc(k[1]) + '</span>' +
          '<span class="r">' + (k[2] ? 'obligatoire' : 'recommandé') + '</span>' +
        '</li>').join('') +
    '</ul>';
  }

  function secForce() {
    return '<div class="sec-force" id="secForce" data-n="faible" hidden>' +
      '<div class="sec-force-h">' +
        '<span>Sécurité du mot de passe</span>' +
        '<b id="secForceMot">Faible</b>' +
      '</div>' +
      '<div class="sec-jauge"><span id="secJauge" style="--p:0%"></span></div>' +
    '</div>';
  }

  Router.add('/securite', async function (params, query, view) {
    const finNuit = nuitCompte();
    const p = Store.profile || {};
    /* L'adresse de la session passe devant celle du profil. `profiles.email`
       n'est qu'une copie écrite à l'inscription : elle est vide sur certains
       comptes, en particulier ceux ouverts avec Google. On affichait alors
       « nous envoyons un code à  » — sans rien — et l'envoi partait avec une
       adresse vide, ce qui échouait avec un message en anglais. */
    const adresse = (p.email || '').trim() || API.email() || '';

    let voie = 'actuel';          // actuel | demande | code

    function paint() {
      view.innerHTML = '<div class="account-page prem sec">' +
        '<div class="wrap-sm page">' +

        '<header class="prem-tete">' +
          '<a class="prem-retour" href="#/account" aria-label="Retour aux réglages">' +
            UI.icon('chevron', 19) + '</a>' +
          '<span class="prem-vignette" aria-hidden="true">' + UI.icon('shield', 26) + '</span>' +
          '<div class="prem-tete-txt">' +
            '<h1 class="prem-h1">Sécurité</h1>' +
            '<p class="prem-sub">Gérez et protégez votre compte Talabi</p>' +
          '</div>' +
        '</header>' +

        '<div class="sec-carte">' +
          '<div class="sec-bloc">' +
            '<span class="sec-ic">' + UI.icon('lock', 21) + '</span>' +
            '<div class="sec-bloc-txt"><b>Mot de passe</b>' +
              '<span>' + (voie === 'actuel'
                ? 'Modifiez votre mot de passe pour sécuriser davantage votre compte.'
                : voie === 'demande'
                  ? 'Nous envoyons un code à votre adresse email. Il prouve que cette boîte est bien la vôtre.'
                  : 'Code envoyé, valable une heure. Pensez à regarder dans les spams.') +
              '</span></div>' +
          '</div>' +

          (voie === 'actuel'
            ? '<form id="af" class="sec-form" novalidate>' +
                secChamp({ id: 'secAct', nom: 'actuel', label: 'Mot de passe actuel',
                           repere: 'Celui que vous utilisez aujourd’hui',
                           auto: 'current-password' }) +
                secChamp({ id: 'secNew', nom: 'password', label: 'Nouveau mot de passe',
                           repere: '8 caractères minimum', auto: 'new-password' }) +
                secForce() + secConditions() +
                secChamp({ id: 'secConf', nom: 'confirm', label: 'Confirmer le mot de passe',
                           repere: 'Retapez-le', auto: 'new-password', aide: true }) +
                '<button class="prem-go" type="submit">' + UI.icon('save', 19) +
                  ' Enregistrer le nouveau mot de passe</button>' +
              '</form>' +
              '<button type="button" class="prem-go2" id="parEmail">Mot de passe oublié ?</button>'

          : voie === 'demande'
            ? '<div class="sec-form">' +
                '<div class="sec-adresse">' + UI.icon('mail', 18) + ' ' + U.esc(adresse) + '</div>' +
                '<button type="button" class="prem-go" id="envoyer">' + UI.icon('mail', 19) +
                  ' Recevoir le code</button>' +
                '<button type="button" class="prem-go2" id="parActuel">' +
                  'Je connais mon mot de passe actuel</button>' +
              '</div>'

            : '<form id="sf" class="sec-form" novalidate>' +
                '<div class="sec-adresse">' + UI.icon('mail', 18) + ' ' + U.esc(adresse) + '</div>' +
                secChamp({ id: 'secCode', nom: 'code', label: 'Code reçu par email',
                           type: 'text', icone: 'inbox', repere: '— — — — — —',
                           mode: 'numeric', max: 10, auto: 'one-time-code', large: true }) +
                secChamp({ id: 'secNew', nom: 'password', label: 'Nouveau mot de passe',
                           repere: '8 caractères minimum', auto: 'new-password' }) +
                secForce() + secConditions() +
                secChamp({ id: 'secConf', nom: 'confirm', label: 'Confirmer le mot de passe',
                           repere: 'Retapez-le', auto: 'new-password', aide: true }) +
                '<button class="prem-go" type="submit">' + UI.icon('save', 19) +
                  ' Enregistrer le nouveau mot de passe</button>' +
                '<button type="button" class="prem-go2" id="renvoyer">' +
                  'Je n’ai rien reçu — renvoyer un code</button>' +
                '<button type="button" class="prem-go2" id="parActuel">' +
                  'Revenir au mot de passe actuel</button>' +
              '</form>') +
        '</div>' +

        /* La carte d'information ne parle que de Google : c'est le seul autre
           moyen d'entrer dans Talabi. Mentionner Apple, comme le demandait le
           brief, aurait décrit une porte qui n'existe pas. */
        '<div class="sec-info">' +
          '<span class="sec-info-ic">' + UI.icon('info', 19) + '</span>' +
          '<p>Si vous vous connectez avec Google, ce mot de passe s’ajoute comme ' +
            'seconde façon d’entrer, sans rien retirer à la première.</p>' +
        '</div>' +

      '</div></div>';

      brancher();
    }

    /* ---- la validation en direct -------------------------------------
       Elle ne se contente pas d'allumer des coches : elle décide aussi si le
       bouton est actif. Un bouton qu'on peut toucher pour se voir refuser fait
       chercher l'erreur dans le formulaire ; un bouton éteint dit où regarder. */
    function brancher() {
      view.querySelectorAll('[data-oeil]').forEach(b => b.onclick = function () {
        const champ = view.querySelector('#' + this.dataset.oeil);
        if (!champ) return;
        const cache = champ.getAttribute('type') === 'password';
        champ.setAttribute('type', cache ? 'text' : 'password');
        this.classList.toggle('on', cache);
        this.setAttribute('aria-label', cache ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      });

      const neuf = view.querySelector('#secNew');
      const conf = view.querySelector('#secConf');
      const boite = view.querySelector('#secForce');
      const mot = view.querySelector('#secForceMot');
      const jauge = view.querySelector('#secJauge');
      const conds = view.querySelector('#secCond');
      const aide = view.querySelector('#secConf-aide');
      const form = view.querySelector('#af') || view.querySelector('#sf');
      const bouton = form && form.querySelector('[type=submit]');
      if (!neuf) return;

      function revoir() {
        const v = neuf.value || '';
        const x = secExamen(v);

        if (boite) boite.hidden = !v;
        if (boite) boite.dataset.n = x.niveau;
        if (mot) mot.textContent = x.mot;
        /* La barre suit le NOMBRE de conditions remplies, pas le niveau : trois
           paliers pour quatre états auraient fait un saut de zéro à un tiers
           dès le premier caractère. */
        if (jauge) jauge.style.setProperty('--p', Math.round(x.n / 4 * 100) + '%');

        if (conds) SEC_COND.forEach(k => {
          const li = conds.querySelector('[data-c="' + k[0] + '"]');
          if (li) li.classList.toggle('ok', !!x.c[k[0]]);
        });

        const cv = conf ? (conf.value || '') : '';
        if (aide) {
          const pareil = cv && cv === v;
          aide.textContent = !cv ? '' : pareil ? 'Les deux correspondent' : 'Les deux ne correspondent pas';
          aide.className = 'prem-aide' + (!cv ? '' : pareil ? ' ok' : ' non');
        }

        /* Seule la longueur bloque, avec la concordance : les trois autres
           conditions sont des recommandations, et l'interface le dit. */
        if (bouton) bouton.disabled = !(x.c.long && cv && cv === v);
      }

      neuf.oninput = revoir;
      if (conf) conf.oninput = revoir;
      revoir();

      const env = view.querySelector('#envoyer');
      if (env) env.onclick = demander;
      const re = view.querySelector('#renvoyer');
      if (re) re.onclick = demander;
      const fs = view.querySelector('#sf');
      if (fs) fs.onsubmit = enregistrer;
      const fa = view.querySelector('#af');
      if (fa) fa.onsubmit = enregistrerAvecActuel;
      const pe = view.querySelector('#parEmail');
      if (pe) pe.onclick = () => { voie = 'demande'; paint(); };
      const pa = view.querySelector('#parActuel');
      if (pa) pa.onclick = () => { voie = 'actuel'; paint(); };
    }

    /* Les contrôles restent DANS les fonctions d'envoi, en plus de la
       validation en direct : celle-ci guide, elle ne garde pas la porte. Un
       formulaire envoyé au clavier, ou par un bouton réactivé à la main, doit
       buter sur les mêmes règles. */
    function verifier(d) {
      if ((d.password || '').length < 8) return 'Mot de passe trop court — 8 caractères minimum';
      if (d.password !== d.confirm) return 'Les deux mots de passe ne correspondent pas';
      return '';
    }

    /* Le chemin sans email : on redemande le mot de passe en cours. */
    async function enregistrerAvecActuel(e) {
      e.preventDefault();
      const btn = this.querySelector('[type=submit]');
      const d = UI.formData(this);

      if (!d.actuel) return UI.err('Saisissez votre mot de passe actuel');
      const souci = verifier(d);
      if (souci) return UI.err(souci);
      if (d.password === d.actuel) return UI.err('Le nouveau mot de passe est identique à l’ancien');

      UI.busy(btn, true, 'Vérification…');
      try {
        await API.changePasswordWithCurrent(d.actuel, d.password);
        UI.ok('Mot de passe modifié', 'Il est actif dès maintenant.');
        Router.go('/account', true);
      } catch (err) {
        UI.busy(btn, false);
        UI.err(err.message);
      }
    }

    async function demander() {
      const btn = view.querySelector('#envoyer') || view.querySelector('#renvoyer');
      UI.busy(btn, true, 'Envoi…');
      try {
        await API.sendEmailCode(adresse);
        voie = 'code';
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
      const souci = verifier(d);
      if (souci) return UI.err(souci);

      UI.busy(btn, true, 'Vérification…');
      try {
        /* Le code d'abord : il rouvre une session fraîche, et c'est elle qui
           autorise le changement. Dans l'autre ordre, on modifierait le mot de
           passe sans avoir rien prouvé. */
        await API.verifyEmailCode(adresse, code);
        await API.updatePassword(d.password);
        UI.ok('Mot de passe modifié', 'Il est actif dès maintenant.');
        Router.go('/account', true);
      } catch (err) {
        UI.busy(btn, false);
        UI.err(err.message);
      }
    }

    paint();

    return finNuit;
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
  /* ======================================================================
     ÉCRAN COMPTE DU CLIENT — cinq briques et rien d'autre
     ----------------------------------------------------------------------
     `cptLab` une étiquette de groupe, `cptGrp` un groupe, `cptLigne` une
     ligne, `cptRac` un raccourci, `cptFait` un fait de la carte d'état. Tout
     l'écran se monte avec elles : ajouter une rubrique demain, c'est ajouter un
     appel, pas un bloc de balises.

     CE QUI N'EST PAS LÀ, ET POURQUOI. Le brief demandait aussi Wallet,
     Favoris, Profil familial, Promotions, Moyens de paiement, Langue et une
     carte « Talabi Plus ». Aucun n'existe dans l'application : pas de table,
     pas d'écran, pas de règle de sécurité. Talabi Plus demanderait en plus un
     encaissement récurrent, que le paiement en espèces à la livraison ne permet
     pas. Un écran de compte dont la moitié des lignes ne mène nulle part fait
     douter de l'autre moitié — c'est le choix qui a été retenu : ne montrer que
     ce qui marche.
     ====================================================================== */
  function cptLab(t) {
    return '<div class="cpt-lab">' + U.esc(t) + '</div>';
  }

  function cptGrp(lignes) {
    return '<div class="cpt-grp">' + lignes.filter(Boolean).join('') + '</div>';
  }

  /**
   * Une ligne. `o.apres` remplace le chevron — c'est par là que passe
   * l'interrupteur du mode sombre, pour qu'un réglage et une porte se
   * ressemblent partout sauf à l'endroit précis où ils diffèrent.
   * Sans `o.href`, la ligne n'est pas cliquable : elle porte un réglage.
   */
  function cptLigne(o) {
    const dedans =
      '<span class="cpt-ic' + (o.ton ? ' ' + o.ton : '') + '">' + UI.icon(o.icone, 20) + '</span>' +
      '<span class="cpt-txt"><b>' + U.esc(o.titre) + '</b>' +
        (o.sous ? '<span>' + U.esc(o.sous) + '</span>' : '') + '</span>' +
      (o.apres || '<span class="cpt-chev">' + UI.icon('chevron', 19) + '</span>');
    if (!o.href) return '<div class="cpt-l cpt-l-fixe">' + dedans + '</div>';
    return '<a class="cpt-l" href="' + o.href + '"' +
      (o.neuf ? ' target="_blank" rel="noopener"' : '') + '>' + dedans + '</a>';
  }

  function cptRac(o) {
    const dedans =
      '<span class="cpt-rac-ic">' + UI.icon(o.icone, 23) +
        (o.marque ? '<span class="cpt-rac-n">' + U.esc(o.marque) + '</span>' : '') + '</span>' +
      '<span class="cpt-rac-t">' + U.esc(o.titre) + '</span>';
    return o.id
      ? '<button type="button" class="cpt-rac-c" id="' + o.id + '">' + dedans + '</button>'
      : '<a class="cpt-rac-c" href="' + o.href + '">' + dedans + '</a>';
  }

  function cptFait(cle, valeur) {
    return '<div class="cpt-fait"><span class="k">' + U.esc(cle) + '</span>' +
           '<span class="v">' + valeur + '</span></div>';
  }

  /* « août 2026 » plutôt qu'une date complète : sur cette carte, ce qui compte
     est l'ancienneté, pas le jour. */
  function moisAn(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d)) return '—';
      return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    } catch (e) { return '—'; }
  }

  function ecranClient(p, sonnerie) {
    const sombre = UI.sombreVoulu();
    const quartier = (Store.zoneName && Store.zoneName()) || Store.wilayaName && Store.wilayaName() || '—';

    return '<div class="account-page cpt">' +
      '<div class="wrap-sm page">' +

      /* ---- EN-TÊTE ----
         Le nom et la photo étaient volontairement absents de cet écran : ils
         s'affichaient à quelqu'un qui les connaît déjà, et exposaient son
         identité à qui regarde par-dessus son épaule. Le brief les redemande
         explicitement — c'est un arbitrage entre discrétion et repère, et il
         revient à celui qui conçoit l'application, pas à moi. */
      '<header class="cpt-tete">' +
        '<div class="cpt-tete-txt">' +
          '<div class="cpt-salut">Votre compte</div>' +
          '<h1 class="cpt-nom">' + U.esc(p.full_name || 'Votre profil') + '</h1>' +
          '<a class="cpt-modif" href="#/profil">' + UI.icon('pencil', 15) +
            ' Modifier le profil</a>' +
        '</div>' +
        '<a class="cpt-photo" href="#/profil" aria-label="Modifier ma photo">' +
          UI.avatar(p.full_name, p.avatar_url, 82) + '</a>' +
      '</header>' +

      /* ---- CARTE D'ÉTAT ----
         Trois faits, tous vérifiables : le quartier de livraison, l'ancienneté
         du compte, le nombre de commandes. Le brief demandait un « badge
         Premium » — il n'y a pas d'abonnement, donc pas de badge. Une
         distinction inventée sur un écran de compte est le genre de détail qui
         se remarque le jour où l'on cherche à quoi elle donne droit. */
      '<div class="cpt-etat">' +
        cptFait('Quartier', U.esc(quartier)) +
        cptFait('Membre depuis', p.created_at ? U.esc(moisAn(p.created_at)) : '—') +
        cptFait('Commandes', '<span id="cptNb">…</span>') +
      '</div>' +

      /* ---- TROIS RACCOURCIS ----
         Le brief demandait Favoris, Wallet et Commandes ; seul le dernier
         existe. La rangée garde son dessin, avec trois destinations réelles :
         ce qu'on vient chercher le plus souvent sur un écran de compte quand on
         attend un repas. */
      '<div class="cpt-rac">' +
        cptRac({ href: '#/orders', icone: 'package', titre: 'Commandes' }) +
        cptRac({ id: 'cptNotif', icone: 'bell', titre: 'Notifications',
                 marque: Store.unread ? (Store.unread > 9 ? '9+' : Store.unread) : '' }) +
        cptRac({ href: 'tel:' + U.esc(TALABI_CONFIG.SUPPORT_PHONE.replace(/\s/g, '')),
                 icone: 'headset', titre: 'Assistance' }) +
      '</div>' +

      cptLab('Mon compte') +
      cptGrp([
        cptLigne({ href: '#/compte', icone: 'user', titre: 'Mon compte',
                   sous: 'Quel compte est ouvert, et depuis quand' }),
        cptLigne({ href: '#/profil', icone: 'pencil', titre: 'Informations personnelles',
                   sous: 'Nom, genre, âge, quartier et adresses de livraison' }),
        cptLigne({ href: '#/securite', icone: 'lock', titre: 'Sécurité',
                   sous: 'Modifier mon mot de passe, vérifié par email' })
      ]) +

      cptLab('Préférences') +
      cptGrp([
        cptLigne({
          icone: sombre ? 'moon' : 'sun', titre: 'Mode sombre',
          sous: sombre ? 'Fond noir — reposant le soir et économe en batterie'
                       : 'Fond clair — plus lisible en plein soleil',
          apres: '<label class="switch"><input type="checkbox" id="sombre"' +
                 (sombre ? ' checked' : '') +
                 '><span class="track"><span class="knob"></span></span></label>'
        }),
        /* Un client n'a pas de sonnerie à couper : elle n'existe que pour qui
           reçoit des courses. La ligne reste conditionnée, comme avant. */
        (sonnerie ? cptLigne({
          icone: Sound.muted ? 'mute' : 'sound', titre: 'Sonnerie',
          sous: Sound.muted ? 'Coupée — vous ne serez plus averti par un son'
                            : 'Vous êtes averti à chaque course disponible',
          apres: '<label class="switch"><input type="checkbox" id="son"' +
                 (Sound.muted ? '' : ' checked') +
                 '><span class="track"><span class="knob"></span></span></label>'
        }) : '')
      ]) +

      cptLab('Aide') +
      cptGrp([
        cptLigne({ href: 'tel:' + U.esc(TALABI_CONFIG.SUPPORT_PHONE.replace(/\s/g, '')),
                   icone: 'phone', titre: 'Nous appeler',
                   sous: TALABI_CONFIG.SUPPORT_PHONE }),
        (TALABI_CONFIG.SUPPORT_EMAIL
          ? cptLigne({ href: 'mailto:' + U.esc(TALABI_CONFIG.SUPPORT_EMAIL),
                       icone: 'mail', titre: 'Nous écrire',
                       sous: TALABI_CONFIG.SUPPORT_EMAIL })
          : ''),
        cptLigne({ href: 'mailto:' + U.esc(TALABI_CONFIG.SUPPORT_EMAIL || '') +
                     '?subject=' + encodeURIComponent('Talabi — signalement'),
                   icone: 'warn', titre: 'Signaler un problème', ton: 'alerte',
                   sous: 'Décrivez ce que vous avez vu, on répond sous 7 jours' })
      ]) +

      cptLab('L’application') +
      cptGrp([
        cptLigne({ href: '#/apropos', icone: 'info', titre: 'À propos',
                   sous: TALABI_CONFIG.APP_NAME + ' version ' + (TALABI_CONFIG.APP_VERSION || '1.0') }),
        cptLigne({ href: U.escUrl(U.asset('confidentialite.html')), neuf: true,
                   icone: 'shield', titre: 'Confidentialité',
                   sous: 'Quelles données, pourquoi, et comment les effacer' })
      ]) +

      '<button class="cpt-sortie" id="logout">' + UI.icon('logout', 18) +
        ' Se déconnecter</button>' +

      '</div></div>';
  }

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
    if (!(await UI.confirm('Se déconnecter ?', 'Vous devrez vous reconnecter pour continuer.', 'Déconnexion', true))) return;
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
