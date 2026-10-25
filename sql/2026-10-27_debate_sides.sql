-- =========================================================
-- GALACTIC FRONT — the debate moves the chamber
--
-- Run in the Supabase SQL editor AFTER 2026-10-27_first_fleets_pass.sql
-- (this file replaces cg_resolve again and keeps that rule). Safe to
-- run more than once. It can run with maintenance on or off.
--
-- A bill used to have one fixed chance per delegate, and the chamber
-- sat still for eight minutes. Now every delegate takes a SIDE when
-- the bill is introduced, and the debate changes it:
--
--   * cg_debate_tick() lets a few delegates cross the floor every
--     15 seconds — a yes becomes a no, a no becomes a yes, the
--     undecided pick a side. Delegates of the sponsoring faction
--     are the most stubborn;
--   * the sides are visible: cg_debate_view() returns how the
--     chamber stands per faction and per seat, so the dome can be
--     painted and the bill can show its real tally;
--   * the vote at the end is the side the chamber reached —
--     a bribe still overrides everything;
--   * a bill costs the treasury nothing, whether it passes or not;
--   * when a bill crosses the votes it needs (or loses them) the
--     Congress log says so, once;
--   * the opening fleet rule still holds: a bill for the very first
--     fleet is unanimous and does not drift.
--
-- The tick is driven by the Congress screen (it is called on every
-- refresh) and does nothing while no Freedom Authority player is
-- online, exactly like the rest of Congress.
-- =========================================================


-- ---------------------------------------------------------
-- 1. where the sides live
-- ---------------------------------------------------------

create table if not exists public.cg_debate_sides (
    proposal_id integer not null references public.cg_proposals (id) on delete cascade,
    member_id integer not null references public.cg_members (id) on delete cascade,
    side text not null check (side in ('yes', 'no', 'undecided')),
    changed_at timestamptz not null default now(),
    changes integer not null default 0,
    primary key (proposal_id, member_id)
);

/* the last time the chamber moved, and whether each bill was winning */
create table if not exists public.cg_debate_state (
    id integer primary key check (id = 1),
    last_at timestamptz,
    last_log_at timestamptz
);

insert into public.cg_debate_state (id, last_at)
values (1, null)
on conflict (id) do nothing;

create table if not exists public.cg_debate_standing (
    proposal_id integer primary key references public.cg_proposals (id) on delete cascade,
    winning boolean,
    changed_at timestamptz
);

alter table public.cg_debate_sides enable row level security;
alter table public.cg_debate_state enable row level security;
alter table public.cg_debate_standing enable row level security;


-- ---------------------------------------------------------
-- 2. the debate itself
-- ---------------------------------------------------------

create or replace function public.cg_debate_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    st record;
    pr record;
    m record;
    v_total integer;
    v_need integer;
    v_fleets integer;
    v_force boolean;
    v_boost numeric;
    v_yes integer;
    v_winning boolean;
    v_was boolean;
