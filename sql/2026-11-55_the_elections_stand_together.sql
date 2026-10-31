-- =========================================================
-- GALACTIC FRONT — the two elections are held together
--
-- Run in the Supabase SQL editor after 2026-11-54. Safe to run more than once.
--
-- The Freedom Authority elects two chairs: its President, and the Speaker of
-- its Congress. They were two clocks running apart, so one was decided weeks
-- before the other and a fresh war could open with one chair filled and the
-- other still empty.
--
-- From now on the presidential race sets the clock and the chamber follows it:
--
--   cg_speaker_follow(campaign_end, vote_end)
--       called by the Congress page with the window of the presidential race
--       that is running. If the Speaker's chair is empty, the chamber's
--       election opens on exactly that window, so both are decided at the
--       same moment; if it is already open on another window, it is moved
--       onto this one. With no presidential race running, nothing changes.
--
--   cg_elections_pair()
--       once both chairs have been filled in this war, the pair is written
--       down once (cg_election_pair, one row per war) and handed to every
--       screen: who won the presidential race, who won the speakership. The
--       Freedom Authority's screens raise the event from this, and only its
--       members are told.
--
-- Nothing here changes how either election is voted: only when it opens and
-- closes, and who is reported as having won both.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the pair, written down once for each war
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
-- 3. the chamber follows the presidential clock
-- ---------------------------------------------------------

create or replace function public.cg_speaker_follow(
    p_campaign_end timestamptz default null,
    p_vote_end timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    e record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if to_regclass('public.cg_speaker_state') is null then
        return jsonb_build_object('missing', true);
    end if;

    perform public.cg_speaker_seed();
    perform public.cg_speaker_advance();

    select * into st from public.cg_speaker_state as s where s.id = 1;
    select * into e from public.cg_speaker_election as x
    where x.phase <> 'done' order by x.id desc limit 1;

    /* no presidential race on the air: the chamber keeps its own clock */
    if p_campaign_end is not null and p_vote_end is not null and p_vote_end > now() then

        if e.id is null then

            /* an empty chair, and a race already running for the other one */
            if st.speaker_player is null or st.term_end is null or st.term_end <= now() then

                insert into public.cg_speaker_election (phase, campaign_end, vote_end)
                values (case when p_campaign_end > now() then 'campaign' else 'voting' end,
                        p_campaign_end,
                        p_vote_end);

                update public.cg_speaker_state as s set last_election_at = now() where s.id = 1;

                begin
                    perform public.cg_log('CONGRESSO: a eleição para Presidente do Congresso corre com a presidencial — as duas fecham à mesma hora.');
                exception when others then null;
                end;

            end if;

        elsif e.campaign_end is distinct from p_campaign_end
           or e.vote_end is distinct from p_vote_end then

            update public.cg_speaker_election as x
            set campaign_end = p_campaign_end,
                vote_end = p_vote_end
            where x.id = e.id;

        end if;

    end if;

    return public.cg_speaker_state();

end;
$function$;


-- ---------------------------------------------------------
-- 4. both chairs filled: this war's pair
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
    g record;
    v_war text;
    v_pair record;
    v_freedom boolean := false;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select (p.faction = 'Freedom Authority') into v_freedom
    from public.players as p where p.id = me;

    if to_regclass('public.cg_speaker_state') is null or to_regclass('public.cg_state') is null then
        return jsonb_build_object('ready', false, 'freedom', coalesce(v_freedom, false));
    end if;

    perform public.cg_speaker_seed();

    select * into st from public.cg_state as s where s.id = 1;
    select * into sp from public.cg_speaker_state as s where s.id = 1;
    select * into g from public.game_control as c where c.id = 1;

    /* a war in which neither chair has been decided yet */
    if coalesce(st.term_no, 0) < 1 or coalesce(sp.term_no, 0) < 1
       or st.president_player is null or sp.speaker_player is null then
        return jsonb_build_object('ready', false, 'freedom', coalesce(v_freedom, false));
    end if;

    v_war := coalesce(g.started_at::text, g.started::text, 'war');

    select * into v_pair from public.cg_election_pair as x where x.war = v_war;

    if v_pair.id is null then

        insert into public.cg_election_pair (war, president_player, president_name, speaker_player, speaker_name)
        values (v_war,
                st.president_player,
                public.cg_election_name(st.president_player),
                sp.speaker_player,
                coalesce(nullif(sp.speaker_name, ''), public.cg_election_name(sp.speaker_player)))
        on conflict (war) do nothing;

        select * into v_pair from public.cg_election_pair as x where x.war = v_war;

    end if;

    return jsonb_build_object(
        'ready', true,
        'stamp', v_pair.id,
        'president', coalesce(v_pair.president_name, ''),
        'speaker', coalesce(v_pair.speaker_name, ''),
        'freedom', coalesce(v_freedom, false),
        'at', v_pair.created_at
    );

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('cg_speaker_follow', 'cg_elections_pair', 'cg_election_name')) as new_functions,
    (select count(*) from information_schema.tables
      where table_schema = 'public' and table_name = 'cg_election_pair') as pair_table;
