/* ==========================================================================
   API — point d'entrée unique vers le backend (Supabase)
   ========================================================================== */
(function (w) {
  'use strict';

  w.API = w.BackendSupabase;
  w.API.mode = 'supabase';

  /** Enveloppe pratique : exécute et affiche l'erreur en toast. */
  w.API.safe = async function (fn, fallback) {
    try { return await fn(); }
    catch (e) { console.error(e); UI.err(e.message || 'Une erreur est survenue'); return fallback; }
  };
})(window);
