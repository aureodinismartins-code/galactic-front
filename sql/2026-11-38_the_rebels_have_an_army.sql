-- =========================================================
-- 2026-11-38 — the rebels have an army
--
-- Run after 2026-11-37. Safe to run twice.
--
-- Unrest was a number. Now it puts men in the streets.
--
--   * the moment a worlds bar reaches 60, a rebel band
--     rises there — 1,500 men, listed per world;
--
--   * every ten minutes that they go unchecked another band
--     joins them, up to four. This only happens while
--     somebody is actually playing: nothing grows overnight
--     while the halls are empty;
--
--   * a world with a band under arms cannot be calmed for
--     money. The band has to be broken first: a fleet of
--     ours in orbit fights them (unrest_fight), the band
--     loses men, and the garrison pays for it in blood;
--
--   * when the last band in a world breaks, the bar falls
--     15 points. Below 60 no new band rises.
--
-- A band never outlives the bar it belongs to: a world that
-- is swept (a capital, an independent world, a reset) takes
-- its bands with it.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the men in the streets
-- ---------------------------------------------------------

create table if not exists public.planet_rebels (
    id bigserial primary key,
    planet text not null,
    soldiers numeric not null default 1500 check (soldiers >= 0),
    raised_at timestamptz not null default now()
);

create index if not exists planet_rebels_planet_idx on public.planet_rebels (planet);

alter table public.planet_rebels enable row level security;

do $do$
begin
    if to_regclass('public.planet_unrest') is not null then
        alter table public.planet_unrest add column if not exists last_band_at timestamptz;
    end if;
end;
$do$;

/* a band never outlives its bar */
create or replace function public.rebel_bands_follow_the_bar()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
    delete from public.planet_rebels as r where r.planet = old.planet;
    return old;
end;
$function$;

drop trigger if exists rebel_bands_follow_the_bar on public.planet_unrest;
create trigger rebel_bands_follow_the_bar
after delete on public.planet_unrest
for each row execute function public.rebel_bands_follow_the_bar();


-- ---------------------------------------------------------
-- 2. the rules of the rising
-- ---------------------------------------------------------

create or replace function public.rebel_band_size()
returns numeric
language sql
immutable
as $function$ select 1500 $function$;

/* the bar that puts men in the streets */
create or replace function public.rebel_pass_at()
returns numeric
language sql
immutable
as $function$ select 60 $function$;

/* ten minutes between bands */
create or replace function public.rebel_cadence()
returns integer
language sql
immutable
as $function$ select 600 $function$;

create or replace function public.rebel_max_bands()
returns integer
language sql
immutable
as $function$ select 4 $function$;


/* the games own 70-second rule: a heartbeat fresher than that is somebody
   at the front. With no presence book at all, everybody counts as present,
   and an empty book (a fresh deployment nobody has beaten yet) counts as
   present too, so a solo host still sees the world move. */
create or replace function public.someone_playing()
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin

    if to_regclass('public.player_presence') is null then return true; end if;

    if not exists (select 1 from public.player_presence) then return true; end if;

    return exists (
        select 1 from public.player_presence as p
        where p.last_seen > now() - interval '70 seconds'
    );

end;
$function$;


-- ---------------------------------------------------------
-- 3. raising them
-- ---------------------------------------------------------

create or replace function public.rebel_raise()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    o record;
    v_bands integer;
    v_last timestamptz;
    v_out jsonb := '[]'::jsonb;
    v_raised boolean;
