-- =========================================================
-- GALACTIC FRONT — leaders, parties, activity and diplomacy
--
-- Run this in the Supabase SQL editor (SQL > New query).
-- Safe to run more than once, and after every other patch.
--
-- What it changes:
--
--   1. PRESENCE IS A TOUCH, NOT AN OPEN TAB. A player counts as
--      online only while they have touched the game in the last
--      ten minutes, so a window left open and forgotten no longer
--      holds the game's full rhythm up. A commander who has not
--      touched the game for ten minutes is treated as away by the
--      fleet-dismantling rule as well.
--
--   2. THE ECONOMY FOLLOWS THE TOUCH. Full value for the first ten
--      minutes after the last touch (paid every five minutes, as
--      before), half value after that (every ten minutes, as
--      before), and NOTHING AT ALL once two hours have gone by
--      with nobody touching the game: the coffers close for every
--      side until somebody plays again, and the shut hours are
--      never paid back.
--
--   3. THE HIGH COMMISSAR. The Soviet's elected head is the High
--      Commissar (it was the General Secretary): same election
--      among the currents, same candidacy, same one veto per term.
--      Only the wording changes.
--
--   4. THE INDEPENDENTS ARE NOT A FACTION ANY MORE. Nobody joins
--      them, no bill and no directive treats them as one bloc, and
--      the leftover line in the relations of both sides is removed.
--      Every independent world is dealt with on its own (section 5).
--
--   5. DIPLOMACY WITH INDEPENDENT WORLDS. Any player of either main
--      faction may send envoys to one independent world: 500
--      credits from the faction's treasury, one send per world
--      every five minutes, relations +10. A world taken all the way
--      to 100 signs the pact and joins your faction without a shot.
--      Relations between the two main factions are read by BOTH
--      sides, and a mutual 50 or better is a trading truce: every
--      income payment of both treasuries is 10% bigger.
--
--   6. THE RESET BUTTON CLEARS ALL OF IT. game_reset_extras() wipes
--      the Soviet's books, the party rolls, the embassies and the
--      presence list; the reset button in gamecontrol.js calls it
--      right after the game's own reset.
-- =========================================================


-- ---------------------------------------------------------
-- 1. presence: a player is here if they touched the game
-- ---------------------------------------------------------

alter table public.player_presence
    add column if not exists last_active timestamptz;


/* the last time anybody actually touched the game */
create or replace function public.last_touch()
returns timestamptz
language sql
stable
security definer
set search_path to ''
as $function$
    select max(coalesce(p.last_active, p.last_seen)) from public.player_presence as p;
$function$;


/* ten minutes without a touch and the player is away, whatever the tab
   keeps doing on its own every twenty seconds */
create or replace function public.players_online()
returns integer
language sql
stable
security definer
set search_path to ''
as $function$
    select count(*)::integer
    from public.player_presence as p
    where coalesce(p.last_active, p.last_seen) > now() - interval '10 minutes';
$function$;


/* the same reading for one player: used by the rule that keeps the Party
   from dismantling the fleet of a commander who is not there */
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
          and coalesce(p.last_active, p.last_seen) > now() - interval '10 minutes'
    );

end;
$function$;


