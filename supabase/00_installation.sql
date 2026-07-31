-- ============================================================================
--  TALABI — INSTALLATION COMPLETE DE LA BASE DE DONNEES
--  ---------------------------------------------------------------------------
--  UN SEUL FICHIER A EXECUTER. Copie tout son contenu dans
--  Supabase > SQL Editor > New query, puis clique RUN.
--
--  Il regroupe, dans le bon ordre, les fichiers 01 a 09 du dossier supabase/ :
--    01 schema      : tables et relations
--    02 security    : RLS, triggers, notifications, attribution des courses
--    03 seed        : quartiers de Tizi Ouzou, categories, stockage des images
--    04 geoloc      : positions GPS
--    05 tracking    : suivi du livreur en direct
--    06 categories  : pastilles illustrees
--    07 formats     : formats des plats (Solo / Menu / Mega)
--    08 phone lock  : telephone fige 30 jours
--    09 delais      : minuteurs restaurant / livreur, attribution automatique
--
--  Rejouable sans risque : aucune donnee existante n'est supprimee. Si tu
--  l'executes deux fois, la seconde ne change rien.
--
--  APRES l'execution : cree ton compte sur le site, puis lance le fichier
--  admin.sql pour te donner les droits d'administrateur.


-- ####################################################################
-- ###  01_schema.sql
-- ####################################################################

-- ============================================================================
--  TALABI — Plateforme de livraison de repas (Algérie)
--  Fichier 1/3 : Schéma de la base de données
--  À exécuter dans Supabase > SQL Editor
-- ============================================================================

-- ---------------------------------------------------------------- extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------- enums
do $$ begin
  create type user_role        as enum ('client','restaurant','driver','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status  as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type driver_status    as enum ('offline','available','busy');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_type     as enum ('moto','voiture','velo','autre');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status     as enum (
    'pending',          -- commande envoyée
    'accepted',         -- acceptée par le restaurant
    'preparing',        -- préparation en cours
    'ready',            -- prête
    'driver_assigned',  -- livreur trouvé
    'delivering',       -- en cours de livraison
    'delivered',        -- livrée
    'cancelled',        -- annulée par le client
    'rejected'          -- refusée par le restaurant
  );
exception when duplicate_object then null; end $$;

-- ========================================================================
--  ZONES (wilayas / communes / quartiers)
-- ========================================================================
create table if not exists public.zones (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  wilaya      text not null default 'Tizi Ouzou',
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  unique (name, wilaya)
);

-- ========================================================================
--  CATÉGORIES DE NOURRITURE
-- ========================================================================
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name_fr     text not null,
  name_ar     text,
  icon        text default '🍽️',   -- repli quand il n'y a pas d'image
  image_url   text,                 -- pastille illustrée
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

-- ========================================================================
--  PROFILS (1-1 avec auth.users)
-- ========================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  phone       text,
  -- dernière modification du téléphone : il est figé 30 jours (voir 02_security.sql)
  phone_changed_at timestamptz,
  avatar_url  text,
  role        user_role not null default 'client',
  zone_id     uuid references public.zones(id) on delete set null,
  is_blocked  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_profiles_role on public.profiles(role);

