-- =========================================================
-- 2026-11-36 — the bar says what feeds it
--
-- Run after 2026-11-35. Safe to run twice.
--
-- An occupied world's unrest bar climbed for reasons nobody
-- could see: the tax, the policy, the missing fleet, the
-- relief, and the trouble a saboteur planted before the world
-- was even taken. The bar answered with one number.
--
-- unrest_state() now also says, for every world, which parts
-- move the bar and by how much:
--
--     occupation   +4   the anger of being held at all
--     relief       -n   stability bought with relief, /25
--     policy       +-n  civil rule, reprisals or amnesty
--     fleet        +2   no fleet of ours in orbit
--     tax          +2   for every level above the ordinary one
--     planted      +n   one-off: sabotage, already in the bar
--
-- Only the last is a one-off. The rest are the same terms
-- unrest_tick() adds every turn, so the sum of the five is the
-- delta the world is running at.
-- =========================================================

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
                                + 2 * greatest(0, public.faction_tax_level(u.faction) - 1),

                       /* every part of that number, in the order it is read */
                       'feeds', jsonb_build_array(
                           jsonb_build_object('key', 'occupation', 'value', 4),
                           jsonb_build_object('key', 'relief', 'value',
                               (-floor(least(100, greatest(0, public.occupation_stability(u.planet))) / 25))::int),
                           jsonb_build_object('key', 'policy', 'value',
                               public.planet_policy_delta(u.planet)::int),
                           jsonb_build_object('key', 'fleet', 'value',
                               case when public.planet_garrison_missing(u.faction, u.planet) then 2 else 0 end),
                           jsonb_build_object('key', 'tax', 'value',
                               2 * greatest(0, public.faction_tax_level(u.faction) - 1)),
                           jsonb_build_object('key', 'planted', 'value',
                               coalesce((select t.unrest from public.planet_tinder as t
                                         where t.planet = u.planet and t.applied_at is not null), 0)::int)
                       )

                   ) order by u.unrest desc, u.planet)

            from public.planet_unrest as u

        ), '[]'::jsonb)
    );

end;
$function$;


-- ---------------------------------------------------------
-- what the patch leaves behind
-- ---------------------------------------------------------

select jsonb_build_object(
    'unrest_state rebuilt', (select count(*) from pg_proc
                             where proname = 'unrest_state' and pronamespace = 'public'::regnamespace) > 0,
    'and it answers with the parts', exists (
        select 1 from pg_proc
        where proname = 'unrest_state'
          and prosrc like '%''feeds''%'
    )
) as result;
