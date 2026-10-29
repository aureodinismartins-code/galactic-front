-- =========================================================
-- GALACTIC FRONT — TRANSPORT FLEETS, AND THE INTERCEPTION
--
-- Run AFTER sql/2026-11-27_the_pens_and_the_transports.sql,
-- in the Supabase SQL editor (SQL > New query). Safe to run
-- more than once, and after every other patch.
--
-- WHAT THIS CHANGES
--
--   A transport is no longer a hull floating on its own: it
--   JOINS A FLEET. When a hull is bought, the buyer names the
--   fleet it is for, and from then on that fleet is a
--   transport fleet — its SLAVE LIFT is the sum of the
--   capacities of the hulls attached to it.
--
--   A load is therefore a fleet order, not a hull order:
--
--     ORBIT     the fleet must be STATIONED in the orbit of
--               the world the Tusken are leaving (Tuskara, or
--               a world already holding them)
--     LIFT      it can carry as much as its hulls hold, and
--               no more
--     BLOCKADE  if an enemy fleet is in orbit of that world,
--               the load cannot sail at all
--
--   The fleet then really sails: it is put on the map as
--   travelling, along the same route the galaxy screen draws
--   for every other fleet, and it makes port on arrival.
--
--   THE INTERCEPTION. When a slaving fleet arrives, an enemy
--   fleet stationed in the orbit of the destination may fall
--   on it:
--
--     * the escort is the slaving fleet's own soldiers;
--     * if the escort is stronger than the interceptor, the
--       load lands and the interceptor is mauled (a tenth of
--       its soldiers, repairable at the dock);
--     * otherwise the fleet is TAKEN — the hulls change hands
--       with the fleet — and the Tusken aboard become the
--       captor's workforce on that world, paying the captor.
--
--   A fleet with no soldiers aboard is taken by the first
--   warship that meets it: a pure transport fleet needs an
--   escort.
--
--   Everything here is wiped by the host's RESET button.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the hulls find their fleets
-- ---------------------------------------------------------

alter table public.tusken_ships
    add column if not exists fleet_id uuid;

create index if not exists tusken_ships_fleet on public.tusken_ships (fleet_id);

alter table public.tusken_convoys add column if not exists fleet_id uuid;
alter table public.tusken_convoys add column if not exists ship_count bigint not null default 0;
alter table public.tusken_convoys add column if not exists status text not null default 'sailing';
alter table public.tusken_convoys add column if not exists outcome text;
alter table public.tusken_convoys add column if not exists finished_at timestamptz;

create index if not exists tusken_convoys_fleet on public.tusken_convoys (fleet_id);
create index if not exists tusken_convoys_open on public.tusken_convoys (status, arrival_at);

/* hulls bought before this patch were floating free: they join the faction's
   fleet in orbit of Tuskara if there is one, else its first stationed fleet,
   so an older save keeps the lift it paid for */
do $$
begin

    update public.tusken_ships as s
    set fleet_id = (
        select f.id
        from public.fleet_positions() as f
        where f.faction = s.faction
          and f.status = 'stationed'
        order by (f.origin = 'Tuskara') desc, f.name
        limit 1
    )
    where s.fleet_id is null;

exception when undefined_table or undefined_function then
    /* an install without the fleets table has nothing to join */
    null;
end
$$;


-- ---------------------------------------------------------
-- 2. the readings
-- ---------------------------------------------------------

/* the full strength of one division, as a fallback when the game's own
   fleet_squad_size() is not installed (it is, in any real install) */
create or replace function public.tusken_squad_size(p_type text)
returns integer
language sql
immutable
as $function$
    select case p_type
        when 'Rifle' then 1000
        when 'MG' then 750
        when 'Assault' then 1000
        when 'AT' then 600
        when 'Sniper' then 400
        when 'Tank' then 200
        when 'Artillery' then 250
        when 'Knightmare' then 3
        else 1000
    end
$function$;


