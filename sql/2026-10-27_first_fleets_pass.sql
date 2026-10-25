-- =========================================================
-- GALACTIC FRONT — the first fleets are not allowed to fail
--
-- Run in the Supabase SQL editor after the two-week term file.
-- Safe to run more than once.
--
-- Problem: "Authorize New Fleet Construction" is a bill like any
-- other, so the chamber could throw out the first one — and the
-- Freedom Authority then sat with no fleet at all, unable to do
-- anything, because only Congress can authorise one.
--
-- Rule now, decided at the vote itself:
--
--   * the Authority owns no fleet        -> the vote is unanimous,
--                                           the authorisation passes;
--   * it owns one to four fleets        -> every delegate is 35
--                                           points more likely to
--                                           vote YES than the normal
--                                           odds;
--   * five fleets or more               -> the usual cg_likelihood
--                                           odds, exactly as before.
--
-- Nothing else changes: the cost is still paid when the bill passes,
-- bribes still buy votes (a bought NO still counts), the Knightmare
-- squad bills and every other kind of bill keep their normal odds.
--
-- The rule lives inside cg_resolve(), so it is the vote that is
-- decided, not the display: the forecast bars drawn by
-- congress_overview() still show the base odds.
-- =========================================================


create or replace function public.cg_resolve(p_id integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    p record;
    st record;
    m record;
    sc record;
    v_total integer;
    v_req integer;
    v_yes integer := 0;
    v_no integer := 0;
    v_ab integer := 0;
    v_amt numeric;
    v_stance text;
    v_eff numeric;
    v_was boolean;
    v_vote text;
    v_l numeric;
    v_r numeric;
    v_corr integer;
    v_loy numeric;
    v_closest integer;
    v_old text;
    v_new text;
    v_defect text[] := '{}';
    v_scand text[] := '{}';
    v_removed text[] := '{}';
    v_passed boolean;
    v_status text;
    v_effect text := '';
    v_cred bigint;
    v_delta numeric := 0;
    /* the opening of the Authority: how many fleets it already has,
       and what that does to this bill */
    v_fleets integer;
    v_force boolean := false;
    v_boost numeric := 0;
begin
    select * into p from public.cg_proposals as x where x.id = p_id for update;
    if not found or p.status not in ('introduction', 'debate') then return null; end if;

    select * into st from public.cg_state as s where s.id = 1;
    select count(*) into v_total from public.cg_members as c where c.active;

    v_req := case
        when p.ptype in ('fleet_construction', 'knightmare_construction', 'taxation', 'fleet_revocation')
            then ceil(v_total * 2.0 / 3)::integer
        else floor(v_total / 2.0)::integer + 1 end;

    /* the first fleet cannot be voted down, and the second and third
       are pushed hard: after the third the chamber behaves as always */
    if p.ptype = 'fleet_construction' then

        select count(*) into v_fleets
        from public.fleets as f
        where f.faction = 'Freedom Authority';

        if v_fleets = 0 then
            v_force := true;
        elsif v_fleets < 5 then
            v_boost := 35;
        end if;

    end if;

    for m in select * from public.cg_members as c where c.active order by c.id loop

        v_was := false;
        v_corr := m.corruption_level;
        v_l := null;

        select coalesce(sum(b.amount), 0), max(b.stance) into v_amt, v_stance
        from public.cg_bribes as b where b.proposal_id = p.id and b.member_id = m.id;

        /* a bribe works more often on a disloyal member */
        if v_amt > 0 then
            v_eff := (v_amt / 1000.0) * (1 - m.loyalty / 100.0);
            if random() < v_eff then
                v_was := true;
                v_corr := v_corr + 5 + floor(random() * 11)::integer;
            end if;
        end if;

        if v_was then
            v_vote := v_stance;
        else
            v_l := public.cg_likelihood(m.faction_id, m.loyalty, p.sponsor_faction_id, p.ptype, st.popularity);

            /* the opening fleet rule */
            if v_force then
                v_l := 100;
            elsif v_boost > 0 then
                v_l := least(100, v_l + v_boost);
            end if;

            v_r := random();
            if v_r < v_l / 100.0 then v_vote := 'yes';
            elsif v_r < (v_l + 25) / 100.0 then v_vote := 'no';
            else v_vote := 'abstain';
            end if;
        end if;

        if v_vote = 'yes' then v_yes := v_yes + 1;
        elsif v_vote = 'no' then v_no := v_no + 1;
        else v_ab := v_ab + 1;
        end if;

        insert into public.cg_votes (proposal_id, member_id, vote, was_bribed, likelihood)
        values (p.id, m.id, v_vote, v_was, v_l);

        if v_was then

            update public.cg_members as c
            set corruption_level = v_corr, bribes_received = c.bribes_received + 1
            where c.id = m.id;

            /* too corrupt: the evidence piles up */
            if v_corr > 75 and not m.is_corrupted then
                update public.cg_members as c set is_corrupted = true where c.id = m.id;
                insert into public.cg_scandals (member_id, member_name, proposal_id, scandal_type, evidence_strength)
                values (m.id, m.name, p.id, 'bribery', least(100, 40 + v_corr / 2));
                v_scand := v_scand || m.name;
            end if;

        end if;

        /* 2 % chance per vote of losing loyalty; below 30 the member changes faction */
        if random() < 0.02 then
            v_loy := m.loyalty - (5 + floor(random() * 11));
            if v_loy < 30 then
                select f.id into v_closest from public.cg_factions as f
                where f.id <> m.faction_id
                order by sqrt((f.alignment_x - m.alignment_x) ^ 2 + (f.alignment_y - m.alignment_y) ^ 2) limit 1;
                select f.name into v_old from public.cg_factions as f where f.id = m.faction_id;
                select f.name into v_new from public.cg_factions as f where f.id = v_closest;
                update public.cg_members as c set faction_id = v_closest, loyalty = 75 where c.id = m.id;
                v_defect := v_defect || (m.name || ': ' || v_old || ' to ' || v_new);
            else
                update public.cg_members as c set loyalty = v_loy where c.id = m.id;
            end if;
        end if;

    end loop;

    v_passed := v_yes >= v_req;
    v_status := case when v_passed then 'passed' else 'rejected' end;

    /* the proposal's price is paid when it passes */
    if v_passed and p.cost > 0 then

        perform public.collect_faction_income();

        select ft.credits into v_cred from public.faction_treasury as ft where ft.faction = 'Freedom Authority' for update;

        if v_cred is null or v_cred < p.cost then
            v_passed := false;
            v_status := 'failed_funds';
            v_effect := 'Congress approved, but the Authority could not pay ' || p.cost || ' credits.';
        else
            update public.faction_treasury as ft set credits = ft.credits - p.cost where ft.faction = 'Freedom Authority';
        end if;

    end if;

    if v_passed then v_effect := public.cg_execute(p.id); end if;

    /* prestige of the Authority: wins and losses in Congress */
    if p.source = 'player' then
        v_delta := case
            when v_passed then (case p.ptype when 'military_action' then 1 when 'fleet_construction' then 3 when 'knightmare_construction' then 3
                                     when 'resource_allocation' then 2 when 'diplomacy' then 2 else 0 end)
            when v_status = 'rejected' then (case p.ptype when 'military_action' then -2 when 'fleet_construction' then -2
                                     when 'knightmare_construction' then -2 when 'diplomacy' then -2 else 0 end)
            else 0 end;
        if v_delta <> 0 then
            update public.cg_state as s set popularity = greatest(0, least(100, s.popularity + v_delta)) where s.id = 1;
        end if;
    end if;

    /* scandals that were already brewing may now become public */
    for sc in
        select s.* from public.cg_scandals as s
        join public.cg_members as c on c.id = s.member_id
        where not s.is_exposed and c.active
    loop
        if random() < (sc.evidence_strength / 100.0) * 0.5 then
            v_new := public.cg_replace_member(sc.member_id);
            update public.cg_scandals as s set is_exposed = true, exposed_at = now(), replacement_name = v_new where s.id = sc.id;
            update public.cg_state as s set popularity = greatest(0, s.popularity - 8) where s.id = 1;
            v_removed := v_removed || (sc.member_name || ' (corruption) replaced by ' || v_new);
            perform public.cg_log('SCANDAL: delegate ' || sc.member_name || ' exposed for corruption and removed. ' || v_new || ' takes the seat.');
        end if;
    end loop;

    /* every bribe carries a risk of being exposed: 5 % per 100 credits */
    for m in
        select c.* from public.cg_members as c
        where c.active and c.id in (select b.member_id from public.cg_bribes as b where b.proposal_id = p.id)
    loop
        if random() < least(0.95, m.bribe_exposure) then
            v_new := public.cg_replace_member(m.id);
            insert into public.cg_scandals (member_id, member_name, proposal_id, scandal_type, evidence_strength, is_exposed, exposed_at, replacement_name)
            values (m.id, m.name, p.id, 'bribery', 100, true, now(), v_new);
            update public.cg_state as s set popularity = greatest(0, s.popularity - 8) where s.id = 1;
            v_removed := v_removed || (m.name || ' (bribe exposed) replaced by ' || v_new);
            perform public.cg_log('SCANDAL: a bribery network is exposed. ' || m.name || ' is removed, ' || v_new || ' takes the seat.');
        else
            update public.cg_members as c set bribe_exposure = c.bribe_exposure * 0.5 where c.id = m.id;
        end if;
    end loop;

    update public.cg_proposals as x
    set status = v_status, yes_votes = v_yes, no_votes = v_no, abstain_votes = v_ab, required_votes = v_req,
        resolved_at = now(),
        result = jsonb_build_object('effect', v_effect, 'defections', to_jsonb(v_defect), 'scandals', to_jsonb(v_scand),
                                    'removed', to_jsonb(v_removed), 'total', v_total)
    where x.id = p.id;

    perform public.cg_log(
        case v_status when 'passed' then 'PASSED' when 'failed_funds' then 'NO FUNDS' else 'REJECTED' end
        || ': "' || p.title || '" (' || v_yes || ' yes, ' || v_no || ' no, ' || v_ab || ' abstain; ' || v_req || ' needed). ' || v_effect);

    return jsonb_build_object('status', v_status, 'yes', v_yes, 'no', v_no, 'abstain', v_ab, 'required', v_req);
end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from public.fleets as f where f.faction = 'Freedom Authority') as authority_fleets,
    (select count(*) from public.cg_proposals as x
      where x.ptype = 'fleet_construction' and x.status in ('introduction', 'debate')) as live_fleet_bills,
    (select count(*) from information_schema.routines
      where routine_schema = 'public' and routine_name = 'cg_resolve') as resolve_present;
