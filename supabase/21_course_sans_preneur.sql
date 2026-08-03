-- ==========================================================================
--  21 — QUAND ÇA NE SE PASSE PAS COMME PRÉVU
--  --------------------------------------------------------------------------
--  Trois situations que le nouveau parcours rend possibles, et qu'aucune
--  règle ne couvrait encore. Elles ne sont pas rares : ce sont les trois
--  premières que la plateforme rencontrera pour de vrai.
--
--  1. PERSONNE NE PREND LA COURSE
--     Aucun livreur en ligne à 23 h. La commande relance un tour toutes les
--     minutes, indéfiniment. Le client voit « Recherche d'un livreur » sans
--     savoir si ça aboutira, et personne n'est prévenu. Au bout d'un délai
--     réglable, le client et les administrateurs sont avertis — une fois,
--     pas à chaque tour.
--
--  2. LE RESTAURANT EST FERMÉ, OU LE PLAT N'EXISTE PLUS
--     Le livreur le découvre au comptoir, après avoir accepté et payé sa
--     commission. Il lui faut un moyen de rendre la course en disant
--     pourquoi, sans y perdre d'argent. Le remboursement existe déjà : il se
--     déclenche sur toute annulation, il suffit d'ouvrir la porte.
--
--  3. LE CLIENT N'ÉTAIT PAS PRÉVENU D'UNE ANNULATION
--     L'avis d'annulation ne partait qu'au gérant. Il n'y a plus de gérant.
--
--  Sans risque et rejouable.
-- ==========================================================================

-- 1. Le délai avant alerte, réglable ---------------------------------------
alter table public.platform_settings
  add column if not exists no_driver_alert_s int not null default 600;

-- Marque de l'avertissement : sans elle, chaque passage du planificateur
-- renverrait la même alerte, toutes les dix secondes.
alter table public.orders
  add column if not exists no_driver_alert_at timestamptz;

-- 2. Avertir quand la recherche traîne -------------------------------------
-- Reprise complète de expire_orders : PostgreSQL remplace une fonction en
-- entier, il n'existe pas de moyen d'y ajouter une branche. Les trois
-- premières sections sont donc identiques au fichier 20, la quatrième est
-- nouvelle.
create or replace function public.expire_orders()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  s      public.platform_settings;
  o      public.orders;
  a      record;
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
  -- « prête ». Si le téléphone perd le réseau entre les deux dernières
  -- écritures, la commande resterait figée. Deux minutes plus tard, on la
  -- libère.
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

  -- c. la recherche traîne : on le dit, une seule fois
  for o in
    select * from public.orders
     where status = 'ready' and driver_id is null
       and no_driver_alert_at is null
       and coalesce(search_since, created_at) < now() - make_interval(secs => s.no_driver_alert_s)
     for update skip locked
  loop
    update public.orders set no_driver_alert_at = now() where id = o.id;

    perform public.notify(o.client_id, 'Aucun livreur pour le moment',
      'Votre commande #' || o.code || ' cherche toujours un livreur. Elle reste ' ||
      'en recherche, et vous pouvez l''annuler si vous préférez ne pas attendre.',
      'ready', o.id);

    /* Les administrateurs, eux, peuvent agir : appeler un livreur, en mettre
       un en ligne, ou annuler. Une commande qui traîne sans que personne à
       la plateforme le sache est le pire des cas. */
    for a in select id from public.profiles where role = 'admin' loop
      perform public.notify(a.id, 'Commande sans livreur',
        'La commande #' || o.code || ' cherche un livreur depuis plus de ' ||
        round(s.no_driver_alert_s / 60.0) || ' minutes.', 'ready', o.id);
    end loop;

    change := true;
  end loop;

  return change;
end $$;

-- 3. Le livreur rend une course qu'il ne peut pas honorer -------------------
-- Restaurant fermé, plat épuisé, adresse introuvable : il annule en disant
-- pourquoi. Le remboursement de la commission part tout seul — le
-- déclencheur refund_commission écoute déjà les passages en « annulée ».
create or replace function public.driver_abandon(p_order uuid, p_motif text)
returns public.orders language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  if coalesce(btrim(p_motif), '') = '' then
    raise exception 'Indiquez la raison : le client et la plateforme doivent savoir ce qui s''est passé.';
  end if;

  update public.orders
     set status = 'cancelled',
         cancel_reason = 'Annulée par le livreur — ' || btrim(p_motif)
   where id = p_order
     and driver_id = auth.uid()
     and status in ('driver_assigned', 'delivering')
  returning * into o;

  if o.id is null then
    raise exception 'Cette course ne vous est pas attribuée, ou elle est déjà terminée.';
  end if;

  return o;
end $$;
grant execute on function public.driver_abandon(uuid, text) to authenticated;

-- 4. Une annulation se dit d'abord au client -------------------------------
-- L'avis ne partait qu'au gérant, qui n'existe plus. Le client, lui, attend
-- un repas : c'est à lui qu'il faut le dire en premier.
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
      /* Le client d'abord : c'est lui qui attend un repas. Le message reprend
         la raison telle qu'elle a été saisie — « annulée » tout court laisse
         imaginer le pire. */
      perform public.notify(new.client_id, 'Commande annulée',
        coalesce(new.cancel_reason, 'Votre commande #' || new.code || ' a été annulée.'),
        'cancelled', new.id);
      if r_owner is not null then
        perform public.notify(r_owner, 'Commande annulée',
          'La commande #' || new.code || ' a été annulée', 'cancelled', new.id);
      end if;
      if new.driver_id is not null then
        update public.drivers set status = 'available' where id = new.driver_id;
      end if;

    else null;
  end case;

  return new;
end $$;

-- ---- Vérifications ---------------------------------------------------------

-- a) Le nouveau réglage est en place.
select no_driver_alert_s as alerte_apres_secondes,
       driver_timeout_s  as reponse_livreur_s,
       redispatch_after_s as relance_apres_s
  from public.platform_settings where id = 1;

-- b) Les commandes qui cherchent un livreur en ce moment, et depuis quand.
select code,
       round(extract(epoch from (now() - coalesce(search_since, created_at))) / 60) as minutes,
       case when no_driver_alert_at is null then 'pas encore alerte' else 'alerte envoyee' end as alerte
  from public.orders
 where status = 'ready' and driver_id is null
 order by created_at;
