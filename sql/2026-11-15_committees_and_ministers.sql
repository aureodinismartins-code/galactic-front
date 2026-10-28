-- =========================================================
-- GALACTIC FRONT — the committees, and the ministers
--
-- Run this in the Supabase SQL editor after 2026-11-14. Safe to run more
-- than once. It can run with maintenance on or off.
--
-- WHY THESE TWO GO TOGETHER
--
--   A chamber that only votes makes its members count for nothing between
--   bills. Committees turn seat counts into WORK: three standing
--   committees in each house, chaired automatically by the party or
--   current with the most seats, and the chair may REPORT a bill of its
--   own kind straight to the vote — once a term, ten minutes apart at the
--   least. That is the difference between a chamber that talks and a
--   chamber that schedules.
--
--   The ministers are the other half: the faction leader (the President
--   of the Freedom Authority, the High Commissar of the Combine) names
--   one player to each post, and each post can DO something once a term:
--
--     * WAR      — authorise one campaign against a world, without a bill;
--     * TREASURY — an extraordinary levy: 300-500 credits at once, and
--                  the people are told who took it (popularity/confidence
--                  -3);
--     * INTERIOR — send relief to one world under occupation (+10
--                  stability), without a directive.
--
--   Nothing here invents a vote: the report moves a bill the chamber has
--   already been given, and a minister's power spends a term's authority.
--   Everything the chamber already does — debate, defections, bribes,
--   scandals, the veto — is untouched.
--
-- New books: public.cg_committees, public.cs_committees,
--            public.cg_ministers, public.cs_ministers.
-- New calls: cg_government(), cs_government(), the two report calls,
--            the appoint/dismiss calls and the minister's own action.
-- The reset: committees_and_ministers_reset() (the host's, called from
--            gamecontrol.js beside the other reset steps).
-- =========================================================


-- =========================================================
-- 1. THE COMMITTEES
-- =========================================================

create table if not exists public.cg_committees (
    kind text primary key,
    chair_id integer references public.cg_factions (id),
    last_report_term integer,
    last_report_at timestamptz
);

alter table public.cg_committees enable row level security;

create table if not exists public.cs_committees (
    kind text primary key,
    chair_id integer references public.cs_currents (id),
    last_report_term integer,
    last_report_at timestamptz
);

alter table public.cs_committees enable row level security;


/* the three standing committees, and what each of them schedules */
create or replace function public.committee_kinds()
returns text[]
language sql
immutable
as $function$
    select array['fleets', 'treasury', 'diplomacy']
$function$;


/* which committee a bill belongs to — null when nobody schedules it */
create or replace function public.committee_of(p_kind text)
returns text
language sql
immutable
as $function$
    select case
        when p_kind in ('fleet_construction', 'knightmare_construction', 'fleet_revocation',
                        'military_action', 'military_campaign') then 'fleets'
        when p_kind in ('taxation', 'resource_allocation', 'production_quota') then 'treasury'
        when p_kind in ('diplomacy') then 'diplomacy'
        else null
    end
$function$;


/*
   Which party the caller sits in, whatever the base game's own books
   call it: the seat they hold, or the party the delegate book names for
   them. Returns null when the game cannot say, which refuses the report
   rather than guessing a chair.
*/
create or replace function public.cg_my_faction_id()
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_id integer;
    v_party text;
begin

    if me is null then return null; end if;

    begin
        select m.faction_id into v_id
        from public.cg_members as m
        where m.player_id = me and m.active
        order by m.id
        limit 1;

        if v_id is not null then return v_id; end if;
    exception when undefined_table or undefined_column then null;
    end;

    v_party := public.cg_player_party(me);

    if v_party is null or v_party = '' then return null; end if;

    /* the party may be stored under a short key or under its full name; an
       older party book has no key column at all, so the name alone is the
       fallback rather than a failed claim to a chair */
    begin
        select f.id into v_id
        from public.cg_factions as f
        where lower(f.key) = lower(v_party) or lower(f.name) = lower(v_party)
        order by f.id
        limit 1;
    exception when undefined_column then
        select f.id into v_id
        from public.cg_factions as f
        where lower(f.name) = lower(v_party)
        order by f.id
        limit 1;
    end;

    return v_id;

