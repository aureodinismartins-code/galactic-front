-- 2026-11-46 - the war stands until a ceasefire
--
-- The two authorities are at war from the moment the front opens, and only a
-- ceasefire both sides sign puts the guns down for a while. The attack gate
-- never learned that: every attack on an enemy-held world still asked the
-- chamber whether it had declared war on that planet, so a Freedom fleet at
-- the Combine capital was told "Congress has not declared war on Ultramars".
--
-- Three things change:
--
--   * planet_held_by(planet, faction) answers who holds a world, matching the
--     cities whether they key their planet by id or by name,
--   * congress_can_attack() lets an attack on a Combine-held world through,
--     because the war is already on, and refuses it only while a ceasefire
--     stands,
--   * cs_can_attack() does the same for a Freedom-held world.
--
-- A world nobody holds is still a decision for the chamber: the declaration
-- and the campaign authorisation are asked for exactly as before.
--
-- Safe to run twice: it replaces three functions.

-- ---------------------------------------------------------
-- 1. who holds a world
-- ---------------------------------------------------------

create or replace function public.planet_held_by(p_planet text, p_faction text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
    select exists (
        select 1
        from public.cities as c
        left join public.planets as p on p.id::text = c.planet_id::text
        where c.faction = p_faction
          and (c.planet_id::text = p_planet or p.name = p_planet)
    )
$function$;


/* is a ceasefire standing right now? (false on a database without them) */
create or replace function public.ceasefire_stands()
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
    begin
        return public.ceasefire_active();
    exception when undefined_function or undefined_table or invalid_schema_name then
        return false;
    end;
end;
$function$;


-- ---------------------------------------------------------
-- 2. the Freedom Authority attacks the Combine without a bill
-- ---------------------------------------------------------

create or replace function public.congress_can_attack(p_planet text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_base boolean;
begin

    if public.planet_held_by(p_planet, 'Combine') then

        /* the war is already on: only a ceasefire stops an attack */
        return not public.ceasefire_stands();

    end if;

    begin
        execute 'select public.congress_can_attack_base($1)' into v_base using p_planet;
        return coalesce(v_base, true);
    exception
        when undefined_function or undefined_table or invalid_schema_name then return true;
    end;

end;
$function$;


-- ---------------------------------------------------------
-- 3. and the Combine attacks the Authority without a campaign
-- ---------------------------------------------------------

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

    if public.planet_held_by(p_planet, 'Freedom Authority') then

        /* the war is already on: only a ceasefire stops an attack */
        return not public.ceasefire_stands();

    end if;

    return exists (
        select 1 from public.cs_authorizations as a
        where a.kind = 'war' and a.planet = p_planet and not a.used
    );

end;
$function$;
