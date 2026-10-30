-- =========================================================
-- GALACTIC FRONT — THE TAX AND THE TINDERBOX
--
-- Run AFTER sql/2026-11-34_the_reset_catches_up.sql, in the
-- Supabase SQL editor (SQL > New query). Safe to run more
-- than once, and after every other patch.
--
-- WHAT THIS CHANGES
--
--   1. RELIEF IS PAID. A bill still costs nothing to bring
--      and nothing to pass, but when a relief bill PASSES the
--      Authority pays for the relief itself: 400 credits out
--      of its treasury. The books say so either way.
--
--   2. NO ENVOYS BETWEEN THE TWO SIDES. Freedom Authority and
--      the Combine are at war: a Diplomatic Mission and a
--      Fraternal Pact have nothing left to do, so any such
--      bill or directive is dropped the moment it is filed
--      (a player cannot file one any more, and the delegates
--      stop wasting the chamber's time with them).
--
--   3. A SLAVING FLEET IS NOT A WARSHIP. A bill to dismantle
--      a fleet can no longer name a transport fleet.
--
--   4. THE TAX CAN COME DOWN. cg_tax_cut() and
--      cs_quota_cut() lower the level by one, out of the
--      treasury of nothing but goodwill: popularity rises
--      instead of falling.
--
--   5. TAX FEEDS UNREST. Every occupied world held by a
--      faction at the top tax level carries two more points
--      of unrest a turn. A cheap government is a quiet one.
--
--   6. SABOTAGE MAKES TROUBLE, NOT FRIENDS. Arming the
--      rebels and throwing a government out no longer roll
--      dice and no longer move the relations bar: they are
--      only possible on a world that has already begun to
--      LEAN TO THE OTHER SIDE, and what they leave behind is
--      unrest. When that world is taken, the bar opens part
--      way up — the rebels are armed and waiting — and if the
--      owner lets it stand there it rises against the
--      occupation and declares itself independent again.
--
--   7. NO BAR ON THE INDEPENDENTS AND NO BAR ON A CAPITAL.
--      The clock sweeps those away even if a stale one
--      survives somewhere.
-- =========================================================


-- ---------------------------------------------------------
-- 1. what the treasury is asked for
-- ---------------------------------------------------------

create or replace function public.relief_price()
returns integer
language sql
immutable
as $function$
    select 400
$function$;


/* the tax a faction collects, which is also the tax its worlds resent */
create or replace function public.faction_tax_level(p_faction text)
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v integer := 0;
begin

    if p_faction = 'Freedom Authority' then
        begin
            select s.tax_level into v from public.cg_state as s where s.id = 1;
        exception when undefined_table or undefined_column then v := 0;
        end;
    elsif p_faction = 'Combine' then
        begin
            select s.quota into v from public.cs_state as s where s.id = 1;
        exception when undefined_table or undefined_column then v := 0;
        end;
    end if;

    return coalesce(v, 0);

end;
$function$;


-- ---------------------------------------------------------
-- 2. the relief is paid when it passes
-- ---------------------------------------------------------

create or replace function public.cg_relief_is_paid()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_price integer := public.relief_price();
    v_credits numeric;
begin

    if coalesce(new.ptype, '') <> 'resource_allocation' then
        return new;
    end if;

    if coalesce(new.status, '') <> 'passed' then
        return new;
    end if;

    if tg_op = 'UPDATE' and coalesce(old.status, '') = 'passed' then
        return new;
    end if;

    update public.faction_treasury as ft
    set credits = greatest(0, ft.credits - v_price)
    where ft.faction = 'Freedom Authority';

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft
    where ft.faction = 'Freedom Authority';

    begin
        perform public.cg_log('RELIEF: a Autoridade pagou ' || v_price ||
                              ' créditos pela ajuda aprovada (tesouro: ' ||
                              coalesce(round(v_credits), 0) || ').');
    exception when others then null;
    end;

    return new;

end;
$function$;


drop trigger if exists cg_relief_is_paid on public.cg_proposals;

create trigger cg_relief_is_paid
after insert or update of status on public.cg_proposals
for each row
execute function public.cg_relief_is_paid();


-- ---------------------------------------------------------
-- 3. no envoys between two sides at war, and no slaver
--    named for the breaker's yard
-- ---------------------------------------------------------

create or replace function public.refuse_wartime_bills()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_kind text;
    v_fleet text;
    v_transport boolean;
begin

    v_kind := coalesce(to_jsonb(new)->>'ptype', to_jsonb(new)->>'dtype', '');

    /* envoys between the two factions: the war has made them pointless */
    if v_kind = 'diplomacy' then
        return null;
    end if;

    /* a transport fleet is not a warship: it is never dismantled here */
    if v_kind = 'fleet_revocation' then

        v_fleet := coalesce(to_jsonb(new)->>'fleet_id', to_jsonb(new)->>'fleet');

        if v_fleet is not null and v_fleet <> '' then
            begin
                select f.transport_fleet into v_transport
                from public.fleets as f
                where f.id::text = v_fleet;

                if coalesce(v_transport, false) then
                    return null;
                end if;
            exception when others then null;
            end;
        end if;

    end if;

    return new;

end;
$function$;


drop trigger if exists cg_refuse_wartime_bills on public.cg_proposals;

create trigger cg_refuse_wartime_bills
before insert on public.cg_proposals
for each row
execute function public.refuse_wartime_bills();


drop trigger if exists cs_refuse_wartime_bills on public.cs_directives;

create trigger cs_refuse_wartime_bills
before insert on public.cs_directives
for each row
execute function public.refuse_wartime_bills();


-- ---------------------------------------------------------
-- 4. the tax comes down
-- ---------------------------------------------------------

create or replace function public.cg_tax_cut()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    st record;
    v_level integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is distinct from 'Freedom Authority' then
        raise exception 'Only the Freedom Authority lowers its own taxes';
    end if;

    select * into st from public.cg_state as s where s.id = 1 for update;

    v_level := coalesce(st.tax_level, 0);

    if v_level <= 0 then
        raise exception 'The tax is already at nothing';
    end if;

    update public.cg_state as s
    set tax_level = v_level - 1,
        popularity = least(100, coalesce(s.popularity, 50) + 5),
        last_tax_at = now()
    where s.id = 1;

    begin
        perform public.cg_log('IMPOSTOS: o nível desce para ' || (v_level - 1) ||
                              '. O povo respira: popularidade +5.');
    exception when others then null;
    end;

    return jsonb_build_object('ok', true, 'tax_level', v_level - 1,
                              'popularity', least(100, coalesce(st.popularity, 50) + 5));

end;
$function$;


create or replace function public.cs_quota_cut()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    st record;
    v_level integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is distinct from 'Combine' then
        raise exception 'Only the Combine lowers its own plan';
    end if;

    select * into st from public.cs_state as s where s.id = 1 for update;

    v_level := coalesce(st.quota, 1);

    if v_level <= 1 then
        raise exception 'The plan is already at its lowest level';
    end if;

    update public.cs_state as s
    set quota = v_level - 1,
        confidence = least(100, coalesce(s.confidence, 55) + 5),
        last_quota_at = now()
    where s.id = 1;

    begin
        perform public.cs_log('PLANO: a cota desce para ' || (v_level - 1) ||
                              '. O plenário aprova: confiança +5.');
    exception when others then null;
    end;

    return jsonb_build_object('ok', true, 'quota', v_level - 1,
                              'confidence', least(100, coalesce(st.confidence, 55) + 5));

end;
$function$;


-- ---------------------------------------------------------
-- 5. the tinder: what sabotage leaves behind in a world
-- ---------------------------------------------------------

create table if not exists public.planet_tinder (
    planet text primary key,
    unrest numeric not null default 0,
    last_armed_at timestamptz,
    last_coup_at timestamptz,
    applied_at timestamptz,
    created_at timestamptz not null default now()
);

alter table public.planet_tinder enable row level security;


/* the planted trouble lands on the bar the first time the world is taken */
create or replace function public.tinder_apply()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin

    update public.planet_unrest as u
    set unrest = least(public.unrest_revolt_at() - 1, u.unrest + t.unrest)
    from public.planet_tinder as t
    where t.planet = u.planet
      and t.applied_at is null
      and t.unrest > 0;

    update public.planet_tinder as t
    set applied_at = now()
    where t.applied_at is null
      and t.unrest > 0
      and exists (select 1 from public.planet_unrest as u where u.planet = t.planet);

end;
$function$;


-- ---------------------------------------------------------
-- 6. arming rebels, and throwing a government out
--
--    Only on an independent world that has begun to lean to
--    the OTHER side: that is the world that is slipping away,
--    and the answer to it is trouble, never friendship. No
--    dice are thrown and no relations move; the world keeps
--    its lean and gains a fuse.
-- ---------------------------------------------------------

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
    v_planet_id text;
    v_price integer;
    v_wait integer;
    v_last timestamptz;
    v_credits numeric;
    v_mine integer;
    v_theirs integer;
    v_add numeric;
    v_tinder numeric;
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

    if p_action = 'arm_rebels' then
        v_price := public.rebel_price();
        v_wait := public.rebel_wait();
        v_add := 15;
        v_text := 'As armas chegaram aos rebeldes de ';
        select t.last_armed_at into v_last from public.planet_tinder as t where t.planet = p_planet;
    else
        v_price := public.coup_price();
        v_wait := public.coup_wait();
        v_add := 35;
        v_text := 'O governo de ';
        select t.last_coup_at into v_last from public.planet_tinder as t where t.planet = p_planet;
    end if;

    if v_last is not null and v_last > now() - make_interval(secs => v_wait) then
        raise exception 'That has already been tried in %: wait % s', p_planet,
            ceil(extract(epoch from (v_last + make_interval(secs => v_wait) - now())))::integer;
    end if;

    select coalesce(d2.relation, 0) into v_mine
    from public.planet_diplomacy as d2
    where d2.planet = p_planet and d2.faction = v_faction;

    select coalesce(d2.relation, 0) into v_theirs
    from public.planet_diplomacy as d2
    where d2.planet = p_planet and d2.faction = v_other;

    v_mine := coalesce(v_mine, 0);
    v_theirs := coalesce(v_theirs, 0);

    /* the world has to be turning away from us before there is anything to
       break: its people must already lean to the other side */
    if not (v_theirs >= 25 and v_theirs > v_mine) then
        raise exception 'That world has not begun to turn to the other side: no one there would take up arms for you';
    end if;

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft where ft.faction = v_faction;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'That costs % credits', v_price;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = v_faction;

    insert into public.planet_tinder as t (planet, unrest, last_armed_at, last_coup_at)
    values (p_planet, v_add,
            case when p_action = 'arm_rebels' then now() end,
            case when p_action = 'overthrow_government' then now() end)
    on conflict (planet) do update
        set unrest = least(99, t.unrest + v_add),
            last_armed_at = coalesce(excluded.last_armed_at, t.last_armed_at),
            last_coup_at = coalesce(excluded.last_coup_at, t.last_coup_at),
            applied_at = case when t.applied_at is null then null else now() end;

    select coalesce(t.unrest, 0) into v_tinder
    from public.planet_tinder as t where t.planet = p_planet;

    /* a coup closes the embassy doors on both sides for a while */
    if p_action = 'overthrow_government' then

        v_locked := now() + make_interval(secs => public.coup_lock());

        update public.planet_diplomacy as d2
        set locked_until = v_locked
        where d2.planet = p_planet;

    end if;

    if v_faction = 'Combine' then
        perform public.cs_log(v_text || p_planet || ': os rebeldes estão armados, a inquietação sobe para '
                              || round(v_tinder) || '.');
        begin
            perform public.cg_log(v_text || p_planet || ': o Combine mexe na poeira, a inquietação sobe para '
                                  || round(v_tinder) || '.');
        exception when others then null;
        end;
    else
        begin
            perform public.cg_log(v_text || p_planet || ': os rebeldes estão armados, a inquietação sobe para '
                                  || round(v_tinder) || '.');
        exception when others then null;
        end;
        perform public.cs_log(v_text || p_planet || ': a Autoridade mexe na poeira, a inquietação sobe para '
                              || round(v_tinder) || '.');
    end if;

    return jsonb_build_object(
        'planet', p_planet,
        'action', p_action,
        'tinder', round(v_tinder),
        'leaning', 'them',
        'relation', v_mine,
        'theirs', v_theirs,
        'locked', coalesce(ceil(extract(epoch from (v_locked - now())))::integer, 0),
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
-- 7. the clock: the tax feeds the fire, the tinder takes
--    hold, and no bar is kept on an independent world or a
--    capital
-- ---------------------------------------------------------

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
    v_tax integer;
    v_capital boolean;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        return v_out;
    end if;

    if public.game_frozen() then
        return v_out;
    end if;

    begin
        if public.income_mode() = 'closed' then return v_out; end if;
    exception when undefined_function or undefined_table or undefined_column then null;
    end;

    if not pg_try_advisory_xact_lock(7770006) then
        return v_out;
    end if;

    perform public.unrest_seed();
    perform public.unrest_sweep_policies();
    perform public.tinder_apply();

    for o in select * from public.planet_unrest as u order by u.planet for update loop

        /* an independent world and a capital carry no bar at all, and a world
           nobody occupies carries none either */
        v_capital := false;

        begin
            v_capital := public.is_capital_world(o.planet);
        exception when undefined_function then v_capital := false;
        end;

        if v_capital or public.planet_unrest_holder(o.planet) is null
           or o.faction is distinct from public.planet_unrest_holder(o.planet) then

            delete from public.planet_unrest as u where u.planet = o.planet;
            continue;

        end if;

        v_turns := least(12, floor(extract(epoch from (now() - o.last_turn_at))
                                  / public.unrest_turn_seconds())::integer);

        if v_turns <= 0 then continue; end if;

        v_stab := public.occupation_stability(o.planet);
        v_policy := public.planet_policy_of(o.planet);
        v_garrison := not public.planet_garrison_missing(o.faction, o.planet);

        /* the government's own tax is felt on every world it holds: one level
           is the ordinary burden, the top level is two points a turn of anger */
        v_tax := public.faction_tax_level(o.faction);

        v_delta := 4 - floor(least(100, greatest(0, v_stab)) / 25)
                   + public.planet_policy_delta(o.planet)
                   + case when v_garrison then 0 else 2 end
                   + 2 * greatest(0, v_tax - 1);

        v_new := least(public.unrest_revolt_at(),
                       greatest(0, o.unrest + v_delta * v_turns));

        perform public.occupation_lower_stability(o.planet, floor(v_new / 25));

        if v_new >= public.unrest_revolt_at() then

            select count(distinct p.name) into v_held
            from public.cities as c
            join public.planets as p on p.id = c.planet_id
            where c.faction = o.faction;

            if v_revolted or coalesce(v_held, 0) <= 1 then

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
            delete from public.planet_tinder as t where t.planet = o.planet;

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
                                                 'policy', v_policy, 'garrison', v_garrison,
                                                 'delta', v_delta, 'tax', v_tax);

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
                       'tax', public.faction_tax_level(u.faction),
                       'delta', 4 - floor(least(100, greatest(0, public.occupation_stability(u.planet))) / 25)
                                + public.planet_policy_delta(u.planet)
                                + case when public.planet_garrison_missing(u.faction, u.planet) then 2 else 0 end
                                + 2 * greatest(0, public.faction_tax_level(u.faction) - 1)
                   ) order by u.unrest desc, u.planet)
            from public.planet_unrest as u
        ), '[]'::jsonb)
    );

