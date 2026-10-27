-- =========================================================
-- GALACTIC FRONT — the capitals are always their own
--
-- Run this in the Supabase SQL editor AFTER
-- 2026-11-08_pacts_do_not_outlive_their_world.sql.
-- Safe to run more than once.
--
-- WHAT THIS ADDS
--
--   A game starts with each capital cored by its faction: every city of
--   Ultramars is the Combine's, every city of Free Earth is the Freedom
--   Authority's, and neither capital is under occupation, restless, or
--   signed away to anybody.
--
--   That is how the map began, but nothing ever put it back. A reset left
--   the capitals however the last game ended, and the unrest bug of
--   2026-11-06 left the Combine's own capital in the Independents.
--
--   charters_core_capitals() puts both capitals right and answers with how
--   many it cored. It is run once here, so the game you are playing is put
--   right now, and the reset calls it (gamecontrol.js) so every new game
--   starts cored.
--
--   It reads planet_charters, so a world added to that table is treated the
--   same way, and it falls back to the two capitals the same way
--   2026-11-07 does.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the two home worlds, put back the way a game starts
-- ---------------------------------------------------------

create or replace function public.charters_core_capitals()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
    k record;
    v_id public.planets.id%type;
    v_count integer := 0;
begin

    for k in
        select t.planet, t.faction
        from public.planet_charters as t
        union
        select 'Ultramars', 'Combine'
        union
        select 'Free Earth', 'Freedom Authority'
    loop

        select p.id into v_id from public.planets as p where p.name = k.planet;
        if v_id is null then continue; end if;

        /* every city of a capital is the capital's own */
        update public.cities as c set faction = k.faction where c.planet_id = v_id;

        /* a capital is not under occupation */
        begin
            delete from public.cg_occupations as o where o.planet = k.planet;
        exception when undefined_table then null;
        end;

        begin
            delete from public.cs_occupations as o where o.planet = k.planet;
        exception when undefined_table then null;
        end;

        /* nor restless */
        begin
            delete from public.planet_unrest as u where u.planet = k.planet;
        exception when undefined_table then null;
        end;

        /* nor anybody's to sign: a capital is not on the diplomacy board */
        begin
            delete from public.planet_diplomacy as d where d.planet = k.planet;
        exception when undefined_table then null;
        end;

        v_count := v_count + 1;

    end loop;

    return v_count;

end;
$function$;


create or replace function public.charters_are_cored()
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin

    /* both capitals belong to their factions, and nothing else is on them */
    return not exists (
        select 1
        from (
            select 'Ultramars' as planet, 'Combine' as faction
            union all
            select 'Free Earth', 'Freedom Authority'
        ) as h
        join public.planets as p on p.name = h.planet
        where exists (select 1 from public.cities as c
                       where c.planet_id = p.id and c.faction is distinct from h.faction)
    );

end;
$function$;


-- ---------------------------------------------------------
-- 2. put the game being played right, now
-- ---------------------------------------------------------

select public.charters_core_capitals() as capitals_cored;


-- ---------------------------------------------------------
-- 3. the closing readout
-- ---------------------------------------------------------

select
    (select count(*) from public.planet_charters) as charters,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('charters_core_capitals', 'charters_are_cored')) as capital_functions,
    (select count(*) from public.planet_charters as k
       join public.planets as p on p.name = k.planet
      where exists (select 1 from public.cities as c
                     where c.planet_id = p.id and c.faction is distinct from k.faction)) as capitals_with_other_flags,
    (select count(*) from public.planet_unrest as u
       join public.planet_charters as k on k.planet = u.planet) as capitals_with_a_bar,
    (select count(*) from public.planet_diplomacy as d
       join public.planet_charters as k on k.planet = d.planet) as capitals_on_the_diplomacy_board;
