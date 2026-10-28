-- =========================================================
-- GALACTIC FRONT — offline economy + maintenance freeze
--
-- Run this in the Supabase SQL editor (SQL > New query).
-- Safe to run more than once.
--
-- What it changes:
--   1. While NO player of any faction is online, the income is paid at
--      half value and only every 10 minutes instead of full value every
--      5 minutes. When somebody comes back, the window is settled and
--      the normal rhythm resumes. (Fleets, recruiting, war and Congress
--      keep pausing as they do today; only the economy keeps running,
--      which is what makes the reduced offline income possible.)
--   2. While the game is under maintenance (or not started yet)
--      nothing advances at all: no income, no fleet arrivals, no
--      recruiting, no war ticks, no cannon fire, no Congress.
--      The closure is still given back when the host reopens the
--      game (game_set_maintenance already shifts the clocks).
--
-- Presence is written by game_heartbeat(), which every page calls
-- every 20 seconds, so no frontend change is needed.
-- =========================================================


-- ---------------------------------------------------------
-- 1. who is online
-- ---------------------------------------------------------

create table if not exists public.player_presence (
    player_id uuid primary key references auth.users(id) on delete cascade,
    last_seen timestamptz not null default now()
);

alter table public.player_presence enable row level security;

-- only the SECURITY DEFINER functions below touch this table
revoke all on public.player_presence from anon, authenticated;

create or replace function public.players_online()
returns integer
language sql
stable
security definer
set search_path to ''
as $function$
    -- a heartbeat arrives every 20 s, so anything fresher than 70 s is online
    select count(*)::integer
    from public.player_presence as p
    where p.last_seen > now() - interval '70 seconds';
$function$;


-- true when the world must not advance at all
create or replace function public.game_frozen()
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    g record;
begin
    select * into g from public.game_control as x where x.id = 1;
    return g.started is not true or g.maintenance is true;
end;
$function$;


-- when the last player left, so the economy can settle that window at the
-- reduced rate. null means "everybody has been online the whole time".
alter table public.game_control
    add column if not exists offline_since timestamptz;


-- ---------------------------------------------------------
-- 2. heartbeat: presence + offline window
-- ---------------------------------------------------------

create or replace function public.game_heartbeat()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    g record;
    v_gap interval;
    v_shift interval := interval '0';
    v_online integer;
begin
    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    perform set_config('game.bypass', '1', true);

    insert into public.player_presence (player_id, last_seen)
    values (auth.uid(), now())
    on conflict (player_id) do update set last_seen = now();

    select * into g from public.game_control as x where x.id = 1 for update;

    if g.host_player is null then
        update public.game_control as x
        set host_player = (select u.id from auth.users as u order by u.created_at limit 1)
        where x.id = 1;
        select * into g from public.game_control as x where x.id = 1;
    end if;

    v_gap := now() - g.last_activity;

    /*
       Nobody has been here for a while. Two things happen:
         - the absence is remembered, so the economy can settle that window at
           half value with 10-minute ticks instead of freezing completely;
         - the world itself is paused as before (fleets, recruiting, war,
           Congress), except the income clock, which must keep running so the
           window can be paid.
    */
    if g.started and not g.maintenance and v_gap > interval '150 seconds' then

        if g.offline_since is null then
            update public.game_control as x
            set offline_since = g.last_activity
            where x.id = 1;
        end if;

        v_shift := v_gap - interval '45 seconds';

        if v_shift > interval '0' then

            perform public.game_shift_time(v_shift);

            /* the shift moved every clock forward: the economy keeps its own */
            update public.faction_treasury as ft
            set last_income_at = ft.last_income_at - v_shift
            where ft.last_income_at is not null;

            update public.game_control as x
            set total_paused = x.total_paused + v_shift
            where x.id = 1;

        end if;

        select * into g from public.game_control as x where x.id = 1;

    end if;

    /*
       Maintenance and the not-started phase are dead time: nothing accrues.
       The closure is given back by game_set_maintenance() / game_start().
    */
    select count(*) into v_online
    from public.player_presence as p
    where p.last_seen > now() - interval '70 seconds';

    if g.started and not g.maintenance then

        perform public.collect_faction_income();

        -- somebody is back: the offline window has been settled above
        if v_online > 0 and g.offline_since is not null then
            update public.game_control as x set offline_since = null where x.id = 1;
        end if;

    elsif g.offline_since is not null then

        /* maintenance / not started: that window is given back by game_shift_time,
           so it must not also be settled as offline income */
        update public.game_control as x set offline_since = null where x.id = 1;

    end if;

    update public.game_control as x
    set last_activity = now()
    where x.id = 1;

    return jsonb_build_object(
        'started', g.started,
        'maintenance', g.maintenance,
        'maintenance_message', g.maintenance_message,
        'is_host', g.host_player = auth.uid(),
        'resumed_after', 0,
        'online', v_online,
        'offline_since', g.offline_since
    );
