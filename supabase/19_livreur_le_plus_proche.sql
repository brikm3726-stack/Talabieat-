-- ==========================================================================
--  19 — LA COURSE VA AU LIVREUR LE PLUS PROCHE, ET JAMAIS À UN INDISPONIBLE
--  --------------------------------------------------------------------------
--  CE QUI N'ALLAIT PAS
--
--  Le tri par distance existait déjà dans dispatch_order. Il ne servait à
--  rien, pour une raison simple : la position d'un livreur n'était envoyée
--  QUE pendant une course (js/lib/livetrack.js ne démarrait que sur les
--  statuts « livreur trouvé » et « en livraison »). Un livreur disponible et
--  à l'arrêt avait donc soit aucune position, soit celle de la fin de sa
--  dernière livraison, parfois vieille de plusieurs jours. On classait des
--  livreurs d'après l'endroit où ils se trouvaient hier.
--
--  Trois autres trous, plus discrets :
--
--   • la règle de lecture de « orders » laissait TOUT livreur validé de la
--     zone voir les courses libres, même hors ligne. Il pouvait les prendre.
--   • claim_order ne vérifiait jamais que le livreur était disponible ;
--   • on proposait la course à des livreurs dont le crédit ne suffisait pas
--     à payer la commission — leur clic finissait toujours en erreur.
--
--  CE QUE FAIT CE FICHIER
--
--   1. Deux réglages : rayon de proximité, et âge maximal d'une position pour
--      qu'elle compte encore comme « où il est maintenant ».
--   2. dispatch_order classe les candidats en trois rangs — proche et à jour,
--      puis loin ou périmé, puis jamais localisé — et à rang égal, du plus
--      près au plus loin du restaurant. Le premier reçoit la course.
--   3. Ne sont candidats que les livreurs validés, en ligne, libres, non
--      bloqués, et dont le crédit couvre la commission.
--   4. claim_order refuse un livreur hors ligne.
--   5. Un livreur qui se met hors ligne rend la course qu'on lui proposait.
--   6. La lecture des courses libres exige d'être en ligne.
--
--  Le partage de position pendant les temps morts se fait côté application
--  (livetrack.js, même mise en ligne) : sans lui, ce fichier classe encore
--  des positions périmées, il les reléguera simplement au bon rang.
--
--  Sans risque et rejouable.
-- ==========================================================================

-- 1. Réglages ---------------------------------------------------------------
alter table public.platform_settings
  -- au-delà, on considère le livreur « loin » : il passe après les proches,
  -- il n'est pas exclu (mieux vaut un livreur loin que pas de livreur)
  add column if not exists driver_radius_km   numeric(5,2) not null default 7,
  -- une position plus vieille que ça ne dit plus où il est
  add column if not exists position_max_age_s int not null default 600;

-- 2. Distance à vol d'oiseau, en kilomètres ---------------------------------
-- Extraite pour être lisible et réutilisable. Approximation plane, largement
-- suffisante à l'échelle d'une ville pour classer des candidats.
create or replace function public.km_entre(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
) returns double precision language sql immutable as $$
  select case
    when p_lat1 is null or p_lng1 is null or p_lat2 is null or p_lng2 is null then null
    else 111.045 * sqrt(
           power(p_lat1 - p_lat2, 2) +
           power((p_lng1 - p_lng2) * cos(radians(p_lat2)), 2))
  end;
$$;

