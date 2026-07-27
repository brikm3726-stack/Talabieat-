-- ==========================================================================
--  07 — FORMATS DES PLATS  (Solo / Menu, Small / Medium / Méga…)
--  --------------------------------------------------------------------------
--  À exécuter UNIQUEMENT si votre base a été créée avant cette évolution.
--  Une nouvelle installation a déjà tout : 01_schema.sql et 02_security.sql
--  contiennent ces définitions.
--
--  Ce script est sans risque et rejouable : il ne supprime rien et n'écrase
--  aucune donnée existante. Les plats déjà en ligne gardent leur prix unique.
-- ==========================================================================

-- 1. La table des formats -------------------------------------------------
-- Le prix est ABSOLU (ce que le restaurant facture réellement), pas un écart.
-- Un plat sans aucune ligne ici continue de se vendre à menu_items.price.
create table if not exists public.menu_variants (
  id            uuid primary key default gen_random_uuid(),
  menu_item_id  uuid not null references public.menu_items(id) on delete cascade,
  name          text not null,
  price         int not null check (price >= 0),
  sort_order    int not null default 0,
  is_active     boolean not null default true
);
create index if not exists idx_menu_variants_item on public.menu_variants(menu_item_id);

-- 2. Le format retenu, figé dans la commande -------------------------------
-- Comme le nom et le prix de la ligne : si le restaurant renomme son format
-- plus tard, les commandes déjà passées gardent ce qui a été vendu.
alter table public.order_items add column if not exists variant text;

-- 3. Sécurité --------------------------------------------------------------
alter table public.menu_variants enable row level security;

-- Lecture publique : un client doit voir les formats avant de commander.
drop policy if exists variants_read on public.menu_variants;
create policy variants_read on public.menu_variants for select using (true);

-- Écriture réservée au propriétaire du restaurant auquel le plat appartient.
drop policy if exists variants_write on public.menu_variants;
create policy variants_write on public.menu_variants for all
  using (exists (select 1 from public.menu_items m
                 where m.id = menu_item_id
                   and (public.owns_restaurant(m.restaurant_id) or public.is_admin())))
  with check (exists (select 1 from public.menu_items m
                      where m.id = menu_item_id
                        and (public.owns_restaurant(m.restaurant_id) or public.is_admin())));

-- ==========================================================================
--  Vérification
-- ==========================================================================
-- select count(*) as formats from public.menu_variants;
-- select column_name from information_schema.columns
--   where table_name = 'order_items' and column_name = 'variant';
