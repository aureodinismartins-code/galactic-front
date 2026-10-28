-- =========================================================
-- GALACTIC FRONT — the ministries belong to the chamber
--
-- Run in the Supabase SQL editor, after
-- 2026-11-15_committees_and_ministers.sql. Safe to run more
-- than once.
--
-- Until now a ministry was a player's: the President (or the
-- High Commissar) named somebody, and that somebody pressed a
-- button once a term. Now the ministries are the chamber's:
--
--   * each one is held by a DELEGATE (Congress) or a
--     COMMISSAR (Soviet) — never by a player;
--   * the party with the most seats hands out the posts, and
--     each post goes to that party's most loyal member;
--   * the holder acts on his own, once a term, and how well he
--     acts is his own loyalty and his party's standing: a
--     loyal servant of a party in favour delivers half as much
--     again, a sullen one from a party in disgrace delivers
--     less, and a party below 25 loyalty is not served at all.
--
-- The Combine gets its own three commissariats, mirroring the
-- Congress's three so neither side is stronger:
--
--   SECURITY  authorises one fleet with no directive   (war)
--   GRAIN     takes one levy of 300-500 credits         (treasury)
--   LABOUR    sends relief to the least settled world   (interior)
--
-- And envy: whoever wins an election lifts his own party's
-- loyalty by 8 and pulls every other party down by 4.
--
-- What is replaced:
--   cs_minister_posts, cs_minister_name, cg_seat_ministers,
--   cs_seat_ministers, cg_ministries_convene,
--   cs_ministries_convene, cg_government, cs_government.
-- The old appoint/dismiss/action calls are left alone: the
-- chamber reseats itself every time the screen is read, so a
-- hand appointment no longer outlives the next look.
-- =========================================================


-- ---------------------------------------------------------
-- 1. The Combine's three commissariats
-- ---------------------------------------------------------

create or replace function public.cs_minister_posts()
returns text[]
language sql
immutable
as $function$
    select array['security', 'grain', 'labour']
$function$;


/* the Congress's minister_name() stays as it is; the Soviet's own three
   needed names of their own */
create or replace function public.cs_minister_name(p_post text)
returns text
language sql
immutable
as $function$
    select case p_post
        when 'security' then 'Comissariado da Segurança do Estado'
        when 'grain' then 'Comissariado do Grão'
        when 'labour' then 'Comissariado do Trabalho'
        else coalesce(p_post, '?')
    end
$function$;


-- ---------------------------------------------------------
-- 2. What a chamber-held ministry needs to remember
-- ---------------------------------------------------------

alter table public.cg_ministers add column if not exists member_id integer;
alter table public.cg_ministers add column if not exists last_effect jsonb;
alter table public.cg_ministers add column if not exists last_effect_term integer;

alter table public.cs_ministers add column if not exists member_id integer;
alter table public.cs_ministers add column if not exists last_effect jsonb;
alter table public.cs_ministers add column if not exists last_effect_term integer;


-- ---------------------------------------------------------
-- 3. Who hands out the posts
-- ---------------------------------------------------------

/* the party with the most seats, counted the same way the committee
   chairs are counted: from the members themselves */
create or replace function public.cg_governing_party()
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v integer;
begin
    if to_regclass('public.cg_factions') is null then
        return null;
    end if;

    select f.id into v
    from public.cg_factions as f
    where public.cg_party_seats(f.id) > 0
    order by public.cg_party_seats(f.id) desc, f.id
    limit 1;

    return v;
end;
$function$;


create or replace function public.cs_governing_current()
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v integer;
begin
    if to_regclass('public.cs_currents') is null then
        return null;
    end if;

    select c.id into v
    from public.cs_currents as c
    where c.seats > 0
    order by c.seats desc, c.id
    limit 1;

    return v;
end;
$function$;


-- ---------------------------------------------------------
-- 4. The seating
--
-- Each post goes to the most loyal member of the governing
-- party. A party with no living member, or no governing party
-- at all, falls back to the most loyal member anywhere: a
-- chamber with seats always has somebody to hold the office.
-- ---------------------------------------------------------

create or replace function public.cg_seat_ministers()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
    k text;
    v_gov integer;
    m record;
    n integer := 0;