end;
$function$;


-- ---------------------------------------------------------
-- 3. income: full rate every 5 min online, half rate every 10 min offline
-- ---------------------------------------------------------

create or replace function public.collect_faction_income()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    t record;
    g record;
    v_income bigint;
    v_cursor timestamptz;
    v_online_end timestamptz;
    v_ticks bigint;
    v_paid bigint;
begin

    /* no game.bypass here: income must obey the same guards as the rest of
       the world, and it simply does nothing while the game is frozen */
    select * into g from public.game_control as x where x.id = 1;

    -- maintenance or not started: the world is frozen, nothing accrues
    if g.started is not true or g.maintenance is true then
        return;
    end if;

    for t in
        select faction, last_income_at
        from public.faction_treasury
        for update
    loop

        v_income := 0;
        v_paid := 0;

        if t.last_income_at is not null then

            v_cursor := t.last_income_at;

            select coalesce(sum(
                p.income + 100 * (
                    select count(*)
                    from public.city_buildings as cb
                    join public.cities as cc on cc.id = cb.city_id
                    where cc.planet_id = p.id
                      and cb.building_type = 'civilian_factory'
                )
            ), 0)
            into v_income
            from public.planets as p
            where exists (
                  select 1 from public.cities as c
                  where c.planet_id = p.id
              )
              and not exists (
                  select 1 from public.cities as c
                  where c.planet_id = p.id
                    and c.faction <> t.faction
              );

            -- online stretch: full value, one payment every 5 minutes
            v_online_end := least(now(), coalesce(g.offline_since, now()));

            if v_online_end > v_cursor then
                v_ticks := floor(extract(epoch from (v_online_end - v_cursor)) / 300);

                if v_ticks > 0 then
                    v_paid := v_paid + v_ticks * v_income;
                    v_cursor := v_cursor + v_ticks * interval '5 minutes';
                end if;
            end if;

            -- offline stretch: half value, one payment every 10 minutes
            if g.offline_since is not null then

                if v_cursor < g.offline_since then
                    v_cursor := g.offline_since;
                end if;

                if now() > v_cursor then
                    v_ticks := floor(extract(epoch from (now() - v_cursor)) / 600);

                    if v_ticks > 0 then
                        v_paid := v_paid + v_ticks * (v_income / 2);
                        v_cursor := v_cursor + v_ticks * interval '10 minutes';
                    end if;
                end if;

            end if;

            if v_paid <> 0 then
                update public.faction_treasury as ft
                set credits = ft.credits + v_paid
                where ft.faction = t.faction;
            end if;

            update public.faction_treasury as ft
            set last_income_at = v_cursor
            where ft.faction = t.faction;

        else

            update public.faction_treasury as ft
            set last_income_at = now()
            where ft.faction = t.faction;

        end if;

    end loop;

end;
$function$;


