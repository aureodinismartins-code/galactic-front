-- =========================================================
-- GALACTIC FRONT — the blockade reaches the capital
--
-- Run this in the Supabase SQL editor after 2026-11-13. Safe to run more
-- than once. It can run with maintenance on or off.
--
-- WHAT WAS WRONG
--
--   The supply net built by 2026-11-04 gives the capital a free pass: its
--   own orbit was never checked, so an enemy fleet sitting over the
--   capital starved nobody. Everything the capital feeds was still
--   supplied while the seat of government was under blockade, which is
--   the one place a corridor is worth cutting.
--
-- WHAT CHANGES
--
--   1. THE CAPITAL's OWN ORBIT IS A LINK LIKE ANY OTHER. An enemy fleet
--      within orbit range of the capital closes the capital, and a
--      closed capital starves every world behind it — the whole tree is
--      read inward from a capital that can now be cut off.
--
--   2. THE OCCUPATION'S POLICY IS WHAT THE WORLD CARRIES. A world under
--      REPRISALS carries half again its income into the treasury and one
--      under AMNESTY carries half (2026-11-13); the network now reads
--      that figure, so a policy change is felt on the next payment. The
--      world's raw production is still reported, as 'potential', so the
--      screens can show what the policy costs.
--
--   3. THE READING SAYS WHAT IS LOST. supply_state() now answers with
--      the net's potential, what it is actually carrying, what the
--      blockade is costing and how many worlds are cut, so the map can
--      say a corridor is bleeding instead of only drawing it red.
--
-- Rebuilt: supply_network() and supply_state(). New: supply_orbit_blockers().
-- =========================================================


-- ---------------------------------------------------------
-- 1. what sits in orbit of a single point
-- ---------------------------------------------------------

