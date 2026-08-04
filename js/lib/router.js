/* ==========================================================================
   ROUTER — navigation par hash (#/chemin), compatible ouverture locale
   ========================================================================== */
(function (w) {
  'use strict';

  const routes = [];
  let current = null;
  let cleanup = null;
  /* Numéro d'ordre de l'affichage en cours : sert à reconnaître une vue
     devenue périmée pendant son propre chargement. */
  let sequence = 0;

  function compile(pattern) {
    const keys = [];
    const rx = new RegExp('^' + pattern
      .replace(/\/$/, '')
      .replace(/:([A-Za-z0-9_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    return { rx: rx, keys: keys };
  }

  const Router = {

    /** Router.add('/resto/:id', handler, { roles:['client'], auth:true }) */
    add(pattern, handler, guard) {
      const c = compile(pattern);
      routes.push({ pattern: pattern, rx: c.rx, keys: c.keys, handler: handler, guard: guard || {} });
      return Router;
    },

    go(path, replace) {
      const h = '#' + (path.charAt(0) === '/' ? path : '/' + path);

      // Déjà sur cette adresse : aucun hashchange ne sera émis, on rend à la main.
      if (('#' + Router.path()) === h) return Router.render();

      // Sinon on laisse hashchange déclencher le rendu — une seule fois.
      // (Rendre ici en plus provoquait deux rendus concurrents : le premier
      // gardait des références vers des éléments que le second venait de
      // remplacer, et ses résultats n'apparaissaient jamais.)
      if (replace) location.replace(h);
      else location.hash = h;
    },

    back() { history.length > 1 ? history.back() : Router.go('/'); },

    path() {
      const h = location.hash.replace(/^#/, '');
      return h || '/';
    },

    get current() { return current; },

    async render() {
      /* Les panneaux vivent hors de #view : changer de page ne les efface pas.
         On les ferme ici, sinon un panneau resté ouvert recouvre un écran qui
         n'est plus celui qu'il commentait. */
      if (w.UI && UI.closeSheets) UI.closeSheets();

      const path = Router.path().split('?')[0];
      const query = {};
      const qs = Router.path().split('?')[1];
      if (qs) qs.split('&').forEach(p => {
        const [k, v] = p.split('=');
        query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });

      let match = null;
      for (const r of routes) {
        const m = path.replace(/\/$/, '').match(r.rx) || (path === '/' && r.pattern === '/' ? [''] : null);
        if (m) { match = { route: r, params: {} }; r.keys.forEach((k, i) => match.params[k] = decodeURIComponent(m[i + 1])); break; }
      }

      if (!match) {
        document.getElementById('view').innerHTML =
          '<div class="wrap page">' + UI.empty('🧭', 'Page introuvable',
            "Cette page n'existe pas ou a été déplacée.",
            '<button class="btn btn-primary" onclick="Router.go(\'/\')">Retour à l\'accueil</button>') + '</div>';
        Shell.render();
        return;
      }

      const g = match.route.guard;

      // --- garde : authentification
      if (g.auth && !Store.isLogged) {
        sessionStorage.setItem('talabi.after_login', path);
        return Router.go('/login', true);
      }

      // --- garde : rôle
      if (g.roles && Store.isLogged && g.roles.indexOf(Store.role) < 0) {
        UI.err('Accès refusé', 'Cette page est réservée aux comptes : ' + g.roles.join(', '));
        return Router.go(Router.homeFor(Store.role), true);
      }

      /* --- garde applicative : posée par les vues (profil incomplet…).
         Elle renvoie une adresse de redirection, ou rien pour laisser passer. */
      if (typeof Router.beforeEach === 'function') {
        let ailleurs = null;
        try { ailleurs = Router.beforeEach(path, match.route); } catch (e) { console.error(e); }
        if (ailleurs && ailleurs !== path) return Router.go(ailleurs, true);
      }

      if (typeof cleanup === 'function') { try { cleanup(); } catch (e) {} cleanup = null; }

      current = { path: path, params: match.params, query: query, pattern: match.route.pattern };

      /* Chaque affichage reçoit SON PROPRE conteneur, jeté au suivant.
         Une vue charge ses données de façon asynchrone puis écrit dans la page.
         Si l'on change de page pendant ce chargement, l'ancienne vue reprend la
         main après coup : avec un conteneur unique, elle écrasait la nouvelle
         page — ou, quand l'élément visé venait de disparaître, faisait planter
         tout l'affichage sur « Une erreur est survenue ».
         Avec un conteneur par affichage, elle écrit dans un élément détaché du
         document : sans effet, et sans casse. */
      const hote = document.getElementById('view');

      /* LA PAGE SORTANTE PART TOUT DE SUITE.

         Elle restait 260 ms de plus, hors du flux, pour se croiser avec la
         nouvelle. Ce croisement fonctionnait tant que le document entier
         défilait. Depuis que c'est #view qui défile, « hors du flux » veut
         dire posée sur toute la hauteur visible du conteneur : pendant un
         quart de seconde, l'ancienne page recouvrait la nouvelle. On
         appuyait sur Compte et on voyait Mes commandes — et en navigant vite,
         deux pages se superposaient pendant que le conteneur changeait de
         hauteur sous le doigt.

         Le fondu d'entrée de la nouvelle page suffit à éviter le à-coup. Un
         croisement qui montre la mauvaise page coûte plus cher qu'il ne
         rapporte. */
      const sortante = hote.firstElementChild;
      if (sortante) { try { sortante.remove(); } catch (e) {} }

      const view = document.createElement('div');
      view.className = 'view-in fade-in';
      hote.appendChild(view);
      const monTour = ++sequence;
      const encoreAffiche = () => monTour === sequence;

      try {
        const res = await match.route.handler(match.params, query, view);
        if (typeof res === 'function') {
          // un affichage périmé ne doit pas laisser derrière lui un nettoyage
          // qui s'appliquerait à la page suivante
          if (encoreAffiche()) cleanup = res;
          else { try { res(); } catch (e) {} }
        }
      } catch (e) {
        console.error(e);
        // une erreur survenue dans une vue déjà remplacée ne concerne plus
        // personne : l'afficher effacerait la page que l'utilisateur regarde
        if (encoreAffiche()) {
          view.innerHTML = '<div class="wrap page">' +
            UI.empty(UI.icon('warn', 40), 'Une erreur est survenue', e.message || '',
              '<button class="btn btn-ghost" onclick="location.reload()">Recharger</button>') + '</div>';
        }
      }

      if (!encoreAffiche()) return;   // une navigation plus récente a pris la main
      Shell.render();
      UI.scrollTop();
    },

    /** Page d'accueil correspondant au rôle */
    homeFor(role) {
      switch (role) {
        case 'driver':     return '/d';
        case 'admin':      return '/a';
        default:           return '/';
      }
    },

    start() {
      w.addEventListener('hashchange', () => Router.render());
      Router.render();
    }
  };

  w.Router = Router;
})(window);
