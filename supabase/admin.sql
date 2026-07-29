-- ============================================================================
--  TALABI — DEVENIR ADMINISTRATEUR
--  ---------------------------------------------------------------------------
--  Personne ne peut se donner le rôle « admin » depuis le site : c'est bloqué
--  au niveau de la base (02_security.sql). C'est volontaire — sinon n'importe
--  quel visiteur s'inscrirait comme administrateur de la plateforme.
--
--  MODE D'EMPLOI
--   1. Crée ton compte normalement sur le site (n'importe quel rôle, avec ton
--      email ou avec Google).
--   2. Remplace l'email ci-dessous par le tien.
--   3. Supabase → SQL Editor → New query → colle ce fichier → RUN.
--   4. Déconnecte-toi puis reconnecte-toi sur le site : l'onglet Admin apparaît.
-- ============================================================================

update public.profiles
   set role = 'admin'
 where lower(email) = lower('brikm3726@gmail.com');   -- ← ton email ici

-- Vérification : la ligne doit afficher role = admin.
-- Si aucune ligne ne sort, c'est que le compte n'existe pas encore (étape 1)
-- ou que l'email est différent de celui utilisé à l'inscription.
select id, email, full_name, role, created_at
  from public.profiles
 where lower(email) = lower('brikm3726@gmail.com');


-- ============================================================================
--  REQUÊTES DE SURVEILLANCE — ce qui se passe sur la plateforme
--  Exécute-les quand tu veux, elles ne modifient rien.
-- ============================================================================

-- -- Tous les comptes, du plus récent au plus ancien
-- select created_at, role, full_name, email, phone, is_blocked
--   from public.profiles order by created_at desc limit 100;

-- -- Restaurants et leur état de validation
-- select r.created_at, r.name, r.status, r.is_open, z.name as quartier,
--        p.email as gerant
--   from public.restaurants r
--   left join public.zones z on z.id = r.zone_id
--   left join public.profiles p on p.id = r.owner_id
--  order by r.created_at desc;

-- -- Livreurs : validation (pending/approved), disponibilité, quartier
-- select d.created_at, p.full_name, p.phone, d.validation_status, d.status,
--        z.name as quartier, d.last_position_at, d.total_deliveries
--   from public.drivers d
--   join public.profiles p on p.id = d.id
--   left join public.zones z on z.id = d.zone_id
--  order by d.created_at desc;

-- -- Les 50 dernières commandes
-- select o.created_at, o.code, o.status, r.name as restaurant,
--        c.full_name as client, dr.full_name as livreur,
--        o.subtotal, o.delivery_fee, o.total
--   from public.orders o
--   left join public.restaurants r on r.id = o.restaurant_id
--   left join public.profiles c on c.id = o.client_id
--   left join public.profiles dr on dr.id = o.driver_id
--  order by o.created_at desc limit 50;

-- -- Chiffres du jour : commandes livrées, encaissé, commission, part livreurs
-- select count(*) as livrees,
--        sum(total) as encaisse,
--        sum(commission) as commission_plateforme,
--        sum(driver_earning) as part_livreurs
--   from public.orders
--  where status = 'delivered'
--    and created_at >= date_trunc('day', now());
