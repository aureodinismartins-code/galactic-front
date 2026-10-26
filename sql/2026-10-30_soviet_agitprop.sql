-- =========================================================
-- GALACTIC FRONT — agitprop in the Supreme Soviet
--
-- Run in the Supabase SQL editor AFTER 2026-10-28_combine_soviet.sql.
-- Safe to run more than once. It can run with maintenance on or off.
--
-- The Congress has its propaganda offices; the Soviet has AGITPROP.
-- Any Combine player may pay for a campaign for one of the three
-- currents of the Party:
--
--   * the campaign lifts the DISCIPLINE (the loyalty of the seats)
--     of that current's own commissars;
--   * the least disciplined commissars of the other currents are
--     the first to listen, and some of them change sides — they
--     join the current that paid, at that current's discipline;
--   * money buys reach: 1.000 credits raises discipline by 5
--     points and can turn one commissar, 10.000 raises it by 23
--     points and can turn three;
--   * the same current can be targeted once every ten minutes,
--     and the credits come out of the Combine treasury.
--
-- Nothing else about the Soviet changes, and no directive is
-- charged for: this is the one place the Combine spends credits
-- on politics, exactly as the Authority does in Congress.
-- =========================================================


-- ---------------------------------------------------------
-- 1. where the campaigns are recorded
-- ---------------------------------------------------------

create table if not exists public.cs_agitprop (
    current_id integer primary key references public.cs_currents (id) on delete cascade,
    last_at timestamptz,
    runs integer not null default 0,
    spent bigint not null default 0
);

/* nothing reads this table directly: the screen goes through the
   functions below, so no policy is needed and the rows stay closed */
alter table public.cs_agitprop enable row level security;


-- ---------------------------------------------------------
-- 2. run a campaign
-- ---------------------------------------------------------