/*
   The heartbeat now carries whether the player has touched the game
   recently. last_seen keeps ticking with the page; last_active only moves
   on a real touch, and that is what the economy reads.
*/
create or replace function public.game_heartbeat(p_active boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    g record;
    v_gap interval;
    v_shift interval := interval '0';
    v_online integer;
    v_touch timestamptz;
begin
    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    perform set_config('game.bypass', '1', true);

    insert into public.player_presence (player_id, last_seen, last_active)
    values (auth.uid(), now(), case when p_active then now() else null end)
    on conflict (player_id) do update
        set last_seen = now(),
            last_active = case when p_active then now()
                               else public.player_presence.last_active end;

    select * into g from public.game_control as x where x.id = 1 for update;

    if g.host_player is null then
        update public.game_control as x
        set host_player = (select u.id from auth.users as u order by u.created_at limit 1)
        where x.id = 1;
        select * into g from public.game_control as x where x.id = 1;
    end if;

    v_gap := now() - g.last_activity;

    /*
       Nobody has been here for a while. Two things happen:
         - the absence is remembered, so the economy can settle that window at
           half value with 10-minute ticks instead of freezing completely;
         - the world itself is paused as before (fleets, recruiting, war,
           Congress), except the income clock, which must keep running so the
           window can be paid.
    */
    if g.started and not g.maintenance and v_gap > interval '150 seconds' then

        if g.offline_since is null then
            update public.game_control as x
            set offline_since = g.last_activity
            where x.id = 1;
        end if;

        v_shift := v_gap - interval '45 seconds';

        if v_shift > interval '0' then

            perform public.game_shift_time(v_shift);

            /* the shift moved every clock forward: the economy keeps its own */
            update public.faction_treasury as ft
            set last_income_at = ft.last_income_at - v_shift
            where ft.last_income_at is not null;

            update public.game_control as x
            set total_paused = x.total_paused + v_shift
            where x.id = 1;

        end if;

        select * into g from public.game_control as x where x.id = 1;

    end if;

    /*
       Maintenance and the not-started phase are dead time: nothing accrues.
       The closure is given back by game_set_maintenance() / game_start().
    */
    select count(*) into v_online
    from public.player_presence as p
    where coalesce(p.last_active, p.last_seen) > now() - interval '10 minutes';

    if g.started and not g.maintenance then

        perform public.collect_faction_income();

        -- somebody is back: the offline window has been settled above
        if v_online > 0 and g.offline_since is not null then
            update public.game_control as x set offline_since = null where x.id = 1;
        end if;

    elsif g.offline_since is not null then

        /* maintenance / not started: that window is given back by game_shift_time,
           so it must not also be settled as offline income */
        update public.game_control as x set offline_since = null where x.id = 1;

    end if;

    update public.game_control as x
    set last_activity = now()
    where x.id = 1;

    /* the screen shows which rhythm the economy is on, and why */
    v_touch := public.last_touch();

    return jsonb_build_object(
        'started', g.started,
        'maintenance', g.maintenance,
        'maintenance_message', g.maintenance_message,
        'is_host', g.host_player = auth.uid(),
        'resumed_after', 0,
        'online', v_online,
        'offline_since', g.offline_since,
        'active', p_active,
        'idle_seconds', case when v_touch is null then 0
                             else greatest(0, floor(extract(epoch from (now() - v_touch)))::integer) end,
        'income', public.income_mode()
    );
end;
$function$;


/* ---------------------------------------------------------
   what the economy is doing right now, in one word
      'full'    - somebody touched the game in the last ten minutes
      'reduced' - nobody has, for less than two hours: half value
      'closed'  - nobody has, for two hours or more: nothing at all
--------------------------------------------------------- */

create or replace function public.income_mode()
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_touch timestamptz;
begin

    v_touch := public.last_touch();

    if v_touch is null then return 'full'; end if;
    if now() > v_touch + interval '2 hours' then return 'closed'; end if;
    if now() > v_touch + interval '10 minutes' then return 'reduced'; end if;

    return 'full';

end;
$function$;


-- ---------------------------------------------------------
-- 2. income: full for ten minutes after a touch, half after
--    that, and shut two hours after the last touch
-- ---------------------------------------------------------

/*
   What the two main factions think of each other is written by each
   side's own diplomacy (cg_state.relations on the Freedom Authority's
   books, cs_state.relations on the Combine's). Both readings are read
   together here, because the truce is a mutual thing.
*/
create or replace function public.relations_reading()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v_a numeric := 0;   /* the Freedom Authority's view of the Combine */
    v_c numeric := 0;   /* the Combine's view of the Freedom Authority */
begin

    begin
        select coalesce((s.relations ->> 'Combine')::numeric, 0) into v_a
        from public.cg_state as s
        where s.id = 1;
    exception when undefined_column or undefined_table then v_a := 0;
    end;

    begin
        select coalesce((s.relations ->> 'Freedom Authority')::numeric, 0) into v_c
        from public.cs_state as s
        where s.id = 1;
    exception when undefined_column or undefined_table then v_c := 0;
    end;

    v_a := coalesce(v_a, 0);
    v_c := coalesce(v_c, 0);

    return jsonb_build_object(
        'authority', v_a,
        'combine', v_c,
        'need', 50,
        'dividend', 10,
        'truce', (v_a >= 50 and v_c >= 50)
    );

end;
$function$;


/* the trading truce: both sides hold the other at 50 or better */
create or replace function public.truce_active()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
    select coalesce((public.relations_reading() ->> 'truce')::boolean, false);
$function$;


create or replace function public.collect_faction_income()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    t record;
    g record;
    v_income bigint;
    v_cursor timestamptz;
    v_online_end timestamptz;
    v_reduced_end timestamptz;
    v_dead_from timestamptz;
    v_touch timestamptz;
    v_ticks bigint;
    v_paid bigint;
    v_bonus bigint;
begin

    /* no game.bypass here: income must obey the same guards as the rest of
       the world, and it simply does nothing while the game is frozen */
    select * into g from public.game_control as x where x.id = 1;

    -- maintenance or not started: the world is frozen, nothing accrues
    if g.started is not true or g.maintenance is true then
        return;
    end if;

    /* the rhythm follows the last hand on the game, not the open windows */
    v_touch := public.last_touch();

    /* a trading truce between the two main factions pays both books 10% more */
    v_bonus := case when public.truce_active() then 10 else 0 end;

    for t in
        select faction, last_income_at
        from public.faction_treasury
        for update
    loop

        v_income := 0;
        v_paid := 0;

        if t.last_income_at is not null then

            v_cursor := t.last_income_at;

            select coalesce(sum(
                p.income + 100 * (
                    select count(*)
                    from public.city_buildings as cb
                    join public.cities as cc on cc.id = cb.city_id
                    where cc.planet_id = p.id
                      and cb.building_type = 'civilian_factory'
                )
            ), 0)
            into v_income
            from public.planets as p
            where exists (
                  select 1 from public.cities as c
                  where c.planet_id = p.id
              )
              and not exists (
                  select 1 from public.cities as c
                  where c.planet_id = p.id
                    and c.faction <> t.faction
              );

            if v_touch is null then

                /* nobody has ever touched the game in this run: keep the old
                   reading, which only knows about the world being paused */
                v_online_end := least(now(), coalesce(g.offline_since, now()));
                v_reduced_end := now();
                v_dead_from := null;

            else

                /* full value until ten minutes after the last touch (and never
                   past the moment the world was paused because everybody had
                   gone), half value until two hours after it, nothing beyond */
                v_online_end := least(now(),
                                      coalesce(g.offline_since, now()),
                                      v_touch + interval '10 minutes');
                v_dead_from := v_touch + interval '2 hours';
                v_reduced_end := least(now(), v_dead_from);

            end if;

            -- online stretch: full value, one payment every 5 minutes
            if v_online_end > v_cursor then

                v_ticks := floor(extract(epoch from (v_online_end - v_cursor)) / 300);

                if v_ticks > 0 then
                    v_paid := v_paid + v_ticks * v_income;
                    v_cursor := v_cursor + v_ticks * interval '5 minutes';
                end if;

            end if;

            -- offline stretch: half value, one payment every 10 minutes
            if v_reduced_end > v_cursor then

                v_ticks := floor(extract(epoch from (v_reduced_end - v_cursor)) / 600);

                if v_ticks > 0 then
                    v_paid := v_paid + v_ticks * (v_income / 2);
                    v_cursor := v_cursor + v_ticks * interval '10 minutes';
                end if;

            end if;

            /*
               Two hours without a touch: the coffers are shut. Whatever is
               left between the two-hour mark and now is not owed, and it is
               not paid back when somebody finally walks in - the clock simply
               starts again from now.
            */
            if v_dead_from is not null and now() > v_dead_from then
                v_cursor := now();
            end if;

            if v_bonus > 0 and v_paid > 0 then
                v_paid := v_paid + (v_paid * v_bonus / 100);
            end if;

            if v_paid <> 0 then
                update public.faction_treasury as ft
                set credits = ft.credits + v_paid
                where ft.faction = t.faction;
            end if;

            update public.faction_treasury as ft
            set last_income_at = v_cursor
            where ft.faction = t.faction;

        else

            update public.faction_treasury as ft
            set last_income_at = now()
            where ft.faction = t.faction;

        end if;

    end loop;

end;
$function$;


-- ---------------------------------------------------------
-- 5. diplomacy with the independent worlds
-- ---------------------------------------------------------

create table if not exists public.planet_diplomacy (
    planet text not null,
    faction text not null,
    relation integer not null default 0 check (relation between 0 and 100),
    envoys integer not null default 0,
    last_envoy_at timestamptz,
    annexed_at timestamptz,
    primary key (planet, faction)
);

alter table public.planet_diplomacy enable row level security;


/* what an embassy costs, and how long a world makes you wait for the next */
create or replace function public.envoy_price()
returns integer
language sql
immutable
as $function$
    select 500
$function$;

create or replace function public.envoy_wait()
returns integer
language sql
immutable
as $function$
    select 300
$function$;


/*
   Send envoys to one independent world. Any player of either main faction
   may do it; the money comes from the faction's own treasury. At 100 the
   world signs the pact: its cities change flag and it stops being an
   independent partner - a conquest without a shot.
*/
create or replace function public.send_envoy(p_planet text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_planet_id integer;
    v_price integer := public.envoy_price();
    v_wait integer := public.envoy_wait();
    v_credits numeric;
    v_relation integer;
    v_annexed boolean := false;
    d record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;
    if v_faction is null or v_faction not in ('Freedom Authority', 'Combine') then
        raise exception 'Only the Freedom Authority and the Combine keep embassies';
    end if;

    select p.id into v_planet_id from public.planets as p where p.name = p_planet;
    if v_planet_id is null then raise exception 'There is no world called %', p_planet; end if;

    if exists (select 1 from public.cities as c
               where c.planet_id = v_planet_id
                 and c.faction in ('Freedom Authority', 'Combine')) then
        raise exception '% is not an independent world', p_planet;
    end if;

    select * into d from public.planet_diplomacy as x
    where x.planet = p_planet and x.faction = v_faction
    for update;

    if d.annexed_at is not null then
        raise exception '% has already signed the pact', p_planet;
    end if;

    if d.last_envoy_at is not null and d.last_envoy_at > now() - make_interval(secs => v_wait) then
        raise exception 'The court of % will see you again in % s', p_planet,
            ceil(extract(epoch from (d.last_envoy_at + make_interval(secs => v_wait) - now())))::integer;
    end if;

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft where ft.faction = v_faction;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'An embassy costs % credits', v_price;
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = v_faction;

    insert into public.planet_diplomacy (planet, faction, relation, envoys, last_envoy_at)
    values (p_planet, v_faction, 10, 1, now())
    on conflict (planet, faction) do update
        set relation = least(100, public.planet_diplomacy.relation + 10),
            envoys = public.planet_diplomacy.envoys + 1,
            last_envoy_at = now();

    select x.relation into v_relation from public.planet_diplomacy as x
    where x.planet = p_planet and x.faction = v_faction;

    if coalesce(v_relation, 0) >= 100 then

        update public.cities as c set faction = v_faction where c.planet_id = v_planet_id;
        update public.planet_diplomacy as x set annexed_at = now()
        where x.planet = p_planet and x.faction = v_faction;

        v_annexed := true;

    end if;

    /* the log is each side's own; the Congress's writer predates this patch,
       so it is called defensively */
    if v_faction = 'Combine' then
        perform public.cs_log('EMBAIXADA: ' || p_planet || ' recebeu enviados do Combine: relações '
                              || coalesce(v_relation, 0) || '/100.'
                              || case when v_annexed then ' O mundo assina o pacto e entra na União.' else '' end);
    else
        begin
            perform public.cg_log('EMBAIXADA: ' || p_planet || ' recebeu enviados da Freedom Authority: relações '
                                 || coalesce(v_relation, 0) || '/100.'
                                 || case when v_annexed then ' O mundo assina o pacto e entra na Autoridade.' else '' end);
        exception when others then null;
        end;
    end if;

    return jsonb_build_object(
        'planet', p_planet,
        'relation', coalesce(v_relation, 0),
        'annexed', v_annexed,
        'cost', v_price,
        'wait', v_wait,
        'credits', coalesce(v_credits, 0) - v_price
    );

end;
$function$;


/*
   Everything both diplomacy screens show: the two readings between the
   main factions, the truce and its dividend, and every independent world
   with what your faction has managed there. The same function serves the
   Congress and the Soviet.
*/
create or replace function public.diplomacy_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_other text;
    v_credits numeric;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    v_other := case when v_faction = 'Combine' then 'Freedom Authority'
                    when v_faction = 'Freedom Authority' then 'Combine'
                    else null end;

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft where ft.faction = v_faction;

    return jsonb_build_object(

        'now', now(),
        'me', v_faction,
        'other', v_other,
        'credits', coalesce(v_credits, 0),
        'cost', public.envoy_price(),
        'wait', public.envoy_wait(),
        'relations', public.relations_reading(),

        'planets', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'planet', t.name,
                       'cities', t.cities,
                       'relation', coalesce(d.relation, 0),
                       'envoys', coalesce(d.envoys, 0),
                       'wait', case
                           when d.last_envoy_at is null then 0
                           else greatest(0, ceil(extract(epoch from
                                  (d.last_envoy_at + make_interval(secs => public.envoy_wait()) - now())))::integer)
                       end,
                       'theirs', case when v_other is null then 0
                                      else coalesce((select x.relation from public.planet_diplomacy as x
                                                     where x.planet = t.name and x.faction = v_other), 0) end
                   ) order by coalesce(d.relation, 0) desc, t.name)
            from (
                select p.name, count(*)::integer as cities
                from public.planets as p
                join public.cities as c on c.planet_id = p.id
                where not exists (select 1 from public.cities as c2
                                  where c2.planet_id = p.id
                                    and c2.faction in ('Freedom Authority', 'Combine'))
                group by p.name
            ) as t
            left join public.planet_diplomacy as d
                   on d.planet = t.name and d.faction = v_faction
        ), '[]'::jsonb)

    );

