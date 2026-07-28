-- ==========================================================================
--  08 — TÉLÉPHONE FIGÉ 30 JOURS
--  --------------------------------------------------------------------------
--  À exécuter UNIQUEMENT si votre base a été créée avant cette évolution.
--  Sans risque et rejouable : aucune donnée n'est supprimée.
--
--  Le contrôle vit dans la base, pas seulement dans le formulaire. Un champ
--  désactivé se rouvre en deux clics dans un navigateur, et la clé publique
--  permet d'appeler l'API directement : la règle doit tenir au niveau le plus
--  bas, sinon elle n'existe pas.
-- ==========================================================================

-- 1. Quand le numéro a-t-il été saisi pour la dernière fois ? ---------------
alter table public.profiles add column if not exists phone_changed_at timestamptz;

-- Comptes existants : on part de leur date de création, c'est le numéro
-- donné à l'inscription.
update public.profiles
   set phone_changed_at = created_at
 where phone_changed_at is null and phone is not null;

-- 2. Le verrou -------------------------------------------------------------
create or replace function public.lock_phone_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  depuis timestamptz;
  restant int;
begin
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
end;
$$;

drop trigger if exists trg_lock_phone on public.profiles;
create trigger trg_lock_phone
  before update of phone on public.profiles
  for each row execute function public.lock_phone_changes();

-- ==========================================================================
--  Vérification
-- ==========================================================================
-- select phone, phone_changed_at from public.profiles limit 5;
-- -- doit échouer si le numéro a moins de 30 jours :
-- update public.profiles set phone = '0555000001' where id = auth.uid();
