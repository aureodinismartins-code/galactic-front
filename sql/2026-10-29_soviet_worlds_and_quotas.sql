-- =========================================================
-- GALACTIC FRONT — the Supreme Soviet: worlds, fleet quota, absent commanders
--
-- Run in the Supabase SQL editor AFTER 2026-10-28_combine_soviet.sql.
-- Safe to run more than once. It can run with maintenance on or off.
--
-- Three things change:
--
--   1. THE FLEET QUOTA IS READABLE. Every approved "cota de nova
--      frota" directive allows one fleet, so the number of fleets the
--      Soviet permits is: the fleets the Combine has, plus the quotas
--      not yet spent. cs_overview() now returns it (fleets.max), the
--      screen shows "FROTAS 2 / 3", and cs_fleet_quota() gives the
--      same figures to the fleet menu on a planet, which is where a
--      player is told how many fleets the Soviet has allowed;
--
--   2. OCCUPIED WORLDS. cs_overview() now lists the worlds the
--      Combine holds (every planet where at least one city is
--      Combine), how much of each it holds, who else holds cities
--      there, what the world produces, and whether a campaign
--      against the rest of it is already authorised or before the
--      Soviet. The Congress keeps its own occupation stages; these
--      are the straight facts of the map;
--
--   3. NO DISMANTLING BEHIND AN ABSENT COMMANDER'S BACK. The Party
--      used to be able to bring a "reatribuir e desmontar" directive
--      naming any Combine fleet, including the fleet of somebody who
--      had logged off — they would come back to find it gone. The
--      Party may now only name a fleet whose commander is online
--      (player_presence, the same 70-second rule the rest of the
--      game uses). A player may only put their own fleet up for
--      dismantling.
-- =========================================================


