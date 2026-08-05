-- ==========================================================================
--  23 — UNE SEULE COURSE PROPOSÉE À LA FOIS, ET LA FILE AVANCE TOUTE SEULE
--  --------------------------------------------------------------------------
--  CE QUI N'ALLAIT PAS
--
--  Le classement par proximité fonctionne (fichier 19) : la course part au
--  livreur validé, en ligne, libre, solvable et le plus proche du restaurant.
--  Mais ce classement était calculé commande par commande, sans que les
--  commandes se voient entre elles. Le scénario de tous les jours :
--
--    10 livreurs en ligne. Deux clients commandent dans la même minute, dans
--    deux restaurants voisins. Karim est le plus proche des DEUX. Il reçoit
--    les deux propositions en même temps.
--
--  Trois dégâts, dans l'ordre de gravité :
--
--   • Karim en accepte une. L'autre course reste bloquée sur son nom jusqu'à
--     l'expiration des 30 secondes, alors qu'il roule déjà. Le deuxième
--     client attend une demi-minute pour rien.
--   • Karim voit deux cartes et doit choisir. Ce n'est pas son métier de
--     répartir les courses, et pendant qu'il hésite les deux clients patientent.
--   • Deux dispatch_order lancés à la même milliseconde lisaient la table au
--     même instant : même si on avait filtré, ils auraient élu le même homme.
--     Il fallait un verrou, pas seulement un filtre.
--
--  Et un quatrième, plus discret : la règle de lecture laissait le livreur
--  voir les courses libres pendant qu'on lui en proposait une. L'exclusivité
--  aurait été contournée par la liste, sans même une notification.
--
--  CE QUE FAIT CE FICHIER
--
--   1. offre_en_cours(livreur) : la course actuellement promise à quelqu'un,
--      s'il y en a une. Une seule définition, utilisée par les quatre endroits
--      qui posaient la question chacun à leur façon.
--   2. dispatch_order prend un verrou : deux commandes ne peuvent plus élire
--      le même livreur en même temps. Elles se répartissent, l'une après
--      l'autre, chacune sur SON plus proche.
--   3. Un livreur qui a déjà une proposition n'est plus candidat, n'est plus
--      notifié, et ne voit plus les courses libres. Il répond, puis il reçoit
--      la suivante.
--   4. Quand tous les proches sont momentanément occupés à répondre, la
--      course NE s'ouvre PAS à tous : elle attend son tour. L'ouverture
--      générale reste le dernier recours, pour quand il n'y a vraiment
--      personne.
--   5. La file avance sans attendre le planificateur : dès qu'un livreur
--      refuse, se libère ou passe en ligne, la plus ancienne commande en
--      attente lui est proposée immédiatement.
--   6. claim_order refuse de prendre une course quand une autre vous est
--      proposée : on répond d'abord.
--
--  Sans risque et rejouable. Aucune colonne ajoutée, aucun texte modifié.
-- ==========================================================================

