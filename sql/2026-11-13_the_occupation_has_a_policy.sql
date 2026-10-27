-- =========================================================
-- GALACTIC FRONT — the occupation has a policy
--
-- Run this in the Supabase SQL editor after 2026-11-12. Safe to run more
-- than once. It can run with maintenance on or off.
--
-- WHAT THIS ADDS
--
--   A world a faction holds whole is administered in one of three ways,
--   and the choice belongs to the faction that holds it (any player of
--   that faction may change it, the way relief is given):
--
--     * CIVIL      — the ordinary administration. Nothing extra either
--                    way: the world pays what it always paid and its
--                    people are no angrier for it;
--     * REPRISALS  — the world is stripped. It pays HALF AGAIN its
--                    income, and its people are the angrier for it:
--                    unrest climbs two points a turn faster;
--     * AMNESTY    — the world is given room. It pays HALF its income,
--                    and its people settle: unrest falls two points a
--                    turn.
--
--   A world with NO GARRISON — not one fleet of the holder's stationed
--   in its orbit with troops aboard — slips: unrest climbs two points a
--   turn faster. Holding a world is a thing you have to stand on, and a
--   world whose garrison was called away starts to show it.
--
--   Neither policy touches a faction's own capital's standing: this is
--   how the world is RUN, not who owns it. Only a world held whole can
--   be administered at all — a contested world has to be taken first.
--
-- New book:  public.planet_policy (one row per world that has a policy of
--            its own; a world with no row is under CIVIL rule).
-- New calls: occupation_set_policy(), occupation_policy_state(),
--            occupation_policy_reset(), planet_policy_income(),
--            planet_policy_delta(), planet_garrison().
-- Rebuilt:   unrest_tick() and unrest_state(), so the bar answers to the
--            policy and to the garrison.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the book
-- ---------------------------------------------------------

create table if not exists public.planet_policy (
    planet text primary key,
    faction text not null,
    policy text not null default 'civil' check (policy in ('civil', 'reprisals', 'amnesty')),
    set_by uuid,
    set_at timestamptz not null default now()
);

alter table public.planet_policy enable row level security;

create index if not exists planet_policy_faction_idx on public.planet_policy (faction);


-- ---------------------------------------------------------
-- 2. the three policies, as numbers
-- ---------------------------------------------------------

create or replace function public.policy_keys()
returns text[]
language sql
immutable
as $function$
    select array['civil', 'reprisals', 'amnesty']
$function$;


/* the policy a world is administered under; a world nobody has decided
   about is under the ordinary one, and so is a world whose row is not a
   policy anybody recognises */
create or replace function public.planet_policy_of(p_planet text)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_policy text;
begin

    begin
        select pp.policy into v_policy from public.planet_policy as pp where pp.planet = p_planet;
    exception when undefined_table then
        return 'civil';
    end;

    if v_policy is null or not (v_policy = any (public.policy_keys())) then return 'civil'; end if;

    return v_policy;

end;
$function$;


/* what one world pays under its policy: reprisals half again, amnesty
   half, the ordinary administration exactly what it always paid */
create or replace function public.planet_policy_income(p_faction text, p_planet text)
returns bigint
language sql
stable
security definer
set search_path to ''
as $function$
    select case public.planet_policy_of(p_planet)
               when 'reprisals' then greatest(0, floor(public.planet_income(p_planet) * 1.5))::bigint
               when 'amnesty' then greatest(0, floor(public.planet_income(p_planet) * 0.5))::bigint
               else public.planet_income(p_planet)
           end
$function$;


/* what the policy does to the world's unrest, per turn */
create or replace function public.planet_policy_delta(p_planet text)
returns numeric
language sql
stable
security definer
set search_path to ''
as $function$
    select case public.planet_policy_of(p_planet)
               when 'reprisals' then 2
               when 'amnesty' then -2
               else 0
           end
$function$;


-- ---------------------------------------------------------
-- 3. the garrison
-- ---------------------------------------------------------