-- ---------------------------------------------------------
-- 4. maintenance / not-started freeze for the world ticks
-- ---------------------------------------------------------

create or replace function public.advance_war()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    s record;
    n integer;
    i integer;
begin

    if auth.uid() is null then return; end if;

    if public.game_frozen() then return; end if;

    for s in
        select w.planet, w.last_tick from public.war_state as w
        where w.winner is null
        for update skip locked
    loop

        perform public.resolve_war_assaults(s.planet);
        perform public.resolve_war_advances(s.planet);

        n := least(floor(extract(epoch from (now() - s.last_tick)) / 45)::integer, 4);

        if n <= 0 then continue; end if;

        update public.war_state set last_tick = now(), tick = tick + n where planet = s.planet;

        for i in 1..n loop
            perform public.run_war_tick(s.planet);
        end loop;

    end loop;

end;
$function$;


create or replace function public.fire_planetary_cannons()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    cannon record;
    target record;
    v_idx integer;
    v_entry jsonb;
    v_amount integer;
    v_size integer;
    v_new jsonb;
begin

    if auth.uid() is null then
        return;
    end if;

    if public.game_frozen() then
        return;
    end if;

    for cannon in
        select cb.city_id, c.planet_id, c.faction
        from public.city_buildings as cb
        join public.cities as c on c.id = cb.city_id
        where cb.building_type = 'planetary_cannon'
          and cb.last_fired_at <= now() - interval '90 seconds'
        for update of cb skip locked
    loop

        -- an enemy fleet in orbit that is not fighting a battle
        select f.id, f.squads
        into target
        from public.fleets as f
        where f.origin = cannon.planet_id
          and f.status = 'stationed'
          and f.faction <> cannon.faction
          and jsonb_array_length(coalesce(f.squads, '[]'::jsonb)) > 0
          and not exists (
              select 1 from public.battles as b
              where b.fleet_id = f.id and b.status = 'active'
          )
        order by random()
        limit 1
        for update of f skip locked;

        if not found then
            continue;
        end if;

        -- the shot is spent whether it hits or not
        update public.city_buildings as cb
        set last_fired_at = now()
        where cb.city_id = cannon.city_id
          and cb.building_type = 'planetary_cannon';

        if random() >= 0.5 then
            continue;
        end if;

        v_idx := floor(random() * jsonb_array_length(target.squads))::integer;
        v_entry := target.squads -> v_idx;
        v_amount := coalesce((v_entry->>'amount')::integer, 1);

        v_size := case v_entry->>'type'
            when 'Rifle' then 1000
            when 'MG' then 750
            when 'Assault' then 1000
            when 'AT' then 600
            when 'Sniper' then 400
            when 'Tank' then 200
            when 'Artillery' then 250
            when 'Krieg' then 1000
            when 'Arstartes' then 100
            else 1000
        end;

        if v_amount <= 1 then

            select coalesce(jsonb_agg(t.e order by t.ord), '[]'::jsonb)
            into v_new
            from jsonb_array_elements(target.squads)
                 with ordinality as t(e, ord)
            where t.ord - 1 <> v_idx;

        else

            select jsonb_agg(
                case
                    when t.ord - 1 = v_idx
                    then
                        (t.e || jsonb_build_object('amount', v_amount - 1))
                        ||
                        case
                            when t.e ? 'soldiers'
                            then jsonb_build_object(
                                'soldiers',
                                greatest(0, (t.e->>'soldiers')::bigint - v_size),
                                'soldiersPerDivision', v_size
                            )
                            else '{}'::jsonb
                        end
                    else t.e
                end
                order by t.ord
            )
            into v_new
            from jsonb_array_elements(target.squads)
                 with ordinality as t(e, ord);

        end if;

        update public.fleets as f
        set squads = v_new
        where f.id = target.id;

        -- a fleet with nothing left is removed when possible
        if jsonb_array_length(v_new) = 0 then
            begin
                delete from public.fleets as f where f.id = target.id;
            exception when others then
                null;
            end;
        end if;

    end loop;

