-- =========================================================
-- GALACTIC FRONT — a pact does not outlive the world it was signed with
--
-- Run this in the Supabase SQL editor AFTER
-- 2026-11-07_charters_and_restless_worlds.sql (and next to
-- 2026-11-08_shared_music_playlist.sql; the two do not touch each other).
-- Safe to run more than once.
--
-- WHAT THIS FIXES
--
--   planet_diplomacy.annexed_at means "this world signed the pact: it is
--   ours and it is off the diplomacy board". Nothing ever took that
--   signature back, so the moment a world stopped being ours — it rose
--   against the occupation, or somebody took it off us — the old signature
--   was still there, answering for a world that had nothing to do with it:
--
--     - the diplomacy screen kept hiding the world (it is left out of
--       diplomacy_state() while it is annexed), so there was no way to
--       court it again;
--     - its envoys were refused with "has already signed the pact", which
--       is a lie by then;
--     - and the unrest rule of 2026-11-07 reads annexed_at to decide that a
--       world that signed is not under occupation, so a world that had
--       thrown the occupation off would have been spared a bar it earned.
--
--   A pact is now settled where the change happens: on the cities
--   themselves. A city that stops being ours voids our signature on that
--   world, immediately, whoever changed it and for whatever reason.
--
--   Nothing else about annexation changes: a world that does sign the pact
--   keeps it exactly as before.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the rule, on the cities themselves
-- ---------------------------------------------------------

create or replace function public.pacts_settle()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    /* the same type the cities are keyed by, whatever that is on this
       database (the join to planets is the game's own) */
    v_planet_id public.cities.planet_id%type := coalesce(new.planet_id, old.planet_id);
    v_name text;
begin

    if v_planet_id is null then return null; end if;

    /* cities are keyed by the planet's id, while the diplomacy books are
       keyed by its name (the convention the game's screens use) */
    select p.name into v_name from public.planets as p where p.id = v_planet_id;
    if v_name is null then return null; end if;

    begin
        update public.planet_diplomacy as d
        set annexed_at = null
        where d.planet = v_name
          and d.annexed_at is not null
          and exists (select 1 from public.cities as c
                      where c.planet_id = v_planet_id
                        and c.faction is distinct from d.faction);
    exception when undefined_table or undefined_column then null;
    end;

    return null;

end;
$function$;


drop trigger if exists pacts_settle_cities on public.cities;

create trigger pacts_settle_cities
after insert or update or delete on public.cities
for each row execute function public.pacts_settle();


-- ---------------------------------------------------------
-- 2. and once, right now, for the pacts already thrown off
-- ---------------------------------------------------------

update public.planet_diplomacy as d
set annexed_at = null
where d.annexed_at is not null
  and exists (select 1 from public.cities as c
              join public.planets as p on p.id = c.planet_id
              where p.name = d.planet
                and c.faction is distinct from d.faction);


-- ---------------------------------------------------------
-- 3. the closing readout
-- ---------------------------------------------------------

select
    (select count(*) from pg_proc as f
      join pg_namespace as n on n.oid = f.pronamespace
     where n.nspname = 'public' and f.proname = 'pacts_settle') as pacts_function,
    (select count(*) from pg_trigger where tgname = 'pacts_settle_cities' and not tgisinternal) as pacts_trigger,
    (select count(*) from public.planet_diplomacy as d
      where d.annexed_at is not null) as worlds_still_signed,
    (select count(*) from public.planet_diplomacy as d
      where d.annexed_at is not null
        and exists (select 1 from public.cities as c
                    join public.planets as p on p.id = c.planet_id
                    where p.name = d.planet
                      and c.faction is distinct from d.faction)) as stale_pacts;
