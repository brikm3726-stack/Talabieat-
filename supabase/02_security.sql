-- ============================================================================
--  TALABI — Fichier 2/3 : Fonctions, triggers, Row Level Security
--  À exécuter APRÈS 01_schema.sql
-- ============================================================================

-- ========================================================================
--  FONCTIONS UTILITAIRES (security definer -> évite la récursion RLS)
-- ========================================================================
create or replace function public.my_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.owns_restaurant(rid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurants where id = rid and owner_id = auth.uid());
$$;

-- Deux fonctions qui existent pour une seule raison : casser une récursion.
--
-- La lecture de « orders » doit regarder dans « drivers » (ce livreur est-il
-- validé, dans la bonne zone ?) et la lecture de « drivers » doit regarder dans
-- « orders » (ce client a-t-il le droit de voir ce livreur ?). Écrites en clair
-- dans les policies, ces deux questions s'appellent l'une l'autre sans fin et
-- PostgreSQL refuse tout : « infinite recursion detected in policy ».
--
-- En security definer, la lecture se fait au nom du propriétaire des tables :
-- la RLS ne se redéclenche pas à l'intérieur, la boucle est coupée. Chaque
-- fonction reste étroitement limitée à sa question, et à auth.uid().
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

create or replace function public.is_approved_driver()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.drivers where id = auth.uid() and validation_status = 'approved');
$$;

-- ========================================================================
--  CRÉATION AUTOMATIQUE DU PROFIL À L'INSCRIPTION
--  Le rôle est lu depuis raw_user_meta_data (envoyé par le front à signUp)
-- ========================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted_role user_role;
begin
  begin
    wanted_role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'client');
  exception when others then
    wanted_role := 'client';
  end;

  -- personne ne s'auto-promeut admin depuis le front
  if wanted_role = 'admin' then
    wanted_role := 'client';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    new.raw_user_meta_data->>'phone',
    wanted_role
  )
  on conflict (id) do nothing;

  -- fiche livreur en attente de validation
  if wanted_role = 'driver' then
    insert into public.drivers (id) values (new.id) on conflict (id) do nothing;
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========================================================================
--  NOTIFICATIONS AUTOMATIQUES SUR LE CYCLE DE VIE DE LA COMMANDE
-- ========================================================================
create or replace function public.notify(p_user uuid, p_title text, p_body text, p_type text, p_order uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, title, body, type, order_id)
  select p_user, p_title, p_body, p_type, p_order where p_user is not null;
$$;

create or replace function public.on_order_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r_owner uuid;
  r_name  text;
  d       record;
begin
  select owner_id, name into r_owner, r_name from public.restaurants where id = new.restaurant_id;

  -- nouvelle commande -> restaurant
  if tg_op = 'INSERT' then
    perform public.notify(r_owner, 'Nouvelle commande #' || new.code,
      'Une nouvelle commande vient d''arriver.', 'new_order', new.id);
    return new;
  end if;

  if new.status is distinct from old.status then
    case new.status
      when 'accepted' then
        perform public.notify(new.client_id, 'Commande acceptée',
          r_name || ' a accepté votre commande #' || new.code, 'accepted', new.id);
      when 'preparing' then
        perform public.notify(new.client_id, 'Préparation en cours',
          'Votre commande #' || new.code || ' est en préparation.', 'preparing', new.id);
      when 'ready' then
        perform public.notify(new.client_id, 'Commande prête',
          'Votre commande #' || new.code || ' est prête, recherche d''un livreur…', 'ready', new.id);
        -- alerter tous les livreurs disponibles de la zone
        for d in select dr.id from public.drivers dr
                 where dr.validation_status = 'approved'
                   and dr.status = 'available'
                   and (dr.zone_id = new.zone_id or dr.zone_id is null)
        loop
          perform public.notify(d.id, 'Nouvelle livraison disponible',
            r_name || ' — commande #' || new.code, 'delivery_available', new.id);
        end loop;
      when 'driver_assigned' then
        perform public.notify(new.client_id, 'Livreur trouvé',
          'Un livreur prend en charge votre commande #' || new.code, 'driver_assigned', new.id);
        perform public.notify(r_owner, 'Livreur assigné',
          'Un livreur vient récupérer la commande #' || new.code, 'driver_assigned', new.id);
      when 'delivering' then
        perform public.notify(new.client_id, 'En cours de livraison',
          'Votre commande #' || new.code || ' est en route !', 'delivering', new.id);
      when 'delivered' then
        perform public.notify(new.client_id, 'Commande livrée',
          'Bon appétit ! Merci de confirmer la réception.', 'delivered', new.id);
        perform public.notify(r_owner, 'Commande livrée',
          'La commande #' || new.code || ' a été livrée.', 'delivered', new.id);
        -- statistiques livreur
        if new.driver_id is not null then
          update public.drivers
             set total_deliveries = total_deliveries + 1,
                 total_earnings   = total_earnings + coalesce(new.driver_earning,0),
                 status           = 'available'
           where id = new.driver_id;
        end if;
      when 'rejected' then
        perform public.notify(new.client_id, 'Commande refusée',
          coalesce(new.reject_reason,'Le restaurant ne peut pas honorer votre commande.'), 'rejected', new.id);
      when 'cancelled' then
        perform public.notify(r_owner, 'Commande annulée',
          'Le client a annulé la commande #' || new.code, 'cancelled', new.id);
      else null;
    end case;
  end if;

  return new;
