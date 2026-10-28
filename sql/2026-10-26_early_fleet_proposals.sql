-- =========================================================
-- GALACTIC FRONT — an early fleet for the Freedom Authority
--
-- Run in the Supabase SQL editor after the two previous files.
-- Safe to run more than once.
--
-- Problem: at the start of a game the Authority has no fleet at all,
-- but the Congress never offered one, and when it did the proposal
-- cost 2000 credits against a treasury of 500 — so it always ended in
-- "failed_funds". The authorisation was also assigned to the
-- President, who does not exist until the first election finishes.
--
-- What this file does:
--   1. While the Authority still has no fleet (and the game is young),
--      the NPC proposals push "Authorize New Fleet Construction" much
--      harder — six of twelve weighted slots instead of one.
--   2. In that same opening the proposal does not need a President yet
--      (the Old Guard sponsors it) and it costs 500 credits, which the
--      starting treasury can actually pay.
--   3. create_fleet() accepts an authorisation that has no player
--      attached yet and claims it for whoever builds first. That is
--      what makes an early (President-less) authorisation usable.
--
-- Nothing else about Congress changes: after the first fleet exists,
-- the normal cost, the President rule and the usual odds come back.
-- =========================================================


-- ---------------------------------------------------------
-- 1. NPC proposals: push the fleet at the opening of the game
-- ---------------------------------------------------------

create or replace function public.cg_npc_proposal()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    st record;
    v_start boolean := false;
    v_active integer;
    v_kinds integer[] := array[2, 3, 4, 5, 6, 7];
    v_kind integer;
    v_try integer;
    v_planet text;
    v_target text;
    v_fleet record;
    v_fleets integer;
    v_sponsor integer;
    v_title text;
    v_type text;
    v_name text;
    v_cost integer := 0;
    v_ok boolean;
begin
    select * into st from public.cg_state as s where s.id = 1;

    if now() - st.last_npc_at < interval '240 seconds' then return; end if;

    update public.cg_state as s set last_npc_at = now() where s.id = 1;

    select count(*) into v_active from public.cg_proposals as x where x.status in ('introduction', 'debate');
    if v_active >= 4 then return; end if;

    /* opening of the game: the Authority owns no fleet yet */
    select (not exists (select 1 from public.fleets as f where f.faction = 'Freedom Authority')
            and now() - coalesce(g.started_at, now()) < interval '3 hours')
    into v_start
    from public.game_control as g
    where g.id = 1;

    v_start := coalesce(v_start, false);

    /* the ruling party's priorities come up more often */
    if st.president_faction = 1 then v_kinds := v_kinds || array[6, 7, 5];
    elsif st.president_faction = 2 then v_kinds := v_kinds || array[2, 2, 3];
    elsif st.president_faction = 3 then v_kinds := v_kinds || array[3, 4, 4];
    end if;

    /* no fleet yet: a new fleet is the most likely thing Congress debates */
    if v_start then
        v_kinds := v_kinds || array[6, 6, 6, 6, 7, 6];
    end if;

    for v_try in 1..10 loop

        v_kind := v_kinds[1 + floor(random() * array_length(v_kinds, 1))::integer];
        v_ok := false;
        v_planet := null; v_target := null; v_cost := 0;

        if v_kind = 2 then

            v_target := (array['Combine', 'Independents'])[1 + floor(random() * 2)::integer];
            v_ok := true; v_sponsor := 2; v_type := 'diplomacy'; v_title := 'Diplomatic Mission to the ' || v_target; v_name := 'The Greens';

        elsif v_kind = 3 then

            select o.planet into v_planet from public.cg_occupations as o order by random() limit 1;

            if v_planet is not null then
                v_ok := true; v_sponsor := 2; v_type := 'resource_allocation'; v_title := 'Emergency Economic Relief for ' || v_planet; v_name := 'The Greens';
            end if;

        elsif v_kind = 4 then

            if st.tax_level < 2 and not exists (select 1 from public.cg_proposals as x where x.ptype = 'taxation' and x.status in ('introduction', 'debate')) then
                v_ok := true; v_sponsor := 3; v_type := 'taxation'; v_title := 'Taxation Increase Proposal'; v_name := 'Progressives';
            end if;

        elsif v_kind = 5 then

            select count(*) into v_fleets from public.fleets as f where f.faction = 'Freedom Authority' and f.status::text <> 'building';

            if v_fleets >= 3 then
                select f.* into v_fleet from public.fleets as f
                where f.faction = 'Freedom Authority' and f.status::text not in ('building', 'engaged')
                  and not exists (select 1 from public.cg_proposals as x where x.ptype = 'fleet_revocation' and x.fleet_id = f.id and x.status in ('introduction', 'debate'))
                order by random() limit 1;

                if v_fleet.id is not null then
                    insert into public.cg_proposals (ptype, title, proposer_name, source, sponsor_faction_id, cost, fleet_id, debate_at, vote_at)
                    values ('fleet_revocation', 'Military Asset Recall: fleet ""' || coalesce(v_fleet.name, 'unnamed') || '""', 'The Greens', 'npc', 2, 0, v_fleet.id,
                            now() + interval '3 minutes', now() + interval '8 minutes');
                    perform public.cg_log('PROPOSAL: The Greens propose to decommission the fleet ""' || coalesce(v_fleet.name, 'unnamed') || '"".');
                    return;
                end if;
            end if;

        elsif v_kind in (6, 7) then

            /*
               State initiatives: the new fleet / squad goes to the President.
               At the opening of the game there is no President yet and no
               fleet at all, so fleet construction is allowed without one and
               at a price the starting treasury can pay.
            */
            if (st.president_player is not null or (v_kind = 6 and v_start))
               and not exists (
                select 1 from public.cg_proposals as x
                where x.ptype = case v_kind when 6 then 'fleet_construction' else 'knightmare_construction' end and x.status in ('introduction', 'debate')) then
                v_ok := true;
                v_sponsor := coalesce(st.president_faction, 1);
                v_type := case v_kind when 6 then 'fleet_construction' else 'knightmare_construction' end;
                v_title := case v_kind when 6 then 'Authorize New Fleet Construction (state initiative)' else 'Authorize Knightmare Squad Formation (state initiative)' end;
                v_cost := case v_kind
                    when 6 then (case when v_start then 500 else 2000 end)
                    else 1500 end;
                select f.name into v_name from public.cg_factions as f where f.id = v_sponsor;
            end if;

        end if;

        if v_ok then

            insert into public.cg_proposals (ptype, title, proposer_name, source, sponsor_faction_id, cost, planet, target_faction, debate_at, vote_at)
            values (v_type, v_title, v_name, 'npc', v_sponsor, v_cost,
                    case when v_type = 'resource_allocation' then v_planet else null end,
                    v_target, now() + interval '3 minutes', now() + interval '8 minutes');

            perform public.cg_log('PROPOSAL: ' || v_name || ' propose ""' || v_title || '"".');
            return;

        end if;

    end loop;
