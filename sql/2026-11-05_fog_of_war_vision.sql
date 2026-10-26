-- =========================================================
-- GALACTIC FRONT — the fog of war, rebuilt
--
-- Run this in the Supabase SQL editor (SQL > New query).
-- Safe to run more than once, and after every other patch.
--
-- WHAT CHANGES
--
--   Vision is now layered instead of one flat sensor range:
--
--     - every world you hold watches a WIDE circle around
--       itself (20 map units), because it is your world and
--       it has stations, patrols and a whole hemisphere of
--       instruments;
--     - every fleet of yours watches a TIGHT bubble (12),
--       which is what a ship actually carries;
--     - anything already in battle with your ships is always
--       reported, however far the rest of your vision is.
--
--   Outside all of that an enemy fleet is fog. The map keeps
--   the last known position of a contact it loses for two
--   minutes (drawn as a dashed ghost); that memory lives in
--   the browser, not here — this function only answers "what
--   can be seen right now".
-- =========================================================


create or replace function public.sensor_world_range()
returns numeric
language sql
immutable
as $function$ select 20.0 $function$;


create or replace function public.sensor_fleet_range()
returns numeric
language sql
immutable
as $function$ select 12.0 $function$;


/*
   The enemy fleets you are allowed to see, as whole fleet rows (so the map
   can draw them exactly like its own), each with the position it is at.

   Seen means: a world of yours is within sensor_world_range, one of your
   fleets is within sensor_fleet_range, or the enemy is in battle with one
   of yours. Everything else is fog.
*/
create or replace function public.visible_enemy_fleets()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
    with me as (
        select p.id as player_id, p.faction as faction
        from public.players as p
        where p.id = auth.uid()
    ),
    enemies as (
        select f.*, pos.x, pos.y
        from public.fleets as f
        join public.fleet_positions() as pos on pos.id = f.id
        cross join me
        where me.faction is not null
          and coalesce(f.faction, '') <> ''
          and f.faction is distinct from me.faction
          and pos.x is not null
          and pos.y is not null
    ),
    eyes as (
        /* our fleets, and the bubble a hull carries */
        select pos.x, pos.y, public.sensor_fleet_range() as reach
        from public.fleet_positions() as pos
        cross join me
        where pos.faction = me.faction
          and pos.x is not null
        union all
        /* our worlds, and the wide circle a settled planet watches */
        select pp.x, pp.y, public.sensor_world_range() as reach
        from public.planet_positions as pp
        join public.planets as p on p.name = pp.name
        cross join me
        where exists (select 1 from public.cities as c
                      where c.planet_id = p.id and c.faction = me.faction)
    )
    select coalesce(jsonb_agg(
                       to_jsonb(e) - 'x' - 'y'
                       || jsonb_build_object('map_x', e.x, 'map_y', e.y)
                   ), '[]'::jsonb)
    from enemies as e
    where e.status::text = 'engaged'
       or exists (
            select 1 from eyes as a
            where sqrt((a.x - e.x) * (a.x - e.x) + (a.y - e.y) * (a.y - e.y)) <= a.reach
       )
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select public.sensor_world_range()) as world_vision,
    (select public.sensor_fleet_range()) as fleet_vision,
    (select count(*) from information_schema.routines
      where routine_schema = 'public' and routine_name = 'visible_enemy_fleets') as fleet_reading;
