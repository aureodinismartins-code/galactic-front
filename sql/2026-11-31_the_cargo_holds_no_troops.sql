-- =========================================================
-- GALACTIC FRONT — THE CARGO HOLDS NO TROOPS
--
-- Run AFTER sql/2026-11-30_the_cargo_fleets.sql, in the
-- Supabase SQL editor (SQL > New query). Safe to run more
-- than once, and after every other patch.
--
-- WHY THIS EXISTS
--
--   The last patch blocked soldiers from being written into a
--   fleet flagged as a transport fleet. Two doors were left
--   open:
--
--     * a fleet that was already carrying hulls before the
--       flag existed was never flagged, so the rule did not
--       apply to it — and that is the fleet a player calls
--       their slave fleet;
--     * troops are not written into `squads` when they are
--       ordered: they are queued in `fleet_recruits` and only
--       become soldiers when they finish training. The queue
--       had no rule at all.
--
--   This patch closes both:
--
--     A fleet that holds a hull IS a transport fleet, whoever
--     raised it and whenever. It is flagged here, whatever
--     troops it was carrying are disbanded, and whatever it
--     was training is dropped.
--
--     `fleet_recruits` refuses a row aimed at a transport
--     fleet, so no order can even be placed. The fleets rule
--     from the last patch stays as the second lock.
--
--   A transport fleet therefore carries Tusken and nothing
--   else: it cannot fight, cannot be given an escort, and is
--   taken by any warship that meets it.
-- =========================================================


alter table public.fleets
    add column if not exists transport_fleet boolean not null default false;


/* a hull is the small boat, whoever wrote it down */
update public.tusken_ships
set capacity = public.tusken_ship_capacity()
where capacity is distinct from public.tusken_ship_capacity();


-- ---------------------------------------------------------
-- 1. every fleet that carries a hull is a cargo fleet
-- ---------------------------------------------------------

/* the troops first: a fleet that is about to be flagged cannot be updated
   with soldiers aboard, so they are disbanded while it is still an ordinary
   fleet */
update public.fleets as f
set squads = '[]'::jsonb
where (
        coalesce(f.transport_fleet, false)
        or exists (select 1 from public.tusken_ships as s where s.fleet_id = f.id)
      )
  and f.squads is not null
  and jsonb_typeof(f.squads) = 'array'
  and jsonb_array_length(f.squads) > 0;


update public.fleets as f
set transport_fleet = true
where exists (select 1 from public.tusken_ships as s where s.fleet_id = f.id);


/* and whatever is still armed on a cargo fleet goes too */
update public.fleets as f
set squads = '[]'::jsonb
where coalesce(f.transport_fleet, false)
  and f.squads is not null
  and jsonb_typeof(f.squads) = 'array'
  and jsonb_array_length(f.squads) > 0;


-- ---------------------------------------------------------
-- 2. the queue: no troop is even ordered for a cargo fleet
-- ---------------------------------------------------------

do $$
begin

    if to_regclass('public.fleet_recruits') is null then
        return;
    end if;

    delete from public.fleet_recruits as fr
    using public.fleets as f
    where f.id = fr.fleet_id
      and coalesce(f.transport_fleet, false);

end
$$;


create or replace function public.tusken_transports_take_no_recruits()
returns trigger
language plpgsql
as $function$
declare
    v_cargo boolean;
begin

    select coalesce(f.transport_fleet, false) into v_cargo
    from public.fleets as f
    where f.id = new.fleet_id;

    if coalesce(v_cargo, false) then
        raise exception 'A slaving fleet carries Tusken, not soldiers: no troops can be raised into it';
    end if;

    return new;

end;
$function$;


do $$
begin

    if to_regclass('public.fleet_recruits') is null then
        return;
    end if;

    execute 'drop trigger if exists tusken_transports_take_no_recruits on public.fleet_recruits';

    execute 'create trigger tusken_transports_take_no_recruits ' ||
            'before insert or update of fleet_id on public.fleet_recruits ' ||
            'for each row execute function public.tusken_transports_take_no_recruits()';

end
$$;


-- ---------------------------------------------------------
-- 3. the second lock: a cargo fleet never holds squads
-- ---------------------------------------------------------

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
-- 4. buying a hull flags the fleet it joins, too
--    (a hand-written insert into tusken_ships now makes a
--    fleet a cargo fleet on the next run of this patch)
-- ---------------------------------------------------------

do $$
begin

    if to_regclass('public.fleet_recruits') is null then
        raise notice 'fleet_recruits not found: only the fleets rule is in force';
    end if;

end
$$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select (select count(*) from public.fleets where transport_fleet) as cargo_fleets,
       (select count(*) from public.fleets
        where transport_fleet
          and squads is not null
          and jsonb_array_length(squads) > 0) as armed_cargo_fleets,
       (select count(*) from public.tusken_ships as s
        join public.fleets as f on f.id = s.fleet_id
        where coalesce(f.transport_fleet, false) = false) as hulls_on_warships;
