-- =========================================================
-- GALACTIC FRONT — stages of friendship, dirty tricks,
-- supply lines and the fog of war
--
-- Run this in the Supabase SQL editor (SQL > New query).
-- Safe to run more than once, and after every other patch.
--
-- What it changes:
--
--   1. THE WORLDS HAVE STAGES. A world's standing with you is no
--      longer just a number: at 25 it is FRIENDLY, at 50 ALLIED,
--      at 75 a SATELLITE, and at 100 it is INTEGRATED — it joins
--      your faction, the same way it always has. The galactic map
--      paints every world more and more in the colour of the side
--      it leans to as the stage deepens.
--
--   2. DIRTY TRICKS. Besides envoys, a faction can ARM THE REBELS
--      (800 credits, ten minutes between attempts) or OVERTHROW THE
--      GOVERNMENT (1500 credits, twenty minutes, and only where you
--      already have friends: 40 or better). Both can fail, and a
--      failed coup is the expensive kind of failure: the world
--      swings to the other faction and will not receive your envoys
--      for half an hour. A successful coup hands you the world
--      whole — integrated, without a shot.
--
--   3. SUPPLY LINES. A world you hold whole no longer pays into
--      your treasury by itself: a line has to be opened to the
--      capital (300 credits, one per world). While the line is
--      open the world's income is delivered; the moment an enemy
--      fleet sits in orbit of the world, in orbit of the capital,
--      or anywhere across the corridor between them, the line is
--      cut and that world pays nothing until the enemy moves.
--      The capital always pays itself.
--
--   4. THE FOG OF WAR. Enemy fleets are only read out to you when
--      one of your own fleets or worlds is within sensor range of
--      them. Beyond that the map shows nothing — that is the fog,
--      not a bug.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the four stages of friendship
-- ---------------------------------------------------------

create or replace function public.diplo_level(p_relation integer)
returns text
language sql
immutable
as $function$
    select case
        when coalesce(p_relation, 0) >= 100 then 'integrated'
        when coalesce(p_relation, 0) >= 75  then 'satellite'
        when coalesce(p_relation, 0) >= 50  then 'allied'
        when coalesce(p_relation, 0) >= 25  then 'friendly'
        else 'neutral'
    end
$function$;


/* how much of the faction's colour the world has taken: 0, .25, .5, .75, 1 */
create or replace function public.diplo_tint(p_relation integer)
returns numeric
language sql
immutable
as $function$
    select case
        when coalesce(p_relation, 0) >= 100 then 1.0
        when coalesce(p_relation, 0) >= 75  then 0.75
        when coalesce(p_relation, 0) >= 50  then 0.50
        when coalesce(p_relation, 0) >= 25  then 0.25
        else 0.0
    end
$function$;


/* the reading the world has to reach for the next stage */
create or replace function public.diplo_next(p_relation integer)
returns integer
language sql
immutable
as $function$
    select case
        when coalesce(p_relation, 0) >= 100 then 100
        when coalesce(p_relation, 0) >= 75  then 100
        when coalesce(p_relation, 0) >= 50  then 75
        when coalesce(p_relation, 0) >= 25  then 50
        else 25
    end
$function$;


-- ---------------------------------------------------------
-- 2. the dirty tricks: arming rebels, overthrowing governments
-- ---------------------------------------------------------

alter table public.planet_diplomacy
    add column if not exists last_armed_at timestamptz;

alter table public.planet_diplomacy
    add column if not exists last_coup_at timestamptz;

/* a crushed coup shuts the world's doors to you for a while */
alter table public.planet_diplomacy
    add column if not exists locked_until timestamptz;


create or replace function public.rebel_price()
returns integer
language sql
immutable
as $function$ select 800 $function$;

create or replace function public.rebel_wait()
returns integer
language sql
immutable
as $function$ select 600 $function$;

create or replace function public.coup_price()
returns integer
language sql
immutable
as $function$ select 1500 $function$;

create or replace function public.coup_wait()
returns integer
language sql
immutable
as $function$ select 1200 $function$;