-- 1. La question posée une seule fois ---------------------------------------
-- « Une course est-elle en ce moment promise à ce livreur ? » Quatre endroits
-- se la posaient ; trois d'entre eux auraient fini par diverger.
--
-- Une proposition dont le délai est passé ne compte plus, même si le
-- planificateur n'est pas encore repassé la nettoyer : sinon un livreur qui a
-- laissé filer les 30 secondes resterait invisible jusqu'au prochain tour.
create or replace function public.offre_en_cours(p_driver uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select o.id from public.orders o
   where o.offer_driver_id = p_driver
     and o.status = 'ready'
     and o.driver_id is null
     and o.offer_deadline > now()
   limit 1;
$$;

-- Le filtre ci-dessus est joué à chaque dispatch, pour chaque candidat.
create index if not exists idx_orders_offre_en_cours
  on public.orders (offer_driver_id)
  where status = 'ready' and driver_id is null;

-- 2. Choisir le livreur suivant ---------------------------------------------
-- Reprise complète de la fonction du fichier 19 : PostgreSQL remplace une
-- fonction en entier. Trois changements, signalés en commentaire.
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
  attend   boolean;
begin
  /* NOUVEAU — le verrou.
     Deux commandes prêtes à la même seconde exécutaient ce corps en
     parallèle : elles lisaient la table AVANT que l'autre n'ait écrit son
     offer_driver_id, et élisaient donc le même livreur. Aucun filtre ne
     pouvait rattraper ça, parce que le filtre lisait lui aussi trop tôt.
     Le verrou sérialise les élections : la seconde commande ne commence
     qu'une fois la première inscrite. Il est relâché à la fin de la
     transaction, quoi qu'il arrive — y compris en cas d'erreur. */
  perform pg_advisory_xact_lock(hashtext('talabi:dispatch'));

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
         /* NOUVEAU — personne à qui on propose déjà une course.
            C'est toute la règle : on ne demande pas à un homme de choisir
            entre deux clients. Il répond à celle qu'il a, et la suivante lui
            arrive après. */
         and public.offre_en_cours(dr.id) is null
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
    /* NOUVEAU — distinguer « il n'y a personne » de « ils répondent ».
       Sans cette question, la deuxième commande d'une rafale s'ouvrait
       aussitôt à tout le monde : on aurait remplacé le doublon par une
       cohue, et le classement par proximité n'aurait plus servi à rien
       exactement quand il sert le plus. Si des livreurs sont simplement en
       train de répondre, la commande attend son tour — quelques secondes —
       et repart au plus proche dès que l'un d'eux se libère (section 4). */
    select exists (
      select 1
        from public.drivers dr
        join public.profiles pr on pr.id = dr.id
       where dr.validation_status = 'approved'
         and dr.status = 'available'
         and pr.is_blocked = false
         and coalesce(dr.credit_da, 0) >= frais
         and not (dr.id = any(o.declined_by))
         and (dr.zone_id is null or o.zone_id is null or dr.zone_id = o.zone_id)
         and not exists (
           select 1 from public.orders x
            where x.driver_id = dr.id
              and x.status in ('driver_assigned', 'delivering'))
         and public.offre_en_cours(dr.id) is not null
    ) into attend;

    -- Plus aucun candidat : la course s'ouvre à tous. C'est le seul moment où
    -- une alerte générale a un sens, puisque c'est le seul où tout le monde la
    -- voit réellement dans sa liste.
    ouverte := (o.offer_driver_id is not null or o.search_since is null) and not attend;

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
           -- NOUVEAU : ne pas sonner chez quelqu'un qui a déjà une course à
           -- l'écran. Il ne peut pas la voir, l'avertir serait un mensonge.
           and public.offre_en_cours(dr.id) is null
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

-- 3. Servir la file d'attente ------------------------------------------------
-- Quand un livreur se libère, il ne suffit pas de relancer la course qu'il
-- vient de rendre : d'autres commandes attendaient peut-être uniquement parce
-- que lui — et tous les autres — étaient occupés à répondre. On les repasse
-- toutes, de la plus ancienne à la plus récente.
--
-- Le passage est bon marché : seules les commandes réellement en attente sont
-- lues, et dispatch_order sort en deux lignes s'il ne trouve personne.
create or replace function public.dispatch_waiting_orders()
returns int language plpgsql security definer set search_path = public as $$
declare o record; n int := 0;
begin
  for o in
    select id from public.orders
     where status = 'ready' and driver_id is null and offer_driver_id is null
     -- le client qui attend depuis le plus longtemps passe devant
     order by created_at
  loop
    if public.dispatch_order(o.id) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- 4. Passer son tour fait avancer toute la file ------------------------------
-- Avant, le refus ne relançait que la course refusée. La commande d'à côté,
-- qui n'attendait que ce livreur-là, restait en plan jusqu'au prochain
-- passage du planificateur — soit jusqu'à une minute pour rien.
create or replace function public.decline_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- pris avant d'écrire, comme partout ailleurs (voir expire_orders)
  perform pg_advisory_xact_lock(hashtext('talabi:dispatch'));

  update public.orders
     set declined_by = declined_by || auth.uid(),
         offer_driver_id = null, offer_deadline = null
   where id = p_order and status = 'ready' and driver_id is null;

  -- celle qu'il vient de rendre d'abord : elle attend depuis le plus longtemps
  perform public.dispatch_order(p_order);
  -- puis les autres, à qui ce livreur manquait peut-être
  perform public.dispatch_waiting_orders();
end $$;

-- 5. Le changement d'état d'un livreur bouge la file -------------------------
-- Remplace release_offer_when_offline (fichier 19), qui ne traitait qu'un
-- sens : partir. L'autre sens compte autant — quelqu'un qui arrive doit
-- recevoir tout de suite la commande qui poireaute, pas à la minute suivante.
--
-- Les deux moments où un livreur redevient « available » sont couverts par ce
-- seul déclencheur : il passe en ligne le matin, et il termine une livraison
-- (on_order_change remet son statut à « available », ce qui nous ramène ici).
create or replace function public.driver_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare o_id uuid;
begin
  if old.status is not distinct from new.status then return new; end if;

  -- pris avant d'écrire, comme partout ailleurs (voir expire_orders)
  perform pg_advisory_xact_lock(hashtext('talabi:dispatch'));

  if new.status <> 'available' then
    -- Il ne peut plus honorer ce qu'on lui proposait : on le rend tout de
    -- suite au lieu de laisser le client attendre la fin du chronomètre.
    for o_id in
      select id from public.orders
       where offer_driver_id = new.id and status = 'ready' and driver_id is null
    loop
      update public.orders
         set offer_driver_id = null, offer_deadline = null
       where id = o_id;
      perform public.dispatch_order(o_id);
    end loop;
  else
    perform public.dispatch_waiting_orders();
  end if;

  return new;
end $$;

drop trigger if exists trg_release_offer_when_offline on public.drivers;
drop trigger if exists trg_driver_status_change on public.drivers;
create trigger trg_driver_status_change
  after update of status on public.drivers
  for each row execute function public.driver_status_change();

-- 5 bis. Le chronomètre qui expire libère aussi la file ----------------------
-- Reprise complète de expire_orders (fichier 21) : PostgreSQL remplace une
-- fonction en entier, il n'existe pas de moyen d'y ajouter une ligne. Tout est
-- identique au fichier 21, sauf la ligne signalée après la boucle (a).
--
-- Pourquoi elle manquait : quand les 30 secondes d'un livreur s'écoulent, il
-- redevient libre — mais sans changer de statut, donc sans réveiller le
-- déclencheur de la section 5. La commande d'à côté serait restée en attente
-- jusqu'au tour suivant du planificateur.
create or replace function public.expire_orders()
returns boolean language plpgsql security definer set search_path = public as $$
declare
  s      public.platform_settings;
  o      public.orders;
  a      record;
  change boolean := false;
begin
  /* Le même verrou que dispatch_order, pris AVANT le premier verrou de ligne.
     L'ordre compte : une fonction qui verrouille des commandes puis réclame
     le verrou de répartition, pendant qu'une autre fait l'inverse, se
     bloquent mutuellement. En le prenant toujours en premier, il n'y a plus
     qu'un seul ordre possible, donc plus d'interblocage. Il est réentrant :
     dispatch_order le reprendra sans attendre. */
  perform pg_advisory_xact_lock(hashtext('talabi:dispatch'));

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

  /* NOUVEAU — les livreurs dont l'offre vient d'expirer sont redevenus
     candidats. Les commandes qui n'attendaient qu'eux repartent maintenant,
     et non à la minute suivante. */
  if change then perform public.dispatch_waiting_orders(); end if;

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

-- 6. Une course proposée cache les courses libres ----------------------------
-- Reprise de la règle de lecture (fichiers 09 puis 10), avec une condition en
-- plus. Sans elle, l'exclusivité tenait à la notification : le livreur ne
-- recevait qu'une alerte, mais sa liste continuait d'en afficher trois.
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
             or (offer_driver_id is null
                 and not (auth.uid() = any(declined_by))
                 -- une seule course à l'écran : celle qu'on lui propose
                 and public.offre_en_cours(auth.uid()) is null)))
  );

