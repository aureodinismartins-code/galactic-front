-- =========================================================
-- 2026-11-37 — the crowd has to be faced
--
-- Run after 2026-11-36. Safe to run twice.
--
-- A world that is climbing towards a hundred could only be
-- watched. There was no way to answer it before it rose:
--
--     CALM THE WORLD   600 credits from the treasury,
--                      unrest -20, once every five minutes
--
--     FIGHT THE REBELS once the rebels are actually up
--                      (unrest 55), with a fleet of ours in
--                      orbit: unrest -25 and one soldier in
--                      twenty of that garrison dead, once
--                      every five minutes
--
-- Both are refused on a capital and on a world we do not
-- hold whole, which carry no bar at all. Neither touches the
-- policy or the relations: this is money and troops, the
-- answer that comes after the embassy has failed.
-- =========================================================

do $do$
begin
    if to_regclass('public.planet_unrest') is not null then
        alter table public.planet_unrest add column if not exists last_calm_at timestamptz;
        alter table public.planet_unrest add column if not exists last_fight_at timestamptz;
    end if;
end;
$do$;


-- ---------------------------------------------------------
-- 1. the prices, and when the rebels are up
-- ---------------------------------------------------------

create or replace function public.calm_price()
returns integer
language sql
immutable
as $function$ select 600 $function$;

create or replace function public.crowd_wait()
returns integer
language sql
immutable
as $function$ select 300 $function$;

/* the mood turns to RIOTING at 55, and that is when there are men in the
   streets to fight */
create or replace function public.rebel_count_at()
returns numeric
language sql
immutable
as $function$ select 55 $function$;


-- ---------------------------------------------------------
-- 2. the world we are answering, or the reason we may not
-- ---------------------------------------------------------

