-- =========================================================
-- GALACTIC FRONT — a ceasefire that only ever lasts a while
--
-- Run this in the Supabase SQL editor (SQL > New query).
-- Safe to run more than once.
--
-- The diplomacy between the Freedom Authority and the Combine is
-- deliberately one-sided in one respect: it can only ever SUSPEND the
-- war. There is no peace treaty, no alliance, no permanent reading to
-- sign — an offer buys a stretch of quiet, at most an hour, and the
-- war resumes by itself when the clock runs out. Nothing here can end
-- the war for good.
--
-- What this patch adds:
--
--   1. public.ceasefires — every offer ever made, and the one that is
--      running. An offer lapses after ten minutes unanswered.
--
--   2. ceasefire_offer(), ceasefire_answer() and ceasefire_state(): the
--      three calls the new DIPLOMACY tab on the galactic map uses.
--
--   3. The war itself is frozen for the duration: war_decision() (the
--      function the planet screens call for every act of war) is kept
--      as war_decision_base and wrapped, so an assault, weapons, heavy
--      equipment or reinforcements are refused while a ceasefire runs.
--      Fortifying is defensive and stays allowed.
--
--   4. The reset button wipes the ceasefires too.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the book of ceasefires
-- ---------------------------------------------------------

create table if not exists public.ceasefires (
    id serial primary key,
    faction_a text not null default 'Freedom Authority',
    faction_b text not null default 'Combine',
    offered_side text not null check (offered_side in ('Freedom Authority', 'Combine')),
    offered_by uuid,
    offered_name text not null default '',
    minutes integer not null check (minutes between 5 and 60),
    status text not null default 'offered' check (status in ('offered', 'active', 'refused', 'expired')),
    offered_at timestamptz not null default now(),
    answered_at timestamptz,
    answered_by uuid,
    answered_name text,
    starts_at timestamptz,
    ends_at timestamptz
);

create index if not exists ceasefires_status_idx on public.ceasefires (status, ends_at);

alter table public.ceasefires enable row level security;


/* the three numbers of the whole system */
create or replace function public.ceasefire_min_minutes()
returns integer language sql immutable as $function$ select 5 $function$;

create or replace function public.ceasefire_max_minutes()
returns integer language sql immutable as $function$ select 60 $function$;

/* an unanswered offer is taken off the table after ten minutes */
create or replace function public.ceasefire_answer_window()
returns integer language sql immutable as $function$ select 600 $function$;


/* puts the book in order: lapsed offers and finished ceasefires */
create or replace function public.ceasefire_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin

    update public.ceasefires as c
    set status = 'expired'
    where c.status = 'offered'
      and c.offered_at < now() - make_interval(secs => public.ceasefire_answer_window());

    update public.ceasefires as c
    set status = 'expired'
    where c.status = 'active'
      and c.ends_at is not null
      and c.ends_at <= now();

end;
$function$;


/* how much quiet is left, in seconds */
create or replace function public.ceasefire_seconds_left()
returns integer
language sql
stable
security definer
set search_path to ''
as $function$
    select coalesce(max(greatest(0, ceil(extract(epoch from (c.ends_at - now())))::integer)), 0)
    from public.ceasefires as c
    where c.status = 'active' and c.ends_at is not null and c.ends_at > now()
$function$;

create or replace function public.ceasefire_active()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
    select public.ceasefire_seconds_left() > 0
$function$;


-- ---------------------------------------------------------
-- 2. offering and signing
-- ---------------------------------------------------------