-- 7. Accepter : une à la fois, là aussi --------------------------------------
-- Reprise de la fonction du fichier 19, avec un contrôle de plus. La règle de
-- lecture suffit en usage normal ; celui-ci tient face à un écran resté ouvert
-- sur une liste d'il y a deux minutes, où la course était encore libre.
create or replace function public.claim_order(p_order uuid)
returns public.orders language plpgsql security definer set search_path = public as $$
declare
  o     public.orders;
  dr    public.drivers;
  frais int;
  autre uuid;
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

  /* NOUVEAU — on répond d'abord à ce qu'on nous propose.
     Le cas visé : sa liste, chargée il y a deux minutes, montre encore une
     course libre ; entre-temps le serveur lui en a promis une autre. S'il
     prend l'ancienne, la promise reste bloquée sur son nom jusqu'à
     expiration, et le client d'en face attend pour rien. */
  autre := public.offre_en_cours(auth.uid());
  if autre is not null and autre <> p_order then
    raise exception 'Une course vous est déjà proposée. Acceptez-la ou passez votre tour avant d''en prendre une autre.'
      using errcode = 'check_violation';
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

grant execute on function public.offre_en_cours(uuid) to authenticated;

-- ---- Vérifications ---------------------------------------------------------

-- a) Qui a une course à l'écran en ce moment, et laquelle.
--    Un livreur ne doit jamais apparaître deux fois dans ce tableau.
select p.full_name,
       o.code,
       round(extract(epoch from (o.offer_deadline - now()))) as secondes_restantes
  from public.orders o
  join public.profiles p on p.id = o.offer_driver_id
 where o.status = 'ready' and o.driver_id is null
   and o.offer_deadline > now()
 order by o.offer_deadline;

-- b) Les livreurs en ligne, et ce qu'ils font. « libre = true » signifie
--    qu'ils recevront la prochaine commande de leur zone, du plus proche au
--    plus loin du restaurant concerné.
select p.full_name,
       d.status,
       d.credit_da,
       (public.offre_en_cours(d.id) is null
        and d.status = 'available')            as libre,
       d.last_position_at
  from public.drivers d
  join public.profiles p on p.id = d.id
 where d.validation_status = 'approved'
 order by libre desc, d.last_position_at desc nulls last;

-- c) Les commandes qui attendent, et pourquoi. Une commande sans livreur
--    proposé alors que des livreurs sont libres signale un vrai problème
--    (zone, crédit, ou tous déjà refusée par eux).
select o.code,
       coalesce(p.full_name, '— en attente d''un livreur libre') as proposee_a,
       round(extract(epoch from (now() - coalesce(o.search_since, o.created_at)))) as attend_depuis_s,
       array_length(o.declined_by, 1)                            as refus
  from public.orders o
  left join public.profiles p on p.id = o.offer_driver_id
 where o.status = 'ready' and o.driver_id is null
 order by o.created_at;