end;
$function$;/*
   How many votes a party holds. The base game does not keep that count on
   the party itself: a party holds exactly the delegates seated in it, so
   that is what is counted here (the chamber's own tally counts the same
   way). Returns 0 instead of raising when the delegate book is missing, so
   a committee can still be seated on a half-built database.
*/
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


create or replace function public.cs_commit()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    k text;
    v_chair integer;
begin

    if to_regclass('public.cs_committees') is null or to_regclass('public.cs_currents') is null then
        return;
    end if;

    foreach k in array public.committee_kinds() loop

        select c.id into v_chair
        from public.cs_currents as c
        where coalesce(c.seats, 0) > 0
        order by c.seats desc, c.id
        limit 1;

        insert into public.cs_committees (kind, chair_id)
        values (k, v_chair)
        on conflict (kind) do update set chair_id = excluded.chair_id;

    end loop;

    delete from public.cs_committees as c where not (c.kind = any (public.committee_kinds()));

end;
$function$;


/* how long a committee must wait between two reports of its own */
create or replace function public.committee_wait_seconds()
returns integer
language sql
immutable
as $function$
    select 600
$function$;


/*
   The chair's power: a live bill of this committee's own kind goes
   straight to the vote. The bill has to be live (introduction or debate),
   the caller has to sit in the chairing party, and the committee may do
   this once a term, ten minutes apart at the least.
*/
create or replace function public.cg_committee_report(p_proposal integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    p record;
    c record;
    st record;
    v_party integer;
    v_kind text;
    v_since numeric;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    perform public.cg_commit();

    select * into p from public.cg_proposals as x where x.id = p_proposal for update;
    if p.id is null then raise exception 'There is no such bill'; end if;

    if p.status not in ('introduction', 'debate') then
        raise exception 'That bill is no longer before the chamber';
    end if;

    v_kind := public.committee_of(p.ptype);
    if v_kind is null then
        raise exception 'No committee schedules a bill of that kind';
    end if;

    select * into c from public.cg_committees as x where x.kind = v_kind;

    v_party := public.cg_my_faction_id();

    if v_party is null or v_party <> c.chair_id then
        raise exception 'Only the party that chairs the committee may report a bill';
    end if;

    select * into st from public.cg_state as s where s.id = 1;

    if c.last_report_term is not null and c.last_report_term >= coalesce(st.term_no, 0)
       and c.last_report_at is not null then

        v_since := extract(epoch from (now() - c.last_report_at));

        if v_since < public.committee_wait_seconds() then
            raise exception 'The committee has already reported this term: % minutes to wait',
                ceil((public.committee_wait_seconds() - v_since) / 60.0);
        end if;

    end if;

    update public.cg_proposals as x
    set status = 'debate',
        debate_at = now(),
        vote_at = now()
    where x.id = p.id;

    update public.cg_committees as x
    set last_report_term = coalesce(st.term_no, 0),
        last_report_at = now()
    where x.kind = v_kind;

    begin
        perform public.cg_log('COMISSÃO: ' || public.committee_name(v_kind) || ' relata ' ||
                              p.title || ' diretamente à votação.');
    exception when others then null;
    end;

    return jsonb_build_object('proposal', p.id, 'title', p.title, 'committee', v_kind, 'reported', true);

end;
$function$;


create or replace function public.cs_committee_report(p_directive integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    d record;
    c record;
    st record;
    v_current integer;
    v_kind text;
    v_since numeric;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    perform public.cs_commit();

    select * into d from public.cs_directives as x where x.id = p_directive for update;
    if d.id is null then raise exception 'There is no such directive'; end if;

    if d.status not in ('introduction', 'debate') then
        raise exception 'That directive is no longer before the plenum';
    end if;

    v_kind := public.committee_of(d.dtype);
    if v_kind is null then raise exception 'No committee schedules a directive of that kind'; end if;

    select * into c from public.cs_committees as x where x.kind = v_kind;

    begin
        select m.current_id into v_current
        from public.cs_membership as m
        where m.player_id = me;
    exception when undefined_table or undefined_column then
        v_current := null;
    end;

    if v_current is null or v_current <> c.chair_id then
        raise exception 'Only the current that chairs the committee may report a directive';
    end if;

    select * into st from public.cs_state as s where s.id = 1;

    if c.last_report_term is not null and c.last_report_term >= coalesce(st.term_no, 0)
       and c.last_report_at is not null then

        v_since := extract(epoch from (now() - c.last_report_at));

        if v_since < public.committee_wait_seconds() then
            raise exception 'The committee has already reported this term: % minutes to wait',
                ceil((public.committee_wait_seconds() - v_since) / 60.0);
        end if;

    end if;

    update public.cs_directives as x
    set status = 'debate',
        debate_at = now(),
        vote_at = now()
    where x.id = d.id;

    update public.cs_committees as x
    set last_report_term = coalesce(st.term_no, 0),
        last_report_at = now()
    where x.kind = v_kind;

    begin
        perform public.cs_log('COMISSÃO: ' || public.committee_name(v_kind) || ' relata ' ||
                              d.title || ' diretamente à votação.');
    exception when others then null;
    end;

    return jsonb_build_object('directive', d.id, 'title', d.title, 'committee', v_kind, 'reported', true);

end;
$function$;


-- =========================================================
-- 2. THE MINISTERS
-- =========================================================

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

create table if not exists public.cs_ministers (
    post text primary key,
    player_id uuid,
    name text,
    current_id integer,
    appointed_at timestamptz not null default now(),
    term_no integer,
    last_power_term integer,
    last_power_at timestamptz
);

alter table public.cs_ministers enable row level security;


create or replace function public.minister_posts()
returns text[]
language sql
immutable
as $function$
    select array['war', 'treasury', 'interior']
$function$;


create or replace function public.committee_name(p_kind text)
returns text
language sql
immutable
as $function$
    select case p_kind
        when 'fleets' then 'Comissão das Frotas'
        when 'treasury' then 'Comissão do Tesouro'
        when 'diplomacy' then 'Comissão da Diplomacia'
        else coalesce(p_kind, '?')
    end
$function$;


create or replace function public.minister_name(p_post text)
returns text
language sql
immutable
as $function$
    select case p_post
        when 'war' then 'Ministério da Guerra'
        when 'treasury' then 'Ministério do Tesouro'
        when 'interior' then 'Ministério do Interior'
        else coalesce(p_post, '?')
    end
$function$;


/* how long a minister must wait between two uses of their own power */
create or replace function public.minister_wait_seconds()
returns integer
language sql
immutable
as $function$
    select 600
$function$;


-- ---------------------------------------------------------
-- the Freedom Authority's ministers
-- ---------------------------------------------------------

/* the President names them, and only one player per post */
create or replace function public.cg_appoint_minister(p_post text, p_player uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    v_post text := lower(coalesce(p_post, ''));
    v_name text;
    v_party integer;
    v_their_faction text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not (v_post = any (public.minister_posts())) then
        raise exception 'There is no such ministry';
    end if;

    select * into st from public.cg_state as s where s.id = 1;

    if st.president_player is distinct from me then
        raise exception 'Only the President of the Freedom Authority names the ministers';
    end if;

    if p_player is null then
        update public.cg_ministers as m
        set player_id = null, name = null, party_id = null, appointed_at = now(),
            term_no = coalesce(st.term_no, 0), last_power_term = null, last_power_at = null
        where m.post = v_post;

        begin
            perform public.cg_log('MINISTÉRIO: ' || public.minister_name(v_post) || ' fica vago.');
        exception when others then null;
        end;

        return jsonb_build_object('post', v_post, 'player', null, 'name', null, 'vacant', true);
    end if;

    select p.username, p.faction into v_name, v_their_faction
    from public.players as p where p.id = p_player;

    if v_name is null then raise exception 'There is no such player'; end if;

    if v_their_faction is distinct from 'Freedom Authority' then
        raise exception '% does not serve the Freedom Authority', v_name;
    end if;

    v_party := public.cg_my_faction_id();

    insert into public.cg_ministers (post, player_id, name, party_id, appointed_at, term_no)
    values (v_post, p_player, v_name, null, now(), coalesce(st.term_no, 0))
    on conflict (post) do update
        set player_id = excluded.player_id,
            name = excluded.name,
            party_id = null,
            appointed_at = now(),
            term_no = excluded.term_no,
            last_power_term = null,
            last_power_at = null;

    begin
        perform public.cg_log('MINISTÉRIO: ' || v_name || ' é nomeado para o ' ||
                              public.minister_name(v_post) || '.');
    exception when others then null;
    end;

    return jsonb_build_object('post', v_post, 'player', p_player, 'name', v_name, 'vacant', false);

end;
$function$;


create or replace function public.cg_dismiss_minister(p_post text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    m record;
    v_post text := lower(coalesce(p_post, ''));
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into st from public.cg_state as s where s.id = 1;

    if st.president_player is distinct from me then
        raise exception 'Only the President of the Freedom Authority may dismiss a minister';
    end if;

    select * into m from public.cg_ministers as x where x.post = v_post;
    if m.player_id is null then raise exception 'That ministry is already vacant'; end if;

    update public.cg_ministers as x
    set player_id = null, name = null, party_id = null, appointed_at = now(),
        last_power_term = null, last_power_at = null
    where x.post = v_post;

    begin
        perform public.cg_log('MINISTÉRIO: ' || m.name || ' deixa o ' || public.minister_name(v_post) || '.');
    exception when others then null;
    end;

    return jsonb_build_object('post', v_post, 'dismissed', m.name);

end;
$function$;


/*
   What a minister can do, once a term: the war ministry authorises one
   campaign, the treasury takes one extraordinary levy, the interior sends
   one load of relief.
*/
create or replace function public.cg_minister_action(p_post text, p_planet text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    m record;
    v_post text := lower(coalesce(p_post, ''));
    v_gain bigint;
    v_stab numeric;
    v_since numeric;
    v_held integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into m from public.cg_ministers as x where x.post = v_post;
    if m.player_id is distinct from me then
        raise exception 'That ministry is not yours';
    end if;

    select * into st from public.cg_state as s where s.id = 1;

    if m.last_power_term is not null and m.last_power_term >= coalesce(st.term_no, 0)
       and m.last_power_at is not null then

        v_since := extract(epoch from (now() - m.last_power_at));

        if v_since < public.minister_wait_seconds() then
            raise exception 'That ministry has already acted this term: % minutes to wait',
                ceil((public.minister_wait_seconds() - v_since) / 60.0);
        end if;

    end if;

    if v_post = 'war' then

        if to_regclass('public.cg_authorizations') is null then
            raise exception 'The war book is missing: run the Congress patches';
        end if;

        if p_planet is null then raise exception 'Name the world the campaign is against'; end if;

        if exists (select 1 from public.cg_authorizations as a
                   where a.kind = 'war' and a.planet = p_planet and not a.used) then
            raise exception 'A campaign against % is already authorised', p_planet;
        end if;

        insert into public.cg_authorizations (kind, planet, player_id, used)
        values ('war', p_planet, me, false);

        update public.cg_ministers as x
        set last_power_term = coalesce(st.term_no, 0), last_power_at = now()
        where x.post = v_post;

        begin
            perform public.cg_log('MINISTÉRIO: ' || m.name || ' autoriza uma campanha contra ' || p_planet || '.');
        exception when others then null;
        end;

        return jsonb_build_object('post', v_post, 'planet', p_planet, 'authorised', true);

    elsif v_post = 'treasury' then

        v_gain := 300 + floor(random() * 201)::integer;

        update public.faction_treasury as ft
        set credits = ft.credits + v_gain
        where ft.faction = 'Freedom Authority';

        update public.cg_state as s
        set popularity = greatest(0, s.popularity - 3)
        where s.id = 1;

        update public.cg_ministers as x
        set last_power_term = coalesce(st.term_no, 0), last_power_at = now()
        where x.post = v_post;

        begin
            perform public.cg_log('MINISTÉRIO: ' || m.name || ' levanta ' || v_gain || ' créditos dos mundos membros.');
        exception when others then null;
        end;

        return jsonb_build_object('post', v_post, 'credits', v_gain, 'popularity', -3);

    end if;

    /* the interior: relief for one world under the Congress's occupation */
    if p_planet is null then raise exception 'Name the world the relief is for'; end if;

    if to_regclass('public.cg_occupations') is null then
        raise exception 'The occupation book is missing';
    end if;

    select count(*) into v_held from public.cg_occupations as o where o.planet = p_planet;
    if coalesce(v_held, 0) = 0 then
        raise exception '% is not under the Congress''s administration', p_planet;
    end if;

    update public.cg_occupations as o
    set stability = least(100, o.stability + 10)
    where o.planet = p_planet
    returning o.stability into v_stab;

    update public.cg_ministers as x
    set last_power_term = coalesce(st.term_no, 0), last_power_at = now()
    where x.post = v_post;

    begin
        perform public.cg_log('MINISTÉRIO: ' || m.name || ' envia alívio a ' || p_planet || '.');
    exception when others then null;
    end;

    return jsonb_build_object('post', v_post, 'planet', p_planet, 'stability', v_stab);

end;
$function$;


-- ---------------------------------------------------------
-- the Combine's
-- ---------------------------------------------------------

create or replace function public.cs_appoint_minister(p_post text, p_player uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    v_post text := lower(coalesce(p_post, ''));
    v_name text;
    v_their_faction text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not (v_post = any (public.minister_posts())) then
        raise exception 'There is no such ministry';
    end if;

    select * into st from public.cs_state as s where s.id = 1;

    if st.secretary_player is distinct from me then
        raise exception 'Only the High Commissar names the commissars of the ministries';
    end if;

    if p_player is null then
        update public.cs_ministers as m
        set player_id = null, name = null, current_id = null, appointed_at = now(),
            term_no = coalesce(st.term_no, 0), last_power_term = null, last_power_at = null
        where m.post = v_post;

        return jsonb_build_object('post', v_post, 'player', null, 'name', null, 'vacant', true);
    end if;

    select p.username, p.faction into v_name, v_their_faction
    from public.players as p where p.id = p_player;

    if v_name is null then raise exception 'There is no such player'; end if;

    if v_their_faction is distinct from 'Combine' then
        raise exception '% does not serve the Combine', v_name;
    end if;

    insert into public.cs_ministers (post, player_id, name, appointed_at, term_no)
    values (v_post, p_player, v_name, now(), coalesce(st.term_no, 0))
    on conflict (post) do update
        set player_id = excluded.player_id,
            name = excluded.name,
            appointed_at = now(),
            term_no = excluded.term_no,
            last_power_term = null,
            last_power_at = null;

    begin
        perform public.cs_log('MINISTÉRIO: ' || v_name || ' é nomeado para o ' ||
                              public.minister_name(v_post) || '.');
    exception when others then null;
    end;

    return jsonb_build_object('post', v_post, 'player', p_player, 'name', v_name, 'vacant', false);

end;
$function$;


create or replace function public.cs_dismiss_minister(p_post text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    m record;
    v_post text := lower(coalesce(p_post, ''));
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into st from public.cs_state as s where s.id = 1;

    if st.secretary_player is distinct from me then
        raise exception 'Only the High Commissar may relieve a commissar of a ministry';
    end if;

    select * into m from public.cs_ministers as x where x.post = v_post;
    if m.player_id is null then raise exception 'That ministry is already vacant'; end if;

    update public.cs_ministers as x
    set player_id = null, name = null, current_id = null, appointed_at = now(),
        last_power_term = null, last_power_at = null
    where x.post = v_post;

    begin
        perform public.cs_log('MINISTÉRIO: ' || m.name || ' deixa o ' || public.minister_name(v_post) || '.');
    exception when others then null;
    end;

    return jsonb_build_object('post', v_post, 'dismissed', m.name);

end;
$function$;


create or replace function public.cs_minister_action(p_post text, p_planet text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    m record;
    v_post text := lower(coalesce(p_post, ''));
    v_gain bigint;
    v_stab numeric;
    v_since numeric;
    v_held integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into m from public.cs_ministers as x where x.post = v_post;
    if m.player_id is distinct from me then
        raise exception 'That ministry is not yours';
    end if;

    select * into st from public.cs_state as s where s.id = 1;

    if m.last_power_term is not null and m.last_power_term >= coalesce(st.term_no, 0)
       and m.last_power_at is not null then

        v_since := extract(epoch from (now() - m.last_power_at));

        if v_since < public.minister_wait_seconds() then
            raise exception 'That ministry has already acted this term: % minutes to wait',
                ceil((public.minister_wait_seconds() - v_since) / 60.0);
        end if;

    end if;

    if v_post = 'war' then

        if to_regclass('public.cs_authorizations') is null then
            raise exception 'The campaign book is missing: run the Soviet patches';
        end if;

        if p_planet is null then raise exception 'Name the world the campaign is against'; end if;

        if exists (select 1 from public.cs_authorizations as a
                   where a.kind = 'war' and a.planet = p_planet and not a.used) then
            raise exception 'A campaign against % is already authorised', p_planet;
        end if;

        /* the Soviet's own book allows three kinds of authorisation, and a
           campaign is a war in it: 'campaign' would be refused by its check */
        insert into public.cs_authorizations (kind, planet, player_id, used)
        values ('war', p_planet, me, false);

        update public.cs_ministers as x
        set last_power_term = coalesce(st.term_no, 0), last_power_at = now()
        where x.post = v_post;

        begin
            perform public.cs_log('MINISTÉRIO: ' || m.name || ' autoriza uma campanha contra ' || p_planet || '.');
        exception when others then null;
        end;

        return jsonb_build_object('post', v_post, 'planet', p_planet, 'authorised', true);

    elsif v_post = 'treasury' then

        v_gain := 300 + floor(random() * 201)::integer;

        update public.faction_treasury as ft
        set credits = ft.credits + v_gain
        where ft.faction = 'Combine';

        update public.cs_state as s
        set confidence = greatest(0, s.confidence - 3)
        where s.id = 1;

        update public.cs_ministers as x
        set last_power_term = coalesce(st.term_no, 0), last_power_at = now()
        where x.post = v_post;

        begin
            perform public.cs_log('MINISTÉRIO: ' || m.name || ' levanta ' || v_gain || ' créditos dos oblasts.');
        exception when others then null;
        end;

        return jsonb_build_object('post', v_post, 'credits', v_gain, 'confidence', -3);

    end if;

    if p_planet is null then raise exception 'Name the world the relief is for'; end if;

    if to_regclass('public.cs_occupations') is null then
        raise exception 'The occupation book is missing';
    end if;

    select count(*) into v_held from public.cs_occupations as o where o.planet = p_planet;
    if coalesce(v_held, 0) = 0 then
        raise exception '% is not under Soviet administration', p_planet;
    end if;

    update public.cs_occupations as o
    set stability = least(100, o.stability + 10)
    where o.planet = p_planet
    returning o.stability into v_stab;

    update public.cs_ministers as x
    set last_power_term = coalesce(st.term_no, 0), last_power_at = now()
    where x.post = v_post;

    begin
        perform public.cs_log('MINISTÉRIO: ' || m.name || ' envia alívio a ' || p_planet || '.');
    exception when others then null;
    end;

    return jsonb_build_object('post', v_post, 'planet', p_planet, 'stability', v_stab);

end;
$function$;


-- =========================================================
-- 3. WHAT THE CHAMBER'S SCREEN READS
-- =========================================================

/*
   Both houses get the same reading: the three committees with their
   chairs and the live bills each of them schedules, and the three
   ministries with their holders, what the caller may do and how long the
   chamber would have to wait.
*/
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
                       'mine', m.player_id = me,
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
                       'name', public.minister_name(m.post),
                       'player', m.player_id,
                       'holder', m.name,
                       'mine', m.player_id = me,
                       'wait', greatest(0, ceil(public.minister_wait_seconds() -
                           coalesce(extract(epoch from (now() - m.last_power_at)), 999999)::numeric))::integer
                   ) order by m.post)
            from public.cs_ministers as m
            where m.post = any (public.minister_posts())
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


-- =========================================================
-- 4. THE RESET
-- =========================================================

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


-- =========================================================
-- sanity output
-- =========================================================

select
    (select count(*) from information_schema.tables
      where table_schema = 'public'
        and table_name in ('cg_committees', 'cs_committees', 'cg_ministers', 'cs_ministers')) as books,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('committee_of', 'committee_kinds', 'cg_commit', 'cs_commit',
                             'cg_committee_report', 'cs_committee_report',
                             'cg_appoint_minister', 'cs_appoint_minister',
                             'cg_dismiss_minister', 'cs_dismiss_minister',
                             'cg_minister_action', 'cs_minister_action',
                             'cg_government', 'cs_government',
                             'committees_and_ministers_reset')) as new_calls,
    public.committee_of('fleet_construction') as fleet_committee,
    public.committee_of('taxation') as tax_committee,
    public.committee_of('diplomacy') as diplo_committee;
