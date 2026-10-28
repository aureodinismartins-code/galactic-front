-- =========================================================
-- GALACTIC FRONT — capitals are never occupied, and the
-- commander chooses who holds a ministry
--
-- Run in the Supabase SQL editor AFTER
-- 2026-11-20_the_ministries_belong_to_the_chamber.sql.
-- Safe to run more than once.
--
-- TWO THINGS
--
-- 1. ULTRAMARS WAS SHOWING AS AN OCCUPIED WORLD.
--    cs_seed_occupations() puts every world the Combine holds
--    whole under administration, and nothing in it knew about
--    the charters — so Ultramars, the Combine's own capital,
--    was seeded, then 2026-11-09 deleted it, then the next
--    tick seeded it again. The seed now skips the capitals,
--    a trigger refuses a capital row on either book whatever
--    inserts it, and the rows already there are cleared.
--
-- 2. THE PLAYER IN COMMAND CHOOSES THE HOLDERS.
--    A ministry is still held by a delegate (Congress) or a
--    commissar (Soviet) and never by a player, but the
--    President / High Commissar now picks WHICH of them. The
--    automatic rule (most loyal of the governing party) only
--    fills a post that is empty or whose holder has left; a
--    choice made by hand sticks.
--
--    A new holder does not act twice in the same term: the
--    post keeps what it did, so shuffling holders cannot
--    farm levies.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Which worlds are capitals
-- ---------------------------------------------------------

create or replace function public.capital_worlds()
returns table (planet text, faction text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin

    if to_regclass('public.planet_charters') is not null then
        return query
            select k.planet, k.faction from public.planet_charters as k
            union
            select 'Ultramars', 'Combine'
            union
            select 'Free Earth', 'Freedom Authority';
        return;
    end if;

    /* the charters are missing: the two home worlds are still the two home
       worlds, written here the same way 2026-11-09 writes them */
    return query
        select * from (values ('Ultramars', 'Combine'),
                              ('Free Earth', 'Freedom Authority')) as v(planet, faction);

end;
$function$;


create or replace function public.is_capital_world(p_planet text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin

    if p_planet is null then
        return false;
    end if;

    return exists (select 1 from public.capital_worlds() as w where w.planet = p_planet);

end;
$function$;


-- ---------------------------------------------------------
-- 2. The seed that kept putting Ultramars back
-- ---------------------------------------------------------

create or replace function public.cs_seed_occupations()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin

    if to_regclass('public.cs_occupations') is null
       or to_regclass('public.planets') is null
       or to_regclass('public.cities') is null then
        return;
    end if;

    insert into public.cs_occupations (planet, stage, stability, progress, last_turn_at)
    select p.name, 0, 30, 0, now()
    from public.planets as p
    where exists (select 1 from public.cities as c where c.planet_id = p.id)
      and not exists (select 1 from public.cities as c
                      where c.planet_id = p.id and c.faction is distinct from 'Combine')
      /* a capital is cored, not administered */
      and not public.is_capital_world(p.name)
      and not exists (select 1 from public.cs_occupations as o where o.planet = p.name);

end;
$function$;


-- ---------------------------------------------------------
-- 3. And nothing else may put one there either
-- ---------------------------------------------------------

create or replace function public.occupations_spare_capitals()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin

    /* refusing the row is the whole job: a capital is cored by its faction,
       so it never enters an occupation book, whoever inserts it */
    if public.is_capital_world(new.planet) then
        return null;
    end if;

    return new;

end;
$function$;


do $do$
begin

    if to_regclass('public.cs_occupations') is not null then
        execute 'drop trigger if exists cs_occupations_spare_capitals on public.cs_occupations';
        execute 'create trigger cs_occupations_spare_capitals before insert on public.cs_occupations ' ||
                'for each row execute function public.occupations_spare_capitals()';
    end if;

    if to_regclass('public.cg_occupations') is not null then
        execute 'drop trigger if exists cg_occupations_spare_capitals on public.cg_occupations';
        execute 'create trigger cg_occupations_spare_capitals before insert on public.cg_occupations ' ||
                'for each row execute function public.occupations_spare_capitals()';
    end if;

    /* what is already there goes now, on both books */
    if to_regclass('public.cs_occupations') is not null then
        execute 'delete from public.cs_occupations as o where public.is_capital_world(o.planet)';
    end if;

    if to_regclass('public.cg_occupations') is not null then
        execute 'delete from public.cg_occupations as o where public.is_capital_world(o.planet)';
    end if;

    /* and an occupied capital is not restless either: the bar belongs to a
       world that was taken, and a capital never is */
    if to_regclass('public.planet_unrest') is not null then
        execute 'delete from public.planet_unrest as u where public.is_capital_world(u.planet)';
    end if;

end;
$do$;


-- ---------------------------------------------------------
-- 4. The commander chooses the holder
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

    /* no name: back to the chamber's own choice */
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
-- 5. The automatic seating only fills what is empty
--
-- A post the commander filled stays his. A post whose
-- holder has left the chamber is seated again.
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

        update public.cg_ministers as x
        set member_id = m.id,
            name = m.name,
            party_id = m.faction_id,
            player_id = null
        where x.post = k
          and (x.member_id is null or m.id is null
               or not exists (select 1 from public.cg_members as y
                               where y.id = x.member_id and coalesce(y.active, true)));

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

        update public.cs_ministers as x
        set member_id = m.id,
            name = m.name,
            current_id = m.current_id,
            player_id = null
        where x.post = k
          and (x.member_id is null or m.id is null
               or not exists (select 1 from public.cs_commissars as y
                               where y.id = x.member_id and coalesce(y.active, true)));

        n := n + 1;

    end loop;

    delete from public.cs_ministers as x
    where not (x.post = any (public.cs_minister_posts()));

    return n;
end;
$function$;


-- ---------------------------------------------------------
-- 6. The screen also lists the chamber, so the commander can pick
--
-- The 2026-11-20 reading keeps its job under a new name and a thin
-- wrapper adds the list of delegates. Rewriting the whole reading here
-- would have meant two copies of the same hundred lines drifting apart.
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
-- sanity output
-- ---------------------------------------------------------

select
    public.is_capital_world('Ultramars') as ultramars_is_a_capital,
    public.is_capital_world('Free Earth') as free_earth_is_a_capital,
    public.is_capital_world('Krieg') as krieg_is_not,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('cg_assign_ministry', 'cs_assign_ministry',
                             'capital_worlds', 'is_capital_world',
                             'occupations_spare_capitals')) as new_functions,
    (select count(*) from pg_trigger
      where tgname in ('cs_occupations_spare_capitals', 'cg_occupations_spare_capitals')) as capital_guards,
    (select count(*) from public.cs_occupations as o
      where public.is_capital_world(o.planet)) as occupied_capitals_left;
