-- =========================================================
-- GALACTIC FRONT — the Soviet votes on relief now
--
-- Run in the Supabase SQL editor after 2026-11-49. Safe to run more than once.
--
-- WHAT WAS UNFAIR
--   The Authority had to put every load of relief before Congress as a bill
--   (resource_allocation, 400 credits, voted on), while the Combine sent the
--   same +10 stability straight to a world with a button, once every five
--   minutes, and the Party itself did the same when a world stalled. A
--   Combine world in trouble could be steadied in a second; an Authority
--   world had to wait for a majority.
--
-- WHAT THIS FILE DOES
--   Relief becomes a directive for the Combine too:
--
--     1. cs_submit accepts 'consolidation' — "Ajuda económica a <mundo>" —
--        so a commander may put relief before the Supreme Soviet. It needs
--        a world under Combine administration that is not yet
--        incorporated, and only one relief per world at a time.
--
--     2. The directive goes through the plenum exactly like the rest:
--        introduction, debate, then a vote, and cs_execute's consolidation
--        branch (already there) is what actually adds the +10.
--
--     3. The Party's own direct relief is gone: cs_npc_directive now files
--        the same directive for a stalled world instead of sending the
--        relief behind the Soviet's back, so it waits on the vote as well.
--
--     4. cs_relief is kept only to refuse: a page still open from before
--        this patch gets a sentence instead of a silent +10.
-- =========================================================


-- ---------------------------------------------------------
-- 1. a commander may bring relief to the Soviet
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
                      'production_quota', 'diplomacy', 'fleet_revocation', 'consolidation') then
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

    /* relief: a world under administration, one load at a time */
    if p_type = 'consolidation' then

        if coalesce(p_planet, '') = '' then
            raise exception 'Choose the world that needs relief';
        end if;

        if not exists (select 1 from public.cs_occupations as o
                       where o.planet = p_planet and coalesce(o.stage, 0) < 3) then
            raise exception '% is not under Combine administration, or it is already incorporated into the Union', p_planet;
        end if;

        if exists (select 1 from public.cs_directives as d
                   where d.dtype = 'consolidation' and d.planet = p_planet
                     and d.status in ('introduction', 'debate')) then
            raise exception 'Relief for % is already before the Soviet', p_planet;
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
        when 'diplomacy' then 'Pacto fraterno com os ' || coalesce(nullif(p_target, ''), 'Freedom Authority')
        when 'fleet_revocation' then 'Reatribuir e desmontar a frota "' || coalesce(v_fleet_name, '?') || '"'
        when 'consolidation' then 'Ajuda económica a ' || coalesce(p_planet, '?')
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
-- 2. the Party files relief like everybody else
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

        v_kind := 1 + floor(random() * 6)::integer;
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

            v_target := 'Freedom Authority';
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

        elsif v_kind = 5 then

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

        else

            /*
               A world whose administration has stalled: relief is a directive
               now, so the Party files it like a delegate would and waits for
               the vote — it no longer steadies the world on its own.
            */
            select o.planet into v_planet
            from public.cs_occupations as o
            where coalesce(o.stage, 0) < 3
              and o.stability < public.cs_occupation_threshold(o.stage)
              and not exists (select 1 from public.cs_directives as d
                              where d.dtype = 'consolidation' and d.planet = o.planet
                                and d.status in ('introduction', 'debate'))
            order by o.stage desc, random()
            limit 1;

            if v_planet is not null then
                v_ok := true; v_type := 'consolidation'; v_current := 1;
                v_title := 'Ajuda económica a ' || v_planet;
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
-- 3. the button that sent it straight is closed
-- ---------------------------------------------------------

create or replace function public.cs_relief(p_planet text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin

    /*
       Kept only so a page left open from before this patch says something
       useful instead of quietly steadying a world without a vote.
    */
    raise exception 'Relief is a directive now: put "Ajuda económica a %" before the Supreme Soviet and let it be voted', coalesce(p_planet, 'the world');

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from public.cs_directives as d
      where d.dtype = 'consolidation' and d.status in ('introduction', 'debate')) as relief_waiting_on_a_vote,
    (select count(*) from public.cs_occupations as o where coalesce(o.stage, 0) < 3) as worlds_under_administration,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('cs_submit', 'cs_npc_directive', 'cs_relief')) as functions;
