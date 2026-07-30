-- ==========================================================================
--  11 — PROTÉGER LE OU LES ADMINISTRATEURS FONDATEURS
--  --------------------------------------------------------------------------
--  Le problème : la sécurité par ligne autorise tout administrateur à modifier
--  n'importe quel profil — y compris celui du fondateur. Un deuxième admin, par
--  maladresse ou par malveillance, peut donc rétrograder le compte principal en
--  « client » ou le bloquer. Il n'existe alors plus aucun moyen de revenir en
--  arrière depuis le site : il faut repasser par l'éditeur SQL.
--
--  La protection vit ici, dans la base, et pas dans les pages d'administration.
--  Un contrôle écrit dans le site se contourne avec la clé publique et deux
--  lignes de JavaScript ; un trigger, non.
--
--  Ce qui reste possible depuis l'éditeur SQL de Supabase : tout. C'est voulu.
--  L'éditeur SQL n'a pas d'utilisateur connecté (auth.uid() est nul), et il
--  demande l'accès au tableau de bord Supabase — donc ton mot de passe et ta
--  double authentification. C'est ta porte de secours si tu perds ton compte.
--
--  Sans risque et rejouable.
-- ==========================================================================

-- 1. La liste des comptes protégés ------------------------------------------
-- Aucune policy n'est créée sur cette table : personne ne peut ni la lire ni
-- l'écrire depuis le site, quelle que soit sa clé. Seul l'éditeur SQL y touche.
create table if not exists public.protected_admins (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.protected_admins enable row level security;

-- 2. Le compte fondateur -----------------------------------------------------
-- Remplace l'adresse par la tienne, ou ajoute-en d'autres avec la même requête.
insert into public.protected_admins (email, note)
values ('brikm3726@gmail.com', 'Compte fondateur')
on conflict (email) do nothing;

-- 3. Le verrou ---------------------------------------------------------------
create or replace function public.protect_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Aucun utilisateur connecté = éditeur SQL ou clé service_role : on laisse.
  if auth.uid() is null then return new; end if;

  if not exists (
    select 1 from public.protected_admins p
     where lower(p.email) = lower(coalesce(old.email, ''))
  ) then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Ce compte administrateur est protégé : son rôle ne peut pas être modifié depuis le site.'
      using errcode = 'check_violation';
  end if;

  if new.is_blocked is distinct from old.is_blocked then
    raise exception 'Ce compte administrateur est protégé : il ne peut pas être bloqué.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_protect_admin on public.profiles;
create trigger trg_protect_admin
  before update on public.profiles
  for each row execute function public.protect_admin();

-- 4. Et la suppression -------------------------------------------------------
create or replace function public.protect_admin_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return old; end if;
  if exists (
    select 1 from public.protected_admins p
     where lower(p.email) = lower(coalesce(old.email, ''))
  ) then
    raise exception 'Ce compte administrateur est protégé : il ne peut pas être supprimé depuis le site.'
      using errcode = 'check_violation';
  end if;
  return old;
end $$;

drop trigger if exists trg_protect_admin_delete on public.profiles;
create trigger trg_protect_admin_delete
  before delete on public.profiles
  for each row execute function public.protect_admin_delete();

-- ==========================================================================
--  MODE D'EMPLOI
--
--  Ajouter un compte protégé :
--    insert into public.protected_admins (email, note)
--    values ('associe@gmail.com', 'Co-fondateur') on conflict do nothing;
--
--  Retirer une protection :
--    delete from public.protected_admins where email = 'associe@gmail.com';
--
--  Voir la liste :
--    select * from public.protected_admins;
--
--  Reprendre la main si tout est perdu :
--    update public.profiles set role = 'admin', is_blocked = false
--     where lower(email) = lower('brikm3726@gmail.com');
-- ==========================================================================

select email, note from public.protected_admins;