begin

    if auth.uid() is null then return; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then return; end if;
    if public.game_frozen() then return; end if;

    select * into st from public.cg_state as s where s.id = 1;

    /* Congress is not in session without a Freedom Authority player */
    if now() - st.fa_online_at > interval '150 seconds' then return; end if;

    if not pg_try_advisory_xact_lock(7770010) then return; end if;

    /* one movement every 15 seconds, however often the screen asks */
    if exists (select 1 from public.cg_debate_state as x
               where x.id = 1 and x.last_at is not null and x.last_at > now() - interval '15 seconds') then
        return;
    end if;

    update public.cg_debate_state as x set last_at = now() where x.id = 1;

    /* a bill that is no longer live keeps no sides */
    delete from public.cg_debate_sides as s
    where not exists (select 1 from public.cg_proposals as p
                      where p.id = s.proposal_id and p.status in ('introduction', 'debate'));

    select count(*) into v_total from public.cg_members as c where c.active;

    for pr in
        select p.* from public.cg_proposals as p
        where p.status in ('introduction', 'debate')
        order by p.id
    loop

        /* the opening fleet rule, the same one cg_resolve applies */
        v_force := false;
        v_boost := 0;

        if pr.ptype = 'fleet_construction' then
            select count(*) into v_fleets from public.fleets as f where f.faction = 'Freedom Authority';
            if v_fleets = 0 then v_force := true;
            elsif v_fleets < 5 then v_boost := 35;
            end if;
        end if;

        /* everybody takes a side the first time the bill is looked at */
        if not exists (select 1 from public.cg_debate_sides as s where s.proposal_id = pr.id) then

            insert into public.cg_debate_sides (proposal_id, member_id, side)
            select pr.id, c.id,
                   case
                       when v_force then 'yes'
                       else
                           case
                               when random() < least(100, least(100, public.cg_likelihood(c.faction_id, c.loyalty, pr.sponsor_faction_id, pr.ptype, st.popularity) + v_boost)) / 100.0 then 'yes'
                               when random() < (least(100, public.cg_likelihood(c.faction_id, c.loyalty, pr.sponsor_faction_id, pr.ptype, st.popularity) + v_boost) + 25) / 100.0 then 'no'
                               else 'undecided'
                           end
                   end
            from public.cg_members as c
            where c.active
            on conflict (proposal_id, member_id) do nothing;

            insert into public.cg_debate_standing (proposal_id, winning)
            values (pr.id, null)
            on conflict (proposal_id) do nothing;

        end if;

        /* a unanimous opening fleet does not drift */
        if v_force then
            continue;
        end if;

        /* the floor moves: a few delegates cross over, the undecided choose */
        update public.cg_debate_sides as s
        set side = case
                when s.side = 'yes' then 'no'
                when s.side = 'no' then 'yes'
                else case when random() < 0.5 then 'yes' else 'no' end
            end,
            changed_at = now(),
            changes = s.changes + 1
        where s.proposal_id = pr.id
          and s.member_id in (
            select c.member_id
            from (
                select x.member_id,
                       /* the sponsoring faction is the stubborn one */
                       case when cm.faction_id = pr.sponsor_faction_id then 0.03 else 0.07 end as p
                from public.cg_debate_sides as x
                join public.cg_members as cm on cm.id = x.member_id
                where x.proposal_id = pr.id
            ) as c
            where random() < c.p
            limit 9
        );

        /* did the bill just cross the line it needs? */
        select count(*) filter (where s.side = 'yes') into v_yes
        from public.cg_debate_sides as s where s.proposal_id = pr.id;

        v_need := case
            when pr.ptype in ('fleet_construction', 'knightmare_construction', 'taxation', 'fleet_revocation')
                then ceil(v_total * 2.0 / 3)::integer
            else floor(v_total / 2.0)::integer + 1 end;

        v_winning := v_yes >= v_need;

        select x.winning into v_was from public.cg_debate_standing as x where x.proposal_id = pr.id;

        update public.cg_debate_standing as x
        set winning = v_winning, changed_at = now()
        where x.proposal_id = pr.id;

        /* only a crossing is news: a new bill stays quiet until it moves */
        if v_was is not null and v_was is distinct from v_winning then

            perform public.cg_log(
                case when v_winning
                    then 'DEBATE: a câmara volta-se a favor de "' || pr.title || '": ' || v_yes || ' de ' || v_need || ' votos prometidos.'
                    else 'DEBATE: a câmara volta-se contra "' || pr.title || '": só ' || v_yes || ' de ' || v_need || ' votos prometidos.'
                end
            );

        end if;

    end loop;

    /* forget bills that are gone */
    delete from public.cg_debate_standing as x
    where not exists (select 1 from public.cg_proposals as p where p.id = x.proposal_id);

end;
$function$;


-- ---------------------------------------------------------
-- 3. how the chamber stands (what the screen paints)
-- ---------------------------------------------------------

create or replace function public.cg_debate_view()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_out jsonb;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    select coalesce(jsonb_agg(jsonb_build_object(
                'id', p.id,
                'status', p.status::text,
                'yes', (select count(*) from public.cg_debate_sides as s where s.proposal_id = p.id and s.side = 'yes'),
                'no', (select count(*) from public.cg_debate_sides as s where s.proposal_id = p.id and s.side = 'no'),
                'undecided', (select count(*) from public.cg_debate_sides as s where s.proposal_id = p.id and s.side = 'undecided'),
                'sides', coalesce((
                    select jsonb_object_agg(s.member_id::text, s.side)
                    from public.cg_debate_sides as s where s.proposal_id = p.id
                ), '{}'::jsonb),
                'factions', coalesce((
                    select jsonb_object_agg(t.faction_id::text, jsonb_build_object('yes', t.n_yes, 'no', t.n_no, 'undecided', t.n_und))
                    from (
                        select c.faction_id,
                               count(*) filter (where s.side = 'yes') as n_yes,
                               count(*) filter (where s.side = 'no') as n_no,
                               count(*) filter (where s.side = 'undecided') as n_und
                        from public.cg_debate_sides as s
                        join public.cg_members as c on c.id = s.member_id
                        where s.proposal_id = p.id
                        group by c.faction_id
                    ) as t
                ), '{}'::jsonb)
            ) order by p.id), '[]'::jsonb)
    into v_out
    from public.cg_proposals as p
    where p.status in ('introduction', 'debate');

    return jsonb_build_object('proposals', v_out);

