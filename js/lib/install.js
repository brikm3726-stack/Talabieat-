/* ==========================================================================
   INSTALLATION SUR LE TÉLÉPHONE
   --------------------------------------------------------------------------
   Android et iPhone ne fonctionnent pas de la même façon, et c'est toute la
   difficulté :

   • Android (Chrome, Edge, Samsung Internet) émet un évènement
     `beforeinstallprompt`. On le met de côté, et le bouton « Installer
     l'appli » ouvre la vraie boîte de dialogue du système. Un clic, c'est
     installé.

   • iPhone (Safari) n'offre AUCUNE interface d'installation à une page web.
     Apple n'expose pas d'équivalent. Le seul chemin est manuel : Partager →
     « Sur l'écran d'accueil ». On ne peut donc que l'expliquer, clairement, et
     surtout ne pas afficher un bouton qui prétend installer et ne fait rien.

   • Sur ordinateur, Chrome et Edge acceptent aussi l'installation ; Firefox et
     Safari non. On s'aligne sur ce que le navigateur annonce.

   Une fois l'application installée, le bouton disparaît de lui-même.
   ========================================================================== */
(function (w) {
  'use strict';

  let invite = null;              // l'évènement mis de côté (Android)
  /* L'installation acceptée n'ouvre pas une fenêtre « installée » : l'onglet
     reste un onglet, et `display-mode: standalone` y reste faux. Sans ce
     drapeau, le bouton continuerait de proposer d'installer ce qui vient de
     l'être. */
  let dejaFait = false;
  const abonnes = [];

  function prevenir() { abonnes.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }

  /** Attend que le navigateur annonce l'installation, au plus `ms`. */
  function attendreInvite(ms) {
    if (invite) return Promise.resolve(true);
    return new Promise(resolve => {
      let fini = false;
      const stop = () => { if (fini) return; fini = true; off(); clearTimeout(t); resolve(!!invite); };
      const off = Install.onChange(() => { if (invite) stop(); });
      const t = setTimeout(stop, ms);
    });
  }

  const ua = navigator.userAgent || '';
  /* iPadOS 13+ se déclare comme un Mac : on le reconnaît au tactile. */
  const estIOS = /iPad|iPhone|iPod/.test(ua) ||
                 (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const estAndroid = /Android/.test(ua);
  /* Sur iPhone, seul Safari sait ajouter à l'écran d'accueil. Chrome et
     Firefox pour iOS n'ont pas cette option — il faut le dire. */
  const safariIOS = estIOS && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);

  const Install = {

    get plateforme() { return estIOS ? 'ios' : estAndroid ? 'android' : 'bureau'; },

    /** L'application tourne-t-elle déjà comme une appli installée ? */
    get installee() {
      return dejaFait ||
             w.matchMedia('(display-mode: standalone)').matches ||
             w.matchMedia('(display-mode: minimal-ui)').matches ||
             navigator.standalone === true;
    },

    /** Le navigateur a-t-il annoncé qu'il sait installer ? (Android, bureau) */
    get possible() { return !!invite; },

    /**
     * Faut-il proposer quelque chose ?
     * Sur téléphone, toujours : même sans évènement du navigateur, il reste le
     * mode d'emploi — mieux vaut expliquer que ne rien offrir. Sur ordinateur,
     * seulement si le navigateur sait vraiment installer.
     */
    get aProposer() {
      if (Install.installee) return false;
      return !!invite || estIOS || estAndroid;
    },

    /** Prévenu quand l'état change (invite reçue, application installée). */
    onChange(f) { abonnes.push(f); return () => { const i = abonnes.indexOf(f); if (i >= 0) abonnes.splice(i, 1); }; },

    /**
     * Lance l'installation. Sur Android, ouvre la boîte de dialogue du
     * système. Sur iPhone, affiche le mode d'emploi — il n'existe pas d'autre
     * moyen. Renvoie 'accepte', 'refuse', 'explique' ou 'impossible'.
     */
    async demander() {
      if (Install.installee) {
        UI.ok('Déjà installée', 'Talabi est sur votre écran d’accueil.');
        return 'installee';
      }

      /* Le navigateur met une à quelques secondes à annoncer qu'il sait
         installer. Quelqu'un qui touche le bouton tout de suite après
         l'ouverture de la page tombait sur le mode d'emploi alors que
         l'installation en un geste allait devenir possible. On laisse donc
         sa chance au navigateur avant de se rabattre sur les explications. */
      if (!invite && !estIOS) await attendreInvite(2500);

      if (invite) {
        const e = invite;
        invite = null;            // un évènement ne sert qu'une fois
        prevenir();
        e.prompt();
        let choix = 'refuse';
        try { choix = (await e.userChoice).outcome === 'accepted' ? 'accepte' : 'refuse'; }
        catch (err) { /* boîte fermée */ }
        if (choix === 'accepte') {
          dejaFait = true;
          UI.ok('Installation lancée', 'Talabi arrive sur votre écran d’accueil.');
        }
        prevenir();
        return choix;
      }

      Install.expliquer();
      return estIOS ? 'explique' : 'impossible';
    },

    /** Mode d'emploi, adapté au téléphone qui consulte la page. */
    expliquer() {
      const etape = (n, texte, ic) =>
        '<div class="ins-etape"><span class="n">' + n + '</span>' +
        '<div class="grow">' + texte + '</div>' +
        (ic ? '<span class="ic">' + ic + '</span>' : '') + '</div>';

      let corps, titre;

      if (estIOS && !safariIOS) {
        titre = 'Ouvrez cette page dans Safari';
        corps =
          '<p class="ins-intro">Sur iPhone, seul <b>Safari</b> peut ajouter un site à ' +
            'l’écran d’accueil. Chrome et Firefox pour iPhone n’ont pas cette option — ' +
            'c’est une limite d’Apple, pas de Talabi.</p>' +
          etape(1, 'Copiez l’adresse de cette page.', UI.icon('link', 20)) +
          etape(2, 'Ouvrez <b>Safari</b> et collez-la.', UI.icon('search', 20)) +
          etape(3, 'Suivez ensuite les étapes « Sur l’écran d’accueil ».', UI.icon('plus', 20));
      } else if (estIOS) {
        titre = 'Ajouter Talabi à l’écran d’accueil';
        corps =
          '<p class="ins-intro">Sur iPhone, l’ajout se fait en trois gestes. ' +
            'Ensuite Talabi s’ouvre comme une vraie application, en plein écran.</p>' +
          etape(1, 'Touchez le bouton <b>Partager</b>, en bas de Safari.', ICONE_PARTAGE) +
          etape(2, 'Faites défiler et choisissez <b>Sur l’écran d’accueil</b>.', UI.icon('plus', 20)) +
          etape(3, 'Touchez <b>Ajouter</b>, en haut à droite.', UI.icon('check', 20)) +
          '<div class="ins-note">' + UI.icon('warn', 17) +
            '<span>Si vous ne voyez pas « Sur l’écran d’accueil », faites glisser la ' +
            'liste vers le haut : elle se trouve dans la seconde partie du menu.</span></div>';
      } else if (estAndroid) {
        titre = 'Installer Talabi';
        corps =
          '<p class="ins-intro">Votre navigateur n’a pas encore proposé l’installation. ' +
            'Elle reste possible à la main :</p>' +
          etape(1, 'Touchez le menu <b>⋮</b>, en haut à droite du navigateur.', UI.icon('settings', 20)) +
          etape(2, 'Choisissez <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>.', UI.icon('plus', 20)) +
          etape(3, 'Confirmez : Talabi rejoint vos applications.', UI.icon('check', 20)) +
          '<div class="ins-note">' + UI.icon('warn', 17) +
            '<span>Le bouton d’installation automatique n’apparaît que sur Chrome, Edge ou ' +
            'Samsung Internet, et seulement sur le site en ligne (pas un fichier ouvert ' +
            'depuis le téléphone).</span></div>';
      } else {
        titre = 'Installer Talabi sur cet ordinateur';
        corps =
          '<p class="ins-intro">Sur ordinateur, l’installation fonctionne avec ' +
            '<b>Chrome</b> et <b>Edge</b>.</p>' +
          etape(1, 'Cherchez l’icône d’installation dans la barre d’adresse.', UI.icon('plus', 20)) +
          etape(2, 'Ou passez par le menu <b>⋮</b> → <b>Installer Talabi</b>.', UI.icon('settings', 20)) +
          '<div class="ins-note">' + UI.icon('warn', 17) +
            '<span>Firefox et Safari sur ordinateur ne savent pas installer un site. ' +
            'Talabi reste utilisable normalement dans votre navigateur.</span></div>';
      }

      UI.sheet({
        title: titre,
        icon: '<img src="' + U.asset('assets/img/icons/icon-192.png') + '" alt="" class="ins-logo">',
        subtitle: 'Talabi • Livraison de repas',
        body: '<div class="ins-body">' + corps + '</div>',
        footer: '<button class="btn btn-primary btn-block" data-x>J’ai compris</button>'
      });
    }
  };

  /* Icône « Partager » d'iOS, redessinée : la montrer évite d'avoir à décrire
     un bouton que l'utilisateur cherche des yeux. */
  const ICONE_PARTAGE =
    '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3v13"/><path d="m8 7 4-4 4 4"/>' +
    '<path d="M6 12H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"/></svg>';

  /* --------------------------------------------------------- évènements */
  w.addEventListener('beforeinstallprompt', e => {
    // sans preventDefault, Chrome affiche sa propre bannière et l'évènement
    // ne nous est plus utilisable
    e.preventDefault();
    invite = e;
    prevenir();
  });

  w.addEventListener('appinstalled', () => {
    invite = null;
    dejaFait = true;
    prevenir();
    UI.ok('Talabi est installée', 'Retrouvez-la sur votre écran d’accueil.');
  });

  /* ------------------------------------------------- service worker
     Indispensable pour que le navigateur propose l'installation, et c'est lui
     qui permet d'ouvrir l'application sans réseau. Il ne s'enregistre qu'en
     HTTPS (ou en local) : un fichier ouvert directement depuis le disque ne
     peut pas en avoir, et ce n'est pas une erreur. */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    w.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err =>
        console.warn('[install] service worker non enregistré :', err.message));
    });
  }

  w.Install = Install;
})(window);
