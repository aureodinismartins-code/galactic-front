-- 2026-11-44 - fleets meet on the way
--
-- Two hostile fleets heading for each other's capitals flew straight through
-- one another without a shot. The scan itself was fine: it asked
-- space_positions() where every fleet was, and that function only knows the
-- fleets that carry a stored point in space (space_x/space_y). A fleet under
-- way has no such point - its place is the line between where it left and
-- where it is going - so travelling fleets were never in the list, and no
-- radius, however wide, could have caught them.
--
-- This adds space_fleet_points(), which places a fleet by its status:
--
--   * parked in space or in a fight: its stored space_x/space_y,
--   * travelling or cruising: on the line between its start (from_x/from_y,
--     or the world it left) and its end (dest_x/dest_y, or the world it is
--     bound for), at the share of the trip the clock says is behind it.
--
-- The scan then reads that instead. Nothing else changes: same radius, same
-- pairing, same bookkeeping.
--
-- Safe to run twice: it replaces one new function and the scan.

-- ---------------------------------------------------------
-- 1. where a fleet actually is
-- ---------------------------------------------------------

create or replace function public.space_fleet_points()
returns table (fleet_id uuid, x numeric, y numeric)
language sql
stable
security definer
set search_path to ''
as $function$
    with moving as (
        select f.id,
               f.status::text as status,
               f.space_x, f.space_y,
               f.origin, f.destination,
               f.from_x, f.from_y, f.dest_x, f.dest_y,
               f.departure_time, f.arrival_time
        from public.fleets as f
        where f.status::text in ('in_space', 'engaged', 'travelling', 'cruising')
    ),
    points as (
        select m.id,
               m.status,
               m.space_x,
               m.space_y,
               coalesce(m.from_x, o.x) as sx,
               coalesce(m.from_y, o.y) as sy,
               case when m.status = 'cruising' and m.dest_x is not null then m.dest_x else d.x end as ex,
               case when m.status = 'cruising' and m.dest_y is not null then m.dest_y else d.y end as ey,
               case
                   when m.departure_time is null or m.arrival_time is null then 1::numeric
                   when m.arrival_time <= m.departure_time then 1::numeric
                   else least(1::numeric, greatest(0::numeric,
                       extract(epoch from (now() - m.departure_time)) /
                       extract(epoch from (m.arrival_time - m.departure_time))))
               end as share
        from moving as m
        left join public.planet_positions as o on o.name = m.origin
        left join public.planet_positions as d on d.name = m.destination
    ),
    placed as (
        select p.id,
               case
                   when p.status in ('in_space', 'engaged') and p.space_x is not null then p.space_x
                   when p.sx is not null and p.ex is not null then p.sx + (p.ex - p.sx) * p.share
                   else null
               end as x,
               case
                   when p.status in ('in_space', 'engaged') and p.space_y is not null then p.space_y
                   when p.sy is not null and p.ey is not null then p.sy + (p.ey - p.sy) * p.share
                   else null
               end as y
        from points as p
    )
    select q.id as fleet_id, q.x, q.y
    from placed as q
    where q.x is not null and q.y is not null
$function$;


-- ---------------------------------------------------------
-- 2. the scan reads it
-- ---------------------------------------------------------

create or replace function public.space_battle_scan()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    pr record;
    fa record;
    fb record;
    v_used uuid[] := '{}';
    v_out jsonb := '[]'::jsonb;
    v_id uuid;
    v_radius numeric := public.space_engage_radius();
begin
    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        return v_out;
    end if;

    /* maintenance: no new battles are picked while the game is closed */

    if public.game_frozen() then
        return v_out;
    end if;

    if not pg_try_advisory_xact_lock(7770002) then
        return v_out;
    end if;

    for pr in
        select pa_.fleet_id as a_id, pb_.fleet_id as b_id,
               pa_.x as ax, pa_.y as ay, pb_.x as bx, pb_.y as by_,
               sqrt(((pa_.x - pb_.x) * 1.78) ^ 2 + (pa_.y - pb_.y) ^ 2) as dist
        from public.space_fleet_points() as pa_
        join public.space_fleet_points() as pb_ on pa_.fleet_id < pb_.fleet_id
        where sqrt(((pa_.x - pb_.x) * 1.78) ^ 2 + (pa_.y - pb_.y) ^ 2) < v_radius
        order by 7
    loop
        if pr.a_id = any (v_used) or pr.b_id = any (v_used) then continue; end if;

        select * into fa from public.fleets as f where f.id = pr.a_id for update;
        select * into fb from public.fleets as f where f.id = pr.b_id for update;

        if fa.id is null or fb.id is null then continue; end if;
        if fa.faction is not distinct from fb.faction then continue; end if;
        if fa.status::text not in ('in_space', 'cruising', 'travelling') then continue; end if;
        if fb.status::text not in ('in_space', 'cruising', 'travelling') then continue; end if;
        if public.space_fleet_power(fa.squads) <= 0 or public.space_fleet_power(fb.squads) <= 0 then continue; end if;

        insert into public.space_battles (kind, x, y, status)
        values ('space', (pr.ax + pr.bx) / 2, (pr.ay + pr.by_) / 2, 'pending')
        returning id into v_id;

        insert into public.space_battle_fleets (battle_id, fleet_id, side, player_id, faction, fleet_name, prev_status, squads)
        values
            (v_id, fa.id, 'A', fa.player_id, fa.faction, fa.name, fa.status::text, coalesce(fa.squads, '[]'::jsonb)),
            (v_id, fb.id, 'D', fb.player_id, fb.faction, fb.name, fb.status::text, coalesce(fb.squads, '[]'::jsonb));

        update public.fleets as f set status = 'engaged', space_x = pr.ax, space_y = pr.ay, dest_x = null, dest_y = null
        where f.id = fa.id;
        update public.fleets as f set status = 'engaged', space_x = pr.bx, space_y = pr.by_, dest_x = null, dest_y = null
        where f.id = fb.id;

        v_out := v_out || jsonb_build_object('id', v_id, 'x', (pr.ax + pr.bx) / 2, 'y', (pr.ay + pr.by_) / 2);
        v_used := v_used || fa.id || fb.id;
    end loop;

    return v_out;
end;
$function$;