/* where the two sides stand, and what is on the table */
create or replace function public.ceasefire_state()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_active record;
    v_offer record;
    v_left integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;
    if v_faction is null then v_faction := ''; end if;

    perform public.ceasefire_tick();

    select * into v_active from public.ceasefires as c
    where c.status = 'active' and c.ends_at is not null and c.ends_at > now()
    order by c.ends_at desc
    limit 1;

    select * into v_offer from public.ceasefires as c
    where c.status = 'offered'
    order by c.offered_at desc
    limit 1;

    v_left := public.ceasefire_seconds_left();

    return jsonb_build_object(
        'now', now(),
        'me', v_faction,
        'mine', v_faction in ('Freedom Authority', 'Combine'),
        'min_minutes', public.ceasefire_min_minutes(),
        'max_minutes', public.ceasefire_max_minutes(),
        'answer_window', public.ceasefire_answer_window(),
        'waiting', v_left,
        'active', case when v_active.id is null then null else jsonb_build_object(
            'id', v_active.id,
            'minutes', v_active.minutes,
            'offered_side', v_active.offered_side,
            'signed_by', coalesce(v_active.answered_name, ''),
            'started_at', v_active.starts_at,
            'ends_at', v_active.ends_at,
            'seconds', v_left
        ) end,
        'offer', case when v_offer.id is null then null else jsonb_build_object(
            'id', v_offer.id,
            'minutes', v_offer.minutes,
            'offered_side', v_offer.offered_side,
            'offered_by', coalesce(v_offer.offered_name, ''),
            'mine', v_offer.offered_side = v_faction,
            'seconds', greatest(0, ceil(extract(epoch from
                (v_offer.offered_at + make_interval(secs => public.ceasefire_answer_window()) - now())))::integer)
        ) end,
        'last', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'status', x.status,
                       'minutes', x.minutes,
                       'offered_side', x.offered_side,
                       'offered_name', x.offered_name,
                       'answered_name', coalesce(x.answered_name, ''),
                       'at', coalesce(x.answered_at, x.offered_at)
                   ) order by x.id desc)
            from (select * from public.ceasefires as y order by y.id desc limit 4) as x
        ), '[]'::jsonb)
    );

end;
$function$;