create or replace function public.coup_lock()
returns integer
language sql
immutable
as $function$ select 1800 $function$;

/* you need friends inside the palace before you can move on it */
create or replace function public.rebel_minimum()
returns integer
language sql
immutable
as $function$ select 10 $function$;

create or replace function public.coup_minimum()
returns integer
language sql
immutable
as $function$ select 40 $function$;


/*
   The one place a faction can lean on a world. p_action is either
   'arm_rebels' or 'overthrow_government'.

   Arm the rebels: a nudge. Success costs the other side 25 and gives
   you 15. Failure is cheap: you lose 10, they gain 15.

   Overthrow the government: the whole world, in one throw. Success
   makes it yours at 100 - integrated, its cities change flag, no
   envoy ever needed. Failure is the blowback: your standing drops to
   nothing, the other faction gains 35, and the world's new
   government refuses your envoys for half an hour.

   Both are rolled honestly on the server; the world is locked while it
   is done so two players cannot both win it at once.
*/
create or replace function public.diplo_strike(p_planet text, p_action text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_other text;
    v_planet_id integer;
    v_price integer;
    v_wait integer;
    v_last timestamptz;
    v_credits numeric;
    v_mine integer;
    v_theirs integer;
    v_odds integer;
    v_roll integer;
    v_success boolean;
    v_annexed boolean := false;
    v_locked timestamptz;
    v_text text;
    d record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if p_action not in ('arm_rebels', 'overthrow_government') then
        raise exception 'Unknown action';
    end if;

    select p.faction into v_faction from public.players as p where p.id = me;
    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine work the worlds';
    end if;

    v_other := case when v_faction = 'Combine' then 'Freedom Authority' else 'Combine' end;

    select p.id into v_planet_id from public.planets as p where p.name = p_planet;
    if v_planet_id is null then raise exception 'There is no world called %', p_planet; end if;

    if exists (select 1 from public.cities as c
               where c.planet_id = v_planet_id
                 and c.faction in ('Freedom Authority', 'Combine')) then
        raise exception '% is not an independent world', p_planet;
    end if;

    /* one attempt at a time per world */
    begin
        select * into d from public.planet_diplomacy as x
        where x.planet = p_planet and x.faction = v_faction
        for update;
    end;

    v_locked := d.locked_until;

    if v_locked is not null and v_locked > now() then
        raise exception 'The court of % will not receive you for another % s', p_planet,
            ceil(extract(epoch from (v_locked - now())))::integer;
    end if;

    v_mine := coalesce(d.relation, 0);

    select coalesce(x.relation, 0) into v_theirs
    from public.planet_diplomacy as x
    where x.planet = p_planet and x.faction = v_other;

    v_theirs := coalesce(v_theirs, 0);

    if p_action = 'arm_rebels' then
        v_price := public.rebel_price();
        v_wait := public.rebel_wait();
        v_last := d.last_armed_at;
        if v_mine < public.rebel_minimum() then
            raise exception 'You need friends in % first: the reading must reach %', p_planet, public.rebel_minimum();
        end if;
    else
        v_price := public.coup_price();
        v_wait := public.coup_wait();
        v_last := d.last_coup_at;
        if v_mine < public.coup_minimum() then
            raise exception 'A coup needs friends inside: the reading must reach %', public.coup_minimum();
        end if;
    end if;

    if v_last is not null and v_last > now() - make_interval(secs => v_wait) then
        raise exception 'That has already been tried in %: wait % s', p_planet,
            ceil(extract(epoch from (v_last + make_interval(secs => v_wait) - now())))::integer;
    end if;

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft where ft.faction = v_faction;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'That costs % credits', v_price;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = v_faction;

    /* the odds are yours against theirs, floored and capped so nothing is a
       certainty in either direction */
    if p_action = 'arm_rebels' then
        v_odds := greatest(15, least(90, 40 + v_mine / 2 - v_theirs / 2));
    else
        v_odds := greatest(10, least(80, 25 + v_mine / 3 - v_theirs / 3));
    end if;

    v_roll := 1 + floor(random() * 100)::integer;
    v_success := v_roll <= v_odds;

    if v_success then

        if p_action = 'arm_rebels' then
            v_mine := least(100, v_mine + 15);
            v_theirs := greatest(0, v_theirs - 25);
            v_text := 'As armas chegaram aos rebeldes de ';
        else
            v_mine := 100;
            v_theirs := 0;
            v_annexed := true;
            v_text := 'O governo de ';
        end if;

    else

        if p_action = 'arm_rebels' then
            v_mine := greatest(0, v_mine - 10);
            v_theirs := least(100, v_theirs + 15);
            v_text := 'As armas foram interceptadas em ';
        else
            v_mine := 0;
            v_theirs := least(100, v_theirs + 35);
            v_locked := now() + make_interval(secs => public.coup_lock());
            v_text := 'O golpe falhou em ';
        end if;

    end if;

    insert into public.planet_diplomacy as x
        (planet, faction, relation, envoys, locked_until,
         last_armed_at, last_coup_at)
    values
        (p_planet, v_faction, v_mine, 0, case when p_action <> 'arm_rebels' then v_locked end,
         case when p_action = 'arm_rebels' then now() end,
         case when p_action = 'overthrow_government' then now() end)
    on conflict (planet, faction) do update
        set relation = excluded.relation,
            locked_until = case when p_action <> 'arm_rebels' then excluded.locked_until
                                else x.locked_until end,
            last_armed_at = coalesce(excluded.last_armed_at, x.last_armed_at),
            last_coup_at = coalesce(excluded.last_coup_at, x.last_coup_at);

    /* the other side's book keeps its own reading of the same world */
    insert into public.planet_diplomacy as x (planet, faction, relation)
    values (p_planet, v_other, v_theirs)
    on conflict (planet, faction) do update
        set relation = v_theirs;

    if v_annexed then

        update public.cities as c set faction = v_faction where c.planet_id = v_planet_id;

        update public.planet_diplomacy as x
        set annexed_at = now()
        where x.planet = p_planet and x.faction = v_faction;

    end if;

    /* both books hear of it: my own side's writer, and the other side's
       defensively, since the Congress's writer predates this patch */
    if v_faction = 'Combine' then
        perform public.cs_log(v_text || p_planet || ': relações '
                              || v_mine || '/100 (' || public.diplo_level(v_mine) || ').'
                              || case when v_annexed then ' O mundo é integrado na União.' else '' end);
        begin
            perform public.cg_log(v_text || p_planet || ': a Freedom Authority fica em '
                                  || v_theirs || '/100 (' || public.diplo_level(v_theirs) || ').'
                                  || case when v_annexed then ' O mundo passa para o Combine.' else '' end);
        exception when others then null;
        end;
    else
        begin
            perform public.cg_log(v_text || p_planet || ': relações '
                                  || v_mine || '/100 (' || public.diplo_level(v_mine) || ').'
                                  || case when v_annexed then ' O mundo é integrado na Autoridade.' else '' end);
        exception when others then null;
        end;
        perform public.cs_log(v_text || p_planet || ': o Combine fica em '
                              || v_theirs || '/100 (' || public.diplo_level(v_theirs) || ').'
                              || case when v_annexed then ' O mundo passa para a Freedom Authority.' else '' end);
    end if;

    return jsonb_build_object(
        'planet', p_planet,
        'action', p_action,
        'success', v_success,
        'roll', v_roll,
        'odds', v_odds,
        'relation', v_mine,
        'level', public.diplo_level(v_mine),
        'tint', public.diplo_tint(v_mine),
        'theirs', v_theirs,
        'theirs_level', public.diplo_level(v_theirs),
        'annexed', v_annexed,
        'locked', v_locked,
        'cost', v_price,
        'credits', coalesce(v_credits, 0) - v_price
    );

end;
$function$;


create or replace function public.arm_rebels(p_planet text)
returns jsonb
language sql
security definer
set search_path to ''
as $function$
    select public.diplo_strike(p_planet, 'arm_rebels')
$function$;


create or replace function public.overthrow_government(p_planet text)
returns jsonb
language sql
security definer
set search_path to ''
as $function$
    select public.diplo_strike(p_planet, 'overthrow_government')
$function$;


-- ---------------------------------------------------------
-- 3. the embassy, now with the stage and the locked door
-- ---------------------------------------------------------

create or replace function public.send_envoy(p_planet text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_planet_id integer;
    v_price integer := public.envoy_price();
    v_wait integer := public.envoy_wait();
    v_credits numeric;
    v_relation integer;
    v_annexed boolean := false;
    v_locked timestamptz;
    d record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;
    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine keep embassies';
    end if;

    select p.id into v_planet_id from public.planets as p where p.name = p_planet;
    if v_planet_id is null then raise exception 'There is no world called %', p_planet; end if;

    if exists (select 1 from public.cities as c
               where c.planet_id = v_planet_id
                 and c.faction in ('Freedom Authority', 'Combine')) then
        raise exception '% is not an independent world', p_planet;
    end if;

    select * into d from public.planet_diplomacy as x
    where x.planet = p_planet and x.faction = v_faction
    for update;

    if d.annexed_at is not null then
        raise exception '% has already signed the pact', p_planet;
    end if;

    /* a crushed coup is remembered at the door */
    v_locked := d.locked_until;

    if v_locked is not null and v_locked > now() then
        raise exception 'The court of % will not receive you for another % s', p_planet,
            ceil(extract(epoch from (v_locked - now())))::integer;
    end if;

    if d.last_envoy_at is not null and d.last_envoy_at > now() - make_interval(secs => v_wait) then
        raise exception 'The court of % will see you again in % s', p_planet,
            ceil(extract(epoch from (d.last_envoy_at + make_interval(secs => v_wait) - now())))::integer;
    end if;

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft where ft.faction = v_faction;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'An embassy costs % credits', v_price;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = v_faction;

    insert into public.planet_diplomacy (planet, faction, relation, envoys, last_envoy_at)
    values (p_planet, v_faction, 10, 1, now())
    on conflict (planet, faction) do update
        set relation = least(100, public.planet_diplomacy.relation + 10),
            envoys = public.planet_diplomacy.envoys + 1,
            last_envoy_at = now();

    select x.relation into v_relation from public.planet_diplomacy as x
    where x.planet = p_planet and x.faction = v_faction;

    if coalesce(v_relation, 0) >= 100 then

        update public.cities as c set faction = v_faction where c.planet_id = v_planet_id;
        update public.planet_diplomacy as x set annexed_at = now()
        where x.planet = p_planet and x.faction = v_faction;

        v_annexed := true;

    end if;

    /* the log is each side's own; the Congress's writer predates this patch,
       so it is called defensively */
    if v_faction = 'Combine' then
        perform public.cs_log('EMBAIXADA: ' || p_planet || ' recebeu enviados do Combine: relações '
                              || coalesce(v_relation, 0) || '/100 (' || public.diplo_level(v_relation) || ').'
                              || case when v_annexed then ' O mundo assina o pacto e entra na União.' else '' end);
    else
        begin
            perform public.cg_log('EMBAIXADA: ' || p_planet || ' recebeu enviados da Freedom Authority: relações '
                                 || coalesce(v_relation, 0) || '/100 (' || public.diplo_level(v_relation) || ').'
                                 || case when v_annexed then ' O mundo assina o pacto e entra na Autoridade.' else '' end);
        exception when others then null;
        end;
    end if;

    return jsonb_build_object(
        'planet', p_planet,
        'relation', coalesce(v_relation, 0),
        'level', public.diplo_level(v_relation),
        'tint', public.diplo_tint(v_relation),
        'next', public.diplo_next(v_relation),
        'annexed', v_annexed,
        'cost', v_price,
        'wait', v_wait,
        'credits', coalesce(v_credits, 0) - v_price
    );

end;
$function$;


-- ---------------------------------------------------------
-- 4. supply lines: the money has to travel
-- ---------------------------------------------------------

create table if not exists public.supply_lines (
    id serial primary key,
    faction text not null,
    planet text not null,
    opened_at timestamptz not null default now(),
    opened_by uuid,
    unique (faction, planet)
);

alter table public.supply_lines enable row level security;


create or replace function public.supply_price()
returns integer
language sql
immutable
as $function$ select 300 $function$;


/* how close an enemy has to sit to a line to cut it, in map units (0-100) */
create or replace function public.supply_corridor()
returns numeric
language sql
immutable
as $function$ select 4.0 $function$;


/* and how close to a world counts as being in its orbit */
create or replace function public.orbit_range()
returns numeric
language sql
immutable
as $function$ select 6.0 $function$;


/* the world a faction's credits are delivered to */
create or replace function public.capital_planet(p_faction text)
returns text
language sql
stable
security definer
set search_path to ''
as $function$
    select coalesce(
        case p_faction
            when 'Combine' then 'Ultramars'
            when 'Freedom Authority' then 'Free Earth'
        end,
        (
            select p.name
            from public.planets as p
            where exists (select 1 from public.cities as c where c.planet_id = p.id)
              and not exists (select 1 from public.cities as c
                              where c.planet_id = p.id and c.faction is distinct from p_faction)
            group by p.name
            order by count(*) desc, p.name
            limit 1
        )
    )
$function$;


/* distance from a point to a segment, in map units */
create or replace function public.point_segment_distance(px numeric, py numeric,
                                                        ax numeric, ay numeric,
                                                        bx numeric, b_y numeric)
returns numeric
language plpgsql
immutable
as $function$
declare
    dx numeric := bx - ax;
    dy numeric := b_y - ay;
    len numeric;
    t numeric;
    cx numeric;
    cy numeric;
begin

    if px is null or py is null or ax is null or ay is null or bx is null or b_y is null then
        return null;
    end if;

    len := dx * dx + dy * dy;

    if len = 0 then
        return sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay));
    end if;

    t := ((px - ax) * dx + (py - ay) * dy) / len;
    t := greatest(0, least(1, t));

    cx := ax + dx * t;
    cy := ay + dy * t;

    return sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));

