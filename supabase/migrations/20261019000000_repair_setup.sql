-- Collaktiv CRM – komplett och självreparerande uppsättning.
--
-- Kan köras hur många gånger som helst och i vilket läge som helst:
--   * tom databas            → skapar allt
--   * bara första filen körd → lägger till teamet och det som saknas
--   * allt redan kört        → ändrar ingenting som fungerar
-- Befintlig data rörs inte.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Typer
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pipeline_stage') then
    create type pipeline_stage as enum (
      'prospekt', 'kontaktad', 'dialog', 'mote_bokat', 'onboarding', 'betald', 'live', 'forlorad', 'aterkom'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'activity_type') then
    create type activity_type as enum ('besok', 'samtal', 'mejl', 'dm');
  end if;
  if not exists (select 1 from pg_type where typname = 'package_type') then
    create type package_type as enum ('standard', 'premium');
  end if;
  if not exists (select 1 from pg_type where typname = 'contact_channel') then
    create type contact_channel as enum ('telefon', 'sms', 'mejl', 'instagram', 'facebook', 'besok');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------------

create table if not exists companies (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (length(trim(name)) > 0),
  org_nr           text,
  category         text,
  municipality     text,
  network          text,
  address          text,
  website          text,
  instagram        text,
  facebook         text,
  phone            text,
  source           text,
  google_place_id  text,
  is_chain         boolean,
  is_sole_trader   boolean not null default false,
  near_transit     boolean not null default false,
  stage            pipeline_stage not null default 'prospekt',
  stage_changed_at timestamptz not null default now(),
  priority_score   int not null default 0 check (priority_score between 0 and 100),
  next_step        text,
  next_step_date   date,
  lost_reason      text,
  revisit_date     date,
  unsubscribed_at  timestamptz,
  last_contact_at  timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint lost_requires_reason
    check (stage <> 'forlorad' or coalesce(trim(lost_reason), '') <> ''),
  constraint revisit_requires_date
    check (stage <> 'aterkom' or revisit_date is not null)
);

create table if not exists contacts (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id        uuid not null references companies (id) on delete cascade,
  name              text not null,
  role              text,
  phone             text,
  email             text,
  preferred_channel contact_channel,
  is_decision_maker boolean not null default false,
  created_at        timestamptz not null default now()
);

create table if not exists contracts (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id       uuid not null references companies (id) on delete cascade,
  package          package_type not null default 'standard',
  founding_partner boolean not null default false,
  list_price       int generated always as (
    (case when package = 'premium' then 700 else 500 end) * 6
    * (case when founding_partner then 8 else 10 end) / 10
  ) stored,
  amount_paid      int check (amount_paid >= 0),
  paid_at          date,
  start_date       date,
  end_date         date,
  created_at       timestamptz not null default now()
);

