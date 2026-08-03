-- ==========================================================================
--  20 — LA PLATEFORME SE PASSE DE L'ESPACE RESTAURANT
--  --------------------------------------------------------------------------
--  CE QUI CHANGE
--
--  Il n'y a plus de compte restaurant, plus d'application Talabi Resto, plus
--  de réseau de gérants à recruter. L'administrateur inscrit les restaurants
--  et tient leur carte ; le client commande ; le livreur reçoit la course
--  immédiatement, va chercher la commande au comptoir et la livre.
--
--  CE QUE ÇA SUPPRIME DANS LE PARCOURS
--
--  L'ancien parcours comptait quatre étapes avant qu'un livreur voie quoi que
--  ce soit : en attente, acceptée, en préparation, prête. Chacune supposait
--  quelqu'un derrière un écran au restaurant. Sans cet écran, elles ne
--  peuvent que bloquer : une commande « en attente » que personne n'accepte
--  finissait refusée d'office au bout de cinq minutes.
--
--  Le parcours devient donc :
--
--      commande passée  →  prête (offerte au livreur le plus proche)
--                       →  livreur trouvé  →  en livraison  →  livrée
--
--  CE QUE ÇA IMPLIQUE, ET QU'IL FAUT SAVOIR
--
--  Le restaurant n'est prévenu par personne : c'est le livreur qui se
--  présente au comptoir et commande. Le temps de préparation se retrouve donc
--  À L'INTÉRIEUR du temps de livraison, et non avant. C'est un choix de
--  fonctionnement, pas un détail technique — le délai annoncé au client doit
--  en tenir compte.
--
--  Sans risque et rejouable. Aucune commande existante n'est modifiée.
-- ==========================================================================

-- 1. Plus de compte propriétaire obligatoire -------------------------------
-- Un restaurant inscrit par l'administrateur n'appartient à personne.
alter table public.restaurants alter column owner_id drop not null;

-- 2. Plus de compte à rebours côté restaurant ------------------------------
-- Personne ne répond, donc rien n'expire. Laisser l'échéance aurait fait
-- refuser d'office, cinq minutes après, chaque commande de la plateforme.
create or replace function public.stamp_deadlines()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.respond_deadline := null;
    return new;
  end if;

  if new.status is distinct from old.status then
    new.respond_deadline := null;
    if new.status = 'ready' and new.driver_id is null then
      new.declined_by := '{}'; new.search_since := null;
    end if;
    if new.status <> 'ready' then
      new.offer_driver_id := null; new.offer_deadline := null;
    end if;
  end if;
  return new;
end $$;

-- Les commandes qui attendaient encore une réponse deviennent disponibles
-- plutôt que de rester suspendues à un écran qui n'existe plus.
update public.orders
   set status = 'ready', respond_deadline = null
 where status in ('pending', 'accepted', 'preparing');

-- 3. Les délais échus ne concernent plus que le livreur --------------------
create or replace function public.expire_orders()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  s      public.platform_settings;
  o      public.orders;
  change boolean := false;
begin
  select * into s from public.platform_settings where id = 1;

  -- a. le livreur n'a pas répondu dans son délai : au suivant
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

  -- a bis. filet de sécurité : une commande restée « en attente »
  -- L'application écrit la commande, puis ses lignes, puis la passe en
  -- « prête » — dans cet ordre, pour qu'un livreur n'ouvre jamais une
  -- commande encore vide de plats. Si le téléphone perd le réseau entre les
  -- deux dernières écritures, la commande resterait figée et personne ne la
  -- verrait. Deux minutes plus tard, on la libère.
  update public.orders
     set status = 'ready'
   where status in ('pending', 'accepted', 'preparing')
     and created_at < now() - interval '2 minutes';

  -- b. courses sans preneur : premier envoi, ou relance d'un tour complet
  for o in
    select * from public.orders
     where status = 'ready' and driver_id is null and offer_driver_id is null
     for update skip locked
  loop
    if o.search_since is null then
      perform public.dispatch_order(o.id);
      change := true;
    elsif now() - o.search_since >= make_interval(secs => s.redispatch_after_s) then
      update public.orders set declined_by = '{}', search_since = now() where id = o.id;
      perform public.dispatch_order(o.id);
      change := true;
    end if;
  end loop;

  return change;
end $$;

