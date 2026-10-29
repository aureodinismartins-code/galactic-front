-- =========================================================
-- GALACTIC FRONT — THE SETTLEMENTS AND THE TRANSPORTS
--
-- Run AFTER sql/2026-11-26_the_tusken_world.sql, in the
-- Supabase SQL editor (SQL > New query). Safe to run more
-- than once, and after every other patch.
--
-- WHAT THIS CHANGES
--
--   Tuskara was never a three-city world, and it is not a
--   three-colony one either: what stands on the dust are
--   SETTLEMENTS, small and spread out. A faction may now
--   raise up to eight of them, each in its own place on the
--   globe.
--
--   Two gates on settling:
--     ORBIT     one of the faction's fleets must be stationed
--               in the orbit of Tuskara — the bands will not
--               walk out of the desert for a ship that is not
--               there
--     COOLDOWN  the bands need a pause between two foundings,
--               so a faction cannot plant all eight in a row
--
--   Transports are permanent. 350 credits buys a hull once;
--   it takes up to 2,500 Tusken, lands them, and is ready for
--   the next load. A trip costs nothing — the ship was the
--   purchase. A ship is busy only while it is at sea.
--
--   1,000 Tusken at work on a world now pay that world 1
--   credit (it used to take 10,000).
--
--   Everything here is wiped by the host's RESET button.
-- =========================================================


-- ---------------------------------------------------------
-- 1. a place for every settlement, and hulls that stay
-- ---------------------------------------------------------

alter table public.tusken_colonies
    add column if not exists spot int not null default 0;

/* colonies that predate the spots take the first free places, so two
   settlements never stand on top of each other */
with ranked as (
    select col.id, row_number() over (order by col.id) as rn
    from public.tusken_colonies as col
    where col.spot = 0
)
update public.tusken_colonies as col
set spot = ranked.rn
from ranked
where col.id = ranked.id;


/* one row per hull, owned by the faction, never sold back */
create table if not exists public.tusken_ships (
    id bigserial primary key,
    faction text not null,
    player_id uuid,
    name text,
    capacity bigint not null default 2500 check (capacity > 0),
    bought_at timestamptz not null default now()
);

alter table public.tusken_ships enable row level security;

create index if not exists tusken_ships_owner on public.tusken_ships (faction);
create index if not exists tusken_colonies_spot on public.tusken_colonies (planet, spot);

/* which hull is at sea with which load */
alter table public.tusken_convoys
    add column if not exists ship_id bigint;


-- ---------------------------------------------------------
-- 2. the numbers, in one place
-- ---------------------------------------------------------

/* small settlements, many of them: eight per faction, sixteen places */
create or replace function public.tusken_max_colonies()
returns integer
language sql
immutable
as $function$
    select 8
$function$;


create or replace function public.tusken_spot_count()
returns integer
language sql
immutable
as $function$
    select 16
$function$;


/* 1,000 at work on a world pay it 1 credit */
create or replace function public.tusken_slaves_per_credit()
returns bigint
language sql
immutable
as $function$
    select 1000::bigint
$function$;


/* how long the bands need between two foundings, in seconds */
create or replace function public.tusken_colony_cooldown()
returns integer
language sql
immutable
as $function$
    select 300
$function$;


/* where each settlement stands on the globe, in percent */
create or replace function public.tusken_spot_x(p_spot int)
returns numeric
language sql
immutable
as $function$
    select (array[22, 50, 76, 34, 62, 88, 16, 44,
                  70, 28, 56, 84, 12, 48, 74, 38])
           [greatest(1, least(16, p_spot))]::numeric
$function$;


create or replace function public.tusken_spot_y(p_spot int)
returns numeric
language sql
immutable
as $function$
    select (array[24, 18, 28, 42, 44, 50, 56, 60,
                  60, 76, 80, 72, 36, 32, 84, 88])
           [greatest(1, least(16, p_spot))]::numeric
$function$;


create or replace function public.tusken_colony_name(p_index int)
returns text
language sql
immutable
as $function$
    select (array['Red Hollow', 'Bleached Flats', 'The Bone Yard', 'Dry Verge',
                  'Salt Pan', 'Ash Reach', 'Kettle Row', 'The Long Dune',
                  'Grey Sink', 'Worm Gate', 'Bitumen Stair', 'The Dry Well',
                  'Cinder Flat', 'Last Water', 'The Ribs', 'Hollow Crown'])
           [greatest(1, least(16, p_index))]
$function$;


/* the first place on the planet no settlement has taken yet */
create or replace function public.tusken_next_spot(p_planet text)
returns integer
language sql
stable
security definer
set search_path to ''
as $function$
    select s.i
    from generate_series(1, public.tusken_spot_count()) as s(i)
    where not exists (
        select 1
        from public.tusken_colonies as col
        where col.planet = p_planet and col.spot = s.i
    )
    order by s.i
    limit 1
