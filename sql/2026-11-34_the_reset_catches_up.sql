-- =========================================================
-- GALACTIC FRONT — THE RESET CATCHES UP
--
-- Run AFTER sql/2026-11-33_the_slave_routes.sql, in the
-- Supabase SQL editor (SQL > New query). Safe to run more
-- than once, and after every other patch.
--
-- WHY THIS EXISTS
--
--   The host's RESET button is one call to game_reset, one to
--   game_reset_extras, and then the small resets each new
--   system brought of its own. game_reset_extras was last
--   written before the charters, the newspaper, the playlist,
--   the occupation policy, the committees, the ministries and
--   Tuskara existed, so a fresh game kept them.
--
--   Everything added since is cleared here, each inside a
--   guard: a database that never ran one of those patches
--   simply has no such table and the reset still finishes.
--   The old clears are repeated unchanged, so this function is
--   whole on its own and this patch can be run at any time.
-- =========================================================


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

    /* ---------- the Soviet's books (11-06, unchanged) ---------- */

    begin
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
    exception when undefined_table then null;
    end;

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

    begin
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
    exception when undefined_column or undefined_table then null;
    end;

    /* the embassies, the ceasefires and the presence list */
    begin
        delete from public.planet_diplomacy;
        delete from public.player_presence;
        delete from public.ceasefires;
        delete from public.supply_lines;
    exception when undefined_table then null;
    end;

    /* the Freedom Authority's elected head */
    begin
        update public.cg_state as s
        set president_player = null,
            term_no = 0,
            term_end = null
        where s.id = 1;
    exception when undefined_column or undefined_table then null;
    end;

    /* the unrest of the occupied worlds, and the Congress's chair */
    begin
        delete from public.planet_unrest;
    exception when undefined_table then null;
    end;

    begin
        delete from public.cg_speaker_votes;
        delete from public.cg_speaker_candidates;
        delete from public.cg_speaker_election;
        update public.cg_speaker_state as s
        set speaker_player = null,
            speaker_name = null,
            speaker_party = null,
            term_no = 0,
            term_end = null,
            veto_used = false,
            last_election_at = null
        where s.id = 1;
    exception when undefined_table then null;
    end;

    /* the tax meter starts again with the game */
    begin
        update public.cg_state as s set last_tax_at = now() where s.id = 1;
    exception when undefined_column or undefined_table then null;
    end;


    /* ---------- what came after 11-06 ---------- */

    /* the charters of the restless worlds (11-07) */
    begin
        delete from public.planet_charters;
    exception when undefined_table then null;
    end;

    /* the paper: every story, lead or not (11-08) */
    begin
        delete from public.news_articles;
    exception when undefined_table then null;
    end;

    /* the host's playlist and what was playing (11-08) */
    begin
        delete from public.music_tracks;
        delete from public.music_playback;
    exception when undefined_table then null;
    end;

    /* the occupation policy of every world (11-13) */
    begin
        delete from public.planet_policy;
    exception when undefined_table then null;
    end;

    /* the committees of both chambers (11-15, repaired by 11-19) — a fresh
       game has no chairs filled */
    begin
        delete from public.cg_committees;
        delete from public.cs_committees;
    exception when undefined_table then null;
    end;

    /* the ministries: the seats are empty again (11-20, 11-23) */
    begin
        delete from public.cg_ministers;
        delete from public.cs_ministers;
    exception when undefined_table then null;
    end;

    /* Tuskara: the settlements, the pens, the loads at sea, the hulls, the
       spies and the routes the trade wore into the map (11-26 to 11-33).
       tusken_world_reset is called by the button as well; this is the same
       wipe, so one failing call cannot leave the desert half-settled */
    begin
        delete from public.tusken_convoys;
        delete from public.tusken_workforce;
        delete from public.tusken_colonies;
        delete from public.tusken_ships;
        delete from public.tusken_intel;
        delete from public.tusken_routes;
        delete from public.fleets where transport_fleet;
    exception when undefined_table or undefined_column then null;
    end;

    return jsonb_build_object('ok', true);

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select (select count(*) from information_schema.routines
         where routine_schema = 'public'
           and routine_name = 'game_reset_extras') as reset_functions,
       (select count(*) from information_schema.tables
         where table_schema = 'public'
           and table_name in ('planet_charters', 'news_articles', 'music_tracks',
                              'music_playback', 'planet_policy', 'cg_committees',
                              'cs_committees', 'cg_ministers', 'cs_ministers',
                              'tusken_colonies', 'tusken_routes')) as tables_it_clears;