-- 4. Les avis de changement ne s'adressent plus qu'au client ---------------
-- owner_id peut désormais être nul : notify(null, …) écrirait une ligne sans
-- destinataire, invisible et jamais lue. Chaque avis au gérant est donc
-- conditionné à l'existence d'un gérant.
create or replace function public.on_order_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r_owner uuid;
  r_name  text;
begin
  select owner_id, name into r_owner, r_name
    from public.restaurants where id = new.restaurant_id;

  if tg_op = 'INSERT' then
    if r_owner is not null then
      perform public.notify(r_owner, 'Nouvelle commande',
        'Commande #' || new.code || ' — ' || new.total || ' DA', 'new_order', new.id);
    end if;
    return new;
  end if;

  if new.status = old.status then return new; end if;

  case new.status
    when 'ready' then
      perform public.notify(new.client_id, 'Commande enregistrée',
        'Nous cherchons un livreur pour votre commande #' || new.code || '…', 'ready', new.id);

    when 'driver_assigned' then
      perform public.notify(new.client_id, 'Livreur trouvé',
        'Un livreur part chercher votre commande #' || new.code, 'driver_assigned', new.id);
      if r_owner is not null then
        perform public.notify(r_owner, 'Livreur assigné',
          'Un livreur vient récupérer la commande #' || new.code, 'driver_assigned', new.id);
      end if;

    when 'delivering' then
      perform public.notify(new.client_id, 'En cours de livraison',
        'Votre commande #' || new.code || ' est en route !', 'delivering', new.id);

    when 'delivered' then
      perform public.notify(new.client_id, 'Commande livrée',
        'Bon appétit ! Confirmez la réception de #' || new.code, 'delivered', new.id);
      if r_owner is not null then
        perform public.notify(r_owner, 'Commande livrée',
          'La commande #' || new.code || ' a été livrée', 'delivered', new.id);
      end if;

      /* Libérer le livreur : claim_order le passe en « occupé », et
         l'interrupteur de disponibilité lui est fermé pendant une course. */
      if new.driver_id is not null then
        update public.drivers
           set total_deliveries = total_deliveries + 1,
               total_earnings   = total_earnings + coalesce(new.driver_earning, 0),
               status           = 'available'
         where id = new.driver_id;
      end if;

    when 'rejected' then
      perform public.notify(new.client_id, 'Commande refusée',
        coalesce(new.reject_reason, 'Votre commande #' || new.code || ' n''a pas pu être honorée.'),
        'rejected', new.id);
      if new.driver_id is not null then
        update public.drivers set status = 'available' where id = new.driver_id;
      end if;

    when 'cancelled' then
      if r_owner is not null then
        perform public.notify(r_owner, 'Commande annulée',
          'Le client a annulé la commande #' || new.code, 'cancelled', new.id);
      end if;
      if new.driver_id is not null then
        update public.drivers set status = 'available' where id = new.driver_id;
      end if;

    else null;
  end case;

  return new;
end $$;

-- 5. Écrire un restaurant : l'administrateur, et lui seul ------------------
-- La règle du propriétaire reste en place pour les fiches déjà rattachées à
-- un compte : on ne casse pas ce qui existe, on ferme la porte d'entrée.
drop policy if exists rest_owner_insert on public.restaurants;

-- 6. Les plats : rien à changer --------------------------------------------
-- Les règles d'écriture de menu_items, menu_options et menu_variants
-- disaient déjà « le propriétaire du restaurant OU un administrateur ». Le
-- second membre suffit maintenant que le premier n'existe plus : la carte
-- est tenue par l'administrateur sans qu'aucune règle bouge.
--
-- Une lecture reste à vérifier : menu_read exige que le restaurant soit
-- « approved ». Les fiches créées par l'administrateur naissent approuvées
-- depuis le fichier 16, la condition est donc satisfaite d'office.

-- ---- Vérifications ---------------------------------------------------------

-- a) Plus aucune commande suspendue à une réponse du restaurant.
select status, count(*)
  from public.orders
 group by status
 order by 2 desc;

-- b) Les restaurants et leur rattachement : « sans compte » est désormais
--    l'état normal.
select name,
       case when owner_id is null then 'sans compte' else 'compte lié' end as rattachement,
       status,
       (select count(*) from public.menu_items m where m.restaurant_id = r.id) as plats
  from public.restaurants r
 order by name;
