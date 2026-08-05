-- ==========================================================================
--  24 — POURQUOI AUCUNE COURSE N'ARRIVAIT AU LIVREUR
--  --------------------------------------------------------------------------
--  LE COUPABLE : LE QUARTIER
--
--  La plateforme compte onze quartiers de Tizi Ouzou (Centre-ville, Nouvelle
--  Ville, M'Douha, Redjaouna, Hasnaoua, Bekkar, Haute Ville, Boukhalfa…).
--  Ils servent à écrire une adresse, et c'est tout ce qu'ils devraient faire.
--
--  Or trois endroits exigeaient l'ÉGALITÉ des quartiers pour qu'une course
--  atteigne un livreur :
--
--    • dispatch_order      : « and dr.zone_id = o.zone_id »
--    • is_approved_driver_in_zone, qui commande la règle de lecture
--    • la liste « courses disponibles » de l'application livreur
--
--  Le quartier d'une commande est celui du CLIENT. Le quartier d'un livreur
--  est celui qu'il a coché à l'inscription. Un livreur inscrit à Centre-ville
--  ne pouvait donc recevoir QUE les clients de Centre-ville : dix commandes
--  sur onze lui étaient invisibles, sans notification, sans trace, sans le
--  moindre message d'erreur. Avec un seul livreur en service, cela veut dire
--  que presque aucune commande n'arrivait à personne — exactement ce qui a
--  été constaté.
--
--  Et c'était un filtre absurde : Tizi Ouzou fait quelques kilomètres de
--  bout en bout. Un livreur de Nouvelle Ville est à cinq minutes d'un
--  restaurant du Centre-ville. Le refuser au nom du quartier, alors qu'on
--  sait déjà calculer sa distance réelle au restaurant, c'est jeter la bonne
--  information pour garder la mauvaise.
--
--  CE QUE FAIT CE FICHIER
--
--   1. Le quartier ne bloque plus rien, nulle part. La distance au restaurant
--      classe les livreurs ; le quartier ne sert plus qu'à départager deux
--      candidats qu'on ne sait pas situer.
--   2. Un livreur loin n'est jamais écarté : s'il est le seul, la course est
--      pour lui. C'était déjà l'intention du fichier 19 — le quartier la
--      contredisait en silence.
--   3. Accepter une course relance immédiatement la file : la commande
--      suivante part au livreur libre le plus proche, sans attendre.
--   4. Le client est averti au bout de 2 minutes de recherche, et non 10.
--
--  Sans risque et rejouable. Aucune colonne ajoutée, aucun texte modifié.
-- ==========================================================================

-- 1. Choisir le livreur suivant, sans regarder le quartier -------------------
-- Reprise complète de la fonction du fichier 23 : PostgreSQL remplace une
-- fonction en entier. Les changements sont signalés en commentaire.
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
  /* Le verrou de répartition : deux commandes prêtes à la même seconde ne
     peuvent plus élire le même livreur, parce qu'elles ne s'exécutent plus
     en même temps. Relâché à la fin de la transaction, quoi qu'il arrive. */
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
              and dr.last_position_at > now() - make_interval(secs => age_max)) as recente,
             /* NOUVEAU — le quartier descend au rang de départage.
                Il ne décide plus qui est candidat ; il tranche seulement entre
                deux livreurs qu'on ne sait pas situer. */
             (dr.zone_id is not null and dr.zone_id = o.zone_id) as meme_zone
        from public.drivers dr
        join public.profiles pr on pr.id = dr.id
       where dr.validation_status = 'approved'
         and dr.status = 'available'          -- JAMAIS un livreur indisponible
         and pr.is_blocked = false
         and coalesce(dr.credit_da, 0) >= frais
         and not (dr.id = any(o.declined_by))
         /* SUPPRIMÉ — la condition de quartier.
            C'est elle qui rendait dix commandes sur onze invisibles. La
            distance au restaurant fait ce travail correctement : elle est
            calculée, pas déclarée. */
         -- ceinture et bretelles : personne qui roule déjà
         and not exists (
           select 1 from public.orders x
            where x.driver_id = dr.id
              and x.status in ('driver_assigned', 'delivering'))
         -- ni personne à qui l'on propose déjà une course : il répond d'abord
         and public.offre_en_cours(dr.id) is null
    ) cand
   order by
     case
       when cand.km is null            then 2   -- jamais localisé
       when not cand.recente           then 2   -- position périmée : on ne sait pas où il est
       when cand.km <= rayon           then 0   -- proche, et à jour : la vraie cible
       else                                 1   -- à jour mais au-delà du rayon
     end,
     cand.km nulls last,
     cand.meme_zone desc                        -- deux inconnus : le voisin d'abord
   limit 1;

  if suivant is null then
    /* Distinguer « il n'y a personne » de « ils sont en train de répondre ».
       Dans le second cas la commande attend son tour au lieu de s'ouvrir à
       tout le monde, et repart au plus proche dès qu'un livreur se libère. */
    select exists (
      select 1
        from public.drivers dr
        join public.profiles pr on pr.id = dr.id
       where dr.validation_status = 'approved'
         and dr.status = 'available'
         and pr.is_blocked = false
         and coalesce(dr.credit_da, 0) >= frais
         and not (dr.id = any(o.declined_by))
         and not exists (
           select 1 from public.orders x
            where x.driver_id = dr.id
              and x.status in ('driver_assigned', 'delivering'))
         and public.offre_en_cours(dr.id) is not null
    ) into attend;

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
           -- (plus de condition de quartier ici non plus)
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

