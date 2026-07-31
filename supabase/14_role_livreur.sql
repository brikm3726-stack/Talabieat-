-- ==========================================================================
--  14 — UN COMPTE PASSÉ EN « LIVREUR » DOIT AVOIR SA FICHE LIVREUR
--  --------------------------------------------------------------------------
--  Le bug : la fiche livreur (table drivers) n'était créée qu'à l'inscription,
--  par le trigger sur auth.users. Un administrateur qui transformait un client
--  en livreur ne changeait donc que son rôle. Résultat : la personne avait
--  bien le rôle, mais aucune fiche — invisible dans « Livreurs », rien à
--  valider, et son espace livreur ne savait pas quoi afficher.
--
--  La correction vit ici plutôt que dans l'écran d'administration, parce que
--  le rôle se change aussi en SQL (admin.sql). Une règle posée dans un seul
--  des deux chemins est une règle qu'on croit avoir posée.
--
--  Sans risque et rejouable.
-- ==========================================================================

create or replace function public.ensure_driver_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'driver' then
    -- validation_status reste 'pending' : devenir livreur ne vaut pas
    -- validation, c'est justement ce qu'un administrateur doit décider
    insert into public.drivers (id) values (new.id) on conflict (id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_ensure_driver_row on public.profiles;
create trigger trg_ensure_driver_row
  after insert or update of role on public.profiles
  for each row execute function public.ensure_driver_row();

-- ---- Rattrapage : les comptes déjà convertis avant ce correctif ------------
insert into public.drivers (id)
select p.id
  from public.profiles p
  left join public.drivers d on d.id = p.id
 where p.role = 'driver' and d.id is null;

-- ---- Vérification ----------------------------------------------------------
-- Doit renvoyer 0 : plus aucun livreur sans fiche.
select count(*) as livreurs_sans_fiche
  from public.profiles p
  left join public.drivers d on d.id = p.id
 where p.role = 'driver' and d.id is null;
