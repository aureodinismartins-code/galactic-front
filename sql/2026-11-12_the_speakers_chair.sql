-- =========================================================
-- GALACTIC FRONT — the chamber's chair is the Speaker of the Congress
--
-- Run in the Supabase SQL editor after 2026-11-11. Safe to run more than once.
--
-- Two chairs, two names, and they were being confused with each other:
--
--   * the PRESIDENT leads the Freedom Authority — the faction leader the
--     players elect (cg_state.president_player), five proposals before
--     Congress, the state's initiatives in their name;
--   * the SPEAKER OF THE CONGRESS runs the floor and holds the chamber's
--     veto — the second chair the players elect underneath them.
--
-- The books never changed name: cg_speaker_state, cg_speaker_election,
-- congress_speaker_veto. This patch is only about what the players read.
--
--   * every line the Congress writes into the log is rewritten on the way
--     in, so "Presidente do Congresso" becomes "Orador do Congresso".
--     That is a trigger rather than three copied functions: the writers
--     (cg_speaker_advance, cg_speaker_run, congress_speaker_veto) stay
--     exactly as they are, and anything written later is covered too.
--   * the lines already stored are corrected once, so the log reads the
--     same from the first war onwards.
--   * the chamber's veto says so in its own words: it is refused with
--     "Only the Speaker of the Congress may veto", and a bill it kills
--     records "Vetado pelo Orador do Congresso."
-- =========================================================


-- ---------------------------------------------------------
-- 1. the wording, from now on
--
-- The trigger is named zz_... on purpose: the database fires before-row
-- triggers in alphabetical order of their name, and this one has to run
-- AFTER pt_cg_log_bi (2026-10-25), which translates English server text
-- into Portuguese. Whatever that trigger writes, this one is the last
-- word on the title of the chair.
-- ---------------------------------------------------------

create or replace function public.chair_speaker_text()
returns trigger
language plpgsql
security invoker
set search_path to ''
as $function$
declare
    /* old, new, old, new: pairs, applied in this order */
    v_pairs text[] := array[
        'ninguém se candidatou à presidência do Congresso',
        'ninguém se candidatou a Orador do Congresso',
        'Presidente do Congresso',
        'Orador do Congresso'
    ];
    i integer := 1;
begin

    while i < array_length(v_pairs, 1) loop
        new.text := replace(new.text, v_pairs[i], v_pairs[i + 1]);
        i := i + 2;
    end loop;

    return new;

end;
$function$;


drop trigger if exists zz_chair_speaker_bi on public.cg_log;

create trigger zz_chair_speaker_bi
before insert or update on public.cg_log
for each row
execute function public.chair_speaker_text();


-- ---------------------------------------------------------
-- 2. the lines already in the log
--
-- These are user triggers and the game_guard on cg_log refuses writes
-- while the game is closed; this repair is not gameplay, so they are off
-- for these statements and back on immediately after. DDL is
-- transactional here, so a failure rolls the disable back instead of
-- leaving the table unprotected.
-- ---------------------------------------------------------

alter table public.cg_log disable trigger user;

update public.cg_log as l
set text = replace(replace(l.text,
        'ninguém se candidatou à presidência do Congresso', 'ninguém se candidatou a Orador do Congresso'),
        'Presidente do Congresso', 'Orador do Congresso')
where l.text like '%Presidente do Congresso%';

alter table public.cg_log enable trigger user;


/* a bill killed by the chamber's veto kept the old title in its effect */
do $do$
begin

    if to_regclass('public.cg_proposals') is not null
       and exists (select 1 from information_schema.columns as c
                   where c.table_schema = 'public' and c.table_name = 'cg_proposals'
                     and c.column_name = 'result'
                     and c.data_type = 'jsonb') then

        alter table public.cg_proposals disable trigger user;

        execute $sql$update public.cg_proposals
                       set result = jsonb_set(result, '{effect}',
                                       to_jsonb(replace(result ->> 'effect',
                                                        'Presidente do Congresso', 'Orador do Congresso')))
                       where result is not null
                         and result ? 'effect'
                         and result ->> 'effect' like '%Presidente do Congresso%'$sql$;

        alter table public.cg_proposals enable trigger user;

    end if;

end
$do$;


-- ---------------------------------------------------------
-- 3. the chamber's veto, in the chamber's words
--
-- The same function as 2026-11-06, with the two strings it says out loud
-- put right. Nothing about how the veto works changed: one bill a term,
-- only while the bill is on the floor, and only the Speaker's.
-- ---------------------------------------------------------

create or replace function public.congress_speaker_veto(p_proposal integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    p record;
    v_text text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    perform public.cg_speaker_seed();

    select * into st from public.cg_speaker_state as s where s.id = 1;

    if st.speaker_player is null or st.speaker_player <> me then
        raise exception 'Only the Speaker of the Congress may veto';
    end if;

    if st.veto_used then
        raise exception 'The veto of this term has been used';
    end if;

    select * into p from public.cg_proposals as x where x.id = p_proposal for update;
    if p.id is null or p.status not in ('introduction', 'debate') then
        raise exception 'Only a live bill can be vetoed';
    end if;

    update public.cg_proposals as x
    set status = 'rejected'
    where x.id = p_proposal;

    /* whatever else this database keeps on a bill is filled in if it is
       there: the result of a veto is nothing at all */
    if exists (select 1 from information_schema.columns as c
               where c.table_schema = 'public' and c.table_name = 'cg_proposals'
                 and c.column_name = 'result') then
        execute 'update public.cg_proposals set result = $1 where id = $2'
        using jsonb_build_object('effect', 'Vetado pelo Orador do Congresso.', 'vetoed', true), p_proposal;
    end if;

    if exists (select 1 from information_schema.columns as c
               where c.table_schema = 'public' and c.table_name = 'cg_proposals'
                 and c.column_name = 'resolved_at') then
        execute 'update public.cg_proposals set resolved_at = now() where id = $1'
        using p_proposal;
    end if;

    update public.cg_speaker_state as s set veto_used = true where s.id = 1;

    v_text := 'VETO: o Orador do Congresso ' || coalesce(st.speaker_name, '')
              || ' veta "' || coalesce(p.title, 'a proposta') || '".';

    begin
        perform public.cg_log(v_text);
    exception when others then null;
    end;

    return jsonb_build_object('ok', true, 'proposal', p_proposal);

end;
$function$;


-- ---------------------------------------------------------
-- 4. sanity output
-- ---------------------------------------------------------

do $do$
declare
    v_rule integer;
    v_left integer;
    v_speaker text;
begin

    select count(*) into v_rule from pg_trigger where tgname = 'zz_chair_speaker_bi';

    v_left := 0;
    if to_regclass('public.cg_log') is not null then
        execute 'select count(*) from public.cg_log where text like ''%Presidente do Congresso%'''
        into v_left;
    end if;

    v_speaker := 'no Speaker yet';
    if to_regclass('public.cg_speaker_state') is not null then
        execute 'select coalesce(speaker_name, ''no Speaker yet'') from public.cg_speaker_state where id = 1'
        into v_speaker;
    end if;

    raise notice 'the chair is the Speaker: rule_installed=%, old_lines_left=%, speaker=%',
        v_rule, v_left, v_speaker;

end
$do$;