-- 2. La lecture ne dépend plus du quartier ----------------------------------
-- Le nom de la fonction est conservé : la règle de lecture des commandes
-- l'appelle, et la renommer obligerait à réécrire la policy dans quatre
-- fichiers. Son paramètre n'est plus utilisé — la commande à laquelle il
-- appartient a déjà été retenue par la policy elle-même.
--
-- Ce que la fonction vérifie encore, et qui compte vraiment : le livreur est
-- validé, et il est en ligne. Un livreur hors ligne ne voit aucune course
-- libre, comme depuis le fichier 19.
create or replace function public.is_approved_driver_in_zone(p_zone uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.drivers d
     where d.id = auth.uid()
       and d.validation_status = 'approved'
       and d.status = 'available'
  );
$$;

-- 3. Accepter une course fait avancer la file -------------------------------
-- Reprise du fichier 23, avec une correction : la file n'était relancée que
-- lorsqu'un livreur se libérait. Quand il devenait « busy » en acceptant, on
-- rendait bien la course qu'on lui proposait, mais les autres commandes en
-- attente ne repartaient pas — alors que c'est justement l'instant où il faut
-- chercher le livreur suivant. Les deux sens relancent maintenant la file.
create or replace function public.driver_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare o_id uuid;
begin
  if old.status is not distinct from new.status then return new; end if;

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
  end if;

  /* Dans les deux cas, la file repart. Il vient de prendre une course : la
     commande suivante doit partir au livreur libre le plus proche, maintenant.
     Il vient de se libérer : la plus ancienne commande en attente est pour
     lui. Aucun de ces deux moments ne doit attendre le planificateur. */
  perform public.dispatch_waiting_orders();

  return new;
end $$;

drop trigger if exists trg_release_offer_when_offline on public.drivers;
drop trigger if exists trg_driver_status_change on public.drivers;
create trigger trg_driver_status_change
  after update of status on public.drivers
  for each row execute function public.driver_status_change();

-- 4. Deux minutes, pas dix ---------------------------------------------------
-- Le client voit un compte à rebours de 2 minutes pendant la recherche (côté
-- application) : l'avertissement du serveur doit tomber au même moment, sinon
-- le compte à rebours arrive à zéro et rien ne se passe pendant huit minutes.
-- On ne touche au réglage que s'il est resté à sa valeur d'origine : un
-- administrateur qui l'a changé exprès garde son choix.
update public.platform_settings
   set no_driver_alert_s = 120
 where id = 1 and no_driver_alert_s = 600;

-- ---- Vérifications ---------------------------------------------------------

-- a) LE TEST QUI COMPTE : qui recevrait une course en ce moment ?
--    Avant ce fichier, cette liste était vide dès que le quartier du client
--    différait de celui du livreur. Elle doit maintenant contenir tous vos
--    livreurs en ligne, quel que soit leur quartier.
select p.full_name,
       d.status,
       d.credit_da,
       z.name as quartier_declare,
       d.last_position_at,
       case
         when d.validation_status <> 'approved' then 'compte non valide'
         when d.status <> 'available'           then 'hors ligne ou en course'
         when public.offre_en_cours(d.id) is not null then 'une course a l''ecran'
         when coalesce(d.credit_da, 0) < 20     then 'CREDIT TROP FAIBLE'
         else 'PEUT RECEVOIR UNE COURSE'
       end as verdict
  from public.drivers d
  join public.profiles p on p.id = d.id
  left join public.zones z on z.id = d.zone_id
 order by verdict, d.last_position_at desc nulls last;

-- b) Les commandes qui cherchent encore, et à qui elles ont été proposées.
select o.code,
       coalesce(p.full_name, '— personne pour le moment') as proposee_a,
       round(extract(epoch from (now() - coalesce(o.search_since, o.created_at)))) as attend_depuis_s,
       coalesce(array_length(o.declined_by, 1), 0)        as refus
  from public.orders o
  left join public.profiles p on p.id = o.offer_driver_id
 where o.status = 'ready' and o.driver_id is null
 order by o.created_at;

-- c) Le planificateur tourne-t-il ? Sans lui, la course proposée à un livreur
--    qui ne répond pas reste bloquée sur son nom : rien ne repart au suivant,
--    et la deuxième recherche n'a jamais lieu. Le résultat s'affiche dans
--    l'onglet « Messages » de l'éditeur SQL.
--    (Interrogation dynamique : sans elle, ce fichier échouerait à l'analyse
--     sur une base où pg_cron n'est pas installé.)
do $$
declare n int;
begin
  if to_regclass('cron.job') is null then
    raise notice 'PLANIFICATEUR : pg_cron n''est pas installe. Reprenez la section 8 du fichier 09_delais.sql — sans lui, une course proposee a un livreur qui ne repond pas ne repart jamais au suivant.';
    return;
  end if;
  execute 'select count(*) from cron.job where command like ''%expire_orders%''' into n;
  if n = 0 then
    raise notice 'PLANIFICATEUR : aucune tache planifiee. Reprenez la section 8 du fichier 09_delais.sql.';
  else
    raise notice 'PLANIFICATEUR : % tache(s) active(s). Tout va bien.', n;
  end if;
end $$;
