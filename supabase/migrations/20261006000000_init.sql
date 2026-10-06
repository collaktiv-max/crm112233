-- Collaktiv CRM – grundschema
-- Tabeller: companies (företag), contacts (kontaktperson), contracts (avtal),
-- activities (aktivitet), tasks (uppgift). Företaget är navet.
-- All data ägs av inloggad användare (owner_id) och skyddas med RLS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Typer
-- ---------------------------------------------------------------------------

create type pipeline_stage as enum (
  'prospekt',     -- 1. Hittat, ej kontaktat
  'kontaktad',    -- 2. Besök, samtal, mejl eller DM gjort
  'dialog',       -- 3. Intresserade, frågor pågår
  'mote_bokat',   -- 4. Tid för genomgång på plats
  'onboarding',   -- 5. Konto skapat i Företagsportalen, erbjudandeutkast finns
  'betald',       -- 6. Betald partner, 6-månaderspaket köpt
  'live',         -- 7. Erbjudandet syns i appen
  'forlorad',     -- Sidospår: förlorad (kräver anledning)
  'aterkom'       -- Sidospår: återkom senare (kräver datum)
);

create type activity_type as enum ('besok', 'samtal', 'mejl', 'dm');

create type package_type as enum ('standard', 'premium');

create type contact_channel as enum ('telefon', 'sms', 'mejl', 'instagram', 'facebook', 'besok');

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

create table companies (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (length(trim(name)) > 0),
  org_nr           text,
  category         text,                       -- Mat & dryck, Fika, Mode, ...
  municipality     text,                       -- Gävle, Sandviken, Hudiksvall, ...
  network          text,                       -- Gävle City, Flanör, Nian, Valbo Köpcentrum, ...
  address          text,
  website          text,
  instagram        text,
  facebook         text,
  phone            text,
  source           text,                       -- Var hittades företaget (GDPR: notera källa)
  google_place_id  text,
  is_chain         boolean,                    -- null = okänt
  is_sole_trader   boolean not null default false, -- Enskild firma = personuppgifter
  near_transit     boolean not null default false, -- Nära hållplats/resecentrum
  stage            pipeline_stage not null default 'prospekt',
  stage_changed_at timestamptz not null default now(),
  priority_score   int not null default 0 check (priority_score between 0 and 100),
  next_step        text,
  next_step_date   date,
  lost_reason      text,
  revisit_date     date,
  unsubscribed_at  timestamptz,                -- Tackat nej till utskick
  last_contact_at  timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint lost_requires_reason
    check (stage <> 'forlorad' or coalesce(trim(lost_reason), '') <> ''),
  constraint revisit_requires_date
    check (stage <> 'aterkom' or revisit_date is not null)
);

create index companies_owner_stage_idx on companies (owner_id, stage);
create index companies_owner_municipality_idx on companies (owner_id, municipality);
create index companies_owner_network_idx on companies (owner_id, network);
create unique index companies_owner_place_idx on companies (owner_id, google_place_id)
  where google_place_id is not null;

create table contacts (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id        uuid not null references companies (id) on delete cascade,
  name              text not null,
  role              text,
  phone             text,  -- Endast jobbtelefon
  email             text,  -- Endast jobbmejl
  preferred_channel contact_channel,
  is_decision_maker boolean not null default false,
  created_at        timestamptz not null default now()
);

create index contacts_company_idx on contacts (company_id);

create table contracts (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id       uuid not null references companies (id) on delete cascade,
  package          package_type not null default 'standard',
  founding_partner boolean not null default false,
  -- Listpris för 6-månaderspaketet: 500/700 kr/mån, Founding Partner −20 %.
  list_price       int generated always as (
    (case when package = 'premium' then 700 else 500 end) * 6
    * (case when founding_partner then 8 else 10 end) / 10
  ) stored,
  amount_paid      int check (amount_paid >= 0),  -- kr
  paid_at          date,
  start_date       date,  -- = lansering
  end_date         date,
  created_at       timestamptz not null default now()
);

create index contracts_company_idx on contracts (company_id);

create table activities (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id  uuid not null references companies (id) on delete cascade,
  type        activity_type not null,
  occurred_at timestamptz not null default now(),
  outcome     text,
  note        text,
  objection   text,
  created_at  timestamptz not null default now()
);

create index activities_company_idx on activities (company_id, occurred_at desc);

create table tasks (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid references companies (id) on delete cascade,
  title      text not null,
  due_date   date not null default current_date,
  done       boolean not null default false,
  done_at    timestamptz,
  auto_stage pipeline_stage,  -- satt om uppgiften skapades automatiskt av ett steg
  created_at timestamptz not null default now()
);

create index tasks_owner_open_idx on tasks (owner_id, due_date) where not done;
create index tasks_company_idx on tasks (company_id);

-- ---------------------------------------------------------------------------
-- Prioritetspoäng (0–100)
--   Kategori som sålt bra (mat, fika, handel)   max 30
--   Nära hållplats/resecentrum                       20
--   Lokalt ägt (ej kedja)                            20 (okänt: 10)
--   Nätverk/köpcentrum, med befintlig kund           15 (nätverk utan kund: 5)
--   Aktiv på Instagram/Facebook                      15
-- ---------------------------------------------------------------------------

