-- =========================================================
-- GALACTIC FRONT — the supply network runs itself
--
-- Run this in the Supabase SQL editor (SQL > New query).
-- Safe to run more than once, and after every other patch.
--
-- WHAT CHANGES
--
--   The player no longer opens or closes supply lines. Each
--   world you hold whole feeds the NEAREST world you also hold
--   whole that is closer to the capital, and the capital feeds
--   nobody — so the lines form a tree that runs inward, world
--   by world, the way a real supply net would.
--
--   A link is cut the moment an enemy fleet sits in orbit of
--   either end of it, or anywhere across the short corridor
--   between them. A world is supplied only if every link on
--   its own path back to the capital is clear: a cut near the
--   capital starves everything behind it as well, which is the
--   point of a corridor.
--
--   Nothing is bought and nothing is clicked: the network
--   re-reads itself on every income payment and on every look
--   at the map, and it is right again the moment the enemy
--   moves on.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the manual lines are gone
-- ---------------------------------------------------------

drop function if exists public.open_supply_line(text);
drop function if exists public.close_supply_line(text);
drop table if exists public.supply_lines;


-- ---------------------------------------------------------
-- 2. what is sitting on one link of the network
-- ---------------------------------------------------------

create or replace function public.supply_segment_blockers(p_faction text,
                                                          ax numeric, ay numeric,
                                                          bx numeric, b_y numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_orbit numeric := public.orbit_range();
    v_corridor numeric := public.supply_corridor();
begin

    if ax is null or ay is null or bx is null or b_y is null then return '[]'::jsonb; end if;

    return coalesce((
        select jsonb_agg(jsonb_build_object(
                   'fleet', f.id,
                   'name', f.name,
                   'faction', f.faction,
                   'x', f.x,
                   'y', f.y,
                   'why', t.why
               ) order by f.name)
        from public.fleet_positions() as f
        cross join lateral (
            select case
                when sqrt(power(f.x - ax, 2) + power(f.y - ay, 2)) <= v_orbit then 'orbit'
                when sqrt(power(f.x - bx, 2) + power(f.y - b_y, 2)) <= v_orbit then 'hub'
                when public.point_segment_distance(f.x, f.y, ax, ay, bx, b_y) <= v_corridor then 'corridor'
            end as why
        ) as t
        where f.faction is distinct from p_faction
          and f.x is not null
          and f.y is not null
          and t.why is not null
    ), '[]'::jsonb);

end;
$function$;


-- ---------------------------------------------------------
-- 3. the network itself: every world's place in the tree
-- ---------------------------------------------------------

/*
   For one faction, every world it holds whole, joined into a tree that runs
   to the capital: each world's parent is the nearest world of ours that is
   strictly closer to the capital. Processing in order of that distance means
   a parent is always settled before its children, so "supplied" can simply
   be carried down the branches.
*/
create or replace function public.supply_network(p_faction text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_capital text := public.capital_planet(p_faction);
    w record;
    v_worlds jsonb := '[]'::jsonb;
    v_links jsonb := '[]'::jsonb;
    v_open text[] := array[]::text[];
    v_own boolean;
    v_ok boolean;
    v_block jsonb;
    v_total bigint := 0;
    v_depth integer;
    v_depths jsonb := '{}'::jsonb;
begin

    for w in
        with cap as (
            select pp.x, pp.y from public.planet_positions as pp where pp.name = v_capital
        ),
        owned as (
            select p.name,
                   pp.x,
                   pp.y,
                   public.planet_income(p.name) as income,
                   case
                       when pp.x is not null and pp.y is not null and cap.x is not null
                           then sqrt(power(pp.x - cap.x, 2) + power(pp.y - cap.y, 2))
                       else 1000000
                   end as dcap
            from public.planets as p
            left join public.planet_positions as pp on pp.name = p.name
            cross join cap
            where exists (select 1 from public.cities as c where c.planet_id = p.id)
              and not exists (select 1 from public.cities as c
                              where c.planet_id = p.id and c.faction is distinct from p_faction)
        )
        select o.name, o.x, o.y, o.income, o.dcap, o.capital,
               par.name as parent, par.x as px, par.y as py
        from (
            select o0.*, (o0.name = v_capital) as capital from owned as o0
        ) as o
        left join lateral (
            select o2.name, o2.x, o2.y
            from owned as o2
            where o2.name <> o.name
              and o2.dcap < o.dcap
            order by sqrt(power(o2.x - o.x, 2) + power(o2.y - o.y, 2)), o2.name
            limit 1
        ) as par on true
        order by o.dcap, o.name
    loop

        if w.capital or w.parent is null then

            v_own := true;
            v_block := '[]'::jsonb;
            v_ok := true;

        else

            v_block := public.supply_segment_blockers(p_faction, w.x, w.y, w.px, w.py);
            v_own := jsonb_array_length(v_block) = 0;

            /* supplied only if its own link is clear AND the world it feeds
               through is supplied too */
            v_ok := v_own and (w.parent = any (v_open));

        end if;

        if v_ok then
            v_open := v_open || w.name;
            v_total := v_total + coalesce(w.income, 0);
        end if;

        v_depth := case
                       when w.capital or w.parent is null then 0
                       else coalesce((v_depths ->> w.parent)::integer, 0) + 1
                   end;

        v_depths := jsonb_set(v_depths, array[w.name], to_jsonb(v_depth), true);

        v_worlds := v_worlds || jsonb_build_object(
            'planet', w.name,
            'parent', w.parent,
            'x', w.x,
            'y', w.y,
            'income', coalesce(w.income, 0),
            'capital', w.capital,
            'depth', v_depth,
            'own', v_own,
            'open', v_ok,
            'blockers', coalesce(v_block, '[]'::jsonb)
        );

        if w.parent is not null and not w.capital then
            v_links := v_links || jsonb_build_object(
                'from', w.name,
                'to', w.parent,
                'x1', w.x,
                'y1', w.y,
                'x2', w.px,
                'y2', w.py,
                'open', v_ok,
                'own', v_own
            );
        end if;

    end loop;

    return jsonb_build_object(
        'faction', p_faction,
        'capital', v_capital,
        'total', v_total,
        'worlds', v_worlds,
        'links', v_links
    );

end;
$function$;


-- a single world's reading, for anything that only wants one answer
create or replace function public.supply_line_open(p_faction text, p_planet text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
    select coalesce((
        select (w ->> 'open')::boolean
        from jsonb_array_elements(public.supply_network(p_faction) -> 'worlds') as w
        where w ->> 'planet' = p_planet
    ), false)
$function$;


create or replace function public.supply_blockers(p_faction text, p_planet text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
    select coalesce((
        select w -> 'blockers'
        from jsonb_array_elements(public.supply_network(p_faction) -> 'worlds') as w
        where w ->> 'planet' = p_planet
    ), '[]'::jsonb)
$function$;


-- ---------------------------------------------------------
-- 4. the screen: the whole net in one reading
-- ---------------------------------------------------------

create or replace function public.supply_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_credits numeric;
    n jsonb;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft where ft.faction = v_faction;

    n := public.supply_network(v_faction);

    return jsonb_build_object(
        'me', v_faction,
        'capital', n -> 'capital',
        'credits', coalesce(v_credits, 0),
        'corridor', public.supply_corridor(),
        'orbit', public.orbit_range(),
        'total', n -> 'total',
        'worlds', n -> 'worlds',
        'links', n -> 'links'
    );

end;
$function$;


-- ---------------------------------------------------------
-- 5. the income follows the network
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
    v_reduced_end timestamptz;
    v_dead_from timestamptz;
    v_touch timestamptz;
    v_ticks bigint;
    v_paid bigint;
    v_bonus bigint;
begin

    /* no game.bypass here: income must obey the same guards as the rest of
       the world, and it simply does nothing while the game is frozen */
    select * into g from public.game_control as x where x.id = 1;

    -- maintenance or not started: the world is frozen, nothing accrues
    if g.started is not true or g.maintenance is true then
        return;
    end if;

    /* the rhythm follows the last hand on the game, not the open windows */
    v_touch := public.last_touch();

    /* a trading truce between the two main factions pays both books 10% more */
    v_bonus := case when public.truce_active() then 10 else 0 end;

    for t in
        select faction, last_income_at
        from public.faction_treasury
        for update
    loop

        v_income := 0;
        v_paid := 0;

        if t.last_income_at is not null then

            v_cursor := t.last_income_at;

            /* whatever the network is carrying to the capital right now */
            select coalesce(sum((w ->> 'income')::numeric), 0)
            into v_income
            from jsonb_array_elements(public.supply_network(t.faction) -> 'worlds') as w
            where (w ->> 'open')::boolean;

            if v_touch is null then

                /* nobody has ever touched the game in this run: keep the old
                   reading, which only knows about the world being paused */
                v_online_end := least(now(), coalesce(g.offline_since, now()));
                v_reduced_end := now();
                v_dead_from := null;

            else

                /* full value until ten minutes after the last touch (and never
                   past the moment the world was paused because everybody had
                   gone), half value until two hours after it, nothing beyond */
                v_online_end := least(now(),
                                      coalesce(g.offline_since, now()),
                                      v_touch + interval '10 minutes');
                v_dead_from := v_touch + interval '2 hours';
                v_reduced_end := least(now(), v_dead_from);

            end if;

            -- online stretch: full value, one payment every 5 minutes
            if v_online_end > v_cursor then

                v_ticks := floor(extract(epoch from (v_online_end - v_cursor)) / 300);

                if v_ticks > 0 then
                    v_paid := v_paid + v_ticks * v_income;
                    v_cursor := v_cursor + v_ticks * interval '5 minutes';
                end if;

            end if;

            -- offline stretch: half value, one payment every 10 minutes
            if v_reduced_end > v_cursor then

                v_ticks := floor(extract(epoch from (v_reduced_end - v_cursor)) / 600);

                if v_ticks > 0 then
                    v_paid := v_paid + v_ticks * (v_income / 2);
                    v_cursor := v_cursor + v_ticks * interval '10 minutes';
                end if;

            end if;

            /*
               Two hours without a touch: the coffers are shut. Whatever is
               left between the two-hour mark and now is not owed, and it is
               not paid back when somebody finally walks in - the clock simply
               starts again from now.
            */
            if v_dead_from is not null and now() > v_dead_from then
                v_cursor := now();
            end if;

            if v_bonus > 0 and v_paid > 0 then
                v_paid := v_paid + (v_paid * v_bonus / 100);
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
-- 6. the reset button
-- ---------------------------------------------------------

create or replace function public.game_reset_extras()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    g record;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    select * into g from public.game_control as x where x.id = 1;

    if g.host_player is distinct from auth.uid() then
        raise exception 'Only the host may reset the game';
    end if;

    perform set_config('game.bypass', '1', true);

    /* the Soviet's books */
    delete from public.cs_directives;
    delete from public.cs_votes;
    delete from public.cs_debate_sides;
    delete from public.cs_debate_standing;
    delete from public.cs_privileges;
    delete from public.cs_candidates;
    delete from public.cs_election_votes;
    delete from public.cs_election;
    delete from public.cs_authorizations;
    delete from public.cs_membership;
    delete from public.cs_log;
    delete from public.cs_occupations;
    delete from public.cs_agitprop;

    /* the commissars stay (they are the chamber), but a fresh game finds
       them with their loyalty where their current starts and nobody in
       disgrace */
    begin
        update public.cs_commissars as m
        set loyalty = coalesce((select c.loyalty from public.cs_currents as c where c.id = m.current_id), 55),
            is_disgraced = false,
            active = true;
    exception when undefined_column or undefined_table then null;
    end;

    update public.cs_state as s
    set confidence = 55,
        quota = 1,
        relations = '{"Freedom Authority": -20}'::jsonb,
        secretary_player = null,
        secretary_name = null,
        secretary_current = null,
        term_no = 0,
        term_end = null,
        veto_used = false,
        online_at = null,
        last_npc_at = null,
        last_quota_at = null,
        last_debate_at = null,
        last_election_at = null
    where s.id = 1;

    /* the embassies, the ceasefires and the presence list; the supply lines
       need no wiping any more, they follow the worlds themselves */
    delete from public.planet_diplomacy;
    delete from public.player_presence;

    begin
        delete from public.ceasefires;
    exception when undefined_table then null;
    end;

    begin
        delete from public.supply_lines;
    exception when undefined_table then null;
    end;

    /* the Freedom Authority's elected head, if the column is where this
       patch expects it (the Congress's own reset is not ours to change) */
    begin
        update public.cg_state as s
        set president_player = null,
            term_no = 0,
            term_end = null
        where s.id = 1;
    exception when undefined_column or undefined_table then null;
    end;

    return jsonb_build_object('ok', true);

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('supply_network', 'supply_segment_blockers',
                             'supply_line_open', 'supply_blockers', 'supply_state')) as network_functions,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('open_supply_line', 'close_supply_line')) as manual_functions_left,
    (select count(*) from information_schema.tables
      where table_schema = 'public' and table_name = 'supply_lines') as manual_table_left;