create or replace function public.crowd_world(p_planet text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_capital boolean := false;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        raise exception 'The game has not started';
    end if;

    if public.game_frozen() then raise exception 'The game is under maintenance'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if coalesce(v_faction, '') not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine hold worlds';
    end if;

    begin
        v_capital := public.is_capital_world(p_planet);
    exception when undefined_function then v_capital := false;
    end;

    if v_capital then
        raise exception '% is a capital: its own people settle its affairs', p_planet;
    end if;

    if not exists (select 1 from public.planet_unrest as u where u.planet = p_planet) then
        raise exception '% is not a world we hold: there is no bar there to answer', p_planet;
    end if;

    if public.planet_unrest_holder(p_planet) is distinct from v_faction then
        raise exception '% is not ours to police', p_planet;
    end if;

    return v_faction;

end;
$function$;


-- ---------------------------------------------------------
-- 3. the troops take the losses
-- ---------------------------------------------------------

/* one soldier in twenty of every squad standing in orbit, the way a squad's
   existing damage is written: the count of soldiers left, never the number
   of squads */
create or replace function public.crowd_hurt_garrison(p_faction text, p_planet text, p_share numeric)
returns numeric
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_lost numeric := 0;
begin

    if coalesce(p_share, 0) <= 0 then return 0; end if;

    with before as (
        select coalesce(sum(public.fleet_squad_size(e ->> 'type')
                            * greatest(0, coalesce((e ->> 'amount')::numeric, 0))), 0) as full
        from public.fleets as f,
             jsonb_array_elements(coalesce(f.squads, '[]'::jsonb)) as e
        where f.origin = p_planet
          and f.faction = p_faction
          and f.status::text = 'stationed'
    )
    select before.full into v_lost from before;

    update public.fleets as f
    set squads = (
        select coalesce(jsonb_agg(
                   case when e ? 'soldiers' or e ? 'amount'
                        then jsonb_set(e, '{soldiers}', to_jsonb(greatest(0, floor(
                                 coalesce(nullif(e ->> 'soldiers', '')::numeric,
                                          public.fleet_squad_size(e ->> 'type')
                                              * greatest(0, coalesce((e ->> 'amount')::numeric, 0)))
                                 * (1 - p_share)))))
                        else e end
                   order by o), '[]'::jsonb)
        from jsonb_array_elements(coalesce(f.squads, '[]'::jsonb)) with ordinality as t(e, o)
    )
    where f.origin = p_planet
      and f.faction = p_faction
      and f.status::text = 'stationed'
      and jsonb_array_length(coalesce(f.squads, '[]'::jsonb)) > 0;

    with after_ as (
        select coalesce(sum(coalesce(nullif(e ->> 'soldiers', '')::numeric,
                                     public.fleet_squad_size(e ->> 'type')
                                         * greatest(0, coalesce((e ->> 'amount')::numeric, 0)))), 0) as left_
        from public.fleets as f,
             jsonb_array_elements(coalesce(f.squads, '[]'::jsonb)) as e
        where f.origin = p_planet
          and f.faction = p_faction
          and f.status::text = 'stationed'
    )
    select greatest(0, coalesce(v_lost, 0) - after_.left_) into v_lost from after_;

    return coalesce(v_lost, 0);

end;
$function$;


-- ---------------------------------------------------------
-- 4. the money
-- ---------------------------------------------------------

create or replace function public.unrest_calm(p_planet text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_faction text := public.crowd_world(p_planet);
    v_price integer := public.calm_price();
    v_wait integer := public.crowd_wait();
    v_last timestamptz;
    v_credits numeric;
    v_left numeric;
begin

    select u.last_calm_at into v_last
    from public.planet_unrest as u where u.planet = p_planet;

    if v_last is not null and v_last > now() - make_interval(secs => v_wait) then
        raise exception 'The ringleaders of % will not take money again yet: wait % s', p_planet,
            ceil(extract(epoch from (v_last + make_interval(secs => v_wait) - now())))::integer;
    end if;

    select ft.credits into v_credits
    from public.faction_treasury as ft where ft.faction = v_faction for update;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'The treasury cannot pay % credits to calm %', v_price, p_planet;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = v_faction;

    update public.planet_unrest as u
    set unrest = greatest(0, u.unrest - 20),
        last_calm_at = now()
    where u.planet = p_planet;

    select u.unrest into v_left from public.planet_unrest as u where u.planet = p_planet;

    begin
        if v_faction = 'Combine' then
            perform public.cs_log('CALMA: ' || p_planet || ' recebeu ' || v_price ||
                                  ' créditos e acalmou-se: inquietação -20 (agora ' || round(v_left) || ').');
        else
            perform public.cg_log('CALMA: ' || p_planet || ' recebeu ' || v_price ||
                                  ' créditos e acalmou-se: inquietação -20 (agora ' || round(v_left) || ').');
        end if;
    exception when others then null;
    end;

    return jsonb_build_object('planet', p_planet, 'unrest', round(v_left),
                              'delta', -20, 'cost', v_price,
                              'credits', coalesce(v_credits, 0) - v_price,
                              'wait', v_wait);

end;
$function$;


-- ---------------------------------------------------------
-- 5. the troops
-- ---------------------------------------------------------

create or replace function public.unrest_fight(p_planet text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_faction text := public.crowd_world(p_planet);
    v_wait integer := public.crowd_wait();
    v_last timestamptz;
    v_unrest numeric;
    v_g jsonb;
    v_troops numeric;
    v_lost numeric;
    v_left numeric;
begin

    select u.last_fight_at, u.unrest into v_last, v_unrest
    from public.planet_unrest as u where u.planet = p_planet;

    if coalesce(v_unrest, 0) < public.rebel_count_at() then
        raise exception 'No rebels have risen in %: unrest is % of %', p_planet,
            round(coalesce(v_unrest, 0)), public.rebel_count_at();
    end if;

    if v_last is not null and v_last > now() - make_interval(secs => v_wait) then
        raise exception 'The troops in % are regrouping: % s to go', p_planet,
            ceil(extract(epoch from (v_last + make_interval(secs => v_wait) - now())))::integer;
    end if;

    v_g := public.planet_garrison(v_faction, p_planet);
    v_troops := coalesce((v_g ->> 'soldiers')::numeric, 0);

    if coalesce((v_g ->> 'fleets')::integer, 0) <= 0 or v_troops <= 0 then
        raise exception 'No troops of ours stand in orbit of %: bring a fleet before you fight them', p_planet;
    end if;

    v_lost := public.crowd_hurt_garrison(v_faction, p_planet, 0.05);

    update public.planet_unrest as u
    set unrest = greatest(0, u.unrest - 25),
        last_fight_at = now()
    where u.planet = p_planet;

    select u.unrest into v_left from public.planet_unrest as u where u.planet = p_planet;

    begin
        if v_faction = 'Combine' then
            perform public.cs_log('ORDEM: as tropas do Combine esmagam os motins em ' || p_planet ||
                                  ': inquietação -25 (agora ' || round(v_left) || '), ' ||
                                  round(v_lost) || ' soldados perdidos.');
        else
            perform public.cg_log('ORDEM: as tropas da Authority esmagam os motins em ' || p_planet ||
                                  ': inquietação -25 (agora ' || round(v_left) || '), ' ||
                                  round(v_lost) || ' soldados perdidos.');
        end if;
    exception when others then null;
    end;

    return jsonb_build_object('planet', p_planet, 'unrest', round(v_left),
                              'delta', -25, 'lost', round(v_lost),
                              'troops', greatest(0, round(v_troops - v_lost)),
                              'cost', 0, 'wait', v_wait);

end;
$function$;


-- ---------------------------------------------------------
-- 6. and what the halls are told, so the buttons can light up
-- ---------------------------------------------------------

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
        'rebel_at', public.rebel_count_at(),
        'calm_price', public.calm_price(),
        'crowd_wait', public.crowd_wait(),

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
                       ),

                       /* the two answers, and whether they are ready */
                       'calm', jsonb_build_object(
                           'price', public.calm_price(),
                           'ready_in', coalesce(greatest(0, ceil(extract(epoch from (
                               u.last_calm_at + make_interval(secs => public.crowd_wait()) - now())))), 0)::int
                       ),
                       'fight', jsonb_build_object(
                           'ready_in', coalesce(greatest(0, ceil(extract(epoch from (
                               u.last_fight_at + make_interval(secs => public.crowd_wait()) - now())))), 0)::int,
                           'rebels', u.unrest >= public.rebel_count_at(),
                           'garrison', not public.planet_garrison_missing(u.faction, u.planet)
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
    'the two answers', (select count(*) from pg_proc
                        where proname in ('unrest_calm', 'unrest_fight')
                          and pronamespace = 'public'::regnamespace) = 2,
    'the bar carries both clocks', (
        select count(*) from information_schema.columns
        where table_schema = 'public' and table_name = 'planet_unrest'
          and column_name in ('last_calm_at', 'last_fight_at')
    ) = 2,
    'and the halls are told', exists (
        select 1 from pg_proc
        where proname = 'unrest_state' and prosrc like '%''rebel_at''%'
    )
) as result;