/* offer the other side a stretch of quiet */
create or replace function public.ceasefire_offer(p_minutes integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_name text;
    v_minutes integer := coalesce(p_minutes, 0);
    v_left integer;
    v_offer record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction, coalesce(p.username, '') into v_faction, v_name
    from public.players as p where p.id = me;

    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine sit at this table';
    end if;

    if v_minutes < public.ceasefire_min_minutes() or v_minutes > public.ceasefire_max_minutes() then
        raise exception 'A ceasefire lasts between % and % minutes: this war is never suspended for good.',
            public.ceasefire_min_minutes(), public.ceasefire_max_minutes();
    end if;

    perform public.ceasefire_tick();

    v_left := public.ceasefire_seconds_left();

    if v_left > 0 then
        raise exception 'A ceasefire is already in force for another % minutes.', ceil(v_left / 60.0)::integer;
    end if;

    select * into v_offer from public.ceasefires as c where c.status = 'offered' limit 1;

    if v_offer.id is not null then
        raise exception 'There is already a ceasefire on the table';
    end if;

    insert into public.ceasefires (offered_side, offered_by, offered_name, minutes)
    values (v_faction, me, v_name, v_minutes);

    if v_faction = 'Combine' then
        perform public.cs_log('TRÉGUA: o Soviete propõe ' || v_minutes || ' minutos de cessar-fogo à Freedom Authority.');
    else
        begin
            perform public.cg_log('TRÉGUA: a Freedom Authority propõe ' || v_minutes || ' minutos de cessar-fogo ao Combine.');
        exception when others then null;
        end;
    end if;

    return public.ceasefire_state();

end;
$function$;


/* the other side answers: the offer is signed or thrown away */
create or replace function public.ceasefire_answer(p_id integer, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_name text;
    v_row record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction, coalesce(p.username, '') into v_faction, v_name
    from public.players as p where p.id = me;

    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine sit at this table';
    end if;

    perform public.ceasefire_tick();

    select * into v_row from public.ceasefires as c where c.id = p_id for update;

    if v_row.id is null then raise exception 'That ceasefire is not on the table'; end if;
    if v_row.status <> 'offered' then raise exception 'That ceasefire has already been answered'; end if;
    if v_row.offered_side = v_faction then raise exception 'The other side must answer your offer'; end if;

    if coalesce(p_accept, false) then

        update public.ceasefires as c
        set status = 'active',
            answered_at = now(),
            answered_by = me,
            answered_name = v_name,
            starts_at = now(),
            ends_at = now() + make_interval(mins => c.minutes)
        where c.id = p_id;

        if v_faction = 'Combine' then
            perform public.cs_log('TRÉGUA: o Soviete assina ' || v_row.minutes || ' minutos de cessar-fogo. O fronte congela e a guerra recomeça sozinha quando o relógio chegar a zero.');
        else
            begin
                perform public.cg_log('TRÉGUA: a Freedom Authority assina ' || v_row.minutes || ' minutos de cessar-fogo. O fronte congela e a guerra recomeça sozinha quando o relógio chegar a zero.');
            exception when others then null;
            end;
        end if;

    else

        update public.ceasefires as c
        set status = 'refused', answered_at = now(), answered_by = me, answered_name = v_name
        where c.id = p_id;

        if v_faction = 'Combine' then
            perform public.cs_log('TRÉGUA: o Soviete recusa o cessar-fogo proposto.');
        else
            begin
                perform public.cg_log('TRÉGUA: a Freedom Authority recusa o cessar-fogo proposto.');
            exception when others then null;
            end;
        end if;

    end if;

    return public.ceasefire_state();

end;
$function$;


-- ---------------------------------------------------------
-- 3. the front really stops
--
--    war_decision() is what the planet screens call for every act
--    of war. It is kept as war_decision_base, whatever its
--    signature is, and a thin wrapper in front of it refuses the
--    offensive kinds while a ceasefire runs. Defensive work
--    (fortifying) and talking are not touched.
-- ---------------------------------------------------------

create or replace function public.ceasefire_frozen_notice()
returns text
language sql
stable
security definer
set search_path to ''
as $function$
    select case when public.ceasefire_seconds_left() > 0
        then 'A ceasefire is in force between the Freedom Authority and the Combine for another '
             || public.ceasefire_seconds_left()
             || ' seconds: the front is frozen and no offensive decision is accepted.'
        else null end
$function$;


do $do$
declare
    v_fn record;
    v_kind text;
    v_inputs text := '';
    v_call text := '';
    v_body text;
    v_anon boolean;
    v_auth boolean;
    i integer;
begin

    /* an earlier run already wrapped it */
    if exists (select 1 from pg_proc as p
               join pg_namespace as n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'war_decision_base') then
        return;
    end if;

    select p.oid as oid,
           p.oid::regprocedure::text as signature,
           oidvectortypes(p.proargtypes) as types,
           p.proargtypes::oid[] as argtypes,
           pg_get_function_result(p.oid) as result,
           p.proretset as returns_set,
           p.pronargs as pronargs,
           p.proargnames as argnames,
           p.prosecdef as is_definer
      into v_fn
    from pg_proc as p
    join pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'war_decision'
    order by p.oid
    limit 1;

    if v_fn.oid is null then
        raise notice 'war_decision() was not found: the ceasefire will be kept in the book, but the war will not be frozen.';
        return;
    end if;

    /* we can only wrap a function whose input arguments are named */
    if v_fn.argnames is null
       or array_length(v_fn.argnames, 1) < v_fn.pronargs
       or exists (select 1 from unnest(v_fn.argnames[1:v_fn.pronargs]) as a where a is null) then
        raise notice 'war_decision() has unnamed arguments: the ceasefire will be kept in the book, but the war will not be frozen.';
        return;
    end if;

    v_anon := has_function_privilege('anon', v_fn.oid, 'EXECUTE');
    v_auth := has_function_privilege('authenticated', v_fn.oid, 'EXECUTE');

    execute format('alter function %s rename to war_decision_base', v_fn.signature);

    /* the input arguments, named, and the base called by position: output
       columns of a RETURNS TABLE function are not arguments and are left
       to the RETURNS clause */
    for i in 1 .. v_fn.pronargs loop

        v_inputs := v_inputs || case when i > 1 then ', ' else '' end
                     || quote_ident(v_fn.argnames[i]) || ' '
                     || format_type(v_fn.argtypes[i - 1], null);

        v_call := v_call || case when i > 1 then ', ' else '' end || '$' || i;

    end loop;

    v_call := 'public.war_decision_base(' || v_call || ')';

    /* the argument that says what is being decided */
    select quote_ident(x.name) into v_kind
    from unnest(v_fn.argnames[1:v_fn.pronargs]) with ordinality as x(name, ord)
    where lower(x.name) like '%kind%'
    order by x.ord
    limit 1;

    v_body :=
        'declare v_frozen text;' || chr(10) ||
        'begin' || chr(10) ||
        '    v_frozen := public.ceasefire_frozen_notice();' || chr(10);

    if v_kind is not null then
        v_body := v_body ||
            '    if v_frozen is not null and lower(coalesce(' || v_kind || '::text, ''''))' ||
            ' in (''assault'', ''weapons'', ''heavy'', ''reinforce'') then' || chr(10) ||
            '        raise exception ''%'', v_frozen;' || chr(10) ||
            '    end if;' || chr(10);
    end if;

    if v_fn.result = 'void' then
        v_body := v_body || '    perform ' || v_call || ';' || chr(10) || '    return;' || chr(10);
    elsif v_fn.returns_set then
        v_body := v_body || '    return query select * from ' || v_call || ';' || chr(10);
    else
        v_body := v_body || '    return ' || v_call || ';' || chr(10);
    end if;

    v_body := v_body || 'end;';

    execute format(
        'create or replace function public.war_decision(%s) returns %s language plpgsql volatile %s set search_path to '''' as $wrapper$ %s $wrapper$',
        v_inputs,
        v_fn.result,
        case when v_fn.is_definer then 'security definer' else 'security invoker' end,
        v_body);

    execute format('revoke all on function public.war_decision(%s) from public', v_fn.types);

    if v_auth then
        execute format('grant execute on function public.war_decision(%s) to authenticated', v_fn.types);
    end if;

    if v_anon then
        execute format('grant execute on function public.war_decision(%s) to anon', v_fn.types);
    end if;

    raise notice 'war_decision() is now guarded by the ceasefire.';

end;
$do$;


-- ---------------------------------------------------------
-- 4. the reset button wipes the ceasefires too
-- ---------------------------------------------------------

create or replace function public.game_reset_extras()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    g record;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    select * into g from public.game_control as x where x.id = 1;

    if g.host_player is distinct from auth.uid() then
        raise exception 'Only the host may reset the game';
    end if;

    perform set_config('game.bypass', '1', true);

    /* the Soviet's books */
    delete from public.cs_directives;
    delete from public.cs_votes;
    delete from public.cs_debate_sides;
    delete from public.cs_debate_standing;
    delete from public.cs_privileges;
    delete from public.cs_candidates;
    delete from public.cs_election_votes;
    delete from public.cs_election;
    delete from public.cs_authorizations;
    delete from public.cs_membership;
    delete from public.cs_log;
    delete from public.cs_occupations;
    delete from public.cs_agitprop;

    /* the commissars stay (they are the chamber), but a fresh game finds
       them with their loyalty where their current starts and nobody in
       disgrace */
    begin
        update public.cs_commissars as m
        set loyalty = coalesce((select c.loyalty from public.cs_currents as c where c.id = m.current_id), 55),
            is_disgraced = false,
            active = true;
    exception when undefined_column or undefined_table then null;
    end;

    update public.cs_state as s
    set confidence = 55,
        quota = 1,
        relations = '{"Freedom Authority": -20}'::jsonb,
        secretary_player = null,
        secretary_name = null,
        secretary_current = null,
        term_no = 0,
        term_end = null,
        veto_used = false,
        online_at = null,
        last_npc_at = null,
        last_quota_at = null,
        last_debate_at = null,
        last_election_at = null
    where s.id = 1;

    /* the embassies, the ceasefires and the presence list */
    delete from public.planet_diplomacy;
    delete from public.ceasefires;
    delete from public.player_presence;

    /* the Freedom Authority's elected head, if the column is where this
       patch expects it (the Congress's own reset is not ours to change) */
    begin
        update public.cg_state as s
        set president_player = null,
            term_no = 0,
            term_end = null
        where s.id = 1;
    exception when undefined_column or undefined_table then null;
    end;

    return jsonb_build_object('ok', true);

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('ceasefire_state', 'ceasefire_offer', 'ceasefire_answer',
                             'ceasefire_active', 'ceasefire_tick', 'ceasefire_seconds_left',
                             'ceasefire_frozen_notice')) as ceasefire_functions,
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'ceasefires'
        and column_name in ('offered_side', 'ends_at', 'minutes')) as ceasefire_columns,
    (select count(*) from pg_proc as p
      join pg_namespace as n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'war_decision_base') as war_frozen,
    (select public.ceasefire_seconds_left()) as quiet_left_seconds;
