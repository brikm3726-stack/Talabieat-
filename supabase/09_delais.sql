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
