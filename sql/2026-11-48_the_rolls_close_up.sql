/* =========================================================
   GALACTIC FRONT — a lost fleet leaves its place behind
   ---------------------------------------------------------
   A fleet that loses every unit is destroyed, and the place it held must
   come back to its side:

     * the Combine's ceiling was a count of the fleets in service, so a
       fleet lost lowered the ceiling with it and the next one still needed
       a fresh quota off the Soviet. A lost fleet now leaves a replacement
       waiting: no directive, no bill, the place is already paid for.

     * the Freedom Authority needed a new "Authorize New Fleet
       Construction" bill to replace a fleet it had just lost. It no longer
       does: Congress voted for that fleet once, and a replacement is that
       vote being spent. Any fleet beyond the ones it has lost still needs
       its own bill.

   A fleet that is nothing but an empty hull on the books (no squads left)
   is not counted as being in service either, so it does not hold a place
   while it waits to be struck off.

   Only warships count: a cargo fleet is a bottom, not a command, and the
   resets that sweep the transport fleets away are not losses.

   Safe to run more than once. It can run with maintenance on or off.
   Run it after 2026-11-47.
========================================================= */

-- ---------------------------------------------------------
-- 1. the counter
-- ---------------------------------------------------------

alter table public.faction_treasury
    add column if not exists fleet_losses integer not null default 0;


-- ---------------------------------------------------------
-- 2. a fleet leaving the rolls is a place given back
-- ---------------------------------------------------------

create or replace function public.fleets_count_the_loss()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_before integer;
    v_after integer;
begin

    /* a cargo fleet is not a command */
    if coalesce(old.transport_fleet, false) then return null; end if;

    /* a fleet still on the slipway was never in the line */
    if coalesce(old.status::text, '') = 'building' then return null; end if;

    if old.faction is null then return null; end if;

    v_before := case when jsonb_typeof(old.squads) = 'array' then jsonb_array_length(old.squads) else 0 end;

    /* only a fleet that had units can be lost */
    if v_before = 0 then return null; end if;

    if tg_op = 'UPDATE' then

        if coalesce(new.transport_fleet, false) then return null; end if;

        v_after := case when jsonb_typeof(new.squads) = 'array' then jsonb_array_length(new.squads) else 0 end;

        /* still fighting, or reinforced: nothing was lost */
        if v_after > 0 then return null; end if;

    end if;

    update public.faction_treasury as ft
    set fleet_losses = coalesce(ft.fleet_losses, 0) + 1
    where ft.faction = old.faction;

    return null;

end;
$function$;

drop trigger if exists fleets_count_the_loss on public.fleets;

create trigger fleets_count_the_loss
after delete or update of squads on public.fleets
for each row execute function public.fleets_count_the_loss();


/* the host's RESET empties the book, replacements included */
create or replace function public.fleet_replacements_reset()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_host boolean;
    v_rows integer;
begin

    select (g.host_player is not null and g.host_player = auth.uid())
    into v_host
    from public.game_control as g
    where g.id = 1;

    if not coalesce(v_host, false) then
        raise exception 'Only the host resets the game';
    end if;

    update public.faction_treasury set fleet_losses = 0;

    get diagnostics v_rows = row_count;

    return jsonb_build_object('ok', true, 'treasuries', v_rows);

end;
$function$;


-- ---------------------------------------------------------
-- 3. the fleet menu: the ceiling, the quotas and the places given back
-- ---------------------------------------------------------

