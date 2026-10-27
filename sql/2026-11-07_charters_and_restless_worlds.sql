-- =========================================================
-- GALACTIC FRONT — charters: unrest belongs only to the worlds that were taken
--
-- Run this in the Supabase SQL editor AFTER
-- 2026-11-06_orbits_repairs_unrest_and_offices.sql.
-- Safe to run more than once. It changes no world of yours except to put
-- right what the old rule got wrong (see 6).
--
-- WHAT WENT WRONG
--
-- 2026-11-06 gave a world taken by force an unrest bar: it climbs, eats the
-- occupation's stability, and at a hundred the world rises and its cities go
-- back to the Independents. The bar was handed out to every world listed in
-- either occupation book — and the Soviet's book (cs_seed_occupations) lists
-- EVERY world the Combine holds whole, its own capital included. Ultramars
-- therefore earned a bar it was never meant to have and, an hour or two
-- later, the Combine's own capital threw itself to the Independents.
--
-- WHAT THIS PATCH CHANGES
--
--   1. A WORLD A FACTION LIVES ON IS NOT AN OCCUPATION. Whatever book lists
--      it, a faction's own world cannot be restless. Those worlds are
--      written down in planet_charters — Ultramars for the Combine, Free
--      Earth for the Freedom Authority — and a bar is only ever given to a
--      world held by somebody other than its charter holder. Add a row to
--      planet_charters if the map ever gains another home world. The two
--      capitals are also written into the code itself, so emptying that
--      table by accident cannot turn a capital into occupied ground.
--
--   2. A WORLD THAT SIGNED A PACT IS NOT UNDER OCCUPATION EITHER. The old
--      comment promised that, but the code could not tell: a world annexed
--      by treaty (planet_diplomacy.annexed_at) now earns no bar either.
--
--   3. THE CLOCK STOPS WHEN NOBODY IS PLAYING. Once nobody has touched the
--      game for two hours the economy is already at zero (income_mode() is
--      'closed'), and no world can rise in a game nobody is there for.
--
--   4. ONE RISING PER TICK, AT MOST. A tick can cost a faction one world.
--      Even a bug can no longer take the whole galaxy in a single call.
--
--   5. NEVER A FACTION'S LAST WORLD. Unrest may cost a faction a world; it
--      can never end a faction. While a world is everything its holder has
--      left, that world holds at one short of rising, however long the bar
--      has been at the top.
--
-- Together with 1 those are the braces: the game cannot reset itself through
-- unrest again — not by a capital being seeded, not by a cascade, and not by
-- the galaxy being emptied in one go.
--
--   6. AND WHAT THE BUG DID IS PUT RIGHT. Bars that a faction's own world
--      should never have carried are dropped, and a chartered world the
--      revolt threw to the Independents comes home (only a world that is
--      entirely independent is touched: if somebody really holds it, that is
--      a conquest, not this bug).
-- =========================================================


-- ---------------------------------------------------------
-- 1. the charters: which world is whose own
-- ---------------------------------------------------------

create table if not exists public.planet_charters (
    planet text primary key,
    faction text not null,
    created_at timestamptz not null default now()
);

alter table public.planet_charters enable row level security;

/* the two home worlds of the map */
insert into public.planet_charters (planet, faction) values
    ('Ultramars', 'Combine'),
    ('Free Earth', 'Freedom Authority')
on conflict (planet) do nothing;


/* the faction a world belongs to by charter. Anything not written down here
   is nobody's: it has to be taken before it can be held */
create or replace function public.planet_home_faction(p_planet text)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_faction text;
begin

    select k.faction into v_faction
    from public.planet_charters as k
    where k.planet = p_planet;

    /* the capitals are also written here, in the code: a missing or emptied
       table must never turn a home world into ground under occupation */
    if v_faction is null then
        v_faction := case p_planet
                          when 'Ultramars' then 'Combine'
                          when 'Free Earth' then 'Freedom Authority'
                          else null end;
    end if;

    return coalesce(v_faction, 'Independents');

exception when undefined_table then
    return case p_planet
               when 'Ultramars' then 'Combine'
               when 'Free Earth' then 'Freedom Authority'
               else 'Independents' end;

end;
$function$;


-- ---------------------------------------------------------
-- 2. who owes unrest for a world — often nobody
-- ---------------------------------------------------------

