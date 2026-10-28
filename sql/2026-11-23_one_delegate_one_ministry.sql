-- =========================================================
-- GALACTIC FRONT — one delegate, one ministry
--
-- Run in the Supabase SQL editor AFTER
-- 2026-11-22_the_party_book_has_a_loyalty.sql.
-- Safe to run more than once.
--
-- WHAT WAS WRONG
--
-- The automatic seating asked the same question three times
-- ("who is the most loyal member of the governing party?")
-- and each post got the same answer, so one delegate held
-- war, treasury and interior at once. On the Congress that
-- filled the whole screen with one name.
--
-- Now a delegate who already holds a ministry is skipped, and
-- each post goes to the next most loyal member of the
-- governing party. A chamber too small to fill three posts
-- falls back to sharing them, because a post is never left
-- empty when the chamber has anybody at all.
--
-- The leader's own choice is unchanged and still wins: the
-- President names the Congress's holders, the High Commissar
-- names the Soviet's. What is new is that neither may give one
-- member two posts either.
--
-- This file also carries the list of the chamber for the
-- picker (the wrapper 2026-11-21 added), so the picker works
-- on an install that never ran 21.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the seating: never the same hand twice
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
    v_empty boolean;
begin

    if to_regclass('public.cg_ministers') is null
       or to_regclass('public.cg_members') is null then
        return 0;
    end if;

    v_gov := public.cg_governing_party();

    foreach k in array public.minister_posts() loop

        insert into public.cg_ministers (post) values (k)
        on conflict (post) do nothing;

        select (x.member_id is null
                or not exists (select 1 from public.cg_members as y
                                where y.id = x.member_id and coalesce(y.active, true)))
        into v_empty
        from public.cg_ministers as x
        where x.post = k;

        if not coalesce(v_empty, true) then
            n := n + 1;
            continue;
        end if;

        /* the governing party's most loyal member who holds nothing yet */
        select x.id, x.name, x.faction_id
        into m
        from public.cg_members as x
        where coalesce(x.active, true)
          and (v_gov is null or x.faction_id = v_gov)
          and not exists (select 1 from public.cg_ministers as o
                           where o.post <> k and o.member_id = x.id)
        order by coalesce(x.loyalty, 55) desc, x.id
        limit 1;

        /* not enough of them: the rest of the chamber */
        if m.id is null then
            select x.id, x.name, x.faction_id
            into m
            from public.cg_members as x
            where coalesce(x.active, true)
              and not exists (select 1 from public.cg_ministers as o
                               where o.post <> k and o.member_id = x.id)
            order by coalesce(x.loyalty, 55) desc, x.id
            limit 1;
        end if;

        /* a chamber of one: the same hand has to carry them all */
        if m.id is null then
            select x.id, x.name, x.faction_id
            into m
            from public.cg_members as x
            where coalesce(x.active, true)
            order by coalesce(x.loyalty, 55) desc, x.id
            limit 1;
        end if;

        if m.id is not null then
            update public.cg_ministers as x
            set member_id = m.id,
                name = m.name,
                party_id = m.faction_id,
                player_id = null
            where x.post = k;
        end if;

        n := n + 1;

    end loop;

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
    v_empty boolean;
begin

    if to_regclass('public.cs_ministers') is null
       or to_regclass('public.cs_commissars') is null then
        return 0;
    end if;

    v_gov := public.cs_governing_current();

    foreach k in array public.cs_minister_posts() loop

        insert into public.cs_ministers (post) values (k)
        on conflict (post) do nothing;

        select (x.member_id is null
                or not exists (select 1 from public.cs_commissars as y
                                where y.id = x.member_id and coalesce(y.active, true)))
        into v_empty
        from public.cs_ministers as x
        where x.post = k;

        if not coalesce(v_empty, true) then
            n := n + 1;
            continue;
        end if;

        select x.id, x.name, x.current_id
        into m
        from public.cs_commissars as x
        where coalesce(x.active, true)
          and not coalesce(x.is_disgraced, false)
          and (v_gov is null or x.current_id = v_gov)
          and not exists (select 1 from public.cs_ministers as o
                           where o.post <> k and o.member_id = x.id)
        order by coalesce(x.loyalty, 55) desc, x.id
        limit 1;

        if m.id is null then
            select x.id, x.name, x.current_id
            into m
            from public.cs_commissars as x
            where coalesce(x.active, true)
              and not exists (select 1 from public.cs_ministers as o
                               where o.post <> k and o.member_id = x.id)
            order by coalesce(x.loyalty, 55) desc, x.id
            limit 1;
        end if;

        if m.id is null then
            select x.id, x.name, x.current_id
            into m
            from public.cs_commissars as x
            where coalesce(x.active, true)
            order by coalesce(x.loyalty, 55) desc, x.id
            limit 1;
        end if;

        if m.id is not null then
            update public.cs_ministers as x
            set member_id = m.id,
                name = m.name,
                current_id = m.current_id,
                player_id = null
            where x.post = k;
        end if;

        n := n + 1;

    end loop;

    delete from public.cs_ministers as x
    where not (x.post = any (public.cs_minister_posts()));

    return n;
