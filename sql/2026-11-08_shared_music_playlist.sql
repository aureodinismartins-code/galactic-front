-- =========================================================
-- GALACTIC FRONT — the ship's wireless: one playlist for the whole game
--
-- Run this in the Supabase SQL editor AFTER
-- 2026-11-07_charters_and_restless_worlds.sql.
-- Safe to run more than once.
--
-- WHAT THIS ADDS
--
--   THE PLAYLIST BELONGS TO THE HOST — the account in
--   game_control.host_player, the same one that holds the reset and the
--   maintenance keys. Only the host may put a track on or take one off:
--   music_add() and music_remove() refuse anybody else.
--
--   EVERYBODY ELSE HEARS THE SAME MUSIC. music_state() hands every screen
--   the list, the track that is playing, when it started — with the
--   server's own clock, so each browser can work out how many seconds into
--   the track to jump — and whether it is paused. The host presses play and
--   the whole galaxy is listening to the same song at the same second.
--
--   NOBODY IS FORCED TO LISTEN. The mute belongs to each player and lives
--   in their own browser; it is the one control the crew has.
--
--   A FILE FROM THE HOST'S OWN COMPUTER CANNOT TRAVEL — there is nowhere to
--   put it — so it plays on the host's screen only. To share a track, put
--   the file online and add its link.
--
--   The needle can only ever move forward: music_advance() is what any
--   screen calls when the track it is playing ends, so the wireless keeps
--   going even if the host has closed their tab. It moves only from the
--   track that is actually playing, and only after that track has run for
--   at least twenty seconds.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the songs, and the needle
-- ---------------------------------------------------------

create table if not exists public.music_tracks (
    id uuid primary key default gen_random_uuid(),
    title text not null default '',
    url text not null,
    added_by uuid,
    added_name text,
    created_at timestamptz not null default now()
);

alter table public.music_tracks enable row level security;
revoke all on public.music_tracks from anon, authenticated;

create index if not exists music_tracks_created_idx on public.music_tracks (created_at, id);


/* what the wireless is doing right now: one row, and only ever one */
create table if not exists public.music_playback (
    id integer primary key default 1 check (id = 1),
    track_id uuid,
    started_at timestamptz,
    paused boolean not null default true,
    updated_at timestamptz not null default now()
);

alter table public.music_playback enable row level security;
revoke all on public.music_playback from anon, authenticated;

insert into public.music_playback (id, paused) values (1, true)
on conflict (id) do nothing;


-- ---------------------------------------------------------
-- 2. who is holding the needle, and what everybody reads
-- ---------------------------------------------------------

/* the host is the account with the reset and the maintenance keys */
create or replace function public.music_is_host()
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v boolean;
begin

    select (g.host_player is not null and g.host_player = auth.uid())
    into v
    from public.game_control as g
    where g.id = 1;

    return coalesce(v, false);

end;
$function$;


/*
   The list and the needle, for any player at all. 'now' comes with it so
   every browser can measure its own clock against the server's and seek to
   the same second.
*/
create or replace function public.music_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    p record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into p from public.music_playback as x where x.id = 1;

    return jsonb_build_object(
        'now', now(),
        'is_host', public.music_is_host(),
        'tracks', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', t.id,
                       'title', t.title,
                       'url', t.url,
                       'added_by', t.added_name,
                       'added_at', t.created_at)
                   order by t.created_at, t.id)
            from public.music_tracks as t
        ), '[]'::jsonb),
        'playback', case when p.track_id is null then null else jsonb_build_object(
            'id', p.track_id,
            'title', coalesce((select t.title from public.music_tracks as t where t.id = p.track_id), ''),
            'url', coalesce((select t.url from public.music_tracks as t where t.id = p.track_id), ''),
            'started_at', p.started_at,
            'paused', coalesce(p.paused, true)
        ) end
    );

end;
$function$;


-- ---------------------------------------------------------
-- 3. the host's controls — nobody else's
-- ---------------------------------------------------------

