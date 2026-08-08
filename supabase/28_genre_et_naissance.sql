-- ==========================================================================
--  28 — GENRE ET DATE DE NAISSANCE SUR LE PROFIL
--  --------------------------------------------------------------------------
--  Deux champs demandés sur l'écran « Informations personnelles ».
--
--  POURQUOI UNE DATE DE NAISSANCE ET PAS UN ÂGE
--  Un âge stocké en nombre est faux le lendemain de l'anniversaire, et rien
--  dans la base ne peut le savoir. La date, elle, reste vraie pour toujours et
--  l'âge s'en déduit à l'affichage. C'est le même champ à remplir pour
--  l'utilisateur — un sélecteur de date plutôt qu'un nombre à taper.
--
--  Les deux colonnes sont NULLABLES et le resteront : ce sont des
--  renseignements, pas des conditions pour commander. Vingt-deux comptes
--  existent déjà, et aucun ne doit se retrouver invalide.
--
--  À exécuter dans l'éditeur SQL de Supabase. Rejouable sans dommage.
-- ==========================================================================

-- ------------------------------------------------------------------ colonnes
alter table public.profiles
  add column if not exists gender     text,
  add column if not exists birth_date date;

-- ------------------------------------------------------------- garde-fous
-- Le genre n'accepte que deux valeurs, en minuscules. Sans cette contrainte,
-- l'écran d'administration afficherait un jour « Homme », « homme » et « H »
-- comme trois catégories différentes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_gender_chk') then
    alter table public.profiles
      add constraint profiles_gender_chk
      check (gender is null or gender in ('homme', 'femme'));
  end if;
end $$;

-- Une date de naissance doit être dans le passé et rester plausible. Le vrai
-- but n'est pas de juger l'âge : c'est d'attraper la faute de frappe qui
-- transforme 1998 en 2998, et qui ferait ensuite afficher un âge négatif.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_birth_date_chk') then
    alter table public.profiles
      add constraint profiles_birth_date_chk
      check (birth_date is null
             or (birth_date > date '1900-01-01' and birth_date < current_date));
  end if;
end $$;

comment on column public.profiles.gender     is 'homme | femme | null — renseignement, jamais une condition';
comment on column public.profiles.birth_date is 'date de naissance ; l''âge se calcule à l''affichage';

-- ==========================================================================
--  RIEN À CHANGER CÔTÉ DROITS
--  La politique d'écriture de `profiles` porte sur la LIGNE, pas sur les
--  colonnes : un utilisateur qui pouvait déjà modifier son nom peut modifier
--  ces deux champs, et personne ne peut toucher la ligne d'un autre. Aucune
--  policy à réécrire, donc aucun risque d'en casser une au passage.
-- ==========================================================================

-- ------------------------------------------------------------- vérification
select
  column_name,
  data_type,
  is_nullable,
  case when column_name in ('gender', 'birth_date') then 'ajoutée' else '' end as verdict
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('gender', 'birth_date')
order by column_name;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname in ('profiles_gender_chk', 'profiles_birth_date_chk');