create or replace function public.cs_fleet_quota()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_fleets integer;
    v_building integer;
    v_empty integer;
    v_quotas integer;
    v_mine integer;
    v_losses integer;
    v_price integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    /* a fleet with no squads left is a wreck on the books: it holds no place */
    select count(*) filter (where coalesce(f.status::text, '') <> 'building'
                              and (case when jsonb_typeof(f.squads) = 'array'
                                        then jsonb_array_length(f.squads) else 0 end) > 0),
           count(*) filter (where coalesce(f.status::text, '') = 'building'),
           count(*) filter (where coalesce(f.status::text, '') <> 'building'
                              and (case when jsonb_typeof(f.squads) = 'array'
                                        then jsonb_array_length(f.squads) else 0 end) = 0)
    into v_fleets, v_building, v_empty
    from public.fleets as f
    where f.faction = coalesce(v_faction, 'Combine');

    /* the ceiling the Soviet has granted is the faction's, like the header's */
    select count(*) into v_quotas
    from public.cs_authorizations as a
    where a.kind = 'fleet' and not a.used;

    /* but only a quota of your own (or one nobody claimed) may be spent by you */
    select count(*) into v_mine
    from public.cs_authorizations as a
    where a.kind = 'fleet' and not a.used
      and (a.player_id = me or a.player_id is null);

    select coalesce(ft.fleets_built, 0), coalesce(ft.fleet_losses, 0)
    into v_price, v_losses
    from public.faction_treasury as ft
    where ft.faction = v_faction;

    return jsonb_build_object(
        'combine', coalesce(v_faction, '') = 'Combine',
        'fleets', v_fleets,
        'building', v_building,
        'empty', v_empty,
        'quotas', v_quotas,
        'mine', v_mine,
        'losses', v_losses,
        'max', v_fleets + v_building + v_quotas + v_losses,
        'next_price', 500 * (1 + coalesce(v_price, 0)),
        'can_build', coalesce(v_faction, '') <> 'Combine' or (v_mine + v_losses) > 0
    );

end;
$function$;


-- ---------------------------------------------------------
-- 4. building a fleet: a lost one is replaced without a vote
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
    v_losses integer;
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

    select ft.credits, ft.fleets_built, coalesce(ft.fleet_losses, 0)
    into v_credits, v_built, v_losses
    from public.faction_treasury as ft
    where ft.faction = v_faction
    for update;

    if v_credits is null then
        raise exception 'Faction treasury not found';
    end if;

    v_price := 500 * (1 + v_built);

    /*
       Freedom Authority: a bill that has not been spent comes first and the
       chamber has already paid for the hull. Without one, a fleet the
       Authority has lost is replaced on the same vote: the place is already
       paid for, so only the yard is paid now.
    */
    if v_faction = 'Freedom Authority' then

        select a.id into v_auth from public.cg_authorizations as a
        where a.kind = 'fleet'
          and (a.player_id = current_player or a.player_id is null)
          and not a.used
        order by a.id limit 1 for update;

        if v_auth is not null then

            update public.cg_authorizations as a
            set used = true, used_at = now(), player_id = coalesce(a.player_id, current_player)
            where a.id = v_auth;

            v_price := 0;

        elsif v_losses > 0 then

            update public.faction_treasury as ft
            set fleet_losses = coalesce(ft.fleet_losses, 0) - 1
            where ft.faction = v_faction;

            v_losses := v_losses - 1;

        else

            raise exception 'Congress has not authorized a new fleet: put "Authorize New Fleet Construction" before Congress first';

        end if;

    end if;

    /* Combine: the Supreme Soviet's quota first, then a place a lost fleet left behind */
    if v_faction = 'Combine' then

        select a.id into v_auth from public.cs_authorizations as a
        where a.kind = 'fleet'
          and (a.player_id = current_player or a.player_id is null)
          and not a.used
        order by a.id limit 1 for update;

        if v_auth is not null then

            update public.cs_authorizations as a
            set used = true, used_at = now(), player_id = coalesce(a.player_id, current_player)
            where a.id = v_auth;

        elsif v_losses > 0 then

            update public.faction_treasury as ft
            set fleet_losses = coalesce(ft.fleet_losses, 0) - 1
            where ft.faction = v_faction;

            v_losses := v_losses - 1;

        else

            raise exception 'The Supreme Soviet has not authorised a new fleet: put a "Cota de nova frota" directive before it first';

        end if;

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
-- sanity output
-- ---------------------------------------------------------

select
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'faction_treasury'
        and column_name = 'fleet_losses') as losses_column,
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('fleets_count_the_loss', 'fleet_replacements_reset',
                             'create_fleet', 'cs_fleet_quota')) as functions,
    (select count(*) from public.faction_treasury where coalesce(fleet_losses, 0) > 0) as treasuries_owing_replacements;