$function$;


/* seconds still to wait before this faction may settle again */
create or replace function public.tusken_colony_wait(p_faction text)
returns integer
language sql
stable
security definer
set search_path to ''
as $function$
    select greatest(0, ceil(extract(epoch from (
        coalesce(max(col.founded_at), to_timestamp(0))
            + make_interval(secs => public.tusken_colony_cooldown())
            - now()
    ))))::integer
    from public.tusken_colonies as col
    where col.faction = p_faction
$function$;


/* ---------------------------------------------------------
   Which fleet of this faction is in the orbit of Tuskara.

   A fleet is in orbit when it is stationed and its place on
   the map is within orbit_range() of the world. Returns the
   fleet's name, or null.
   --------------------------------------------------------- */
create or replace function public.tusken_orbit_fleet(p_faction text)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_x numeric;
    v_y numeric;
    v_range numeric := 6;
    v_name text;
begin

    select pp.x, pp.y into v_x, v_y
    from public.planet_positions as pp
    where pp.name = 'Tuskara';

    if v_x is null or v_y is null then
        return null;
    end if;

    begin
        v_range := public.orbit_range();
    exception when undefined_function then
        v_range := 6;
    end;

    begin
        select f.name into v_name
        from public.fleet_positions() as f
        where f.faction = p_faction
          and f.status = 'stationed'
          and f.x is not null
          and f.y is not null
          and sqrt(power(f.x - v_x, 2) + power(f.y - v_y, 2)) <= v_range
        order by f.name
        limit 1;
    exception when undefined_table or undefined_function then
        /* an install without fleets cannot keep an orbit: nobody settles */
        v_name := null;
    end;

    return v_name;

end;
$function$;


-- ---------------------------------------------------------
-- 3. the screen
-- ---------------------------------------------------------

create or replace function public.tusken_world()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_credits numeric;
    v_pool bigint;
    v_count integer;
    v_orbit text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null then
        raise exception 'This account is not part of the war';
    end if;

    perform public.tusken_tick();

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft
    where ft.faction = v_faction;

    select coalesce(sum(col.slaves), 0), count(*)
    into v_pool, v_count
    from public.tusken_colonies as col
    where col.faction = v_faction and col.planet = 'Tuskara';

    v_orbit := public.tusken_orbit_fleet(v_faction);

    return jsonb_build_object(
        'me', v_faction,
        'planet', 'Tuskara',
        'credits', coalesce(v_credits, 0),
        'pool', coalesce(v_pool, 0),
        'my_colonies', coalesce(v_count, 0),
        'max_colonies', public.tusken_max_colonies(),

        /* the fleet that lets the bands walk out of the desert */
        'orbit', jsonb_build_object(
            'here', v_orbit is not null,
            'fleet', v_orbit
        ),

        /* seconds before another settlement may be raised */
        'cooldown', public.tusken_colony_wait(v_faction),

        'prices', jsonb_build_object(
            'colony', public.tusken_colony_price(v_faction),
            'ship', public.tusken_ship_price(),
            'capacity', public.tusken_ship_capacity(),
            'per_credit', public.tusken_slaves_per_credit(),
            'cooldown', public.tusken_colony_cooldown()
        ),

        /* every settlement on the dust, ours first */
        'colonies', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', col.id,
                       'name', col.name,
                       'faction', col.faction,
                       'mine', col.faction = v_faction,
                       'spot', col.spot,
                       'x', public.tusken_spot_x(col.spot),
                       'y', public.tusken_spot_y(col.spot),
                       'size', col.size,
                       'catch', col.catch_level,
                       'hold', col.hold_level,
                       'slaves', col.slaves,
                       'capacity', public.tusken_capacity(col.size, col.hold_level),
                       'per_hour', public.tusken_yield_per_hour(col.size, col.catch_level),
                       'size_cost', case when col.size >= 5 then null
                                         else public.tusken_upgrade_price('size', col.size) end,
                       'catch_cost', case when col.catch_level >= 5 then null
                                          else public.tusken_upgrade_price('catch', col.catch_level) end,
                       'hold_cost', case when col.hold_level >= 5 then null
                                         else public.tusken_upgrade_price('hold', col.hold_level) end
                   ) order by (col.faction <> v_faction), col.spot, col.id)
            from public.tusken_colonies as col
            where col.planet = 'Tuskara'
        ), '[]'::jsonb),

        /* the hulls this faction owns, and which are at sea */
        'ships', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', s.id,
                       'name', s.name,
                       'capacity', s.capacity,
                       'at_sea', k.id is not null,
                       'to', k.to_planet,
                       'seconds', case when k.id is null then 0
                                       else greatest(0, ceil(extract(epoch from (k.arrival_at - now())))::integer)
                                   end
                   ) order by s.id)
            from public.tusken_ships as s
            left join public.tusken_convoys as k on k.ship_id = s.id
            where s.faction = v_faction
        ), '[]'::jsonb),

        'idle_ships', (
            select count(*)
            from public.tusken_ships as s
            where s.faction = v_faction
              and not exists (select 1 from public.tusken_convoys as k where k.ship_id = s.id)
        ),

        /* the slaves we already have at work, and what they pay */
        'workforce', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'planet', w.planet,
                       'amount', w.amount,
                       'bonus', w.amount / public.tusken_slaves_per_credit()
                   ) order by (w.amount / public.tusken_slaves_per_credit()) desc, w.planet)
            from public.tusken_workforce as w
            where w.faction = v_faction and w.amount > 0
        ), '[]'::jsonb),

        /* where a load can be landed: the worlds we hold whole */
        'destinations', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'planet', p.name,
                       'x', pp.x,
                       'y', pp.y,
                       'income', public.planet_income(p.name),
                       'slaves', coalesce((
                           select w.amount from public.tusken_workforce as w
                           where w.planet = p.name and w.faction = v_faction
                       ), 0),
                       'seconds', public.tusken_road_seconds('Tuskara', p.name)
                   ) order by p.name)
            from public.planets as p
            left join public.planet_positions as pp on pp.name = p.name
            where p.name <> 'Tuskara'
              and exists (select 1 from public.cities as c where c.planet_id = p.id)
              and not exists (select 1 from public.cities as c
                              where c.planet_id = p.id and c.faction is distinct from v_faction)
        ), '[]'::jsonb),

        /* ships at sea with our Tusken aboard */
        'convoys', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', k.id,
                       'from', k.from_planet,
                       'to', k.to_planet,
                       'amount', k.amount,
                       'ship', s.name,
                       'arrival', k.arrival_at,
                       'seconds', greatest(0, ceil(extract(epoch from (k.arrival_at - now())))::integer)
                   ) order by k.arrival_at)
            from public.tusken_convoys as k
            left join public.tusken_ships as s on s.id = k.ship_id
            where k.faction = v_faction
        ), '[]'::jsonb)

    );

