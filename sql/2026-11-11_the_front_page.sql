-- =========================================================
-- GALACTIC FRONT — the front page: one newspaper for the whole war
--
-- Run in the Supabase SQL editor after 2026-11-10. Safe to run more than once.
--
--   * THE PAPER BELONGS TO THE HOST — the account in
--     game_control.host_player, the same one that holds the reset, the
--     maintenance keys and the wireless. The host is the EDITOR: they
--     write a story whenever they like and it is on the front page at
--     once. Every other screen only reads.
--
--   * THE TWO FACTION LEADERS — the President of the Freedom Authority
--     and the High Commissar of the Combine, the offices the players
--     themselves elect — may FILE A DISPATCH. It goes into the editor's
--     tray and nowhere else: nothing a commander writes reaches the
--     front page until the host allows it. A refusal carries the
--     editor's note back to the desk that filed it.
--
--   * PICTURES travel as http(s) links, and — when the project has
--     storage — as uploads to the public "news" bucket this patch
--     creates. A file that cannot be uploaded is kept on the author's
--     own screen, the same rule the wireless follows.
--
--   * THE ARCHIVE SURVIVES THE RESET. A new war keeps the papers that
--     were printed; the trays are emptied, because a dispatch filed
--     against the last war is nothing but a yellowed clipping.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the paper
-- ---------------------------------------------------------

create table if not exists public.news_articles (
    id uuid primary key default gen_random_uuid(),
    author_id uuid,
    author_name text not null default '',
    author_role text not null default 'leader',      -- 'editor' | 'leader'
    faction text,
    headline text not null default '',
    standfirst text not null default '',
    body text not null default '',
    image_url text,
    image_caption text,
    status text not null default 'pending',          -- pending | published | refused | draft
    note text,                                       -- the editor's refusal note
    pinned boolean not null default false,
    submitted_at timestamptz not null default now(),
    published_at timestamptz,
    edited_at timestamptz
);

alter table public.news_articles enable row level security;
revoke all on public.news_articles from anon, authenticated;

create index if not exists news_articles_front_idx
    on public.news_articles (status, pinned desc, published_at desc nulls last, submitted_at desc);

create index if not exists news_articles_desk_idx
    on public.news_articles (author_id, status, submitted_at desc);


-- ---------------------------------------------------------
-- 2. who is holding the pen
-- ---------------------------------------------------------

/* the editor is the host: the account with the reset and the maintenance keys */
create or replace function public.news_is_editor()
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
   Which faction's leader is asking? The President of the Freedom Authority
   and the High Commissar of the Combine are the offices the players elect,
   and they are the only two commanders who may file a dispatch.
*/
create or replace function public.news_leader_faction()
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v text;
begin

    if me is null then return null; end if;

    if to_regclass('public.cg_state') is not null then
        select case when s.president_player = me then 'Freedom Authority' else null end
        into v
        from public.cg_state as s
        where s.id = 1;

        if v is not null then return v; end if;
    end if;

    if to_regclass('public.cs_state') is not null then
        select case when s.secretary_player = me then 'Combine' else null end
        into v
        from public.cs_state as s
        where s.id = 1;

        if v is not null then return v; end if;
    end if;

    return null;

end;
$function$;


/* the leader's office, as it is signed under a dispatch */
create or replace function public.news_office(p_faction text)
returns text
language sql
immutable
as $function$
    select case
        when p_faction = 'Freedom Authority' then 'President of the Freedom Authority'
        when p_faction = 'Combine' then 'High Commissar of the Combine'
        else null
    end
$function$;


/* ---------------------------------------------------------
   What a story has to be. Every field is trimmed and cut to
   a length the paper can hold, so nothing a commander types
   can break a page or fill the database.
   --------------------------------------------------------- */

create or replace function public.news_cleaned(
    p_headline text, p_standfirst text, p_body text, p_image_url text, p_image_caption text)
returns jsonb
language plpgsql
immutable
as $function$
declare
    v_head text := btrim(coalesce(p_headline, ''));
    v_stand text := btrim(coalesce(p_standfirst, ''));
    v_body text := btrim(coalesce(p_body, ''));
    v_img text := nullif(btrim(coalesce(p_image_url, '')), '');
    v_cap text := nullif(btrim(coalesce(p_image_caption, '')), '');
