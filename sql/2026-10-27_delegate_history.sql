-- =========================================================
-- GALACTIC FRONT — a delegate's voting record
--
-- Run in the Supabase SQL editor. Safe to run more than once.
-- It can run with maintenance on or off.
--
-- Read only: it changes nothing and writes nothing to the game.
-- cg_votes already keeps every vote of every bill, so the
-- Congress panel can show how a delegate has voted, how often
-- they were bought, and how they leaned on the last few bills.
--
-- congress_member_history(member) returns:
--   yes / no / abstain / bribed   lifetime counts
--   votes[]                       the last twelve bills, newest first
-- =========================================================


create or replace function public.congress_member_history(p_member integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_member record;
    v_yes integer := 0;
    v_no integer := 0;
    v_ab integer := 0;
    v_bribed integer := 0;
    v_votes jsonb;
begin

    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    select c.id, c.name, c.faction_id into v_member
    from public.cg_members as c
    where c.id = p_member;

    if v_member.id is null then
        raise exception 'Unknown delegate';
    end if;

    select
        count(*) filter (where v.vote = 'yes'),
        count(*) filter (where v.vote = 'no'),
        count(*) filter (where v.vote = 'abstain'),
        count(*) filter (where v.was_bribed)
    into v_yes, v_no, v_ab, v_bribed
    from public.cg_votes as v
    where v.member_id = p_member;

    select coalesce(jsonb_agg(jsonb_build_object(
                'title', x.title,
                'vote', v.vote,
                'bribed', v.was_bribed,
                'status', x.status::text,
                'at', x.resolved_at
            ) order by x.id desc), '[]'::jsonb)
    into v_votes
    from (
        select v2.*
        from public.cg_votes as v2
        where v2.member_id = p_member
        order by v2.proposal_id desc
        limit 12
    ) as v
    join public.cg_proposals as x on x.id = v.proposal_id;

    return jsonb_build_object(
        'member', v_member.id,
        'name', v_member.name,
        'yes', coalesce(v_yes, 0),
        'no', coalesce(v_no, 0),
        'abstain', coalesce(v_ab, 0),
        'bribed', coalesce(v_bribed, 0),
        'votes', v_votes
    );

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from public.cg_votes as v) as votes_on_record,
    (select count(*) from information_schema.routines
      where routine_schema = 'public' and routine_name = 'congress_member_history') as reader_present;