end;
$function$;


-- ---------------------------------------------------------
-- 4. the vote is the side the debate reached
--    (same function as 2026-10-27_first_fleets_pass.sql, plus the sides)
-- ---------------------------------------------------------

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
    v_delta numeric := 0;
    v_fleets integer;
    v_force boolean := false;
    v_boost numeric := 0;
    v_side text;
begin
    select * into p from public.cg_proposals as x where x.id = p_id for update;
    if not found or p.status not in ('introduction', 'debate') then return null; end if;

    select * into st from public.cg_state as s where s.id = 1;
    select count(*) into v_total from public.cg_members as c where c.active;

    v_req := case
        when p.ptype in ('fleet_construction', 'knightmare_construction', 'taxation', 'fleet_revocation')
            then ceil(v_total * 2.0 / 3)::integer
        else floor(v_total / 2.0)::integer + 1 end;

    /* the opening fleet rule, for a bill the debate never had a chance to seed */
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
        v_side := null;

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
            /* the side the debate left them on */
            if v_force then
                v_side := 'yes';
            else
                select s.side into v_side
                from public.cg_debate_sides as s
                where s.proposal_id = p.id and s.member_id = m.id;
            end if;

            if v_side is not null then
                v_vote := case v_side when 'undecided' then 'abstain' else v_side end;
            else
                v_l := public.cg_likelihood(m.faction_id, m.loyalty, p.sponsor_faction_id, p.ptype, st.popularity);

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

    /* a bill does not cost the treasury anything: passing it is what puts the
       authorisation, the war, the relief or the tax in place, and that is all.
       (The fleet itself is still paid for when it is built from the map.) */

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

    /* the record of the debate is no longer needed */
    delete from public.cg_debate_sides as s where s.proposal_id = p.id;
    delete from public.cg_debate_standing as x where x.proposal_id = p.id;

    return jsonb_build_object('status', v_status, 'yes', v_yes, 'no', v_no, 'abstain', v_ab, 'required', v_req);
end;
$function$;


-- ---------------------------------------------------------
-- 5. the bills that are already on record: their price is gone
--
-- game_guard refuses writes on cg_proposals while the game is closed,
-- and this repair is not gameplay, so the user triggers are off for
-- this one statement and back on immediately after.
-- ---------------------------------------------------------

alter table public.cg_proposals disable trigger user;

update public.cg_proposals as p
set cost = 0
where p.cost is distinct from 0;

alter table public.cg_proposals enable trigger user;


-- ---------------------------------------------------------
-- 6. and no bill ever carries a price again
--
-- A trigger rather than a rewrite of congress_submit and cg_npc_proposal:
-- every bill, whoever writes it, is stored with cost 0, so the screen and
-- the database agree and nothing can start charging again by accident.
-- ---------------------------------------------------------

create or replace function public.cg_bills_are_free()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
    new.cost := 0;
    return new;
end;
$function$;


drop trigger if exists cg_bills_are_free on public.cg_proposals;

create trigger cg_bills_are_free
before insert or update on public.cg_proposals
for each row
when (new.cost is distinct from 0)
execute function public.cg_bills_are_free();


-- ---------------------------------------------------------
-- 7. sanity output
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.tables
      where table_schema = 'public'
        and table_name in ('cg_debate_sides', 'cg_debate_state', 'cg_debate_standing')) as tables,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('cg_debate_tick', 'cg_debate_view', 'cg_resolve')) as functions,
    (select count(*) from public.cg_proposals as p where p.status in ('introduction', 'debate')) as live_bills,
    (select coalesce(sum(p.cost), 0) from public.cg_proposals as p) as credits_charged_by_bills;