/*
   The fleets an enemy has sitting in the orbit of one world. The supply
   net used to ask this question only about the two ends of a hop; the
   capital has no hop above it, so it needs the question on its own.
*/
create or replace function public.supply_orbit_blockers(p_faction text, ax numeric, ay numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_orbit numeric := public.orbit_range();
begin

    if ax is null or ay is null then return '[]'::jsonb; end if;

    return coalesce((
        select jsonb_agg(jsonb_build_object(
                   'fleet', f.id,
                   'name', f.name,
                   'faction', f.faction,
                   'x', f.x,
                   'y', f.y,
                   'why', 'orbit'
               ) order by f.name)
        from public.fleet_positions() as f
        where f.faction is distinct from p_faction
          and f.x is not null
          and f.y is not null
          and sqrt(power(f.x - ax, 2) + power(f.y - ay, 2)) <= v_orbit
    ), '[]'::jsonb);

end;
$function$;


-- ---------------------------------------------------------
-- 2. the network, with a capital that can be cut off
-- ---------------------------------------------------------

/*
   For one faction, every world it holds whole, joined into a tree that runs
   to the capital: each world's parent is the nearest world of ours that is
   strictly closer to the capital. Processing in order of that distance means
   a parent is always settled before its children, so "supplied" can simply
   be carried down the branches.

   The capital is the root and has no link above it, but its own orbit is
   watched like everybody else's: an enemy fleet over it shuts the tree.
*/
create or replace function public.supply_network(p_faction text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_capital text := public.capital_planet(p_faction);
    w record;
    v_worlds jsonb := '[]'::jsonb;
    v_links jsonb := '[]'::jsonb;
    v_open text[] := array[]::text[];
    v_own boolean;
    v_ok boolean;
    v_block jsonb;
    v_total bigint := 0;
    v_potential bigint := 0;
    v_cut integer := 0;
    v_capital_blocked boolean := false;
    v_depth integer;
    v_depths jsonb := '{}'::jsonb;
begin

    for w in
        with cap as (
            select pp.x, pp.y from public.planet_positions as pp where pp.name = v_capital
        ),
        owned as (
            select p.name,
                   pp.x,
                   pp.y,
                   public.planet_income(p.name) as potential,
                   public.planet_policy_income(p_faction, p.name) as income,
                   public.planet_policy_of(p.name) as policy,
                   case
                       when pp.x is not null and pp.y is not null and cap.x is not null
                           then sqrt(power(pp.x - cap.x, 2) + power(pp.y - cap.y, 2))
                       else 1000000
                   end as dcap
            from public.planets as p
            left join public.planet_positions as pp on pp.name = p.name
            cross join cap
            where exists (select 1 from public.cities as c where c.planet_id = p.id)
              and not exists (select 1 from public.cities as c
                              where c.planet_id = p.id and c.faction is distinct from p_faction)
        )
        select o.name, o.x, o.y, o.income, o.potential, o.policy, o.dcap, o.capital,
               par.name as parent, par.x as px, par.y as py
        from (
            select o0.*, (o0.name = v_capital) as capital from owned as o0
        ) as o
        left join lateral (
            select o2.name, o2.x, o2.y
            from owned as o2
            where o2.name <> o.name
              and o2.dcap < o.dcap
            order by sqrt(power(o2.x - o.x, 2) + power(o2.y - o.y, 2)), o2.name
            limit 1
        ) as par on true
        order by o.dcap, o.name
    loop

        if w.capital or w.parent is null then

            /* the root: nothing above it, but its own orbit is watched */
            v_block := public.supply_orbit_blockers(p_faction, w.x, w.y);
            v_own := jsonb_array_length(v_block) = 0;
            v_ok := v_own;

            if w.capital and not v_own then v_capital_blocked := true; end if;

        else

            v_block := public.supply_segment_blockers(p_faction, w.x, w.y, w.px, w.py);
            v_own := jsonb_array_length(v_block) = 0;

            /* supplied only if its own link is clear AND the world it feeds
               through is supplied too */
            v_ok := v_own and (w.parent = any (v_open));

        end if;

        if v_ok then
            v_open := v_open || w.name;
            v_total := v_total + coalesce(w.income, 0);
        else
            v_cut := v_cut + 1;
        end if;

        v_potential := v_potential + coalesce(w.income, 0);

        v_depth := case
                       when w.capital or w.parent is null then 0
                       else coalesce((v_depths ->> w.parent)::integer, 0) + 1
                   end;

        v_depths := jsonb_set(v_depths, array[w.name], to_jsonb(v_depth), true);

        v_worlds := v_worlds || jsonb_build_object(
            'planet', w.name,
            'parent', w.parent,
            'x', w.x,
            'y', w.y,
            'income', coalesce(w.income, 0),
            'potential', coalesce(w.potential, 0),
            'policy', w.policy,
            'capital', w.capital,
            'depth', v_depth,
            'own', v_own,
            'open', v_ok,
            'blockers', coalesce(v_block, '[]'::jsonb)
        );

        if w.parent is not null and not w.capital then
            v_links := v_links || jsonb_build_object(
                'from', w.name,
                'to', w.parent,
                'x1', w.x,
                'y1', w.y,
                'x2', w.px,
                'y2', w.py,
                'open', v_ok,
                'own', v_own
            );
        end if;

    end loop;

    return jsonb_build_object(
        'faction', p_faction,
        'capital', v_capital,
        'capital_blocked', v_capital_blocked,
        'total', v_total,
        'potential', v_potential,
        'lost', greatest(0, v_potential - v_total),
        'cut', v_cut,
        'worlds', v_worlds,
        'links', v_links
    );

end;
$function$;


-- ---------------------------------------------------------
-- 3. the screen: what the net carries and what it is losing
-- ---------------------------------------------------------

create or replace function public.supply_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_credits numeric;
    n jsonb;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft where ft.faction = v_faction;

    n := public.supply_network(v_faction);

    return jsonb_build_object(
        'me', v_faction,
        'capital', n -> 'capital',
        'capital_blocked', n -> 'capital_blocked',
        'credits', coalesce(v_credits, 0),
        'corridor', public.supply_corridor(),
        'orbit', public.orbit_range(),
        'total', n -> 'total',
        'potential', n -> 'potential',
        'lost', n -> 'lost',
        'cut', n -> 'cut',
        'worlds', n -> 'worlds',
        'links', n -> 'links'
    );

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('supply_orbit_blockers', 'supply_network', 'supply_state')) as functions,
    public.supply_corridor() as corridor,
    public.orbit_range() as orbit;