-- 3. Choisir le livreur suivant ---------------------------------------------
create or replace function public.dispatch_order(p_order uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o        public.orders;
  r        public.restaurants;
  suivant  uuid;
  d        record;
  delai    int;
  rayon    numeric;
  age_max  int;
  frais    int;
  ouverte  boolean;
begin
  select * into o from public.orders where id = p_order;
  if o.id is null or o.status <> 'ready' or o.driver_id is not null then
    return null;
  end if;
  select * into r from public.restaurants where id = o.restaurant_id;

  select driver_timeout_s, driver_radius_km, position_max_age_s
    into delai, rayon, age_max
    from public.platform_settings where id = 1;

  -- ce que la course coûtera au livreur : inutile de la proposer à quelqu'un
  -- qui ne pourra pas l'accepter
  frais := public.course_commission(o.delivery_fee);

  select cand.id into suivant
    from (
      select dr.id,
             public.km_entre(dr.last_lat, dr.last_lng, r.lat, r.lng) as km,
             (dr.last_position_at is not null
              and dr.last_position_at > now() - make_interval(secs => age_max)) as recente
        from public.drivers dr
        join public.profiles pr on pr.id = dr.id
       where dr.validation_status = 'approved'
         and dr.status = 'available'          -- JAMAIS un livreur indisponible
         and pr.is_blocked = false
         and coalesce(dr.credit_da, 0) >= frais
         and not (dr.id = any(o.declined_by))
         and (dr.zone_id is null or o.zone_id is null or dr.zone_id = o.zone_id)
         -- ceinture et bretelles : personne qui roule déjà
         and not exists (
           select 1 from public.orders x
            where x.driver_id = dr.id
              and x.status in ('driver_assigned', 'delivering'))
    ) cand
   order by
     case
       when cand.km is null            then 2   -- jamais localisé
       when not cand.recente           then 2   -- position périmée : on ne sait pas où il est
       when cand.km <= rayon           then 0   -- proche, et à jour : la vraie cible
       else                                 1   -- à jour mais au-delà du rayon
     end,
     cand.km nulls last
   limit 1;

  if suivant is null then
    -- Plus aucun candidat : la course s'ouvre à tous. C'est le seul moment où
    -- une alerte générale a un sens, puisque c'est le seul où tout le monde la
    -- voit réellement dans sa liste.
    ouverte := o.offer_driver_id is not null or o.search_since is null;

    update public.orders
       set offer_driver_id = null,
           offer_deadline  = null,
           search_since    = coalesce(search_since, now())
     where id = p_order;

    if ouverte then
      for d in
        select dr.id from public.drivers dr
        join public.profiles pr on pr.id = dr.id
         where dr.validation_status = 'approved'
           and dr.status = 'available'
           and pr.is_blocked = false
           and coalesce(dr.credit_da, 0) >= frais
           and (dr.zone_id = o.zone_id or dr.zone_id is null or o.zone_id is null)
      loop
        perform public.notify(d.id, 'Course disponible',
          coalesce(r.name, 'Un restaurant') || ' — commande #' || o.code ||
          '. Premier arrivé, premier servi.', 'delivery_available', p_order);
      end loop;
    end if;
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

-- 4. Accepter une course exige d'être en ligne -------------------------------
-- Reprise de 13_credit_livreur.sql, avec le contrôle de disponibilité en tête.
-- Un livreur hors ligne qui garde un vieil écran ouvert ne doit pas pouvoir
-- prendre une course : le client attendrait quelqu'un qui a fini sa journée.
create or replace function public.claim_order(p_order uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  o     public.orders;
  dr    public.drivers;
  frais int;
begin
  select * into dr from public.drivers where id = auth.uid();

  if dr.id is null or dr.validation_status <> 'approved' then
    raise exception 'Votre compte livreur n''est pas encore validé.';
  end if;

  if dr.status <> 'available' then
    raise exception 'Vous êtes hors ligne. Passez en disponible pour accepter une course.'
      using errcode = 'check_violation';
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

  if coalesce(dr.credit_da, 0) < frais then
    raise exception 'Crédit insuffisant : cette course coûte % DA de commission et il vous reste % DA. Rechargez pour continuer.',
      frais, coalesce(dr.credit_da, 0) using errcode = 'check_violation';
  end if;

  perform public.wallet_write(auth.uid(), 'commission', -frais, o.id,
                              'Course ' || coalesce(o.code, ''));

  update public.drivers set status = 'busy' where id = auth.uid();
  return o;
end $$;

-- 5. Se mettre hors ligne rend la course qu'on lui proposait ------------------
-- Sinon la commande restait bloquée 30 secondes sur quelqu'un qui a rangé son
-- téléphone, pendant qu'un livreur devant le restaurant attendait.
create or replace function public.release_offer_when_offline()
returns trigger language plpgsql security definer set search_path = public as $$
declare o_id uuid;
begin
  if new.status = 'available' or old.status = new.status then return new; end if;

  for o_id in
    select id from public.orders
     where offer_driver_id = new.id and status = 'ready' and driver_id is null
  loop
    update public.orders
       set offer_driver_id = null, offer_deadline = null
     where id = o_id;
    perform public.dispatch_order(o_id);
  end loop;

  return new;
end $$;

drop trigger if exists trg_release_offer_when_offline on public.drivers;
create trigger trg_release_offer_when_offline
  after update of status on public.drivers
  for each row execute function public.release_offer_when_offline();

-- 6. Un livreur hors ligne ne voit plus les courses libres --------------------
-- La fonction ne sert que dans la branche « courses libres » de orders_read :
-- ajouter la disponibilité ici ne restreint rien d'autre. Le livreur continue
-- de voir ses propres courses, quel que soit son statut.
create or replace function public.is_approved_driver_in_zone(p_zone uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.drivers d
     where d.id = auth.uid()
       and d.validation_status = 'approved'
       and d.status = 'available'
       and (d.zone_id = p_zone or d.zone_id is null)
  );
$$;

-- ---- Vérifications ---------------------------------------------------------

-- a) Les deux nouveaux réglages sont en place.
select driver_radius_km as rayon_km, position_max_age_s as fraicheur_position_s
  from public.platform_settings where id = 1;

-- b) Qui est réellement candidat en ce moment, et depuis quand on le situe.
--    « recente = false » signale les livreurs en ligne dont l'application
--    n'envoie pas la position : ils passeront toujours après les autres.
select p.full_name,
       d.status,
       d.credit_da,
       d.last_position_at,
       (d.last_position_at > now() - make_interval(
          secs => (select position_max_age_s from public.platform_settings where id = 1))
       ) as position_recente
  from public.drivers d
  join public.profiles p on p.id = d.id
 where d.validation_status = 'approved'
 order by d.status, d.last_position_at desc nulls last;