/*
   The faction that should carry a bar on this world, or null when it should
   carry none at all:

     - nobody holds it: no bar;
     - its own faction holds it: it has never been taken, no bar;
     - it signed a pact with the faction holding it: not an occupation, no
       bar;
     - anybody else holds it: that holder owes the bar.

   The holder is the faction with the most cities on the world, so a
   contested world answers for whoever is winning it.
*/
create or replace function public.planet_unrest_holder(p_planet text)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_faction text;
begin

    select c.faction into v_faction
    from public.cities as c
    join public.planets as p on p.id = c.planet_id
    where p.name = p_planet
      and c.faction in ('Freedom Authority', 'Combine')
    group by c.faction
    order by count(*) desc, c.faction
    limit 1;

    if v_faction is null then return null; end if;

    if v_faction = public.planet_home_faction(p_planet) then return null; end if;

    begin
        if exists (select 1 from public.planet_diplomacy as d
                    where d.planet = p_planet
                      and d.faction = v_faction
                      and d.annexed_at is not null) then
            return null;
        end if;
    exception when undefined_table or undefined_column then null;
    end;

    return v_faction;

end;
$function$;


-- ---------------------------------------------------------
-- 3. the seed: only the worlds that were taken
-- ---------------------------------------------------------

create or replace function public.unrest_seed()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin

    /* the Congress's book: a world the chamber took */
    begin
        insert into public.planet_unrest (planet, faction, unrest)
        select o.planet, public.planet_unrest_holder(o.planet), 25
        from public.cg_occupations as o
        where public.planet_unrest_holder(o.planet) is not null
        on conflict (planet) do nothing;
    exception when undefined_table or undefined_column then null;
    end;

    /* the Soviet's book: a world under Combine administration */
    begin
        insert into public.planet_unrest (planet, faction, unrest)
        select o.planet, public.planet_unrest_holder(o.planet), 25
        from public.cs_occupations as o
        where public.planet_unrest_holder(o.planet) is not null
        on conflict (planet) do nothing;
    exception when undefined_table or undefined_column then null;
    end;

    /* a world that came home again is not occupied: no bar */
    delete from public.planet_unrest as u
    where not exists (select 1 from public.cities as c
                      join public.planets as p on p.id = c.planet_id
                      where p.name = u.planet
                        and c.faction = u.faction);

end;
$function$;


-- ---------------------------------------------------------
-- 4. the clock: it stops when nobody is playing, one world may rise a
--    tick, and never the last world of a faction
-- ---------------------------------------------------------

/*
   Unrest climbs while the occupation's grip is weak: four points a turn
   at zero stability, two at fifty, none at a hundred. What is left of it
   pulls the occupation's stability down by a twentieth of itself, so a
   world that is left to fester undermines its own administration. At a
   hundred the world rises: every city of it goes back to the
   Independents, the occupation is closed and both books hear of it.
*/
create or replace function public.unrest_tick()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    o record;
    v_stab numeric;
    v_turns integer;
    v_delta numeric;
    v_new numeric;
    v_out jsonb := '[]'::jsonb;
    v_text text;
    v_revolted boolean := false;
    v_held integer;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        return v_out;
    end if;

    if public.game_frozen() then
        return v_out;
    end if;

    /* nobody has touched the game for two hours: the economy is at zero
       already, so the unrest clock stops with it */
    begin
        if public.income_mode() = 'closed' then return v_out; end if;
    exception when undefined_function or undefined_table or undefined_column then null;
    end;

    if not pg_try_advisory_xact_lock(7770006) then
        return v_out;
    end if;

    perform public.unrest_seed();

    for o in select * from public.planet_unrest as u order by u.planet for update loop

        /* a faction's own world, or one that signed a pact, carries no bar at
           all: a stale one is thrown away rather than allowed to rise */
        if o.faction is distinct from public.planet_unrest_holder(o.planet) then
            delete from public.planet_unrest as u where u.planet = o.planet;
            continue;
        end if;

        v_turns := least(12, floor(extract(epoch from (now() - o.last_turn_at))
                                  / public.unrest_turn_seconds())::integer);

        if v_turns <= 0 then continue; end if;

        v_stab := public.occupation_stability(o.planet);
        v_delta := 4 - floor(least(100, greatest(0, v_stab)) / 25);

        v_new := least(public.unrest_revolt_at(),
                       greatest(0, o.unrest + v_delta * v_turns));

        perform public.occupation_lower_stability(o.planet, floor(v_new / 25));

        if v_new >= public.unrest_revolt_at() then

            /* what its faction still holds: unrest may cost a world, never
               the last one, and never two in the same tick */
            select count(distinct p.name) into v_held
            from public.cities as c
            join public.planets as p on p.id = c.planet_id
            where c.faction = o.faction;

            if v_revolted or coalesce(v_held, 0) <= 1 then

                /* the world holds one short of rising and tries again on a
                   later turn, when the situation is different */
                update public.planet_unrest as u
                set unrest = public.unrest_revolt_at() - 1, last_turn_at = now()
                where u.planet = o.planet;

                v_out := v_out || jsonb_build_object('planet', o.planet, 'revolted', false, 'held', true,
                                                     'unrest', public.unrest_revolt_at() - 1);
                continue;

            end if;

            v_revolted := true;

            update public.cities as c
            set faction = 'Independents'
            where c.planet_id = (select p.id from public.planets as p where p.name = o.planet);

            begin
                delete from public.cg_occupations as x where x.planet = o.planet;
            exception when undefined_table then null;
            end;

            begin
                delete from public.cs_occupations as x where x.planet = o.planet;
            exception when undefined_table then null;
            end;

            delete from public.planet_unrest as u where u.planet = o.planet;

            v_text := 'REVOLTA: ' || o.planet || ' levanta-se contra a ocupação e volta à independência.';

            begin
                perform public.cg_log(v_text);
            exception when others then null;
            end;

            begin
                perform public.cs_log(v_text);
            exception when others then null;
            end;

            v_out := v_out || jsonb_build_object('planet', o.planet, 'revolted', true, 'unrest', 100);

        else

            update public.planet_unrest as u
            set unrest = v_new,
                last_turn_at = u.last_turn_at + v_turns * make_interval(secs => public.unrest_turn_seconds())
            where u.planet = o.planet;

            v_out := v_out || jsonb_build_object('planet', o.planet, 'revolted', false, 'unrest', v_new);

        end if;

    end loop;

    return v_out;