create table if not exists activities (
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

alter table activities
  add column if not exists logged_by text default lower(auth.jwt() ->> 'email');

create table if not exists tasks (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid references companies (id) on delete cascade,
  title      text not null,
  due_date   date not null default current_date,
  done       boolean not null default false,
  done_at    timestamptz,
  auto_stage pipeline_stage,
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------------------

create index if not exists companies_owner_stage_idx on companies (owner_id, stage);
create index if not exists companies_owner_municipality_idx on companies (owner_id, municipality);
create index if not exists companies_owner_network_idx on companies (owner_id, network);
drop index if exists companies_owner_place_idx;
create unique index if not exists companies_place_idx on companies (google_place_id)
  where google_place_id is not null;
create index if not exists contacts_company_idx on contacts (company_id);
create index if not exists contracts_company_idx on contracts (company_id);
create index if not exists activities_company_idx on activities (company_id, occurred_at desc);
create index if not exists tasks_owner_open_idx on tasks (owner_id, due_date) where not done;
create index if not exists tasks_company_idx on tasks (company_id);

-- ---------------------------------------------------------------------------
-- Teamet: alla som redan har ett konto blir medlemmar.
-- (Kontrollera listan i appen under Status om registrering varit öppen.)
-- ---------------------------------------------------------------------------

insert into team_members (email)
select lower(email) from auth.users where email is not null
on conflict do nothing;

create or replace function is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from team_members where email = lower(auth.jwt() ->> 'email')
  );
$$;

revoke execute on function is_team_member() from public, anon;
grant execute on function is_team_member() to authenticated;

-- ---------------------------------------------------------------------------
-- Funktioner och triggers (senaste versionerna)
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
          where p.id <> c.id
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

drop trigger if exists companies_before_write on companies;
create trigger companies_before_write
  before insert or update on companies
  for each row execute function companies_before_write();

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

  update tasks
     set done = true, done_at = now()
   where company_id = new.id
     and not done
     and auto_stage is not null
     and auto_stage <> new.stage;

  if new.stage in ('betald', 'live') and coalesce(trim(new.network), '') <> '' then
    update companies
       set updated_at = now()
     where network = new.network
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
      return null;
  end case;

  insert into tasks (owner_id, company_id, title, due_date, auto_stage)
  values (coalesce(auth.uid(), new.owner_id), new.id, v_title, v_due, new.stage);

  return null;
end;
$$;

drop trigger if exists companies_after_stage_change on companies;
create trigger companies_after_stage_change
  after insert or update of stage on companies
  for each row execute function companies_after_stage_change();

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

drop trigger if exists activities_after_insert on activities;
create trigger activities_after_insert
  after insert on activities
  for each row execute function activities_after_insert();

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

drop trigger if exists tasks_before_update on tasks;
create trigger tasks_before_update
  before update on tasks
  for each row execute function tasks_before_update();

create or replace function contracts_check_founding_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.founding_partner and (
    select count(*) from contracts where founding_partner and id <> new.id
  ) >= 25 then
    raise exception 'Alla 25 Founding Partner-platser är tagna';
  end if;
  return new;
end;
$$;

drop trigger if exists contracts_check_founding_limit on contracts;
create trigger contracts_check_founding_limit
  before insert or update of founding_partner on contracts
  for each row execute function contracts_check_founding_limit();

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
-- Behörighet: alla i teamet delar all data.
-- ---------------------------------------------------------------------------

alter table companies    enable row level security;
alter table contacts     enable row level security;
alter table contracts    enable row level security;
alter table activities   enable row level security;
alter table tasks        enable row level security;
alter table team_members enable row level security;

drop policy if exists "egna företag" on companies;
drop policy if exists "egna kontakter" on contacts;
drop policy if exists "egna avtal" on contracts;
drop policy if exists "egna aktiviteter" on activities;
drop policy if exists "egna uppgifter" on tasks;

drop policy if exists "teamets företag" on companies;
drop policy if exists "teamets kontakter" on contacts;
drop policy if exists "teamets avtal" on contracts;
drop policy if exists "teamets aktiviteter" on activities;
drop policy if exists "teamets uppgifter" on tasks;
drop policy if exists "teamet ser medlemslistan" on team_members;

create policy "teamets företag" on companies
  for all to authenticated using (is_team_member()) with check (is_team_member());
create policy "teamets kontakter" on contacts
  for all to authenticated using (is_team_member()) with check (is_team_member());
create policy "teamets avtal" on contracts
  for all to authenticated using (is_team_member()) with check (is_team_member());
create policy "teamets aktiviteter" on activities
  for all to authenticated using (is_team_member()) with check (is_team_member());
create policy "teamets uppgifter" on tasks
  for all to authenticated using (is_team_member()) with check (is_team_member());

-- Inloggade får se sin egen rad (för statussidan) och teamet ser hela listan.
create policy "teamet ser medlemslistan" on team_members
  for select to authenticated
  using (is_team_member() or email = lower(auth.jwt() ->> 'email'));

-- Supabase-projekt skapade efter 2025 ger inte alltid tabellrättigheter automatiskt.
grant usage on schema public to authenticated;
grant select, insert, update, delete on companies, contacts, contracts, activities, tasks to authenticated;
grant select on team_members to authenticated;

-- Säg till PostgREST att läsa om schemat direkt.
notify pgrst, 'reload schema';
