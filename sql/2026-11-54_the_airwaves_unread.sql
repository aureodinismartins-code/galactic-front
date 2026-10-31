-- =========================================================
-- GALACTIC FRONT — the airwaves: what came in while you were away
--
-- Run in the Supabase SQL editor after 2026-11-53. Safe to run more than once.
--
-- The chat button carries a small count of the messages that arrived while
-- the panel was shut. Each screen remembers, in its own browser, the newest
-- id it has already drawn on each channel, and hands that to chat_unread().
-- Only traffic this commander may read is counted, and never their own words.
--
--   chat_unread(seen) -> { global, team, private, total, latest }
--
-- "seen" is what that browser has drawn so far:
--
--   { "global": 41, "team": 12, "private": { "<commander>": 9 } }
--
-- A value that is not a number counts as nothing read. Nothing is marked
-- read here: the screen does that when it draws a channel, so a message on
-- another screen of the same player stays new.
-- =========================================================


create or replace function public.chat_unread(p_seen jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_seen_global bigint := 0;
    v_seen_team bigint := 0;
    v_global integer := 0;
    v_team integer := 0;
    v_private integer := 0;
    v_last_global bigint := 0;
    v_last_team bigint := 0;
    v_last_private bigint := 0;
    v_latest_private jsonb := '{}'::jsonb;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    /* a mark that is not a number counts as nothing read */
    v_seen_global := case when coalesce(p_seen ->> 'global', '') ~ '^[0-9]{1,18}$'
                          then (p_seen ->> 'global')::bigint else 0 end;
    v_seen_team := case when coalesce(p_seen ->> 'team', '') ~ '^[0-9]{1,18}$'
                        then (p_seen ->> 'team')::bigint else 0 end;

    /* GLOBAL: everybody, but your own words have just been read by you */
    select count(*) filter (where m.sender <> me), coalesce(max(m.id), 0)
    into v_global, v_last_global
    from public.chat_messages as m
    where m.channel = 'global' and m.id > v_seen_global;

    /* TEAM: only the side this commander is on */
    select p.faction into v_faction from public.players as p where p.id = me;

    if coalesce(v_faction, '') <> '' then

        select count(*) filter (where m.sender <> me), coalesce(max(m.id), 0)
        into v_team, v_last_team
        from public.chat_messages as m
        where m.channel = 'team' and m.faction = v_faction and m.id > v_seen_team;

    end if;

    /* PRIVATE: each thread is counted against the mark left on it */
    select count(*) filter (where m.sender <> me), coalesce(max(m.id), 0)
    into v_private, v_last_private
    from public.chat_messages as m
    where m.channel = 'private' and m.recipient = me
      and m.id > case when coalesce(p_seen -> 'private' ->> m.sender::text, '') ~ '^[0-9]{1,18}$'
                      then (p_seen -> 'private' ->> m.sender::text)::bigint else 0 end;

    v_last_global := greatest(v_last_global, v_seen_global);
    v_last_team := greatest(v_last_team, v_seen_team);

    /* where each thread stands, so a screen new to this player can start
       from what is already there rather than counting all of history */
    select coalesce(jsonb_object_agg(x.sender::text, x.newest), '{}'::jsonb)
    into v_latest_private
    from (
        select m.sender, max(m.id) as newest
        from public.chat_messages as m
        where m.channel = 'private' and m.recipient = me
        group by m.sender
    ) as x;

    return jsonb_build_object(
        'global', v_global,
        'team', v_team,
        'private', v_private,
        'total', v_global + v_team + v_private,
        'latest', jsonb_build_object(
            'global', v_last_global,
            'team', v_last_team,
            'private', v_latest_private
        )
    );

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from public.chat_messages) as messages,
    (select count(*) from information_schema.routines
      where routine_schema = 'public' and routine_name = 'chat_unread') as unread_function;