end;
$function$;


-- ---------------------------------------------------------
-- 8. what the diplomacy tab is told
--
--    The same independent worlds as before, now with the
--    trouble already planted in them and with the one answer
--    that decides whether the two buttons work: is this world
--    turning to the other side?
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

        'planets', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'planet', w.name,
                       'cities', w.cities,
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
                           else '' end,
                       'leaned', greatest(public.diplo_tint(d.relation), public.diplo_tint(o.relation)),
                       'locked', greatest(0, coalesce(ceil(extract(epoch from
                                     (d.locked_until - now())))::integer, 0)),
                       'armed', greatest(0, coalesce(ceil(extract(epoch from
                                     (t.last_armed_at + make_interval(secs => public.rebel_wait()) - now())))::integer, 0)),
                       'couped', greatest(0, coalesce(ceil(extract(epoch from
                                     (t.last_coup_at + make_interval(secs => public.coup_wait()) - now())))::integer, 0)),
                       'tinder', round(coalesce(t.unrest, 0)),
                       /* the two buttons only answer to a world that is
                          already slipping to the other side */
                       'gate', (coalesce(o.relation, 0) >= 25
                                and coalesce(o.relation, 0) > coalesce(d.relation, 0))
                   ) order by coalesce(d.relation, 0) desc, w.name)
            from (
                select p.name, count(*)::integer as cities
                from public.planets as p
                join public.cities as c on c.planet_id = p.id
                where not exists (select 1 from public.cities as c2
                                  where c2.planet_id = p.id
                                    and c2.faction in ('Freedom Authority', 'Combine'))
                group by p.name
            ) as w
            left join public.planet_diplomacy as d
                   on d.planet = w.name and d.faction = v_faction
            left join public.planet_diplomacy as o
                   on o.planet = w.name and o.faction = v_other
            left join public.planet_tinder as t
                   on t.planet = w.name
        ), '[]'::jsonb)

    );

