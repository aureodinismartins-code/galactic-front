-- =========================================================
-- GALACTIC FRONT — the party book has a loyalty
--
-- Run in the Supabase SQL editor AFTER
-- 2026-11-20_the_ministries_belong_to_the_chamber.sql.
-- Safe to run more than once.
--
-- WHY THIS EXISTS
--
-- 2026-11-20 made a ministry's output depend on the standing
-- of the holder's PARTY, and read that standing from
-- cg_factions.loyalty. The Congress's party book never had
-- that column — loyalty lived on the delegates (cg_members)
-- and on the Soviet's currents (cs_currents), not on the
-- parties — so the whole committee screen answered
--
--     column f.loyalty does not exist
--
-- and nothing on that tab could be built.
--
-- This adds the column, at 55 for every party, which is the
-- figure 2026-11-20 assumes when it cannot read one. From now
-- on an election moves it: +8 to the winner's party, -4 to
-- the others.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the parties' own standing
-- ---------------------------------------------------------

do $do$
begin

    if to_regclass('public.cg_factions') is null then
        raise notice 'cg_factions is not here: nothing to do';
        return;
    end if;

    execute 'alter table public.cg_factions add column if not exists loyalty numeric';

    execute 'update public.cg_factions set loyalty = 55 where loyalty is null';

    execute 'alter table public.cg_factions alter column loyalty set default 55';

    execute 'alter table public.cg_factions alter column loyalty set not null';

end;
$do$;


-- ---------------------------------------------------------
-- 2. the delegates' flag, if that book is older than it
-- ---------------------------------------------------------

do $do$
begin

    if to_regclass('public.cg_members') is null then
        return;
    end if;

    execute 'alter table public.cg_members add column if not exists active boolean';

    execute 'update public.cg_members set active = true where active is null';

    execute 'alter table public.cg_members alter column active set default true';

end;
$do$;


-- ---------------------------------------------------------
-- 3. the Soviet's currents, only if that book is somehow
--    older than 2026-10-28
-- ---------------------------------------------------------

do $do$
begin

    if to_regclass('public.cs_currents') is null then
        return;
    end if;

    execute 'alter table public.cs_currents add column if not exists loyalty numeric';

    execute 'update public.cs_currents set loyalty = 55 where loyalty is null';

    execute 'alter table public.cs_currents alter column loyalty set default 55';

end;
$do$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'cg_factions'
        and column_name = 'loyalty') as party_loyalty_column,
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'cg_members'
        and column_name = 'active') as delegate_active_column,
    (select min(loyalty) from public.cg_factions) as lowest_party_loyalty,
    (select max(loyalty) from public.cg_factions) as highest_party_loyalty,
    (select count(*) from public.cg_factions where loyalty is null) as parties_without_a_number;
