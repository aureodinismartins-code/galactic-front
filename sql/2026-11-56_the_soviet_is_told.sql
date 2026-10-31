-- =========================================================
-- GALACTIC FRONT — the Soviet is told as well
--
-- Run in the Supabase SQL editor after 2026-11-55. Safe to run more than once,
-- and safe to run on a database where 55 was never applied: this patch creates
-- the pair and the name helper it needs.
--
-- 2026-11-55 gave the Freedom Authority its pair: once the President and the
-- Speaker of the Congress are both in their chairs, the pair is written down
-- once per war and its screens raise the event.
--
-- The Combine holds the same two offices in its own dress: a President, and
-- the High Commissar of the Supreme Soviet instead of a Speaker. This patch
-- lets cg_elections_pair() answer for either faction, out of the same row,
-- so the two sides read the same result and each is told in its own words.
--
--   cg_elections_pair() now also returns
--
--       combine        true for a Combine player
--       commissar      the High Commissar's name
--       soviet_ready   true once the President and the High Commissar are
--                      both decided in this war
--
-- The Freedom Authority's fields (ready, speaker, stamp) are unchanged, and
-- a database without the Soviet's tables still answers for the Congress.
-- Nothing here touches how either election is run or voted.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the pair, written down once for each war
--    (2026-11-55 makes this too; running either first is harmless)
-- ---------------------------------------------------------

create table if not exists public.cg_election_pair (
    id bigserial primary key,
    war text not null,
    president_player uuid,
    president_name text not null default '',
    speaker_player uuid,
    speaker_name text not null default '',
    created_at timestamptz not null default now(),
    unique (war)
);

alter table public.cg_election_pair enable row level security;

/* a pair from an older patch may be missing a chair */
alter table public.cg_election_pair add column if not exists president_player uuid;
alter table public.cg_election_pair add column if not exists president_name text not null default '';
alter table public.cg_election_pair add column if not exists speaker_player uuid;
alter table public.cg_election_pair add column if not exists speaker_name text not null default '';
alter table public.cg_election_pair add column if not exists created_at timestamptz not null default now();


-- ---------------------------------------------------------
-- 2. what a commander is called
-- ---------------------------------------------------------

create or replace function public.cg_election_name(p_player uuid)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v text;
    v_col text;
begin

    if p_player is null then return ''; end if;

    /* the players table carries the name under one of two names */
    select c.column_name into v_col
    from information_schema.columns as c
    where c.table_schema = 'public' and c.table_name = 'players'
      and c.column_name in ('username', 'name')
    order by (c.column_name = 'username') desc
    limit 1;

    if v_col is not null then
        begin
            execute format('select %I from public.players as p where p.id = $1', v_col)
            into v using p_player;
        exception when others then v := null;
        end;
    end if;

    if coalesce(v, '') = '' then
        v := 'Commander ' || left(p_player::text, 4);
    end if;

    return v;

end;
$function$;


-- ---------------------------------------------------------
-- 3. the Soviet's chair joins the pair
-- ---------------------------------------------------------

alter table public.cg_election_pair add column if not exists commissar_player uuid;
alter table public.cg_election_pair add column if not exists commissar_name text not null default '';


-- ---------------------------------------------------------
-- 4. one answer for both factions
-- ---------------------------------------------------------

create or replace function public.cg_elections_pair()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    sp record;
    sv record;
    g record;
    v_war text;
    v_pair record;
    v_freedom boolean := false;
    v_combine boolean := false;
    v_congress boolean := false;
    v_soviet boolean := false;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select (p.faction = 'Freedom Authority') into v_freedom
    from public.players as p where p.id = me;

    select (p.faction = 'Combine') into v_combine
    from public.players as p where p.id = me;

    if to_regclass('public.cg_state') is null then
        return jsonb_build_object('ready', false, 'soviet_ready', false,
                                  'freedom', coalesce(v_freedom, false),
                                  'combine', coalesce(v_combine, false));
    end if;

    select * into st from public.cg_state as s where s.id = 1;

    if to_regclass('public.cg_speaker_state') is not null then
        begin
            perform public.cg_speaker_seed();
        exception when undefined_function then null;
        end;
        select * into sp from public.cg_speaker_state as s where s.id = 1;
    end if;

    if to_regclass('public.cs_state') is not null then
        select * into sv from public.cs_state as s where s.id = 1;
    end if;

    select * into g from public.game_control as c where c.id = 1;

    /* the Congress: the President and the Speaker */
    v_congress := coalesce(st.term_no, 0) >= 1 and st.president_player is not null
                  and coalesce(sp.term_no, 0) >= 1 and sp.speaker_player is not null;

    /* the Soviet: the President and the High Commissar */
    v_soviet := coalesce(st.term_no, 0) >= 1 and st.president_player is not null
                and coalesce(sv.term_no, 0) >= 1 and sv.secretary_player is not null;

    if not v_congress and not v_soviet then
        return jsonb_build_object('ready', false, 'soviet_ready', false,
                                  'freedom', coalesce(v_freedom, false),
                                  'combine', coalesce(v_combine, false));
    end if;

    v_war := coalesce(g.started_at::text, g.started::text, 'war');

    /* one row per war, filled in as each side's chairs are decided */
    insert into public.cg_election_pair (war) values (v_war) on conflict (war) do nothing;

    update public.cg_election_pair as x set
        president_player = coalesce(x.president_player, st.president_player),
        president_name = case when x.president_name <> '' then x.president_name
                              else public.cg_election_name(st.president_player) end,
        speaker_player = coalesce(x.speaker_player, sp.speaker_player),
        speaker_name = case when x.speaker_name <> '' then x.speaker_name
                            when coalesce(sp.speaker_name, '') <> '' then sp.speaker_name
                            else public.cg_election_name(sp.speaker_player) end,
        commissar_player = coalesce(x.commissar_player, sv.secretary_player),
        commissar_name = case when x.commissar_name <> '' then x.commissar_name
                              else coalesce(sv.secretary_name, '') end
    where x.war = v_war;

    select * into v_pair from public.cg_election_pair as x where x.war = v_war;

    return jsonb_build_object(
        'ready', v_congress,
        'stamp', v_pair.id,
        'president', coalesce(v_pair.president_name, ''),
        'speaker', coalesce(v_pair.speaker_name, ''),
        'commissar', coalesce(v_pair.commissar_name, ''),
        'soviet_ready', v_soviet,
        'freedom', coalesce(v_freedom, false),
        'combine', coalesce(v_combine, false),
        'at', v_pair.created_at
    );

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'cg_election_pair'
        and column_name in ('commissar_player', 'commissar_name')) as pair_columns,
    (select count(*) from information_schema.routines
      where routine_schema = 'public' and routine_name = 'cg_elections_pair') as pair_function;