end;
$function$;


/*
   Where every fleet is, right now: in space where it floats, in orbit
   where it is stationed, and part-way along its course where it is
   flying. Only the position is computed - the rest of the row is the
   fleets table's own.
*/
create or replace function public.fleet_positions()
returns table (id uuid, faction text, name text, status text, origin text, x numeric, y numeric)
language sql
stable
security definer
set search_path to ''
as $function$
    select f.id,
           f.faction,
           f.name,
           f.status::text,
           f.origin,
           coalesce(
               case
                   when f.space_x is not null and coalesce(f.status::text, '') in ('in_space', 'engaged')
                       then f.space_x
                   when coalesce(f.status::text, '') in ('travelling', 'cruising')
                        and f.destination is not null
                        and f.departure_time is not null
                        and f.arrival_time is not null
                        and extract(epoch from (f.arrival_time - f.departure_time)) > 0
                       then o.x + (d.x - o.x) * least(1, greatest(0,
                            extract(epoch from (now() - f.departure_time)) /
                            extract(epoch from (f.arrival_time - f.departure_time))))
                   else o.x
               end,
               o.x) as x,
           coalesce(
               case
                   when f.space_y is not null and coalesce(f.status::text, '') in ('in_space', 'engaged')
                       then f.space_y
                   when coalesce(f.status::text, '') in ('travelling', 'cruising')
                        and f.destination is not null
                        and f.departure_time is not null
                        and f.arrival_time is not null
                        and extract(epoch from (f.arrival_time - f.departure_time)) > 0
                       then o.y + (d.y - o.y) * least(1, greatest(0,
                            extract(epoch from (now() - f.departure_time)) /
                            extract(epoch from (f.arrival_time - f.departure_time))))
                   else o.y
               end,
               o.y) as y
    from public.fleets as f
    left join public.planet_positions as o on o.name = f.origin
    left join public.planet_positions as d on d.name = f.destination
