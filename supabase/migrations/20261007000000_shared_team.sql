-- Delat team: alla i team_members ser och redigerar samma företag, kontakter,
-- avtal, aktiviteter och uppgifter. owner_id betyder nu "skapad av".
--
-- Lägg till en ny medlem (gör även kontot i Authentication → Users):
--   insert into team_members (email) values ('namn@collaktiv.se');

create table team_members (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

alter table team_members enable row level security;

-- Alla användare som redan finns när migrationen körs blir medlemmar.
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

create policy "teamet ser medlemslistan" on team_members
  for select to authenticated
  using (is_team_member());

-- Vem som loggade aktiviteten.
alter table activities
  add column logged_by text default lower(auth.jwt() ->> 'email');

-- ---------------------------------------------------------------------------
-- Ersätt "egna rader"-policyerna med team-policyer.
-- ---------------------------------------------------------------------------

drop policy "egna företag" on companies;
drop policy "egna kontakter" on contacts;
drop policy "egna avtal" on contracts;
drop policy "egna aktiviteter" on activities;
drop policy "egna uppgifter" on tasks;

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

-- ---------------------------------------------------------------------------
-- Logik som tidigare räknade per användare räknar nu för hela teamet.
-- ---------------------------------------------------------------------------

drop index companies_owner_place_idx;
create unique index companies_place_idx on companies (google_place_id)
  where google_place_id is not null;

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

-- Max 25 Founding Partners totalt för Collaktiv.
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
