-- 2026-11-45 - orbit fights over held worlds
--
-- A fleet parked in orbit beside two enemy fleets fought nobody. The orbit
-- scan had one extra condition: it only looked at worlds that are nobody's
-- (every city of them independent), because that was the only orbit the game
-- thought could be contested. Anywhere else - a capital, a world either side
-- holds - two hostile fleets could sit in the same orbit for ever, drawn on
-- top of one another on the map and blind to each other.
--
-- The condition is gone. One fleet of the Freedom Authority and one of the
-- Combine stationed at the same world fight, whoever holds the world: an
-- enemy squadron in your own orbit is an enemy squadron. Nothing else about
-- the scan changes - same pairing, one live battle per orbit, same release.
--
-- The two log lines no longer call every orbit neutral.
--
-- Safe to run twice: it replaces one function.

create or replace function public.orbit_battle_scan()
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
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        return v_out;
    end if;

    if public.game_frozen() then
        return v_out;
    end if;

    if not pg_try_advisory_xact_lock(7770004) then
        return v_out;
    end if;

    for pr in
        select p.name as planet,
               min(pp.x) as x,
               min(pp.y) as y
        from public.planets as p
        join public.planet_positions as pp on pp.name = p.name
        join public.fleets as f on f.origin = p.name
        where f.status::text = 'stationed'
          and f.faction in ('Freedom Authority', 'Combine')
          and jsonb_typeof(coalesce(f.squads, '[]'::jsonb)) = 'array'
          and jsonb_array_length(coalesce(f.squads, '[]'::jsonb)) > 0
        group by p.name
        having count(distinct f.faction) = 2
        order by p.name
    loop

        /* one live battle per orbit is enough */
        if exists (select 1 from public.space_battles as b
                   where b.kind = 'orbit'
                     and b.planet = pr.planet
                     and b.status in ('pending', 'active')) then
            continue;
        end if;

        select * into fa from public.fleets as f
        where f.origin = pr.planet and f.status::text = 'stationed'
          and f.faction = 'Freedom Authority'
          and f.id <> all (v_used)
          and jsonb_array_length(coalesce(f.squads, '[]'::jsonb)) > 0
        order by f.name
        limit 1;

        select * into fb from public.fleets as f
        where f.origin = pr.planet and f.status::text = 'stationed'
          and f.faction = 'Combine'
          and f.id <> all (v_used)
          and jsonb_array_length(coalesce(f.squads, '[]'::jsonb)) > 0
        order by f.name
        limit 1;

        if fa.id is null or fb.id is null then continue; end if;

        v_id := null;

        /* the base game's own orbit battle, if this database has it */
        begin
            v_id := public.space_battle_start_orbit(fa.id, pr.planet);
        exception when others then v_id := null;
        end;

        if v_id is null then

            begin
                insert into public.space_battles (kind, planet, x, y, status)
                values ('orbit', pr.planet, pr.x, pr.y, 'pending')
                returning id into v_id;

                insert into public.space_battle_fleets
                    (battle_id, fleet_id, side, player_id, faction, fleet_name, prev_status, squads)
                values
                    (v_id, fa.id, 'A', fa.player_id, fa.faction, fa.name, fa.status::text, coalesce(fa.squads, '[]'::jsonb)),
                    (v_id, fb.id, 'D', fb.player_id, fb.faction, fb.name, fb.status::text, coalesce(fb.squads, '[]'::jsonb));

                update public.fleets as f set status = 'engaged', space_x = null, space_y = null
                where f.id in (fa.id, fb.id);
            exception when others then
                v_id := null;
            end;

        end if;

        if v_id is null then continue; end if;

        v_out := v_out || jsonb_build_object('id', v_id, 'planet', pr.planet);
        v_used := v_used || fa.id || fb.id;

        begin
            perform public.cg_log('ORBITA DE ' || upper(pr.planet) || ': forças da Freedom Authority e do Combine encontram-se em órbita. Combate aberto.');
        exception when others then null;
        end;

        begin
            perform public.cs_log('ÓRBITA DE ' || upper(pr.planet) || ': navios das duas potências abrem fogo. Combate aberto.');
        exception when others then null;
        end;

    end loop;

    return v_out;

end;
$function$;