begin

    /* a band whose bar is gone is nobodys army any more */
    delete from public.planet_rebels as r
    where not exists (select 1 from public.planet_unrest as u where u.planet = r.planet);

    if not public.someone_playing() then return v_out; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        return v_out;
    end if;

    if public.game_frozen() then return v_out; end if;

    begin
        if public.income_mode() = 'closed' then return v_out; end if;
    exception when undefined_function or undefined_table or undefined_column then null;
    end;

    for o in select u.* from public.planet_unrest as u
             where u.unrest >= public.rebel_pass_at()
             order by u.unrest desc, u.planet
             for update
    loop

        if public.planet_unrest_holder(o.planet) is null then
            delete from public.planet_rebels as r where r.planet = o.planet;
            continue;
        end if;

        select count(*) into v_bands
        from public.planet_rebels as r where r.planet = o.planet;

        if v_bands >= public.rebel_max_bands() then continue; end if;

        v_last := o.last_band_at;

        if v_last is not null and v_last > now() - make_interval(secs => public.rebel_cadence()) then
            continue;
        end if;

        insert into public.planet_rebels (planet, soldiers)
        values (o.planet, public.rebel_band_size());

        update public.planet_unrest as u
        set last_band_at = now()
        where u.planet = o.planet;

        v_raised := true;

        select count(*) into v_bands
        from public.planet_rebels as r where r.planet = o.planet;

        v_out := v_out || jsonb_build_object('planet', o.planet, 'bands', v_bands,
                                             'men', public.rebel_band_size());

        begin
            perform public.cg_log('LEVANTE: uma força rebelde pega em armas em ' || o.planet ||
                                  ' (' || public.rebel_band_size() || ' homens).');
        exception when others then null;
        end;

        begin
            perform public.cs_log('LEVANTE: uma força rebelde pega em armas em ' || o.planet ||
                                  (' (' || public.rebel_band_size() || ' homens).'));
        exception when others then null;
        end;

    end loop;

    return v_out;

end;
$function$;


-- ---------------------------------------------------------
-- 4. the seed raises them, so every tick does
-- ---------------------------------------------------------

create or replace function public.unrest_seed()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin

    /* the Congresss book: a world the chamber took */
    begin
        insert into public.planet_unrest (planet, faction, unrest)
        select o.planet, public.planet_unrest_holder(o.planet), 25
        from public.cg_occupations as o
        where public.planet_unrest_holder(o.planet) is not null
        on conflict (planet) do nothing;
    exception when undefined_table or undefined_column then null;
    end;

    /* the Soviets book: a world under Combine administration */
    begin
        insert into public.planet_unrest (planet, faction, unrest)
        select o.planet, public.planet_unrest_holder(o.planet), 25
        from public.cs_occupations as o
        where public.planet_unrest_holder(o.planet) is not null
        on conflict (planet) do nothing;
    exception when undefined_table or undefined_column then null;
    end;

    /* a world that came home again is not occupied: no bar */
    delete from public.planet_unrest as u
    where not exists (select 1 from public.cities as c
                      join public.planets as p on p.id = c.planet_id
                      where p.name = u.planet
                        and c.faction = u.faction);

    /* and the anger puts men in the streets */
    perform public.rebel_raise();

end;
$function$;


-- ---------------------------------------------------------
-- 5. the money can no longer buy an armed world
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
    v_bands integer;
    v_men numeric;
    v_credits numeric;
    v_left numeric;
begin

    select count(*), coalesce(sum(r.soldiers), 0) into v_bands, v_men
    from public.planet_rebels as r where r.planet = p_planet;

    if v_bands > 0 then
        raise exception 'The rebels in % are under arms (% men in % band(s)): break them before the world can be calmed',
            p_planet, round(v_men), v_bands;
    end if;

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
-- 6. and the troops fight the band, not the bar
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
    v_bands integer;
    v_men numeric;
    v_g jsonb;
    v_troops numeric;
    v_hit numeric;
    v_lost numeric;
    v_broken integer := 0;
    r record;
    v_left integer;
    v_men_left numeric;
    v_delta integer := 0;
