-- =========================================================
-- GALACTIC FRONT — the ministry tables are whole
--
-- Run in the Supabase SQL editor. Order does not matter:
-- this only puts columns back. Safe to run any number of
-- times.
--
-- WHY
--
--   "column m.player_id does not exist" on the Congress tab.
--
--   The ministry tables were created by the first patch that
--   needed them, and every later patch wrote
--   `create table if not exists`. When the table already
--   existed that line did nothing, so a column an older
--   version of cg_government() reads was never added — and a
--   run of the patches out of order left a government
--   function asking for a column the table does not have.
--
--   Both tables are now given every column any version of
--   the ministries reads or writes. Nothing is dropped and no
--   holder is changed: the seating is left exactly as it is.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the Congress's ministries
-- ---------------------------------------------------------

create table if not exists public.cg_ministers (
    post text primary key,
    player_id uuid,
    name text,
    party_id integer,
    appointed_at timestamptz not null default now(),
    term_no integer,
    last_power_term integer,
    last_power_at timestamptz
);

alter table public.cg_ministers add column if not exists player_id uuid;
alter table public.cg_ministers add column if not exists member_id integer;
alter table public.cg_ministers add column if not exists name text;
alter table public.cg_ministers add column if not exists party_id integer;
alter table public.cg_ministers add column if not exists appointed_at timestamptz not null default now();
alter table public.cg_ministers add column if not exists term_no integer;
alter table public.cg_ministers add column if not exists last_power_term integer;
alter table public.cg_ministers add column if not exists last_power_at timestamptz;
alter table public.cg_ministers add column if not exists last_effect jsonb;
alter table public.cg_ministers add column if not exists last_effect_term integer;

insert into public.cg_ministers (post) values ('war'), ('treasury'), ('interior')
on conflict (post) do nothing;


-- ---------------------------------------------------------
-- 2. the Combine's commissariats
-- ---------------------------------------------------------

create table if not exists public.cs_ministers (
    post text primary key,
    player_id uuid,
    name text,
    current_id integer,
    appointed_at timestamptz not null default now(),
    term_no integer,
    last_power_term integer,
    last_power_at timestamptz
);

alter table public.cs_ministers add column if not exists player_id uuid;
alter table public.cs_ministers add column if not exists member_id integer;
alter table public.cs_ministers add column if not exists name text;
alter table public.cs_ministers add column if not exists current_id integer;
alter table public.cs_ministers add column if not exists appointed_at timestamptz not null default now();
alter table public.cs_ministers add column if not exists term_no integer;
alter table public.cs_ministers add column if not exists last_power_term integer;
alter table public.cs_ministers add column if not exists last_power_at timestamptz;
alter table public.cs_ministers add column if not exists last_effect jsonb;
alter table public.cs_ministers add column if not exists last_effect_term integer;

insert into public.cs_ministers (post) values ('security'), ('grain'), ('labour')
on conflict (post) do nothing;


-- ---------------------------------------------------------
-- 3. the chamber's own links
--
--    The same out-of-order run can leave the chamber without
--    the player link and the loyalty the seating reads, so
--    those are put back too — but only where the table is
--    there to put them on.
-- ---------------------------------------------------------

do $do$
begin

    if to_regclass('public.cg_members') is not null then
        execute 'alter table public.cg_members add column if not exists player_id uuid';
        execute 'alter table public.cg_members add column if not exists loyalty numeric default 55';
        execute 'alter table public.cg_members add column if not exists active boolean default true';
    end if;

    if to_regclass('public.cs_commissars') is not null then
        execute 'alter table public.cs_commissars add column if not exists loyalty numeric default 55';
        execute 'alter table public.cs_commissars add column if not exists active boolean default true';
    end if;

end;
$do$;


-- ---------------------------------------------------------
-- 4. the closing readout
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'cg_ministers') as cg_columns,
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'cs_ministers') as cs_columns,
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'cg_ministers' and column_name = 'player_id') as cg_has_player_id,
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'cs_ministers' and column_name = 'player_id') as cs_has_player_id,
    (select count(*) from public.cg_ministers) as congress_posts,
    (select count(*) from public.cs_ministers) as soviet_posts;
