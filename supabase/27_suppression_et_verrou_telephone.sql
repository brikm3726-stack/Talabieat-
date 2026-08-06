-- ==========================================================================
--  27 — LE VERROU DU TÉLÉPHONE EMPÊCHAIT DE SUPPRIMER SON COMPTE
--  --------------------------------------------------------------------------
--  LE BUG, ET IL AURAIT FAIT REFUSER L'APPLICATION
--
--  Deux règles écrites à des mois d'intervalle, chacune raisonnable seule, et
--  qui se contredisent dès qu'on les met ensemble :
--
--   • fichier 08 : le téléphone d'un profil est FIGÉ 30 JOURS. Le déclencheur
--     trg_lock_phone refuse toute modification de `profiles.phone` si le
--     numéro a été saisi il y a moins de 30 jours. C'est une bonne règle :
--     elle empêche quelqu'un de changer de numéro pour échapper à un litige.
--
--   • fichier 26 : delete_my_account() efface les données nominatives, et
--     parmi elles `phone`, avant de supprimer le compte.
--
--  Or effacer le téléphone EST une modification du téléphone. Le déclencheur
--  se réveille donc, et il refuse :
--
--      « Votre numéro ne sera modifiable que dans 27 jour(s). »
--
--  Autrement dit : TOUT COMPTE DE MOINS DE 30 JOURS ÉTAIT IMPOSSIBLE À
--  SUPPRIMER. Ce qui veut dire tous les comptes neufs — donc les douze
--  testeurs, et surtout l'examinateur de Google Play, qui crée un compte et
--  essaie aussitôt de le supprimer. Il aurait obtenu un message parlant de
--  numéro de téléphone sur un écran de suppression de compte, et l'obligation
--  de suppression aurait été déclarée non respectée.
--
--  UN SECOND PROBLÈME, DÉCOUVERT EN VÉRIFIANT LE PREMIER
--
--  delete_my_account met `email` à null avant la suppression. Or la protection
--  des comptes administrateurs (fichier 11) reconnaît un compte protégé PAR
--  SON EMAIL. Une fois l'email effacé, elle ne reconnaît plus personne : un
--  administrateur protégé pouvait se supprimer lui-même par cette porte, ce
--  que le fichier 11 interdit précisément. Et avant ça, le passage de
--  `is_blocked` à true lui renvoyait « ce compte est protégé, il ne peut pas
--  être bloqué » — un message incompréhensible à cet endroit.
--
--  CE QUE FAIT CE FICHIER
--
--   1. Un drapeau de transaction, `talabi.suppression_compte`. La suppression
--      de compte l'allume ; le verrou du téléphone le regarde et s'écarte.
--      Le verrou continue de s'appliquer partout ailleurs, à l'identique.
--   2. delete_my_account refuse d'emblée, et clairement, un compte
--      administrateur protégé.
--
--  Le drapeau plutôt qu'une exception dans le déclencheur : une condition du
--  type « si le nouveau numéro est nul et le compte bloqué » aurait ouvert une
--  brèche exploitable depuis l'API. Ici, seule une fonction de la base peut
--  allumer le drapeau, et il retombe à la fin de la transaction.
--
--  Sans risque et rejouable.
-- ==========================================================================

-- 1. Le verrou du téléphone s'écarte pendant une suppression de compte -------
-- Reprise complète de la fonction du fichier 08, avec sa première ligne en
-- plus. Tout le reste est identique.
create or replace function public.lock_phone_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  depuis timestamptz;
  restant int;
begin
  /* NOUVEAU — la porte de sortie.
     `true` en second argument : current_setting rend NULL au lieu d'échouer
     quand le réglage n'a jamais été posé, c'est-à-dire dans 99,9 % des appels.
     Seule delete_my_account() l'allume, et il retombe avec la transaction. */
  if coalesce(current_setting('talabi.suppression_compte', true), '') = '1' then
    return new;
  end if;

  -- rien à faire si le numéro ne bouge pas
  if new.phone is not distinct from old.phone then
    return new;
  end if;

  -- un administrateur doit pouvoir corriger un numéro erroné
  if public.is_admin() then
    new.phone_changed_at := now();
    return new;
  end if;

  depuis := coalesce(old.phone_changed_at, old.created_at);

  if old.phone is not null and depuis is not null
     and depuis > now() - interval '30 days' then
    restant := ceil(extract(epoch from (depuis + interval '30 days' - now())) / 86400);
    raise exception 'Votre numéro ne sera modifiable que dans % jour(s).', restant
      using errcode = 'check_violation';
  end if;

  new.phone_changed_at := now();
  return new;
end $$;

-- Le déclencheur est recréé à l'identique : la fonction a changé, pas lui.
drop trigger if exists trg_lock_phone on public.profiles;
create trigger trg_lock_phone
  before update of phone on public.profiles
  for each row execute function public.lock_phone_changes();

