-- =========================================================
-- GALACTIC FRONT — THE SLAVE ROUTES
--
-- Run AFTER sql/2026-11-32_the_hull_counts.sql, in the
-- Supabase SQL editor (SQL > New query). Safe to run more
-- than once, and after every other patch.
--
-- WHAT THIS CHANGES
--
--   Every load that sails is a trip, and every trip is a route.
--   The server now keeps them: from which world, to which
--   world, how many crossings, how many Tusken carried, and
--   when the last one left.
--
--   The galactic map asks public.tusken_trade_routes() for the
--   busiest eight of ITS OWN faction — the function filters by
--   the caller's faction and by nothing else, so one side can
--   never see the other's lanes, not even by reading the
--   answer of the call. A route with more crossings is drawn
--   thicker, and the three busiest are marked as major.
--
--   The crossings already on the record are counted once, when
--   this patch runs, so a save keeps the history it has.
--
--   The host's RESET button wipes the routes with everything
--   else on Tuskara.
-- =========================================================


-- ---------------------------------------------------------
-- 1. the book of routes
-- ---------------------------------------------------------

create table if not exists public.tusken_routes (
    faction text not null,
    from_planet text not null,
    to_planet text not null,
    trips bigint not null default 0,
    slaves bigint not null default 0,
    first_sail timestamptz not null default now(),
    last_sail timestamptz not null default now(),
    primary key (faction, from_planet, to_planet)
);

alter table public.tusken_routes enable row level security;

create index if not exists tusken_routes_faction on public.tusken_routes (faction, trips desc);


-- ---------------------------------------------------------
-- 2. every load that sails is a trip
-- ---------------------------------------------------------

create or replace function public.tusken_route_sailed()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin

    if new.faction is null or new.from_planet is null or new.to_planet is null then
        return new;
    end if;

    insert into public.tusken_routes
        (faction, from_planet, to_planet, trips, slaves, first_sail, last_sail)
    values
        (new.faction, new.from_planet, new.to_planet, 1, coalesce(new.amount, 0), now(), now())
    on conflict (faction, from_planet, to_planet) do update
    set trips = tusken_routes.trips + 1,
        slaves = tusken_routes.slaves + coalesce(excluded.slaves, 0),
        last_sail = now();

    return new;

end;
$function$;


drop trigger if exists tusken_routes_sailed on public.tusken_convoys;

create trigger tusken_routes_sailed
after insert on public.tusken_convoys
for each row
execute function public.tusken_route_sailed();


/* the crossings already on the record, counted once */
insert into public.tusken_routes
    (faction, from_planet, to_planet, trips, slaves, first_sail, last_sail)
select c.faction,
       c.from_planet,
       c.to_planet,
       count(*),
       coalesce(sum(c.amount), 0),
       min(c.departed_at),
       max(c.departed_at)
from public.tusken_convoys as c
where c.faction is not null
  and c.from_planet is not null
  and c.to_planet is not null
group by c.faction, c.from_planet, c.to_planet
on conflict (faction, from_planet, to_planet) do nothing;


-- ---------------------------------------------------------
-- 3. what the map is allowed to see: its own lanes
-- ---------------------------------------------------------

create or replace function public.tusken_trade_routes()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    v_best bigint;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    if v_faction is null then
        raise exception 'This account is not part of the war';
    end if;

    select coalesce(max(r.trips), 0) into v_best
    from public.tusken_routes as r
    where r.faction = v_faction;

    return jsonb_build_object(
        'me', v_faction,
        'best', coalesce(v_best, 0),

        /* only this faction's lanes, busiest first, eight at most */
        'routes', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'from', t.from_planet,
                       'to', t.to_planet,
                       'trips', t.trips,
                       'slaves', t.slaves,
                       'x1', t.x1,
                       'y1', t.y1,
                       'x2', t.x2,
                       'y2', t.y2,
                       'weight', case when v_best > 0
                                      then round(t.trips::numeric / v_best, 3)
                                      else 0 end,
                       'major', t.rank <= 3
                   ) order by t.rank)
            from (
                select ranked.*
                from (
                    select r.from_planet, r.to_planet, r.trips, r.slaves, r.last_sail,
                           pp1.x as x1, pp1.y as y1, pp2.x as x2, pp2.y as y2,
                           row_number() over (order by r.trips desc, r.last_sail desc) as rank
                    from public.tusken_routes as r
                    join public.planet_positions as pp1 on pp1.name = r.from_planet
                    join public.planet_positions as pp2 on pp2.name = r.to_planet
                    where r.faction = v_faction
                ) as ranked
                order by ranked.rank
                limit 8
            ) as t
        ), '[]'::jsonb)
    );

end;
$function$;


-- ---------------------------------------------------------
-- 4. the host's RESET button
-- ---------------------------------------------------------

create or replace function public.tusken_world_reset()
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

    delete from public.tusken_convoys;
    delete from public.tusken_workforce;
    delete from public.tusken_colonies;
    delete from public.tusken_ships;
    delete from public.tusken_intel;
    delete from public.tusken_routes;
    delete from public.fleets where transport_fleet;

    return jsonb_build_object('ok', true);

end;
$function$;


-- ---------------------------------------------------------
-- sanity output
-- ---------------------------------------------------------

select (select count(*) from public.tusken_routes) as routes,
       (select coalesce(sum(trips), 0) from public.tusken_routes) as trips,
       (select count(*) from public.tusken_routes where faction = 'Combine') as combine_routes,
       (select count(*) from public.tusken_routes where faction = 'Freedom Authority') as freedom_routes;
