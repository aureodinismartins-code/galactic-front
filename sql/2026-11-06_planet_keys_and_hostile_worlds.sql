-- =========================================================
-- GALACTIC FRONT — a world has a name, not a number
--
-- Run this in the Supabase SQL editor (SQL > New query).
-- Safe to run more than once, and after every other patch.
--
-- What it changes:
--
--   1. THE EMBASSIES WORK AGAIN. Every diplomacy action was dying
--      with "invalid input syntax for type integer: Asteron":
--      the patches looked the world up in planets.id and kept the
--      answer in an integer, while a planet's id in this game is
--      its NAME (that is why the planet screens ask for cities by
--      "planet_id": "Asteron"). The three functions below keep the
--      key as text, so an envoy, a shipment of rifles and a coup
--      all get through.
--
--   2. A WORLD THAT ALREADY FLIES THE OTHER FLAG NEEDS NO
--      DECLARATION. The moment a world signs with the Combine it is
--      enemy ground to the Freedom Authority, and the other way
--      round: the chambers' permission checks now answer "yes" for
--      a world the enemy already holds, instead of demanding a
--      fresh declaration of war against a planet that is already at
--      war with you.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the dirty tricks and the embassy, keyed by name
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
    v_planet_id text;
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
-- 2. a world of the other faction is already at war with you
-- ---------------------------------------------------------

/*
   The Congress's check is the base game's function; it is kept as
   congress_can_attack_base and answered here, so that a world the
   Combine already holds is attackable without a new declaration.
   Renaming is guarded: on a database that never had the base
   function, this patch leaves the name alone and simply answers.
*/
do $do$
begin
    if exists (select 1 from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'congress_can_attack')
       and not exists (select 1 from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace
                       where n.nspname = 'public' and p.proname = 'congress_can_attack_base') then
        begin
            execute 'alter function public.congress_can_attack(text) rename to congress_can_attack_base';
        exception when others then null;
        end;
    end if;
end
$do$;

create or replace function public.congress_can_attack(p_planet text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_base boolean;
begin

    /* the world is already the Combine's: this is not a new war */
    if exists (select 1 from public.cities as c
               join public.planets as p on p.id = c.planet_id
               where p.name = p_planet
                 and c.faction = 'Combine') then
        return true;
    end if;

    begin
        execute 'select public.congress_can_attack_base($1)' into v_base using p_planet;
        return coalesce(v_base, true);
    exception
        when undefined_function or undefined_table or invalid_schema_name then return true;
    end;

end;
$function$;


create or replace function public.cs_can_attack(p_planet text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
begin

    if me is null then return true; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    /* only the Combine is held to the Soviet */
    if coalesce(v_faction, '') <> 'Combine' then return true; end if;

    /* a world already held by the Authority is enemy ground: the war
       against it does not need a fresh campaign from the Soviet */
    if exists (select 1 from public.cities as c
               join public.planets as p on p.id = c.planet_id
               where p.name = p_planet
                 and c.faction = 'Freedom Authority') then
        return true;
    end if;

    return exists (
        select 1 from public.cs_authorizations as a
        where a.kind = 'war' and a.planet = p_planet and not a.used
    );

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('diplo_strike', 'send_envoy', 'arm_rebels',
                             'overthrow_government', 'congress_can_attack', 'cs_can_attack')) as diplomacy_functions,
    (select count(*) from information_schema.routines
      where routine_schema = 'public' and routine_name = 'congress_can_attack_base') as congress_base_kept,
    (select count(*) from information_schema.parameters as pa
       join information_schema.routines as r on r.specific_name = pa.specific_name
      where r.routine_schema = 'public' and r.routine_name = 'diplo_strike'
        and pa.parameter_name = 'p_planet' and pa.data_type = 'text') as strike_takes_a_name;