begin

    if to_regclass('public.cg_ministers') is null
       or to_regclass('public.cg_members') is null then
        return 0;
    end if;

    v_gov := public.cg_governing_party();

    foreach k in array public.minister_posts() loop

        select x.id, x.name, x.faction_id
        into m
        from public.cg_members as x
        where coalesce(x.active, true)
          and (v_gov is null or x.faction_id = v_gov)
        order by coalesce(x.loyalty, 55) desc, x.id
        limit 1;

        if m.id is null then
            select x.id, x.name, x.faction_id
            into m
            from public.cg_members as x
            where coalesce(x.active, true)
            order by coalesce(x.loyalty, 55) desc, x.id
            limit 1;
        end if;

        insert into public.cg_ministers (post) values (k)
        on conflict (post) do nothing;

        update public.cg_ministers as x
        set member_id = m.id,
            name = m.name,
            party_id = m.faction_id,
            player_id = null
        where x.post = k
          and (x.member_id is distinct from m.id or x.player_id is not null);

        n := n + 1;

    end loop;

    /* a post the chamber no longer has does not linger */
    delete from public.cg_ministers as x
    where not (x.post = any (public.minister_posts()));

    return n;
end;
$function$;


create or replace function public.cs_seat_ministers()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
    k text;
    v_gov integer;
    m record;
    n integer := 0;
begin

    if to_regclass('public.cs_ministers') is null
       or to_regclass('public.cs_commissars') is null then
        return 0;
    end if;

    v_gov := public.cs_governing_current();

    foreach k in array public.cs_minister_posts() loop

        select x.id, x.name, x.current_id
        into m
        from public.cs_commissars as x
        where coalesce(x.active, true)
          and not coalesce(x.is_disgraced, false)
          and (v_gov is null or x.current_id = v_gov)
        order by coalesce(x.loyalty, 55) desc, x.id
        limit 1;

        if m.id is null then
            select x.id, x.name, x.current_id
            into m
            from public.cs_commissars as x
            where coalesce(x.active, true)
            order by coalesce(x.loyalty, 55) desc, x.id
            limit 1;
        end if;

        insert into public.cs_ministers (post) values (k)
        on conflict (post) do nothing;

        update public.cs_ministers as x
        set member_id = m.id,
            name = m.name,
            current_id = m.current_id,
            player_id = null
        where x.post = k
          and (x.member_id is distinct from m.id or x.player_id is not null);

        n := n + 1;

    end loop;

    /* the Combine had the Congress's three posts before this patch: they are
       not its ministries and go */
    delete from public.cs_ministers as x
    where not (x.post = any (public.cs_minister_posts()));

    return n;
end;
$function$;


-- ---------------------------------------------------------
-- 5. The holder acts, once a term, on his own
-- ---------------------------------------------------------

/*
   Called whenever the chamber's screen is read. The factor is the whole
   rule in one number: 0.5 + loyalty/100 (so 0.5 at loyalty 0 and 1.5 at
   100), a tenth more when the holder's party is the governing one and a
   tenth less when it is not. A party under 25 loyalty is not served at
   all — the ministry simply does nothing that term, and says so.
*/
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

                v_gain := round((300 + random() * 200) * v_factor)::bigint;

                update public.faction_treasury as ft
                set credits = ft.credits + v_gain
                where ft.faction = 'Freedom Authority';

                update public.cg_state as s
                set popularity = greatest(0, s.popularity - 3)
                where s.id = 1;

                v_effect := jsonb_build_object('kind', 'levy', 'credits', v_gain, 'popularity', -3);

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

                v_gain := round((300 + random() * 200) * v_factor)::bigint;

                update public.faction_treasury as ft
                set credits = ft.credits + v_gain
                where ft.faction = 'Combine';

                update public.cs_state as s
                set confidence = greatest(0, s.confidence - 3)
                where s.id = 1;

                v_effect := jsonb_build_object('kind', 'levy', 'credits', v_gain, 'confidence', -3);

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
-- 6. Envy: the winner's party rises, the others fall
-- ---------------------------------------------------------