end;
$function$;


-- ---------------------------------------------------------
-- 2. create_fleet: claim an authorisation that has no owner yet
-- ---------------------------------------------------------

create or replace function public.create_fleet(fleet_name text, fleet_faction text, fleet_origin text, fleet_squads jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
    current_player uuid;
    v_faction text;
    v_credits bigint;
    v_built integer;
    v_price integer;
    new_fleet_id uuid;
    v_auth integer;
begin

    current_player := auth.uid();

    if current_player is null then
        raise exception 'Not authenticated';
    end if;

    select p.faction into v_faction
    from public.players as p where p.id = current_player;

    if v_faction is null then
        raise exception 'Player account not found';
    end if;

    perform public.collect_faction_income();

    select ft.credits, ft.fleets_built
    into v_credits, v_built
    from public.faction_treasury as ft
    where ft.faction = v_faction
    for update;

    if v_credits is null then
        raise exception 'Faction treasury not found';
    end if;

    v_price := 500 * (1 + v_built);

    -- Freedom Authority: Congress must have authorised the fleet (and was paid for it)
    if v_faction = 'Freedom Authority' then

        /* an authorisation issued before anybody was President has no owner:
           the first commander to build claims it */
        select a.id into v_auth from public.cg_authorizations as a
        where a.kind = 'fleet'
          and (a.player_id = current_player or a.player_id is null)
          and not a.used
        order by a.id limit 1 for update;

        if v_auth is null then
            raise exception 'Congress has not authorized a new fleet: put ""Authorize New Fleet Construction"" before Congress first';
        end if;

        update public.cg_authorizations as a
        set used = true, used_at = now(), player_id = coalesce(a.player_id, current_player)
        where a.id = v_auth;

        v_price := 0;
    end if;

    if v_credits < v_price then
        raise exception 'Not enough credits: the next fleet costs % credits', v_price;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price,
        fleets_built = ft.fleets_built + 1
    where ft.faction = v_faction;

    insert into public.fleets (
        player_id, name, faction, origin, destination,
        status, departure_time, arrival_time, squads
    )
    values (
        current_player, fleet_name, fleet_faction, fleet_origin, null,
        'building', null, now() + interval '1 minute', fleet_squads
    )
    returning id into new_fleet_id;

    return new_fleet_id;

end;
$function$;


-- ---------------------------------------------------------
-- 3. sanity output
-- ---------------------------------------------------------

select
    (select count(*) from public.fleets as f where f.faction = 'Freedom Authority') as authority_fleets,
    (select count(*) from public.cg_authorizations as a where a.kind = 'fleet' and not a.used) as open_fleet_authorizations,
    (select count(*) from information_schema.routines
      where routine_schema = 'public' and routine_name in ('cg_npc_proposal', 'create_fleet')) as functions_present;