end;
$function$;


-- ---------------------------------------------------------
-- 2. and the leader may not hand out two either
-- ---------------------------------------------------------

create or replace function public.cg_assign_ministry(p_post text, p_member integer default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    mem record;
    v_post text := lower(coalesce(p_post, ''));
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not (v_post = any (public.minister_posts())) then
        raise exception 'There is no such ministry';
    end if;

    select * into st from public.cg_state as s where s.id = 1;

    if st.president_player is distinct from me then
        raise exception 'Only the President of the Freedom Authority chooses the ministers';
    end if;

    insert into public.cg_ministers (post) values (v_post)
    on conflict (post) do nothing;

    if p_member is null then

        update public.cg_ministers as x
        set member_id = null, name = null, party_id = null, player_id = null
        where x.post = v_post;

        begin
            perform public.cg_log('MINISTÉRIO: ' || public.minister_name(v_post) ||
                                  ' volta a ser escolhido pela câmara.');
        exception when others then null;
        end;

        return jsonb_build_object('post', v_post, 'holder', null, 'auto', true);

    end if;

    select x.id, x.name, x.faction_id into mem
    from public.cg_members as x
    where x.id = p_member and coalesce(x.active, true);

    if mem.id is null then
        raise exception 'There is no such delegate in the chamber';
    end if;

    if exists (select 1 from public.cg_ministers as o
                where o.post <> v_post and o.member_id = p_member) then
        raise exception '% already holds another ministry: no delegate holds two', mem.name;
    end if;

    /* the post keeps what it did this term: a new hand does not act twice */
    update public.cg_ministers as x
    set member_id = mem.id,
        name = mem.name,
        party_id = mem.faction_id,
        player_id = null
    where x.post = v_post;

    begin
        perform public.cg_log('MINISTÉRIO: o Presidente nomeia ' || mem.name || ' para o ' ||
                              public.minister_name(v_post) || '.');
    exception when others then null;
    end;

    return jsonb_build_object('post', v_post, 'member', mem.id, 'holder', mem.name,
                              'party', mem.faction_id);

end;
$function$;


create or replace function public.cs_assign_ministry(p_post text, p_member integer default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    mem record;
    v_post text := lower(coalesce(p_post, ''));
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not (v_post = any (public.cs_minister_posts())) then
        raise exception 'There is no such commissariat';
    end if;

    select * into st from public.cs_state as s where s.id = 1;

    if st.secretary_player is distinct from me then
        raise exception 'Only the High Commissar chooses the commissars of the ministries';
    end if;

    insert into public.cs_ministers (post) values (v_post)
    on conflict (post) do nothing;

    if p_member is null then

        update public.cs_ministers as x
        set member_id = null, name = null, current_id = null, player_id = null
        where x.post = v_post;

        begin
            perform public.cs_log('MINISTÉRIO: ' || public.cs_minister_name(v_post) ||
                                  ' volta a ser escolhido pelo plenário.');
        exception when others then null;
        end;

        return jsonb_build_object('post', v_post, 'holder', null, 'auto', true);

    end if;

    select x.id, x.name, x.current_id into mem
    from public.cs_commissars as x
    where x.id = p_member and coalesce(x.active, true);

    if mem.id is null then
        raise exception 'There is no such commissar in the plenum';
    end if;

    if exists (select 1 from public.cs_ministers as o
                where o.post <> v_post and o.member_id = p_member) then
        raise exception '% already holds another commissariat: no commissar holds two', mem.name;
    end if;

    update public.cs_ministers as x
    set member_id = mem.id,
        name = mem.name,
        current_id = mem.current_id,
        player_id = null
    where x.post = v_post;

    begin
        perform public.cs_log('MINISTÉRIO: o Alto Comissário nomeia ' || mem.name || ' para o ' ||
                              public.cs_minister_name(v_post) || '.');
    exception when others then null;
    end;

    return jsonb_build_object('post', v_post, 'member', mem.id, 'holder', mem.name,
                              'party', mem.current_id);

end;
$function$;


-- ---------------------------------------------------------
-- 3. the chamber's list, for an install that never ran 21
-- ---------------------------------------------------------

do $do$
declare
    v_has_cg boolean;
    v_has_cs boolean;
    v_core_cg boolean;
    v_core_cs boolean;
begin

    select exists (select 1 from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'cg_government') into v_has_cg;
    select exists (select 1 from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'cg_government_core') into v_core_cg;
    select exists (select 1 from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'cs_government') into v_has_cs;
    select exists (select 1 from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.proname = 'cs_government_core') into v_core_cs;

    if v_has_cg and not v_core_cg then
        execute 'alter function public.cg_government() rename to cg_government_core';
    end if;

    if v_has_cs and not v_core_cs then
        execute 'alter function public.cs_government() rename to cs_government_core';
    end if;

end;
$do$;


create or replace function public.cg_government()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v jsonb;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    v := public.cg_government_core();

    return v || jsonb_build_object(
        'delegates', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', x.id,
                       'name', x.name,
                       'party', x.faction_id,
                       'party_name', f.name,
                       'party_color', f.color,
                       'loyalty', x.loyalty) order by coalesce(x.loyalty, 0) desc, x.name)
            from public.cg_members as x
            left join public.cg_factions as f on f.id = x.faction_id
            where coalesce(x.active, true)
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
    v jsonb;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    v := public.cs_government_core();

    return v || jsonb_build_object(
        'delegates', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', x.id,
                       'name', x.name,
                       'party', x.current_id,
                       'party_name', c.name,
                       'party_color', c.color,
                       'loyalty', x.loyalty) order by coalesce(x.loyalty, 0) desc, x.name)
            from public.cs_commissars as x
            left join public.cs_currents as c on c.id = x.current_id
            where coalesce(x.active, true) and not coalesce(x.is_disgraced, false)
        ), '[]'::jsonb)
    );

