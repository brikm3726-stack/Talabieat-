/* ==========================================================================
   UI — toasts, modales, helpers DOM
   ========================================================================== */
(function (w) {
  'use strict';

  const UI = {

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

    /* ------------------------------------------------------------ modales */
    /**
     * UI.sheet({ title, body, footer, onMount, wide })
     * Retourne { close }
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

      const close = () => {
        ov.style.transition = '.16s'; ov.style.opacity = '0';
        setTimeout(() => { ov.remove(); if (!root.children.length) document.body.style.overflow = ''; }, 160);
      };
      ov.addEventListener('click', e => { if (e.target === ov) close(); });
      const x = ov.querySelector('[data-x]');
      if (x) x.addEventListener('click', close);

      const api = { close, el: ov };
      if (opts.onMount) opts.onMount(ov, api);
      return api;
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
      return '<div class="empty"><div class="ic">' + (icon || '📭') + '</div>' +
             '<b>' + U.esc(title || '') + '</b>' +
             '<div>' + U.esc(text || '') + '</div>' +
             (actionHtml ? '<div style="margin-top:16px">' + actionHtml + '</div>' : '') + '</div>';
    },

    skeletonCards(n) {
      let h = '<div class="grid grid-auto">';
      for (let i = 0; i < (n || 4); i++) h += '<div class="skel" style="height:210px"></div>';
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
      user:     '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      phone:    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
      mail:     '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
      lock:     '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
      pin:      '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
      headset:  '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
      package:  '<path d="m7.5 4.3 9 5.1"/><path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
      // fourchette + couteau, dessinés larges : les tracés d'origine de Lucide
      // deviennent illisibles en dessous de 24 px
      utensils: '<path d="M4 3v6a3 3 0 0 0 6 0V3"/><path d="M7 12v9"/><path d="M17.5 3c-1.6 1.1-2.5 3-2.5 5.2s.9 4.1 2.5 5.2V21"/>',
      save:     '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
      logout:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
      pencil:   '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      trash:    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
      chevron:  '<path d="m9 18 6-6-6-6"/>',
      plus:     '<path d="M5 12h14"/><path d="M12 5v14"/>',
      image:    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
      check:    '<path d="M21.8 10A10 10 0 1 1 17 3.3"/><path d="m9 11 3 3L22 4"/>',
      link:     '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
      warn:     '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'
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
     * Champ d'image : upload vers Supabase Storage, ou base64 en mode démo.
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

    scrollTop() { window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' }); }
  };

  w.UI = UI;
})(window);
