-- =========================================================
-- GALACTIC FRONT — the leader names the ministers
--
-- Run in the Supabase SQL editor AFTER
-- 2026-11-23_one_delegate_one_ministry.sql.
-- Safe to run more than once.
--
-- The choice belongs to the faction's leader: the President
-- of the Freedom Authority, the High Commissar of the
-- Combine. Until now that was also the ONLY way it could
-- happen, so while the office stood empty — no election yet,
-- a term that ended, a reset — nobody at all could name a
-- holder and the screen offered no picker to anybody.
--
-- Now: the leader chooses while the office is held, and while
-- it is EMPTY any player of that faction may fill the
-- ministries. A member of the other faction never may.
--
-- Nothing else changes: one holder per ministry, the holder
-- acts on his own once a term, and the effect still comes
-- from his loyalty and his party's standing.
-- =========================================================


create or replace function public.cg_assign_ministry(p_post text, p_member integer default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    mem record;
    v_post text := lower(coalesce(p_post, ''));
    v_faction text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not (v_post = any (public.minister_posts())) then
        raise exception 'There is no such ministry';
    end if;

    select * into st from public.cg_state as s where s.id = 1;

    /* the President names them; an empty presidency is filled by the
       Authority's own players, or the chamber would have no ministers at all */
    if st.president_player is not null then

        if st.president_player is distinct from me then
            raise exception 'Only the President of the Freedom Authority chooses the ministers';
        end if;

    else

        select p.faction into v_faction from public.players as p where p.id = me;

        if v_faction is distinct from 'Freedom Authority' then
            raise exception 'Only the Freedom Authority''s own players fill an empty presidency';
        end if;

    end if;

    insert into public.cg_ministers (post) values (v_post)
    on conflict (post) do nothing;

    if p_member is null then

        update public.cg_ministers as x
        set member_id = null, name = null, party_id = null, player_id = null
        where x.post = v_post;

        begin
            perform public.cg_log('MINISTÉRIO: ' || public.minister_name(v_post) ||
                                  ' volta a ser escolhido pela câmara.');
        exception when others then null;
        end;

        return jsonb_build_object('post', v_post, 'holder', null, 'auto', true);

    end if;

    select x.id, x.name, x.faction_id into mem
    from public.cg_members as x
    where x.id = p_member and coalesce(x.active, true);

    if mem.id is null then
        raise exception 'There is no such delegate in the chamber';
    end if;

    if exists (select 1 from public.cg_ministers as o
                where o.post <> v_post and o.member_id = p_member) then
        raise exception '% already holds another ministry: no delegate holds two', mem.name;
    end if;

    /* the post keeps what it did this term: a new hand does not act twice */
    update public.cg_ministers as x
    set member_id = mem.id,
        name = mem.name,
        party_id = mem.faction_id,
        player_id = null
    where x.post = v_post;

    begin
        perform public.cg_log('MINISTÉRIO: ' || mem.name || ' é nomeado para o ' ||
                              public.minister_name(v_post) || '.');
    exception when others then null;
    end;

    return jsonb_build_object('post', v_post, 'member', mem.id, 'holder', mem.name,
                              'party', mem.faction_id);

end;
$function$;


create or replace function public.cs_assign_ministry(p_post text, p_member integer default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    mem record;
    v_post text := lower(coalesce(p_post, ''));
    v_faction text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    if not (v_post = any (public.cs_minister_posts())) then
        raise exception 'There is no such commissariat';
    end if;

    select * into st from public.cs_state as s where s.id = 1;

    if st.secretary_player is not null then

        if st.secretary_player is distinct from me then
            raise exception 'Only the High Commissar chooses the commissars of the ministries';
        end if;

    else

        select p.faction into v_faction from public.players as p where p.id = me;

        if v_faction is distinct from 'Combine' then
            raise exception 'Only the Combine''s own players fill an empty commissariat';
        end if;

    end if;

    insert into public.cs_ministers (post) values (v_post)
    on conflict (post) do nothing;

    if p_member is null then

        update public.cs_ministers as x
        set member_id = null, name = null, current_id = null, player_id = null
        where x.post = v_post;

        begin
            perform public.cs_log('MINISTÉRIO: ' || public.cs_minister_name(v_post) ||
                                  ' volta a ser escolhido pelo plenário.');
        exception when others then null;
        end;

        return jsonb_build_object('post', v_post, 'holder', null, 'auto', true);

    end if;

    select x.id, x.name, x.current_id into mem
    from public.cs_commissars as x
    where x.id = p_member and coalesce(x.active, true);

    if mem.id is null then
        raise exception 'There is no such commissar in the plenum';
    end if;

    if exists (select 1 from public.cs_ministers as o
                where o.post <> v_post and o.member_id = p_member) then
        raise exception '% already holds another commissariat: no commissar holds two', mem.name;
    end if;

    update public.cs_ministers as x
    set member_id = mem.id,
        name = mem.name,
        current_id = mem.current_id,
        player_id = null
    where x.post = v_post;

    begin
        perform public.cs_log('MINISTÉRIO: ' || mem.name || ' é nomeado para o ' ||
                              public.cs_minister_name(v_post) || '.');
    exception when others then null;
    end;

    return jsonb_build_object('post', v_post, 'member', mem.id, 'holder', mem.name,
                              'party', mem.current_id);

end;
$function$;


-- ---------------------------------------------------------
-- closing readout
-- ---------------------------------------------------------

select
    (select count(*) from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('cg_assign_ministry', 'cs_assign_ministry')) as pickers,
    (select president_player from public.cg_state where id = 1) as president,
    (select secretary_player from public.cs_state where id = 1) as high_commissar,
    'an empty office is filled by the faction''s own players' as rule;
