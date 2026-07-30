-- ==========================================================================
--  12 — FRAIS DE LIVRAISON SELON LA DISTANCE
--  --------------------------------------------------------------------------
--  Jusqu'ici chaque restaurant fixait ses frais de livraison, sans rapport
--  avec la distance réellement parcourue. Un livreur qui traversait la ville
--  était payé comme celui qui livrait l'immeuble d'en face.
--
--  Le barème, réglable depuis l'espace administrateur :
--
--      jusqu'à 10 km ........  250 DA
--      de 10 à 15 km ........  400 DA
--      au-delà de 15 km .....  livraison refusée
--
--  Le calcul vit ICI et pas seulement dans le site. Les montants d'une
--  commande sont envoyés par le navigateur du client : la clé publique permet
--  d'appeler l'API directement et d'annoncer 0 DA de livraison. Un trigger
--  recalcule donc les frais, la commission, la part du livreur et le total à
--  l'insertion, à partir des positions GPS enregistrées.
--
--  Limite connue : le sous-total des plats reste calculé par le site, car les
--  lignes de commande sont insérées après la commande elle-même. C'était déjà
--  le cas avant ce fichier.
--
--  Sans risque et rejouable.
-- ==========================================================================

-- 1. Le barème dans les réglages --------------------------------------------
alter table public.platform_settings
  add column if not exists fee_near_da int not null default 250,   -- courte distance
  add column if not exists fee_far_da  int not null default 400,   -- longue distance
  add column if not exists near_km     numeric(4,1) not null default 10,
  add column if not exists max_km      numeric(4,1) not null default 15;

-- 2. La distance restaurant → client, en kilomètres --------------------------
-- Même calcul que dans le site : distance à vol d'oiseau × 1,3, parce que les
-- rues ne sont pas des lignes droites. Sans position GPS des deux côtés, on
-- estime par quartier — un client sans point sur la carte ne doit pas passer
-- automatiquement au tarif le plus cher.
create or replace function public.order_distance_km(
  r_lat double precision, r_lng double precision,
  c_lat double precision, c_lng double precision,
  r_zone uuid, c_zone uuid
) returns numeric language sql immutable as $$
  select case
    when r_lat is null or r_lng is null or c_lat is null or c_lng is null
      then case when r_zone is not null and r_zone = c_zone then 2.0 else 4.5 end
    else round((
      6371 * 2 * asin(sqrt(
        power(sin(radians(c_lat - r_lat) / 2), 2) +
        cos(radians(r_lat)) * cos(radians(c_lat)) *
        power(sin(radians(c_lng - r_lng) / 2), 2)
      )) * 1.3
    )::numeric, 1)
  end;
$$;

-- 3. Les frais qui correspondent à une distance ------------------------------
create or replace function public.delivery_fee_for_km(km numeric)
returns int language sql stable security definer set search_path = public as $$
  select case
    when km <= coalesce((select near_km from public.platform_settings where id = 1), 10)
      then coalesce((select fee_near_da from public.platform_settings where id = 1), 250)
    else coalesce((select fee_far_da from public.platform_settings where id = 1), 400)
  end;
$$;
grant execute on function public.delivery_fee_for_km(numeric) to authenticated, anon;

-- 4. Le recalcul à l'insertion ----------------------------------------------
create or replace function public.calc_order_amounts()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  s public.platform_settings;
  r public.restaurants;
  km numeric;
begin
  select * into s from public.platform_settings where id = 1;
  select * into r from public.restaurants where id = new.restaurant_id;

  km := public.order_distance_km(r.lat, r.lng, new.address_lat, new.address_lng,
                                 r.zone_id, new.zone_id);

  if km > coalesce(s.max_km, 15) then
    raise exception 'Cette adresse est à % km du restaurant. Au-delà de % km, la livraison n''est pas assurée.',
      km, coalesce(s.max_km, 15) using errcode = 'check_violation';
  end if;

  new.delivery_fee   := public.delivery_fee_for_km(km);
  new.commission     := round(coalesce(new.subtotal, 0) * coalesce(s.commission_rate, 0.10));
  new.driver_earning := round(new.delivery_fee * coalesce(s.driver_share, 0.80));
  new.total          := coalesce(new.subtotal, 0) + new.delivery_fee;

  return new;
end $$;

drop trigger if exists trg_calc_order_amounts on public.orders;
create trigger trg_calc_order_amounts
  before insert on public.orders
  for each row execute function public.calc_order_amounts();

-- ==========================================================================
--  MODIFIER LE BARÈME
--  Depuis l'espace administrateur → Réglages, ou ici :
--
--    update public.platform_settings
--       set fee_near_da = 250, fee_far_da = 400, near_km = 10, max_km = 15
--     where id = 1;
--
--  VÉRIFIER une distance et son tarif :
--    select public.order_distance_km(36.7132, 4.0438, 36.7500, 4.1000, null, null) as km,
--           public.delivery_fee_for_km(
--             public.order_distance_km(36.7132, 4.0438, 36.7500, 4.1000, null, null)) as frais;
-- ==========================================================================

select fee_near_da, fee_far_da, near_km, max_km from public.platform_settings where id = 1;