/* how many soldiers are still standing in a set of squads */
create or replace function public.tusken_fleet_soldiers(p_squads jsonb)
returns bigint
language plpgsql
immutable
as $function$
declare
    d jsonb;
begin

    begin
        d := public.fleet_damage_reading(p_squads);
        return coalesce((d ->> 'left')::bigint, 0);
    exception when undefined_function or undefined_object then
        null;
    end;

    return coalesce((
        select sum(greatest(0, coalesce(
                   nullif(e ->> 'soldiers', '')::numeric,
                   public.tusken_squad_size(e ->> 'type')
                       * greatest(0, coalesce((e ->> 'amount')::numeric, 0)))))
        from jsonb_array_elements(coalesce(p_squads, '[]'::jsonb)) as e
        where jsonb_typeof(e) = 'object'
    ), 0)::bigint;

end
$function$;


/* how much a fleet can carry: the hulls attached to it */
create or replace function public.tusken_fleet_lift(p_fleet uuid)
returns bigint
language sql
stable
security definer
set search_path to ''
as $function$
    select coalesce(sum(s.capacity), 0)::bigint
    from public.tusken_ships as s
    where s.fleet_id = p_fleet
$function$;


/* which world's orbit a fleet is standing in, or null when it is not in one */
create or replace function public.tusken_fleet_at(p_fleet uuid)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    f record;
    v_range numeric := 6;
    v_planet text;
begin

    begin
        v_range := public.orbit_range();
    exception when undefined_function then
        v_range := 6;
    end;

    begin
        select fp.origin, fp.status, fp.x, fp.y into f
        from public.fleet_positions() as fp
        where fp.id = p_fleet;
    exception when undefined_table or undefined_function then
        return null;
    end;

    if f.origin is null then return null; end if;
    if coalesce(f.status, '') <> 'stationed' then return null; end if;
    if f.x is null or f.y is null then return f.origin; end if;

    select p.name into v_planet
    from public.planet_positions as p
    where sqrt(power(p.x - f.x, 2) + power(p.y - f.y, 2)) <= v_range
    order by sqrt(power(p.x - f.x, 2) + power(p.y - f.y, 2)), p.name
    limit 1;

    return coalesce(v_planet, f.origin);

end
$function$;


/* the enemy warship waiting in the orbit of a world, if one is there: the
   strongest one, so the pick is never a coincidence */
create or replace function public.tusken_interceptor(p_faction text, p_planet text)
returns uuid
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_id uuid;
begin

    select f.id into v_id
    from public.fleets as f
    where f.faction <> p_faction
      and f.faction in ('Freedom Authority', 'Combine')
      and f.status::text = 'stationed'
      and f.origin = p_planet
      and jsonb_array_length(coalesce(f.squads, '[]'::jsonb)) > 0
      and public.tusken_fleet_soldiers(f.squads) > 0
    order by public.tusken_fleet_soldiers(f.squads) desc, f.name
    limit 1;

    return v_id;

end
$function$;


/* a tenth of every squad lost: the battle reading the dock repairs */
create or replace function public.tusken_maul(p_fleet uuid, p_share numeric default 0.1)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_squads jsonb;
    v_new jsonb;
    v_left numeric := 1 - least(0.9, greatest(0, coalesce(p_share, 0.1)));
begin

    select coalesce(f.squads, '[]'::jsonb) into v_squads
    from public.fleets as f
    where f.id = p_fleet
    for update;

    if v_squads is null then
        return jsonb_build_object('fleet', p_fleet, 'mauled', false);
    end if;

    select coalesce(jsonb_agg(
               case when jsonb_typeof(e) = 'object'
                    then e || jsonb_build_object('soldiers', greatest(1, floor(
                             coalesce(nullif(e ->> 'soldiers', '')::numeric,
                                      public.tusken_squad_size(e ->> 'type')
                                          * greatest(0, coalesce((e ->> 'amount')::numeric, 0)))
                             * v_left)))
                    else e
               end
               order by ord), '[]'::jsonb)
    into v_new
    from jsonb_array_elements(v_squads) with ordinality as t(e, ord);

    update public.fleets as f set squads = v_new where f.id = p_fleet;

    return jsonb_build_object('fleet', p_fleet, 'mauled', true);