end;
$function$;


-- ---------------------------------------------------------
-- 4. raising a settlement
-- ---------------------------------------------------------

create or replace function public.tusken_found_colony()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_credits numeric;
    v_count integer;
    v_price integer;
    v_name text;
    v_spot integer;
    v_wait integer;
    v_orbit text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine settle Tuskara';
    end if;

    perform public.tusken_tick();

    /* the bands will not walk out of the desert for a ship that is not there */
    v_orbit := public.tusken_orbit_fleet(v_faction);

    if v_orbit is null then
        raise exception 'No fleet of yours is in orbit of Tuskara: bring one before you settle the dust';
    end if;

    v_wait := public.tusken_colony_wait(v_faction);

    if v_wait > 0 then
        raise exception 'The bands are still moving: another settlement in % seconds', v_wait;
    end if;

    select count(*) into v_count
    from public.tusken_colonies as col
    where col.faction = v_faction;

    if v_count >= public.tusken_max_colonies() then
        raise exception 'The dust will not feed another settlement: % stand already', v_count;
    end if;

    v_price := public.tusken_colony_price(v_faction);

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft
    where ft.faction = v_faction;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'A settlement costs % credits', v_price;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = v_faction;

    v_spot := coalesce(public.tusken_next_spot('Tuskara'), 1);
    v_name := public.tusken_colony_name(v_spot);

    insert into public.tusken_colonies (planet, faction, player_id, name, spot, last_yield_at)
    values ('Tuskara', v_faction, me, v_name, v_spot, now());

    return jsonb_build_object(
        'ok', true,
        'name', v_name,
        'paid', v_price,
        'spot', v_spot,
        'x', public.tusken_spot_x(v_spot),
        'y', public.tusken_spot_y(v_spot),
        'fleet', v_orbit
    );

end;
$function$;


-- ---------------------------------------------------------
-- 5. buying a hull, and loading it
-- ---------------------------------------------------------

create or replace function public.tusken_buy_ship()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_price integer := public.tusken_ship_price();
    v_credits numeric;
    v_count integer;
    v_name text;
    v_id bigint;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine ship the Tusken';
    end if;

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft
    where ft.faction = v_faction;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'A transport costs % credits', v_price;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = v_faction;

    select count(*) into v_count
    from public.tusken_ships as s
    where s.faction = v_faction;

    v_name := 'Transport ' || (v_count + 1);

    insert into public.tusken_ships (faction, player_id, name, capacity)
    values (v_faction, me, v_name, public.tusken_ship_capacity())
    returning id into v_id;

    return jsonb_build_object(
        'ok', true,
        'id', v_id,
        'name', v_name,
        'paid', v_price,
        'capacity', public.tusken_ship_capacity()
    );

