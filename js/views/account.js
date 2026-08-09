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

      view.innerHTML = '<div class="account-page">' +
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

      /* ---- le genre : deux cartes, un seul choix ----
         Le même geste que pour le véhicule du livreur, volontairement : deux
         listes qui se ressemblent doivent se manipuler pareil. Un second appui
         sur la carte déjà choisie l'annule — sans ça, quelqu'un qui a touché
         par erreur ne pourrait plus revenir à « non renseigné ». */
      view.querySelectorAll('[data-g]').forEach(el => el.onclick = () => {
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
     SÉCURITÉ — changer son mot de passe, prouvé par email

     Trois étapes, sur un seul écran : on demande un code, on le saisit, on
     choisit le nouveau mot de passe. Le code prouve que la boîte mail est
     bien celle de la personne assise devant l'écran — sans lui, quelqu'un
     qui trouverait un téléphone déverrouillé changerait le mot de passe et
     prendrait le compte.
     ====================================================================== */
  Router.add('/securite', async function (params, query, view) {
    const finNuit = nuitCompte();
    const p = Store.profile || {};
    /* L'adresse de la session passe devant celle du profil. `profiles.email`
       n'est qu'une copie écrite à l'inscription : elle est vide sur certains
       comptes, en particulier ceux ouverts avec Google. On affichait alors
       « nous envoyons un code à  » — sans rien — et l'envoi partait avec une
       adresse vide, ce qui échouait avec un message en anglais. */
    const adresse = (p.email || '').trim() || API.email() || '';

    /* DEUX CHEMINS, ET LE PLUS SIMPLE D'ABORD.
       Il n'y avait que celui de l'email : un code envoyé, à ressaisir. C'est le
       bon chemin quand on a oublié son mot de passe — mais quand on le connaît,
       il oblige à attendre un email pour prouver ce qu'on vient de prouver en
       se connectant.

       Surtout, il dépendait d'un serveur SMTP extérieur. Le jour où celui-ci a
       refusé les identifiants (erreur 535), plus personne ne pouvait changer de
       mot de passe : l'unique porte passait par un service en panne. Le chemin
       « mot de passe actuel » ne dépend de rien d'autre que de la base. */
    let voie = 'actuel';          // actuel | demande → code

    function paint() {
      view.innerHTML = '<div class="account-page">' +
        '<span class="acc-dots a" aria-hidden="true"></span>' +
        '<div class="wrap-sm page">' +

        entete('Sécurité') +

        '<div class="card card-p acc-block">' +
          bloc('lock', 'Mot de passe') +

          (voie === 'actuel'
            ? '<p class="sub">Saisissez votre mot de passe actuel, puis le nouveau. ' +
                'Aucun email n’est nécessaire.</p>' +
              '<form id="af" class="stack" style="margin-top:14px" novalidate>' +
                '<div class="field"><label>Mot de passe actuel</label>' +
                  '<div class="input-ic"><span>' + UI.icon('lock', 17) + '</span>' +
                  '<input class="input" type="password" name="actuel" ' +
                    'placeholder="Celui que vous utilisez aujourd’hui" ' +
                    'autocomplete="current-password" required></div></div>' +
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
              '<button class="btn btn-ghost btn-block" id="parEmail" style="margin-top:10px">' +
                'Je ne connais pas mon mot de passe actuel</button>'

          : voie === 'demande'
            ? '<p class="sub">Pour changer votre mot de passe, nous envoyons un code à ' +
                '<b>' + U.esc(adresse) + '</b>. Il prouve que cette boîte mail est bien la vôtre.</p>' +
              '<button class="btn btn-primary btn-block btn-lg" id="envoyer" style="margin-top:14px">' +
                UI.icon('mail', 18) + ' Recevoir le code</button>'

            : '<p class="sub">Code envoyé à <b>' + U.esc(adresse) + '</b>. ' +
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
                'Je n’ai rien reçu — renvoyer un code</button>' +
              '<button class="btn btn-ghost btn-block" id="parActuel" style="margin-top:8px">' +
                'Revenir au mot de passe actuel</button>') +
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

      const fa = view.querySelector('#af');
      if (fa) fa.onsubmit = enregistrerAvecActuel;
      const pe = view.querySelector('#parEmail');
      if (pe) pe.onclick = () => { voie = 'demande'; paint(); };
      const pa = view.querySelector('#parActuel');
      if (pa) pa.onclick = () => { voie = 'actuel'; paint(); };
    }

    /* Le chemin sans email : on redemande le mot de passe en cours. */
    async function enregistrerAvecActuel(e) {
      e.preventDefault();
      const btn = this.querySelector('[type=submit]');
      const d = UI.formData(this);

      if (!d.actuel) return UI.err('Saisissez votre mot de passe actuel');
      if ((d.password || '').length < 6) return UI.err('Mot de passe trop court', '6 caractères minimum');
      if (d.password !== d.confirm) return UI.err('Les deux mots de passe ne correspondent pas');
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
      if ((d.password || '').length < 6) return UI.err('Mot de passe trop court', '6 caractères minimum');
      if (d.password !== d.confirm) return UI.err('Les deux mots de passe ne correspondent pas');

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
