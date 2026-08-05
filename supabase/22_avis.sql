-- ==========================================================================
--  22 — LES AVIS : NOTER LA LIVRAISON
--  --------------------------------------------------------------------------
--  À exécuter dans l'éditeur SQL de Supabase. Sans risque : aucune donnée
--  existante n'est modifiée, et les notes actuelles des restaurants et des
--  livreurs sont conservées jusqu'au premier avis reçu.
--
--  DEUX NOTES SÉPARÉES, et c'est tout l'objet de ce fichier. Un repas froid
--  n'est pas la faute du scooter, et un livreur charmant ne rattrape pas une
--  pizza ratée. Une note unique mélangeait les deux et ne servait à personne :
--  ni au restaurant, qui ne savait pas ce qu'on lui reprochait, ni au livreur,
--  puni pour une cuisine qu'il n'a pas faite.
--
--  LA NOTE DU LIVREUR RESTE PRIVÉE. Elle sert à la plateforme — repérer qui
--  soigne ses courses, qui les bâcle — pas à être affichée sur une fiche
--  publique. Celle du restaurant, elle, s'affiche : c'est ce que le client
--  vient lire avant de commander.
--
--  UN AVIS PAR COMMANDE. La contrainte est dans la table, pas dans
--  l'application : c'est la seule façon d'empêcher qu'un client note dix fois
--  le même repas depuis dix onglets.
-- ==========================================================================

-- --------------------------------------------------------------------------
--  LA TABLE
-- --------------------------------------------------------------------------
create table if not exists public.reviews (
  id             uuid primary key default gen_random_uuid(),

  -- une commande, un avis : l'unicité est portée par la clé elle-même
  order_id       uuid not null unique references public.orders(id) on delete cascade,
  client_id      uuid not null references public.profiles(id) on delete cascade,

  -- on garde qui était concerné au moment de l'avis. `set null` plutôt que
  -- `cascade` : un restaurant qui ferme ne doit pas effacer l'historique des
  -- notes qu'il a reçues, elles ont servi à calculer des moyennes.
  restaurant_id  uuid references public.restaurants(id) on delete set null,
  driver_id      uuid references public.profiles(id) on delete set null,

  -- les deux notes sont facultatives séparément : on peut noter le repas sans
  -- noter le livreur, et l'inverse
  resto_note     smallint check (resto_note between 1 and 5),
  driver_note    smallint check (driver_note between 1 and 5),

  -- « Rapide », « Aimable », « Repas encore chaud » : des compliments en un
  -- tap. Un tableau et non une table à part — ce sont des étiquettes courtes,
  -- jamais interrogées seules.
  compliments    text[] not null default '{}',

  -- le mot libre sur les plats, facultatif
  comment        text,

  created_at     timestamptz not null default now(),

  -- un avis vide n'est pas un avis
  constraint reviews_pas_vide check (
    resto_note is not null or driver_note is not null
    or comment is not null or array_length(compliments, 1) > 0
  )
);

create index if not exists reviews_restaurant_idx on public.reviews(restaurant_id);
create index if not exists reviews_driver_idx     on public.reviews(driver_id);

-- --------------------------------------------------------------------------
--  LES MOYENNES SE RECALCULENT TOUTES SEULES
--  --------------------------------------------------------------------------
--  Recalculées depuis les avis, jamais incrémentées. Un compteur qu'on
--  augmente d'un côté finit toujours par se désynchroniser de ce qu'il compte :
--  il suffit d'un avis supprimé ou d'un import à la main. Ici, la moyenne est
--  toujours exactement celle des lignes présentes.
--
--  `security definer` : le déclencheur écrit dans `restaurants` et `drivers`,
--  que le client n'a pas le droit de modifier. C'est la fonction qui porte ce
--  droit, et elle ne fait rien d'autre que ce calcul.
-- --------------------------------------------------------------------------
create or replace function public.reviews_maj_moyennes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r uuid;
  d uuid;
begin
  -- Sur une suppression, `new` n'est pas affecté : y toucher lève « record new
  -- is not assigned yet ». On choisit donc la ligne selon l'opération, au lieu
  -- d'un coalesce qui paraît naturel mais casse le déclencheur au premier avis
  -- supprimé — c'est-à-dire le jour où l'on en aurait le plus besoin.
  if tg_op = 'DELETE' then
    r := old.restaurant_id;
    d := old.driver_id;
  else
    r := new.restaurant_id;
    d := new.driver_id;
  end if;

  if r is not null then
    update public.restaurants set
      rating = coalesce((select round(avg(resto_note)::numeric, 1)
                           from public.reviews
                          where restaurant_id = r and resto_note is not null), rating),
      rating_count = (select count(*) from public.reviews
                       where restaurant_id = r and resto_note is not null)
    where id = r;
  end if;

  if d is not null then
    -- la table des livreurs n'a pas de compteur d'avis : la moyenne suffit,
    -- et le nombre de courses vit déjà dans total_deliveries
    update public.drivers set
      rating = coalesce((select round(avg(driver_note)::numeric, 1)
                           from public.reviews
                          where driver_id = d and driver_note is not null), rating)
    where id = d;
  end if;

  return null;   -- déclencheur AFTER : la valeur retournée est ignorée
