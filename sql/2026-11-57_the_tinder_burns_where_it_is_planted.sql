-- =========================================================
-- GALACTIC FRONT — 2026-11-57 — the tinder burns where it is planted
-- =========================================================
--
-- Needs: 2026-11-06 (planet_unrest), 2026-11-13 (the world's garrison),
--        2026-11-35 (planet_tinder and the prices), 2026-11-38 (the
--        rebel bands — read through dynamic SQL so a deployment that
--        skipped it still runs this patch).
--
--
-- WHAT WAS WRONG
--
--    Arming rebels and throwing a government out were aimed at an
--    INDEPENDENT world, and only at one that had already begun to lean
--    to the other side. Two things followed:
--
--      * a world that answers to nobody got a fuse instead of a bar.
--        That fuse (planet_tinder) landed on the bar "the moment the
--        world is taken" — taken by ANYBODY, the player included, so
--        sabotage could be paid for twice and burn the payer;
--
--      * a world the other faction really commands — the only place
--        where a rising has a government to fight — could not be
--        touched at all.
--
--    And the two buttons lit up or went dark with the RIVAL'S relations,
--    which says nothing whatever about who holds the world. A world that
--    was friendly to the player at 55 could still show "ARM THE REBELS",
--    and a world that had turned to the rival showed one button dark for
--    a cooldown with no clock on it. That is what did not make sense.
--
--
-- WHAT THIS PATCH DOES
--
--    1. diplo_strike() answers only where the OTHER faction commands:
--       a world with at least one of its cities. Your own world and an
--       independent world are both refused, in words that say why.
--
--    2. The unrest no longer waits in a fuse: it lands straight on that
--       world's own bar (planet_unrest), the same bar the clock carries
--       and the crowd answers for. 15 for the rifles, 35 for the coup,
--       capped at the revolt mark.
--
--    3. The cooldowns stay in planet_tinder (ten and twenty minutes) so
--       one world can only be stirred so often.
--
--    4. planetary_state() is what the map's new view reads: every world
--       one of the two factions holds, its bar, its mood, the men in the
--       streets and the garrison that faces them.
--
--    Nothing of 35 or 38 is rewritten: the clock, the bands, the calm and
--    the fight all keep working on the bar this patch now feeds.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the strike lands on the bar of the world it is aimed at
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
    v_owner text;
    v_price integer;
    v_wait integer;
    v_last timestamptz;
    v_credits numeric;
    v_add numeric;
    v_bar numeric;
    v_cap numeric;
    v_capital boolean := false;
    v_text text;
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

    if not exists (select 1 from public.planets as p where p.name = p_planet) then
        raise exception 'There is no world called %', p_planet;
    end if;

    /* who commands it: the faction of a city standing on the world */
    select c.faction into v_owner
    from public.cities as c
    join public.planets as p on p.id = c.planet_id
    where p.name = p_planet
      and c.faction in ('Freedom Authority', 'Combine')
    limit 1;

    if v_owner is null then
        raise exception '% answers to nobody: there is no government there to rise, only a court to court', p_planet;
    end if;

    if v_owner = v_faction then
        raise exception 'You command % yourself: the trouble you plant would land on your own bar', p_planet;
    end if;

    /* a capital carries no bar at all: the clock sweeps it away every turn */
    begin
        v_capital := public.is_capital_world(p_planet);
    exception when undefined_function then v_capital := false;
    end;

    if v_capital then
        raise exception '% carries no bar of unrest: its own court swallows the anger', p_planet;
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
        v_text := 'Um golpe mexe com ';
        select t.last_coup_at into v_last from public.planet_tinder as t where t.planet = p_planet;
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

    /* the record of the attempt: the clock only, the bar is elsewhere now */
    insert into public.planet_tinder as t (planet, last_armed_at, last_coup_at)
    values (p_planet,
            case when p_action = 'arm_rebels' then now() end,
            case when p_action = 'overthrow_government' then now() end)
    on conflict (planet) do update
        set last_armed_at = coalesce(excluded.last_armed_at, t.last_armed_at),
            last_coup_at = coalesce(excluded.last_coup_at, t.last_coup_at);

    /* and the unrest lands on the holder's own bar, where the clock will
       carry it and the crowd will answer for it */
    v_cap := public.unrest_revolt_at();

    insert into public.planet_unrest as u (planet, faction, unrest)
    values (p_planet, v_owner, least(v_cap, v_add))
    on conflict (planet) do update
        set unrest = least(v_cap, u.unrest + v_add),
            faction = excluded.faction;

    select coalesce(u.unrest, 0) into v_bar
    from public.planet_unrest as u where u.planet = p_planet;

    v_bar := least(v_cap, coalesce(v_bar, 0));

    if v_faction = 'Combine' then
        perform public.cs_log(v_text || p_planet || ': a inquietação sobe para ' || round(v_bar) || '.');
        begin
            perform public.cg_log(v_text || p_planet || ': o Combine mexe na poeira, a inquietação sobe para '
                                  || round(v_bar) || '.');
        exception when others then null;
        end;
    else
        begin
            perform public.cg_log(v_text || p_planet || ': a Autoridade mexe na poeira, a inquietação sobe para '
                                  || round(v_bar) || '.');
        exception when others then null;
        end;
        perform public.cs_log(v_text || p_planet || ': a inquietação sobe para ' || round(v_bar) || '.');
    end if;

    return jsonb_build_object(
        'planet', p_planet,
        'action', p_action,
        'unrest', round(v_bar),
        'tinder', round(v_bar),
        'cap', v_cap,
        'owner', v_owner,
        'cost', v_price,
        'credits', coalesce(v_credits, 0) - v_price
    );

end;
$function$;


/* the two names the map calls, unchanged: they are the same strike */
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
-- 2. every world one of the two factions holds, and its bar
--
--    One reading for the map's planetary view: the bar, the mood,
--    what feeds it, the men in the streets, the garrison that faces
--    them, and whether the other faction is the one commanding it.
-- ---------------------------------------------------------

create or replace function public.planetary_state()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_other text;
    v_cap numeric;
    v_pass integer;
    v_rows jsonb := '[]'::jsonb;
    w record;
    v_unrest numeric;
    v_owner text;
    v_capital boolean;
    v_bands integer;
    v_men numeric;
    v_garrison jsonb;
    v_delta numeric;
    v_armed integer;
    v_couped integer;
    v_revolts integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine work the worlds';
    end if;

    v_other := case when v_faction = 'Combine' then 'Freedom Authority' else 'Combine' end;
    v_cap := public.unrest_revolt_at();

    begin
        v_pass := public.rebel_pass_at();
    exception when undefined_function then v_pass := 60;
    end;

    for w in
        select p.name as planet,
               coalesce(min(c.faction) filter (where c.faction in ('Freedom Authority', 'Combine')),
                        'Independents') as owner
        from public.planets as p
        join public.cities as c on c.planet_id = p.id
        group by p.name
        order by p.name
    loop

        v_owner := w.owner;

        /* a world nobody commands has no bar: it is the embassy book's */
        if v_owner = 'Independents' then continue; end if;

        v_unrest := 0;
        v_bands := 0;
        v_men := 0;
        v_garrison := '{}'::jsonb;
        v_delta := 0;
        v_armed := 0;
        v_couped := 0;
        v_revolts := 0;
        v_capital := false;

        select u.unrest, u.revolts into v_unrest, v_revolts
        from public.planet_unrest as u where u.planet = w.planet;

        v_unrest := least(v_cap, greatest(0, coalesce(v_unrest, 0)));
        v_revolts := coalesce(v_revolts, 0);

        begin
            execute 'select count(*), coalesce(sum(r.soldiers), 0) from public.planet_rebels as r where r.planet = $1'
            into v_bands, v_men using w.planet;
        exception when undefined_table or undefined_column then
            v_bands := 0;
            v_men := 0;
        end;

        begin
            v_garrison := public.planet_garrison(v_owner, w.planet);
        exception when undefined_function then v_garrison := '{}'::jsonb;
        end;

        begin
            v_capital := public.is_capital_world(w.planet);
        exception when undefined_function then v_capital := false;
        end;

        /* what feeds the bar, the same sum the clock adds every turn */
        begin
            v_delta := 4 - floor(least(100, greatest(0, public.occupation_stability(w.planet))) / 25)
                       + public.planet_policy_delta(w.planet)
                       + case when public.planet_garrison_missing(v_owner, w.planet) then 2 else 0 end
                       + 2 * greatest(0, public.faction_tax_level(v_owner) - 1);
        exception when undefined_function then v_delta := 0;
        end;

        begin
            select greatest(0, coalesce(ceil(extract(epoch from
                       (t.last_armed_at + make_interval(secs => public.rebel_wait()) - now())))::integer, 0))
            into v_armed
            from public.planet_tinder as t where t.planet = w.planet;

            select greatest(0, coalesce(ceil(extract(epoch from
                       (t.last_coup_at + make_interval(secs => public.coup_wait()) - now())))::integer, 0))
            into v_couped
            from public.planet_tinder as t where t.planet = w.planet;
        exception when undefined_table then
            v_armed := 0;
            v_couped := 0;
        end;

        v_armed := coalesce(v_armed, 0);
        v_couped := coalesce(v_couped, 0);

        v_rows := v_rows || jsonb_build_object(
            'planet', w.planet,
            'owner', v_owner,
            'mine', v_owner = v_faction,
            'theirs', v_owner = v_other,
            'capital', v_capital,
            'unrest', round(v_unrest),
            'cap', v_cap,
            'mood', case when v_unrest >= 80 then 'REVOLT'
                         when v_unrest >= 55 then 'RIOTING'
                         when v_unrest >= 30 then 'RESTLESS'
                         else 'CALM' end,
            'delta', v_delta,
            'revolts', v_revolts,
            'bands', v_bands,
            'men', v_men,
            'soldiers', coalesce((v_garrison ->> 'soldiers')::numeric, 0),
            'fleets', coalesce((v_garrison ->> 'fleets')::integer, 0),
            'armed', v_armed,
            'couped', v_couped
        );

    end loop;

    return jsonb_build_object(
        'faction', v_faction,
        'other', v_other,
        'cap', v_cap,
        'pass', v_pass,
        'turn', public.unrest_turn_seconds(),
        'prices', jsonb_build_object(
            'rebel', public.rebel_price(),
            'coup', public.coup_price()
        ),
        'waits', jsonb_build_object(
            'rebel', public.rebel_wait(),
            'coup', public.coup_wait()
        ),
        'planets', v_rows
    );

end;
$function$;


-- ---------------------------------------------------------
-- 3. what the patch leaves behind
-- ---------------------------------------------------------

select jsonb_build_object(
    'the strike answers only where the other commands',
        exists (select 1 from pg_proc
                where proname = 'diplo_strike' and pronamespace = 'public'::regnamespace
                  and prosrc like '%answers to nobody%'),
    'and refuses the player''s own worlds',
        exists (select 1 from pg_proc
                where proname = 'diplo_strike' and pronamespace = 'public'::regnamespace
                  and prosrc like '%You command %'),
    'the bar takes the trouble',
        exists (select 1 from pg_proc
                where proname = 'diplo_strike' and pronamespace = 'public'::regnamespace
                  and prosrc like '%insert into public.planet_unrest%'),
    'the worlds are read',
        exists (select 1 from pg_proc
                where proname = 'planetary_state' and pronamespace = 'public'::regnamespace),
    'and the reading names the other side',
        exists (select 1 from pg_proc
                where proname = 'planetary_state' and pronamespace = 'public'::regnamespace
                  and prosrc like '%''theirs''%')
) as result;
