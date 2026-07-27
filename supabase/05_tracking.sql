-- ============================================================================
--  TALABI — Mise à jour : suivi du livreur en direct
-- ----------------------------------------------------------------------------
--  À exécuter si tu avais déjà installé la base avant cette fonctionnalité.
--  Sur une nouvelle installation, 01_schema.sql contient déjà ces colonnes.
--  Sans risque : aucune donnée existante n'est modifiée.
-- ============================================================================

alter table public.drivers add column if not exists last_lat         double precision;
alter table public.drivers add column if not exists last_lng         double precision;
alter table public.drivers add column if not exists last_position_at timestamptz;

-- ----------------------------------------------------------------------------
--  Le client doit pouvoir lire la position du livreur qui lui apporte sa
--  commande — mais uniquement pendant la livraison, et uniquement la sienne.
--  Cette fonction est en security definer : elle contourne la RLS de façon
--  contrôlée et ne renvoie rien en dehors de ces conditions.
-- ----------------------------------------------------------------------------
create or replace function public.driver_position(p_order uuid)
returns table (lat double precision, lng double precision, at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.last_lat, d.last_lng, d.last_position_at
    from public.orders o
    join public.drivers d on d.id = o.driver_id
   where o.id = p_order
     and o.status in ('driver_assigned', 'delivering')
     and (
          o.client_id = auth.uid()                 -- le client concerné
       or o.driver_id = auth.uid()                 -- le livreur lui-même
       or public.owns_restaurant(o.restaurant_id)  -- le restaurant concerné
       or public.is_admin()
     )
     and d.last_lat is not null;
$$;

grant execute on function public.driver_position(uuid) to authenticated;

-- Vérification
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'drivers'
   and column_name in ('last_lat', 'last_lng', 'last_position_at');