-- ---------------------------------------------------------
-- 1. is this commander at the front? (the game's own 70 s rule)
-- ---------------------------------------------------------

create or replace function public.cs_player_online(p_player uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin

    /* a fleet with no commander is nobody's to protect */
    if p_player is null then return true; end if;

    /* older deployments without presence are treated as everybody present */
    if to_regclass('public.player_presence') is null then return true; end if;

    return exists (
        select 1 from public.player_presence as p
        where p.player_id = p_player
          and p.last_seen > now() - interval '70 seconds'
    );

end;
$function$;


-- ---------------------------------------------------------
-- 2. the fleet quota, for the fleet menu on a planet
-- ---------------------------------------------------------

create or replace function public.cs_fleet_quota()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_fleets integer;
    v_building integer;
    v_quotas integer;
    v_price integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    select count(*) filter (where coalesce(f.status::text, '') <> 'building'),
           count(*) filter (where coalesce(f.status::text, '') = 'building')
    into v_fleets, v_building
    from public.fleets as f
    where f.faction = coalesce(v_faction, 'Combine');

    select count(*) into v_quotas
    from public.cs_authorizations as a
    where a.kind = 'fleet' and not a.used
      and (a.player_id = me or a.player_id is null);

    select 500 * (1 + coalesce(ft.fleets_built, 0)) into v_price
    from public.faction_treasury as ft
    where ft.faction = v_faction;

    return jsonb_build_object(
        'combine', coalesce(v_faction, '') = 'Combine',
        'fleets', v_fleets,
        'building', v_building,
        'quotas', v_quotas,
        'max', v_fleets + v_building + v_quotas,
        'next_price', coalesce(v_price, 500),
        'can_build', coalesce(v_faction, '') <> 'Combine' or v_quotas > 0
    );

end;
$function$;


-- ---------------------------------------------------------
-- 3. the screen's overview: the worlds held, and the fleet cap
-- ---------------------------------------------------------

create or replace function public.cs_overview()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    v_majority integer;
    v_qualified integer;
    v_credits numeric;
    v_current integer;
    v_fleets integer;
    v_quotas integer;
    v_out jsonb;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into st from public.cs_state as s where s.id = 1;
    v_majority := public.cs_majority();
    v_qualified := public.cs_qualified();

    select coalesce(ft.credits, 0) into v_credits from public.faction_treasury as ft where ft.faction = 'Combine';
    select m.current_id into v_current from public.cs_membership as m where m.player_id = me;

    select count(*) into v_fleets from public.fleets as f where f.faction = 'Combine';
    select count(*) into v_quotas from public.cs_authorizations as a where a.kind = 'fleet' and not a.used;

    select jsonb_build_object(

        'now', now(),

        'credits', coalesce(v_credits, 0),
        'seats', (select count(*) from public.cs_commissars where active),
        'majority', v_majority,
        'supermajority', v_qualified,

        'currents', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', c.id,
                       'key', c.key,
                       'name', c.name,
                       'color', c.color,
                       'seats', (select count(*) from public.cs_commissars as x where x.active and x.current_id = c.id),
                       'loyalty', round(coalesce((select avg(x.loyalty) from public.cs_commissars as x where x.active and x.current_id = c.id), c.loyalty)),
                       'priorities', to_jsonb(c.priorities),
                       'description', c.description
                   ) order by c.id)
            from public.cs_currents as c
        ), '[]'::jsonb),

        'commissars', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', m.id,
                       'name', m.name,
                       'faction', m.current_id,
                       'region', m.oblast,
                       'area', null,
                       'seat', m.seat,
                       'loyalty', round(m.loyalty),
                       'planet', null,
                       'suspect', m.is_disgraced
                   ) order by m.seat)
            from public.cs_commissars as m where m.active
        ), '[]'::jsonb),

        'directives', coalesce((
            select jsonb_agg(x.obj order by x.id desc)
            from (
                select d.id, jsonb_build_object(
                    'id', d.id,
                    'title', d.title,
                    'type', d.dtype,
                    'sponsor', d.sponsor_current,
                    'status', d.status,
                    'debate_at', d.debate_at,
                    'vote_at', d.vote_at,
                    'mine', (d.proposer_player is not null and d.proposer_player = me),
                    'by_secretary', (st.secretary_player is not null and d.proposer_player = st.secretary_player),
                    'proposer', d.proposer_name,
                    'yes', d.yes_votes,
                    'no', d.no_votes,
                    'abstain', d.abstain_votes,
                    'required', d.required_votes,
                    'planet', d.planet,
                    'fleet', d.fleet_id,
                    'target', d.target_faction,
                    'result', d.result,
                    'privileges', coalesce((
                        select jsonb_agg(jsonb_build_object('member', p.commissar_id, 'amount', p.amount, 'stance', p.stance))
                        from public.cs_privileges as p
                        where p.directive_id = d.id and p.player_id = me
                    ), '[]'::jsonb),
                    'forecast', coalesce((
                        select jsonb_agg(jsonb_build_object(
                                   'faction', c.id,
                                   'p', least(100, public.cs_likelihood(c.id, 55, d.sponsor_current, d.dtype, st.confidence)
                                              + public.cs_boost(d.dtype, d.sponsor_current, st.secretary_current))))
                        from public.cs_currents as c
                    ), '[]'::jsonb)
                ) as obj
                from public.cs_directives as d
                where d.status in ('introduction', 'debate', 'passed', 'rejected')
                order by d.id desc
                limit 24
            ) as x
        ), '[]'::jsonb),

        'targets', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'planet', t.name,
                       'owners', t.owner,
                       'declared', exists (select 1 from public.cs_authorizations as a
                                           where a.kind = 'war' and a.planet = t.name))
                   order by t.name)
            from (
                select p.name,
                       case
                           when not exists (select 1 from public.cities as c where c.planet_id = p.id) then 'Unclaimed'
                           when not exists (select 1 from public.cities as c
                                            where c.planet_id = p.id and c.faction is distinct from 'Combine') then 'Combine'
                           when not exists (select 1 from public.cities as c
                                            where c.planet_id = p.id and c.faction is distinct from 'Freedom Authority') then 'Freedom Authority'
                           else 'Contested'
                       end as owner
                from public.planets as p
            ) as t
        ), '[]'::jsonb),

        /* the worlds the Combine holds at least one city of */
        'worlds', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'planet', w.name,
                       'held', w.held,
                       'total', w.total,
                       'others', w.others,
                       'income', w.income,
                       'whole', w.whole,
                       'declared', exists (select 1 from public.cs_authorizations as a
                                           where a.kind = 'war' and a.planet = w.name and not a.used),
                       'live', exists (select 1 from public.cs_directives as d
                                       where d.dtype = 'military_campaign' and d.planet = w.name
                                         and d.status in ('introduction', 'debate'))
                   ) order by w.whole desc, w.name)
            from (
                select p.name,
                       count(*) filter (where c.faction = 'Combine')::integer as held,
                       count(*)::integer as total,
                       coalesce(string_agg(distinct c.faction, ', ' order by c.faction)
                                filter (where c.faction is distinct from 'Combine'), '') as others,
                       coalesce(p.income, 0) as income,
                       not exists (select 1 from public.cities as c2
                                   where c2.planet_id = p.id and c2.faction is distinct from 'Combine') as whole
                from public.planets as p
                join public.cities as c on c.planet_id = p.id
                group by p.id, p.name, p.income
                having count(*) filter (where c.faction = 'Combine') > 0
            ) as w
        ), '[]'::jsonb),

        'my_fleets', coalesce((
            select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name) order by f.name)
            from public.fleets as f
            where f.faction = 'Combine'
              and f.player_id = me
              and coalesce(f.status::text, '') <> 'engaged'
        ), '[]'::jsonb),

        'authorizations', jsonb_build_object(
            'fleet', v_quotas,
            'knightmare', (select count(*) from public.cs_authorizations where kind = 'knightmare' and not used),
            'war', coalesce((select jsonb_agg(a.planet order by a.planet) from public.cs_authorizations as a
                             where a.kind = 'war' and not a.used), '[]'::jsonb)
        ),

        /* the fleets in service and the ceiling the Soviet has granted */
        'fleets', jsonb_build_object(
            'total', v_fleets,
            'mine', (select count(*) from public.fleets as f where f.faction = 'Combine' and f.player_id = me),
            'building', (select count(*) from public.fleets as f
                         where f.faction = 'Combine' and coalesce(f.status::text, '') = 'building'),
            'quotas', v_quotas,
            'max', v_fleets + v_quotas,
            'next_price', (select 500 * (1 + coalesce(ft.fleets_built, 0)) from public.faction_treasury as ft
                           where ft.faction = 'Combine')
        ),

        'state', jsonb_build_object(
            'popularity', st.confidence,
            'tax_level', st.quota,
            'relations', st.relations,
            'credits', coalesce(v_credits, 0)
        ),

        'president', case when st.secretary_player is null then null else jsonb_build_object(
            'name', st.secretary_name,
            'faction', st.secretary_current,
            'term_no', st.term_no,
            'term_end', st.term_end,
            'veto_used', st.veto_used,
            'me', st.secretary_player = me
        ) end,

        'election', (
            select jsonb_build_object(
                'phase', e.phase,
                'campaign_end', e.campaign_end,
                'vote_end', e.vote_end,
                'candidates', coalesce((
                    select jsonb_agg(jsonb_build_object(
                               'player_id', c.player_id,
                               'name', c.name,
                               'faction', c.current_id,
                               'mine', c.player_id = me) order by c.name)
                    from public.cs_candidates as c where c.election_id = e.id
                ), '[]'::jsonb),
                'voted', (select count(*) from public.cs_election_votes as v where v.election_id = e.id),
                'voters', (select count(*) from public.cs_membership),
                'my_vote', (select v.candidate_id from public.cs_election_votes as v where v.election_id = e.id and v.player_id = me)
            )
            from public.cs_election as e
            where e.phase <> 'done'
            order by e.id desc limit 1
        ),

        'parties', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'faction', c.id,
                       'players', coalesce((
                           select jsonb_agg(coalesce(m.name, 'Comrade') order by m.name)
                           from public.cs_membership as m where m.current_id = c.id), '[]'::jsonb)) order by c.id)
            from public.cs_currents as c
        ), '[]'::jsonb),

        'my_party', v_current,

        'party_members', coalesce((
            select jsonb_agg(jsonb_build_object('faction', m.current_id, 'name', coalesce(m.name, 'Comrade')) order by m.name)
            from public.cs_membership as m
        ), '[]'::jsonb),

        'last_election', (
            select jsonb_build_object('winner', e.winner_name, 'result', jsonb_build_object('note', e.note))
            from public.cs_election as e where e.phase = 'done' order by e.id desc limit 1
        ),

        'log', coalesce((
            select jsonb_agg(jsonb_build_object('at', l.at, 'text', l.text) order by l.id desc)
            from (select * from public.cs_log order by id desc limit 60) as l
        ), '[]'::jsonb)

    ) into v_out;

    return v_out;