$function$;


/*
   What is sitting on a supply line: an enemy fleet in orbit of the world
   itself, in orbit of the capital, or anywhere across the corridor between
   them. Returns [] when the line is clear.
*/
create or replace function public.supply_blockers(p_faction text, p_planet text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_capital text := public.capital_planet(p_faction);
    ax numeric;
    ay numeric;
    bx numeric;
    b_y numeric;
    v_corridor numeric := public.supply_corridor();
    v_orbit numeric := public.orbit_range();
begin

    select pp.x, pp.y into ax, ay from public.planet_positions as pp where pp.name = p_planet;
    select pp.x, pp.y into bx, b_y from public.planet_positions as pp where pp.name = v_capital;

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
                when sqrt((f.x - ax) * (f.x - ax) + (f.y - ay) * (f.y - ay)) <= v_orbit then 'orbit'
                when sqrt((f.x - bx) * (f.x - bx) + (f.y - b_y) * (f.y - b_y)) <= v_orbit then 'capital'
                when public.point_segment_distance(f.x, f.y, ax, ay, bx, b_y) <= v_corridor then 'corridor'
            end as why
        ) as t
        where f.faction is distinct from p_faction
          and f.x is not null and f.y is not null
          and t.why is not null
    ), '[]'::jsonb);

end;
$function$;


