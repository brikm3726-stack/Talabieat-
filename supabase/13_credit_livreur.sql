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