end;
$function$;


-- ---------------------------------------------------------
-- 4. fix what is on the screen now
--
-- A post whose holder also holds another one is cleared
-- first; the first post alphabetically keeps the hand, and
-- the seating below gives the rest to somebody else.
-- ---------------------------------------------------------

do $do$
begin

    if to_regclass('public.cg_ministers') is not null then
        execute $q$
            update public.cg_ministers as x
            set member_id = null, name = null, party_id = null
            where x.member_id is not null
              and exists (select 1 from public.cg_ministers as o
                           where o.post <> x.post and o.member_id = x.member_id
                             and o.post < x.post)
        $q$;
    end if;

    if to_regclass('public.cs_ministers') is not null then
        execute $q$
            update public.cs_ministers as x
            set member_id = null, name = null, current_id = null
            where x.member_id is not null
              and exists (select 1 from public.cs_ministers as o
                           where o.post <> x.post and o.member_id = x.member_id
                             and o.post < x.post)
        $q$;
    end if;

end;
$do$;


select public.cg_seat_ministers() as congress_seated,
       public.cs_seat_ministers() as soviet_seated;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(distinct member_id) from public.cg_ministers where member_id is not null) as congress_hands,
    (select count(*) from public.cg_ministers where member_id is not null) as congress_posts,
    (select count(distinct member_id) from public.cs_ministers where member_id is not null) as soviet_hands,
    (select count(*) from public.cs_ministers where member_id is not null) as soviet_posts,
    (select count(*) from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('cg_assign_ministry', 'cs_assign_ministry')) as pickers;