-- ========================================================================
--  RESTAURANTS
-- ========================================================================
create table if not exists public.restaurants (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  description   text,
  logo_url      text,
  cover_url     text,
  address       text,
  zone_id       uuid references public.zones(id) on delete set null,
  phone         text,
  lat           double precision,   -- position GPS du restaurant
  lng           double precision,
  opens_at      time not null default '10:00',
  closes_at     time not null default '23:00',
  is_open       boolean not null default true,   -- interrupteur manuel du gérant
  status        approval_status not null default 'pending',
  reject_reason text,
  rating        numeric(2,1) not null default 4.5,
  rating_count  int not null default 0,
  delivery_fee  int not null default 200,        -- DZD
  min_order     int not null default 0,          -- DZD
  prep_time_min int not null default 25,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_restaurants_zone   on public.restaurants(zone_id);
create index if not exists idx_restaurants_owner  on public.restaurants(owner_id);
create index if not exists idx_restaurants_status on public.restaurants(status);

-- liaison restaurant <-> catégories
create table if not exists public.restaurant_categories (
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  category_id   uuid references public.categories(id)  on delete cascade,
  primary key (restaurant_id, category_id)
);

-- ========================================================================
--  MENU
-- ========================================================================
create table if not exists public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id   uuid references public.categories(id) on delete set null,
  name          text not null,
  description   text,
  price         int not null check (price >= 0),   -- DZD
  image_url     text,
  is_available  boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_menu_items_restaurant on public.menu_items(restaurant_id);

-- suppléments / options
create table if not exists public.menu_options (
  id            uuid primary key default gen_random_uuid(),
  menu_item_id  uuid not null references public.menu_items(id) on delete cascade,
  name          text not null,
  extra_price   int not null default 0,
  is_active     boolean not null default true
);
create index if not exists idx_menu_options_item on public.menu_options(menu_item_id);

-- Formats d'un plat : Solo / Menu, Small / Medium / Méga…
-- Le client en choisit UN SEUL (contrairement aux suppléments, cumulables).
-- Le prix est absolu, pas un écart : le restaurateur saisit ce qu'il facture.
-- Un plat sans ligne ici se vend au prix unique de menu_items.price.
create table if not exists public.menu_variants (
  id            uuid primary key default gen_random_uuid(),
  menu_item_id  uuid not null references public.menu_items(id) on delete cascade,
  name          text not null,
  price         int not null check (price >= 0),
  sort_order    int not null default 0,
  is_active     boolean not null default true
);
create index if not exists idx_menu_variants_item on public.menu_variants(menu_item_id);

-- ========================================================================
--  LIVREURS
-- ========================================================================
create table if not exists public.drivers (
  id                uuid primary key references public.profiles(id) on delete cascade,
  vehicle           vehicle_type not null default 'moto',
  plate             text,
  zone_id           uuid references public.zones(id) on delete set null,
  status            driver_status not null default 'offline',
  validation_status approval_status not null default 'pending',
  reject_reason     text,
  id_card_url       text,
  rating            numeric(2,1) not null default 5.0,
  total_deliveries  int not null default 0,
  total_earnings    int not null default 0,
  -- dernière position connue, partagée pendant une livraison
  last_lat          double precision,
  last_lng          double precision,
  last_position_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_drivers_zone   on public.drivers(zone_id);
create index if not exists idx_drivers_status on public.drivers(status);

-- ========================================================================
--  ADRESSES CLIENT
-- ========================================================================
create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  label       text not null default 'Domicile',
  zone_id     uuid references public.zones(id) on delete set null,
  street      text not null,
  details     text,
  phone       text,
  lat         double precision,   -- point choisi sur la carte
  lng         double precision,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_addresses_user on public.addresses(user_id);

-- ========================================================================
--  COMMANDES
-- ========================================================================
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  code              text unique not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
  client_id         uuid not null references public.profiles(id) on delete cascade,
  restaurant_id     uuid not null references public.restaurants(id) on delete cascade,
  driver_id         uuid references public.profiles(id) on delete set null,
  zone_id           uuid references public.zones(id) on delete set null,
  status            order_status not null default 'pending',

  -- instantané de l'adresse (l'historique ne doit pas bouger si le client édite)
  address_street    text not null,
  address_details   text,
  address_lat       double precision,   -- point GPS figé au moment de la commande
  address_lng       double precision,
  client_phone      text not null,
  client_name       text,
  note              text,

  subtotal          int not null default 0,
  delivery_fee      int not null default 0,
  commission        int not null default 0,   -- part plateforme
  driver_earning    int not null default 0,   -- gain livreur
  total             int not null default 0,

  payment_method    text not null default 'cash',
  reject_reason     text,
  cancel_reason     text,
  client_confirmed  boolean not null default false,

  created_at        timestamptz not null default now(),
  accepted_at       timestamptz,
  ready_at          timestamptz,
  assigned_at       timestamptz,
  delivering_at     timestamptz,
  delivered_at      timestamptz
);
create index if not exists idx_orders_client     on public.orders(client_id);
create index if not exists idx_orders_restaurant on public.orders(restaurant_id);
create index if not exists idx_orders_driver     on public.orders(driver_id);
create index if not exists idx_orders_status     on public.orders(status);
create index if not exists idx_orders_zone       on public.orders(zone_id);

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  menu_item_id  uuid references public.menu_items(id) on delete set null,
  name          text not null,
  variant       text,                              -- format choisi (Méga, Menu…), null si prix unique
  unit_price    int not null,
  quantity      int not null check (quantity > 0),
  options       jsonb not null default '[]'::jsonb,
  line_total    int not null
);
create index if not exists idx_order_items_order on public.order_items(order_id);

-- ========================================================================
--  NOTIFICATIONS
-- ========================================================================
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  body        text,
  type        text not null default 'info',
  order_id    uuid references public.orders(id) on delete cascade,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read);

-- ========================================================================
--  PARAMÈTRES PLATEFORME (ligne unique)
-- ========================================================================
create table if not exists public.platform_settings (
  id                  int primary key default 1 check (id = 1),
  commission_rate     numeric(4,3) not null default 0.100,  -- 10 %
  driver_share        numeric(4,3) not null default 0.800,  -- 80 % des frais de livraison
  default_delivery_fee int not null default 200,
  currency            text not null default 'DZD',
  updated_at          timestamptz not null default now()
);
insert into public.platform_settings (id) values (1) on conflict (id) do nothing;


-- ####################################################################
-- ###  02_security.sql
-- ####################################################################

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


-- ####################################################################
-- ###  03_seed.sql
-- ####################################################################