end;
$function$;


-- ---------------------------------------------------------
-- 4. directives the Party brings on its own
--    (a dismantling only ever names a fleet whose commander is here)
-- ---------------------------------------------------------

create or replace function public.cs_npc_directive()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    st record;
    v_live integer;
    v_kind integer;
    v_try integer;
    v_planet text;
    v_target text;
    v_fleet_id text;
    v_fleet_name text;
    v_current integer;
    v_type text;
    v_title text;
    v_name text;
    v_fleets integer;
    v_ok boolean;
begin

    select * into st from public.cs_state as s where s.id = 1;

    if st.last_npc_at is not null and now() - st.last_npc_at < interval '240 seconds' then return; end if;

    update public.cs_state as s set last_npc_at = now() where s.id = 1;

    select count(*) into v_live from public.cs_directives as d where d.status in ('introduction', 'debate');
    if v_live >= 4 then return; end if;

    for v_try in 1..8 loop

        v_kind := 1 + floor(random() * 5)::integer;
        v_ok := false;
        v_fleet_id := null;
        v_fleet_name := null;
        v_planet := null; v_target := null; v_current := 1; v_name := null;

        if v_kind = 1 then

            select p.name into v_planet
            from public.planets as p
            where exists (select 1 from public.cities as c where c.planet_id = p.id and c.faction is distinct from 'Combine')
              and not exists (select 1 from public.cs_authorizations as a where a.kind = 'war' and a.planet = p.name and not a.used)
            order by random() limit 1;

            if v_planet is not null then
                v_ok := true; v_type := 'military_campaign'; v_current := 3;
                v_title := 'Campanha militar contra ' || v_planet;
            end if;

        elsif v_kind = 2 then

            if st.quota < 2 and not exists (select 1 from public.cs_directives as d
                                            where d.dtype = 'production_quota' and d.status in ('introduction', 'debate')) then
                v_ok := true; v_type := 'production_quota'; v_current := 1;
                v_title := 'Plano de produção: elevar a cota';
            end if;

        elsif v_kind = 3 then

            v_target := (array['Freedom Authority', 'Independents'])[1 + floor(random() * 2)::integer];
            if not exists (select 1 from public.cs_directives as d
                           where d.dtype = 'diplomacy' and d.target_faction = v_target and d.status in ('introduction', 'debate')) then
                v_ok := true; v_type := 'diplomacy'; v_current := 1;
                v_title := 'Pacto fraterno com os ' || v_target;
            end if;

        elsif v_kind = 4 then

            if not exists (select 1 from public.cs_directives as d
                           where d.dtype = 'fleet_construction' and d.status in ('introduction', 'debate')) then
                v_ok := true; v_type := 'fleet_construction'; v_current := 2;
                v_title := 'Cota de nova frota';
            end if;

        else

            select count(*) into v_fleets from public.fleets as f
            where f.faction = 'Combine' and coalesce(f.status::text, '') not in ('building', 'engaged');

            if v_fleets >= 4 then
                select f.id::text, f.name into v_fleet_id, v_fleet_name from public.fleets as f
                where f.faction = 'Combine' and coalesce(f.status::text, '') not in ('building', 'engaged')
                  /* never behind the back of a commander who is away */
                  and public.cs_player_online(f.player_id)
                  and not exists (select 1 from public.cs_directives as d
                                  where d.dtype = 'fleet_revocation' and d.fleet_id = f.id::text and d.status in ('introduction', 'debate'))
                order by random() limit 1;

                if v_fleet_id is not null then
                    v_ok := true; v_type := 'fleet_revocation'; v_current := 2;
                    v_title := 'Reatribuir e desmontar a frota "' || coalesce(v_fleet_name, 'sem nome') || '"';
                end if;
            end if;

        end if;

        if v_ok then
            /* the current that brought it signs it, in its own name */
            select c.name into v_name from public.cs_currents as c where c.id = v_current;
            v_name := coalesce(v_name, 'O Partido');
            insert into public.cs_directives (dtype, title, sponsor_current, source, proposer_name, proposer_player, planet, fleet_id, target_faction)
            values (v_type, v_title, v_current, 'npc', v_name, null, v_planet, v_fleet_id, v_target);
            perform public.cs_log('DIRETIVA: ' || v_name || ' leva "' || v_title || '" ao Soviete.');
            return;
        end if;

    end loop;

