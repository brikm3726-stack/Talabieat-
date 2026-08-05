-- ==========================================================================
--  26 — SUPPRIMER SON COMPTE
--  --------------------------------------------------------------------------
--  POURQUOI CE FICHIER EXISTE
--
--  Google Play l'exige depuis 2023 pour toute application où l'on peut créer
--  un compte : l'utilisateur doit pouvoir demander la suppression DANS
--  l'application, et depuis une ADRESSE WEB PUBLIQUE consultable sans rien
--  installer. Sans les deux, le formulaire de publication ne peut pas être
--  rempli, et l'application est refusée.
--
--  LE PIÈGE QU'IL FALLAIT DÉSAMORCER D'ABORD
--
--  « orders.client_id » était déclaré :
--
--      client_id uuid not null references public.profiles(id) on delete cascade
--
--  Et « profiles.id » lui-même en cascade sur « auth.users ». Autrement dit,
--  supprimer un compte effaçait EN CASCADE toutes ses commandes : le chiffre
--  d'affaires du mois, les commissions prélevées aux livreurs, les recharges
--  encaissées. Un client qui s'en va emportait la comptabilité avec lui.
--
--  Ce n'est pas ce que demande la loi, ni Google : ce qui doit disparaître,
--  ce sont les DONNÉES PERSONNELLES. Une commande sans nom, sans téléphone et
--  sans adresse ne désigne plus personne — elle n'est qu'une ligne de compte.
--
--  CE QUE FAIT CE FICHIER
--
--   1. Le lien entre une commande et son client devient « on delete set
--      null » : la commande survit à son auteur, orpheline et anonyme.
--   2. delete_my_account() efface tout ce qui est nominatif, anonymise les
--      commandes passées, puis supprime réellement le compte — l'adresse
--      email est libérée, la personne peut revenir plus tard si elle veut.
--   3. Deux refus, et ils protègent l'utilisateur autant que la plateforme :
--      on ne supprime pas un compte au milieu d'une commande en cours, ni un
--      compte livreur qui a encore du crédit non dépensé.
--
--  Sans risque et rejouable.
-- ==========================================================================

-- 1. Une commande peut survivre à son client --------------------------------
alter table public.orders alter column client_id drop not null;

alter table public.orders drop constraint if exists orders_client_id_fkey;
alter table public.orders
  add constraint orders_client_id_fkey
  foreign key (client_id) references public.profiles(id) on delete set null;

-- 2. Supprimer son propre compte --------------------------------------------
-- Personne d'autre ne peut la déclencher : elle n'agit que sur auth.uid().
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

  /* REFUS 1 — une commande est en cours.
     Supprimer maintenant laisserait un livreur devant une porte, ou un client
     sans repas et sans moyen de joindre qui que ce soit. Ce n'est pas un
     obstacle administratif : c'est quelques minutes d'attente. */
  select count(*) into encours
    from public.orders
   where (client_id = moi or driver_id = moi)
     and status in ('pending', 'accepted', 'preparing', 'ready',
                    'driver_assigned', 'delivering');
  if encours > 0 then
    raise exception 'Vous avez % commande(s) en cours. Attendez la fin de la livraison, ou annulez, puis revenez supprimer votre compte.', encours
      using errcode = 'check_violation';
  end if;

  /* REFUS 2 — du crédit livreur non dépensé.
     C'est son argent. Le lui faire disparaître d'un clic serait indéfendable,
     et le rembourser automatiquement demande une décision humaine. */
  if p.role = 'driver' then
    select coalesce(credit_da, 0) into solde from public.drivers where id = moi;
    if solde > 0 then
      raise exception 'Il reste % DA sur votre compte livreur. Contactez la plateforme pour récupérer ce solde avant de supprimer votre compte.', solde
        using errcode = 'check_violation';
    end if;
  end if;

  /* ---- ce qui est effacé sans laisser de trace ---- */
  delete from public.addresses     where user_id = moi;
  delete from public.notifications where user_id = moi;

  /* ---- ce qui reste, mais ne désigne plus personne ----
     Les montants, les dates et les quartiers restent : ils font la
     comptabilité et les statistiques. Le nom, le téléphone, l'adresse exacte
     et le point GPS partent. */
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

  /* Le profil est vidé avant sa suppression : si l'effacement du compte
     d'authentification échouait (droits refusés sur le schéma auth), il ne
     resterait de toute façon plus une seule donnée personnelle. */
  update public.profiles
     set full_name  = 'Compte supprimé',
         phone      = null,
         email      = null,
         avatar_url = null,
         is_blocked = true
   where id = moi;

  /* ---- la suppression réelle ----
     La cascade sur profiles se déclenche, et les commandes se détachent
     proprement grâce à la section 1. L'adresse email redevient libre. */
  begin
    delete from auth.users where id = moi;
  exception when others then
    -- On ne fait pas échouer la demande pour autant : le compte est déjà vidé
    -- et bloqué, il n'est plus utilisable. L'administrateur finira le ménage.
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

-- a) Le lien commande → client est bien devenu « set null ».
--    « a » = no action (l'ancien, dangereux), « n » = set null (le bon).
select conname,
       case confdeltype when 'n' then 'set null — CORRECT'
                        when 'c' then 'CASCADE — DANGER, les commandes seraient effacees'
                        else confdeltype::text end as a_la_suppression
  from pg_constraint
 where conrelid = 'public.orders'::regclass
   and conname = 'orders_client_id_fkey';

-- b) La fonction existe et n'est pas ouverte aux inconnus.
select case when has_function_privilege('anon', 'public.delete_my_account()', 'execute')
            then 'OUI — A CORRIGER' else 'non' end as anonyme,
       case when has_function_privilege('authenticated', 'public.delete_my_account()', 'execute')
            then 'oui' else 'NON — A CORRIGER' end  as connecte;
