-- 2026-11-41 - fleets find each other sooner
--
-- Two hostile fleets had to be almost on top of each other before the scan
-- would put them in a battle: the old radius was seven map units, which on a
-- map this wide is a couple of pixels. The radius now comes from one function
-- so the map and the scan agree, and it is twice what it was.
--
-- Safe to run twice: it replaces the function and the scan, nothing else.


-- ---------------------------------------------------------
-- 1. how close two fleets have to be to fight
-- ---------------------------------------------------------

create or replace function public.space_engage_radius()
returns numeric
language sql
immutable
as $function$
    select 14::numeric
$function$;


-- ---------------------------------------------------------
-- 2. the scan, which now uses it
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
        from public.space_positions() as pa_
        join public.space_positions() as pb_ on pa_.fleet_id < pb_.fleet_id
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