end;
$function$;

-- ---------------------------------------------------------
-- 3. the elected head of the Soviet: the HIGH COMMISSAR
--
--    The office is the same one, with the same powers (five
--    directives before the Soviet, one veto per term, the ruling
--    current's agenda heard more often); only the name changes,
--    in the election, in the candidacy and in the veto's log line.
--    The columns keep their old names, so nothing else moves.
-- ---------------------------------------------------------

create or replace function public.cs_veto(p_directive integer)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    d record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into st from public.cs_state as s where s.id = 1;
    if st.secretary_player is null or st.secretary_player <> me then
        raise exception 'Only the High Commissar may veto';
    end if;
    if st.veto_used then raise exception 'The veto of this term has been used'; end if;

    select * into d from public.cs_directives as x where x.id = p_directive for update;
    if d.id is null or d.status not in ('introduction', 'debate') then
        raise exception 'Only a live directive can be vetoed';
    end if;

    update public.cs_directives as x
    set status = 'rejected', resolved_at = now(),
        result = jsonb_build_object('effect', 'O Alto Comissário vetou esta diretiva.', 'defections', '[]'::jsonb,
                                    'removed', '[]'::jsonb, 'total', 0)
    where x.id = d.id;

    update public.cs_state as s set veto_used = true where s.id = 1;

    delete from public.cs_debate_sides as s where s.directive_id = d.id;
    delete from public.cs_debate_standing as x where x.directive_id = d.id;

    perform public.cs_log('VETO: o Alto Comissário ' || coalesce(st.secretary_name, '') || ' veta "' || d.title || '".');

end;
$function$;


create or replace function public.cs_run()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    e record;
    v_current integer;
    v_name text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into e from public.cs_election as x where x.phase = 'campaign' order by x.id desc limit 1;
    if e.id is null then raise exception 'No campaign is open'; end if;

    select m.current_id into v_current from public.cs_membership as m where m.player_id = me;
    if v_current is null then raise exception 'Join a current of the Party first'; end if;

    if exists (select 1 from public.cs_candidates as c where c.election_id = e.id and c.player_id = me) then
        raise exception 'You are already a candidate';
    end if;

    v_name := coalesce(public.cs_player_name(me), 'Comrade');

    insert into public.cs_candidates (election_id, player_id, name, current_id)
    values (e.id, me, v_name, v_current);

    perform public.cs_log('CANDIDATURA: ' || v_name || ' apresenta-se a Alto Comissário.');

end;
$function$;


create or replace function public.cs_election_tick()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    st record;
    e record;
    v_win record;
    v_tie boolean;
begin

    select * into st from public.cs_state as s where s.id = 1;
    select * into e from public.cs_election as x where x.phase <> 'done' order by x.id desc limit 1;

    /* a term that has run out, or no Secretary at all: a campaign opens */
    if e.id is null then

        if (st.secretary_player is null or st.term_end is null or st.term_end <= now())
           and (st.last_election_at is null or st.last_election_at < now() - interval '2 minutes')
           and now() - coalesce(st.online_at, now()) < interval '150 seconds' then

            insert into public.cs_election (phase, campaign_end, vote_end)
            values ('campaign', now() + interval '8 minutes', now() + interval '16 minutes');

            update public.cs_state as s set last_election_at = now() where s.id = 1;

            perform public.cs_log('ELEIÇÃO: uma campanha para Alto Comissário foi aberta. Entre em uma corrente do Partido, declare a candidatura (8 minutos) e então todos votam (8 minutos).');
        end if;

        return;

    end if;

    if e.phase = 'campaign' and now() >= e.campaign_end then

        if not exists (select 1 from public.cs_candidates as c where c.election_id = e.id) and now() < e.campaign_end + interval '5 minutes' then
            update public.cs_election as x set campaign_end = x.campaign_end + interval '5 minutes',
                                                vote_end = x.vote_end + interval '5 minutes'
            where x.id = e.id;
            perform public.cs_log('ELEIÇÃO: ninguém se candidatou ainda. A campanha foi prorrogada por 5 minutos.');
            return;
        end if;

        update public.cs_election as x set phase = 'voting' where x.id = e.id;
        perform public.cs_log('ELEIÇÃO: a votação está aberta. Todo jogador do Combine que entrou em uma corrente pode votar.');
        return;

    end if;

    if e.phase = 'voting' and now() >= e.vote_end then

        select c.player_id, c.name, c.current_id, count(v.player_id) as votes
        into v_win
        from public.cs_candidates as c
        left join public.cs_election_votes as v on v.candidate_id = c.player_id and v.election_id = e.id
        where c.election_id = e.id
        group by c.player_id, c.name, c.current_id
        order by count(v.player_id) desc, c.name
        limit 1;

        if v_win.player_id is null then
            update public.cs_election as x set phase = 'done', note = 'Nenhum candidato.' where x.id = e.id;
            perform public.cs_log('ELEIÇÃO: ninguém se apresentou. O cargo continua vago.');
            return;
        end if;

        update public.cs_state as s
        set secretary_player = v_win.player_id,
            secretary_name = v_win.name,
            secretary_current = v_win.current_id,
            term_no = s.term_no + 1,
            term_end = now() + interval '14 days',
            veto_used = false
        where s.id = 1;

        update public.cs_election as x
        set phase = 'done', winner_id = v_win.player_id, winner_name = v_win.name,
            note = 'Eleito com ' || v_win.votes || ' voto(s).'
        where x.id = e.id;

        perform public.cs_log('ELEIÇÃO: ' || v_win.name || ' é eleito Alto Comissário do Combine (' || v_win.votes || ' voto(s)).');

        return;

    end if;

end;
$function$;

-- the office starts with nothing in it, and the Independents leave the
-- Combine's book of relations
alter table public.cs_state
    alter column relations set default '{"Freedom Authority": -20}'::jsonb;

update public.cs_state as s
set relations = s.relations - 'Independents'
where s.relations ? 'Independents';


-- ---------------------------------------------------------
-- 4. the Independents are not a faction any more
--
--    No bill and no directive treats them as one bloc: the envoys
--    go to the other main faction, and every independent world is
--    dealt with on its own (section 5). The leftover line is taken
--    out of both sides' books.
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

            /* a world whose administration has stalled: the Party sends the
               relief itself, the way a delegate would put it to Congress —
               the Combine does not need a directive for it */
            select o.planet into v_planet
            from public.cs_occupations as o
            where o.stage < 3
              and o.stability < public.cs_occupation_threshold(o.stage)
              and (o.last_relief_at is null or o.last_relief_at <= now() - interval '5 minutes')
            order by o.stage desc, random()
            limit 1;

            if v_planet is not null then
                update public.cs_occupations as o
                set stability = least(100, o.stability + 10), last_relief_at = now()
                where o.planet = v_planet;
                perform public.cs_log('AJUDA: o Partido envia ajuda económica a ' || v_planet || ': estabilidade +10.');
                return;
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
        when 'diplomacy' then 'Pacto fraterno com os ' || coalesce(nullif(p_target, ''), 'Freedom Authority')
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


create or replace function public.cs_execute(p_id integer)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
    d record;
    v_planet text;
    v_credits numeric;
begin

    select * into d from public.cs_directives as x where x.id = p_id;
    if d.id is null then return ''; end if;

    if d.dtype = 'military_campaign' then

        insert into public.cs_authorizations (kind, planet) values ('war', d.planet);
        return 'Campanha aprovada contra ' || coalesce(d.planet, 'o alvo') || ': as frotas do Combine podem atacá-lo.';

    elsif d.dtype = 'fleet_construction' then

        insert into public.cs_authorizations (kind, player_id) values ('fleet', d.proposer_player);
        return 'Uma nova frota foi autorizada: construa-a no mapa galáctico.';

    elsif d.dtype = 'knightmare_construction' then

        insert into public.cs_authorizations (kind, player_id) values ('knightmare', d.proposer_player);
        return 'Um destacamento blindado foi autorizado: recrute-o para uma frota (a cadeia da Instalação Knightmare ainda é necessária).';

    elsif d.dtype = 'production_quota' then

        update public.cs_state as s
        set quota = least(2, s.quota + 1),
            confidence = greatest(0, s.confidence - 5)
        where s.id = 1;
        return 'Plano de produção elevado: 300-500 créditos a cada 15 minutos por nível (máximo 2); o Partido perde confiança.';

    elsif d.dtype = 'diplomacy' then

        update public.cs_state as s
        set relations = jsonb_set(s.relations, array[coalesce(d.target_faction, 'Freedom Authority')],
                                  to_jsonb(coalesce((s.relations ->> coalesce(d.target_faction, 'Freedom Authority'))::numeric, 0) + 10), true)
        where s.id = 1;
        return 'Emissários enviados aos ' || coalesce(d.target_faction, 'Freedom Authority') || ': as relações melhoram.';

    elsif d.dtype = 'consolidation' then

        /* no longer submitted anywhere: this only settles a consolidation that
           was already in the plenum when relief became a direct order */
        update public.cs_occupations as o
        set stability = least(100, o.stability + 10)
        where o.planet = d.planet;

        return 'Administração de ' || coalesce(d.planet, 'o mundo') || ' consolidada: estabilidade +10.';

    elsif d.dtype = 'fleet_revocation' then

        if d.fleet_id is null or not exists (select 1 from public.fleets as f where f.id::text = d.fleet_id) then
            return 'A frota não pôde ser desativada (ela não existe mais ou está em batalha).';
        end if;

        delete from public.fleets as f where f.id::text = d.fleet_id;

        update public.faction_treasury as ft set credits = ft.credits + 500 where ft.faction = 'Combine';
        select ft.credits into v_credits from public.faction_treasury as ft where ft.faction = 'Combine';

        return 'A frota foi desativada: 500 créditos de sucata.';
    end if;

    return '';

end;
$function$;


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

            v_target := 'Combine';
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

-- the Congress's own book of relations: if the column is not where this
-- patch expects it, the reset simply leaves it alone
do $do$
begin
    update public.cg_state as s
    set relations = s.relations - 'Independents'
    where s.relations ? 'Independents';
exception when undefined_column or undefined_table then null;
end;
$do$;


-- ---------------------------------------------------------
-- 6. the reset button clears all of it
--
--    The game's own game_reset() knows nothing about the Soviet,
--    the parties, the embassies or the presence list, so the reset
--    button in gamecontrol.js calls this right after it. Only the
--    host may run it, exactly like the game's own reset.
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

    /* the embassies and the presence list */
    delete from public.planet_diplomacy;
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
        and routine_name in ('last_touch', 'income_mode', 'players_online', 'truce_active',
                             'relations_reading', 'send_envoy', 'diplomacy_state', 'game_reset_extras')) as new_functions,
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'player_presence'
        and column_name = 'last_active') as presence_activity_column,
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'planet_diplomacy'
        and column_name = 'relation') as diplomacy_table,
    (select count(*) from public.cs_currents) as currents,
    (select count(*) from information_schema.routines
      where routine_schema = 'public' and routine_name = 'cs_overview') as overview_ready;