end;
$function$;


create or replace function public.finalize_recruits()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    r record;
    v_squads jsonb;
    v_size integer;
begin

    if auth.uid() is null then
        return;
    end if;

    if public.game_frozen() then
        return;
    end if;

    for r in
        select fr.id, fr.fleet_id, fr.squad_type
        from public.fleet_recruits as fr
        join public.fleets as f on f.id = fr.fleet_id
        where f.player_id = auth.uid()
          and fr.ready_at <= now()
        order by fr.ready_at
        for update of fr
    loop

        select f.squads
        into v_squads
        from public.fleets as f
        where f.id = r.fleet_id
        for update;

        v_squads := coalesce(v_squads, '[]'::jsonb);

        v_size := case r.squad_type
            when 'Rifle' then 1000
            when 'MG' then 750
            when 'Assault' then 1000
            when 'AT' then 600
            when 'Sniper' then 400
            when 'Tank' then 200
            when 'Artillery' then 250
            when 'Krieg' then 1000
            when 'Arstartes' then 100
            when 'Knightmare' then 3
            else 1000
        end;

        if exists (
            select 1
            from jsonb_array_elements(v_squads) as e
            where e->>'type' = r.squad_type
        ) then

            -- Add one division. If the entry came back from a battle
            -- (it has a "soldiers" count), keep that count and add a
            -- full division so damaged units stay damaged.
            select jsonb_agg(
                case
                    when e->>'type' = r.squad_type
                    then
                        (e || jsonb_build_object(
                            'amount', (e->>'amount')::integer + 1
                        )
                           || case when r.squad_type = 'Knightmare'
                                   then jsonb_build_object('born', coalesce(e->'born', '[]'::jsonb) || to_jsonb(now()))
                                   else '{}'::jsonb end)
                        ||
                        case
                            when e ? 'soldiers'
                            then jsonb_build_object(
                                'soldiers', (e->>'soldiers')::bigint + v_size,
                                'soldiersPerDivision', v_size
                            )
                            else '{}'::jsonb
                        end
                    else e
                end
            )
            into v_squads
            from jsonb_array_elements(v_squads) as e;

        else

            v_squads := v_squads || jsonb_build_array(
                jsonb_build_object('type', r.squad_type, 'amount', 1)
                || case when r.squad_type = 'Knightmare'
                        then jsonb_build_object('born', jsonb_build_array(now()))
                        else '{}'::jsonb end
            );

        end if;

        update public.fleets as f
        set squads = v_squads
        where f.id = r.fleet_id;

        delete from public.fleet_recruits as fr
        where fr.id = r.id;

    end loop;

end;
$function$;