begin

    select count(*), coalesce(sum(rb.soldiers), 0) into v_bands, v_men
    from public.planet_rebels as rb where rb.planet = p_planet;

    select u.unrest, u.last_fight_at into v_unrest, v_last
    from public.planet_unrest as u where u.planet = p_planet;

    if v_bands = 0 then
        raise exception 'No rebel band has risen in %: unrest is % of %', p_planet,
            round(coalesce(v_unrest, 0)), public.rebel_pass_at();
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

    /* the fleet hits hard, and pays for it: a quarter of the bands number
       in dead, at most the whole garrison */
    v_hit := least(v_men, greatest(200, round(v_troops * 0.5)));
    v_lost := least(v_troops, round(v_men * 0.25));

    for r in select rb.id, rb.soldiers from public.planet_rebels as rb
             where rb.planet = p_planet
             order by rb.raised_at, rb.id
    loop

        exit when v_hit <= 0;

        if r.soldiers <= v_hit then
            delete from public.planet_rebels as rb where rb.id = r.id;
            v_hit := v_hit - r.soldiers;
            v_broken := v_broken + 1;
        else
            update public.planet_rebels as rb
            set soldiers = r.soldiers - v_hit
            where rb.id = r.id;
            v_hit := 0;
        end if;

    end loop;

    perform public.crowd_hurt_garrison(v_faction, p_planet,
                                       least(1, v_lost / greatest(1, v_troops)));

    select count(*), coalesce(sum(rb.soldiers), 0) into v_left, v_men_left
    from public.planet_rebels as rb where rb.planet = p_planet;

    if v_left = 0 then
        update public.planet_unrest as u
        set unrest = greatest(0, u.unrest - 15),
            last_fight_at = now()
        where u.planet = p_planet;
        v_delta := -15;
    else
        update public.planet_unrest as u
        set last_fight_at = now()
        where u.planet = p_planet;
    end if;

    select u.unrest into v_unrest from public.planet_unrest as u where u.planet = p_planet;

    begin
        if v_faction = 'Combine' then
            perform public.cs_log('ORDEM: as tropas do Combine atacam os rebeldes de ' || p_planet ||
                                  ': ' || round(v_men - v_men_left) || ' mortos, ' || v_broken ||
                                  ' bando(s) quebrado(s), ' || round(v_lost) || ' soldados perdidos.');
        else
            perform public.cg_log('ORDEM: as tropas da Authority atacam os rebeldes de ' || p_planet ||
                                  ': ' || round(v_men - v_men_left) || ' mortos, ' || v_broken ||
                                  ' bando(s) quebrado(s), ' || round(v_lost) || ' soldados perdidos.');
        end if;
    exception when others then null;
    end;

    return jsonb_build_object('planet', p_planet,
                              'unrest', round(v_unrest),
                              'delta', v_delta,
                              'killed', round(v_men - v_men_left),
                              'lost', round(v_lost),
                              'broken', v_broken,
                              'bands', v_left,
                              'men', round(v_men_left),
                              'cost', 0,
                              'wait', v_wait);

end;
$function$;


-- ---------------------------------------------------------
-- 7. what the halls are told
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
        'rebel_at', public.rebel_pass_at(),
        'calm_price', public.calm_price(),
        'crowd_wait', public.crowd_wait(),
        'online', public.someone_playing(),

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

                       /* the men in the streets */
                       'bands', (select count(*) from public.planet_rebels as r where r.planet = u.planet),
                       'band_men', (select coalesce(sum(r.soldiers), 0)
                                    from public.planet_rebels as r where r.planet = u.planet),

                       /* the two answers, and whether they are ready */
                       'calm', jsonb_build_object(
                           'price', public.calm_price(),
                           'armed', exists (select 1 from public.planet_rebels as r where r.planet = u.planet),
                           'ready_in', coalesce(greatest(0, ceil(extract(epoch from (
                               u.last_calm_at + make_interval(secs => public.crowd_wait()) - now())))), 0)::int
                       ),
                       'fight', jsonb_build_object(
                           'ready_in', coalesce(greatest(0, ceil(extract(epoch from (
                               u.last_fight_at + make_interval(secs => public.crowd_wait()) - now())))), 0)::int,
                           'rebels', exists (select 1 from public.planet_rebels as r where r.planet = u.planet),
                           'bands', (select count(*) from public.planet_rebels as r where r.planet = u.planet),
                           'men', (select coalesce(sum(r.soldiers), 0)
                                   from public.planet_rebels as r where r.planet = u.planet),
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
    'the bands', to_regclass('public.planet_rebels') is not null,
    'the rising', exists (select 1 from pg_proc
                          where proname = 'rebel_raise' and pronamespace = 'public'::regnamespace),
    'the seed raises them', exists (select 1 from pg_proc
                                    where proname = 'unrest_seed' and prosrc like '%rebel_raise%'),
    'the money cannot buy an armed world', exists (select 1 from pg_proc
                                                   where proname = 'unrest_calm'
                                                     and prosrc like '%are under arms%'),
    'the troops fight the band', exists (select 1 from pg_proc
                                         where proname = 'unrest_fight'
                                           and prosrc like '%No rebel band has risen%'),
    'and the halls are told', exists (select 1 from pg_proc
                                      where proname = 'unrest_state' and prosrc like '%''band_men''%')
) as result;