/* the capital pays itself; any other world pays only through an open line */
create or replace function public.supply_line_open(p_faction text, p_planet text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin

    if p_planet is null then return false; end if;

    if p_planet = public.capital_planet(p_faction) then return true; end if;

    if not exists (select 1 from public.supply_lines as s
                   where s.faction = p_faction and s.planet = p_planet) then
        return false;
    end if;

    return jsonb_array_length(public.supply_blockers(p_faction, p_planet)) = 0;

end;
$function$;


/* open a line from one of your worlds to the capital */
create or replace function public.open_supply_line(p_planet text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_price integer := public.supply_price();
    v_credits numeric;
    v_capital text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;
    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine run supply lines';
    end if;

    if not exists (select 1 from public.planets as p where p.name = p_planet) then
        raise exception 'There is no world called %', p_planet;
    end if;

    v_capital := public.capital_planet(v_faction);

    if p_planet = v_capital then
        raise exception '% is the capital: it supplies itself', p_planet;
    end if;

    if exists (select 1 from public.cities as c
               join public.planets as p on p.id = c.planet_id
               where p.name = p_planet and c.faction is distinct from v_faction) then
        raise exception 'You do not hold % whole', p_planet;
    end if;

    if not exists (select 1 from public.cities as c
                   join public.planets as p on p.id = c.planet_id
                   where p.name = p_planet) then
        raise exception '% has no cities to supply', p_planet;
    end if;

    if exists (select 1 from public.supply_lines as s
               where s.faction = v_faction and s.planet = p_planet) then
        raise exception 'A line to % is already open', p_planet;
    end if;

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft where ft.faction = v_faction;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'A supply line costs % credits', v_price;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = v_faction;

    insert into public.supply_lines (faction, planet, opened_by)
    values (v_faction, p_planet, me);

    if v_faction = 'Combine' then
        perform public.cs_log('ABASTECIMENTO: linha aberta de ' || p_planet || ' até ' || v_capital || '.');
    else
        begin
            perform public.cg_log('ABASTECIMENTO: linha aberta de ' || p_planet || ' até ' || v_capital || '.');
        exception when others then null;
        end;
    end if;

    return jsonb_build_object(
        'planet', p_planet,
        'capital', v_capital,
        'cost', v_price,
        'credits', coalesce(v_credits, 0) - v_price,
        'blockers', public.supply_blockers(v_faction, p_planet)
    );

end;
$function$;


/* abandon a line: no refund, it simply stops carrying */
create or replace function public.close_supply_line(p_planet text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_gone integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;
    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine run supply lines';
    end if;

    delete from public.supply_lines as s
    where s.faction = v_faction and s.planet = p_planet;

    get diagnostics v_gone = row_count;

    if v_gone = 0 then raise exception 'There is no line to %', p_planet; end if;

    return jsonb_build_object('planet', p_planet, 'closed', true);

end;
$function$;


/* everything the supply screen shows, and the map draws */
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
    v_capital text;
    v_credits numeric;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    v_capital := public.capital_planet(v_faction);

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft where ft.faction = v_faction;

    return jsonb_build_object(
        'me', v_faction,
        'capital', v_capital,
        'credits', coalesce(v_credits, 0),
        'price', public.supply_price(),
        'corridor', public.supply_corridor(),
        'orbit', public.orbit_range(),

        /* every world we hold whole, with what its line is doing */
        'worlds', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'planet', w.name,
                       'income', w.income,
                       'x', w.x,
                       'y', w.y,
                       'capital', w.name = v_capital,
                       'line', exists (select 1 from public.supply_lines as s
                                       where s.faction = v_faction and s.planet = w.name),
                       'open', public.supply_line_open(v_faction, w.name),
                       'paid', case when public.supply_line_open(v_faction, w.name) then w.income else 0 end,
                       'blockers', public.supply_blockers(v_faction, w.name)
                   ) order by (w.name <> v_capital), w.name)
            from (
                select p.name,
                       public.planet_income(p.name) as income,
                       pp.x,
                       pp.y
                from public.planets as p
                left join public.planet_positions as pp on pp.name = p.name
                where exists (select 1 from public.cities as c where c.planet_id = p.id)
                  and not exists (select 1 from public.cities as c
                                  where c.planet_id = p.id and c.faction is distinct from v_faction)
            ) as w
        ), '[]'::jsonb)

    );