end $$;

drop trigger if exists trg_order_insert on public.orders;
create trigger trg_order_insert after insert on public.orders
  for each row execute function public.on_order_change();

drop trigger if exists trg_order_update on public.orders;
create trigger trg_order_update after update on public.orders
  for each row execute function public.on_order_change();

-- horodatage automatique des étapes
create or replace function public.stamp_order_status()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    case new.status
      when 'accepted'        then new.accepted_at    := now();
      when 'ready'           then new.ready_at       := now();
      when 'driver_assigned' then new.assigned_at    := now();
      when 'delivering'      then new.delivering_at  := now();
      when 'delivered'       then new.delivered_at   := now();
      else null;
    end case;
  end if;
  return new;
end $$;

drop trigger if exists trg_stamp_order on public.orders;
create trigger trg_stamp_order before update on public.orders
  for each row execute function public.stamp_order_status();

-- ========================================================================
--  PRISE EN CHARGE ATOMIQUE D'UNE COMMANDE PAR UN LIVREUR
--  (empêche deux livreurs de prendre la même course)
-- ========================================================================
create or replace function public.claim_order(p_order uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if not public.is_approved_driver() then
    raise exception 'Votre compte livreur n''est pas encore validé.';
  end if;

  update public.orders
     set driver_id = auth.uid(), status = 'driver_assigned'
   where id = p_order and status = 'ready' and driver_id is null
  returning * into o;

  if o.id is null then
    raise exception 'Cette commande vient d''être prise par un autre livreur.';
  end if;

  update public.drivers set status = 'busy' where id = auth.uid();
  return o;
end $$;

-- ========================================================================
--  ROW LEVEL SECURITY
-- ========================================================================
alter table public.profiles              enable row level security;
alter table public.zones                 enable row level security;
alter table public.categories            enable row level security;
alter table public.restaurants           enable row level security;
alter table public.restaurant_categories enable row level security;
alter table public.menu_items            enable row level security;
alter table public.menu_options          enable row level security;
alter table public.menu_variants         enable row level security;
alter table public.drivers               enable row level security;
alter table public.addresses             enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.notifications         enable row level security;
alter table public.platform_settings     enable row level security;

-- ---- ZONES & CATEGORIES : lecture publique, écriture admin
drop policy if exists zones_read   on public.zones;
create policy zones_read   on public.zones      for select using (true);
drop policy if exists zones_admin  on public.zones;
create policy zones_admin  on public.zones      for all    using (public.is_admin()) with check (public.is_admin());

drop policy if exists cats_read    on public.categories;
create policy cats_read    on public.categories for select using (true);
drop policy if exists cats_admin   on public.categories;
create policy cats_admin   on public.categories for all    using (public.is_admin()) with check (public.is_admin());

-- ---- PROFILES
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- un client doit pouvoir voir le nom/tel du livreur assigné, et inversement
drop policy if exists profiles_order_parties on public.profiles;
create policy profiles_order_parties on public.profiles for select
  using (exists (
    select 1 from public.orders o
    where (o.client_id = profiles.id or o.driver_id = profiles.id)
      and (o.client_id = auth.uid() or o.driver_id = auth.uid() or public.owns_restaurant(o.restaurant_id))
  ));

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid() and not is_blocked) with check (id = auth.uid());

drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- RESTAURANTS
drop policy if exists rest_public_read on public.restaurants;
create policy rest_public_read on public.restaurants for select
  using (status = 'approved' or owner_id = auth.uid() or public.is_admin());

drop policy if exists rest_owner_insert on public.restaurants;
create policy rest_owner_insert on public.restaurants for insert
  with check (owner_id = auth.uid() and public.my_role() = 'restaurant');

drop policy if exists rest_owner_update on public.restaurants;
create policy rest_owner_update on public.restaurants for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists rest_admin on public.restaurants;
create policy rest_admin on public.restaurants for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists restcat_read on public.restaurant_categories;
create policy restcat_read on public.restaurant_categories for select using (true);
drop policy if exists restcat_write on public.restaurant_categories;
create policy restcat_write on public.restaurant_categories for all
  using (public.owns_restaurant(restaurant_id) or public.is_admin())
  with check (public.owns_restaurant(restaurant_id) or public.is_admin());

-- ---- MENU
drop policy if exists menu_read on public.menu_items;
create policy menu_read on public.menu_items for select
  using (
    exists (select 1 from public.restaurants r where r.id = restaurant_id and r.status = 'approved')
    or public.owns_restaurant(restaurant_id) or public.is_admin()
  );

drop policy if exists menu_write on public.menu_items;
create policy menu_write on public.menu_items for all
  using (public.owns_restaurant(restaurant_id) or public.is_admin())
  with check (public.owns_restaurant(restaurant_id) or public.is_admin());

