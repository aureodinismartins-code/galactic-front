-- 2026-11-47 - the gate asks the database, and the database looks
--
-- Patch 2026-11-46 decided who holds a world with one SQL function that
-- named cities.planet_id and planets.id outright. A SQL function is checked
-- when it is created, so on a database where the cities table keys its planet
-- some other way - cities.planet, cities.planet_name, or the planet's name in
-- planet_id - that function was never created, the old congress_can_attack
-- stayed behind it, and the attack gate went on asking the chamber.
--
-- This one looks first and then asks:
--
--   * planet_held_by() finds which column the cities use (planet_id, planet
--     or planet_name), matches the world by name or by id, and never touches
--     a column it has not seen,
--   * can_attack_planet() answers the whole question in one call and says why,
--     so the page and the rules cannot drift apart,
--   * attack_gate_debug() reports what the database sees, for the day the
--     answer is still a surprise.
--
-- Run this after 2026-11-46; it replaces what that patch could not build.
-- Safe to run twice.

-- ---------------------------------------------------------
-- 1. who holds a world, whatever the cities call their planet
-- ---------------------------------------------------------

create or replace function public.planet_held_by(p_planet text, p_faction text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_name text := btrim(coalesce(p_planet, ''));
    v_col text;
    v_hit boolean := false;
begin

    if v_name = '' or coalesce(p_faction, '') = '' then
        return false;
    end if;

    if to_regclass('public.cities') is null then
        return false;
    end if;

    select a.attname into v_col
    from pg_attribute as a
    where a.attrelid = to_regclass('public.cities')
      and a.attnum > 0
      and not a.attisdropped
      and a.attname in ('planet_id', 'planet', 'planet_name')
    order by array_position(array['planet_id', 'planet', 'planet_name'], a.attname)
    limit 1;

    if v_col is null then
        return false;
    end if;

    /* the key may be the world's name */
    begin
        execute 'select exists (select 1 from public.cities as c '
                'where c.faction = $1 and lower(c.' || quote_ident(v_col) || '::text) = lower($2))'
          into v_hit
          using p_faction, v_name;
    exception when others then v_hit := false;
    end;

    if coalesce(v_hit, false) then
        return true;
    end if;

    /* or it may be the world's id */
    if to_regclass('public.planets') is not null then
        begin
            execute 'select exists (select 1 from public.cities as c '
                    'join public.planets as p on p.id::text = c.' || quote_ident(v_col) || '::text '
                    'where c.faction = $1 and lower(p.name) = lower($2))'
              into v_hit
              using p_faction, v_name;
        exception when others then v_hit := false;
        end;
    end if;

    return coalesce(v_hit, false);

end;
$function$;


-- ---------------------------------------------------------
-- 2. one question, one answer
-- ---------------------------------------------------------

create or replace function public.can_attack_planet(p_planet text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_rival text;
begin

    if me is not null then
        begin
            select p.faction into v_faction from public.players as p where p.id = me;
        exception when others then v_faction := null;
        end;
    end if;

    v_faction := btrim(coalesce(v_faction, ''));

    v_rival := case
                   when v_faction = 'Combine' then 'Freedom Authority'
                   when v_faction = 'Freedom Authority' then 'Combine'
                   else ''
               end;

    /* enemy ground: the war is already on, and only a ceasefire stops it */
    if v_rival <> '' and public.planet_held_by(p_planet, v_rival) then

        if public.ceasefire_stands() then
            return jsonb_build_object('ok', false, 'reason', 'ceasefire', 'planet', p_planet);
        end if;

        return jsonb_build_object('ok', true, 'reason', 'war', 'planet', p_planet);

    end if;

    /* a world nobody holds is the chamber's decision */
    if v_faction = 'Combine' then
        return jsonb_build_object('ok', public.cs_can_attack(p_planet),
                                  'reason', 'campaign', 'planet', p_planet);
    end if;

    return jsonb_build_object('ok', public.congress_can_attack(p_planet),
                              'reason', 'declaration', 'planet', p_planet);

end;
$function$;


-- ---------------------------------------------------------
-- 3. what the database sees, when the answer is still a surprise
-- ---------------------------------------------------------

create or replace function public.attack_gate_debug(p_planet text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_cols text;
begin

    begin
        select p.faction into v_faction from public.players as p where p.id = me;
    exception when others then v_faction := null;
    end;

    select string_agg(a.attname, ', ' order by a.attnum) into v_cols
    from pg_attribute as a
    where a.attrelid = to_regclass('public.cities')
      and a.attnum > 0
      and not a.attisdropped;

    return jsonb_build_object(
        'planet', p_planet,
        'me', v_faction,
        'city_columns', v_cols,
        'held_by_combine', public.planet_held_by(p_planet, 'Combine'),
        'held_by_authority', public.planet_held_by(p_planet, 'Freedom Authority'),
        'ceasefire', public.ceasefire_stands(),
        'congress', public.congress_can_attack(p_planet),
        'soviet', public.cs_can_attack(p_planet),
        'answer', public.can_attack_planet(p_planet)
    );

end;
$function$;
