-- =========================================================
-- GALACTIC FRONT — TUSKARA, THE TUSKEN HOMEWORLD
--
-- Run this in the Supabase SQL editor (SQL > New query).
-- Safe to run more than once, and after every other patch.
--
-- WHAT THIS ADDS
--
--   Tuskara is a desert world on the southern edge of the
--   map, in the open band between Virelia and Arctyra, clear
--   of the controls in the corner and a long way from either
--   capital. It belongs to nobody. It is not conquered: there
--   are no cities on it and no garrison to break. What stands
--   on Tuskara are COLONIES, and a colony is a pen.
--
--   A colony is founded for credits and then grown along
--   three tracks:
--     SIZE   how big the settlement (and its pens) is
--     CATCH  how many Tusken a band can take per hour
--     HOLD   how many it can keep before they must be moved
--
--   The Tusken captured into the pens are worth nothing on
--   their own dust: a slave only earns when put to work on a
--   world that has industry. Every 10,000 slaves working on
--   a world add 1 credit to that world's payment, so the
--   money is made by shipping them out — and the world they
--   leave behind loses exactly the income they were making.
--
--   Shipping is a purchase: a transport takes up to 2,500
--   slaves from Tuskara (or from a world that already holds
--   some) to any world the faction holds whole. The convoy
--   is a real object with an arrival time and is unloaded by
--   the tick.
--
--   Everything here is wiped by the host's RESET button.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the world and its place on the map
-- ---------------------------------------------------------

do $do$
declare
    v_type    text;
    v_seq     text;
    v_faction text;
    v_has_row boolean;
    v_cols    text[] := '{}';
    v_vals    text[] := '{}';
    r         record;
    v_data    text;