begin

    if v_head = '' then
        raise exception 'A story needs a headline';
    end if;

    if v_stand = '' and v_body = '' then
        raise exception 'A story needs some words under the headline';
    end if;

    if v_img is not null and v_img !~* '^https?://' then
        raise exception 'A picture has to be an http(s) link';
    end if;

    v_head := left(v_head, 140);
    v_stand := left(v_stand, 240);
    v_body := left(v_body, 6000);
    v_cap := left(coalesce(v_cap, ''), 200);

    if v_img is not null then v_img := left(v_img, 2048); end if;

    return jsonb_build_object(
        'headline', v_head,
        'standfirst', v_stand,
        'body', v_body,
        'image', v_img,
        'caption', nullif(v_cap, '')
    );

end;
$function$;


-- ---------------------------------------------------------
-- 3. what every screen reads
-- ---------------------------------------------------------

create or replace function public.news_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_editor boolean;
    v_lead text;
    v_desks jsonb := '{}'::jsonb;
    v_one jsonb;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    v_editor := public.news_is_editor();
    v_lead := public.news_leader_faction();

    /* the two chairs, so the paper can sign a dispatch with the office */
    if to_regclass('public.cg_state') is not null then
        select jsonb_build_object('authority', p.username)
        into v_one
        from public.cg_state as s
        join public.players as p on p.id = s.president_player
        where s.id = 1;

        if v_one is not null then v_desks := v_desks || v_one; end if;
    end if;

    if to_regclass('public.cs_state') is not null then
        select jsonb_build_object('combine', p.username)
        into v_one
        from public.cs_state as s
        join public.players as p on p.id = s.secretary_player
        where s.id = 1;

        if v_one is not null then v_desks := v_desks || v_one; end if;
    end if;

    return jsonb_build_object(

        'now', now(),
        'is_editor', v_editor,
        'leader', v_lead,
        'office', public.news_office(v_lead),
        'me', (select p.username from public.players as p where p.id = me),
        'my_faction', (select p.faction from public.players as p where p.id = me),
        'desks', v_desks,

        /* the front page: what actually went to print */
        'published', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', a.id,
                       'headline', a.headline,
                       'standfirst', a.standfirst,
                       'body', a.body,
                       'image', a.image_url,
                       'caption', a.image_caption,
                       'by', a.author_name,
                       'office', public.news_office(case when a.author_role = 'leader' then a.faction else null end),
                       'role', a.author_role,
                       'faction', a.faction,
                       'pinned', a.pinned,
                       'published_at', a.published_at,
                       'edited', (a.edited_at is not null),
                       'mine', (a.author_id = me))
                   order by a.pinned desc, a.published_at desc nulls last, a.submitted_at desc)
            from public.news_articles as a
            where a.status = 'published'
        ), '[]'::jsonb),

        /* the editor's tray: only the editor sees what is waiting */
        'tray', case when v_editor then coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', a.id,
                       'headline', a.headline,
                       'standfirst', a.standfirst,
                       'body', a.body,
                       'image', a.image_url,
                       'caption', a.image_caption,
                       'by', a.author_name,
                       'office', public.news_office(a.faction),
                       'faction', a.faction,
                       'submitted_at', a.submitted_at)
                   order by a.submitted_at)
            from public.news_articles as a
            where a.status = 'pending'
        ), '[]'::jsonb) else '[]'::jsonb end,

        'waiting', case when v_editor then (
            select count(*) from public.news_articles as a where a.status = 'pending'
        ) else 0 end,

        /* a leader's own desk: what they filed, and what became of it */
        'mine', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'id', a.id,
                       'headline', a.headline,
                       'standfirst', a.standfirst,
                       'body', a.body,
                       'image', a.image_url,
                       'caption', a.image_caption,
                       'status', a.status,
                       'note', a.note,
                       'submitted_at', a.submitted_at)
                   order by a.submitted_at desc)
            from public.news_articles as a
            where a.author_id = me
              and a.status in ('pending', 'refused', 'draft')
        ), '[]'::jsonb),

        /* and what the editor has already printed of theirs */
        'my_published', case when v_editor then 0 else coalesce((
            select count(*) from public.news_articles as a
            where a.author_id = me and a.status = 'published'
        ), 0) end

    );

end;
$function$;