end
$function$;


/* every fleet of a faction, with the lift its hulls give it */
create or replace function public.tusken_fleets(p_faction text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    f record;
    v_list jsonb := '[]'::jsonb;
begin

    begin
        for f in
            select fp.id, fp.name, fp.status, fp.origin
            from public.fleet_positions() as fp
            where fp.faction = p_faction
            order by (fp.status <> 'stationed'), fp.name
        loop

            v_list := v_list || jsonb_build_object(
                'id', f.id,
                'name', f.name,
                'status', f.status,
                'at', public.tusken_fleet_at(f.id),
                'stationed', f.status = 'stationed',
                'lift', public.tusken_fleet_lift(f.id),
                'transports', (select count(*) from public.tusken_ships as s where s.fleet_id = f.id),
                'soldiers', public.tusken_fleet_soldiers(
                    (select x.squads from public.fleets as x where x.id = f.id))
            );

        end loop;
    exception when undefined_table or undefined_function then
        return '[]'::jsonb;
    end;

    return v_list;

end
$function$;


-- ---------------------------------------------------------
-- 3. buying a hull for a named fleet
-- ---------------------------------------------------------

drop function if exists public.tusken_buy_ship();

create or replace function public.tusken_buy_ship(p_fleet uuid)
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
    f record;
    v_lift bigint;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine ship the Tusken';
    end if;

    if p_fleet is null then
        raise exception 'Choose the fleet the transport is to join';
    end if;

    select * into f from public.fleets as x where x.id = p_fleet;

    if f.id is null then
        raise exception 'There is no such fleet';
    end if;

    if f.faction is distinct from v_faction then
        raise exception 'That fleet is not yours';
    end if;

    if coalesce(f.status::text, '') = 'engaged' then
        raise exception 'That fleet is in battle: no hull joins it until the shooting stops';
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

    insert into public.tusken_ships (faction, player_id, name, capacity, fleet_id)
    values (v_faction, me, v_name, public.tusken_ship_capacity(), p_fleet)
    returning id into v_id;

    v_lift := public.tusken_fleet_lift(p_fleet);

    return jsonb_build_object(
        'ok', true,
        'id', v_id,
        'name', v_name,
        'paid', v_price,
        'capacity', public.tusken_ship_capacity(),
        'fleet', f.name,
        'fleet_id', p_fleet,
        'lift', v_lift
    );

end
$function$;


-- ---------------------------------------------------------
-- 4. sailing a load: the fleet carries it
-- ---------------------------------------------------------

drop function if exists public.tusken_ship(text, text, bigint);

create or replace function public.tusken_ship(p_fleet uuid, p_from text, p_to text, p_amount bigint)
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
    v_lift bigint;
    v_at text;
    v_blocker text;
    v_escort bigint;
    v_ships integer;
    f record;
    pen record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine ship the Tusken';
    end if;

    if p_fleet is null then
        raise exception 'Choose the fleet that carries the load';
    end if;

    perform public.tusken_tick();

    select * into f from public.fleets as x where x.id = p_fleet;

    if f.id is null then
        raise exception 'There is no such fleet';
    end if;

    if f.faction is distinct from v_faction then
        raise exception 'That fleet is not yours';
    end if;

    if coalesce(f.status::text, '') <> 'stationed' then
        raise exception 'The % is not in port: a fleet at sea cannot take a load', f.name;
    end if;

    v_lift := public.tusken_fleet_lift(p_fleet);

    if coalesce(v_lift, 0) <= 0 then
        raise exception 'The % carries no transports: buy a hull for it first', f.name;
    end if;

    v_at := public.tusken_fleet_at(p_fleet);

    if v_at is distinct from v_from then
        raise exception 'The % is in orbit of %, not %: the load is waiting at %',
            f.name, coalesce(v_at, 'nothing'), v_from, v_from;
    end if;

    /* an enemy warship over the world the Tusken are leaving: nothing sails */
    v_blocker := public.tusken_interceptor(v_faction, v_from);

    if v_blocker is not null then
        raise exception 'An enemy fleet holds the orbit of %: the load cannot sail', v_from;
    end if;

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

    v_amount := greatest(1, least(coalesce(p_amount, 0), v_lift, v_available));

    /* how many hulls are making this crossing */
    select count(*) into v_ships
    from public.tusken_ships as s
    where s.fleet_id = p_fleet;

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

    /* ---- the fleet really sails ---- */
    update public.fleets as x
    set status = 'travelling',
        origin = v_from,
        destination = v_dest,
        departure_time = now(),
        arrival_time = now() + make_interval(secs => v_seconds),
        space_x = null,
        space_y = null
    where x.id = p_fleet;

    insert into public.tusken_convoys
        (faction, player_id, fleet_id, ship_count, from_planet, to_planet, amount,
         departed_at, arrival_at, status)
    values (v_faction, me, p_fleet, v_ships, v_from, v_dest, v_amount,
            now(), now() + make_interval(secs => v_seconds), 'sailing');

    select public.tusken_fleet_soldiers(f.squads) into v_escort;

    return jsonb_build_object(
        'ok', true,
        'from', v_from,
        'to', v_dest,
        'amount', v_amount,
        'paid', 0,
        'fleet', f.name,
        'fleet_id', p_fleet,
        'ships', v_ships,
        'lift', v_lift,
        'escort', coalesce(v_escort, 0),
        'seconds', v_seconds
    );

end
$function$;


-- ---------------------------------------------------------
-- 5. the clock: the bands take, the convoys make port,
--    and the warships are waiting
-- ---------------------------------------------------------

create or replace function public.tusken_tick()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    c record;
    k record;
    v_started boolean := true;
    v_maint boolean := false;
    v_cap bigint;
    v_seconds numeric;
    v_made bigint;
    v_taken bigint := 0;
    v_arrived integer := 0;
    v_captured integer := 0;
    v_fought integer := 0;
    v_interceptor uuid;
    v_guard record;
    v_escort bigint;
    v_guard_soldiers bigint;
    v_outcome text;
begin

    /* a frozen or unstarted world grows nothing */
    begin
        execute 'select coalesce(started, true), coalesce(maintenance, false) from public.game_control where id = 1'
        into v_started, v_maint;
    exception when undefined_table or undefined_column then
        v_started := true;
        v_maint := false;
    end;

    if v_started is not true or v_maint is true then
        return jsonb_build_object('ok', true, 'frozen', true);
    end if;

    /* ---- the bands bring in whoever they caught since the last look ---- */
    for c in
        select col.id, col.size, col.catch_level, col.hold_level, col.slaves, col.last_yield_at
        from public.tusken_colonies as col
        where col.planet = 'Tuskara'
        for update
    loop

        v_cap := public.tusken_capacity(c.size, c.hold_level);

        if c.slaves >= v_cap then
            /* pens full: the bands keep watch, nothing new is taken */
            update public.tusken_colonies as col
            set last_yield_at = now()
            where col.id = c.id;
            continue;
        end if;

        v_seconds := extract(epoch from (now() - coalesce(c.last_yield_at, now())));

        if v_seconds <= 0 then
            continue;
        end if;

        v_made := floor(v_seconds * (public.tusken_yield_per_hour(c.size, c.catch_level)::numeric / 3600));

        if v_made <= 0 then
            continue;
        end if;

        update public.tusken_colonies as col
        set slaves = least(v_cap, col.slaves + v_made),
            last_yield_at = now()
        where col.id = c.id;

        v_taken := v_taken + v_made;

    end loop;

    /* ---- the convoys that have made port ---- */
    for k in
        select con.id, con.faction, con.to_planet, con.amount, con.fleet_id, con.ship_count,
               con.from_planet
        from public.tusken_convoys as con
        where con.arrival_at <= now()
          and coalesce(con.status, 'sailing') = 'sailing'
        order by con.arrival_at
        for update
    loop

        /* the fleet makes port, whether or not anybody is waiting for it */
        begin
            update public.fleets as f
            set status = 'stationed',
                origin = k.to_planet,
                destination = null,
                departure_time = null,
                arrival_time = null,
                space_x = null,
                space_y = null
            where f.id = k.fleet_id
              and coalesce(f.status::text, '') in ('travelling', 'cruising');
        exception when undefined_table then
            null;
        end;

        v_outcome := 'landed';

        /* a warship in the orbit the load is coming to may fall on it */
        if k.fleet_id is not null then

            v_interceptor := public.tusken_interceptor(k.faction, k.to_planet);

        else
            /* a load from before this patch has no fleet to be taken with */
            v_interceptor := null;
        end if;

        if v_interceptor is not null then

            select * into v_guard from public.fleets as f where f.id = v_interceptor;

            v_guard_soldiers := public.tusken_fleet_soldiers(v_guard.squads);
            v_escort := public.tusken_fleet_soldiers(
                (select f.squads from public.fleets as f where f.id = k.fleet_id));

            if coalesce(v_escort, 0) <= coalesce(v_guard_soldiers, 0) then

                /* ---- taken ---- */
                update public.fleets as f
                set faction = v_guard.faction,
                    player_id = v_guard.player_id
                where f.id = k.fleet_id;

                /* the hulls change flags with the fleet they sail with */
                update public.tusken_ships as sh
                set faction = v_guard.faction
                where sh.fleet_id = k.fleet_id;

                /* the Tusken now work for the captor, on that world */
                update public.tusken_workforce as w
                set amount = w.amount + k.amount
                where w.planet = k.to_planet and w.faction = v_guard.faction;

                if not found then
                    insert into public.tusken_workforce (planet, faction, amount)
                    values (k.to_planet, v_guard.faction, k.amount);
                end if;

                v_outcome := 'taken by the ' || v_guard.name;

                update public.tusken_convoys as con
                set status = 'captured',
                    outcome = v_outcome,
                    finished_at = now()
                where con.id = k.id;

                v_captured := v_captured + 1;

                begin
                    perform public.cg_log('INTERCEÇÃO EM ' || upper(k.to_planet) || ': a ' || v_guard.name ||
                        ' toma um comboio de ' || k.amount || ' Tusken. A frota e os cascos passam para o inimigo.');
                exception when undefined_table or undefined_function then null;
                end;

                begin
                    perform public.cs_log('INTERCEÇÃO EM ' || upper(k.to_planet) || ': a ' || v_guard.name ||
                        ' apresa um comboio de ' || k.amount || ' Tusken.');
                exception when undefined_table or undefined_function then null;
                end;

            else

                /* ---- the escort is stronger: it lands, and the raider pays ---- */
                perform public.tusken_maul(v_interceptor, 0.10);

                v_outcome := 'fought through the ' || v_guard.name;

                update public.tusken_workforce as w
                set amount = w.amount + k.amount
                where w.planet = k.to_planet and w.faction = k.faction;

                if not found then
                    insert into public.tusken_workforce (planet, faction, amount)
                    values (k.to_planet, k.faction, k.amount);
                end if;

                update public.tusken_convoys as con
                set status = 'landed',
                    outcome = v_outcome,
                    finished_at = now()
                where con.id = k.id;

                v_arrived := v_arrived + 1;
                v_fought := v_fought + 1;

            end if;

        else

            /* ---- nobody was waiting ---- */
            update public.tusken_workforce as w
            set amount = w.amount + k.amount
            where w.planet = k.to_planet and w.faction = k.faction;

            if not found then
                insert into public.tusken_workforce (planet, faction, amount)
                values (k.to_planet, k.faction, k.amount);
            end if;

            update public.tusken_convoys as con
            set status = 'landed',
                outcome = v_outcome,
                finished_at = now()
            where con.id = k.id;

            v_arrived := v_arrived + 1;

        end if;

    end loop;

    /* the record of an old crossing is kept for a few days, then let go */
    delete from public.tusken_convoys as con
    where coalesce(con.status, 'sailing') <> 'sailing'
      and coalesce(con.finished_at, con.arrival_at) < now() - interval '3 days';

    return jsonb_build_object(
        'ok', true,
        'frozen', false,
        'taken', v_taken,
        'landed', v_arrived,
        'captured', v_captured,
        'fought', v_fought
    );

end
$function$;


-- ---------------------------------------------------------
-- 6. the screen
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
    v_orbit_id uuid;
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

    select f.id into v_orbit_id
    from public.fleets as f
    where f.faction = v_faction
      and f.status::text = 'stationed'
      and f.origin = 'Tuskara'
      and f.name = v_orbit
    order by f.name
    limit 1;

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
            'fleet', v_orbit,
            'fleet_id', v_orbit_id
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

        /* every fleet we have, and the lift its hulls give it */
        'fleets', public.tusken_fleets(v_faction),

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

        /* the hulls this faction owns, and which fleet each one sails with */
        'ships', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', s.id,
                       'name', s.name,
                       'capacity', s.capacity,
                       'fleet_id', s.fleet_id,
                       'fleet', fl.name,
                       'at_sea', coalesce(fl.status::text, '') in ('travelling', 'cruising'),
                       'to', fl.destination,
                       'seconds', case
                                      when coalesce(fl.status::text, '') in ('travelling', 'cruising')
                                       and fl.arrival_time is not null
                                      then greatest(0, ceil(extract(epoch from (fl.arrival_time - now())))::integer)
                                      else 0
                                  end
                   ) order by fl.name nulls first, s.id)
            from public.tusken_ships as s
            left join public.fleets as fl on fl.id = s.fleet_id
            where s.faction = v_faction
        ), '[]'::jsonb),

        /* a hull is free when the fleet it sails with is in port */
        'idle_ships', (
            select count(*)
            from public.tusken_ships as s
            left join public.fleets as fl on fl.id = s.fleet_id
            where s.faction = v_faction
              and (fl.id is null or coalesce(fl.status::text, '') = 'stationed')
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

        /* loads that are sailing, and the last few that are done */
        'convoys', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', con.id,
                       'from', con.from_planet,
                       'to', con.to_planet,
                       'amount', con.amount,
                       'ships', con.ship_count,
                       'fleet', fl.name,
                       'status', coalesce(con.status, 'sailing'),
                       'outcome', con.outcome,
                       'seconds', case when coalesce(con.status, 'sailing') = 'sailing'
                                       then greatest(0, ceil(extract(epoch from (con.arrival_at - now())))::integer)
                                       else 0 end
                   ) order by (coalesce(con.status, 'sailing') <> 'sailing'), con.arrival_at desc)
            from (
                select cc.*
                from public.tusken_convoys as cc
                where cc.faction = v_faction
                order by (coalesce(cc.status, 'sailing') <> 'sailing'), cc.arrival_at desc
                limit 8
            ) as con
            left join public.fleets as fl on fl.id = con.fleet_id
        ), '[]'::jsonb)

    );

end
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select 'Tuskara' as world,
       public.tusken_ship_price() as hull_price,
       public.tusken_ship_capacity() as slaves_per_hull,
       (select count(*) from public.tusken_ships) as hulls,
       (select count(*) from public.tusken_ships where fleet_id is not null) as hulls_with_a_fleet,
       (select count(*) from public.tusken_convoys where coalesce(status, 'sailing') = 'sailing') as loads_at_sea;