end;
$function$;


/*
   What one world pays in a single payment: its own income plus 100 for
   every civilian factory standing on it.
*/
create or replace function public.planet_income(p_planet text)
returns bigint
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_income bigint;
begin

    select coalesce(p.income + 100 * (
               select count(*)
               from public.city_buildings as cb
               join public.cities as cc on cc.id = cb.city_id
               where cc.planet_id = p.id
                 and cb.building_type = 'civilian_factory'
           ), 0)
    into v_income
    from public.planets as p
    where p.name = p_planet;

    return coalesce(v_income, 0);

end;
$function$;


-- ---------------------------------------------------------
-- 5. the income now travels the line
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

            /* only the worlds whose line reaches the capital pay */
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
              )
              and public.supply_line_open(t.faction, p.name);

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
-- 6. the fog of war: what your sensors can actually see
-- ---------------------------------------------------------

create or replace function public.sensor_fleet_range()
returns numeric
language sql
immutable
as $function$ select 12.0 $function$;

create or replace function public.sensor_world_range()
returns numeric
language sql
immutable
as $function$ select 10.0 $function$;


/*
   The enemy fleets you are allowed to see, as whole fleet rows (so the map
   can draw them exactly like its own), each with the position it is at.
   A fleet of the other faction is seen only when one of your fleets or one
   of your worlds is within sensor range of it; everything else is fog.
   Your own fleets are not this function's business - the map already has
   them - and are not returned.
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
    anchors as (
        select pos.x, pos.y
        from public.fleet_positions() as pos
        cross join me
        where pos.faction = me.faction
          and pos.x is not null
        union all
        select pp.x, pp.y
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
    where exists (
        select 1 from anchors as a
        where sqrt((a.x - e.x) * (a.x - e.x) + (a.y - e.y) * (a.y - e.y))
              <= public.sensor_fleet_range()
    )
$function$;


-- ---------------------------------------------------------
-- 7. the diplomacy screen, with the stages and the tricks
-- ---------------------------------------------------------

create or replace function public.diplomacy_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_other text;
    v_credits numeric;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    v_other := case when v_faction = 'Combine' then 'Freedom Authority'
                    when v_faction = 'Freedom Authority' then 'Combine'
                    else null end;

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft where ft.faction = v_faction;

    return jsonb_build_object(

        'now', now(),
        'me', v_faction,
        'other', v_other,
        'credits', coalesce(v_credits, 0),
        'cost', public.envoy_price(),
        'wait', public.envoy_wait(),
        'relations', public.relations_reading(),

        'prices', jsonb_build_object(
            'envoy', public.envoy_price(),
            'rebel', public.rebel_price(),
            'coup', public.coup_price()
        ),
        'waits', jsonb_build_object(
            'envoy', public.envoy_wait(),
            'rebel', public.rebel_wait(),
            'coup', public.coup_wait(),
            'lock', public.coup_lock()
        ),
        'minimums', jsonb_build_object(
            'rebel', public.rebel_minimum(),
            'coup', public.coup_minimum()
        ),

        'planets', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'planet', t.name,
                       'cities', t.cities,
                       'relation', coalesce(d.relation, 0),
                       'level', public.diplo_level(d.relation),
                       'tint', public.diplo_tint(d.relation),
                       'next', public.diplo_next(d.relation),
                       'envoys', coalesce(d.envoys, 0),
                       'wait', case
                           when d.last_envoy_at is null then 0
                           else greatest(0, ceil(extract(epoch from
                                  (d.last_envoy_at + make_interval(secs => public.envoy_wait()) - now())))::integer)
                       end,
                       'theirs', coalesce(o.relation, 0),
                       'theirs_level', public.diplo_level(o.relation),
                       'patron', case
                           when coalesce(d.relation, 0) > coalesce(o.relation, 0) then 'me'
                           when coalesce(o.relation, 0) > coalesce(d.relation, 0) then 'them'
                           else ''
                       end,
                       'leaned', greatest(public.diplo_tint(d.relation), public.diplo_tint(o.relation)),
                       'locked', greatest(0, coalesce(ceil(extract(epoch from
                                     (d.locked_until - now())))::integer, 0)),
                       'armed', greatest(0, coalesce(ceil(extract(epoch from
                                     (d.last_armed_at + make_interval(secs => public.rebel_wait()) - now())))::integer, 0)),
                       'couped', greatest(0, coalesce(ceil(extract(epoch from
                                     (d.last_coup_at + make_interval(secs => public.coup_wait()) - now())))::integer, 0)),
                       'rebel_odds', greatest(15, least(90, 40 + coalesce(d.relation, 0) / 2 - coalesce(o.relation, 0) / 2)),
                       'coup_odds', greatest(10, least(80, 25 + coalesce(d.relation, 0) / 3 - coalesce(o.relation, 0) / 3))
                   ) order by coalesce(d.relation, 0) desc, t.name)
            from (
                select p.name, count(*)::integer as cities
                from public.planets as p
                join public.cities as c on c.planet_id = p.id
                where not exists (select 1 from public.cities as c2
                                  where c2.planet_id = p.id
                                    and c2.faction in ('Freedom Authority', 'Combine'))
                group by p.name
            ) as t
            left join public.planet_diplomacy as d
                   on d.planet = t.name and d.faction = v_faction
            left join public.planet_diplomacy as o
                   on o.planet = t.name and o.faction = v_other
        ), '[]'::jsonb)

    );

end;
$function$;


-- ---------------------------------------------------------
-- 8. the reset button clears all of it
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

    /* the embassies, the ceasefires, the supply lines and the presence list */
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
        and routine_name in ('diplo_level', 'diplo_tint', 'diplo_next', 'diplo_strike',
                             'arm_rebels', 'overthrow_government', 'supply_blockers',
                             'supply_line_open', 'open_supply_line', 'close_supply_line',
                             'supply_state', 'planet_income', 'fleet_positions',
                             'visible_enemy_fleets', 'capital_planet')) as new_functions,
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'planet_diplomacy'
        and column_name in ('last_armed_at', 'last_coup_at', 'locked_until')) as trick_columns,
    (select count(*) from information_schema.tables
      where table_schema = 'public' and table_name = 'supply_lines') as supply_table,
    (select count(*) from pg_proc as f
       join pg_namespace as n on n.oid = f.pronamespace
      where n.nspname = 'public' and f.proname = 'collect_faction_income') as income_rewritten;
