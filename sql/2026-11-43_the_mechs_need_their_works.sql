-- 2026-11-43 - the mechs need their works
--
-- A Knightmare squad is not a rifleman: it is a factory job. The fleet panel
-- has always said so in the button's own tooltip - the planet needs the
-- Facility with the Speeder Wheel, the Frame and the Controls - but nothing
-- enforced it, so a fleet over bare ground could order squads, and any page
-- still open on an old script could go on doing it.
--
-- This puts the rule where it cannot be argued with:
--
--   * knightmare_works_on(p_planet) answers the question once, straight from
--     city_buildings, so the panel and the trigger cannot drift apart;
--   * a trigger on fleet_recruits refuses any Knightmare row aimed at a fleet
--     whose planet has not got the whole chain, whichever door it came in by:
--     the panel, a hand-written insert, or a direct RPC call.
--
-- The trigger fires on insert as well as on an update that moves a row to
-- another fleet or another squad type, so a queued Rifle cannot be renamed
-- into a mech afterwards.
--
-- Cities whose planet_id still holds a planet's name rather than its id are
-- matched by name too, so an old world does not silently lose works it has.
--
-- Safe to run twice: it replaces one function and recreates one trigger.

-- ---------------------------------------------------------
-- 1. the question, asked once
-- ---------------------------------------------------------

create or replace function public.knightmare_works_on(p_planet text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_name text := btrim(coalesce(p_planet, ''));
    v_where text;
    v_sql text;
    v_have integer := 0;
begin

    if v_name = '' then
        return false;
    end if;

    if to_regclass('public.cities') is null or to_regclass('public.city_buildings') is null then
        return false;
    end if;

    /* the world the fleet names is the world searched: by id where the id is
       the planet's own, by name where it is the name */
    if to_regclass('public.planets') is not null then
        v_where :=
            '  and (c.planet_id::text = $1 ' ||
            '       or exists (select 1 from public.planets as p ' ||
            '                  where p.id::text = c.planet_id::text ' ||
            '                    and lower(p.name) = lower($1)))';
    else
        v_where := '  and c.planet_id::text = $1';
    end if;

    v_sql :=
        'select count(distinct cb.building_type) ' ||
        'from public.cities as c ' ||
        'join public.city_buildings as cb on cb.city_id = c.id ' ||
        'where cb.building_type = any (array[' ||
        '''knightmare_facility'', ''speeder_wheel'', ''frame'', ''controls'']) ' ||
        v_where;

    execute v_sql into v_have using v_name;

    return coalesce(v_have, 0) >= 4;

end;
$function$;


-- ---------------------------------------------------------
-- 2. the queue refuses a squad with no works behind it
-- ---------------------------------------------------------

create or replace function public.knightmare_needs_its_works()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_status text;
    v_planet text;
begin

    /* every other squad is raised in the ordinary way */
    if coalesce(new.squad_type, '') <> 'Knightmare' then
        return new;
    end if;

    if to_regclass('public.fleets') is null then
        raise exception 'A Knightmare squad cannot be checked: the fleets table is missing';
    end if;

    select f.status::text, f.origin into v_status, v_planet
    from public.fleets as f
    where f.id = new.fleet_id;

    /* a squad is raised at a dock, never in the middle of a crossing */
    if coalesce(v_status, '') <> 'stationed' then
        raise exception 'A Knightmare squad is raised at a dock: the fleet has to be stationed';
    end if;

    if not public.knightmare_works_on(v_planet) then
        raise exception 'The Knightmare line is not built here: this planet needs the Knightmare Facility with the Speeder Wheel, the Frame and the Controls before a squad can be raised';
    end if;

    return new;

end;
$function$;


do $$
begin

    if to_regclass('public.fleet_recruits') is null then
        raise notice 'fleet_recruits not found: the mechs rule waits for the queue table';
        return;
    end if;

    execute 'drop trigger if exists knightmare_needs_its_works on public.fleet_recruits';

    execute 'create trigger knightmare_needs_its_works ' ||
            'before insert or update of fleet_id, squad_type on public.fleet_recruits ' ||
            'for each row execute function public.knightmare_needs_its_works()';

end
$$;