create or replace function public.music_add(p_url text, p_title text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_url text := btrim(coalesce(p_url, ''));
    v_title text := btrim(coalesce(p_title, ''));
    v_id uuid;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not public.music_is_host() then
        raise exception 'Only the host of the game chooses the music';
    end if;

    if v_url = '' then
        raise exception 'Paste a link to an audio file first';
    end if;

    if length(v_url) > 2048 then
        raise exception 'That link is too long';
    end if;

    /* a link is the only thing that can reach the other players */
    if v_url !~* '^https?://' then
        raise exception 'A track has to be an http(s) link';
    end if;

    if v_title = '' then
        v_title := regexp_replace(regexp_replace(split_part(v_url, '?', 1), '^.*/', ''),
                                  '\.[A-Za-z0-9]{2,5}$', '');
    end if;

    if v_title = '' then v_title := 'Untitled'; end if;
    if length(v_title) > 120 then v_title := left(v_title, 120); end if;

    if exists (select 1 from public.music_tracks as t where t.url = v_url) then
        raise exception 'That track is already on the wireless';
    end if;

    insert into public.music_tracks (title, url, added_by, added_name)
    values (v_title, v_url, me,
            (select p.username from public.players as p where p.id = me))
    returning id into v_id;

    /* the very first track put on starts the wireless by itself */
    if (select count(*) from public.music_tracks) = 1 then
        update public.music_playback as x
        set track_id = v_id, started_at = now(), paused = false, updated_at = now()
        where x.id = 1;
    end if;

    return public.music_state();

end;
$function$;


create or replace function public.music_remove(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    p record;
    v_next uuid;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not public.music_is_host() then
        raise exception 'Only the host of the game chooses the music';
    end if;

    select * into p from public.music_playback as x where x.id = 1;

    delete from public.music_tracks as t where t.id = p_id;

    if not found then
        raise exception 'That track is not on the wireless';
    end if;

    if p.track_id = p_id then
        /* the needle moves to what is left, or the wireless falls silent */
        select t.id into v_next from public.music_tracks as t order by t.created_at, t.id limit 1;

        update public.music_playback as x
        set track_id = v_next,
            started_at = case when v_next is null then null else now() end,
            paused = v_next is null,
            updated_at = now()
        where x.id = 1;
    end if;

    return public.music_state();

end;
$function$;


create or replace function public.music_play(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not public.music_is_host() then
        raise exception 'Only the host of the game chooses the music';
    end if;

    if not exists (select 1 from public.music_tracks as t where t.id = p_id) then
        raise exception 'That track is not on the wireless';
    end if;

    update public.music_playback as x
    set track_id = p_id, started_at = now(), paused = false, updated_at = now()
    where x.id = 1;

    return public.music_state();

end;
$function$;


/*
   Pausing stops the galaxy. Coming back starts the current track from the
   top, so everybody is at the same second when it begins again.
*/
create or replace function public.music_paused(p_paused boolean)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not public.music_is_host() then
        raise exception 'Only the host of the game chooses the music';
    end if;

    if coalesce(p_paused, true) then
        update public.music_playback as x
        set paused = true, updated_at = now()
        where x.id = 1;
    else
        update public.music_playback as x
        set paused = false,
            started_at = case when x.track_id is null then x.started_at else now() end,
            updated_at = now()
        where x.id = 1;
    end if;

    return public.music_state();

end;
$function$;


/*
   The next track on the list, called by whichever screen hears the end of
   the one that is playing, so the wireless does not stop because the host
   has closed their tab. Any player may call it, and it can only ever move
   on: it does nothing unless the track it is given is still the one
   playing, and unless that track has been running for twenty seconds.
*/
create or replace function public.music_advance(p_from uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    p record;
    v_next uuid;
    v_from timestamptz;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into p from public.music_playback as x where x.id = 1 for update;

    if p.track_id is distinct from p_from or coalesce(p.paused, true) then
        return public.music_state();
    end if;

    if p.started_at is not null and now() < p.started_at + interval '20 seconds' then
        return public.music_state();
    end if;

    select t.created_at into v_from from public.music_tracks as t where t.id = p_from;

    /* the next one in the list */
    select t.id into v_next
    from public.music_tracks as t
    where t.created_at > coalesce(v_from, '-infinity'::timestamptz)
       or (t.created_at = v_from and t.id > p_from)
    order by t.created_at, t.id
    limit 1;

    /* the end of the list: the wireless loops, and a single track replays */
    if v_next is null then
        select t.id into v_next from public.music_tracks as t order by t.created_at, t.id limit 1;
    end if;

    update public.music_playback as x
    set track_id = v_next,
        started_at = case when v_next is null then null else now() end,
        paused = v_next is null,
        updated_at = now()
    where x.id = 1;

    return public.music_state();

end;
$function$;


-- ---------------------------------------------------------
-- 4. the closing readout
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.tables
      where table_schema = 'public'
        and table_name in ('music_tracks', 'music_playback')) as music_tables,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('music_is_host', 'music_state', 'music_add', 'music_remove',
                             'music_play', 'music_paused', 'music_advance')) as music_functions,
    (select count(*) from public.music_tracks) as tracks,
    (select count(*) from public.game_control as g
      join public.players as p on p.id = g.host_player
     where g.id = 1) as hosts;