end;
$function$;


/* ---------------------------------------------------------
   Loading a hull that is already ours.

   Nothing is charged: the ship was the purchase, and the
   trip is its work. A hull can only be in one place at a
   time, so a ship at sea is not offered.
   --------------------------------------------------------- */
create or replace function public.tusken_ship(p_from text, p_to text, p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_from text := coalesce(nullif(trim(p_from), ''), 'Tuskara');
    v_available bigint;
    v_amount bigint;
    v_left bigint;
    v_take bigint;
    v_dest text;
    v_seconds integer;
    v_ship record;
    pen record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine ship the Tusken';
    end if;

    perform public.tusken_tick();

    /* the load has to have somewhere to go that we actually hold */
    select p.name into v_dest
    from public.planets as p
    where p.name = p_to
      and p.name <> 'Tuskara'
      and exists (select 1 from public.cities as c where c.planet_id = p.id)
      and not exists (select 1 from public.cities as c
                      where c.planet_id = p.id and c.faction is distinct from v_faction);

    if v_dest is null then
        raise exception 'A load can only be landed on a world you hold whole';
    end if;

    if v_from = p_to then
        raise exception 'The ship is already there';
    end if;

    /* where the load is coming from */
    if v_from = 'Tuskara' then

        select coalesce(sum(col.slaves), 0) into v_available
        from public.tusken_colonies as col
        where col.faction = v_faction and col.planet = 'Tuskara';

    else

        select coalesce(w.amount, 0) into v_available
        from public.tusken_workforce as w
        where w.planet = v_from and w.faction = v_faction;

    end if;

    v_available := coalesce(v_available, 0);

    if v_available <= 0 then
        raise exception 'There are no Tusken waiting at %', v_from;
    end if;

    /* a hull of ours that is not already at sea */
    select s.id, s.name, s.capacity into v_ship
    from public.tusken_ships as s
    where s.faction = v_faction
      and not exists (select 1 from public.tusken_convoys as k where k.ship_id = s.id)
    order by s.capacity desc, s.id
    limit 1
    for update;

    if v_ship.id is null then
        raise exception 'Every transport is at sea: wait for one to make port, or buy another';
    end if;

    v_amount := greatest(1, least(coalesce(p_amount, 0), v_ship.capacity, v_available));

    /* ---- take the load aboard ---- */
    if v_from = 'Tuskara' then

        v_left := v_amount;

        for pen in
            select col.id, col.slaves
            from public.tusken_colonies as col
            where col.faction = v_faction and col.planet = 'Tuskara' and col.slaves > 0
            order by col.spot, col.id
            for update
        loop

            exit when v_left <= 0;

            v_take := least(pen.slaves, v_left);

            update public.tusken_colonies as col
            set slaves = col.slaves - v_take
            where col.id = pen.id;

            v_left := v_left - v_take;

        end loop;

    else

        update public.tusken_workforce as w
        set amount = w.amount - v_amount
        where w.planet = v_from and w.faction = v_faction
          and w.amount >= v_amount;

        if not found then
            raise exception 'There are no Tusken waiting at %', v_from;
        end if;

    end if;

    v_seconds := public.tusken_road_seconds(v_from, v_dest);

    insert into public.tusken_convoys (faction, player_id, ship_id, from_planet, to_planet, amount, arrival_at)
    values (v_faction, me, v_ship.id, v_from, v_dest, v_amount,
            now() + make_interval(secs => v_seconds));

    return jsonb_build_object(
        'ok', true,
        'from', v_from,
        'to', v_dest,
        'amount', v_amount,
        'paid', 0,
        'ship', v_ship.name,
        'capacity', v_ship.capacity,
        'seconds', v_seconds
    );

end;
$function$;


-- ---------------------------------------------------------
-- 6. the host's RESET button
-- ---------------------------------------------------------

create or replace function public.tusken_world_reset()
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

    delete from public.tusken_convoys;
    delete from public.tusken_workforce;
    delete from public.tusken_colonies;
    delete from public.tusken_ships;

    return jsonb_build_object('ok', true);

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select 'Tuskara' as world,
       public.tusken_max_colonies() as settlements_per_faction,
       public.tusken_slaves_per_credit() as slaves_per_credit,
       public.tusken_colony_cooldown() as seconds_between_settlements,
       public.tusken_ship_capacity() as slaves_per_hull,
       public.tusken_ship_price() as hull_price,
       (select count(*) from public.tusken_ships) as hulls;
