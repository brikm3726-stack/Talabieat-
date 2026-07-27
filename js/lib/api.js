/* ==========================================================================
   API — point d'entrée unique vers le backend actif (Supabase ou démo)
   ========================================================================== */
(function (w) {
  'use strict';

  const backend = w.IS_DEMO ? w.BackendDemo : w.BackendSupabase;

  // On expose directement le backend choisi : les deux implémentent le même
  // contrat, donc le reste de l'application ne sait pas lequel est utilisé.
  w.API = backend;
  w.API.mode = w.IS_DEMO ? 'demo' : 'supabase';

  /** Enveloppe pratique : exécute et affiche l'erreur en toast. */
  w.API.safe = async function (fn, fallback) {
    try { return await fn(); }
    catch (e) { console.error(e); UI.err(e.message || 'Une erreur est survenue'); return fallback; }
  };
})(window);
