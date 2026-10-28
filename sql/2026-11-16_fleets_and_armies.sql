-- =========================================================
-- GALACTIC FRONT — the army, read as one thing
--
-- Run in the Supabase SQL editor, after 2026-11-15. Safe to
-- run more than once.
--
-- What it adds:
--
--   1. A READING OF EVERY FLEET. A fleet was only ever read
--      one at a time, by opening it: there was no way to see
--      the army. fleet_readiness() grades one fleet from its
--      squads (fit, under strength, mauled, skeleton) and
--      fleet_army_board() gives every fleet of the caller's
--      faction with its divisions, what is missing and what
--      the dock would charge — plus the faction's totals.
--
--   2. THE WHOLE ARMY TO THE DOCK AT ONCE. repair_army()
--      sends every fleet of yours that is in orbit and under
--      strength to the dock in one order. The treasury pays
--      for all of them or nothing is repaired: a faction that
--      cannot afford the army is told so instead of ending up
--      with half of it patched and a bill it did not expect.
--
-- The dock itself is 2026-11-06's, and this patch does not
-- rewrite it: repair_army() calls repair_fleet() for each
-- fleet, so a fleet is repaired by exactly the rule the
-- single-fleet button already uses.
-- =========================================================


-- ---------------------------------------------------------
-- 1. how ready is one fleet
--
-- Nothing is stored: the reading is made from the squads the
-- fleet already carries, so it can never go stale.
-- ---------------------------------------------------------

create or replace function public.fleet_readiness(p_squads jsonb)
returns jsonb
language plpgsql
immutable
as $function$
declare
    d jsonb;
    v numeric;
begin

    d := public.fleet_damage_reading(p_squads);
    v := coalesce((d ->> 'fraction')::numeric, 1);

    return d || jsonb_build_object(
        'grade', case when v >= 0.99 then 'fit'
                      when v >= 0.70 then 'under'
                      when v >= 0.35 then 'mauled'
                      else 'skeleton'
                 end
    );

end;
$function$;


-- ---------------------------------------------------------
-- 2. the army of a faction, fleet by fleet
-- ---------------------------------------------------------

create or replace function public.fleet_army_board()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    f record;
    r jsonb;
    v_list jsonb := '[]'::jsonb;
    v_fleets integer := 0;
    v_full numeric := 0;
    v_left numeric := 0;
    v_under integer := 0;
    v_price integer := 0;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    for f in
        select * from public.fleets as x
        where x.faction = v_faction
        order by x.name
    loop

        r := public.fleet_readiness(f.squads);

        v_fleets := v_fleets + 1;
        v_full := v_full + coalesce((r ->> 'full')::numeric, 0);
        v_left := v_left + coalesce((r ->> 'left')::numeric, 0);

        if coalesce((r ->> 'missing')::numeric, 0) > 0 then
            v_under := v_under + 1;
            if f.status::text = 'stationed' then
                v_price := v_price + public.fleet_repair_price((r ->> 'missing')::numeric);
            end if;
        end if;

        v_list := v_list || jsonb_build_array(jsonb_build_object(
            'fleet', f.id,
            'name', f.name,
            'origin', f.origin,
            'destination', f.destination,
            'status', f.status::text,
            'stationed', f.status::text = 'stationed',
            'mine', f.player_id = me,
            'grade', r ->> 'grade',
            'fraction', coalesce((r ->> 'fraction')::numeric, 1),
            'full', coalesce((r ->> 'full')::numeric, 0),
            'left', coalesce((r ->> 'left')::numeric, 0),
            'missing', coalesce((r ->> 'missing')::numeric, 0),
            'price', public.fleet_repair_price(coalesce((r ->> 'missing')::numeric, 0)),
            'divisions', coalesce((
                select jsonb_agg(jsonb_build_object(
                           'type', e ->> 'type',
                           'amount', greatest(0, coalesce((e ->> 'amount')::numeric, 0)),
                           'full', public.fleet_squad_size(e ->> 'type')
                                       * greatest(0, coalesce((e ->> 'amount')::numeric, 0)),
                           'left', least(
                               public.fleet_squad_size(e ->> 'type')
                                   * greatest(0, coalesce((e ->> 'amount')::numeric, 0)),
                               greatest(0, coalesce(
                                   nullif(e ->> 'soldiers', '')::numeric,
                                   public.fleet_squad_size(e ->> 'type')
                                       * greatest(0, coalesce((e ->> 'amount')::numeric, 0))))
                           )
                       ))
                from jsonb_array_elements(coalesce(f.squads, '[]'::jsonb)) as e
            ), '[]'::jsonb)
        ));

    end loop;

    return jsonb_build_object(
        'faction', v_faction,
        'fleets', v_list,
        'totals', jsonb_build_object(
            'fleets', v_fleets,
            'full', v_full,
            'left', v_left,
            'missing', greatest(0, v_full - v_left),
            'under', v_under,
            'price', v_price
        )
    );

end;
$function$;


-- ---------------------------------------------------------
-- 3. the whole army to the dock
-- ---------------------------------------------------------

/*
   Every fleet of mine that is in orbit and under strength is repaired,
   by 2026-11-06's own repair_fleet(), which is also what charges for it.
   A fleet that is under way is not at a dock and is left alone. If the
   treasury cannot pay for one of them, repair_fleet raises and the whole
   order rolls back: nothing is repaired and nothing is charged.
*/
create or replace function public.repair_army()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    f record;
    r jsonb;
    one jsonb;
    v_fleets integer := 0;
    v_repaired numeric := 0;
    v_paid integer := 0;
    v_credits numeric;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    for f in
        select * from public.fleets as x
        where x.player_id = me
        order by x.name
    loop

        r := public.fleet_readiness(f.squads);

        if coalesce((r ->> 'missing')::numeric, 0) > 0
           and f.status::text = 'stationed' then

            one := public.repair_fleet(f.id);

            v_fleets := v_fleets + 1;
            v_repaired := v_repaired + coalesce((one ->> 'repaired')::numeric, 0);
            v_paid := v_paid + coalesce((one ->> 'paid')::integer, 0);
            v_credits := coalesce((one ->> 'credits')::numeric, v_credits);

        end if;

    end loop;

    if v_fleets = 0 then
        raise exception 'Nothing in orbit needs the dock';
    end if;

    begin
        perform public.cg_log('DOCA: ' || v_fleets ||
                              ' frota(s) reparada(s), ' || v_paid || ' créditos pagos.');
    exception when others then null;
    end;

    return jsonb_build_object(
        'fleets', v_fleets,
        'repaired', v_repaired,
        'paid', v_paid,
        'credits', v_credits
    );

end;
$function$;


-- ---------------------------------------------------------
-- 4. sanity output
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('fleet_readiness', 'fleet_army_board', 'repair_army')) as new_calls,
    (select count(*) from public.fleets) as fleets;