-- ============================================================================
--  TALABI — Fichier 3/3 : Données de départ (zones, catégories, stockage)
--  À exécuter APRÈS 02_security.sql
-- ============================================================================

-- ------------------------------------------------------------- CATÉGORIES
-- image_url pointe vers les pastilles livrées avec le site.
insert into public.categories (slug, name_fr, name_ar, icon, image_url, sort_order) values
  ('pizza',        'Pizza',              'بيتزا',        '🍕', 'assets/img/categories/pizza.jpg',        1),
  ('tacos',        'Tacos',              'تاكوس',        '🌯', 'assets/img/categories/tacos.jpg',        2),
  ('burger',       'Burgers',            'برغر',         '🍔', 'assets/img/categories/burger.jpg',       3),
  ('sandwich',     'Sandwichs',          'ساندويتش',     '🥪', 'assets/img/categories/sandwich.jpg',     4),
  ('traditionnel', 'Plats traditionnels','أكلات تقليدية','🥘', 'assets/img/categories/traditionnel.jpg', 5),
  ('dessert',      'Desserts',           'حلويات',       '🍰', 'assets/img/categories/dessert.jpg',      6),
  ('boisson',      'Boissons',           'مشروبات',      '🥤', 'assets/img/categories/boisson.jpg',      7),
  ('autre',        'Autres',             'أخرى',         '🍽️', null,                                    8)
on conflict (slug) do update
  set name_fr = excluded.name_fr,
      icon = excluded.icon,
      image_url = excluded.image_url,
      sort_order = excluded.sort_order;

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


-- ####################################################################
-- ###  04_geoloc.sql
-- ####################################################################

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


-- ####################################################################
-- ###  05_tracking.sql
-- ####################################################################

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


-- ####################################################################
-- ###  06_categories.sql
-- ####################################################################

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


-- ####################################################################
-- ###  07_formats.sql
-- ####################################################################

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


-- ####################################################################
-- ###  08_phone_lock.sql
-- ####################################################################

-- ==========================================================================
--  08 — TÉLÉPHONE FIGÉ 30 JOURS
--  --------------------------------------------------------------------------
--  À exécuter UNIQUEMENT si votre base a été créée avant cette évolution.
--  Sans risque et rejouable : aucune donnée n'est supprimée.
--
--  Le contrôle vit dans la base, pas seulement dans le formulaire. Un champ
--  désactivé se rouvre en deux clics dans un navigateur, et la clé publique
--  permet d'appeler l'API directement : la règle doit tenir au niveau le plus
--  bas, sinon elle n'existe pas.
-- ==========================================================================

-- 1. Quand le numéro a-t-il été saisi pour la dernière fois ? ---------------
alter table public.profiles add column if not exists phone_changed_at timestamptz;

-- Comptes existants : on part de leur date de création, c'est le numéro
-- donné à l'inscription.
update public.profiles
   set phone_changed_at = created_at
 where phone_changed_at is null and phone is not null;

-- 2. Le verrou -------------------------------------------------------------
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
  -- rien à faire si le numéro ne bouge pas
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

-- ==========================================================================
--  Vérification
-- ==========================================================================
-- select phone, phone_changed_at from public.profiles limit 5;
-- -- doit échouer si le numéro a moins de 30 jours :
-- update public.profiles set phone = '0555000001' where id = auth.uid();


-- ####################################################################
-- ###  09_delais.sql
-- ####################################################################

-- ==========================================================================
--  09 — DÉLAIS DE RÉPONSE ET ATTRIBUTION AUTOMATIQUE DES COURSES
--  --------------------------------------------------------------------------
--  Deux minuteurs, de nature différente :
--
--   • Le restaurant a 5 minutes pour accepter ou refuser une commande. Passé
--     ce délai elle est refusée d'office : le client doit savoir à quoi s'en
--     tenir, une commande qui reste « en attente » une heure est pire qu'un
--     refus franc.
--
--   • Le livreur n'a que 30 secondes. Son silence ne refuse que POUR LUI : la
--     course repart aussitôt au livreur suivant, en ligne, le plus proche du
--     restaurant. Quand tout le monde a laissé passer son tour, la course
--     redevient visible par tous et un nouveau tour est relancé après une
--     minute — une commande n'est jamais abandonnée.
--
--  Script rejouable et sans risque : il ne supprime aucune donnée.
--
--  ⚠️  IMPORTANT — sans le planificateur de la partie 6, RIEN N'EXPIRE tant
--  qu'aucun navigateur n'est ouvert. C'est le seul point de ce fichier qui
--  demande une action de votre part dans le tableau de bord Supabase.
-- ==========================================================================

-- 1. Réglages ---------------------------------------------------------------
alter table public.platform_settings
  add column if not exists resto_timeout_s    int not null default 300,
  add column if not exists driver_timeout_s   int not null default 30,
  add column if not exists redispatch_after_s int not null default 60;

