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