create or replace function public.party_envy(p_side text, p_party integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin

    if p_side = 'authority' then

        if to_regclass('public.cg_factions') is null or p_party is null then
            return jsonb_build_object('party', p_party, 'envied', false);
        end if;

        update public.cg_factions as f
        set loyalty = least(100, coalesce(f.loyalty, 55) + 8)
        where f.id = p_party;

        update public.cg_factions as f
        set loyalty = greatest(0, coalesce(f.loyalty, 55) - 4)
        where f.id <> p_party;

        return jsonb_build_object('party', p_party, 'envied', true, 'rise', 8, 'fall', 4);

    end if;

    if to_regclass('public.cs_currents') is null or p_party is null then
        return jsonb_build_object('party', p_party, 'envied', false);
    end if;

    update public.cs_currents as c
    set loyalty = least(100, coalesce(c.loyalty, 55) + 8)
    where c.id = p_party;

    update public.cs_currents as c
    set loyalty = greatest(0, coalesce(c.loyalty, 55) - 4)
    where c.id <> p_party;

    return jsonb_build_object('party', p_party, 'envied', true, 'rise', 8, 'fall', 4);

end;
$function$;


/* the President takes the office: his party is envied */
create or replace function public.cg_envy_on_president()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_party integer;
begin

    if new.president_player is null then
        return new;
    end if;

    if new.president_player is not distinct from old.president_player
       and new.term_no is not distinct from old.term_no then
        return new;
    end if;

    select m.faction_id into v_party
    from public.cg_members as m
    where m.player_id = new.president_player
    order by m.id
    limit 1;

    perform public.party_envy('authority', v_party);

    return new;
end;
$function$;


/* and so does the Speaker of the Congress */
create or replace function public.cg_envy_on_speaker()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_party integer;
begin

    if new.speaker_player is null then
        return new;
    end if;

    if new.speaker_player is not distinct from old.speaker_player
       and new.term_no is not distinct from old.term_no then
        return new;
    end if;

    select m.faction_id into v_party
    from public.cg_members as m
    where m.player_id = new.speaker_player
    order by m.id
    limit 1;

    if v_party is null then
        select f.id into v_party
        from public.cg_factions as f
        where lower(f.name) = lower(coalesce(new.speaker_party, ''))
           or lower(f.key) = lower(coalesce(new.speaker_party, ''))
        limit 1;
    end if;

    perform public.party_envy('authority', v_party);

    return new;
end;
$function$;


/* and the High Commissar of the Combine */
create or replace function public.cs_envy_on_secretary()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_current integer;
begin

    if new.secretary_player is null then
        return new;
    end if;

    if new.secretary_player is not distinct from old.secretary_player
       and new.term_no is not distinct from old.term_no then
        return new;
    end if;

    v_current := new.secretary_current;

    perform public.party_envy('soviet', v_current);

    return new;
end;
$function$;


drop trigger if exists cg_envy_on_president on public.cg_state;

create trigger cg_envy_on_president
after update on public.cg_state
for each row
execute function public.cg_envy_on_president();


drop trigger if exists cs_envy_on_secretary on public.cs_state;

create trigger cs_envy_on_secretary
after update on public.cs_state
for each row
execute function public.cs_envy_on_secretary();


/* the Speaker's book does not exist in every install: make the trigger only
   where the table is */
do $do$
begin
    if to_regclass('public.cg_speaker_state') is not null then
        execute 'drop trigger if exists cg_envy_on_speaker on public.cg_speaker_state';
        execute 'create trigger cg_envy_on_speaker after update on public.cg_speaker_state ' ||
                'for each row execute function public.cg_envy_on_speaker()';
    end if;
end;
$do$;


-- ---------------------------------------------------------
-- 7. What the chamber's screen reads
-- ---------------------------------------------------------

create or replace function public.cg_government()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    v_party integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    perform public.cg_commit();
    perform public.cg_ministries_convene();

    select * into st from public.cg_state as s where s.id = 1;
    v_party := public.cg_my_faction_id();

    return jsonb_build_object(
        'me', v_party,
        'president', st.president_player,
        'is_president', st.president_player = me,
        'term', coalesce(st.term_no, 0),
        'committees', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'kind', c.kind,
                       'name', public.committee_name(c.kind),
                       'chair', f.id,
                       'chair_name', f.name,
                       'chair_color', f.color,
                       'chair_seats', public.cg_party_seats(f.id),
                       'mine', f.id = v_party,
                       'bills', coalesce((
                           select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title,
                                                               'status', p.status, 'type', p.ptype)
                                            order by p.id)
                           from public.cg_proposals as p
                           where p.status in ('introduction', 'debate')
                             and public.committee_of(p.ptype) = c.kind
                       ), '[]'::jsonb),
                       'wait', greatest(0, ceil(public.committee_wait_seconds() -
                           coalesce(extract(epoch from (now() - c.last_report_at)), 999999)::numeric))::integer
                   ) order by c.kind)
            from public.cg_committees as c
            left join public.cg_factions as f on f.id = c.chair_id
        ), '[]'::jsonb),
        'ministers', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'post', m.post,
                       'name', public.minister_name(m.post),
                       'holder', m.name,
                       'member', m.member_id,
                       'party', m.party_id,
                       'party_name', f.name,
                       'party_color', f.color,
                       'party_loyalty', f.loyalty,
                       'loyalty', (select x.loyalty from public.cg_members as x where x.id = m.member_id),
                       'effect', m.last_effect,
                       'acted', m.last_effect_term is not null
                                 and m.last_effect_term >= coalesce(st.term_no, 0),
                       'mine', false
                   ) order by m.post)
            from public.cg_ministers as m
            left join public.cg_factions as f on f.id = m.party_id
            where m.post = any (public.minister_posts())
        ), '[]'::jsonb),
        'players', coalesce((
            select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.username) order by p.username)
            from public.players as p where p.faction = 'Freedom Authority'
        ), '[]'::jsonb),
        'worlds', coalesce((
            select jsonb_agg(jsonb_build_object('planet', o.planet, 'stability', o.stability) order by o.planet)
            from public.cg_occupations as o
        ), '[]'::jsonb)
    );

