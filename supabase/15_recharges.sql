-- ==========================================================================
--  15 — DEMANDES DE RECHARGE DU PORTEFEUILLE LIVREUR
--  --------------------------------------------------------------------------
--  Le livreur demande une recharge, l'administrateur vérifie que l'argent est
--  arrivé, puis valide. Le crédit n'est ajouté qu'à la validation.
--
--  Pourquoi ce détour : un virement BaridiMob arrive sur un compte CCP sans
--  prévenir personne. Algérie Poste n'ouvre aucune interface aux commerçants
--  pour détecter un versement entrant — il faut donc un œil humain.
--
--  Le jour où les paiements par carte (Edahabia / CIB) seront branchés, la
--  passerelle appellera approve_recharge() elle-même depuis une Edge Function :
--  la table et le portefeuille ne changent pas, seule la validation devient
--  automatique. C'est pour ça que la décision est une fonction et pas un
--  simple update.
--
--  Sans risque et rejouable.
-- ==========================================================================

-- 1. Coordonnées de paiement, affichées au livreur ---------------------------
alter table public.platform_settings
  add column if not exists payment_info text;

-- 2. Les demandes ------------------------------------------------------------
create table if not exists public.recharge_requests (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references public.drivers(id) on delete cascade,
  amount      int  not null check (amount > 0),
  method      text not null default 'baridimob'
                check (method in ('baridimob','ccp','especes','carte','autre')),
  proof_url   text,                       -- photo du reçu
  reference   text,                       -- numéro d'opération, si le livreur l'a
  status      text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  reason      text,                       -- motif du refus
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_recharge_driver on public.recharge_requests(driver_id, created_at desc);
create index if not exists idx_recharge_pending on public.recharge_requests(created_at desc) where status = 'pending';

alter table public.recharge_requests enable row level security;

drop policy if exists rr_self_read on public.recharge_requests;
create policy rr_self_read on public.recharge_requests for select
  using (driver_id = auth.uid() or public.is_admin());

-- Le livreur crée sa demande, et rien d'autre : ni le statut, ni le montant
-- crédité ne dépendent de lui. Le statut est forcé par le trigger ci-dessous.
drop policy if exists rr_self_insert on public.recharge_requests;
create policy rr_self_insert on public.recharge_requests for insert
  with check (driver_id = auth.uid());

drop policy if exists rr_admin on public.recharge_requests;
create policy rr_admin on public.recharge_requests for all
  using (public.is_admin()) with check (public.is_admin());

-- 3. Une demande naît toujours « en attente » --------------------------------
create or replace function public.force_pending_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.status := 'pending';
    new.reason := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_force_pending_request on public.recharge_requests;
create trigger trg_force_pending_request
  before insert on public.recharge_requests
  for each row execute function public.force_pending_request();

-- 4. Prévenir les administrateurs --------------------------------------------
create or replace function public.notify_admins_recharge()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record; nom text;
begin
  select coalesce(full_name, email, 'Un livreur') into nom
    from public.profiles where id = new.driver_id;

  for a in select id from public.profiles where role = 'admin' loop
    perform public.notify(a.id, 'Demande de recharge',
      nom || ' demande ' || new.amount || ' DA', 'recharge', null);
  end loop;
  return new;
end $$;

drop trigger if exists trg_notify_admins_recharge on public.recharge_requests;
create trigger trg_notify_admins_recharge
  after insert on public.recharge_requests
  for each row execute function public.notify_admins_recharge();

-- 5. Valider — le seul chemin qui crédite un portefeuille --------------------
create or replace function public.approve_recharge(p_request uuid)
returns int language plpgsql security definer set search_path = public as $$
declare r public.recharge_requests; solde int;
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut valider une recharge.';
  end if;

  -- verrou : deux validations simultanées ne doivent pas créditer deux fois
  select * into r from public.recharge_requests where id = p_request for update;
  if r.id is null then raise exception 'Demande introuvable.'; end if;
  if r.status <> 'pending' then
    raise exception 'Cette demande a déjà été traitée.';
  end if;

  update public.recharge_requests
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_request;

  solde := public.wallet_write(r.driver_id, 'recharge', r.amount, null,
             'Recharge validée — ' || coalesce(r.method, '') ||
             coalesce(' • réf ' || r.reference, ''));

  perform public.notify(r.driver_id, 'Recharge validée',
    r.amount || ' DA ont été ajoutés à votre portefeuille. Nouveau solde : ' || solde || ' DA.',
    'recharge', null);

  return solde;
end $$;
grant execute on function public.approve_recharge(uuid) to authenticated;

-- 6. Refuser ------------------------------------------------------------------
create or replace function public.reject_recharge(p_request uuid, p_reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.recharge_requests;
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut refuser une recharge.';
  end if;

  select * into r from public.recharge_requests where id = p_request for update;
  if r.id is null then raise exception 'Demande introuvable.'; end if;
  if r.status <> 'pending' then raise exception 'Cette demande a déjà été traitée.'; end if;

  update public.recharge_requests
     set status = 'rejected', reason = p_reason,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_request;

  perform public.notify(r.driver_id, 'Recharge refusée',
    coalesce(p_reason, 'Aucun versement correspondant n’a été retrouvé.'), 'recharge', null);

  return true;
end $$;
grant execute on function public.reject_recharge(uuid, text) to authenticated;

-- ==========================================================================
--  RENSEIGNER TES COORDONNÉES DE PAIEMENT (ou depuis Admin → Réglages)
--    update public.platform_settings
--       set payment_info = E'CCP : 0012345678 clé 45\nRIP : 007 99999 ...\nBénéficiaire : BRIK Mohamed'
--     where id = 1;
--
--  LES DEMANDES EN ATTENTE
--    select r.created_at, p.full_name, r.amount, r.method, r.reference
--      from public.recharge_requests r
--      join public.profiles p on p.id = r.driver_id
--     where r.status = 'pending' order by r.created_at;
-- ==========================================================================

select count(*) filter (where status = 'pending') as demandes_en_attente
  from public.recharge_requests;
