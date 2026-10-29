-- =========================================================
-- GALACTIC FRONT — THE EYES AND THE LEDGER
--
-- Run AFTER sql/2026-11-28_transport_fleets.sql, in the
-- Supabase SQL editor (SQL > New query). Safe to run more
-- than once, and after every other patch.
--
-- WHAT THIS CHANGES
--
--   1. SLAVING NEEDS NO CONGRESS. A faction may raise a
--      TRANSPORT FLEET of its own at Tuskara for 300 credits
--      — no bill, no directive, no quota, nothing that has
--      to pass the Congress or the Supreme Soviet. Four of
--      them per faction. It carries no soldiers until the
--      recruiting office raises some, so it is taken by the
--      first warship that meets it without an escort.
--
--   2. THE EYES. Until now the board showed every settlement
--      on the dust — its owner, its pens, its numbers. It no
--      longer does. A faction knows its own settlements and
--      nothing else: a rival's marker is an unknown camp, and
--      the only way to read it is to send a spy (250 credits,
--      thirty minutes inside). The server never sends the
--      numbers it has not paid for, so a curious browser
--      cannot read it from the answer.
--
--   3. THE LEDGER. public.tusken_ledger() is the whole slave
--      economy in one reading: the pens on Tuskara, every
--      world holding Tusken, and what each one pays. The
--      planet screen draws its SLAVES tab from it.
--
--   The host's RESET button wipes the spies and the transport
--   fleets with everything else.
-- =========================================================


-- ---------------------------------------------------------
-- 1. a fleet of transports, and no congress
-- ---------------------------------------------------------

alter table public.fleets
    add column if not exists transport_fleet boolean not null default false;


create or replace function public.tusken_transport_fleet_price()
returns integer
language sql
immutable
as $function$
    select 300
$function$;


create or replace function public.tusken_transport_fleet_max()
returns integer
language sql
immutable
as $function$
    select 4
$function$;


/* raises a fleet that carries nothing but hulls: it is not a warship, so no
   chamber has to authorise it and no quota is spent on it */
create or replace function public.tusken_new_fleet(p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_price integer := public.tusken_transport_fleet_price();
    v_max integer := public.tusken_transport_fleet_max();
    v_credits numeric;
    v_used integer;
    v_base text;
    v_name text;
    v_n integer := 1;
    v_id uuid;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine keep transport fleets';
    end if;

    perform public.tusken_tick();

    select count(*) into v_used
    from public.fleets as f
    where f.faction = v_faction and f.transport_fleet;

    if v_used >= v_max then
        raise exception 'A faction keeps at most % transport fleets', v_max;
    end if;

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft
    where ft.faction = v_faction;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'A transport fleet costs % credits', v_price;
    end if;

    v_base := left(coalesce(nullif(trim(p_name), ''), 'Transport Fleet ' || (v_used + 1)), 34);
    v_name := v_base;

    while exists (
        select 1 from public.fleets as f
        where f.faction = v_faction and f.name = v_name
    ) loop
        v_n := v_n + 1;
        v_name := left(v_base, 34) || ' ' || v_n;
    end loop;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = v_faction;

    insert into public.fleets (
        player_id, name, faction, origin, destination,
        status, departure_time, arrival_time, squads, transport_fleet
    )
    values (
        me, v_name, v_faction, 'Tuskara', null,
        'stationed', null, null, '[]'::jsonb, true
    )
    returning id into v_id;

    return jsonb_build_object(
        'ok', true,
        'id', v_id,
        'name', v_name,
        'paid', v_price,
        'fleets', v_used + 1,
        'max', v_max
    );

end;
$function$;


-- ---------------------------------------------------------
-- 2. the spies
-- ---------------------------------------------------------

create table if not exists public.tusken_intel (
    colony_id bigint not null,
    faction text not null,
    spied_until timestamptz not null,
    primary key (colony_id, faction)
);

alter table public.tusken_intel enable row level security;

create index if not exists tusken_intel_faction on public.tusken_intel (faction);


create or replace function public.tusken_spy_price()
returns integer
language sql
immutable
as $function$
    select 250
$function$;


create or replace function public.tusken_spy_seconds()
returns integer
language sql
immutable
as $function$
    select 1800
$function$;


/* a spy into a settlement that is not ours: the numbers are his for half an
   hour, and then the camp goes dark again */
create or replace function public.tusken_spy(p_colony bigint)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_price integer := public.tusken_spy_price();
    v_seconds integer := public.tusken_spy_seconds();
    v_credits numeric;
    v_left integer;
    col record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine keep spies';
    end if;

    perform public.tusken_tick();

    select * into col from public.tusken_colonies as c where c.id = p_colony;

    if col.id is null then
        raise exception 'There is no such settlement';
    end if;

    if col.faction = v_faction then
        raise exception 'That settlement is ours: no spy is needed';
    end if;

    select ceil(extract(epoch from (i.spied_until - now())))::integer into v_left
    from public.tusken_intel as i
    where i.colony_id = p_colony and i.faction = v_faction and i.spied_until > now();

    if coalesce(v_left, 0) > 0 then
        raise exception 'Our eyes are still inside that settlement: % seconds left', v_left;
    end if;

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft
    where ft.faction = v_faction;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'A spy costs % credits', v_price;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = v_faction;

    insert into public.tusken_intel (colony_id, faction, spied_until)
    values (p_colony, v_faction, now() + make_interval(secs => v_seconds))
    on conflict (colony_id, faction) do update
    set spied_until = excluded.spied_until;

    return jsonb_build_object(
        'ok', true,
        'colony', p_colony,
        'name', col.name,
        'faction', col.faction,
        'slaves', col.slaves,
        'size', col.size,
        'catch', col.catch_level,
        'hold', col.hold_level,
        'paid', v_price,
        'seconds', v_seconds
    );

end;
$function$;


/* does this faction's spy still hold this settlement? */
create or replace function public.tusken_spied(p_colony bigint, p_faction text)
returns integer
language sql
stable
security definer
set search_path to ''
as $function$
    select coalesce((
        select greatest(0, ceil(extract(epoch from (i.spied_until - now()))))::integer
        from public.tusken_intel as i
        where i.colony_id = p_colony
          and i.faction = p_faction
          and i.spied_until > now()
    ), 0)
$function$;


-- ---------------------------------------------------------
-- 3. the ledger: where the Tusken are, and what they pay
-- ---------------------------------------------------------

create or replace function public.tusken_ledger()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_pens bigint;
    v_settlements integer;
    v_work bigint;
    v_per bigint := public.tusken_slaves_per_credit();
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null then
        raise exception 'This account is not part of the war';
    end if;

    perform public.tusken_tick();

    select coalesce(sum(col.slaves), 0), count(*)
    into v_pens, v_settlements
    from public.tusken_colonies as col
    where col.faction = v_faction and col.planet = 'Tuskara';

    select coalesce(sum(w.amount), 0) into v_work
    from public.tusken_workforce as w
    where w.faction = v_faction;

    return jsonb_build_object(
        'me', v_faction,
        'per_credit', v_per,
        'pens', coalesce(v_pens, 0),
        'settlements', coalesce(v_settlements, 0),
        'at_work', coalesce(v_work, 0),
        'total', coalesce(v_pens, 0) + coalesce(v_work, 0),
        'income', coalesce(v_work, 0) / v_per,

        'worlds', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'planet', w.planet,
                       'amount', w.amount,
                       'bonus', w.amount / v_per,
                       'income', public.planet_income(w.planet),
                       'slaves', w.amount,
                       'held', not exists (
                           select 1 from public.cities as c
                           join public.planets as p on p.id = c.planet_id
                           where p.name = w.planet and c.faction is distinct from v_faction)
                   ) order by w.amount desc, w.planet)
            from public.tusken_workforce as w
            where w.faction = v_faction and w.amount > 0
        ), '[]'::jsonb)
    );

