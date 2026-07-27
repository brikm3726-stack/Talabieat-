/* ==========================================================================
   TALABI — Configuration
   --------------------------------------------------------------------------
   MODE DÉMO  : laisse SUPABASE_URL vide. Les données sont stockées dans le
                navigateur (localStorage). Idéal pour tester tout de suite.
   MODE RÉEL  : colle ton URL et ta clé "anon public" depuis
                Supabase > Project Settings > API
   ========================================================================== */

window.TALABI_CONFIG = {

  // ---- Supabase ---------------------------------------------------------
  SUPABASE_URL:      '',   // ex: 'https://abcdefgh.supabase.co'
  SUPABASE_ANON_KEY: '',   // ex: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...'

  // ---- Identité ---------------------------------------------------------
  APP_NAME: 'Talabi',
  APP_TAGLINE: 'Vos plats préférés, livrés chez vous',
  CURRENCY: 'DA',
  SUPPORT_PHONE: '+213 555 00 00 00',

  // ---- Règles métier (valeurs par défaut, l'admin peut les modifier) -----
  DEFAULT_DELIVERY_FEE: 200,   // DZD
  COMMISSION_RATE: 0.10,       // 10 % pour la plateforme
  DRIVER_SHARE: 0.80,          // 80 % des frais de livraison pour le livreur

  // ---- Divers -----------------------------------------------------------
  // La plateforme est concentrée sur la ville de Tizi Ouzou : les "zones" sont
  // les quartiers de la ville, pas les communes de la wilaya.
  DEFAULT_WILAYA: 'Tizi Ouzou'
};

window.IS_DEMO = !window.TALABI_CONFIG.SUPABASE_URL || !window.TALABI_CONFIG.SUPABASE_ANON_KEY;
