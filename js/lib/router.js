/* ==========================================================================
   ROUTER — navigation par hash (#/chemin), compatible ouverture locale
   ========================================================================== */
(function (w) {
  'use strict';

  const routes = [];
  let current = null;
  let cleanup = null;

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
      if (replace) location.replace(h);
      else location.hash = h;
      // si le hash est identique, on force le rendu
      if (('#' + Router.path()) === h) Router.render();
    },

    back() { history.length > 1 ? history.back() : Router.go('/'); },

    path() {
      const h = location.hash.replace(/^#/, '');
      return h || '/';
    },

    get current() { return current; },

    async render() {
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

      if (typeof cleanup === 'function') { try { cleanup(); } catch (e) {} cleanup = null; }

      current = { path: path, params: match.params, query: query, pattern: match.route.pattern };
      const view = document.getElementById('view');
      view.innerHTML = '';
      view.className = 'fade-in';

      try {
        const res = await match.route.handler(match.params, query, view);
        if (typeof res === 'function') cleanup = res;   // la vue peut renvoyer un "destructeur"
      } catch (e) {
        console.error(e);
        view.innerHTML = '<div class="wrap page">' +
          UI.empty('⚠️', 'Une erreur est survenue', e.message || '',
            '<button class="btn btn-ghost" onclick="location.reload()">Recharger</button>') + '</div>';
      }

      Shell.render();
      UI.scrollTop();
    },

    /** Page d'accueil correspondant au rôle */
    homeFor(role) {
      switch (role) {
        case 'restaurant': return '/r';
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
