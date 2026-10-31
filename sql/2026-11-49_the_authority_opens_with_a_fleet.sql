-- =========================================================
-- GALACTIC FRONT — the Authority opens the war with a fleet too
--
-- Run in the Supabase SQL editor after 2026-11-48. Safe to run more than once.
--
-- THE UNFAIRNESS THIS CLOSES
--   game_opening_quotas() hands the Combine the Soviet's own opening at
--   the start of a war and again after the reset: three fleets' worth of
--   quota, granted by the Party to itself, with no directive and no vote.
--   The Freedom Authority had nothing on that side of the ledger. Its
--   first fleet had to wait on a Congress that was not even seated (no
--   President until the first election) and on a treasury that could only
--   just pay the opening bill of 500. One side could build on the first
--   minute of the war and the other could not.
--
-- WHAT THIS FILE DOES
--   The same function now grants the Authority one fleet authorisation
--   as well. It is an ordinary Congress authorisation: it sits in
--   cg_authorizations with no owner, so the first commander of the
--   Authority to build claims it (create_fleet already accepts one with
--   player_id null), it needs no President and no vote, and it is spent
--   the moment it is used.
--
--   It is granted only while the Authority owns no fleet at all and has
--   no authorisation already waiting, so calling the function twice in
--   the same war changes nothing, and a war in which the Authority has
--   already built its fleet never sees a second one.
--
--   A fleet lost in battle is a different matter: 2026-11-48 gives the
--   place back as a replacement, so this opening never has to fire again
--   for a lost fleet.
-- =========================================================


create or replace function public.game_opening_quotas()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_fleets integer := 0;
    v_open integer := 0;
    v_grant integer;
    v_made integer := 0;
    /* the Authority's own opening */
    v_cg_fleets integer := 0;
    v_cg_open integer := 0;
    v_cg_made integer := 0;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        raise exception 'The game has not started';
    end if;

    /* no fleet book at all: nothing can be granted, and the reset stands */
    if to_regclass('public.fleets') is null then
        return jsonb_build_object('granted', 0, 'floor', public.cs_fleet_floor(), 'authority', 0);
    end if;

    /* a database without the Soviet's fleet book keeps the game's own rules
       and says so, instead of failing the start */
    if to_regclass('public.cs_authorizations') is not null then

        select count(*) into v_fleets
        from public.fleets as f
        where f.faction = 'Combine'
          and coalesce(f.status::text, '') <> 'building';

        select count(*) into v_open
        from public.cs_authorizations as a
        where a.kind = 'fleet' and not a.used;

        v_grant := greatest(0, public.cs_fleet_floor() - v_fleets - v_open);

        while v_grant > 0 loop
            insert into public.cs_authorizations (kind, player_id) values ('fleet', null);
            v_grant := v_grant - 1;
            v_made := v_made + 1;
        end loop;

        if v_made > 0 then
            begin
                perform public.cs_log('PLANO: o Soviete abre a guerra com ' || public.cs_fleet_floor() ||
                                      ' cotas de frota (' || v_made || ' entregues agora).');
            exception when others then null;
            end;
        end if;

    end if;

    /*
       THE AUTHORITY'S OPENING.

       While it owns no fleet at all and has no bill already waiting, one
       fleet authorisation opens the war with it: no President, no vote, no
       500-credit opening bill in the way. Whoever of the Authority builds
       first claims it.
    */
    if to_regclass('public.cg_authorizations') is not null then

        select count(*) into v_cg_fleets
        from public.fleets as f
        where f.faction = 'Freedom Authority';

        select count(*) into v_cg_open
        from public.cg_authorizations as a
        where a.kind = 'fleet' and not a.used;

        if v_cg_fleets = 0 and v_cg_open = 0 then

            insert into public.cg_authorizations (kind, player_id, used)
            values ('fleet', null, false);

            v_cg_made := 1;

            begin
                perform public.cg_log('CONGRESSO: a guerra abre com uma autorização de frota para a Autoridade: o primeiro comandante que a construir toma-a para si.');
            exception when others then null;
            end;

        end if;

    end if;

    return jsonb_build_object(
        'granted', v_made,
        'floor', public.cs_fleet_floor(),
        'fleets', v_fleets,
        'quotas', v_open + v_made,
        'authority', v_cg_made,
        'authority_fleets', v_cg_fleets
    );

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from public.cg_authorizations as a where a.kind = 'fleet' and not a.used) as authorisations_waiting,
    (select count(*) from public.cs_authorizations as a where a.kind = 'fleet' and not a.used) as quotas_waiting,
    (select count(*) from public.fleets as f where f.faction = 'Freedom Authority') as authority_fleets,
    (select exists (select 1 from information_schema.routines
                    where routine_schema = 'public' and routine_name = 'game_opening_quotas')) as function_ready;
