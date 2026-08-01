-- ==========================================================================
--  18 — LE LIVREUR NOTIFIÉ EST CELUI QUI PEUT ACCEPTER
--  --------------------------------------------------------------------------
--  LE BUG
--  Une commande prête déclenchait deux notifications de nature différente :
--
--    • 02_security  prévenait TOUS les livreurs disponibles de la zone ;
--    • 09_delais    proposait la course à UN SEUL d'entre eux, pendant 30 s,
--                   et la sécurité par ligne la cachait à tous les autres.
--
--  Résultat : dix livreurs recevaient « Nouvelle livraison disponible », neuf
--  ouvraient l'application et ne trouvaient rien. Une notification qui ne mène
--  à rien est pire que pas de notification : elle apprend à les ignorer toutes.
--
--  LA CORRECTION
--  On ne prévient que celui qui peut agir :
--
--    • à la mise en attente, plus d'appel à la cantonade ;
--    • le livreur choisi reçoit « Course à prendre — 30 s » (déjà en place) ;
--    • quand plus personne n'est candidat et que la course s'ouvre à tous,
--      alors seulement on alerte l'ensemble des livreurs de la zone — à ce
--      moment-là, ils la voient réellement dans leur liste.
--
--  Sans risque et rejouable.
-- ==========================================================================

-- 1. La commande prête ne réveille plus toute la ville ------------------------
create or replace function public.on_order_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r_owner uuid;
  r_name  text;
begin
  select owner_id, name into r_owner, r_name
    from public.restaurants where id = new.restaurant_id;

  if tg_op = 'INSERT' then
    perform public.notify(r_owner, 'Nouvelle commande',
      'Commande #' || new.code || ' — ' || new.total || ' DA', 'new_order', new.id);
    return new;
  end if;

  if new.status = old.status then return new; end if;

  case new.status
    when 'accepted' then
      perform public.notify(new.client_id, 'Commande acceptée',
        r_name || ' prépare votre commande #' || new.code, 'accepted', new.id);
    when 'preparing' then
      perform public.notify(new.client_id, 'En préparation',
        'Votre commande #' || new.code || ' est en cuisine', 'preparing', new.id);

    when 'ready' then
      /* On prévient le client, et lui seul. La course, elle, est proposée
         livreur par livreur par dispatch_order : c'est lui qui notifie celui
         dont c'est le tour, parce que c'est le seul à pouvoir l'accepter. */
      perform public.notify(new.client_id, 'Commande prête',
        'Votre commande #' || new.code || ' est prête, recherche d''un livreur…', 'ready', new.id);

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
        'Bon appétit ! Confirmez la réception de #' || new.code, 'delivered', new.id);
      perform public.notify(r_owner, 'Commande livrée',
        'La commande #' || new.code || ' a été livrée', 'delivered', new.id);
    when 'rejected' then
      perform public.notify(new.client_id, 'Commande refusée',
        coalesce(new.reject_reason, 'Le restaurant n''a pas pu accepter votre commande #' || new.code),
        'rejected', new.id);
    when 'cancelled' then
      perform public.notify(r_owner, 'Commande annulée',
        'Le client a annulé la commande #' || new.code, 'cancelled', new.id);
    else null;
  end case;

  return new;
end $$;

-- 2. Quand la course s'ouvre à tous, alors on alerte tout le monde ------------
create or replace function public.dispatch_order(p_order uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o        public.orders;
  r        public.restaurants;
  suivant  uuid;
  d        record;
  delai    int;
  ouverte  boolean;
begin
  select * into o from public.orders where id = p_order;
  if o.id is null or o.status <> 'ready' or o.driver_id is not null then
    return null;
  end if;
  select * into r from public.restaurants where id = o.restaurant_id;
  select driver_timeout_s into delai from public.platform_settings where id = 1;

  select d2.id into suivant
    from public.drivers d2
   where d2.validation_status = 'approved'
     and d2.status = 'available'
     and not (d2.id = any(o.declined_by))
     and (d2.zone_id is null or o.zone_id is null or d2.zone_id = o.zone_id)
   order by
     case
       when d2.last_lat is null or r.lat is null then 9999
       -- distance à vol d'oiseau, suffisante pour classer des candidats
       else 111.045 * sqrt(power(d2.last_lat - r.lat, 2) +
                           power((d2.last_lng - r.lng) * cos(radians(r.lat)), 2))
     end
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
      for d in select dr.id from public.drivers dr
               where dr.validation_status = 'approved'
                 and dr.status = 'available'
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

-- ---- Vérification -----------------------------------------------------------
-- Les courses prêtes et non attribuées, avec le livreur à qui elles sont
-- proposées en ce moment (null = ouverte à tous).
select o.code, o.status, o.offer_driver_id, o.offer_deadline, o.search_since
  from public.orders o
 where o.status = 'ready' and o.driver_id is null
 order by o.created_at desc
 limit 10;
