-- ============================================================================
--  TALABI — Mise à jour : positions GPS
-- ----------------------------------------------------------------------------
--  À exécuter UNIQUEMENT si tu avais déjà lancé 01_schema.sql avant l'ajout
--  du choix de position sur carte. Sur une nouvelle installation, 01_schema.sql
--  contient déjà ces colonnes et ce fichier ne fait rien.
--
--  Sans risque : ces commandes ne touchent à aucune donnée existante.
-- ============================================================================

alter table public.restaurants add column if not exists lat double precision;
alter table public.restaurants add column if not exists lng double precision;

alter table public.addresses   add column if not exists lat double precision;
alter table public.addresses   add column if not exists lng double precision;

alter table public.orders      add column if not exists address_lat double precision;
alter table public.orders      add column if not exists address_lng double precision;

-- Vérification : les 6 colonnes doivent apparaître
select table_name, column_name
  from information_schema.columns
 where table_schema = 'public'
   and column_name in ('lat', 'lng', 'address_lat', 'address_lng')
 order by table_name, column_name;
