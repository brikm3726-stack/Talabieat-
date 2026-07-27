-- ============================================================================
--  TALABI — Mise à jour : pastilles illustrées et retrait de « Poulet »
-- ----------------------------------------------------------------------------
--  À exécuter si tu avais déjà installé la base avant cette modification.
--  Sur une nouvelle installation, 01_schema.sql et 03_seed.sql font déjà tout.
--
--  Aucun plat n'est supprimé : ceux rangés dans « Poulet » basculent vers
--  « Autres » avant que la catégorie ne disparaisse.
-- ============================================================================

-- 1. Colonne pour les pastilles illustrées
alter table public.categories add column if not exists image_url text;

-- 2. Renseigner les images des catégories existantes
update public.categories set image_url = 'assets/img/categories/pizza.jpg'        where slug = 'pizza';
update public.categories set image_url = 'assets/img/categories/tacos.jpg'        where slug = 'tacos';
update public.categories set image_url = 'assets/img/categories/burger.jpg'       where slug = 'burger';
update public.categories set image_url = 'assets/img/categories/sandwich.jpg'     where slug = 'sandwich';
update public.categories set image_url = 'assets/img/categories/traditionnel.jpg' where slug = 'traditionnel';
update public.categories set image_url = 'assets/img/categories/dessert.jpg'      where slug = 'dessert';
update public.categories set image_url = 'assets/img/categories/boisson.jpg'      where slug = 'boisson';

-- 3. Retirer « Poulet » sans rien perdre
do $$
declare
  v_poulet uuid;
  v_autre  uuid;
begin
  select id into v_poulet from public.categories where slug = 'poulet';
  if v_poulet is null then
    raise notice 'Categorie poulet absente : rien a faire.';
    return;
  end if;

  -- la catégorie de repli doit exister
  select id into v_autre from public.categories where slug = 'autre';
  if v_autre is null then
    insert into public.categories (slug, name_fr, name_ar, icon, sort_order)
    values ('autre', 'Autres', 'أخرى', '🍽️', 8)
    returning id into v_autre;
  end if;

  -- les plats changent de rayon
  update public.menu_items set category_id = v_autre where category_id = v_poulet;

  -- les restaurants qui affichaient « Poulet » affichent « Autres »
  insert into public.restaurant_categories (restaurant_id, category_id)
    select restaurant_id, v_autre from public.restaurant_categories
     where category_id = v_poulet
  on conflict do nothing;
  delete from public.restaurant_categories where category_id = v_poulet;

  delete from public.categories where id = v_poulet;
  raise notice 'Categorie poulet supprimee, plats deplaces vers Autres.';
end $$;

-- 4. Remettre l'ordre d'affichage
update public.categories set sort_order = 1 where slug = 'pizza';
update public.categories set sort_order = 2 where slug = 'tacos';
update public.categories set sort_order = 3 where slug = 'burger';
update public.categories set sort_order = 4 where slug = 'sandwich';
update public.categories set sort_order = 5 where slug = 'traditionnel';
update public.categories set sort_order = 6 where slug = 'dessert';
update public.categories set sort_order = 7 where slug = 'boisson';
update public.categories set sort_order = 8 where slug = 'autre';

-- Vérification
select sort_order, slug, name_fr, image_url from public.categories order by sort_order;
