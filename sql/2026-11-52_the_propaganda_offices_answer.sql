-- =========================================================
-- GALACTIC FRONT — the propaganda offices answer again
--
-- Run in the Supabase SQL editor after 2026-11-51. Safe to run more than once.
--
-- THE FAULT
--   Pressing CAMPAIGN on the PROPAGANDA tab came back with
--
--       record "m" is not assigned yet
--
--   congress_propaganda() declares a record variable called m for the
--   delegates it walks through, and the same function also writes
--   "from public.cg_members as m" and "update public.cg_members as m" in
--   three places further up. The name means two things at once, and
--   PostgreSQL reads the qualified m.something as a field of the record
--   that was never assigned instead of the table it was aliased to. The
--   campaign never reaches the treasury.
--
-- THE FIX
--   The loop variable is renamed v_member throughout, and nothing else
--   changes: same money, same loyalty heat, same chances, same cooldown,
--   same log line. The table aliases stay as they are.
-- =========================================================


-- ---------------------------------------------------------
-- the function, with the delegate variable renamed
-- ---------------------------------------------------------

create or replace function public.congress_propaganda(p_faction integer, p_credits integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    c_cooldown constant interval := interval '10 minutes';
    c_min constant integer := 1000;
    c_max constant integer := 10000;
    v_faction public.cg_factions%rowtype;
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
    v_member record;
begin

    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    if not public.cg_is_fa() then
        raise exception 'Only a Freedom Authority player may pay for propaganda';
    end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        raise exception 'The game has not started';
    end if;

    if public.game_frozen() then
        raise exception 'The game is under maintenance';
    end if;

    select * into v_faction from public.cg_factions as f where f.id = p_faction;

    if v_faction.id is null then
        raise exception 'Unknown faction';
    end if;

    v_spend := greatest(c_min, least(c_max, coalesce(p_credits, c_min)));

    /* 1.000 credits -> 5 points, 10.000 -> 23, never more than 30 */
    v_heat := least(30, 3 + (v_spend / 500));

    /* 1.000-4.999 can turn one delegate, 5.000-9.999 two, 10.000 three */
    v_max_flips := 1 + (v_spend / 5000);

    if not pg_try_advisory_xact_lock(7770004) then
        raise exception 'Congress is busy: try again in a moment';
    end if;

    select ft.credits into v_credits
    from public.faction_treasury as ft
    where ft.faction = 'Freedom Authority'
    for update;

    if v_credits is null then
        raise exception 'Freedom Authority treasury not found';
    end if;

    select p.last_at into v_last
    from public.cg_propaganda as p
    where p.faction_id = v_faction.id;

    if v_last is not null and now() - v_last < c_cooldown then

        v_wait := c_cooldown - (now() - v_last);

        raise exception 'A campaign for % started % ago: wait % more seconds',
            v_faction.name,
            round(extract(epoch from (now() - v_last))),
            ceil(extract(epoch from v_wait));
    end if;

    if v_credits < v_spend then
        raise exception 'The treasury holds % credits: a campaign of % is not possible', v_credits, v_spend;
    end if;

    /* where the faction stands before the campaign (only the seated
       delegates count: the chamber and every bill count them the same way) */
    select coalesce(round(avg(m.loyalty)), 50) into v_avg
    from public.cg_members as m
    where m.faction_id = v_faction.id and m.active;

    /* its own delegates are stirred up: their loyalty rises */
    update public.cg_members as m
    set loyalty = least(100, m.loyalty + v_heat)
    where m.faction_id = v_faction.id and m.active;

    /* and the discontented of the other factions listen.
       The loop exists over the twelve least loyal delegates: the
       money decides how many of them can be won and how likely. */
    for v_member in
        select x.id, x.name, x.loyalty, x.faction_id
        from public.cg_members as x
        where x.faction_id <> v_faction.id and x.active
        order by x.loyalty asc, random()
        limit 12
    loop

        exit when v_flips >= v_max_flips;

        v_chance := least(0.9, (v_spend::numeric / 4000) * (1 - v_member.loyalty / 120));

        if random() < v_chance then

            update public.cg_members as x
            set faction_id = v_faction.id,
                loyalty = least(100, v_avg + (v_heat / 2))
            where x.id = v_member.id;

            select f.name into v_from from public.cg_factions as f where f.id = v_member.faction_id;

            v_flips := v_flips + 1;
            v_turned := v_turned || case when v_turned = '' then '' else ', ' end ||
                        v_member.name || ' (' || coalesce(v_from, '?') || ')';

        end if;

    end loop;

    update public.faction_treasury as ft
    set credits = ft.credits - v_spend
    where ft.faction = 'Freedom Authority';

    insert into public.cg_propaganda as p (faction_id, last_at, runs, spent)
    values (v_faction.id, now(), 1, v_spend)
    on conflict (faction_id) do update
    set last_at = now(),
        runs = p.runs + 1,
        spent = p.spent + excluded.spent;

    select count(*) into v_seats
    from public.cg_members as m
    where m.faction_id = v_faction.id and m.active;

    perform public.cg_log(
        'PROPAGANDA: a campanha pela ' || v_faction.name || ' custou ' || v_spend ||
        ' créditos e subiu a lealdade dos seus delegados em ' || v_heat || ' pontos' ||
        case when v_flips > 0
            then '; ' || v_flips || ' delegado(s) passaram-se para ela: ' || v_turned
            else '' end || '.'
    );

    return jsonb_build_object(
        'faction', v_faction.id,
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
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from public.cg_propaganda) as campaigns_on_record,
    (select prosrc like '%v_member record%' and prosrc not like '%m record%'
     from pg_proc where proname = 'congress_propaganda') as renamed,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('congress_propaganda', 'congress_propaganda_state')) as functions;
