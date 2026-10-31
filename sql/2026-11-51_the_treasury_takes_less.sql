-- =========================================================
-- GALACTIC FRONT — the committee of the treasury takes less, and costs more
--
-- Run in the Supabase SQL editor after 2026-11-50. Safe to run more than once.
--
-- WHY
--   Once a term the treasury committee (the Soviet's grain committee) could
--   take an extraordinary levy of 300-500 credits, scaled by the holder's
--   loyalty, for a token three points of popularity (three of confidence in
--   the Soviet). At 500 credits a levy is a fleet, free, every term, and the
--   price was small enough that there was never a reason not to take it. On
--   both sides it was the strongest office in the game by a wide margin.
--
-- WHAT CHANGES
--   The levy is 120-200 credits before the same loyalty factor, so at the
--   usual loyalty it comes out at roughly a third of what it was, and the
--   political price is eight points instead of three. The office still pays,
--   once a term, on both sides, and nothing else about the ministries moves.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the Authority's committee
-- ---------------------------------------------------------

create or replace function public.cg_ministries_convene()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    st record;
    m record;
    k text;
    v_gov integer;
    v_loy numeric;
    v_party_loy numeric;
    v_factor numeric;
    v_gain bigint;
    v_stab integer;
    v_planet text;
    v_effect jsonb;
    v_rows jsonb := '[]'::jsonb;
begin

    if to_regclass('public.cg_ministers') is null
       or to_regclass('public.cg_state') is null then
        return v_rows;
    end if;

    perform public.cg_seat_ministers();

    select * into st from public.cg_state as s where s.id = 1;
    v_gov := public.cg_governing_party();

    foreach k in array public.minister_posts() loop

        select * into m from public.cg_ministers as x where x.post = k;

        if m.post is null then
            continue;
        end if;

        if m.last_effect_term is not null
           and m.last_effect_term >= coalesce(st.term_no, 0) then
            v_rows := v_rows || jsonb_build_array(
                jsonb_build_object('post', k, 'effect', m.last_effect));
            continue;
        end if;

        v_effect := null;

        select coalesce(x.loyalty, 55) into v_loy
        from public.cg_members as x where x.id = m.member_id;
        v_loy := coalesce(v_loy, 55);

        select coalesce(f.loyalty, 55) into v_party_loy
        from public.cg_factions as f where f.id = m.party_id;
        v_party_loy := coalesce(v_party_loy, 55);

        if v_party_loy < 25 then

            v_effect := jsonb_build_object('kind', 'idle', 'reason', 'party');

        else

            v_factor := (0.5 + v_loy / 100.0) *
                        case when m.party_id is not distinct from v_gov then 1.10 else 0.90 end;

            if k = 'war' then

                if v_loy < 25 then
                    v_effect := jsonb_build_object('kind', 'idle', 'reason', 'holder');
                else
                    insert into public.cg_authorizations (kind, player_id, used)
                    values ('fleet', null, false);

                    v_effect := jsonb_build_object('kind', 'fleet');
                end if;

            elsif k = 'treasury' then

                v_gain := round((120 + random() * 80) * v_factor)::bigint;

                update public.faction_treasury as ft
                set credits = ft.credits + v_gain
                where ft.faction = 'Freedom Authority';

                update public.cg_state as s
                set popularity = greatest(0, s.popularity - 8)
                where s.id = 1;

                v_effect := jsonb_build_object('kind', 'levy', 'credits', v_gain, 'popularity', -8);

            else

                select o.planet into v_planet
                from public.cg_occupations as o
                where o.stability < 100
                order by o.stability, o.planet
                limit 1;

                if v_planet is null then
                    v_effect := jsonb_build_object('kind', 'idle', 'reason', 'quiet');
                else
                    update public.cg_occupations as o
                    set stability = least(100, o.stability + round(10 * v_factor)::integer)
                    where o.planet = v_planet
                    returning o.stability into v_stab;

                    v_effect := jsonb_build_object('kind', 'relief', 'planet', v_planet,
                                                   'stability', v_stab,
                                                   'gained', round(10 * v_factor)::integer);
                end if;

            end if;

        end if;

        update public.cg_ministers as x
        set last_effect = v_effect,
            last_effect_term = coalesce(st.term_no, 0),
            last_power_term = coalesce(st.term_no, 0),
            last_power_at = now()
        where x.post = k;

        v_rows := v_rows || jsonb_build_array(
            jsonb_build_object('post', k, 'effect', v_effect));

    end loop;

    return v_rows;
end;
$function$;


-- ---------------------------------------------------------
-- 2. the Soviet's
-- ---------------------------------------------------------

create or replace function public.cs_ministries_convene()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    st record;
    m record;
    k text;
    v_gov integer;
    v_loy numeric;
    v_party_loy numeric;
    v_factor numeric;
    v_gain bigint;
    v_stab integer;
    v_planet text;
    v_effect jsonb;
    v_rows jsonb := '[]'::jsonb;
begin

    if to_regclass('public.cs_ministers') is null
       or to_regclass('public.cs_state') is null then
        return v_rows;
    end if;

    perform public.cs_seat_ministers();

    select * into st from public.cs_state as s where s.id = 1;
    v_gov := public.cs_governing_current();

    foreach k in array public.cs_minister_posts() loop

        select * into m from public.cs_ministers as x where x.post = k;

        if m.post is null then
            continue;
        end if;

        if m.last_effect_term is not null
           and m.last_effect_term >= coalesce(st.term_no, 0) then
            v_rows := v_rows || jsonb_build_array(
                jsonb_build_object('post', k, 'effect', m.last_effect));
            continue;
        end if;

        v_effect := null;

        select coalesce(x.loyalty, 55) into v_loy
        from public.cs_commissars as x where x.id = m.member_id;
        v_loy := coalesce(v_loy, 55);

        select coalesce(c.loyalty, 55) into v_party_loy
        from public.cs_currents as c where c.id = m.current_id;
        v_party_loy := coalesce(v_party_loy, 55);

        if v_party_loy < 25 then

            v_effect := jsonb_build_object('kind', 'idle', 'reason', 'party');

        else

            v_factor := (0.5 + v_loy / 100.0) *
                        case when m.current_id is not distinct from v_gov then 1.10 else 0.90 end;

            if k = 'security' then

                if v_loy < 25 then
                    v_effect := jsonb_build_object('kind', 'idle', 'reason', 'holder');
                else
                    insert into public.cs_authorizations (kind, player_id, used)
                    values ('fleet', null, false);

                    v_effect := jsonb_build_object('kind', 'fleet');
                end if;

            elsif k = 'grain' then

                v_gain := round((120 + random() * 80) * v_factor)::bigint;

                update public.faction_treasury as ft
                set credits = ft.credits + v_gain
                where ft.faction = 'Combine';

                update public.cs_state as s
                set confidence = greatest(0, s.confidence - 8)
                where s.id = 1;

                v_effect := jsonb_build_object('kind', 'levy', 'credits', v_gain, 'confidence', -8);

            else

                select o.planet into v_planet
                from public.cs_occupations as o
                where o.stability < 100
                order by o.stability, o.planet
                limit 1;

                if v_planet is null then
                    v_effect := jsonb_build_object('kind', 'idle', 'reason', 'quiet');
                else
                    update public.cs_occupations as o
                    set stability = least(100, o.stability + round(10 * v_factor)::integer)
                    where o.planet = v_planet
                    returning o.stability into v_stab;

                    v_effect := jsonb_build_object('kind', 'relief', 'planet', v_planet,
                                                   'stability', v_stab,
                                                   'gained', round(10 * v_factor)::integer);
                end if;

            end if;

        end if;

        update public.cs_ministers as x
        set last_effect = v_effect,
            last_effect_term = coalesce(st.term_no, 0),
            last_power_term = coalesce(st.term_no, 0),
            last_power_at = now()
        where x.post = k;

        v_rows := v_rows || jsonb_build_array(
            jsonb_build_object('post', k, 'effect', v_effect));

    end loop;

    return v_rows;
end;
$function$;

-- ---------------------------------------------------------
-- 3. sanity output
-- ---------------------------------------------------------

select
    (select count(*) from public.cg_ministers where post = 'treasury') as authority_treasury_seats,
    (select count(*) from public.cs_ministers where post = 'grain') as soviet_grain_seats,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('cg_ministries_convene', 'cs_ministries_convene')) as functions;
