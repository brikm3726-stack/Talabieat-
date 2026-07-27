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
            '<div class="sheet-head"><div class="h3">' + U.esc(opts.title || '') + '</div>' +
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
            (current ? '' : '🖼️') + '</div>' +
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
            prev.innerHTML = '🖼️';
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