create or replace function public.finalize_fleet_arrival(fleet_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
    fleet_status text;
    fleet_arrival timestamptz;
    fleet_destination text;
begin

    -- a fleet does not finish its journey while the game is closed
    if public.game_frozen() then return false; end if;

    select
        status,
        arrival_time,
        destination
    into
        fleet_status,
        fleet_arrival,
        fleet_destination
    from public.fleets
    where id = fleet_id
    for update;

    if fleet_status is null then
        raise exception 'Fleet not found';
    end if;

    if fleet_arrival is null or fleet_arrival > now() then
        return false;
    end if;

    if fleet_status = 'building' then

        update public.fleets
        set
            status = 'stationed',
            arrival_time = null,
            departure_time = null
        where id = fleet_id;

        return true;

    end if;

    if fleet_status = 'travelling' then

        if fleet_destination is null then
            raise exception 'Travelling fleet has no destination';
        end if;

        update public.fleets
        set
            status = 'stationed',
            origin = fleet_destination,
            destination = null,
            departure_time = null,
            arrival_time = null
        where id = fleet_id;

        return true;

    end if;

    return false;

end;
$function$;


create or replace function public.finalize_point_arrival(p_fleet text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
begin
    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    if public.game_frozen() then return false; end if;

    update public.fleets as x set
        status = 'in_space',
        space_x = x.dest_x, space_y = x.dest_y
    where x.id::text = p_fleet and x.status::text = 'cruising'
      and x.arrival_time is not null and x.arrival_time <= now();

    return found;
end;
$function$;


create or replace function public.congress_tick()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    p record;
    st record;
    n integer;
    i integer;
    j integer;
    v_gain bigint := 0;
    v_out jsonb := '[]'::jsonb;
    v_gap interval;
begin
    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        return v_out;
    end if;

    -- maintenance: Congress does not sit
    if public.game_frozen() then
        return v_out;
    end if;

    if not pg_try_advisory_xact_lock(7770003) then
        return v_out;
    end if;

    perform public.cg_seed();

    select * into st from public.cg_state as s where s.id = 1;

    if public.cg_is_fa() then

        v_gap := now() - st.fa_online_at;

        if v_gap > interval '150 seconds' then
            perform public.cg_shift(v_gap - interval '45 seconds');
        end if;

        update public.cg_state as s set fa_online_at = now() where s.id = 1;

    elsif now() - st.fa_online_at > interval '150 seconds' then

        return v_out;      -- no Freedom Authority player is here: Congress is not in session

    end if;

    /* elections and the President's term */
    perform public.cg_run_elections();

    /* introduction -> debate */
    update public.cg_proposals as x set status = 'debate' where x.status = 'introduction' and x.debate_at <= now();

    /* the vote */
    for p in select x.id from public.cg_proposals as x where x.status in ('introduction', 'debate') and x.vote_at <= now() order by x.vote_at loop
        v_out := v_out || jsonb_build_array(public.cg_resolve(p.id));
    end loop;

    perform public.cg_process_occupations();

    select * into st from public.cg_state as s where s.id = 1;

    /* tax revenue every 15 minutes */
    n := least(20, floor(extract(epoch from (now() - st.last_tax_at)) / 900)::integer);

    if n > 0 then
        if st.tax_level > 0 then
            for i in 1..n loop
                for j in 1..st.tax_level loop
                    v_gain := v_gain + 300 + floor(random() * 201)::integer;
                end loop;
            end loop;
            update public.faction_treasury as ft set credits = ft.credits + v_gain where ft.faction = 'Freedom Authority';
            perform public.cg_log('TAXES: ' || v_gain || ' credits collected from the member worlds.');
        end if;
        update public.cg_state as s set last_tax_at = s.last_tax_at + make_interval(secs => n * 900) where s.id = 1;
    end if;

    /* popularity slowly recovers towards 60 */
    n := least(60, floor(extract(epoch from (now() - st.last_turn_at)) / 300)::integer);

    if n > 0 then
        update public.cg_state as s
        set popularity = case when s.popularity < 60 then least(60, s.popularity + 0.5 * n) else s.popularity end,
            last_turn_at = s.last_turn_at + make_interval(secs => n * 300)
        where s.id = 1;
    end if;

    perform public.cg_npc_proposal();

    return v_out;
end;
$function$;


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
begin
    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        return v_out;
    end if;

    -- maintenance: no new battles are picked while the game is closed
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
        where sqrt(((pa_.x - pb_.x) * 1.78) ^ 2 + (pa_.y - pb_.y) ^ 2) < 7
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

        v_out := v_out || jsonb_build_object('id', v_id);
        v_used := v_used || fa.id || fb.id;
    end loop;

    return v_out;
end;
$function$;


-- ---------------------------------------------------------
-- 5. sanity output
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'game_control' and column_name = 'offline_since') as offline_since_column,
    (select count(*) from information_schema.tables
      where table_schema = 'public' and table_name = 'player_presence') as presence_table,
    (select count(*) from information_schema.routines
      where routine_schema = 'public' and routine_name in ('players_online', 'game_frozen')) as helpers;