/*
   The fleets of one faction sitting in orbit of a world with troops
   aboard. A fleet that is travelling, building or fighting elsewhere is
   not a garrison, however close it passed.
*/
create or replace function public.planet_garrison(p_faction text, p_planet text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    r record;
    v_fleets integer := 0;
    v_left numeric := 0;
begin

    begin
        for r in
            select f.squads
            from public.fleets as f
            where f.origin = p_planet
              and f.faction = p_faction
              and f.status::text = 'stationed'
              and jsonb_array_length(coalesce(f.squads, '[]'::jsonb)) > 0
        loop
            v_fleets := v_fleets + 1;
            v_left := v_left + coalesce((public.fleet_damage_reading(r.squads) ->> 'left')::numeric, 0);
        end loop;
    exception when undefined_table or undefined_column then
        return jsonb_build_object('fleets', 0, 'soldiers', 0);
    end;

    return jsonb_build_object('fleets', v_fleets, 'soldiers', floor(v_left));

end;
$function$;


create or replace function public.planet_garrison_missing(p_faction text, p_planet text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
    select coalesce((public.planet_garrison(p_faction, p_planet) ->> 'fleets')::integer, 0) <= 0
$function$;


-- ---------------------------------------------------------
-- 4. deciding, and reading back
-- ---------------------------------------------------------

/*
   Any player of the faction that holds a world whole may decide how it
   is administered. A world somebody else still holds a city of is not
   ours to decide about: it has to be taken first.
*/
create or replace function public.occupation_set_policy(p_planet text, p_policy text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_policy text := lower(coalesce(p_policy, ''));
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not (v_policy = any (public.policy_keys())) then
        raise exception 'A world is administered under civil rule, reprisals or amnesty';
    end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null or v_faction = 'Independents' then
        raise exception 'Only the Freedom Authority and the Combine administer worlds';
    end if;

    if not exists (select 1 from public.cities as c
                   join public.planets as p on p.id = c.planet_id
                   where p.name = p_planet
                     and c.faction = v_faction) then
        raise exception 'You hold no city on %', p_planet;
    end if;

    if exists (select 1 from public.cities as c
               join public.planets as p on p.id = c.planet_id
               where p.name = p_planet
                 and c.faction is distinct from v_faction) then
        raise exception '% is not held whole: it has to be taken before it can be administered', p_planet;
    end if;

    insert into public.planet_policy (planet, faction, policy, set_by, set_at)
    values (p_planet, v_faction, v_policy, me, now())
    on conflict (planet) do update
        set faction = excluded.faction,
            policy = excluded.policy,
            set_by = excluded.set_by,
            set_at = now();

    if v_faction = 'Combine' then
        begin
            perform public.cs_log('ADMINISTRAÇÃO: ' || p_planet || ' passa a ' ||
                                  case v_policy when 'reprisals' then 'represálias'
                                                when 'amnesty' then 'amnistia'
                                                else 'administração civil' end || '.');
        exception when others then null;
        end;
    else
        begin
            perform public.cg_log('ADMINISTRAÇÃO: ' || p_planet || ' passa a ' ||
                                  case v_policy when 'reprisals' then 'represálias'
                                                when 'amnesty' then 'amnistia'
                                                else 'administração civil' end || '.');
        exception when others then null;
        end;
    end if;

    return jsonb_build_object(
        'planet', p_planet,
        'faction', v_faction,
        'policy', v_policy,
        'income', public.planet_income(p_planet),
        'paid', public.planet_policy_income(v_faction, p_planet),
        'delta', public.planet_policy_delta(p_planet),
        'garrison', public.planet_garrison(v_faction, p_planet)
    );

end;
$function$;


/*
   Everything the occupied-worlds screens show: the three policies with
   their readings, and every world the caller's faction holds whole with
   the policy in force, what it pays, what the policy does to its unrest
   and whether it is garrisoned.
*/
create or replace function public.occupation_policy_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    return jsonb_build_object(
        'me', v_faction,
        'turn', public.unrest_turn_seconds(),
        'policies', jsonb_build_array(
            jsonb_build_object('key', 'civil', 'income', 100, 'unrest', 0),
            jsonb_build_object('key', 'reprisals', 'income', 150, 'unrest', 2),
            jsonb_build_object('key', 'amnesty', 'income', 50, 'unrest', -2)),
        'worlds', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'planet', w.planet,
                       'policy', public.planet_policy_of(w.planet),
                       'income', public.planet_income(w.planet),
                       'paid', public.planet_policy_income(v_faction, w.planet),
                       'delta', public.planet_policy_delta(w.planet),
                       'garrison', public.planet_garrison(v_faction, w.planet),
                       'held', public.planet_garrison_missing(v_faction, w.planet) = false
                   ) order by w.planet)
            from (
                select p.name as planet
                from public.planets as p
                where exists (select 1 from public.cities as c
                              where c.planet_id = p.id and c.faction = v_faction)
                  and not exists (select 1 from public.cities as c
                                  where c.planet_id = p.id and c.faction is distinct from v_faction)
            ) as w
        ), '[]'::jsonb)
    );