-- 2. Supprimer son compte ----------------------------------------------------
-- Reprise complète de la fonction du fichier 26. Deux ajouts, signalés.
create or replace function public.delete_my_account()
returns text language plpgsql security definer set search_path = public as $$
declare
  moi     uuid := auth.uid();
  p       public.profiles;
  encours int;
  solde   int;
  n_cmd   int;
begin
  if moi is null then
    raise exception 'Connectez-vous pour supprimer votre compte.';
  end if;

  select * into p from public.profiles where id = moi;
  if p.id is null then
    raise exception 'Ce compte n''existe plus.';
  end if;

  /* NOUVEAU — un administrateur protégé ne se supprime pas d'ici.
     La protection du fichier 11 reconnaît ces comptes par leur email. Comme
     on efface l'email quelques lignes plus bas, elle ne les aurait plus
     reconnus : cette porte aurait contourné la protection. On refuse donc
     avant, et avec le vrai motif. */
  if exists (
    select 1 from public.protected_admins a
     where lower(a.email) = lower(coalesce(p.email, ''))
  ) then
    raise exception 'Ce compte administrateur est protégé : sa suppression passe par la base de données.'
      using errcode = 'check_violation';
  end if;

  /* REFUS 1 — une commande est en cours. */
  select count(*) into encours
    from public.orders
   where (client_id = moi or driver_id = moi)
     and status in ('pending', 'accepted', 'preparing', 'ready',
                    'driver_assigned', 'delivering');
  if encours > 0 then
    raise exception 'Vous avez % commande(s) en cours. Attendez la fin de la livraison, ou annulez, puis revenez supprimer votre compte.', encours
      using errcode = 'check_violation';
  end if;

  /* REFUS 2 — du crédit livreur non dépensé. C'est son argent. */
  if p.role = 'driver' then
    select coalesce(credit_da, 0) into solde from public.drivers where id = moi;
    if solde > 0 then
      raise exception 'Il reste % DA sur votre compte livreur. Contactez la plateforme pour récupérer ce solde avant de supprimer votre compte.', solde
        using errcode = 'check_violation';
    end if;
  end if;

  /* NOUVEAU — on annonce la suppression au reste de la base.
     Sans cette ligne, l'effacement du téléphone quelques lignes plus bas
     réveillait le verrou des 30 jours (fichier 08) et faisait échouer toute
     la suppression pour n'importe quel compte récent. Le réglage est local à
     la transaction : il disparaît de lui-même, qu'elle réussisse ou non. */
  perform set_config('talabi.suppression_compte', '1', true);

  /* ---- ce qui est effacé sans laisser de trace ---- */
  delete from public.addresses     where user_id = moi;
  delete from public.notifications where user_id = moi;

  /* ---- ce qui reste, mais ne désigne plus personne ---- */
  update public.orders
     set client_name     = 'Compte supprimé',
         client_phone    = '—',
         address_street  = 'Adresse supprimée',
         address_details = null,
         address_lat     = null,
         address_lng     = null,
         note            = null
   where client_id = moi;
  select count(*) into n_cmd from public.orders where client_id = moi;

  update public.profiles
     set full_name  = 'Compte supprimé',
         phone      = null,
         email      = null,
         avatar_url = null,
         is_blocked = true
   where id = moi;

  /* ---- la suppression réelle ---- */
  begin
    delete from auth.users where id = moi;
  exception when others then
    return 'Compte vidé et désactivé. ' || n_cmd ||
           ' commande(s) conservée(s) de façon anonyme pour la comptabilité. ' ||
           'La suppression définitive sera finalisée par la plateforme sous 30 jours.';
  end;

  return 'Compte supprimé. ' || n_cmd ||
         ' commande(s) conservée(s) de façon anonyme pour la comptabilité.';
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;

-- ---- Vérifications ---------------------------------------------------------

-- a) Les deux pièces de la correction sont-elles en place ?
--    On lit le code des fonctions telles qu'elles vivent maintenant dans la
--    base. Aucune ligne n'est modifiée : essayer « pour de vrai » d'effacer un
--    téléphone obligerait à écrire dans un vrai compte, ce qu'une vérification
--    n'a pas à faire.
select
  case when pg_get_functiondef('public.lock_phone_changes()'::regprocedure)
            like '%talabi.suppression_compte%'
       then 'OK — le verrou du telephone connait la porte de sortie'
       else 'MANQUANT — rejouez la section 1' end                as verrou_telephone,
  case when pg_get_functiondef('public.delete_my_account()'::regprocedure)
            like '%set_config(''talabi.suppression_compte''%'
       then 'OK — la suppression leve le drapeau'
       else 'MANQUANT — rejouez la section 2' end                as suppression_compte,
  case when pg_get_functiondef('public.delete_my_account()'::regprocedure)
            like '%protected_admins%'
       then 'OK — un admin protege est refuse'
       else 'MANQUANT — rejouez la section 2' end                as admin_protege;

-- b) Les comptes qui, avant cette correction, ne pouvaient pas etre supprimes.
select count(*) as comptes_qui_etaient_bloques
  from public.profiles
 where phone is not null
   and coalesce(phone_changed_at, created_at) > now() - interval '30 days';