create or replace function compute_priority_score(c companies)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select least(100,
      case
        when c.category in ('Mat & dryck', 'Fika') then 30
        when c.category in ('Mode', 'Handel') then 25
        when c.category is null then 5
        else 15
      end
    + case when c.near_transit then 20 else 0 end
    + case when c.is_chain is false then 20 when c.is_chain is null then 10 else 0 end
    + case
        when c.network is null or trim(c.network) = '' then 0
        when exists (
          select 1 from companies p
          where p.owner_id = c.owner_id
            and p.id <> c.id
            and p.network = c.network
            and p.stage in ('betald', 'live')
        ) then 15
        else 5
      end
    + case
        when coalesce(trim(c.instagram), '') <> '' or coalesce(trim(c.facebook), '') <> '' then 15
        else 0
      end
  )::int;
$$;

create or replace function companies_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' or new.stage is distinct from old.stage then
    new.stage_changed_at := now();
  end if;
  new.priority_score := compute_priority_score(new);
  return new;
end;
$$;

create trigger companies_before_write
  before insert or update on companies
  for each row execute function companies_before_write();

-- ---------------------------------------------------------------------------
-- Automatisk uppföljning när ett företag hamnar i ett steg
-- ---------------------------------------------------------------------------

create or replace function companies_after_stage_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_title text;
  v_due   date;
begin
  if tg_op = 'UPDATE' and new.stage is not distinct from old.stage then
    return null;
  end if;

  -- Stäng öppna automatiska uppföljningar från tidigare steg.
  update tasks
     set done = true, done_at = now()
   where company_id = new.id
     and not done
     and auto_stage is not null
     and auto_stage <> new.stage;

  -- Ny betalande kund i ett nätverk höjer poängen för grannarna där.
  if new.stage in ('betald', 'live') and coalesce(trim(new.network), '') <> '' then
    update companies
       set updated_at = now()
     where owner_id = new.owner_id
       and network = new.network
       and id <> new.id
       and stage not in ('betald', 'live', 'forlorad');
  end if;

  case new.stage
    when 'kontaktad' then
      v_title := 'Följ upp – inget svar på 3 dagar?';
      v_due   := current_date + 3;
    when 'dialog' then
      v_title := 'Påminnelse: boka möte eller besök';
      v_due   := current_date + 5;
    when 'mote_bokat' then
      v_title := 'Möte imorgon – förbered genomgången';
      v_due   := greatest(current_date, coalesce(new.next_step_date - 1, current_date));
    when 'onboarding' then
      v_title := 'Obetalt? Påminn om betalningen';
      v_due   := current_date + 2;
    when 'betald' then
      v_title := 'Checklista inför lansering: erbjudande, bild, publicering';
      v_due   := current_date + 7;
    when 'live' then
      v_title := 'Kontroll efter 30 dagar: nöjd, uppgradering?';
      v_due   := current_date + 30;
    when 'aterkom' then
      v_title := 'Återkom enligt överenskommelse';
      v_due   := new.revisit_date;
    else
      return null;  -- prospekt hamnar på Dagens lista efter poäng; förlorad får ingen uppgift
  end case;

  insert into tasks (owner_id, company_id, title, due_date, auto_stage)
  values (new.owner_id, new.id, v_title, v_due, new.stage);

  return null;
end;
$$;

create trigger companies_after_stage_change
  after insert or update of stage on companies
  for each row execute function companies_after_stage_change();

-- Ny aktivitet → senaste kontakt uppdateras.
create or replace function activities_after_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update companies
     set last_contact_at = greatest(coalesce(last_contact_at, new.occurred_at), new.occurred_at)
   where id = new.company_id;
  return null;
end;
$$;

create trigger activities_after_insert
  after insert on activities
  for each row execute function activities_after_insert();

-- Uppgift markerad klar → tidsstämpel.
create or replace function tasks_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.done and not old.done then
    new.done_at := now();
  elsif not new.done then
    new.done_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_before_update
  before update on tasks
  for each row execute function tasks_before_update();

-- Max 25 Founding Partners.
create or replace function contracts_check_founding_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.founding_partner and (
    select count(*) from contracts
     where owner_id = new.owner_id and founding_partner and id <> new.id
  ) >= 25 then
    raise exception 'Alla 25 Founding Partner-platser är tagna';
  end if;
  return new;
end;
$$;

create trigger contracts_check_founding_limit
  before insert or update of founding_partner on contracts
  for each row execute function contracts_check_founding_limit();

-- ---------------------------------------------------------------------------
-- GDPR: radera förlorade företag efter 12 månader utan kontakt.
-- Kör manuellt eller schemalägg med pg_cron:
--   select cron.schedule('gdpr-rensning', '0 3 * * 1', 'select purge_stale_lost_companies()');
-- ---------------------------------------------------------------------------

create or replace function purge_stale_lost_companies()
returns int
language sql
set search_path = public
as $$
  with deleted as (
    delete from companies
     where stage = 'forlorad'
       and coalesce(last_contact_at, updated_at) < now() - interval '12 months'
    returning 1
  )
  select count(*)::int from deleted;
$$;

revoke execute on function purge_stale_lost_companies() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: varje användare ser bara sina egna rader.
-- ---------------------------------------------------------------------------

alter table companies  enable row level security;
alter table contacts   enable row level security;
alter table contracts  enable row level security;
alter table activities enable row level security;
alter table tasks      enable row level security;

create policy "egna företag" on companies
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "egna kontakter" on contacts
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from companies c where c.id = company_id and c.owner_id = (select auth.uid()))
  );

create policy "egna avtal" on contracts
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from companies c where c.id = company_id and c.owner_id = (select auth.uid()))
  );

create policy "egna aktiviteter" on activities
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from companies c where c.id = company_id and c.owner_id = (select auth.uid()))
  );

create policy "egna uppgifter" on tasks
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and (company_id is null or exists (
      select 1 from companies c where c.id = company_id and c.owner_id = (select auth.uid())
    ))
  );