drop policy if exists opts_read on public.menu_options;
create policy opts_read on public.menu_options for select using (true);
drop policy if exists opts_write on public.menu_options;
create policy opts_write on public.menu_options for all
  using (exists (select 1 from public.menu_items m where m.id = menu_item_id and (public.owns_restaurant(m.restaurant_id) or public.is_admin())))
  with check (exists (select 1 from public.menu_items m where m.id = menu_item_id and (public.owns_restaurant(m.restaurant_id) or public.is_admin())));

-- Formats : mêmes règles que les suppléments — lecture publique,
-- écriture réservée au propriétaire du restaurant du plat.
drop policy if exists variants_read on public.menu_variants;
create policy variants_read on public.menu_variants for select using (true);
drop policy if exists variants_write on public.menu_variants;
create policy variants_write on public.menu_variants for all
  using (exists (select 1 from public.menu_items m where m.id = menu_item_id and (public.owns_restaurant(m.restaurant_id) or public.is_admin())))
  with check (exists (select 1 from public.menu_items m where m.id = menu_item_id and (public.owns_restaurant(m.restaurant_id) or public.is_admin())));

-- ---- TÉLÉPHONE FIGÉ 30 JOURS
-- Le contrôle vit ici et pas seulement dans le formulaire : un champ désactivé
-- se rouvre en deux clics, et la clé publique permet d'appeler l'API en direct.
create or replace function public.lock_phone_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  depuis timestamptz;
  restant int;
begin
  if new.phone is not distinct from old.phone then
    return new;
  end if;
  -- un administrateur doit pouvoir corriger un numéro erroné
  if public.is_admin() then
    new.phone_changed_at := now();
    return new;
  end if;
  depuis := coalesce(old.phone_changed_at, old.created_at);
  if old.phone is not null and depuis is not null
     and depuis > now() - interval '30 days' then
    restant := ceil(extract(epoch from (depuis + interval '30 days' - now())) / 86400);
    raise exception 'Votre numéro ne sera modifiable que dans % jour(s).', restant
      using errcode = 'check_violation';
  end if;
  new.phone_changed_at := now();
  return new;
end;
$$;

drop trigger if exists trg_lock_phone on public.profiles;
create trigger trg_lock_phone
  before update of phone on public.profiles
  for each row execute function public.lock_phone_changes();

-- ---- DRIVERS
drop policy if exists drivers_self on public.drivers;
create policy drivers_self on public.drivers for select
  using (id = auth.uid() or public.is_admin()
     or public.shares_order_with_driver(drivers.id));

drop policy if exists drivers_self_update on public.drivers;
create policy drivers_self_update on public.drivers for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists drivers_self_insert on public.drivers;
create policy drivers_self_insert on public.drivers for insert
  with check (id = auth.uid());

drop policy if exists drivers_admin on public.drivers;
create policy drivers_admin on public.drivers for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- ADDRESSES
drop policy if exists addr_owner on public.addresses;
create policy addr_owner on public.addresses for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---- ORDERS
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select
  using (
    client_id = auth.uid()
    or driver_id = auth.uid()
    or public.owns_restaurant(restaurant_id)
    or public.is_admin()
    -- les livreurs validés & disponibles voient les courses libres de leur zone
    or (status = 'ready' and driver_id is null
        and public.is_approved_driver_in_zone(zone_id))
  );

drop policy if exists orders_client_insert on public.orders;
create policy orders_client_insert on public.orders for insert
  with check (client_id = auth.uid());

drop policy if exists orders_client_update on public.orders;
create policy orders_client_update on public.orders for update
  using (client_id = auth.uid()) with check (client_id = auth.uid());

drop policy if exists orders_restaurant_update on public.orders;
create policy orders_restaurant_update on public.orders for update
  using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));

drop policy if exists orders_driver_update on public.orders;
create policy orders_driver_update on public.orders for update
  using (driver_id = auth.uid()) with check (driver_id = auth.uid());

drop policy if exists orders_admin on public.orders;
create policy orders_admin on public.orders for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- ORDER ITEMS
drop policy if exists items_read on public.order_items;
create policy items_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id));  -- filtré par RLS de orders

drop policy if exists items_insert on public.order_items;
create policy items_insert on public.order_items for insert
  with check (exists (select 1 from public.orders o where o.id = order_id and o.client_id = auth.uid()));

drop policy if exists items_admin on public.order_items;
create policy items_admin on public.order_items for all
  using (public.is_admin()) with check (public.is_admin());

-- ---- NOTIFICATIONS
drop policy if exists notif_owner on public.notifications;
create policy notif_owner on public.notifications for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notif_delete on public.notifications;
create policy notif_delete on public.notifications for delete using (user_id = auth.uid() or public.is_admin());

-- ---- SETTINGS
drop policy if exists settings_read on public.platform_settings;
create policy settings_read on public.platform_settings for select using (true);
drop policy if exists settings_admin on public.platform_settings;
create policy settings_admin on public.platform_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- ========================================================================
--  REALTIME (suivi de commande en direct + notifications)
-- ========================================================================
do $$ begin
  alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.drivers;
exception when duplicate_object then null; end $$;