end;
$function$;


-- ---------------------------------------------------------
-- 5. putting a directive before the Soviet
--    (a commander may only offer up their own fleet)
-- ---------------------------------------------------------

create or replace function public.cs_submit(p_type text, p_planet text default null, p_fleet text default null, p_target text default null, p_current text default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    v_current integer;
    v_live integer;
    v_limit integer;
    v_title text;
    v_sponsor integer;
    v_player_faction text;
    v_name text;
    v_fleet_name text;
    v_id integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;
    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        raise exception 'The game has not started';
    end if;

    select p.faction into v_player_faction from public.players as p where p.id = me;
    if coalesce(v_player_faction, '') <> 'Combine' then
        raise exception 'Only Combine players sit in the Supreme Soviet';
    end if;

    if p_type not in ('military_campaign', 'fleet_construction', 'knightmare_construction',
                      'production_quota', 'diplomacy', 'fleet_revocation') then
        raise exception 'Unknown directive';
    end if;

    select * into st from public.cs_state as s where s.id = 1;

    v_limit := case when st.secretary_player = me then 5 else 3 end;

    select count(*) into v_live from public.cs_directives as d
    where d.status in ('introduction', 'debate') and d.proposer_player = me;
    if v_live >= v_limit then
        raise exception 'You already have % directives before the Soviet', v_live;
    end if;

    /* the sponsoring current: the one that speaks for the player, or the one asked for */
    if p_current is not null then
        select c.id into v_sponsor from public.cs_currents as c where c.key = p_current;
    end if;
    if v_sponsor is null then
        select m.current_id into v_sponsor from public.cs_membership as m where m.player_id = me;
    end if;
    if v_sponsor is null then
        select c.id into v_sponsor from public.cs_currents as c
        where p_type = any (c.priorities) order by c.id limit 1;
    end if;
    v_sponsor := coalesce(v_sponsor, 1);

    v_name := coalesce(public.cs_player_name(me), 'Comrade');

    /* a campaign needs a planet that is not ours, and no campaign for the same planet already open */
    if p_type = 'military_campaign' then
        if coalesce(p_planet, '') = '' then raise exception 'Choose a planet for the campaign'; end if;
        if exists (select 1 from public.cs_directives as d
                   where d.dtype = 'military_campaign' and d.planet = p_planet and d.status in ('introduction', 'debate')) then
            raise exception 'A campaign against % is already before the Soviet', p_planet;
        end if;
        if exists (select 1 from public.cs_authorizations as a
                   where a.kind = 'war' and a.planet = p_planet and not a.used) then
            raise exception 'The Soviet has already authorised a campaign against %', p_planet;
        end if;
    end if;

    if p_type = 'fleet_revocation' then
        select f.name into v_fleet_name from public.fleets as f
        where f.id::text = p_fleet and f.faction = 'Combine' and f.player_id = me
          and coalesce(f.status::text, '') <> 'engaged';
        if v_fleet_name is null then
            raise exception 'That is not one of your fleets, or it is in battle';
        end if;
    end if;

    if p_type = 'production_quota' then
        if st.quota >= 2 then raise exception 'The production quota is already at its highest level'; end if;
        if exists (select 1 from public.cs_directives as d
                   where d.dtype = 'production_quota' and d.status in ('introduction', 'debate')) then
            raise exception 'A production quota is already before the Soviet';
        end if;
    end if;

    v_title := case p_type
        when 'military_campaign' then 'Campanha militar contra ' || coalesce(p_planet, '?')
        when 'fleet_construction' then 'Cota de nova frota'
        when 'knightmare_construction' then 'Destacamento blindado'
        when 'production_quota' then 'Plano de produção: elevar a cota'
        when 'diplomacy' then 'Pacto fraterno com os ' || coalesce(nullif(p_target, ''), 'Independents')
        when 'fleet_revocation' then 'Reatribuir e desmontar a frota "' || coalesce(v_fleet_name, '?') || '"'
        else initcap(replace(p_type, '_', ' ')) end;

    insert into public.cs_directives (dtype, title, sponsor_current, source, proposer_name, proposer_player,
                                      planet, fleet_id, target_faction)
    values (p_type, v_title, v_sponsor, 'player', v_name, me,
            nullif(p_planet, ''), nullif(p_fleet, ''), nullif(p_target, ''))
    returning id into v_id;

    perform public.cs_log('DIRETIVA: ' || v_name || ' leva "' || v_title || '" ao Soviete.');

    return v_id;

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from public.cs_authorizations where kind = 'fleet' and not used) as quotas_waiting,
    (select count(*) from public.fleets where faction = 'Combine') as combine_fleets,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('cs_player_online', 'cs_fleet_quota', 'cs_overview', 'cs_npc_directive', 'cs_submit')) as functions,
    (select exists (select 1 from information_schema.routines
                     where routine_schema = 'public' and routine_name = 'cs_overview')) as overview_ready;
