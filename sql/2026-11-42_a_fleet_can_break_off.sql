-- 2026-11-42 - a fleet can break off
--
-- Until now a fleet that met an enemy was locked in that battle until one
-- side died: the map refused every order with "Fleet is locked in a space
-- battle", and the tactical page simply kept flying it. The way out is now a
-- withdrawal with a price.
--
-- space_break_off(p_battle) does all of it in one transaction:
--
--   * every squad of the leaving fleet leaves a fifth of its men behind as
--     it turns away (space_break_off_price),
--   * the fleet goes back to holding a point in space, displaced well clear
--     of the battle so the scan does not drag it straight back in,
--   * its row leaves the battle, and the fight disperses: the fleet that
--     stayed is released too, because a battle with one side left is not a
--     battle and would otherwise stay pending forever.
--
-- Errors come back as jsonb (ok false plus a code) rather than exceptions,
-- so the screen can say what happened in the player language.
--
-- Safe to run twice: it replaces functions, nothing else.

-- ---------------------------------------------------------
-- 1. the price of turning away
-- ---------------------------------------------------------

create or replace function public.space_break_off_price()
returns numeric
language sql
immutable
as $function$
    select 0.20::numeric
$function$;


-- ---------------------------------------------------------
-- 2. the withdrawal itself
-- ---------------------------------------------------------

create or replace function public.space_break_off(p_battle uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_uid uuid := auth.uid();
    v_battle record;
    v_mine record;
    v_other record;
    v_squads jsonb := '[]'::jsonb;
    v_before numeric := 0;
    v_after numeric := 0;
    v_x numeric;
    v_y numeric;
begin

    if v_uid is null then
        return jsonb_build_object('ok', false, 'code', 'not_authenticated');
    end if;

    if p_battle is null then
        return jsonb_build_object('ok', false, 'code', 'no_battle');
    end if;

    if public.game_frozen() then
        return jsonb_build_object('ok', false, 'code', 'frozen');
    end if;

    select b.id, b.x, b.y, b.status::text as status
      into v_battle
      from public.space_battles as b
     where b.id = p_battle
       for update;

    if v_battle.id is null then
        return jsonb_build_object('ok', false, 'code', 'no_battle');
    end if;

    if v_battle.status is distinct from 'pending' then
        return jsonb_build_object('ok', false, 'code', 'already_over');
    end if;

    select bf.id, bf.fleet_id, bf.fleet_name, bf.squads
      into v_mine
      from public.space_battle_fleets as bf
     where bf.battle_id = p_battle
       and bf.player_id = v_uid
     order by bf.id
     limit 1;

    if v_mine.id is null then
        return jsonb_build_object('ok', false, 'code', 'not_in_battle');
    end if;

    /* the men left behind: every squad of the fleet gives up a fifth of its
       strength (rounded down, so the fifth is always paid), and never its
       last man */

    select coalesce(
               jsonb_agg(
                   jsonb_set(
                       jsonb_set(e.value, '{soldiers}', to_jsonb(x.men)),
                       '{amount}', to_jsonb(x.units)
                   ) order by e.ord
               ),
               '[]'::jsonb
           ),
           coalesce(sum(r.men_before), 0),
           coalesce(sum(x.men), 0)
      into v_squads, v_before, v_after
      from jsonb_array_elements(coalesce(v_mine.squads, '[]'::jsonb)) with ordinality as e(value, ord)
      cross join lateral (
          select
              coalesce(
                  nullif(e.value->>'soldiers', '')::numeric,
                  coalesce(nullif(e.value->>'amount', '')::numeric, 0)
                      * coalesce(nullif(e.value->>'soldiersPerDivision', '')::numeric, 1000)
              ) as men_before,
              greatest(1, coalesce(nullif(e.value->>'soldiersPerDivision', '')::numeric, 1000)) as size
      ) as r
      cross join lateral (
          select
              greatest(1, floor(r.men_before * (1 - public.space_break_off_price()))) as men,
              greatest(1, ceil(greatest(1, floor(r.men_before * (1 - public.space_break_off_price()))) / r.size)) as units
      ) as x;

    /* out of reach: pushed clear of the battle on both axes, beyond the
       radius at which two fleets are made to fight */

    if coalesce(v_battle.x, 50) >= 70 then
        v_x := greatest(2::numeric, coalesce(v_battle.x, 50) - 30);
    else
        v_x := least(98::numeric, coalesce(v_battle.x, 50) + 30);
    end if;

    if coalesce(v_battle.y, 50) >= 72 then
        v_y := greatest(2::numeric, coalesce(v_battle.y, 50) - 20);
    else
        v_y := least(98::numeric, coalesce(v_battle.y, 50) + 20);
    end if;

    update public.fleets as f
       set squads = case when jsonb_array_length(v_squads) > 0 then v_squads else f.squads end,
           status = 'in_space',
           space_x = v_x,
           space_y = v_y,
           dest_x = null,
           dest_y = null
     where f.id = v_mine.fleet_id;

    delete from public.space_battle_fleets as bf where bf.id = v_mine.id;

    /* whoever stayed is free again: the fight has dispersed */

    select bf.id, bf.fleet_id
      into v_other
      from public.space_battle_fleets as bf
     where bf.battle_id = p_battle
     order by bf.id
     limit 1;

    if v_other.id is not null then

        update public.fleets as f
           set status = 'in_space',
               dest_x = null,
               dest_y = null
         where f.id = v_other.fleet_id
           and f.status::text = 'engaged';

        delete from public.space_battle_fleets as bf where bf.battle_id = p_battle;

    end if;

    /* the battle is closed. The status column may be an enum without an
       ending label, so a refused update drops the battle instead of leaving
       a ring on the map that can never be fought */

    begin
        update public.space_battles as b
           set status = 'over'
         where b.id = p_battle;
    exception when others then
        delete from public.space_battles as b where b.id = p_battle;
    end;

    return jsonb_build_object(
        'ok', true,
        'fleet', v_mine.fleet_name,
        'lost', v_before - v_after,
        'left', v_after,
        'x', v_x,
        'y', v_y
    );

end;
$function$;