-- 2. Colonnes de suivi des délais -------------------------------------------
alter table public.orders
  -- échéance de réponse du restaurant (null dès qu'il a répondu)
  add column if not exists respond_deadline timestamptz,
  -- livreur à qui la course est proposée en ce moment, et jusqu'à quand
  add column if not exists offer_driver_id  uuid references public.profiles(id),
  add column if not exists offer_deadline   timestamptz,
  -- livreurs ayant laissé passer leur tour sur cette course
  add column if not exists declined_by      uuid[] not null default '{}',
  -- depuis quand la course cherche un livreur (sert à relancer un tour)
  add column if not exists search_since     timestamptz;

create index if not exists idx_orders_respond_deadline
  on public.orders(respond_deadline) where status = 'pending';
create index if not exists idx_orders_offer
  on public.orders(offer_deadline) where status = 'ready' and driver_id is null;

-- Les commandes déjà en attente au moment de la migration reçoivent une
-- échéance, sinon elles resteraient éternellement sans compte à rebours.
update public.orders
   set respond_deadline = created_at + make_interval(secs =>
         (select resto_timeout_s from public.platform_settings where id = 1))
 where status = 'pending' and respond_deadline is null;

-- 3. Choisir le livreur suivant ---------------------------------------------
-- Critères, dans l'ordre : validé, en ligne et libre, même zone que la
-- commande, n'ayant pas déjà passé son tour — puis le plus proche du
-- restaurant, car c'est là qu'il doit se rendre en premier. Sans position
-- connue, il passe après ceux que l'on sait situer.
create or replace function public.dispatch_order(p_order uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o        public.orders;
  r        public.restaurants;
  suivant  uuid;
  delai    int;
begin
  select * into o from public.orders where id = p_order;
  if o.id is null or o.status <> 'ready' or o.driver_id is not null then
    return null;
  end if;
  select * into r from public.restaurants where id = o.restaurant_id;
  select driver_timeout_s into delai from public.platform_settings where id = 1;

  select d.id into suivant
    from public.drivers d
   where d.validation_status = 'approved'
     and d.status = 'available'
     and not (d.id = any(o.declined_by))
     and (d.zone_id is null or o.zone_id is null or d.zone_id = o.zone_id)
   order by
     case
       when d.last_lat is null or r.lat is null then 9999
       -- distance à vol d'oiseau, suffisante pour classer des candidats
       else 111.045 * sqrt(power(d.last_lat - r.lat, 2) +
                           power((d.last_lng - r.lng) * cos(radians(r.lat)), 2))
     end
   limit 1;

  if suivant is null then
    -- plus personne : la course reste ouverte à tous et on note depuis quand
    update public.orders
       set offer_driver_id = null,
           offer_deadline  = null,
           search_since    = coalesce(search_since, now())
     where id = p_order;
    return null;
  end if;

  update public.orders
     set offer_driver_id = suivant,
         offer_deadline  = now() + make_interval(secs => delai),
         search_since    = coalesce(search_since, now())
   where id = p_order;

  insert into public.notifications (user_id, title, body, type, order_id)
  values (suivant, 'Course à prendre — ' || delai || ' s',
          coalesce(r.name, 'Un restaurant') || ' — commande #' || o.code || '. Répondez vite !',
          'delivery_available', p_order);

  return suivant;
end $$;

-- 4. Appliquer les délais échus ---------------------------------------------
-- Renvoie true si quelque chose a changé. Appelée par le planificateur, et
-- aussi par l'application quand un compte à rebours tombe à zéro sous les
-- yeux de quelqu'un — inutile d'attendre le prochain passage du cron.
create or replace function public.expire_orders()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  s        public.platform_settings;
  o        public.orders;
  duree    text;
  change   boolean := false;
begin
  select * into s from public.platform_settings where id = 1;
  duree := case when s.resto_timeout_s < 60
            then s.resto_timeout_s || ' secondes'
            else round(s.resto_timeout_s / 60.0) || ' minutes' end;

  -- 4a. le restaurant n'a pas répondu
  for o in
    select * from public.orders
     where status = 'pending' and respond_deadline is not null and respond_deadline <= now()
     for update skip locked
  loop
    update public.orders
       set status = 'rejected',
           reject_reason = 'Sans réponse du restaurant après ' || duree ||
                           ', la commande a été annulée automatiquement.',
           respond_deadline = null
     where id = o.id;
    insert into public.notifications (user_id, title, body, type, order_id)
    select r.owner_id, 'Commande expirée #' || o.code,
           'Faute de réponse en ' || duree || ', la commande a été refusée automatiquement.',
           'rejected', o.id
      from public.restaurants r where r.id = o.restaurant_id;
    change := true;
  end loop;

  -- 4b. le livreur n'a pas répondu : au suivant
  for o in
    select * from public.orders
     where status = 'ready' and driver_id is null
       and offer_driver_id is not null and offer_deadline <= now()
     for update skip locked
  loop
    update public.orders
       set declined_by = declined_by || o.offer_driver_id,
           offer_driver_id = null, offer_deadline = null
     where id = o.id;
    insert into public.notifications (user_id, title, body, type, order_id)
    values (o.offer_driver_id, 'Course expirée',
            'Les ' || s.driver_timeout_s || ' secondes sont passées, la commande #' || o.code ||
            ' a été proposée à un autre livreur.', 'delivery_available', o.id);
    perform public.dispatch_order(o.id);
    change := true;
  end loop;

  -- 4c. courses sans preneur : premier envoi, ou relance d'un tour complet
  for o in
    select * from public.orders
     where status = 'ready' and driver_id is null and offer_driver_id is null
     for update skip locked
  loop
    if o.search_since is null then
      perform public.dispatch_order(o.id);
      change := true;
    elsif now() - o.search_since >= make_interval(secs => s.redispatch_after_s) then
      -- nouveau tour : tout le monde redevient candidat
      update public.orders set declined_by = '{}', search_since = now() where id = o.id;
      perform public.dispatch_order(o.id);
      change := true;
    end if;
  end loop;

  return change;
end $$;

-- 5. Le livreur passe son tour -----------------------------------------------
-- Ce n'est pas un refus de la commande : elle part au suivant immédiatement,
-- sans attendre la fin des 30 secondes.
create or replace function public.decline_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders
     set declined_by = declined_by || auth.uid(),
         offer_driver_id = null, offer_deadline = null
   where id = p_order and status = 'ready' and driver_id is null;
  perform public.dispatch_order(p_order);
end $$;

-- 6. Déclencheurs -------------------------------------------------------------
-- Le chronomètre du restaurant démarre à la création ; la recherche d'un
-- livreur démarre au passage en « prête ».
create or replace function public.stamp_deadlines()
returns trigger language plpgsql security definer set search_path = public as $$
declare delai int;
begin
  if tg_op = 'INSERT' then
    select resto_timeout_s into delai from public.platform_settings where id = 1;
    new.respond_deadline := now() + make_interval(secs => delai);
    return new;
  end if;

  if new.status is distinct from old.status then
    if old.status = 'pending' then new.respond_deadline := null; end if;
    if new.status = 'ready' and new.driver_id is null then
      new.declined_by := '{}'; new.search_since := null;
    end if;
    if new.status <> 'ready' then
      new.offer_driver_id := null; new.offer_deadline := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_stamp_deadlines on public.orders;
create trigger trg_stamp_deadlines
  before insert or update on public.orders
  for each row execute function public.stamp_deadlines();

-- La proposition elle-même se fait APRÈS l'écriture : dispatch_order relit la
-- commande, elle doit donc déjà être enregistrée.
create or replace function public.dispatch_when_ready()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ready' and new.driver_id is null
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    perform public.dispatch_order(new.id);
  end if;
  return null;
end $$;

drop trigger if exists trg_dispatch_when_ready on public.orders;
create trigger trg_dispatch_when_ready
  after insert or update on public.orders
  for each row execute function public.dispatch_when_ready();

-- 7. Lecture : la course proposée est réservée à son livreur -------------------
-- Sans cela, tous les livreurs de la zone continueraient de voir la course
-- pendant les 30 secondes où elle est promise à l'un d'eux.
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select
  using (
    client_id = auth.uid()
    or driver_id = auth.uid()
    or public.owns_restaurant(restaurant_id)
    or public.is_admin()
    -- is_approved_driver_in_zone est en security definer : sans elle, cette
    -- policy interrogerait « drivers », dont la policy interroge « orders »,
    -- et PostgreSQL rejetterait toute lecture pour récursion infinie.
    or (status = 'ready' and driver_id is null
        and public.is_approved_driver_in_zone(zone_id)
        and (offer_driver_id = auth.uid()
             or (offer_driver_id is null and not (auth.uid() = any(declined_by)))))
  );

-- claim_order refuse de doubler le livreur qui a la main
create or replace function public.claim_order(p_order uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if not public.is_approved_driver() then
    raise exception 'Votre compte livreur n''est pas encore validé.';
  end if;

  update public.orders
     set driver_id = auth.uid(), status = 'driver_assigned',
         offer_driver_id = null, offer_deadline = null, search_since = null
   where id = p_order and status = 'ready' and driver_id is null
     and (offer_driver_id is null or offer_driver_id = auth.uid()
          or offer_deadline <= now())
  returning * into o;

  if o.id is null then
    raise exception 'Cette commande vient d''être prise par un autre livreur.';
  end if;

  update public.drivers set status = 'busy' where id = auth.uid();
  return o;
end $$;

grant execute on function public.expire_orders()        to authenticated;
grant execute on function public.decline_order(uuid)    to authenticated;
grant execute on function public.dispatch_order(uuid)   to authenticated;

-- 8. LE PLANIFICATEUR — à faire une fois, à la main ---------------------------
-- Sans lui, rien n'expire quand personne n'a le site ouvert : une commande
-- passée à 23 h resterait « en attente » jusqu'au lendemain matin.
--
-- Dans le tableau de bord Supabase : Database → Extensions → activer pg_cron,
-- puis exécuter ces deux lignes.
--
--   create extension if not exists pg_cron;
--   select cron.schedule('talabi-delais', '10 seconds', $$select public.expire_orders()$$);
--
-- Pour vérifier :  select * from cron.job;
-- Pour arrêter  :  select cron.unschedule('talabi-delais');
--
-- pg_cron n'est pas disponible sur le plan gratuit de toutes les régions. À
-- défaut, une Edge Function appelée par un planificateur externe (cron-job.org,
-- GitHub Actions) qui fait un simple POST sur /rest/v1/rpc/expire_orders fait
-- exactement le même travail.


-- ####################################################################
-- ###  11_admin_protege.sql
-- ####################################################################

-- ==========================================================================
--  11 — PROTÉGER LE OU LES ADMINISTRATEURS FONDATEURS
--  --------------------------------------------------------------------------
--  Le problème : la sécurité par ligne autorise tout administrateur à modifier
--  n'importe quel profil — y compris celui du fondateur. Un deuxième admin, par
--  maladresse ou par malveillance, peut donc rétrograder le compte principal en
--  « client » ou le bloquer. Il n'existe alors plus aucun moyen de revenir en
--  arrière depuis le site : il faut repasser par l'éditeur SQL.
--
--  La protection vit ici, dans la base, et pas dans les pages d'administration.
--  Un contrôle écrit dans le site se contourne avec la clé publique et deux
--  lignes de JavaScript ; un trigger, non.
--
--  Ce qui reste possible depuis l'éditeur SQL de Supabase : tout. C'est voulu.
--  L'éditeur SQL n'a pas d'utilisateur connecté (auth.uid() est nul), et il
--  demande l'accès au tableau de bord Supabase — donc ton mot de passe et ta
--  double authentification. C'est ta porte de secours si tu perds ton compte.
--
--  Sans risque et rejouable.
-- ==========================================================================

-- 1. La liste des comptes protégés ------------------------------------------
-- Aucune policy n'est créée sur cette table : personne ne peut ni la lire ni
-- l'écrire depuis le site, quelle que soit sa clé. Seul l'éditeur SQL y touche.
create table if not exists public.protected_admins (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.protected_admins enable row level security;

-- 2. Le compte fondateur -----------------------------------------------------
-- Remplace l'adresse par la tienne, ou ajoute-en d'autres avec la même requête.
insert into public.protected_admins (email, note)
values ('brikm3726@gmail.com', 'Compte fondateur')
on conflict (email) do nothing;

-- 3. Le verrou ---------------------------------------------------------------
create or replace function public.protect_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Aucun utilisateur connecté = éditeur SQL ou clé service_role : on laisse.
  if auth.uid() is null then return new; end if;

  if not exists (
    select 1 from public.protected_admins p
     where lower(p.email) = lower(coalesce(old.email, ''))
  ) then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Ce compte administrateur est protégé : son rôle ne peut pas être modifié depuis le site.'
      using errcode = 'check_violation';
  end if;

  if new.is_blocked is distinct from old.is_blocked then
    raise exception 'Ce compte administrateur est protégé : il ne peut pas être bloqué.'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_protect_admin on public.profiles;
create trigger trg_protect_admin
  before update on public.profiles
  for each row execute function public.protect_admin();

-- 4. Et la suppression -------------------------------------------------------
create or replace function public.protect_admin_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return old; end if;
  if exists (
    select 1 from public.protected_admins p
     where lower(p.email) = lower(coalesce(old.email, ''))
  ) then
    raise exception 'Ce compte administrateur est protégé : il ne peut pas être supprimé depuis le site.'
      using errcode = 'check_violation';
  end if;
  return old;
end $$;

drop trigger if exists trg_protect_admin_delete on public.profiles;
create trigger trg_protect_admin_delete
  before delete on public.profiles
  for each row execute function public.protect_admin_delete();

-- ==========================================================================
--  MODE D'EMPLOI
--
--  Ajouter un compte protégé :
--    insert into public.protected_admins (email, note)
--    values ('associe@gmail.com', 'Co-fondateur') on conflict do nothing;
--
--  Retirer une protection :
--    delete from public.protected_admins where email = 'associe@gmail.com';
--
--  Voir la liste :
--    select * from public.protected_admins;
--
--  Reprendre la main si tout est perdu :
--    update public.profiles set role = 'admin', is_blocked = false
--     where lower(email) = lower('brikm3726@gmail.com');
-- ==========================================================================

select email, note from public.protected_admins;


-- ####################################################################
-- ###  12_frais_distance.sql
-- ####################################################################

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


-- ####################################################################
-- ###  13_credit_livreur.sql
-- ####################################################################

-- ==========================================================================
--  13 — CRÉDIT PRÉPAYÉ DU LIVREUR
--  --------------------------------------------------------------------------
--  Le livreur achète du crédit à la plateforme. Chaque course qu'il ACCEPTE
--  lui coûte la part plateforme des frais de livraison (20 % par défaut),
--  prélevée immédiatement. À zéro, il ne peut plus accepter de course tant
--  qu'il n'a pas rechargé.
--
--  Pourquoi prélever à l'acceptation et non à la livraison : sinon il suffit
--  de ne jamais cliquer sur « livrée », ou d'annuler, pour ne rien payer. En
--  prélevant à l'acceptation, la commission est acquise avant que le livreur
--  ait la moindre prise sur la suite.
--
--  Et parce que ce serait injuste autrement : si la course est annulée par le
--  restaurant, le client ou un administrateur, la commission est rendue
--  automatiquement. Le livreur n'y était pour rien.
--
--  Le blocage vit dans claim_order — la fonction qui attribue les courses —
--  et pas dans les écrans. Vider le cache ou appeler l'API à la main n'y
--  change rien.
--
--  Sans risque et rejouable.
-- ==========================================================================

-- 1. Le solde ----------------------------------------------------------------
alter table public.drivers
  add column if not exists credit_da int not null default 0;

-- Seuil d'alerte : en dessous, le livreur est prévenu qu'il va être bloqué.
alter table public.platform_settings
  add column if not exists credit_alert_da int not null default 200;

-- 2. Le carnet des mouvements ------------------------------------------------
-- Un solde sans historique est indéfendable : le jour où un livreur conteste,
-- il faut pouvoir montrer chaque ligne, datée.
create table if not exists public.driver_wallet (
  id         uuid primary key default gen_random_uuid(),
  driver_id  uuid not null references public.drivers(id) on delete cascade,
  order_id   uuid references public.orders(id) on delete set null,
  kind       text not null check (kind in ('recharge','commission','remboursement','ajustement')),
  amount     int  not null,          -- positif = crédit ajouté, négatif = prélevé
  balance_after int not null,        -- solde après l'opération, figé
  note       text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_wallet_driver on public.driver_wallet(driver_id, created_at desc);
create index if not exists idx_wallet_order  on public.driver_wallet(order_id);

alter table public.driver_wallet enable row level security;

drop policy if exists wallet_self on public.driver_wallet;
create policy wallet_self on public.driver_wallet for select
  using (driver_id = auth.uid() or public.is_admin());

drop policy if exists wallet_admin on public.driver_wallet;
create policy wallet_admin on public.driver_wallet for all
  using (public.is_admin()) with check (public.is_admin());
-- Personne n'écrit dans ce carnet depuis le site : ni le livreur, ni même
-- l'administrateur en direct. Tout passe par les fonctions ci-dessous.

-- 3. Ce que coûte une course -------------------------------------------------
create or replace function public.course_commission(p_delivery_fee int)
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, round(
    coalesce(p_delivery_fee, 0) *
    (1 - coalesce((select driver_share from public.platform_settings where id = 1), 0.80))
  )::int);
$$;
grant execute on function public.course_commission(int) to authenticated;

-- 4. Écrire une ligne et mettre à jour le solde ------------------------------
create or replace function public.wallet_write(
  p_driver uuid, p_kind text, p_amount int, p_order uuid, p_note text
) returns int language plpgsql security definer set search_path = public as $$
declare nouveau int;
begin
  update public.drivers
     set credit_da = credit_da + p_amount
   where id = p_driver
  returning credit_da into nouveau;

  if nouveau is null then
    raise exception 'Livreur introuvable.';
  end if;

  insert into public.driver_wallet (driver_id, order_id, kind, amount, balance_after, note, created_by)
  values (p_driver, p_order, p_kind, p_amount, nouveau, p_note, auth.uid());

  return nouveau;
end $$;

-- 5. Recharger — réservé à l'administrateur ----------------------------------
create or replace function public.driver_recharge(p_driver uuid, p_amount int, p_note text)
returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut recharger un compte livreur.';
  end if;
  if p_amount = 0 then
    raise exception 'Montant nul.';
  end if;
  return public.wallet_write(p_driver, case when p_amount > 0 then 'recharge' else 'ajustement' end,
                             p_amount, null, p_note);
end $$;
grant execute on function public.driver_recharge(uuid, int, text) to authenticated;

-- 6. L'attribution d'une course prélève la commission ------------------------
-- Reprise de claim_order (09_delais.sql) avec deux ajouts : une seule course
-- ouverte à la fois, et le prélèvement du crédit. Tout est dans la même
-- transaction : si le crédit manque, la course n'est pas prise du tout.
create or replace function public.claim_order(p_order uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  frais int;
  solde int;
begin
  if not public.is_approved_driver() then
    raise exception 'Votre compte livreur n''est pas encore validé.';
  end if;

  -- une seule course ouverte : sans cette règle, un livreur pourrait en
  -- réserver plusieurs et en abandonner la moitié
  if exists (
    select 1 from public.orders x
     where x.driver_id = auth.uid()
       and x.status in ('driver_assigned', 'delivering')
  ) then
    raise exception 'Terminez votre course en cours avant d''en accepter une autre.';
  end if;

  update public.orders
     set driver_id = auth.uid(), status = 'driver_assigned',
         offer_driver_id = null, offer_deadline = null, search_since = null
   where id = p_order and status = 'ready' and driver_id is null
     and (offer_driver_id is null or offer_driver_id = auth.uid()
          or offer_deadline <= now())
  returning * into o;

  if o.id is null then
    raise exception 'Cette commande vient d''être prise par un autre livreur.';
  end if;

  frais := public.course_commission(o.delivery_fee);
  select credit_da into solde from public.drivers where id = auth.uid();

  if coalesce(solde, 0) < frais then
    raise exception 'Crédit insuffisant : cette course coûte % DA de commission et il vous reste % DA. Rechargez pour continuer.',
      frais, coalesce(solde, 0) using errcode = 'check_violation';
  end if;

  perform public.wallet_write(auth.uid(), 'commission', -frais, o.id,
                              'Course ' || coalesce(o.code, ''));

  update public.drivers set status = 'busy' where id = auth.uid();
  return o;
end $$;

-- 7. Annulation : on rend la commission --------------------------------------
-- Uniquement si elle a été prélevée et pas déjà rendue. Le livreur n'est pas
-- responsable d'un restaurant qui ferme ou d'un client qui se ravise.
create or replace function public.refund_commission()
returns trigger language plpgsql security definer set search_path = public as $$
declare pris int;
begin
  if new.status not in ('cancelled', 'rejected') then return new; end if;
  if old.status = new.status then return new; end if;
  if new.driver_id is null then return new; end if;

  select coalesce(sum(amount), 0) into pris
    from public.driver_wallet
   where order_id = new.id and driver_id = new.driver_id;

  -- somme négative = commission prélevée et non remboursée
  if pris < 0 then
    perform public.wallet_write(new.driver_id, 'remboursement', -pris, new.id,
                                'Course annulée — commission rendue');
  end if;

  return new;
end $$;

drop trigger if exists trg_refund_commission on public.orders;
create trigger trg_refund_commission
  after update of status on public.orders
  for each row execute function public.refund_commission();

-- ==========================================================================
--  RECHARGER UN LIVREUR À LA MAIN (l'espace admin le fait aussi)
--    select public.driver_recharge('<id-du-livreur>', 2000, 'Versement espèces');
--
--  VOIR LES SOLDES
--    select p.full_name, p.phone, d.credit_da
--      from public.drivers d join public.profiles p on p.id = d.id
--     order by d.credit_da asc;
--
--  LE CARNET D'UN LIVREUR
--    select created_at, kind, amount, balance_after, note
--      from public.driver_wallet where driver_id = '<id>' order by created_at desc;
-- ==========================================================================

select 'crédit livreur installé' as resultat,
       (select count(*) from public.drivers) as livreurs;


-- ####################################################################
-- ###  14_role_livreur.sql
-- ####################################################################

-- ==========================================================================
--  14 — UN COMPTE PASSÉ EN « LIVREUR » DOIT AVOIR SA FICHE LIVREUR
--  --------------------------------------------------------------------------
--  Le bug : la fiche livreur (table drivers) n'était créée qu'à l'inscription,
--  par le trigger sur auth.users. Un administrateur qui transformait un client
--  en livreur ne changeait donc que son rôle. Résultat : la personne avait
--  bien le rôle, mais aucune fiche — invisible dans « Livreurs », rien à
--  valider, et son espace livreur ne savait pas quoi afficher.
--
--  La correction vit ici plutôt que dans l'écran d'administration, parce que
--  le rôle se change aussi en SQL (admin.sql). Une règle posée dans un seul
--  des deux chemins est une règle qu'on croit avoir posée.
--
--  Sans risque et rejouable.
-- ==========================================================================

create or replace function public.ensure_driver_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'driver' then
    -- validation_status reste 'pending' : devenir livreur ne vaut pas
    -- validation, c'est justement ce qu'un administrateur doit décider
    insert into public.drivers (id) values (new.id) on conflict (id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_ensure_driver_row on public.profiles;
create trigger trg_ensure_driver_row
  after insert or update of role on public.profiles
  for each row execute function public.ensure_driver_row();

-- ---- Rattrapage : les comptes déjà convertis avant ce correctif ------------
insert into public.drivers (id)
select p.id
  from public.profiles p
  left join public.drivers d on d.id = p.id
 where p.role = 'driver' and d.id is null;

-- ---- Vérification ----------------------------------------------------------
-- Doit renvoyer 0 : plus aucun livreur sans fiche.
select count(*) as livreurs_sans_fiche
  from public.profiles p
  left join public.drivers d on d.id = p.id
 where p.role = 'driver' and d.id is null;
