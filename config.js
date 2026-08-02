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
  // Les cartes utilisent OpenStreetMap : aucune clé, aucun compte, aucune
  // carte bancaire. Google Maps exigeait une facturation active même dans le
  // quota gratuit, et l'ajout de carte échouait (OR_BACR2_44) — la carte
  // cessait alors de s'afficher sans que rien n'ait changé dans le code.
  //
  // Cette clé n'est plus lue par l'application. Conservée au cas où la
  // facturation Google serait débloquée un jour.
  GOOGLE_MAPS_KEY: 'AIzaSyD6jN6hL3eZVG1Ej1c4FwdmRj3P0L6Ilv4',

  // ---- Identité ---------------------------------------------------------
  APP_NAME: 'Talabi',
  // Affichée dans « À propos ». À incrémenter quand une mise en ligne apporte
  // un changement visible : c'est ce numéro qu'un utilisateur citera pour
  // signaler un problème.
  APP_VERSION: '1.1',
  APP_TAGLINE: 'Vos plats préférés, livrés chez vous',
  CURRENCY: 'DA',
  SUPPORT_PHONE: '+213 792 779 320',
  SUPPORT_EMAIL: 'contacttalabi@gmail.com',

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
