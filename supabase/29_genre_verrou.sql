-- ==========================================================================
--  29 — LE GENRE NE SE CHOISIT QU'UNE FOIS
--  --------------------------------------------------------------------------
--  CE FICHIER EXISTE PARCE QUE LE 28 EST DÉJÀ PASSÉ CHEZ TOI.
--
--  Les colonnes `gender` et `birth_date` sont en place, la contrainte à deux
--  valeurs aussi. Il ne reste que le verrou ajouté après coup, dont les
--  délimiteurs `$$` avaient été abîmés dans le fichier 28 — c'est ce bloc, et
--  lui seul, qui répondait « syntax error at or near "$" ».
--
--  Rejouer le 28 en entier serait sans danger (tout y est idempotent), mais
--  inutile : voici uniquement ce qui manque.
--
--  --------------------------------------------------------------------------
--  À QUOI IL SERT
--
--  L'écran « Informations personnelles » verrouille les deux cartes de genre dès
--  qu'un genre est enregistré. Mais un verrou d'interface n'est pas une règle :
--  il suffit d'appeler l'API directement pour le contourner. Si la règle doit
--  tenir, elle tient ici.
--
--  DEUX NUANCES INDISPENSABLES, et le déclencheur serait nuisible sans elles :
--
--  1. Réenregistrer LE MÊME genre passe. L'écran renvoie tout le profil à chaque
--     enregistrement, genre compris : sans cette nuance, changer son nom de
--     famille deviendrait impossible.
--  2. Passer de « non renseigné » à un genre passe. C'est le premier choix,
--     celui qu'on veut justement permettre.
--
--  Le corps est délimité par $fn$ et non par $$ : deux délimiteurs identiques
--  dans un même script peuvent se refermer l'un sur l'autre selon l'outil.
--
--  À exécuter dans l'éditeur SQL de Supabase. Rejouable sans dommage.
-- ==========================================================================

create or replace function public.profiles_genre_une_fois()
returns trigger
language plpgsql
as $fn$
begin
  if old.gender is not null and new.gender is distinct from old.gender then
    raise exception 'Le genre ne peut plus être modifié une fois choisi.';
  end if;
  return new;
end
$fn$;

drop trigger if exists profiles_genre_une_fois on public.profiles;
create trigger profiles_genre_une_fois
  before update of gender on public.profiles
  for each row execute function public.profiles_genre_une_fois();

-- ------------------------------------------------------------- vérification
-- Le déclencheur est-il bien posé ?
select tgname as declencheur,
       case when tgenabled = 'O' then 'actif' else 'désactivé' end as etat
from pg_trigger
where tgname = 'profiles_genre_une_fois';

-- Et l'état réel des deux colonnes et de la contrainte, pour confirmer que le
-- fichier 28 est bien passé — c'est la question qu'on se pose en arrivant ici.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('gender', 'birth_date')
order by column_name;

select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conname = 'profiles_gender_chk';