end;
$function$;


-- ---------------------------------------------------------
-- 9. the host's reset clears the tinder too
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

    begin
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
    exception when undefined_table then null;
    end;

    begin
        update public.cs_commissars as m
        set loyalty = coalesce((select c.loyalty from public.cs_currents as c where c.id = m.current_id), 55),
            is_disgraced = false,
            active = true;
    exception when undefined_column or undefined_table then null;
    end;

    begin
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
    exception when undefined_column or undefined_table then null;
    end;

    begin
        delete from public.planet_diplomacy;
    exception when undefined_table then null;
    end;

    begin
        delete from public.player_presence;
    exception when undefined_table then null;
    end;

    begin
        delete from public.ceasefires;
    exception when undefined_table then null;
    end;

    begin
        delete from public.supply_lines;
    exception when undefined_table then null;
    end;

    begin
        delete from public.planet_tinder;
    exception when undefined_table then null;
    end;

    begin
        update public.cg_state as s
        set president_player = null,
            term_no = 0,
            term_end = null
        where s.id = 1;
    exception when undefined_column or undefined_table then null;
    end;

    begin
        delete from public.planet_unrest;
    exception when undefined_table then null;
    end;

    begin
        delete from public.cg_speaker_votes;
        delete from public.cg_speaker_candidates;
        delete from public.cg_speaker_election;
        update public.cg_speaker_state as s
        set speaker_player = null,
            speaker_name = null,
            speaker_party = null,
            term_no = 0,
            term_end = null,
            veto_used = false,
            last_election_at = null
        where s.id = 1;
    exception when undefined_table then null;
    end;

    begin
        update public.cg_state as s set last_tax_at = now() where s.id = 1;
    exception when undefined_column or undefined_table then null;
    end;

    begin
        delete from public.planet_charters;
    exception when undefined_table then null;
    end;

    begin
        delete from public.news_articles;
    exception when undefined_table then null;
    end;

    begin
        delete from public.music_tracks;
    exception when undefined_table then null;
    end;

    begin
        delete from public.music_playback;
    exception when undefined_table then null;
    end;

    begin
        delete from public.planet_policy;
    exception when undefined_table then null;
    end;

    begin
        delete from public.cg_committees;
    exception when undefined_table then null;
    end;

    begin
        delete from public.cs_committees;
    exception when undefined_table then null;
    end;

    begin
        delete from public.cg_ministers;
    exception when undefined_table then null;
    end;

    begin
        delete from public.cs_ministers;
    exception when undefined_table then null;
    end;

    begin
        delete from public.tusken_convoys;
        delete from public.tusken_workforce;
        delete from public.tusken_colonies;
        delete from public.tusken_ships;
        delete from public.tusken_intel;
        delete from public.tusken_routes;
        delete from public.fleets where transport_fleet;
    exception when undefined_table or undefined_column then null;
    end;

    return jsonb_build_object('ok', true);

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select public.relief_price() as relief_price,
       public.faction_tax_level('Freedom Authority') as authority_tax,
       public.faction_tax_level('Combine') as combine_quota,
       (select count(*) from information_schema.routines
         where routine_schema = 'public'
           and routine_name in ('cg_tax_cut', 'cs_quota_cut', 'tinder_apply', 'diplo_strike')) as functions,
       (select count(*) from public.planet_tinder) as tinder;