end;
$function$;


create or replace function public.cs_government()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    v_current integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    perform public.cs_commit();
    perform public.cs_ministries_convene();

    select * into st from public.cs_state as s where s.id = 1;

    begin
        select m.current_id into v_current
        from public.cs_membership as m
        where m.player_id = me;
    exception when undefined_table or undefined_column then
        v_current := null;
    end;

    return jsonb_build_object(
        'me', v_current,
        'secretary', st.secretary_player,
        'is_secretary', st.secretary_player = me,
        'term', coalesce(st.term_no, 0),
        'committees', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'kind', c.kind,
                       'name', public.committee_name(c.kind),
                       'chair', cur.id,
                       'chair_name', cur.name,
                       'chair_color', cur.color,
                       'chair_seats', cur.seats,
                       'mine', cur.id = v_current,
                       'bills', coalesce((
                           select jsonb_agg(jsonb_build_object('id', d.id, 'title', d.title,
                                                               'status', d.status, 'type', d.dtype)
                                            order by d.id)
                           from public.cs_directives as d
                           where d.status in ('introduction', 'debate')
                             and public.committee_of(d.dtype) = c.kind
                       ), '[]'::jsonb),
                       'wait', greatest(0, ceil(public.committee_wait_seconds() -
                           coalesce(extract(epoch from (now() - c.last_report_at)), 999999)::numeric))::integer
                   ) order by c.kind)
            from public.cs_committees as c
            left join public.cs_currents as cur on cur.id = c.chair_id
        ), '[]'::jsonb),
        'ministers', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'post', m.post,
                       'name', public.cs_minister_name(m.post),
                       'holder', m.name,
                       'member', m.member_id,
                       'party', m.current_id,
                       'party_name', cur.name,
                       'party_color', cur.color,
                       'party_loyalty', cur.loyalty,
                       'loyalty', (select x.loyalty from public.cs_commissars as x where x.id = m.member_id),
                       'effect', m.last_effect,
                       'acted', m.last_effect_term is not null
                                 and m.last_effect_term >= coalesce(st.term_no, 0),
                       'mine', false
                   ) order by m.post)
            from public.cs_ministers as m
            left join public.cs_currents as cur on cur.id = m.current_id
            where m.post = any (public.cs_minister_posts())
        ), '[]'::jsonb),
        'players', coalesce((
            select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.username) order by p.username)
            from public.players as p where p.faction = 'Combine'
        ), '[]'::jsonb),
        'worlds', coalesce((
            select jsonb_agg(jsonb_build_object('planet', o.planet, 'stability', o.stability) order by o.planet)
            from public.cs_occupations as o
        ), '[]'::jsonb)
    );

end;
$function$;


-- ---------------------------------------------------------
-- 8. The reset keeps clearing them
-- ---------------------------------------------------------

create or replace function public.committees_and_ministers_reset()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
    g record;
    n integer := 0;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    select * into g from public.game_control as x where x.id = 1;

    if g.host_player is distinct from auth.uid() then
        raise exception 'Only the host may reset the game';
    end if;

    perform set_config('game.bypass', '1', true);

    delete from public.cg_committees;
    delete from public.cs_committees;
    delete from public.cg_ministers;
    delete from public.cs_ministers;

    get diagnostics n = row_count;

    return n;

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    public.cs_minister_posts() as soviet_posts,
    public.cs_minister_name('grain') as one_of_them,
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'cg_ministers'
        and column_name in ('member_id', 'last_effect', 'last_effect_term')) as congress_columns,
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'cs_ministers'
        and column_name in ('member_id', 'last_effect', 'last_effect_term')) as soviet_columns,
    (select count(*) from pg_trigger
      where tgname in ('cg_envy_on_president', 'cs_envy_on_secretary', 'cg_envy_on_speaker')) as envy;
