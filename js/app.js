/* ==========================================================================
   TALABI — Démarrage de l'application
   ========================================================================== */
(function (w) {
  'use strict';

  /* ====================================================================
     ÉCRAN D'OUVERTURE
     --------------------------------------------------------------------
     Cinq secondes, comptées depuis l'ouverture de la page — pas depuis la
     fin du chargement. Sur une bonne connexion l'application est prête en
     moins d'une seconde : sans cette retenue, le logo n'aurait que le temps
     d'apparaître avant de disparaître, et l'ouverture ressemblerait à un
     clignotement. Sur une connexion lente, le chargement dépasse les cinq
     secondes et l'écran s'efface dès qu'il est terminé : on ne fait jamais
     attendre en plus.
     ==================================================================== */
  const DUREE_INTRO = 5000;   // ms, animation de sortie comprise
  const SORTIE      = 700;    // doit couvrir la transition CSS de .sortie

  /* ====================================================================
     LA HAUTEUR DE LA FENÊTRE, MESURÉE ET NON DEVINÉE
     --------------------------------------------------------------------
     LE SYMPTÔME, SUR IPHONE : au démarrage, la page s'arrête avant le bas de
     l'écran et la barre de navigation flotte trop haut. Une rotation en
     paysage puis retour en portrait remet tout en place — et c'est justement
     ce détail qui désigne le coupable.

     LA CAUSE. La feuille de style fige la fenêtre à `100dvh` : c'est ce qui
     empêche le document de défiler et la barre du bas de suivre le doigt
     (voir « LA FENÊTRE EST FIGÉE » dans app.css). Mais au lancement depuis
     l'écran d'accueil, iOS annonce d'abord une fenêtre plus courte que
     l'écran — le temps que la barre d'état translucide et l'indicateur du
     bas soient pris en compte — puis l'agrandit SANS relayer l'information
     aux longueurs déjà calculées. `100dvh` garde donc la première valeur,
     trop petite. La rotation force un nouveau calcul : tout se remet en
     place, et c'est pour ça que le tour de passe-passe marche.

     LA PARADE. On mesure `innerHeight` nous-mêmes et on l'écrit dans
     `--app-h`, que la feuille de style utilise à la place de `100dvh` dès que
     la classe `h-js` est posée. La mesure est refaite à chaque évènement qui
     peut la changer — rotation, redimensionnement, retour dans l'application
     — ET quatre fois pendant la première seconde, parce que l'agrandissement
     d'iOS n'émet parfois aucun évènement du tout. Écrire la même valeur deux
     fois ne coûte rien : le navigateur ignore une propriété inchangée.

     Ce qu'on ne mesure PAS : `visualViewport.height`. Elle rétrécit quand le
     clavier s'ouvre — l'application entière se serait repliée à chaque
     saisie, ce que ni `dvh` ni l'ancien code ne faisaient.
     ==================================================================== */
  const racine = document.documentElement;
  let derniereHauteur = 0;

  function mesurerHauteur() {
    const h = w.innerHeight;
    if (!h || h === derniereHauteur) return;
    derniereHauteur = h;
    racine.style.setProperty('--app-h', h + 'px');
    racine.classList.add('h-js');
    recalerLesBarres();
  }

  /* LES DEUX BARRES SONT EN `position:fixed` : ELLES NE SUIVENT PAS `--app-h`.
     Un élément fixe se place par rapport à la fenêtre du navigateur et par
     rapport aux marges de sécurité (`env(safe-area-inset-bottom)`, l'espace de
     l'indicateur du bas). Corriger la hauteur du corps ne les déplace donc pas
     d'un pixel — c'est pour ça que la barre du bas restait montée alors même
     que le reste de la page se remettait en place.

     Les cacher puis les remontrer force le navigateur à recalculer leur
     position avec les valeurs du moment. C'est exactement ce que produit la
     rotation de l'écran, en un aller-retour trop court pour se voir : la
     lecture de `offsetHeight` entre les deux oblige le calcul à se faire
     avant que la barre ne réapparaisse.

     Uniquement quand la hauteur A CHANGÉ : appelé à chaque évènement, ce
     clignotement finirait par se voir. */
  function recalerLesBarres() {
    ['topbar', 'bottomnav'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const avant = el.style.display;
      el.style.display = 'none';
      void el.offsetHeight;
      el.style.display = avant;
    });
  }

  mesurerHauteur();
  ['resize', 'orientationchange', 'pageshow', 'focus'].forEach(ev =>
    w.addEventListener(ev, mesurerHauteur));
  /* `visualViewport` bouge aussi quand la barre d'adresse du navigateur
     s'escamote — un cas que `resize` ne signale pas toujours sur iOS. On y lit
     quand même `innerHeight`, jamais la hauteur du viewport visuel. */
  if (w.visualViewport) w.visualViewport.addEventListener('resize', mesurerHauteur);
  [60, 250, 600, 1200].forEach(ms => setTimeout(mesurerHauteur, ms));

  function finDeLIntro() {
    const splash = document.getElementById('splash');
    if (!splash) return Promise.resolve();

    // performance.now() part de l'ouverture de la page : c'est bien le temps
    // vu par l'utilisateur depuis son clic, pas le temps de calcul.
    const reste = Math.max(0, DUREE_INTRO - SORTIE - performance.now());

    return new Promise(resolve => {
      setTimeout(() => {
        splash.classList.add('sortie');
        /* LA BANDE QU'iOS PEINT LUI-MÊME CHANGE DE COULEUR AVEC L'AFFICHE.

           Sur iPhone, la fenêtre du navigateur est plus courte que l'écran —
           59 pt de moins, mesurés sur un 14 Pro — et iOS peint la différence
           avec la couleur de `theme-color`. Aucun CSS ne l'atteint : cette
           bande est en dehors de la page.

           Elle vaut donc le blanc de l'écran d'ouverture pendant celui-ci
           (voir index.html), et le noir de l'application dès qu'il s'efface.
           Sans ce second temps, un bandeau blanc resterait collé en bas d'une
           application entièrement sombre.

           Le changement accompagne le fondu de sortie, pas la disparition :
           les deux couleurs se croisent ainsi au même instant, sans que la
           bande clignote entre les deux. */
        const m = document.querySelector('meta[name="theme-color"]');
        if (m) m.setAttribute('content', UI.couleurBarre());
        setTimeout(() => {
          splash.remove();
          /* La fenêtre a eu cinq secondes pour prendre sa taille définitive :
             on la remesure au moment où l'application devient visible. C'est
             le dernier instant où une correction passe inaperçue.

             Et on recale les barres MÊME SI la hauteur n'a pas bougé : le
             défaut peut venir des marges de sécurité (l'espace de l'indicateur
             du bas), qu'iOS annonce parfois trop grandes au lancement puis
             corrige. Une hauteur inchangée ne dit rien de ces marges-là. */
          mesurerHauteur();
          recalerLesBarres();
          resolve();
        }, SORTIE);
      }, reste);
    });
  }

  /* ====================================================================
     PREMIÈRE OUVERTURE
     --------------------------------------------------------------------
     Le repère vit dans le navigateur, donc « première fois » veut dire
     première fois sur CET appareil. C'est bien ce qu'on veut : quelqu'un qui
     installe l'application sur son téléphone doit être accueilli, même s'il
     connaît déjà le site depuis son ordinateur.
     ==================================================================== */
  const CLE_PREMIERE_VISITE = 'talabi.deja_venu';

  function premiereVisite() {
    try {
      if (localStorage.getItem(CLE_PREMIERE_VISITE)) return false;
      localStorage.setItem(CLE_PREMIERE_VISITE, String(Date.now()));
      return true;
    } catch (e) {
      // navigation privée ou stockage refusé : on n'insiste pas
      return false;
    }
  }

  /** Une page précise a-t-elle été demandée dans l'adresse ? */
  function cheminDemande() {
    return location.hash.replace(/^#\/?/, '').length > 0;
  }

  /**
   * Lit ce que le serveur d'authentification a mis dans l'adresse, que ce soit
   * dans le hash (#access_token=…, #error=…) ou dans la requête (?code=…).
   * Rien n'est modifié ici : on se contente de photographier l'adresse avant
   * que la librairie Supabase ne la nettoie.
   */
  function lireRetourAuth() {
    const hash = location.hash.replace(/^#/, '');
    const query = location.search.replace(/^\?/, '');
    const lire = (source, cle) => {
      try { return new URLSearchParams(source).get(cle); } catch (e) { return null; }
    };
    const erreur = lire(hash, 'error_description') || lire(query, 'error_description') ||
                   lire(hash, 'error')             || lire(query, 'error');
    const tout = hash + '&' + query;

    return {
      recovery: /type=recovery/.test(tout),
      attenduSession: /(^|[&?])(access_token|code)=/.test(tout),
      erreur: erreur || ''
    };
  }

  function fail(message, detail) {
    const splash = document.getElementById('splash');
    /* L'écran d'entrée est une photo plein cadre : un message d'erreur écrit
       par-dessus serait illisible. On retire la photo avant d'écrire. */
    splash.classList.add('panne');
    splash.innerHTML =
      '<div class="wrap-sm center" style="color:#fff">' +
        '<div style="font-size:44px">⚠️</div>' +
        '<div class="h2" style="margin-top:10px">' + U.esc(message) + '</div>' +
        '<p style="opacity:.9;margin-top:8px;font-size:14px">' + U.esc(detail || '') + '</p>' +
        '<button class="btn" style="margin-top:18px;background:#fff;color:var(--brand)" ' +
        'onclick="location.reload()">Réessayer</button>' +
      '</div>';
  }

  async function boot() {
    try {
      /* ---- 0. Sans base de données, il n'y a pas d'application ---- */
      if (!w.TALABI_CONFIGURED) {
        return fail('Base de données non configurée',
          'Renseignez SUPABASE_URL et SUPABASE_ANON_KEY dans le fichier config.js ' +
          '(Supabase → Project Settings → API), puis rechargez la page.');
      }

      /* ---- 1. Ce que Supabase a déposé dans l'adresse ----
         Retour de Google, d'un lien de confirmation ou de récupération : tout
         arrive par l'adresse de la page. On la lit AVANT d'initialiser le
         backend, car celui-ci la nettoie en passant. */
      const retour = lireRetourAuth();

      /* ---- 2. Backend ---- */
      await API.init();

      /* le lien de récupération mène au formulaire de nouveau mot de passe —
         après l'init, sinon on effacerait le jeton avant sa lecture.
         Deux sources : l'ancien format, qui écrivait type=recovery dans
         l'adresse, et l'évènement PASSWORD_RECOVERY du format actuel. */
      if (retour.recovery || API.recoveryPending) location.hash = '#/reset';

      /* ---- 3. Retour d'une connexion Google : appliquer le rôle choisi ---- */
      if (API.applyPendingRole) { try { await API.applyPendingRole(); } catch (e) { console.warn(e); } }

      /* ---- 4. Données de référence + session ---- */
      await Store.boot();

      /* ---- 5. Réactions aux évènements du backend ---- */
      let lastNotifId = null;
      if (Store.isLogged) {
        const first = await API.safe(() => API.notifications(1), []);
        lastNotifId = first.length ? first[0].id : '';
      }

      API.onChange(async function (what) {
        if (what === 'session') {
          await Store.refreshProfile();
          LiveTrack.sync();          // coupe le partage de position à la déconnexion
          // nouveau compte : ce qui a sonné pour le précédent ne compte plus,
          // et une commande déjà en attente doit se signaler tout de suite
          if (w.Sound) { Sound.stopAll(); Sound.forget(); Sound.watchOrders(); }
          Shell.render();
          Router.render();
          return;
        }
        if (what === 'orders') { LiveTrack.sync(); ouvrirLeSuivi(); }
        // sonne dès qu'une commande attend une réponse, se tait dès qu'il n'y
        // en a plus
        if (w.Sound) Sound.watchOrders();
        // toute autre modification peut faire évoluer le compteur de notifications
        if (!Store.isLogged) return;
        await Store.refreshUnread();
        Shell.renderTop();
        // le point orange de l'onglet Commandes suit le compteur non lu
        Shell.renderNav();

        // annonce visuelle — et sonore — de la dernière notification reçue
        const list = await API.safe(() => API.notifications(1), []);
        if (list.length && list[0].id !== lastNotifId) {
          if (lastNotifId !== null && !list[0].is_read) UI.toast(list[0].title, 'ok', list[0].body);
          lastNotifId = list[0].id;
        }
      });

      Store.subscribe(what => {
        if (what === 'cart') Shell.renderNav();
        if (what === 'wilaya') Shell.renderTop();
      });

      /* Où est la personne ? La barre du haut annonce sa wilaya, et le
         téléphone connaît la réponse. On la demande une seule fois, en tâche
         de fond : refus ou échec, la wilaya par défaut reste affichée et rien
         ne s'arrête. On n'attend surtout pas la réponse pour ouvrir la page —
         le navigateur peut mettre plusieurs secondes à poser la question. */
      if (App.est('client') && !Store.wilaya) Store.detectWilaya();

      /* ---- 6. Navigation ---- */

      /* Première ouverture : on présente l'application avant tout le reste.
         Uniquement si le visiteur n'est pas connecté et n'a demandé aucune
         page précise — un lien partagé vers un restaurant doit ouvrir ce
         restaurant, pas un écran d'accueil. */
      if (!Store.isLogged && premiereVisite() && !cheminDemande()) location.hash = '#/login';

      Router.start();

      // Une commande peut déjà attendre au moment où l'on ouvre l'application.
      // Le son ne partira qu'au premier clic (les navigateurs l'exigent), mais
      // il partira : la demande est mise de côté, pas perdue.
      if (w.Sound) Sound.watchOrders();

      // un livreur qui rouvre l'app en pleine course reprend le partage
      LiveTrack.sync();

      // un client qui rouvre l'app pendant qu'on le livre retombe sur le suivi
      ouvrirLeSuivi();

      horlogeDesDelais();

      /* ---- 7. Fin de l'écran d'ouverture ---- */
      await finDeLIntro();

      /* ---- 8. Un retour de connexion qui n'a rien donné ne doit pas être
                silencieux : sans message, l'utilisateur revient sur l'accueil
                déconnecté et croit que le site est cassé. ---- */
      if (retour.erreur) {
        UI.err('Connexion impossible', retour.erreur);
      } else if (retour.attenduSession && !Store.isLogged) {
        UI.err('Connexion impossible',
          "Google a répondu, mais la session n'a pas pu s'ouvrir. Essayez depuis " +
          'le navigateur plutôt que depuis l’icône de l’écran d’accueil.');
      }

    } catch (e) {
      console.error(e);
      fail('Impossible de démarrer l’application', e.message);
    }
  }

  /* ====================================================================
     « UN LIVREUR A PRIS VOTRE COMMANDE » — OUVERTURE DU SUIVI
     --------------------------------------------------------------------
     À la seconde où un livreur accepte, le client n'a plus rien à faire :
     il veut voir la moto avancer. Il fallait pourtant qu'il l'apprenne par
     un message, retrouve sa commande, l'ouvre, descende jusqu'à la carte,
     et appuie sur « plein écran » — cinq gestes pour la seule chose qui
     l'intéresse à ce moment-là. L'écran s'ouvre donc tout seul.

     Deux garde-fous, parce qu'une page qui s'impose est une page qui
     agace :

     • UNE FOIS PAR COMMANDE. Le client qui referme le suivi pour aller
       voir autre chose ne doit pas y être ramené à chaque relevé de
       position. La mémoire tient dans sessionStorage : elle dure le temps
       de l'onglet, ce qui correspond à la durée d'une livraison.

     • JAMAIS PAR-DESSUS UN GESTE EN COURS. Une commande en train d'être
       validée, un compte en train d'être créé : on ne remplace pas l'écran
       sous les doigts de quelqu'un. Le suivi attendra le relevé suivant,
       quinze secondes plus tard.
     ==================================================================== */
  const MEM_SUIVI = 'talabi.suivi_ouvert';

  function dejaOuvert(id) {
    try { return (sessionStorage.getItem(MEM_SUIVI) || '').split(',').indexOf(id) >= 0; }
    catch (e) { return false; }
  }
  function noterOuvert(id) {
    try {
      const v = (sessionStorage.getItem(MEM_SUIVI) || '').split(',').filter(Boolean);
      v.push(id);
      /* On ne garde que les dernières : la liste n'a pas à enfler pendant
         toute une soirée de commandes. */
      sessionStorage.setItem(MEM_SUIVI, v.slice(-8).join(','));
    } catch (e) {}
  }

  /* Les écrans qu'on ne recouvre pas : on y est en train de faire quelque
     chose dont on ne veut pas perdre le fil. */
  const OCCUPE = ['/checkout', '/login', '/signup', '/reset', '/live/'];

  async function ouvrirLeSuivi() {
    if (!App.est('client') || !Store.isLogged || Store.role !== 'client') return;

    const ici = Router.path().split('?')[0];
    if (OCCUPE.some(p => ici.indexOf(p) === 0)) return;

    const list = await API.safe(() => API.orders({ scope: 'client' }), []);

    /* LA RÉCEPTION EST UN ÉVÉNEMENT, PAS UN ÉTAT.
       Une commande livrée et jamais confirmée le reste indéfiniment : sans
       cette limite, l'écran de réception d'un repas d'avant-hier s'ouvrait à
       CHAQUE lancement de l'application, et pour l'écarter il fallait
       confirmer une commande qu'on avait oubliée. Un rappel qui se répète sans
       fin n'est plus un rappel, c'est un obstacle.

       Passé une demi-heure, ce n'est plus un instant à saisir mais une ligne
       d'historique : le bouton reste sur la page de la commande, il ne vient
       plus au-devant. */
    const RAPPEL_MS = 30 * 60 * 1000;
    const fraiche = x => {
      if (!x.delivered_at) return false;
      return Date.now() - new Date(x.delivered_at).getTime() < RAPPEL_MS;
    };

    const o = list.find(x =>
      ['driver_assigned', 'delivering'].indexOf(x.status) >= 0 ||
      (x.status === 'delivered' && !x.client_confirmed && fraiche(x)));
    if (!o) return;

    /* Deux moments distincts dans la vie d'une commande, donc deux mémoires :
       sans ça, un client qui a suivi son livreur ne verrait jamais s'ouvrir
       l'écran de réception — la commande étant déjà « déjà ouverte ». */
    const cle = o.status === 'delivered' ? o.id + ':recu' : o.id;
    if (dejaOuvert(cle)) return;

    noterOuvert(cle);
    Router.go('/live/' + o.id);
  }

  /* ====================================================================
     HORLOGE DES DÉLAIS
     --------------------------------------------------------------------
     Une seule horloge pour tout le site, qui ne fait que deux choses :
     rafraîchir le texte des comptes à rebours affichés, et demander au
     backend d'appliquer les délais échus.

     Elle ne bat que si un compte à rebours est à l'écran. Un site ouvert sur
     la carte d'un restaurant n'a aucune raison de réveiller le processeur du
     téléphone chaque seconde — et rien n'expire tant que personne n'attend.
     ==================================================================== */
  function horlogeDesDelais() {
    let dernierTick = 0;

    setInterval(async () => {
      const chronos = document.querySelectorAll('.cdown[data-until]');
      if (!chronos.length) return;

      let echu = false;
      chronos.forEach(el => {
        const reste = U.secondsLeft(el.dataset.until);
        const t = el.querySelector('.t');
        if (t) t.textContent = U.mmss(reste);
        el.classList.toggle('urgent', reste <= (+el.dataset.alert || 60));
        if (reste <= 0) { el.classList.add('fini'); echu = true; }
      });

      // Un compte à rebours vient de tomber : on applique le délai tout de
      // suite. Sinon on laisse passer 10 s — inutile de marteler le backend
      // pendant qu'il reste 4 minutes au chronomètre.
      const maintenant = Date.now();
      if (!echu && maintenant - dernierTick < 10000) return;
      dernierTick = maintenant;
      if (API.tick) await API.safe(() => API.tick(), false);
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ------------------------------------------------------------ divers */

  // fermeture des modales avec la touche Échap
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const root = document.getElementById('modal-root');
    const last = root && root.lastElementChild;
    if (last) {
      const x = last.querySelector('[data-x]');
      if (x) x.click(); else last.remove();
    }
  });

  // avertissement hors-ligne
  w.addEventListener('offline', () => UI.err('Connexion perdue', 'Vérifiez votre réseau.'));
  w.addEventListener('online', () => UI.ok('Connexion rétablie'));
})(window);
