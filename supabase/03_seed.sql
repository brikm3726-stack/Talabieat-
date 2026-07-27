-- ============================================================================
--  TALABI — Fichier 3/3 : Données de départ (zones, catégories, stockage)
--  À exécuter APRÈS 02_security.sql
-- ============================================================================

-- ------------------------------------------------------------- CATÉGORIES
insert into public.categories (slug, name_fr, name_ar, icon, sort_order) values
  ('pizza',        'Pizza',              'بيتزا',        '🍕', 1),
  ('tacos',        'Tacos',              'تاكوس',        '🌯', 2),
  ('burger',       'Burgers',            'برغر',         '🍔', 3),
  ('sandwich',     'Sandwichs',          'ساندويتش',     '🥪', 4),
  ('poulet',       'Poulet',             'دجاج',         '🍗', 5),
  ('traditionnel', 'Plats traditionnels','أكلات تقليدية','🥘', 6),
  ('dessert',      'Desserts',           'حلويات',       '🍰', 7),
  ('boisson',      'Boissons',           'مشروبات',      '🥤', 8),
  ('autre',        'Autres',             'أخرى',         '🍽️', 9)
on conflict (slug) do nothing;

-- ------------------------------------------------------------------ ZONES
-- Quartiers de la VILLE de Tizi Ouzou uniquement.
-- La plateforme reste volontairement concentrée sur la ville : livraisons
-- courtes, livreurs qui connaissent le terrain, délais tenus.
-- Tu peux ajouter/supprimer des quartiers depuis le tableau de bord admin.
insert into public.zones (name, wilaya, sort_order) values
  ('Centre-ville',      'Tizi Ouzou', 1),
  ('Nouvelle Ville',    'Tizi Ouzou', 2),
  ('M''Douha',          'Tizi Ouzou', 3),
  ('Redjaouna',         'Tizi Ouzou', 4),
  ('Hasnaoua',          'Tizi Ouzou', 5),
  ('Bekkar',            'Tizi Ouzou', 6),
  ('Haute Ville',       'Tizi Ouzou', 7),
  ('Boukhalfa',         'Tizi Ouzou', 8),
  ('Kef Naâdja',        'Tizi Ouzou', 9),
  ('Sidi Belloua',      'Tizi Ouzou', 10),
  ('Timizart Loghbar',  'Tizi Ouzou', 11),
  ('Tala Allam',        'Tizi Ouzou', 12),
  ('Cité 20 Août',      'Tizi Ouzou', 13),
  ('Oued Aïssi',        'Tizi Ouzou', 14)
on conflict (name, wilaya) do nothing;

-- ------------------------------------------------------- STOCKAGE (images)
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media auth upload" on storage.objects;
create policy "media auth upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

drop policy if exists "media auth update" on storage.objects;
create policy "media auth update" on storage.objects
  for update to authenticated using (bucket_id = 'media' and owner = auth.uid());

drop policy if exists "media auth delete" on storage.objects;
create policy "media auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and owner = auth.uid());

-- ============================================================================
--  PROMOUVOIR UN COMPTE EN ADMINISTRATEUR
--  1. Inscris-toi normalement sur le site avec ton email
--  2. Remplace l'email ci-dessous et exécute cette requête
-- ============================================================================
-- update public.profiles set role = 'admin' where email = 'ton-email@gmail.com';