end;
$function$;


/* a policy belongs to a world the faction still holds whole: a world it
   lost, or that rose against it, is the next holder's to decide about */
create or replace function public.unrest_sweep_policies()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin

    begin
        delete from public.planet_policy as pp
        where exists (select 1 from public.cities as c
                      join public.planets as p on p.id = c.planet_id
                      where p.name = pp.planet
                        and c.faction is distinct from pp.faction)
           or not exists (select 1 from public.cities as c
                          join public.planets as p on p.id = c.planet_id
                          where p.name = pp.planet
                            and c.faction = pp.faction);
    exception when undefined_table or undefined_column then null;
    end;

end;
$function$;


/* the host's reset: no world keeps a policy into the next war */
create or replace function public.occupation_policy_reset()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
    g record;
    n integer := 0;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    select * into g from public.game_control as x where x.id = 1;

    if g.host_player is distinct from auth.uid() then
        raise exception 'Only the host may reset the game';
    end if;

    perform set_config('game.bypass', '1', true);

    delete from public.planet_policy;
    get diagnostics n = row_count;

    return n;

end;
$function$;


-- ---------------------------------------------------------
-- 5. the bar answers to the policy and to the garrison
-- ---------------------------------------------------------

/*
   Unrest climbs while the occupation's grip is weak: four points a turn
   at zero stability, two at fifty, none at a hundred — plus what the
   policy adds (reprisals: two more; amnesty: two less) and two more
   again while no garrison of the holder's stands in the world's orbit.
   What is left of it pulls the occupation's stability down by a
   twentieth of itself. At a hundred the world rises: every city of it
   goes back to the Independents, the occupation is closed and both books
   hear of it.
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
    v_policy text;
    v_garrison boolean;
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
    perform public.unrest_sweep_policies();

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
        v_policy := public.planet_policy_of(o.planet);
        v_garrison := not public.planet_garrison_missing(o.faction, o.planet);

        v_delta := 4 - floor(least(100, greatest(0, v_stab)) / 25)
                   + public.planet_policy_delta(o.planet)
                   + case when v_garrison then 0 else 2 end;

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
            delete from public.planet_policy as pp where pp.planet = o.planet;

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

            v_out := v_out || jsonb_build_object('planet', o.planet, 'revolted', false, 'unrest', v_new,
                                                 'policy', v_policy, 'garrison', v_garrison, 'delta', v_delta);

        end if;

    end loop;

    return v_out;

end;
$function$;


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
    perform public.unrest_sweep_policies();

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
                       'mine', u.faction = v_faction,
                       'policy', public.planet_policy_of(u.planet),
                       'garrison', public.planet_garrison(u.faction, u.planet),
                       'delta', 4 - floor(least(100, greatest(0, public.occupation_stability(u.planet))) / 25)
                                + public.planet_policy_delta(u.planet)
                                + case when public.planet_garrison_missing(u.faction, u.planet) then 2 else 0 end
                   ) order by u.unrest desc, u.planet)
            from public.planet_unrest as u
        ), '[]'::jsonb)
    );

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.tables
      where table_schema = 'public' and table_name = 'planet_policy') as policy_table,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('planet_policy_of', 'planet_policy_income', 'planet_policy_delta',
                             'planet_garrison', 'planet_garrison_missing', 'occupation_set_policy',
                             'occupation_policy_state', 'unrest_sweep_policies',
                             'occupation_policy_reset')) as new_functions,
    public.policy_keys() as policies;