end;
$function$;


-- ---------------------------------------------------------
-- 4. the board is closed to what we do not know
--
--    tusken_world() used to answer with every settlement on
--    the dust. It is renamed to tusken_world_secret() — which
--    no player may call — and a new tusken_world() strips the
--    rivals' numbers out of the answer before it leaves the
--    server. A settlement somebody has a spy inside keeps its
--    numbers; the rest come back as a marker and nothing more.
-- ---------------------------------------------------------

do $$
begin

    if to_regprocedure('public.tusken_world_secret()') is null then
        execute 'alter function public.tusken_world() rename to tusken_world_secret';
    else
        /* the third run of this patch (or an older patch put back on top):
           the full answer is thrown away and the wrapper rebuilt */
        execute 'drop function if exists public.tusken_world()';
    end if;

end
$$;


do $$
begin

    if exists (select 1 from pg_roles where rolname = 'authenticated') then
        execute 'revoke execute on function public.tusken_world_secret() from authenticated';
    end if;

    if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke execute on function public.tusken_world_secret() from anon';
    end if;

    execute 'revoke execute on function public.tusken_world_secret() from public';

exception when undefined_function then
    null;
end
$$;


create or replace function public.tusken_world()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_full jsonb;
    v_out jsonb := '[]'::jsonb;
    c jsonb;
    v_left integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null then
        raise exception 'This account is not part of the war';
    end if;

    v_full := public.tusken_world_secret();

    for c in
        select e from jsonb_array_elements(coalesce(v_full -> 'colonies', '[]'::jsonb)) as t(e)
    loop

        if (c ->> 'mine')::boolean then

            v_out := v_out || (c || jsonb_build_object('known', true, 'spied', false));

        else

            v_left := public.tusken_spied((c ->> 'id')::bigint, v_faction);

            if v_left > 0 then

                v_out := v_out || (c || jsonb_build_object(
                    'known', true, 'spied', true, 'spied_left', v_left));

            else

                /* a marker and nothing else: no name, no owner, no pens */
                v_out := v_out || jsonb_build_object(
                    'id', c -> 'id',
                    'mine', false,
                    'known', false,
                    'spied', false,
                    'spot', c -> 'spot',
                    'x', c -> 'x',
                    'y', c -> 'y');

            end if;

        end if;

    end loop;

    return v_full || jsonb_build_object(
        'colonies', v_out,
        'spy', jsonb_build_object(
            'price', public.tusken_spy_price(),
            'seconds', public.tusken_spy_seconds()
        ),
        'transport_fleets', jsonb_build_object(
            'price', public.tusken_transport_fleet_price(),
            'max', public.tusken_transport_fleet_max(),
            'used', (select count(*) from public.fleets as f
                     where f.faction = v_faction and f.transport_fleet)
        )
    );

end;
$function$;


-- ---------------------------------------------------------
-- 5. the host's RESET button
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
    delete from public.tusken_intel;
    delete from public.fleets where transport_fleet;

    return jsonb_build_object('ok', true);

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select 'Tuskara' as world,
       public.tusken_spy_price() as spy_price,
       public.tusken_spy_seconds() as spy_seconds,
       public.tusken_transport_fleet_price() as transport_fleet_price,
       public.tusken_transport_fleet_max() as transport_fleets_per_faction,
       (select count(*) from public.tusken_intel) as spies_at_work,
       (select count(*) from public.fleets where transport_fleet) as transport_fleets;