begin

    if exists (select 1 from public.planets as p where p.name = 'Tuskara') then
        return;
    end if;

    select exists (select 1 from public.planets as p) into v_has_row;

    /* which key does this install use?
         - a number (serial): the row needs the next id by hand, because the
           column has no default on this database
         - text: the planet's key is its own name
         - no id column at all: the name is the key */
    select c.data_type into v_type
    from information_schema.columns as c
    where c.table_schema = 'public'
      and c.table_name = 'planets'
      and c.column_name = 'id';

    /* faction is NOT NULL on the live table, and the worlds that already
       belong to nobody carry a word for it — take theirs instead of making
       one up, so Tuskara is labelled like the rest of the map. Not every
       install has the column at all, so it is asked for dynamically */
    if exists (select 1
               from information_schema.columns as c
               where c.table_schema = 'public'
                 and c.table_name = 'planets'
                 and c.column_name = 'faction') then

        execute $q$
            select p.faction
            from public.planets as p
            where p.faction in ('Independents', 'Independent', 'Neutral',
                                'neutral', 'independent', '')
            limit 1
        $q$ into v_faction;

        if v_faction is null then
            execute $q$
                select p.faction
                from public.planets as p
                where p.faction is not null
                  and p.faction not in ('Combine', 'Freedom Authority')
                limit 1
            $q$ into v_faction;
        end if;

    end if;

    if v_faction is null then
        v_faction := 'Independents';
    end if;

    /* the row is built from the columns this table actually has: everything
       it will not take as null and offers no default for is filled from an
       existing row (the game's own value in that column), so a schema this
       patch has never seen still gets a row it accepts */
    for r in
        select c.column_name, c.data_type, c.is_nullable, c.column_default
        from information_schema.columns as c
        where c.table_schema = 'public'
          and c.table_name = 'planets'
        order by c.ordinal_position
    loop
        v_data := null;

        if r.column_name = 'id' and v_type is not null then

            if v_type in ('smallint', 'integer', 'bigint') then
                v_data := '(select coalesce(max(p.id), 0) + 1 from public.planets as p)';
            elsif v_type = 'uuid' then
                v_data := 'gen_random_uuid()';
            else
                v_data := quote_literal('Tuskara');
            end if;

        elsif r.column_name = 'name' then
            v_data := quote_literal('Tuskara');

        elsif r.column_name = 'faction' then
            v_data := quote_literal(v_faction);

        elsif r.column_name = 'income' then
            v_data := '60';

        elsif r.is_nullable = 'NO' and r.column_default is null then

            if v_has_row then
                /* one more NOT NULL column we know nothing about: its own
                   first row already holds a value the table accepts */
                v_data := format('(select s.%I from public.planets as s limit 1)', r.column_name);

            elsif r.data_type in ('character varying', 'character', 'text', 'name') then
                v_data := quote_literal('');

            elsif r.data_type in ('smallint', 'integer', 'bigint', 'numeric', 'real', 'double precision') then
                v_data := '0';

            elsif r.data_type = 'boolean' then
                v_data := 'false';

            elsif r.data_type = 'uuid' then
                v_data := 'gen_random_uuid()';

            elsif r.data_type in ('timestamp with time zone', 'timestamp without time zone', 'date') then
                v_data := 'now()';

            elsif r.data_type = 'jsonb' then
                v_data := '''{}''::jsonb';
            end if;
        end if;

        if v_data is not null then
            v_cols := v_cols || format('%I', r.column_name);
            v_vals := v_vals || v_data;
        end if;
    end loop;

    execute format('insert into public.planets (%s) select %s',
                   array_to_string(v_cols, ', '),
                   array_to_string(v_vals, ', '));

    /* a hand-keyed id may still be a sequence's column: move the sequence
       past the row, so the next planet built by the game does not collide */
    if v_type in ('smallint', 'integer', 'bigint') then

        v_seq := pg_get_serial_sequence('public.planets', 'id');

        if v_seq is not null then
            execute format(
                'select setval(%L, (select coalesce(max(p.id), 1) from public.planets as p))',
                v_seq);
        end if;

    end if;

end;
$do$;


insert into public.planet_positions (name, x, y)
values ('Tuskara', 44, 92)
on conflict (name) do update
    set x = excluded.x,
        y = excluded.y;


-- ---------------------------------------------------------
-- 2. the tables
-- ---------------------------------------------------------

create table if not exists public.tusken_colonies (
    id bigserial primary key,
    planet text not null default 'Tuskara',
    faction text not null,
    player_id uuid,
    name text,
    size int not null default 1 check (size between 1 and 5),
    catch_level int not null default 1 check (catch_level between 1 and 5),
    hold_level int not null default 1 check (hold_level between 1 and 5),
    slaves bigint not null default 0 check (slaves >= 0),
    founded_at timestamptz not null default now(),
    last_yield_at timestamptz not null default now()
);

alter table public.tusken_colonies enable row level security;

/* the Tusken who have been taken off Tuskara and put to work somewhere */
create table if not exists public.tusken_workforce (
    planet text not null,
    faction text not null,
    amount bigint not null default 0 check (amount >= 0),
    primary key (planet, faction)
);

alter table public.tusken_workforce enable row level security;

/* a bought ship with a bought load, on its way */
create table if not exists public.tusken_convoys (
    id bigserial primary key,
    faction text not null,
    player_id uuid,
    from_planet text not null,
    to_planet text not null,
    amount bigint not null check (amount > 0),
    departed_at timestamptz not null default now(),
    arrival_at timestamptz not null
);

alter table public.tusken_convoys enable row level security;

create index if not exists tusken_convoys_due on public.tusken_convoys (arrival_at);
create index if not exists tusken_colonies_owner on public.tusken_colonies (faction, planet);


-- ---------------------------------------------------------
-- 3. the numbers, in one place
-- ---------------------------------------------------------

/* how many slaves a colony can hold */
create or replace function public.tusken_capacity(p_size int, p_hold int)
returns bigint
language sql
immutable
as $function$
    select (greatest(1, least(5, p_size)) * greatest(1, least(5, p_hold)) * 1500)::bigint
$function$;


/* how many Tusken one colony takes in an hour */
create or replace function public.tusken_yield_per_hour(p_size int, p_catch int)
returns bigint
language sql
immutable
as $function$
    select (greatest(1, least(5, p_size)) * greatest(1, least(5, p_catch)) * 500)::bigint
$function$;


/* the price of one step up one track, at the level it is now */
create or replace function public.tusken_upgrade_price(p_track text, p_level int)
returns integer
language sql
immutable
as $function$
    select case p_track
               when 'size'  then 400 * greatest(1, least(5, p_level))
               when 'catch' then 300 * greatest(1, least(5, p_level))
               when 'hold'  then 300 * greatest(1, least(5, p_level))
           end
$function$;


/* small settlements, many of them: eight per faction, sixteen places
   (11-27 restates this number; the two files must never disagree) */
create or replace function public.tusken_max_colonies()
returns integer
language sql
immutable
as $function$
    select 8
$function$;


/* founding gets dearer with every colony already standing */
create or replace function public.tusken_colony_price(p_faction text)
returns integer
language sql
stable
security definer
set search_path to ''
as $function$
    select 500 + 250 * coalesce((
        select count(*) from public.tusken_colonies as c where c.faction = p_faction
    ), 0)
$function$;


/* the small slaver hull: 1,000 Tusken a trip (11-30 restates this, so a
   re-run of this file cannot quietly hand out 2,500 again) */
create or replace function public.tusken_ship_capacity()
returns bigint
language sql
immutable
as $function$
    select 1000::bigint
$function$;


create or replace function public.tusken_ship_price()
returns integer
language sql
immutable
as $function$
    select 350
$function$;


/* 1,000 Tusken at work on a world pay it 1 credit (11-27 restates this;
   the two files must never disagree, because any patch may be re-run) */
create or replace function public.tusken_slaves_per_credit()
returns bigint
language sql
immutable
as $function$
    select 1000::bigint
$function$;


create or replace function public.tusken_colony_name(p_index int)
returns text
language sql
immutable
as $function$
    select (array['Red Hollow', 'Bleached Flats', 'The Bone Yard', 'Dry Verge', 'Salt Pan'])
           [greatest(1, least(5, p_index))]
$function$;


/* ---------------------------------------------------------
   What the slaves working on one world add to its payment.

   The homeworld is grazing land and has no industry, so a
   Tusken still standing on Tuskara earns nothing: the whole
   point of the pens is that they must be shipped out.
   --------------------------------------------------------- */
create or replace function public.tusken_income_bonus(p_planet text, p_faction text)
returns bigint
language sql
stable
security definer
set search_path to ''
as $function$
    select case
               when p_planet is null or p_planet = 'Tuskara' then 0
               else coalesce((
                   select (w.amount / public.tusken_slaves_per_credit())
                   from public.tusken_workforce as w
                   where w.planet = p_planet and w.faction = p_faction
               ), 0)
           end
$function$;


/* seconds on the road between two worlds, at the pace of a loaded ship */
create or replace function public.tusken_road_seconds(p_from text, p_to text)
returns integer
language sql
stable
security definer
set search_path to ''
as $function$
    select greatest(60, round(sqrt(
        power(coalesce(ax.x, 0) - coalesce(bx.x, 0), 2) +
        power(coalesce(ax.y, 0) - coalesce(bx.y, 0), 2)
    ) * 8)::integer)
    from (select 1) as one
    left join public.planet_positions as ax on ax.name = p_from
    left join public.planet_positions as bx on bx.name = p_to
$function$;


-- ---------------------------------------------------------
-- 4. the clock: colonies take, convoys land
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
        select con.id, con.faction, con.to_planet, con.amount
        from public.tusken_convoys as con
        where con.arrival_at <= now()
        order by con.arrival_at
        for update
    loop

        update public.tusken_workforce as w
        set amount = w.amount + k.amount
        where w.planet = k.to_planet and w.faction = k.faction;

        if not found then
            insert into public.tusken_workforce (planet, faction, amount)
            values (k.to_planet, k.faction, k.amount);
        end if;

        delete from public.tusken_convoys as con where con.id = k.id;

        v_arrived := v_arrived + 1;

    end loop;

    return jsonb_build_object(
        'ok', true,
        'frozen', false,
        'taken', v_taken,
        'landed', v_arrived
    );

end;
$function$;


-- ---------------------------------------------------------
-- 5. the screen
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

    return jsonb_build_object(
        'me', v_faction,
        'planet', 'Tuskara',
        'credits', coalesce(v_credits, 0),
        'pool', coalesce(v_pool, 0),
        'my_colonies', coalesce(v_count, 0),
        'max_colonies', public.tusken_max_colonies(),

        'prices', jsonb_build_object(
            'colony', public.tusken_colony_price(v_faction),
            'ship', public.tusken_ship_price(),
            'capacity', public.tusken_ship_capacity(),
            'per_credit', public.tusken_slaves_per_credit()
        ),

        /* every colony on the dust, ours first */
        'colonies', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', col.id,
                       'name', col.name,
                       'faction', col.faction,
                       'mine', col.faction = v_faction,
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
                   ) order by (col.faction <> v_faction), col.id)
            from public.tusken_colonies as col
            where col.planet = 'Tuskara'
        ), '[]'::jsonb),

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
                       'arrival', k.arrival_at,
                       'seconds', greatest(0, ceil(extract(epoch from (k.arrival_at - now())))::integer)
                   ) order by k.arrival_at)
            from public.tusken_convoys as k
            where k.faction = v_faction
        ), '[]'::jsonb)

    );

end;
$function$;


-- ---------------------------------------------------------
-- 6. founding and growing a colony
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
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine settle Tuskara';
    end if;

    perform public.tusken_tick();

    select count(*) into v_count
    from public.tusken_colonies as col
    where col.faction = v_faction;

    if v_count >= public.tusken_max_colonies() then
        raise exception 'The dust will not feed another colony: % stand already', v_count;
    end if;

    v_price := public.tusken_colony_price(v_faction);

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft
    where ft.faction = v_faction;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'A colony costs % credits', v_price;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = v_faction;

    v_name := public.tusken_colony_name(v_count + 1);

    insert into public.tusken_colonies (planet, faction, player_id, name, last_yield_at)
    values ('Tuskara', v_faction, me, v_name, now());

    return jsonb_build_object('ok', true, 'name', v_name, 'paid', v_price);

end;
$function$;


create or replace function public.tusken_upgrade(p_colony bigint, p_track text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_credits numeric;
    v_price integer;
    v_level integer;
    v_col record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if p_track not in ('size', 'catch', 'hold') then
        raise exception 'Unknown colony work';
    end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    perform public.tusken_tick();

    select * into v_col from public.tusken_colonies as col where col.id = p_colony for update;

    if not found then raise exception 'There is no such colony'; end if;

    if v_col.faction is distinct from v_faction then
        raise exception 'That colony answers to %', v_col.faction;
    end if;

    v_level := case p_track
                   when 'size' then v_col.size
                   when 'catch' then v_col.catch_level
                   else v_col.hold_level
               end;

    if v_level >= 5 then
        raise exception 'That work is already finished';
    end if;

    v_price := public.tusken_upgrade_price(p_track, v_level);

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft
    where ft.faction = v_faction;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'That work costs % credits', v_price;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = v_faction;

    if p_track = 'size' then
        update public.tusken_colonies as col set size = col.size + 1 where col.id = p_colony;
    elsif p_track = 'catch' then
        update public.tusken_colonies as col set catch_level = col.catch_level + 1 where col.id = p_colony;
    else
        update public.tusken_colonies as col set hold_level = col.hold_level + 1 where col.id = p_colony;
    end if;

    return jsonb_build_object('ok', true, 'paid', v_price, 'track', p_track);

end;
$function$;


-- ---------------------------------------------------------
-- 7. buying a ship and loading it
-- ---------------------------------------------------------

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
    v_credits numeric;
    v_available bigint;
    v_amount bigint;
    v_left bigint;
    v_take bigint;
    v_dest text;
    v_seconds integer;
    v_price integer := public.tusken_ship_price();
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

    v_amount := greatest(1, least(coalesce(p_amount, 0), public.tusken_ship_capacity(), v_available));

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft
    where ft.faction = v_faction;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'A transport costs % credits', v_price;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = v_faction;

    /* ---- take the load aboard ---- */
    if v_from = 'Tuskara' then

        v_left := v_amount;

        for pen in
            select col.id, col.slaves
            from public.tusken_colonies as col
            where col.faction = v_faction and col.planet = 'Tuskara' and col.slaves > 0
            order by col.id
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

    insert into public.tusken_convoys (faction, player_id, from_planet, to_planet, amount, arrival_at)
    values (v_faction, me, v_from, v_dest, v_amount, now() + make_interval(secs => v_seconds));

    return jsonb_build_object(
        'ok', true,
        'from', v_from,
        'to', v_dest,
        'amount', v_amount,
        'paid', v_price,
        'seconds', v_seconds
    );

end;
$function$;


-- ---------------------------------------------------------
-- 8. the host's RESET button
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

    return jsonb_build_object('ok', true);

end;
$function$;


-- ---------------------------------------------------------
-- 9. the income carries the slaves
--
--    supply_network is the one place that decides what a
--    world pays, and both the treasury tick and the chambers
--    read their figures from it: adding the Tusken here is
--    enough for the money to arrive, and taking them off a
--    world is enough for its payment to fall by exactly what
--    they were worth.
-- ---------------------------------------------------------

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
                   public.planet_income(p.name)
                       + public.tusken_income_bonus(p.name, p_faction) as income,
                   coalesce((
                       select wf.amount from public.tusken_workforce as wf
                       where wf.planet = p.name and wf.faction = p_faction
                   ), 0) as slaves,
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
        select o.name, o.x, o.y, o.income, o.slaves, o.dcap, o.capital,
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
            'slaves', coalesce(w.slaves, 0),
            'slave_income', public.tusken_income_bonus(w.name, p_faction),
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


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select 'Tuskara' as world,
       (select count(*) from public.planets as p where p.name = 'Tuskara') as planet_rows,
       (select count(*) from public.planet_positions as pp where pp.name = 'Tuskara') as position_rows,
       public.tusken_capacity(1, 1) as level_one_pens,
       public.tusken_yield_per_hour(1, 1) as level_one_per_hour,
       public.tusken_slaves_per_credit() as slaves_per_credit;