-- ---------------------------------------------------------
-- 4. the editor's desk
-- ---------------------------------------------------------

/*
   The editor writes, and edits anything already in the paper — a
   commander's dispatch included. A dispatch keeps the byline of the
   desk that filed it; only the words are the editor's to change.
*/
create or replace function public.news_write(
    p_headline text,
    p_standfirst text default '',
    p_body text default '',
    p_image_url text default null,
    p_image_caption text default null,
    p_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v jsonb;
    v_name text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not public.news_is_editor() then
        raise exception 'Only the host writes the front page';
    end if;

    v := public.news_cleaned(p_headline, p_standfirst, p_body, p_image_url, p_image_caption);

    if p_id is null then

        select p.username into v_name from public.players as p where p.id = me;

        insert into public.news_articles
            (author_id, author_name, author_role, faction, headline, standfirst, body,
             image_url, image_caption, status, published_at)
        values
            (me, coalesce(v_name, 'The editor'), 'editor', null, v->>'headline', v->>'standfirst',
             v->>'body', v->>'image', v->>'caption', 'published', now());

    else

        update public.news_articles as a
        set headline = v->>'headline',
            standfirst = v->>'standfirst',
            body = v->>'body',
            image_url = v->>'image',
            image_caption = v->>'caption',
            status = 'published',
            note = null,
            edited_at = now(),
            published_at = coalesce(a.published_at, now())
        where a.id = p_id;

        if not found then
            raise exception 'That story is not in the paper';
        end if;

    end if;

    return public.news_state();

end;
$function$;


/* a dispatch from a faction leader goes to the front page */
create or replace function public.news_publish(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not public.news_is_editor() then
        raise exception 'Only the host allows a dispatch into the paper';
    end if;

    update public.news_articles as a
    set status = 'published',
        note = null,
        published_at = now()
    where a.id = p_id and a.status <> 'published';

    if not found then
        raise exception 'That dispatch is not in the tray';
    end if;

    return public.news_state();

end;
$function$;


/* and a refusal carries the editor's note back to the desk that filed it */
create or replace function public.news_refuse(p_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_note text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not public.news_is_editor() then
        raise exception 'Only the host turns a dispatch away';
    end if;

    update public.news_articles as a
    set status = 'refused',
        note = v_note,
        edited_at = now()
    where a.id = p_id and a.status = 'pending';

    if not found then
        raise exception 'That dispatch is not in the tray';
    end if;

    return public.news_state();

end;
$function$;


/* off the front page, kept in the drawer: the editor may print it again */
create or replace function public.news_spike(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not public.news_is_editor() then
        raise exception 'Only the host takes a story off the front page';
    end if;

    update public.news_articles as a
    set status = 'draft', edited_at = now()
    where a.id = p_id and a.status = 'published';

    if not found then
        raise exception 'That story is not on the front page';
    end if;

    return public.news_state();

end;
$function$;


/* the lead story: pinned ones stand above the rest, newest first */
create or replace function public.news_pin(p_id uuid, p_pinned boolean default true)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not public.news_is_editor() then
        raise exception 'Only the host decides the lead story';
    end if;

    update public.news_articles as a
    set pinned = coalesce(p_pinned, true), edited_at = now()
    where a.id = p_id and a.status = 'published';

    if not found then
        raise exception 'That story is not on the front page';
    end if;

    return public.news_state();

end;
$function$;


create or replace function public.news_remove(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not public.news_is_editor() then
        raise exception 'Only the host burns a story';
    end if;

    delete from public.news_articles as a where a.id = p_id;

    if not found then
        raise exception 'That story is not in the paper';
    end if;

    return public.news_state();

end;
$function$;


/* ---------------------------------------------------------
   5. the leaders' desks
   --------------------------------------------------------- */

/*
   A leader files a dispatch. It waits: no commander's words reach the
   front page without the editor's yes. Five waiting at a time is the
   whole allowance, so one desk cannot bury the tray.
*/
create or replace function public.news_file(
    p_headline text,
    p_standfirst text default '',
    p_body text default '',
    p_image_url text default null,
    p_image_caption text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_name text;
    v jsonb;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if public.news_is_editor() then
        raise exception 'The editor writes the paper directly';
    end if;

    v_faction := public.news_leader_faction();

    if v_faction is null then
        raise exception 'Only a faction leader files a dispatch';
    end if;

    if (select count(*) from public.news_articles as a
         where a.author_id = me and a.status = 'pending') >= 5 then
        raise exception 'Five of your dispatches are already waiting: wait for the editor';
    end if;

    v := public.news_cleaned(p_headline, p_standfirst, p_body, p_image_url, p_image_caption);

    select p.username into v_name from public.players as p where p.id = me;

    insert into public.news_articles
        (author_id, author_name, author_role, faction, headline, standfirst, body,
         image_url, image_caption, status)
    values
        (me, coalesce(v_name, 'A commander'), 'leader', v_faction, v->>'headline',
         v->>'standfirst', v->>'body', v->>'image', v->>'caption', 'pending');

    return public.news_state();

end;
$function$;


/*
   A leader may take back what they filed while it is still waiting, or
   after the editor turned it down. What has been printed is the paper's,
   and only the editor touches it.
*/
create or replace function public.news_withdraw(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
begin

    if me is null then raise exception 'Not authenticated'; end if;

    delete from public.news_articles as a
    where a.id = p_id
      and a.author_id = me
      and a.status <> 'published';

    if not found then
        raise exception 'That dispatch is not yours to take back';
    end if;

    return public.news_state();

end;
$function$;


/*
   The reset empties the trays. A dispatch filed against the last war is
   nothing but a yellowed clipping, and the two leaders of the new one
   have not written a word. The archive of printed papers stays.
*/
create or replace function public.news_clear_trays()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_cleared integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not public.news_is_editor() then
        raise exception 'Only the host empties the trays';
    end if;

    delete from public.news_articles as a where a.status <> 'published';

    get diagnostics v_cleared = row_count;

    return jsonb_build_object('cleared', v_cleared, 'printed',
        (select count(*) from public.news_articles as a where a.status = 'published'));

end;
$function$;


-- ---------------------------------------------------------
-- 6. the picture desk (only where the project has storage)
--
-- A picture travels either as a link the author pastes, or as an
-- upload into the public "news" bucket. If this project has no
-- storage, or the SQL editor is not allowed to write its policies,
-- everything else still works and the paper says to use a link.
-- ---------------------------------------------------------

do $do$
begin

    if to_regclass('storage.buckets') is null then
        raise notice 'No storage in this project: pictures go on the page by link.';
        return;
    end if;

    begin

        insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        values ('news', 'news', true, 5242880,
                array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
        on conflict (id) do update
            set public = true,
                file_size_limit = 5242880,
                allowed_mime_types = excluded.allowed_mime_types;

        /* the editor and the two leaders may put a picture in it */
        drop policy if exists news_pictures_add on storage.objects;
        create policy news_pictures_add on storage.objects
            for insert to authenticated
            with check (bucket_id = 'news'
                        and (public.news_is_editor() or public.news_leader_faction() is not null));

        drop policy if exists news_pictures_change on storage.objects;
        create policy news_pictures_change on storage.objects
            for update to authenticated
            using (bucket_id = 'news'
                   and (public.news_is_editor() or public.news_leader_faction() is not null));

        drop policy if exists news_pictures_read on storage.objects;
        create policy news_pictures_read on storage.objects
            for select to anon, authenticated
            using (bucket_id = 'news');

        raise notice 'The "news" bucket holds the paper''s pictures.';

    exception when others then
        raise notice 'The picture bucket could not be set up from here (%). '
                     'Create a public bucket named "news" in Storage if you want to upload '
                     'pictures; a pasted link works either way.', sqlerrm;
    end;

end
$do$;


-- ---------------------------------------------------------
-- 7. the closing readout
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.tables
      where table_schema = 'public' and table_name = 'news_articles') as news_tables,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('news_is_editor', 'news_leader_faction', 'news_office', 'news_cleaned',
                             'news_state', 'news_write', 'news_publish', 'news_refuse', 'news_spike',
                             'news_pin', 'news_remove', 'news_file', 'news_withdraw',
                             'news_clear_trays')) as news_functions,
    (select count(*) from public.news_articles) as stories,
    (select count(*) from public.news_articles as a where a.status = 'published') as printed,
    (select count(*) from public.game_control as g
      join public.players as p on p.id = g.host_player
     where g.id = 1) as editors;