create or replace function public.cs_agitprop(p_current integer, p_credits integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    c_cooldown constant interval := interval '10 minutes';
    c_min constant integer := 1000;
    c_max constant integer := 10000;
    v_faction text;
    v_current public.cs_currents%rowtype;
    v_spend integer;
    v_credits bigint;
    v_last timestamptz;
    v_wait interval;
    v_heat integer;
    v_avg integer;
    v_seats integer;
    v_flips integer := 0;
    v_max_flips integer;
    v_chance numeric;
    v_turned text := '';
    v_from text;
    v_com record;
begin

    if me is null then
        raise exception 'Not authenticated';
    end if;

    select p.faction into v_faction from public.players as p where p.id = me;
    if coalesce(v_faction, '') <> 'Combine' then
        raise exception 'Only a Combine player may pay for agitprop';
    end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        raise exception 'The game has not started';
    end if;

    if public.game_frozen() then
        raise exception 'The game is under maintenance';
    end if;

    select * into v_current from public.cs_currents as c where c.id = p_current;

    if v_current.id is null then
        raise exception 'Unknown current';
    end if;

    v_spend := greatest(c_min, least(c_max, coalesce(p_credits, c_min)));

    /* 1.000 credits -> 5 points, 10.000 -> 23, never more than 30 */
    v_heat := least(30, 3 + (v_spend / 500));

    /* 1.000-4.999 can turn one commissar, 5.000-9.999 two, 10.000 three */
    v_max_flips := 1 + (v_spend / 5000);

    if not pg_try_advisory_xact_lock(7770005) then
        raise exception 'The Soviet is busy: try again in a moment';
    end if;

    select ft.credits into v_credits
    from public.faction_treasury as ft
    where ft.faction = 'Combine'
    for update;

    if v_credits is null then
        raise exception 'Combine treasury not found';
    end if;

    select a.last_at into v_last
    from public.cs_agitprop as a
    where a.current_id = v_current.id;

    if v_last is not null and now() - v_last < c_cooldown then

        v_wait := c_cooldown - (now() - v_last);

        raise exception 'A campaign for % started % ago: wait % more seconds',
            v_current.name,
            round(extract(epoch from (now() - v_last))),
            ceil(extract(epoch from v_wait));
    end if;

    if v_credits < v_spend then
        raise exception 'The treasury holds % credits: a campaign of % is not possible', v_credits, v_spend;
    end if;

    /* where the current stands before the campaign */
    select coalesce(round(avg(x.loyalty)), 50) into v_avg
    from public.cs_commissars as x
    where x.current_id = v_current.id and x.active;

    /* its own commissars are stirred up: discipline rises */
    update public.cs_commissars as x
    set loyalty = least(100, x.loyalty + v_heat)
    where x.current_id = v_current.id and x.active;

    /* and the discontented of the other currents listen. The loop runs over
       the twelve least disciplined commissars: the money decides how many of
       them can be won and how likely. */
    for v_com in
        select x.id, x.name, x.loyalty, x.current_id
        from public.cs_commissars as x
        where x.current_id <> v_current.id and x.active
        order by x.loyalty asc, random()
        limit 12
    loop

        exit when v_flips >= v_max_flips;

        v_chance := least(0.9, (v_spend::numeric / 4000) * (1 - v_com.loyalty / 120));

        if random() < v_chance then

            update public.cs_commissars as x
            set current_id = v_current.id,
                loyalty = least(100, v_avg + (v_heat / 2))
            where x.id = v_com.id;

            select c.name into v_from from public.cs_currents as c where c.id = v_com.current_id;

            v_flips := v_flips + 1;
            v_turned := v_turned || case when v_turned = '' then '' else ', ' end ||
                        v_com.name || ' (' || coalesce(v_from, '?') || ')';

        end if;

    end loop;

    update public.faction_treasury as ft
    set credits = ft.credits - v_spend
    where ft.faction = 'Combine';

    insert into public.cs_agitprop as a (current_id, last_at, runs, spent)
    values (v_current.id, now(), 1, v_spend)
    on conflict (current_id) do update
    set last_at = now(),
        runs = a.runs + 1,
        spent = a.spent + excluded.spent;

    select count(*) into v_seats
    from public.cs_commissars as x
    where x.current_id = v_current.id and x.active;

    perform public.cs_log(
        'AGITPROP: a campanha pela ' || v_current.name || ' custou ' || v_spend ||
        ' créditos e subiu a disciplina dos seus comissários em ' || v_heat || ' pontos' ||
        case when v_flips > 0
            then '; ' || v_flips || ' comissário(s) passaram-se para ela: ' || v_turned
            else '' end || '.'
    );

    return jsonb_build_object(
        'current', v_current.id,
        'spent', v_spend,
        'heat', v_heat,
        'flipped', v_flips,
        'turned', v_turned,
        'seats', v_seats,
        'credits', v_credits - v_spend
    );

end;
$function$;


-- ---------------------------------------------------------
-- 3. what the screen needs to draw the panel
-- ---------------------------------------------------------

create or replace function public.cs_agitprop_state()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_currents jsonb;
begin

    if me is null then
        raise exception 'Not authenticated';
    end if;

    select coalesce(jsonb_object_agg(
                c.id::text,
                jsonb_build_object(
                    'last_at', a.last_at,
                    'runs', coalesce(a.runs, 0),
                    'spent', coalesce(a.spent, 0)
                )
            ), '{}'::jsonb)
    into v_currents
    from public.cs_currents as c
    left join public.cs_agitprop as a on a.current_id = c.id;

    return jsonb_build_object(
        'now', now(),
        'cooldown', 600,
        'min', 1000,
        'max', 10000,
        'credits', coalesce((
            select ft.credits from public.faction_treasury as ft
            where ft.faction = 'Combine'
        ), 0),
        'currents', v_currents
    );

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.tables
      where table_schema = 'public' and table_name = 'cs_agitprop') as agitprop_table,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('cs_agitprop', 'cs_agitprop_state')) as functions_present,
    (select count(*) from public.cs_commissars where active) as commissars,
    (select coalesce(jsonb_agg(jsonb_build_object(
                'current', c.name,
                'seats', (select count(*) from public.cs_commissars as m where m.current_id = c.id and m.active),
                'discipline', (select coalesce(round(avg(m.loyalty)), 0) from public.cs_commissars as m
                               where m.current_id = c.id and m.active)
            ) order by c.id), '[]'::jsonb)
       from public.cs_currents as c) as chamber;
