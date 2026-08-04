/* ==========================================================================
   UI — toasts, modales, helpers DOM
   ========================================================================== */
(function (w) {
  'use strict';

  const UI = {

    /** Compteur de modales — sert à reconnaître notre entrée d'historique. */
    _nSheet: 0,

    /* ------------------------------------------------------------- toasts */
    toast(msg, kind, sub) {
      const box = document.getElementById('toasts');
      if (!box) return;
      const t = document.createElement('div');
      t.className = 'toast ' + (kind || '');
      t.innerHTML =
        '<span>' + (kind === 'ok' ? '✅' : kind === 'err' ? '⚠️' : 'ℹ️') + '</span>' +
        '<div class="t-body">' + U.esc(msg) + (sub ? '<small>' + U.esc(sub) + '</small>' : '') + '</div>';
      box.appendChild(t);
      setTimeout(() => {
        t.style.transition = '.25s'; t.style.opacity = '0'; t.style.transform = 'translateY(-12px)';
        setTimeout(() => t.remove(), 260);
      }, kind === 'err' ? 4200 : 2800);
    },

    ok(m, s)  { UI.toast(m, 'ok', s); },
    err(m, s) { UI.toast(m, 'err', s); },

    /**
     * « Vous êtes à Tizi Ouzou » — la confirmation de position.
     *
     * Elle passait par le toast ordinaire, celui qui sert aussi bien à « Plat
     * ajouté » qu'à « Profil enregistré ». Or trouver sa ville n'est pas un
     * message parmi d'autres : c'est le moment où l'application dit qu'elle
     * sait où l'on est, et c'est de là que découlent les restaurants qu'on
     * verra et le prix qu'on paiera. Elle a donc sa propre forme — une
     * capsule qu'on reconnaît du premier coup d'œil.
     *
     * Trois zones, de gauche à droite : la coche dit que c'est fait, le
     * centre dit où, le repère rappelle de quoi on parle.
     */
    place(nom) {
      const box = document.getElementById('toasts');
      if (!box || !nom) return;
      const t = document.createElement('div');
      t.className = 'loc-pop';
      t.setAttribute('role', 'status');
      t.innerHTML =
        '<span class="loc-ok" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
            'stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="m5 12.6 4.6 4.6L19 7.4"/></svg></span>' +
        '<span class="loc-txt">Vous êtes à <b>' + U.esc(nom) + '</b></span>' +
        '<span class="loc-pin" aria-hidden="true">' + UI.icon('pin', 22) + '</span>';
      box.appendChild(t);
      setTimeout(() => {
        t.style.transition = '.3s ease';
        t.style.opacity = '0';
        t.style.transform = 'translateY(-10px) scale(.96)';
        setTimeout(() => t.remove(), 320);
      }, 3400);
    },

    /* --------------------------------------------------- champ qui s'écrit */
    /**
     * UI.typewriter(input, mots) — le repère du champ s'écrit et s'efface.
     *
     * Un champ de recherche vide ne dit pas ce qu'on peut y mettre. « Un
     * restaurant ou un plat » est une consigne, pas un exemple : on la lit,
     * on ne sait toujours pas quoi taper. Un vrai nom qui s'écrit sous les
     * yeux — « Ex : Melyza tacos » — montre la réponse au lieu de la
     * décrire, et prouve au passage qu'il y a quelque chose derrière.
     *
     * S'arrête définitivement dès que le client tape : à partir de là, le
     * champ lui appartient, et un repère qui continue de bouger derrière ce
     * qu'on écrit rend la saisie illisible.
     *
     * Retourne { stop, mots } — `mots` permet de remplacer la liste plus
     * tard, quand les vrais noms de restaurants sont arrivés du serveur.
     */
    typewriter(input, mots, opts) {
      const rien = { stop() {}, mots() {} };
      if (!input || !mots || !mots.length) return rien;
      opts = opts || {};

      const repos = opts.repos || input.getAttribute('placeholder') || '';
      /* Qui a demandé moins de mouvement garde la consigne fixe : elle
         suffit à comprendre le champ, le reste n'est qu'un plus. */
      if (w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) return rien;

      let liste = mots.slice();
      let i = 0, j = 0, efface = false, mort = false, gele = false, t = null;

      const stop = (definitif) => {
        clearTimeout(t);
        if (definitif) { mort = true; input.setAttribute('placeholder', repos); }
      };

      const tic = () => {
        if (mort) return;
        /* La vue a pu être remplacée entre deux battements : sans ce
           contrôle, la minuterie survivrait à la page et tournerait pour un
           champ qui n'existe plus. */
        if (!document.body.contains(input)) return stop(true);
        if (input.value) return stop(true);
        // rien à écrire tant que l'onglet est caché ou que le doigt est dans
        // le champ : on repasse simplement plus tard
        if (gele || document.hidden) { t = setTimeout(tic, 400); return; }

        const mot = liste[i % liste.length];
        if (!efface) {
          j++;
          input.setAttribute('placeholder', mot.slice(0, j) + '|');
          if (j >= mot.length) { efface = true; t = setTimeout(tic, opts.pause || 1700); return; }
          // la frappe n'est jamais régulière : une cadence fixe s'entend
          // comme une machine, une cadence irrégulière comme quelqu'un
          t = setTimeout(tic, 46 + Math.random() * 44);
        } else {
          j--;
          input.setAttribute('placeholder', mot.slice(0, j) + (j ? '|' : ''));
          if (j <= 0) { efface = false; i++; t = setTimeout(tic, 340); return; }
          t = setTimeout(tic, 25);   // on efface plus vite qu'on n'écrit
        }
      };

      input.addEventListener('input', () => stop(true));
      /* Au moment où le doigt entre dans le champ, l'exemple se fige — et la
         consigne reprend sa place. On vient taper : c'est « un restaurant ou
         un plat » qu'il faut avoir sous les yeux, pas un mot à moitié écrit.
         Si on ressort sans rien saisir, les exemples reprennent. */
      input.addEventListener('focus', () => {
        gele = true;
        input.setAttribute('placeholder', repos);
      });
      input.addEventListener('blur', () => { gele = false; j = 0; efface = false; });

      t = setTimeout(tic, opts.debut || 700);

      return {
        stop: () => stop(true),
        mots(nouveaux) {
          if (!nouveaux || !nouveaux.length || mort) return;
          /* On ne remet pas le compteur à zéro : la nouvelle liste prend le
             relais au mot suivant. Basculer au milieu d'un mot ferait sauter
             le texte d'un nom à l'autre en pleine frappe. */
          liste = nouveaux.slice();
        }
      };
    },

    /* ------------------------------------------------------------ modales */
    /**
     * UI.sheet({ title, body, footer, onMount, wide })
     * Retourne { close, el }
     *
     * UNE MODALE EST UNE ÉTAPE DE PLUS DANS L'HISTORIQUE.
     *
     * Elle vit dans #modal-root, hors de #view : une navigation ne la détruit
     * pas. Sans précaution, appuyer sur « retour » pendant qu'un panneau est
     * ouvert changeait la page DERRIÈRE le panneau — qui, lui, restait au
     * premier plan, par-dessus un écran qui n'était plus le bon. Le document
     * restait aussi bloqué en overflow:hidden. Rien ne « revenait ».
     *
     * On empile donc une entrée d'historique à l'ouverture. Le retour du
     * téléphone la dépile et ne fait que fermer le panneau — le geste attendu.
     * Fermer par la croix retire cette entrée à son tour, pour que l'historique
     * reste le reflet exact de ce que l'utilisateur a traversé.
     *
     * close(suite) : `suite` est exécutée APRÈS le dépilement. Naviguer avant
     * qu'il ait eu lieu ferait reculer d'un cran la page qu'on vient d'ouvrir.
     */
    sheet(opts) {
      const root = document.getElementById('modal-root');
      const ov = document.createElement('div');
      ov.className = 'overlay';
      ov.innerHTML =
        '<div class="sheet" role="dialog" aria-modal="true">' +
          (opts.title !== false ?
            '<div class="sheet-head">' +
              (opts.icon ? '<span class="sheet-ic">' + opts.icon + '</span>' : '') +
              '<div class="grow"><div class="h3">' + U.esc(opts.title || '') + '</div>' +
                (opts.subtitle ? '<div class="tiny">' + U.esc(opts.subtitle) + '</div>' : '') + '</div>' +
            '<button class="icon-btn" data-x>✕</button></div>' : '') +
          '<div class="sheet-body">' + (opts.body || '') + '</div>' +
          (opts.footer ? '<div class="sheet-foot">' + opts.footer + '</div>' : '') +
        '</div>';
      root.appendChild(ov);
      document.body.style.overflow = 'hidden';
      /* Sur téléphone la fenêtre ne défile plus : c'est #view qui défile. Le
         bloquer aussi, sinon la page continue de glisser sous le panneau. */
      const vue = document.getElementById('view');
      if (vue) vue.style.overflow = 'hidden';

      const jeton = 'sh' + (++UI._nSheet);
      let empile = false, fini = false;
      try {
        w.history.pushState({ talabiSheet: jeton }, '', w.location.href);
        empile = true;
      } catch (e) {}

      const retirer = () => {
        if (fini) return; fini = true;
        w.removeEventListener('popstate', surRetour);
        ov.style.transition = '.16s'; ov.style.opacity = '0';
        setTimeout(() => {
          ov.remove();
          if (!root.children.length) {
            document.body.style.overflow = '';
            if (vue) vue.style.overflow = '';
          }
        }, 160);
      };

      /* Le retour du téléphone : notre entrée vient d'être dépilée, il n'y a
         plus rien à dépiler — on ferme, c'est tout. */
      function surRetour() { empile = false; retirer(); }
      w.addEventListener('popstate', surRetour);

      const close = (arg) => {
        /* close est aussi branché sur des clics : l'argument reçu peut être un
           évènement. Seule une fonction est une suite à exécuter. */
        const suite = (typeof arg === 'function') ? arg : null;
        if (fini) return;
        const aDepiler = empile &&
          w.history.state && w.history.state.talabiSheet === jeton;
        retirer();
        if (!aDepiler) { if (suite) suite(); return; }
        if (suite) {
          w.addEventListener('popstate', function unefois() {
            w.removeEventListener('popstate', unefois);
            suite();
          });
        }
        w.history.back();
      };

      ov.addEventListener('click', e => { if (e.target === ov) close(); });
      // querySelectorAll et non querySelector : une modale a souvent DEUX
      // boutons de fermeture — la croix de l'en-tête et un bouton de pied de
      // page (« J'ai compris »). Avec querySelector, seule la croix marchait
      // et le bouton du bas ne faisait rien.
      ov.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => close()));

      const api = { close, el: ov };
      ov._fermer = close;
      if (opts.onMount) opts.onMount(ov, api);
      return api;
    },

    /* Filet de sécurité : si la page change pour une raison qui n'est pas le
       bouton retour — un lien à l'intérieur d'un panneau, une redirection —
       aucun panneau ne doit survivre à l'écran qu'il recouvrait. */
    closeSheets() {
      const root = document.getElementById('modal-root');
      if (!root) return;
      Array.prototype.slice.call(root.children).forEach(ov => {
        if (ov._fermer) ov._fermer(); else ov.remove();
      });
    },

    /** Confirmation — retourne une Promise<boolean> */
    confirm(title, message, okLabel, danger) {
      return new Promise(resolve => {
        let done = false;
        const m = UI.sheet({
          title: title,
          body: '<p style="color:var(--muted);font-size:14.5px">' + U.esc(message || '') + '</p>',
          footer: '<div class="row" style="gap:10px">' +
                  '<button class="btn btn-ghost grow" data-no>Annuler</button>' +
                  '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + ' grow" data-yes>' +
                  U.esc(okLabel || 'Confirmer') + '</button></div>',
          onMount(el, api) {
            el.querySelector('[data-no]').onclick = () => { done = true; api.close(); resolve(false); };
            el.querySelector('[data-yes]').onclick = () => { done = true; api.close(); resolve(true); };
            el.addEventListener('click', e => { if (e.target === el && !done) resolve(false); });
          }
        });
        m.el.querySelector('[data-x]') && (m.el.querySelector('[data-x]').onclick = () => { m.close(); resolve(false); });
      });
    },

    /** Demande une saisie de texte — Promise<string|null> */
    prompt(title, label, placeholder, multiline) {
      return new Promise(resolve => {
        const input = multiline
          ? '<textarea class="input" id="pv" placeholder="' + U.esc(placeholder || '') + '"></textarea>'
          : '<input class="input" id="pv" placeholder="' + U.esc(placeholder || '') + '">';
        const m = UI.sheet({
          title: title,
          body: '<div class="field"><label>' + U.esc(label || '') + '</label>' + input + '</div>',
          footer: '<div class="row" style="gap:10px">' +
                  '<button class="btn btn-ghost grow" data-no>Annuler</button>' +
                  '<button class="btn btn-primary grow" data-yes>Valider</button></div>',
          onMount(el, api) {
            const f = el.querySelector('#pv');
            setTimeout(() => f.focus(), 80);
            el.querySelector('[data-no]').onclick = () => { api.close(); resolve(null); };
            el.querySelector('[data-yes]').onclick = () => { api.close(); resolve(f.value.trim()); };
          }
        });
        void m;
      });
    },

    /* ------------------------------------------------------------ boutons */
    /** Met un bouton en état "chargement" et le restaure */
    busy(btn, on, labelWhenBusy) {
      if (!btn) return;
      if (on) {
        btn.dataset._html = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>' + (labelWhenBusy ? ' ' + U.esc(labelWhenBusy) : '');
      } else {
        btn.disabled = false;
        if (btn.dataset._html) btn.innerHTML = btn.dataset._html;
      }
    },

    /* -------------------------------------------------------------- blocs */
    empty(icon, title, text, actionHtml) {
      return '<div class="empty"><div class="ic">' + (icon || UI.icon('inbox', 40)) + '</div>' +
             '<b>' + U.esc(title || '') + '</b>' +
             '<div>' + U.esc(text || '') + '</div>' +
             (actionHtml ? '<div style="margin-top:16px">' + actionHtml + '</div>' : '') + '</div>';
    },

    skeletonCards(n) {
      // même gabarit que les cartes qui vont les remplacer : un squelette
      // d'une autre taille fait sauter la page au moment du remplacement
      let h = '<div class="rc-list">';
      for (let i = 0; i < (n || 3); i++)
        h += '<div class="skel" style="height:250px;border-radius:24px"></div>';
      return h + '</div>';
    },

    stat(label, value, icon) {
      return '<div class="stat"><div class="ic">' + (icon || '') + '</div>' +
             '<div class="k">' + U.esc(label) + '</div><div class="v">' + value + '</div></div>';
    },

    tag(status) {
      return '<span class="tag ' + U.statusTag(status) + '">' + U.statusIcon(status) + ' ' +
             U.esc(U.statusShort(status)) + '</span>';
    },

    /* ------------------------------------------------------------ icônes
       Jeu d'icônes au trait, dans l'esprit Lucide, écrites à la main en SVG.
       Aucune librairie : le site n'a pas de dépendances et n'en aura pas.
       Elles héritent de la couleur du texte (stroke:currentColor), donc une
       seule définition sert partout. */
    ICONS: {
      user: '<path d="M20 20.4v-1.3a4.6 4.6 0 0 0-4.6-4.6H8.6A4.6 4.6 0 0 0 4 19.1v1.3"/><circle cx="12" cy="7.6" r="4"/>',
      phone:    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
      mail:     '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
      lock:     '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
      pin:      '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
      headset:  '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
      package: '<path d="M20.6 8.1v7.8a1.9 1.9 0 0 1-.95 1.65l-6.7 3.86a1.9 1.9 0 0 1-1.9 0l-6.7-3.86A1.9 1.9 0 0 1 3.4 15.9V8.1a1.9 1.9 0 0 1 .95-1.65l6.7-3.86a1.9 1.9 0 0 1 1.9 0l6.7 3.86A1.9 1.9 0 0 1 20.6 8.1Z"/><path d="m3.7 7.1 8.3 4.8 8.3-4.8"/><path d="M12 21.3v-9.4"/><path d="m7.85 4.5 8.3 4.8"/>',
      // fourchette + couteau, dessinés larges : les tracés d'origine de Lucide
      // deviennent illisibles en dessous de 24 px
      utensils: '<path d="M4 3v6a3 3 0 0 0 6 0V3"/><path d="M7 12v9"/><path d="M17.5 3c-1.6 1.1-2.5 3-2.5 5.2s.9 4.1 2.5 5.2V21"/>',
      /* Le pain, la garniture, le pain : c'est le pictogramme de la maquette
         pour « Restaurants ». Une fourchette et un couteau disent « couvert »,
         pas « endroit où manger » — et à 22 px, deux traits verticaux se
         confondent avec n'importe quel autre pictogramme fin. */
      burger: '<path d="M3.4 9.6c0-3.1 3.8-5.4 8.6-5.4s8.6 2.3 8.6 5.4a.9.9 0 0 1-.9.9H4.3a.9.9 0 0 1-.9-.9Z"/><path d="M4.2 13.4h15.6"/><path d="M3.4 16.8h17.2v.9a3.5 3.5 0 0 1-3.5 3.5H6.9a3.5 3.5 0 0 1-3.5-3.5Z"/>',
      save:     '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
      logout:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
      pencil:   '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      trash:    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
      chevron:  '<path d="m9 18 6-6-6-6"/>',
      plus:     '<path d="M5 12h14"/><path d="M12 5v14"/>',
      image:    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
      check:    '<path d="M21.8 10A10 10 0 1 1 17 3.3"/><path d="m9 11 3 3L22 4"/>',
      link:     '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
      warn:     '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
      // sonnerie : un haut-parleur, pour ne pas être confondu avec la cloche
      // des notifications, juste à côté dans la barre du haut
      sound:    '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.8 5.2a9 9 0 0 1 0 13.6"/>',
      mute:     '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
      home: '<path d="M3.2 10.4 12 3.6l8.8 6.8"/><path d="M5.4 9.4V19a1.6 1.6 0 0 0 1.6 1.6h10a1.6 1.6 0 0 0 1.6-1.6V9.4"/><path d="M9.6 20.6v-5.2a1.4 1.4 0 0 1 1.4-1.4h2a1.4 1.4 0 0 1 1.4 1.4v5.2"/>',
      receipt:  '<path d="M4 2v20l2.5-1.5L9 22l3-1.5L15 22l2.5-1.5L20 22V2l-2.5 1.5L15 2l-3 1.5L9 2 6.5 3.5Z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
      grid:     '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
      settings: '<path d="M4 7.5h8.2"/><path d="M17.8 7.5H20"/><circle cx="15" cy="7.5" r="2.4"/><path d="M4 16.5h2.2"/><path d="M11.8 16.5H20"/><circle cx="9" cy="16.5" r="2.4"/>',
      eye:      '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
      flame:    '<path d="M12 22c4 0 7-2.7 7-6.5 0-4-3-6-4.5-9.5-1 2-2 2.8-3 3.5C10 7 9 4.5 9 3 6.5 5.5 5 8.5 5 12c0 4.3 3 10 7 10Z"/>',
      calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 11h18"/>',
      wallet:   '<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2"/><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Z"/><circle cx="17" cy="14" r="1"/>',
      chef:     '<path d="M6 20h12"/><path d="M7 17h10l1-6a4 4 0 0 0-2-4 4 4 0 0 0-7.6-1A4 4 0 0 0 6 11Z"/>',
      bike:     '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17 10 8h5l3 9"/><path d="M13 8h4"/>',
      car:      '<path d="M5 13l1.6-4.7A2 2 0 0 1 8.5 7h7a2 2 0 0 1 1.9 1.3L19 13"/>' +
                '<path d="M3.5 13h17v4.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V17H7v.5a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1z"/>' +
                '<circle cx="7.5" cy="15" r=".6"/><circle cx="16.5" cy="15" r=".6"/>',
      info:     '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4.5"/><path d="M12 8.2h.01"/>',
      clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      search:   '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
      upload:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 9 5-5 5 5"/><path d="M12 4v12"/>',
      store:    '<path d="m3 8 2-5h14l2 5"/><path d="M3 8h18"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"/><path d="M9 21v-6h6v6"/>',
      tag:      '<path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
      pause:    '<circle cx="12" cy="12" r="9"/><path d="M10 9v6"/><path d="M14 9v6"/>',
      bell: '<path d="M17.6 9.4a5.6 5.6 0 1 0-11.2 0c0 4.7-2 6.4-2.5 6.9a.6.6 0 0 0 .42 1.02h15.36a.6.6 0 0 0 .42-1.02c-.5-.5-2.5-2.2-2.5-6.9Z"/><path d="M10.2 20a2.1 2.1 0 0 0 3.6 0"/>',
      inbox:    '<path d="M22 12h-6l-2 3h-4l-2-3H2"/>' +
                '<path d="M5.4 5.1 2.4 11a2 2 0 0 0-.4 1.2V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.8a2 2 0 0 0-.4-1.2l-3-5.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1Z"/>',
      // barres pleines plutôt que traits : à 20 px un histogramme au trait fin
      // se lit comme trois bâtons sans rapport les uns avec les autres
      chart:    '<path d="M4 3v17h17"/>' +
                '<rect x="7.5" y="13.5" width="3.5" height="6.5" rx="1.2" fill="currentColor" stroke="none"/>' +
                '<rect x="12.5" y="9" width="3.5" height="11" rx="1.2" fill="currentColor" stroke="none"/>' +
                '<rect x="17.5" y="11.5" width="3.5" height="8.5" rx="1.2" fill="currentColor" stroke="none"/>',
      pizza:    '<path d="m2.5 15.5 19 5.5-5.5-19a19 19 0 0 0-13.5 13.5"/>' +
                '<path d="M16.5 6.2c-5.9 0-8.8 3.1-10.3 4.7"/>' +
                '<circle cx="14.6" cy="11" r="1.1" fill="currentColor" stroke="none"/>' +
                '<circle cx="10.8" cy="15" r="1.1" fill="currentColor" stroke="none"/>',
      cart: '<circle cx="9.4" cy="20.2" r="1.5"/><circle cx="17.6" cy="20.2" r="1.5"/><path d="M2.6 3.4h2.2a1 1 0 0 1 1 .82l.42 2.28"/><path d="M6.22 6.5h13.9a1 1 0 0 1 .98 1.2l-1.15 5.9a2 2 0 0 1-1.96 1.6H9.2a2 2 0 0 1-1.97-1.66L6.22 6.5Z"/>',
      history:  '<path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2L3 8.5"/><path d="M3 3.5V9h5.5"/><path d="M12 7.5V12l3.3 2"/>',
      users:    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
                '<path d="M22 21v-2a4 4 0 0 0-3.2-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
      // scooter : deux roues, un plancher et une colonne de direction inclinée.
      // Le vélo de Lucide ne va pas ici — sur Talabi on livre en moto
      scooter:  '<circle cx="5.5" cy="17.5" r="2.8"/><circle cx="18.5" cy="17.5" r="2.8"/>' +
                '<path d="M8.3 17.5h6.4"/>' +
                '<path d="M5.5 14.7v-2.2a1.8 1.8 0 0 1 1.8-1.8h4.4"/>' +
                '<path d="m17.6 14.6-1.9-7.4"/><path d="M13.9 6.6h3.4"/>',

      /* ---------------------------------------------- pictogrammes des avis
         Le panneau des notifications marchait aux émojis. Un émoji n'est pas
         dessiné par nous : chaque téléphone a le sien, ils n'ont ni la même
         épaisseur, ni la même couleur, ni la même taille optique — mis les
         uns sous les autres, la colonne était bancale. Ces tracés-ci suivent
         la même grille de 24 et la même épaisseur de trait que le reste de
         l'application, et prennent la couleur qu'on leur donne. */
      'arrow-right': '<path d="M4.5 12h15"/><path d="m13.2 5.4 6.6 6.6-6.6 6.6"/>',
      // médaille : le ruban en dessous, la rosette au-dessus. Une étoile
      // seule aurait dit « note » ; ici on parle de classement.
      medal:    '<circle cx="12" cy="9" r="6"/>' +
                '<path d="m9.2 14.4-1.7 6.1 4.5-2.6 4.5 2.6-1.7-6.1"/>' +
                '<path d="m12 6.2.95 1.93 2.13.31-1.54 1.5.36 2.12L12 11.06l-1.9 1-.36-2.12-1.54-1.5 2.13-.31Z" fill="currentColor" stroke="none"/>',
      'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.2 12.2 2.6 2.6 5-5.2"/>',
      bag:      '<path d="M5.4 8h13.2l-1 11.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8Z"/>' +
                '<path d="M8.8 8V6.4a3.2 3.2 0 0 1 6.4 0V8"/>',
      navigation: '<path d="M20.6 4.4 4.9 10.2a.8.8 0 0 0-.1 1.5l6.4 2.6a.8.8 0 0 1 .4.4l2.6 6.4a.8.8 0 0 0 1.5-.1Z"/>',
      ban:      '<circle cx="12" cy="12" r="9"/><path d="m5.9 5.9 12.2 12.2"/>',
      sparkle:  '<path d="M12 2.6 13.9 8 19.4 10 13.9 12 12 17.4 10.1 12 4.6 10 10.1 8Z"/>' +
                '<path d="M18.6 16.4 19.4 18.6 21.6 19.4 19.4 20.2 18.6 22.4 17.8 20.2 15.6 19.4 17.8 18.6Z"/>'
    },

    icon(name, size) {
      const d = UI.ICONS[name];
      if (!d) return '';
      const s = size || 20;
      return '<svg class="ico" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' +
        'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
    },

    /** Repère de lieu, en orange, aligné sur le texte qui l'entoure. */
    pin(size) { return '<span class="pin-ic">' + UI.icon('pin', size || 15) + '</span>'; },

    avatar(name, url, size) {
      const s = size || 42;
      const st = 'width:' + s + 'px;height:' + s + 'px;font-size:' + Math.round(s / 2.6) + 'px' +
                 (url ? ';background-image:url(' + U.escUrl(url) + ')' : '');
      return '<div class="avatar" style="' + st + '">' + (url ? '' : U.esc(U.initials(name))) + '</div>';
    },

    /* -------------------------------------------------- upload d'image */
    /**
     * Champ d'image : upload vers Supabase Storage.
     * Rendu : UI.imageField('logo', currentUrl, 'Logo du restaurant')
     * Lecture : le champ caché [name] contient l'URL finale.
     */
    imageField(name, current, label, ratio) {
      const bg = current ? 'background-image:url(' + U.escUrl(current) + ')' : '';
      return '<div class="field">' +
        '<label>' + U.esc(label || '') + '</label>' +
        '<div data-imgfield="' + name + '" style="display:flex;gap:12px;align-items:center">' +
          '<div data-preview style="width:' + (ratio === 'wide' ? '120' : '76') + 'px;height:76px;border-radius:14px;' +
            'border:1.5px dashed var(--line);background:#fff center/cover no-repeat;' + bg + ';' +
            'display:grid;place-items:center;font-size:22px;flex:none;cursor:pointer">' +
            (current ? '' : UI.icon('image', 24)) + '</div>' +
          '<div class="grow">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-pick>Choisir une image</button>' +
            '<div class="tiny" style="margin-top:5px">JPG / PNG • 2 Mo max</div>' +
          '</div>' +
          '<input type="file" accept="image/*" hidden data-file>' +
          '<input type="hidden" name="' + name + '" value="' + U.esc(current || '') + '">' +
        '</div></div>';
    },

    /** Active tous les champs image présents dans un conteneur */
    bindImageFields(root) {
      root.querySelectorAll('[data-imgfield]').forEach(box => {
        const file = box.querySelector('[data-file]');
        const hidden = box.querySelector('input[type=hidden]');
        const prev = box.querySelector('[data-preview]');
        const open = () => file.click();
        box.querySelector('[data-pick]').onclick = open;
        prev.onclick = open;
        file.onchange = async () => {
          const f = file.files[0];
          if (!f) return;
          if (f.size > 2 * 1024 * 1024) return UI.err('Image trop lourde', 'Maximum 2 Mo');
          prev.innerHTML = '<span class="spinner dark"></span>';
          try {
            const url = await API.uploadImage(f);
            hidden.value = url;
            prev.style.backgroundImage = 'url(' + url + ')';
            prev.innerHTML = '';
          } catch (e) {
            prev.innerHTML = UI.icon('image', 24);
            UI.err("Échec de l'envoi", e.message);
          }
        };
      });
    },

    /** Lit un <form> en objet simple */
    formData(form) {
      const o = {};
      new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
      return o;
    },

    /* Sur téléphone, ce n'est plus le document qui défile mais #view : la
       barre du bas ne bougeait pas d'un pixel dans le code, et pourtant
       elle suivait le doigt — parce que le navigateur mobile fait glisser
       toute la fenêtre quand il escamote sa barre d'adresse. Un conteneur
       qui défile à l'intérieur d'une fenêtre figée supprime le phénomène
       à la racine. Il faut donc remettre CE conteneur à zéro, pas la
       fenêtre, sans quoi on changeait de page en restant au milieu de
       l'ancienne. */
    scrollTop() {
      const v = document.getElementById('view');
      if (v) v.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    }
  };

  w.UI = UI;
})(window);