end;
$function$;


-- ---------------------------------------------------------
-- 5. every look at the bar keeps the rules honest
-- ---------------------------------------------------------

create or replace function public.unrest_state()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    /* a world that has just been occupied gets its bar the moment somebody
       looks at the screen, not five minutes later */
    perform public.unrest_seed();

    select p.faction into v_faction from public.players as p where p.id = me;

    return jsonb_build_object(
        'turn', public.unrest_turn_seconds(),
        'revolt_at', public.unrest_revolt_at(),
        'worlds', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'planet', u.planet,
                       'faction', u.faction,
                       'unrest', round(u.unrest),
                       'mood', case when u.unrest >= 80 then 'REVOLT'
                                    when u.unrest >= 55 then 'RIOTING'
                                    when u.unrest >= 30 then 'RESTLESS'
                                    else 'CALM' end,
                       'revolts', u.revolts,
                       'mine', u.faction = v_faction
                   ) order by u.unrest desc, u.planet)
            from public.planet_unrest as u
        ), '[]'::jsonb)
    );

end;
$function$;


-- ---------------------------------------------------------
-- 6. what the bug did, put right
-- ---------------------------------------------------------

do $repair$
declare
    k record;
    v_total integer;
    v_all_independent boolean;
    v_note text;
begin

    /* 1. a bar on a world that is a faction's own was never meant to exist */
    delete from public.planet_unrest as u
    where u.faction = public.planet_home_faction(u.planet);

    /* 2. a chartered world the revolt threw to the Independents comes home.
          Only a world that is entirely independent is touched: if somebody
          else is really holding it, that is a conquest and not this bug. */
    for k in select * from public.planet_charters loop

        select count(*)::integer into v_total
        from public.cities as c
        join public.planets as p on p.id = c.planet_id
        where p.name = k.planet;

        if coalesce(v_total, 0) = 0 then continue; end if;

        select bool_and(c.faction = 'Independents') into v_all_independent
        from public.cities as c
        join public.planets as p on p.id = c.planet_id
        where p.name = k.planet;

        if coalesce(v_all_independent, false) then

            update public.cities as c
            set faction = k.faction
            where c.planet_id = (select p.id from public.planets as p where p.name = k.planet);

            v_note := 'RESTAURO: ' || k.planet || ' regressa ao controlo de ' || k.faction
                      || ' — a independência foi um erro do sistema.';

            begin
                perform public.cg_log(v_note);
            exception when undefined_table or undefined_function then null;
            end;

            begin
                perform public.cs_log(v_note);
            exception when undefined_table or undefined_function then null;
            end;

        end if;

    end loop;

end;
$repair$;


-- ---------------------------------------------------------
-- 7. the closing readout
-- ---------------------------------------------------------

select
    (select count(*) from public.planet_charters) as charters,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('planet_home_faction', 'planet_unrest_holder',
                             'unrest_seed', 'unrest_tick', 'unrest_state')) as unrest_functions,
    (select count(*) from public.planet_unrest) as bars,
    (select count(*) from public.planet_unrest as u
      where u.faction = public.planet_home_faction(u.planet)) as bars_that_should_not_exist;
