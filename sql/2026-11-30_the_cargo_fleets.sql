-- =========================================================
-- GALACTIC FRONT — THE CARGO FLEETS
--
-- Run AFTER sql/2026-11-29_the_eyes_and_the_ledger.sql, in
-- the Supabase SQL editor (SQL > New query). Safe to run
-- more than once, and after every other patch.
--
-- WHAT THIS CHANGES
--
--   1. SMALLER HULLS. A slave hull holds 1,000 Tusken, not
--      2,500: it is the small, unarmed boat of the fleet, not
--      a troop transport. Hulls already bought are trimmed to
--      the new size (the price does not change).
--
--   2. HULLS SAIL ONLY WITH CARGO. A hull can only be given
--      to a TRANSPORT FLEET — the congress-free fleet from
--      the previous patch. It is refused for a warship, so a
--      battle fleet can never borrow the lift of the pens.
--      Hulls left on warships by an older save are brought
--      over to a transport fleet of their faction (one is
--      raised for them, free, if they have none).
--
--   3. NO SOLDIERS IN A SLAVING FLEET. A transport fleet
--      carries Tusken and nothing else. A trigger on the
--      fleets table refuses any troops raised into one,
--      whichever screen asks — the recruiting office, a bill,
--      or a hand-written query. If a transport fleet is
--      already holding soldiers, they are disbanded here.
--
--   Because a slaving fleet has no soldiers, an enemy warship
--   waiting in the orbit is never fought off: the load is
--   taken. Clear the orbit with a battle fleet first.
--
--   The host's RESET button wipes everything here as before.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the small hull
-- ---------------------------------------------------------

create or replace function public.tusken_ship_capacity()
returns bigint
language sql
immutable
as $function$
    select 1000::bigint
$function$;


update public.tusken_ships
set capacity = public.tusken_ship_capacity()
where capacity is distinct from public.tusken_ship_capacity();


-- ---------------------------------------------------------
-- 2. a hull only sails with a cargo fleet
--
--    Every hull that is not on a transport fleet is moved to
--    one, so nobody loses the lift they paid for.
-- ---------------------------------------------------------

alter table public.fleets
    add column if not exists transport_fleet boolean not null default false;


do $$
declare
    f record;
    v_id uuid;
    v_name text;
    v_n integer;
begin

    for f in
        select distinct s.faction
        from public.tusken_ships as s
        left join public.fleets as fl on fl.id = s.fleet_id
        where fl.id is null
           or coalesce(fl.transport_fleet, false) = false
    loop

        select fl.id into v_id
        from public.fleets as fl
        where fl.faction = f.faction
          and fl.transport_fleet
        order by (coalesce(fl.status::text, '') = 'stationed') desc, fl.name
        limit 1;

        if v_id is null then

            v_name := 'Cargo Fleet';
            v_n := 1;

            while exists (
                select 1 from public.fleets as x
                where x.faction = f.faction and x.name = v_name
            ) loop
                v_n := v_n + 1;
                v_name := 'Cargo Fleet ' || v_n;
            end loop;

            insert into public.fleets (
                player_id, name, faction, origin, destination,
                status, departure_time, arrival_time, squads, transport_fleet
            )
            values (
                (select p.id from public.players as p where p.faction = f.faction limit 1),
                v_name, f.faction, 'Tuskara', null,
                'stationed', null, null, '[]'::jsonb, true
            )
            returning id into v_id;

        end if;

        update public.tusken_ships as s
        set fleet_id = v_id
        where s.faction = f.faction
          and (
              s.fleet_id is null
              or s.fleet_id not in (select x.id from public.fleets as x where x.transport_fleet)
          );

    end loop;

exception when undefined_table then
    null;
end
$$;


-- ---------------------------------------------------------
-- 3. a slaving fleet carries no soldiers
-- ---------------------------------------------------------

/* the troops already aboard are disbanded: they were raised before this rule */
update public.fleets
set squads = '[]'::jsonb
where coalesce(transport_fleet, false)
  and squads is not null
  and jsonb_typeof(squads) = 'array'
  and jsonb_array_length(squads) > 0;


create or replace function public.tusken_transports_carry_no_soldiers()
returns trigger
language plpgsql
as $function$
begin

    if coalesce(new.transport_fleet, false)
       and new.squads is not null
       and jsonb_typeof(new.squads) = 'array'
       and jsonb_array_length(new.squads) > 0 then

        raise exception 'A slaving fleet carries Tusken, not soldiers: no troops can be raised into it';

    end if;

    return new;

end;
$function$;


drop trigger if exists tusken_transports_carry_no_soldiers on public.fleets;

create trigger tusken_transports_carry_no_soldiers
before insert or update of squads, transport_fleet on public.fleets
for each row
execute function public.tusken_transports_carry_no_soldiers();


-- ---------------------------------------------------------
-- 4. buying a hull: cargo fleets only
-- ---------------------------------------------------------

drop function if exists public.tusken_buy_ship(uuid);

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
        raise exception 'Choose the transport fleet the hull is to join';
    end if;

    select * into f from public.fleets as x where x.id = p_fleet;

    if f.id is null then
        raise exception 'There is no such fleet';
    end if;

    if f.faction is distinct from v_faction then
        raise exception 'That fleet is not yours';
    end if;

    /* a hull is a cargo ship: it never sails with the battle line */
    if not coalesce(f.transport_fleet, false) then
        raise exception 'A hull sails only in a transport fleet: form one first, and no chamber has to approve it';
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

end;
$function$;


-- ---------------------------------------------------------
-- 5. the board is told which fleets are cargo fleets
-- ---------------------------------------------------------

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
            select fp.id, fp.name, fp.status, fp.origin,
                   coalesce(fl.transport_fleet, false) as transport_fleet
            from public.fleet_positions() as fp
            left join public.fleets as fl on fl.id = fp.id
            where fp.faction = p_faction
            order by (fp.status <> 'stationed'), fp.name
        loop

            v_list := v_list || jsonb_build_object(
                'id', f.id,
                'name', f.name,
                'status', f.status,
                'at', public.tusken_fleet_at(f.id),
                'stationed', f.status = 'stationed',
                'transport', f.transport_fleet,
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

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select 'Tuskara' as world,
       public.tusken_ship_capacity() as slaves_per_hull,
       public.tusken_ship_price() as hull_price,
       (select count(*) from public.tusken_ships) as hulls,
       (select count(*) from public.tusken_ships as s
        join public.fleets as f on f.id = s.fleet_id
        where coalesce(f.transport_fleet, false)) as hulls_in_cargo_fleets,
       (select count(*) from public.fleets
        where transport_fleet
          and squads is not null
          and jsonb_array_length(squads) > 0) as armed_cargo_fleets;