end;
$$;

drop trigger if exists trg_reviews_moyennes on public.reviews;
create trigger trg_reviews_moyennes
  after insert or update or delete on public.reviews
  for each row execute function public.reviews_maj_moyennes();

-- --------------------------------------------------------------------------
--  QUI PEUT FAIRE QUOI
-- --------------------------------------------------------------------------
alter table public.reviews enable row level security;

-- Écrire : le client, sur SA commande, et seulement une fois LIVRÉE. Noter
-- une commande qu'on n'a pas reçue n'a aucun sens, et noter celle d'un autre
-- encore moins.
drop policy if exists reviews_client_insert on public.reviews;
create policy reviews_client_insert on public.reviews for insert
  with check (
    client_id = auth.uid()
    and exists (
      select 1 from public.orders o
       where o.id = order_id
         and o.client_id = auth.uid()
         and o.status = 'delivered'
    )
  );

-- Corriger : son propre avis, tant qu'il est à lui. On ne fixe pas de délai —
-- un client qui se ravise une heure après a autant raison qu'au premier tap.
drop policy if exists reviews_client_update on public.reviews;
create policy reviews_client_update on public.reviews for update
  using (client_id = auth.uid()) with check (client_id = auth.uid());

-- Lire : son auteur, et le restaurant concerné — c'est lui qui doit pouvoir
-- lire ce qu'on dit de ses plats pour y répondre.
--
-- LE LIVREUR N'EST PAS DANS CETTE LISTE, volontairement. Il voit sa moyenne
-- sur son tableau de bord ; lui donner les lignes une par une, horodatées,
-- reviendrait à lui désigner le client qui l'a mal noté ce soir-là. Une note
-- privée qu'on peut attribuer à quelqu'un n'est plus privée.
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews for select
  using (
    client_id = auth.uid()
    or public.owns_restaurant(restaurant_id)
    or public.is_admin()
  );

drop policy if exists reviews_admin on public.reviews;
create policy reviews_admin on public.reviews for all
  using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------
--  ENVOYER UN AVIS
--  --------------------------------------------------------------------------
--  Un seul appel depuis l'application. Il remplace l'avis existant s'il y en a
--  un : le client qui rouvre l'écran corrige sa note au lieu de se heurter à
--  une erreur d'unicité qu'il ne comprendrait pas.
--
--  Le restaurant et le livreur ne sont PAS passés en paramètres mais relus
--  depuis la commande : c'est la commande qui sait qui l'a préparée et qui l'a
--  portée. Les envoyer depuis le téléphone laisserait noter n'importe qui.
-- --------------------------------------------------------------------------
create or replace function public.submit_review(
  p_order       uuid,
  p_resto_note  smallint default null,
  p_driver_note smallint default null,
  p_compliments text[]   default '{}',
  p_comment     text     default null
) returns public.reviews
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  a public.reviews;
begin
  select * into o from public.orders where id = p_order;
  if o.id is null then
    raise exception 'Commande introuvable.';
  end if;
  if o.client_id <> auth.uid() then
    raise exception 'Cette commande n’est pas la vôtre.';
  end if;
  if o.status <> 'delivered' then
    raise exception 'Vous pourrez noter cette commande une fois livrée.';
  end if;

  insert into public.reviews as r
    (order_id, client_id, restaurant_id, driver_id,
     resto_note, driver_note, compliments, comment)
  values
    (o.id, o.client_id, o.restaurant_id, o.driver_id,
     p_resto_note, p_driver_note, coalesce(p_compliments, '{}'), nullif(btrim(p_comment), ''))
  on conflict (order_id) do update set
    resto_note  = excluded.resto_note,
    driver_note = excluded.driver_note,
    compliments = excluded.compliments,
    comment     = excluded.comment
  returning * into a;

  return a;
end;
$$;

grant execute on function public.submit_review(uuid, smallint, smallint, text[], text) to authenticated;

-- --------------------------------------------------------------------------
--  VÉRIFICATION
-- --------------------------------------------------------------------------
select 'table reviews' as objet,
       (select count(*) from information_schema.tables
         where table_schema = 'public' and table_name = 'reviews') as present
union all
select 'fonction submit_review',
       (select count(*) from information_schema.routines
         where routine_schema = 'public' and routine_name = 'submit_review')
union all
select 'declencheur des moyennes',
       (select count(*) from information_schema.triggers
         where trigger_schema = 'public' and trigger_name = 'trg_reviews_moyennes');
