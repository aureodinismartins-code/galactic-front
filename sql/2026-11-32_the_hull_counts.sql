-- =========================================================
-- GALACTIC FRONT — THE HULL COUNTS
--
-- Run AFTER sql/2026-11-31_the_cargo_holds_no_troops.sql,
-- in the Supabase SQL editor (SQL > New query). Safe to run
-- more than once, and after every other patch.
--
-- WHY THIS EXISTS
--
--   The galactic map draws a transport fleet with the slaver
--   hull, one icon for every TWO hulls the fleet carries. It
--   cannot read `tusken_ships` itself: that table is closed by
--   row level security and holds every faction's hulls.
--
--   This is the one reading the map is allowed: the number of
--   hulls per fleet, and nothing else — no slaves, no course,
--   no cargo. A fleet with two hulls draws one slaver, four
--   hulls draw two, seven draw four.
-- =========================================================


create or replace function public.tusken_hull_counts()
returns table (fleet_id uuid, hulls bigint)
language sql
stable
security definer
set search_path to ''
as $function$
    select s.fleet_id, count(*)::bigint as hulls
    from public.tusken_ships as s
    where s.fleet_id is not null
    group by s.fleet_id
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select (select count(*) from public.tusken_ships) as hulls,
       (select count(*) from public.tusken_ships where fleet_id is not null) as hulls_with_a_fleet,
       (select count(*) from public.tusken_hull_counts()) as fleets_carrying_hulls;
