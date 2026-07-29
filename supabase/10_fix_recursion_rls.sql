-- ==========================================================================
--  10 — CORRECTIF : « infinite recursion detected in policy for relation orders »
--  --------------------------------------------------------------------------
--  À exécuter UNIQUEMENT sur une base installée avant le 30 juillet 2026.
--  Les fichiers 02_security.sql et 09_delais.sql contiennent désormais la
--  version corrigée : une nouvelle installation n'a pas besoin de ce fichier.
--
--  LE PROBLÈME
--  La règle de lecture de « orders » demandait à « drivers » si le livreur
--  connecté était validé et dans la bonne zone. Or la règle de lecture de
--  « drivers » demandait à « orders » si ce livreur partageait une commande
--  avec le lecteur. Les deux questions s'appelaient l'une l'autre sans fin :
--  PostgreSQL détecte la boucle et refuse TOUTE lecture de orders, drivers,
--  profiles et order_items — plus aucune commande ne s'affiche.
--
--  LA CORRECTION
--  Les deux questions passent par des fonctions « security definer » : elles
--  lisent au nom du propriétaire des tables, donc la RLS ne se redéclenche
--  pas à l'intérieur et la boucle est coupée. Chaque fonction ne répond qu'à
--  sa question, et toujours relativement à auth.uid() : aucun droit élargi.
--
--  Sans risque et rejouable : aucune donnée n'est touchée, seules les règles
--  de lecture sont réécrites.
-- ==========================================================================

create or replace function public.is_approved_driver_in_zone(p_zone uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.drivers d
     where d.id = auth.uid()
       and d.validation_status = 'approved'
       and (d.zone_id = p_zone or d.zone_id is null)
  );
$$;

create or replace function public.shares_order_with_driver(p_driver uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
     where o.driver_id = p_driver
       and (o.client_id = auth.uid() or public.owns_restaurant(o.restaurant_id))
  );
$$;

-- ---- DRIVERS : ne demande plus rien à « orders » en direct
drop policy if exists drivers_self on public.drivers;
create policy drivers_self on public.drivers for select
  using (id = auth.uid() or public.is_admin()
     or public.shares_order_with_driver(drivers.id));

-- ---- ORDERS : ne demande plus rien à « drivers » en direct
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select
  using (
    client_id = auth.uid()
    or driver_id = auth.uid()
    or public.owns_restaurant(restaurant_id)
    or public.is_admin()
    -- le livreur validé de la zone voit les courses libres, sauf celle qui est
    -- promise à un autre pendant ses 30 secondes, et celles qu'il a passées
    or (status = 'ready' and driver_id is null
        and public.is_approved_driver_in_zone(zone_id)
        and (offer_driver_id = auth.uid()
             or (offer_driver_id is null and not (auth.uid() = any(declined_by)))))
  );

-- Vérification : doit renvoyer une ligne (vide si aucune commande) sans erreur.
select count(*) as commandes_lisibles from public.orders;
