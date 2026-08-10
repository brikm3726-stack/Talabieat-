/* ==========================================================================
   TALABI — Configuration
   --------------------------------------------------------------------------
   Le site fonctionne uniquement en ligne, sur une vraie base de données.
   Colle ci-dessous l'URL du projet et la clé "anon public" trouvées dans
   Supabase > Project Settings > API.

   Sans ces deux valeurs, l'application refuse de démarrer et affiche un
   message d'explication : il n'y a plus de mode démo de secours.
   ========================================================================== */

window.TALABI_CONFIG = {

  // ---- Supabase (obligatoire) -------------------------------------------
  SUPABASE_URL:      'https://nxwgrpiubgrlvaszclmz.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54d2dycGl1YmdybHZhc3pjbG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNTkyNTAsImV4cCI6MjEwMDkzNTI1MH0.wKsQIAiB_sJcttPQQbTDfWsVAdbRA_PqokF0TNBeF-c',

  // ---- Cartes -----------------------------------------------------------
  // LES CARTES SONT CELLES DE GOOGLE, avec repli automatique sur
  // OpenStreetMap. Cette clé est donc lue à nouveau depuis le 10 août 2026 :
  // la facturation qui bloquait auparavant (OR_BACR2_44 à l'ajout de carte)
  // est active, vérifiée en chargeant l'API depuis talabi.shop.
  //
  // LA CLÉ EST RESTREINTE AU DOMAINE talabi.shop. C'est ce qui permet de la
  // laisser en clair ici — un fichier de configuration servi au navigateur est
  // public par nature, et une clé sans restriction s'y ferait ramasser en
  // quelques heures. Conséquence à connaître : elle ne fonctionne PAS en
  // ouvrant les fichiers en local. La carte retombe alors sur OpenStreetMap,
  // ce qui est exactement ce qu'on veut pendant un essai.
  //
  // Vider cette valeur suffit à revenir entièrement à OpenStreetMap.
  //
  // Deux services restent à activer dans la console Google (API et services →
  // Bibliothèque) pour que la RECHERCHE d'adresse passe aussi par Google :
  // « Geocoding API » et « Places API ». Tant qu'ils répondent REQUEST_DENIED,
  // la recherche se fait par Nominatim, sans que rien ne casse.
  GOOGLE_MAPS_KEY: 'AIzaSyD6jN6hL3eZVG1Ej1c4FwdmRj3P0L6Ilv4',

  // ---- Identité ---------------------------------------------------------
  APP_NAME: 'Talabi',
  // Affichée dans « À propos ». À incrémenter quand une mise en ligne apporte
  // un changement visible : c'est ce numéro qu'un utilisateur citera pour
  // signaler un problème.
  APP_VERSION: '2.0',
  APP_TAGLINE: 'Vos plats préférés, livrés chez vous',
  CURRENCY: 'DA',
  SUPPORT_PHONE: '+213 792 779 320',
  SUPPORT_EMAIL: 'contacttalabi@gmail.com',

  // ---- Réseaux sociaux --------------------------------------------------
  // Affichés sous « C'est quoi Talabi ? », sur l'accueil.
  // Collez l'adresse complète, https:// compris. Un champ laissé vide affiche
  // le bouton en gris, non cliquable : mieux vaut un bouton visiblement éteint
  // qu'un lien qui mène à une page d'erreur.
  SOCIAL: {
    INSTAGRAM: '',
    FACEBOOK:  '',
    YOUTUBE:   ''
  },

  // ---- Règles métier (valeurs par défaut, l'admin peut les modifier) -----
  DEFAULT_DELIVERY_FEE: 200,   // DZD
  COMMISSION_RATE: 0.10,       // 10 % pour la plateforme
  DRIVER_SHARE: 0.80,          // 80 % des frais de livraison pour le livreur

  // ---- Divers -----------------------------------------------------------
  // La plateforme est concentrée sur la ville de Tizi Ouzou : les "zones" sont
  // les quartiers de la ville, pas les communes de la wilaya.
  DEFAULT_WILAYA: 'Tizi Ouzou'
};

/* Vrai quand les deux clés sont renseignées. Le démarrage s'arrête sinon. */
window.TALABI_CONFIGURED = !!(window.TALABI_CONFIG.SUPABASE_URL &&
                              window.TALABI_CONFIG.SUPABASE_ANON_KEY);
