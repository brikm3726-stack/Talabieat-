/* ==========================================================================
   LES QUATRE APPLICATIONS

   Un seul code, quatre portes d'entrée :

     /Talabieat-/            client      commander
     /Talabieat-/livreur/    driver      livrer
     /Talabieat-/admin/      admin       surveiller

   Chaque index.html annonce la sienne dans window.TALABI_APP, et sa
   profondeur dans window.TALABI_BASE. Tout ce qui les distingue est rassemblé
   ici : ailleurs dans le code, on interroge App, on ne teste pas des chemins.

   Pourquoi pas quatre projets séparés : quatre copies du code, c'est quatre
   fois chaque correction. Le jour où un bug de sécurité apparaît, il faut le
   corriger partout, et on en oublie toujours un.
   ========================================================================== */
(function (w) {
  'use strict';

  const DEFS = {
    client: {
      role: 'client',
      nom: 'Talabi',
      titre: 'Bienvenue sur Talabi',
      sousTitre: 'Commandez vos repas préférés en quelques minutes.',
      accueil: '/',
      chemin: '',                 // depuis la racine
      publique: true              // on peut regarder sans compte
    },
    driver: {
      role: 'driver',
      nom: 'Talabi Livreur',
      titre: 'Espace livreur',
      sousTitre: 'Prenez des courses dans votre quartier et suivez vos gains.',
      accueil: '/d',
      chemin: 'livreur/',
      publique: false
    },
    admin: {
      role: 'admin',
      nom: 'Talabi Admin',
      titre: 'Administration',
      sousTitre: 'Réservé à l’équipe de la plateforme.',
      accueil: '/a',
      chemin: 'admin/',
      publique: false
    }
  };

  const courante = DEFS[w.TALABI_APP] ? w.TALABI_APP : 'client';

  const App = Object.assign({}, DEFS[courante], {

    /** Identifiant de l'application ouverte : client | driver | admin */
    id: courante,

    /** L'application ouverte est-elle celle-ci ? */
    est(id) { return courante === id; },

    /** Définition d'une autre application */
    def(id) { return DEFS[id] || null; },

    /**
     * Adresse d'une autre application, calculée depuis celle-ci.
     * Toutes vivent sous le même dossier parent : on remonte à la racine
     * commune (TALABI_BASE) puis on descend.
     */
    lien(id, hash) {
      const d = DEFS[id];
      if (!d) return '#/';
      return (w.TALABI_BASE || '') + d.chemin + (hash ? '#' + hash : '');
    },

    /** L'application qui correspond à un rôle */
    pourRole(role) {
      for (const id in DEFS) if (DEFS[id].role === role) return id;
      return 'client';
    }
  });

  w.App = App;
})(window);
