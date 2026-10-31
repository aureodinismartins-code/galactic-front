-- =========================================================
-- GALACTIC FRONT — the airwaves: global, team and private chat
--
-- Run in the Supabase SQL editor after 2026-11-52. Safe to run more than once.
--
-- Three channels, and nothing is read that is not yours to read:
--
--   GLOBAL  everybody in the war hears everybody.
--   TEAM    only your own side: Freedom Authority, Combine, Independents.
--   PRIVATE a whisper between two commanders.
--
-- Messages live in chat_messages. The table carries row level security and
-- no policy at all, so the screen talks to the functions below and never to
-- the rows directly; every read is filtered by the sender's own identity.
--
--   chat_send(channel, body, to)      post a message
--   chat_fetch(channel, with, after)  what this commander may read
--   chat_people()                     the names a whisper may go to
--
-- A body is trimmed and cut at 400 characters, and no commander may post
-- more than six messages in thirty seconds.
-- =========================================================


-- ---------------------------------------------------------
-- 1. where the traffic is kept
-- ---------------------------------------------------------

create table if not exists public.chat_messages (
    id bigserial primary key,
    channel text not null check (channel in ('global', 'team', 'private')),
    faction text,
    sender uuid not null,
    sender_name text not null default 'Commander',
    recipient uuid,
    body text not null,
    created_at timestamptz not null default now()
);

create index if not exists chat_messages_channel_idx
    on public.chat_messages (channel, id desc);
create index if not exists chat_messages_private_idx
    on public.chat_messages (recipient, id desc);

/* no policy: the functions are the only way in */
alter table public.chat_messages enable row level security;


-- ---------------------------------------------------------
-- 2. what a commander is called
-- ---------------------------------------------------------

create or replace function public.chat_player_name(p_player uuid)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v text;
    v_col text;
begin

    if p_player is null then return null; end if;

    /* the players table carries the name under one of two names */
    select c.column_name into v_col
    from information_schema.columns as c
    where c.table_schema = 'public' and c.table_name = 'players'
      and c.column_name in ('username', 'name')
    order by (c.column_name = 'username') desc
    limit 1;

    if v_col is not null then
        begin
            execute format('select %I from public.players as p where p.id = $1', v_col)
            into v using p_player;
        exception when others then v := null;
        end;
    end if;

    if coalesce(v, '') = '' then
        v := 'Commander ' || left(p_player::text, 4);
    end if;

    return v;

end;
$function$;


-- ---------------------------------------------------------
-- 3. posting
-- ---------------------------------------------------------

create or replace function public.chat_send(p_channel text, p_body text, p_to uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_body text;
    v_faction text;
    v_name text;
    v_recent integer;
    v_to uuid;
    v_row public.chat_messages%rowtype;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if p_channel not in ('global', 'team', 'private') then
        raise exception 'Unknown channel';
    end if;

    v_body := trim(coalesce(p_body, ''));

    if v_body = '' then
        raise exception 'Write something first';
    end if;

    if length(v_body) > 400 then
        v_body := left(v_body, 400);
    end if;

    /* six in half a minute is plenty over the air */
    select count(*) into v_recent
    from public.chat_messages as m
    where m.sender = me and m.created_at > now() - interval '30 seconds';

    if v_recent >= 6 then
        raise exception 'Six messages in half a minute is enough: wait a moment';
    end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if p_channel = 'team' and coalesce(v_faction, '') = '' then
        raise exception 'You have no side to talk to yet';
    end if;

    if p_channel = 'private' then

        v_to := p_to;

        if v_to is null then
            raise exception 'Choose who to write to';
        end if;
        if v_to = me then
            raise exception 'You cannot whisper to yourself';
        end if;
        if not exists (select 1 from public.players as p where p.id = v_to) then
            raise exception 'Nobody of that name sits at the table';
        end if;

    else
        v_to := null;
    end if;

    v_name := coalesce(public.chat_player_name(me), 'Commander');

    insert into public.chat_messages (channel, faction, sender, sender_name, recipient, body)
    values (p_channel, case when p_channel = 'team' then v_faction else null end, me, v_name, v_to, v_body)
    returning * into v_row;

    return jsonb_build_object(
        'id', v_row.id,
        'channel', v_row.channel,
        'sender', v_row.sender,
        'name', v_row.sender_name,
        'to', v_row.recipient,
        'body', v_row.body,
        'at', v_row.created_at
    );

end;
$function$;


-- ---------------------------------------------------------
-- 4. reading
-- ---------------------------------------------------------

create or replace function public.chat_fetch(p_channel text, p_with uuid default null, p_after bigint default 0)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_rows jsonb;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if p_channel not in ('global', 'team', 'private') then
        raise exception 'Unknown channel';
    end if;

    if p_channel = 'team' then
        select p.faction into v_faction from public.players as p where p.id = me;
        if coalesce(v_faction, '') = '' then
            return jsonb_build_object('messages', '[]'::jsonb, 'now', now());
        end if;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
               'id', x.id,
               'channel', x.channel,
               'sender', x.sender,
               'name', x.sender_name,
               'to', x.recipient,
               'body', x.body,
               'at', x.created_at) order by x.id), '[]'::jsonb)
    into v_rows
    from (
        select m.*
        from public.chat_messages as m
        where case
                  when p_channel = 'global' then m.channel = 'global'
                  when p_channel = 'team' then m.channel = 'team' and m.faction = v_faction
                  else m.channel = 'private' and (
                           (m.sender = me and m.recipient = p_with) or
                           (m.sender = p_with and m.recipient = me))
              end
          and (coalesce(p_after, 0) = 0 or m.id > p_after)
        order by m.id desc
        limit 100
    ) as x;

    return jsonb_build_object('messages', v_rows, 'now', now(), 'me', me);

end;
$function$;


-- ---------------------------------------------------------
-- 5. who a whisper may go to
-- ---------------------------------------------------------

create or replace function public.chat_people()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_rows jsonb;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if to_regclass('public.player_presence') is not null then

        select coalesce(jsonb_agg(jsonb_build_object(
                   'id', p.id,
                   'name', public.chat_player_name(p.id),
                   'faction', p.faction,
                   'online', (pr.last_seen is not null and pr.last_seen > now() - interval '70 seconds'))
                   order by (pr.last_seen is not null and pr.last_seen > now() - interval '70 seconds') desc,
                            public.chat_player_name(p.id)), '[]'::jsonb)
        into v_rows
        from public.players as p
        left join public.player_presence as pr on pr.player_id = p.id
        where p.id <> me;

    else

        select coalesce(jsonb_agg(jsonb_build_object(
                   'id', p.id,
                   'name', public.chat_player_name(p.id),
                   'faction', p.faction,
                   'online', false) order by public.chat_player_name(p.id)), '[]'::jsonb)
        into v_rows
        from public.players as p
        where p.id <> me;

    end if;

    return jsonb_build_object('people', v_rows);

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from public.chat_messages) as messages,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('chat_send', 'chat_fetch', 'chat_people', 'chat_player_name')) as functions,
    (select relrowsecurity from pg_class where oid = 'public.chat_messages'::regclass) as locked_to_functions;
