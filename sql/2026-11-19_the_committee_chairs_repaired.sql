-- =========================================================
-- GALACTIC FRONT — the committee chairs, repaired in place
--
-- Run this ONLY if the COMMITTEES tab in the Congress still
-- says "column f.seats does not exist" after
-- 2026-11-15_committees_and_ministers.sql has been run. That
-- message means the earlier version of these same functions is
-- what the database holds — usually because a long file was
-- pasted and only part of it applied.
--
-- This installs the three functions the tab needs and nothing
-- else, cut word for word out of 2026-11-15:
--
--   cg_party_seats()   counts a party's seats from its delegates
--   cg_commit()        seats the three committees on that count
--   cg_government()    the Congress's committees-and-ministers screen
--
-- It is short enough to paste whole, safe to run any number of
-- times, and changes no data. Reload the page afterwards.
--
-- Check it took with:
--   select proname, prosrc like '%cg_party_seats%' as fixed
--   from pg_proc where proname in ('cg_commit', 'cg_government');
--
-- Both rows must read true.
-- =========================================================


-- ---------------------------------------------------------
-- the table the three committees sit in
-- ---------------------------------------------------------

create table if not exists public.cg_committees (
    kind text primary key,
    chair_id integer references public.cg_factions (id),
    last_report_term integer,
    last_report_at timestamptz
);

alter table public.cg_committees enable row level security;


-- ---------------------------------------------------------
-- the three ministries exist before anybody holds them
-- ---------------------------------------------------------

create table if not exists public.cg_ministers (
    post text primary key,
    player_id uuid,
    name text,
    party_id integer,
    appointed_at timestamptz not null default now(),
    term_no integer,
    last_power_term integer,
    last_power_at timestamptz
);

alter table public.cg_ministers enable row level security;

insert into public.cg_ministers (post) values ('war'), ('treasury'), ('interior')
on conflict (post) do nothing;


create or replace function public.cg_party_seats(p_faction integer)
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    n integer;
begin

    if p_faction is null or to_regclass('public.cg_members') is null then
        return 0;
    end if;

    begin
        select count(*)::integer into n
        from public.cg_members as m
        where m.faction_id = p_faction and coalesce(m.active, true);
    exception when undefined_column then
        select count(*)::integer into n
        from public.cg_members as m
        where m.faction_id = p_faction;
    end;

    return coalesce(n, 0);

end;
$function$;


/*
   The chair of every committee is the party with the most seats, and
   the book is rewritten whenever anybody looks: a defection or a propaganda
   campaign that moves the seats moves the gavel with them.
*/
create or replace function public.cg_commit()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    k text;
    v_chair integer;
begin

    if to_regclass('public.cg_committees') is null or to_regclass('public.cg_factions') is null then
        return;
    end if;

    foreach k in array public.committee_kinds() loop

        select f.id into v_chair
        from public.cg_factions as f
        where public.cg_party_seats(f.id) > 0
        order by public.cg_party_seats(f.id) desc, f.id
        limit 1;

        insert into public.cg_committees (kind, chair_id)
        values (k, v_chair)
        on conflict (kind) do update set chair_id = excluded.chair_id;

    end loop;

    delete from public.cg_committees as c where not (c.kind = any (public.committee_kinds()));

end;
$function$;


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

    select * into st from public.cg_state as s where s.id = 1;
    v_party := public.cg_my_faction_id();

    return jsonb_build_object(
        'me', v_party,
        'president', st.president_player,
        'is_president', st.president_player = me,
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
                       'player', m.player_id,
                       'holder', m.name,
                       'mine', coalesce(m.player_id = me, false),
                       'wait', greatest(0, ceil(public.minister_wait_seconds() -
                           coalesce(extract(epoch from (now() - m.last_power_at)), 999999)::numeric))::integer
                   ) order by m.post)
            from public.cg_ministers as m
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
