-- =========================================================
-- GALACTIC FRONT — a battle in a quiet orbit, a dock to come
-- home to, unrest on the worlds you took, and two chairs
-- instead of one
--
-- Run this in the Supabase SQL editor (SQL > New query).
-- Safe to run more than once, and after every other patch.
--
-- What it changes:
--
--   1. NEUTRAL ORBITS ARE NOT SAFE ANY MORE. Two rival fleets
--      sitting in the orbit of an independent world used to
--      stare at each other for ever: battles only started in
--      deep space, or when somebody assaulted a planet. A scan
--      now pairs them up and starts the orbit battle, which the
--      space screen already knows how to fight.
--
--   2. DAMAGED FLEETS CAN BE REPAIRED. Battles leave squads
--      under strength and nothing ever brought them back: the
--      survivors could only be reinforced by recruiting over
--      them. A fleet in orbit of a world it holds can now be
--      brought back to its full establishment for credits, at
--      40 credits per 1000 missing soldiers.
--
--   3. THE CONGRESS'S TAX LEVEL PAYS. The tax meter started
--      empty, and "now minus nothing" is nothing, so every
--      congress tick decided no quarter hour had passed. The
--      meter is started and the reading made safe.
--
--   4. CONQUERED WORLDS HAVE AN UNREST BAR. A world taken by
--      force resents it: unrest climbs, eats the occupation's
--      stability, and at 100 the world rises and throws both
--      flags off. The bar is on the occupied-world screens.
--
--   5. TWO PRESIDENTS. The Freedom Authority's elected
--      president is its FACTION LEADER again (five proposals,
--      state initiatives, the ruling party's agenda); the
--      Congress elects its own PRESIDENT, who leads the
--      chamber and holds the veto. Two offices, two elections,
--      two terms.
-- =========================================================


-- =========================================================
-- 1. a battle in a neutral orbit
-- =========================================================

/*
   Two fleets of the two main factions, both stationed in orbit of
   a world that belongs to nobody: they fight. The base game's own
   orbit routine is tried first (it knows the battle tables best);
   if it is not there, the battle is written here in the same shape
   the deep-space scan uses. Either way the battle is an ordinary
   orbit battle: the space screen joins it, fights it and hands the
   orbit to the winner.
*/
create or replace function public.orbit_battle_scan()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    pr record;
    fa record;
    fb record;
    v_used uuid[] := '{}';
    v_out jsonb := '[]'::jsonb;
    v_id uuid;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        return v_out;
    end if;

    if public.game_frozen() then
        return v_out;
    end if;

    if not pg_try_advisory_xact_lock(7770004) then
        return v_out;
    end if;

    for pr in
        select p.name as planet,
               min(pp.x) as x,
               min(pp.y) as y
        from public.planets as p
        join public.planet_positions as pp on pp.name = p.name
        join public.fleets as f on f.origin = p.name
        where f.status::text = 'stationed'
          and f.faction in ('Freedom Authority', 'Combine')
          and jsonb_typeof(coalesce(f.squads, '[]'::jsonb)) = 'array'
          and jsonb_array_length(coalesce(f.squads, '[]'::jsonb)) > 0
          /* the world is nobody's: every city of it is independent */
          and not exists (select 1 from public.cities as c
                          where c.planet_id = p.id
                            and c.faction in ('Freedom Authority', 'Combine'))
        group by p.name
        having count(distinct f.faction) = 2
        order by p.name
    loop

        /* one live battle per orbit is enough */
        if exists (select 1 from public.space_battles as b
                   where b.kind = 'orbit'
                     and b.planet = pr.planet
                     and b.status in ('pending', 'active')) then
            continue;
        end if;

        select * into fa from public.fleets as f
        where f.origin = pr.planet and f.status::text = 'stationed'
          and f.faction = 'Freedom Authority'
          and f.id <> all (v_used)
          and jsonb_array_length(coalesce(f.squads, '[]'::jsonb)) > 0
        order by f.name
        limit 1;

        select * into fb from public.fleets as f
        where f.origin = pr.planet and f.status::text = 'stationed'
          and f.faction = 'Combine'
          and f.id <> all (v_used)
          and jsonb_array_length(coalesce(f.squads, '[]'::jsonb)) > 0
        order by f.name
        limit 1;

        if fa.id is null or fb.id is null then continue; end if;

        v_id := null;

        /* the base game's own orbit battle, if this database has it */
        begin
            v_id := public.space_battle_start_orbit(fa.id, pr.planet);
        exception when others then v_id := null;
        end;

        if v_id is null then

            begin
                insert into public.space_battles (kind, planet, x, y, status)
                values ('orbit', pr.planet, pr.x, pr.y, 'pending')
                returning id into v_id;

                insert into public.space_battle_fleets
                    (battle_id, fleet_id, side, player_id, faction, fleet_name, prev_status, squads)
                values
                    (v_id, fa.id, 'A', fa.player_id, fa.faction, fa.name, fa.status::text, coalesce(fa.squads, '[]'::jsonb)),
                    (v_id, fb.id, 'D', fb.player_id, fb.faction, fb.name, fb.status::text, coalesce(fb.squads, '[]'::jsonb));

                update public.fleets as f set status = 'engaged', space_x = null, space_y = null
                where f.id in (fa.id, fb.id);
            exception when others then
                v_id := null;
            end;

        end if;

        if v_id is null then continue; end if;

        v_out := v_out || jsonb_build_object('id', v_id, 'planet', pr.planet);
        v_used := v_used || fa.id || fb.id;

        begin
            perform public.cg_log('ORBITA DE ' || upper(pr.planet) || ': forças da Freedom Authority e do Combine encontram-se em órbita neutra. Combate aberto.');
        exception when others then null;
        end;

        begin
            perform public.cs_log('ÓRBITA DE ' || upper(pr.planet) || ': navios da União e da Freedom Authority abrem fogo em órbita neutra.');
        exception when others then null;
        end;

    end loop;

    return v_out;

end;
$function$;


-- =========================================================
-- 2. the dock: repairing a fleet
-- =========================================================

/* the full strength of one division of each kind (the battle screen's own
   numbers, so what the dock restores is what the battle took away) */
create or replace function public.fleet_squad_size(p_type text)
returns integer
language sql
immutable
as $function$
    select case p_type
        when 'Rifle' then 1000
        when 'MG' then 750
        when 'Assault' then 1000
        when 'AT' then 600
        when 'Sniper' then 400
        when 'Tank' then 200
        when 'Artillery' then 250
        when 'Knightmare' then 3
        else 1000
    end
$function$;


/* how much of a fleet is still standing, in soldiers */
create or replace function public.fleet_damage_reading(p_squads jsonb)
returns jsonb
language sql
immutable
as $function$
    select jsonb_build_object(
        'full', coalesce(sum(d.full), 0),
        'left', coalesce(sum(d.left), 0),
        'missing', coalesce(sum(greatest(0, d.full - d.left)), 0),
        'fraction', case when coalesce(sum(d.full), 0) > 0
                         then round(sum(d.left) / sum(d.full), 3)
                         else 1 end
    )
    from (
        select public.fleet_squad_size(e ->> 'type')
                   * greatest(0, coalesce((e ->> 'amount')::numeric, 0)) as full,
               least(
                   public.fleet_squad_size(e ->> 'type')
                       * greatest(0, coalesce((e ->> 'amount')::numeric, 0)),
                   greatest(0, coalesce(
                       nullif(e ->> 'soldiers', '')::numeric,
                       public.fleet_squad_size(e ->> 'type')
                           * greatest(0, coalesce((e ->> 'amount')::numeric, 0))))
               ) as left
        from jsonb_array_elements(coalesce(p_squads, '[]'::jsonb)) as e
    ) as d
$function$;


/* 40 credits the thousand, rounded up, and never less than ten */
create or replace function public.fleet_repair_price(p_missing numeric)
returns integer
language sql
immutable
as $function$
    select case when coalesce(p_missing, 0) <= 0 then 0
                else greatest(10, ceil(coalesce(p_missing, 0) / 25)::integer)
           end
$function$;


create or replace function public.fleet_repair_quote(p_fleet uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    f record;
    d jsonb;
    v_price integer;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into f from public.fleets as x where x.id = p_fleet;
    if f.id is null then raise exception 'There is no such fleet'; end if;

    d := public.fleet_damage_reading(f.squads);
    v_price := public.fleet_repair_price(coalesce((d ->> 'missing')::numeric, 0));

    return jsonb_build_object(
        'fleet', f.id,
        'name', f.name,
        'full', (d ->> 'full')::numeric,
        'left', (d ->> 'left')::numeric,
        'missing', (d ->> 'missing')::numeric,
        'fraction', (d ->> 'fraction')::numeric,
        'price', v_price,
        'mine', f.player_id = me,
        'stationed', f.status::text = 'stationed',
        'can', f.player_id = me and f.status::text = 'stationed' and v_price > 0
    );

end;
$function$;


/*
   The survivors are brought back up to the full establishment of every
   squad they still have. Squadrons that were wiped out are not rebuilt
   here: that is what recruitment is for.
*/
create or replace function public.repair_fleet(p_fleet uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    f record;
    d jsonb;
    v_price integer;
    v_missing numeric;
    v_credits numeric;
    v_squads jsonb;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select * into f from public.fleets as x where x.id = p_fleet for update;
    if f.id is null then raise exception 'There is no such fleet'; end if;
    if f.player_id <> me then raise exception 'You do not command this fleet'; end if;
    if f.status::text <> 'stationed' then
        raise exception 'The fleet has to be stationed in orbit to be repaired';
    end if;

    d := public.fleet_damage_reading(f.squads);
    v_missing := coalesce((d ->> 'missing')::numeric, 0);
    v_price := public.fleet_repair_price(v_missing);

    if v_price <= 0 then
        raise exception 'This fleet is already at full strength';
    end if;

    select coalesce(ft.credits, 0) into v_credits
    from public.faction_treasury as ft where ft.faction = f.faction;

    if coalesce(v_credits, 0) < v_price then
        raise exception 'The dock wants % credits; the % treasury holds %', v_price, f.faction, floor(coalesce(v_credits, 0));
    end if;

    update public.faction_treasury as ft
    set credits = ft.credits - v_price
    where ft.faction = f.faction;

    select jsonb_agg(
               (e - 'soldiers' - 'soldiersPerDivision')
               || jsonb_build_object(
                      'soldiers', public.fleet_squad_size(e ->> 'type')
                                      * greatest(0, coalesce((e ->> 'amount')::numeric, 0)),
                      'soldiersPerDivision', public.fleet_squad_size(e ->> 'type'))
               order by t.ord)
    into v_squads
    from jsonb_array_elements(coalesce(f.squads, '[]'::jsonb)) with ordinality as t(e, ord);

    update public.fleets as x
    set squads = coalesce(v_squads, '[]'::jsonb)
    where x.id = f.id;

    if f.faction = 'Combine' then
        begin
            perform public.cs_log('ESTALEIRO: ' || f.name || ' repara-se em ' || coalesce(f.origin, 'órbita')
                                  || ' — ' || floor(v_missing) || ' soldados repostos por ' || v_price || ' créditos.');
        exception when others then null;
        end;
    else
        begin
            perform public.cg_log('DOCA: ' || f.name || ' é reparada em ' || coalesce(f.origin, 'órbita')
                                  || ' — ' || floor(v_missing) || ' soldados repostos por ' || v_price || ' créditos.');
        exception when others then null;
        end;
    end if;

    d := public.fleet_damage_reading(v_squads);

    return jsonb_build_object(
        'fleet', f.id,
        'name', f.name,
        'paid', v_price,
        'repaired', floor(v_missing),
        'left', (d ->> 'left')::numeric,
        'full', (d ->> 'full')::numeric,
        'fraction', (d ->> 'fraction')::numeric,
        'credits', floor(coalesce(v_credits, 0) - v_price)
    );

end;
$function$;


/* the map's own reading: which of my fleets are under strength */
create or replace function public.fleet_repair_board()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    return coalesce((
        select jsonb_agg(jsonb_build_object(
                   'fleet', f.id,
                   'name', f.name,
                   'origin', f.origin,
                   'status', f.status::text,
                   'missing', (public.fleet_damage_reading(f.squads) ->> 'missing')::numeric,
                   'full', (public.fleet_damage_reading(f.squads) ->> 'full')::numeric,
                   'price', public.fleet_repair_price((public.fleet_damage_reading(f.squads) ->> 'missing')::numeric)
               ) order by f.name)
        from public.fleets as f
        where f.player_id = me
          and coalesce((public.fleet_damage_reading(f.squads) ->> 'missing')::numeric, 0) > 0
    ), '[]'::jsonb);

end;
$function$;


-- =========================================================
-- 3. unrest on the worlds that were taken
-- =========================================================

create table if not exists public.planet_unrest (
    planet text primary key,
    faction text not null,
    unrest numeric not null default 25 check (unrest between 0 and 100),
    revolts integer not null default 0,
    last_turn_at timestamptz not null default now(),
    last_revolt_at timestamptz
);

alter table public.planet_unrest enable row level security;

create index if not exists planet_unrest_faction_idx on public.planet_unrest (faction);


/* one turn of the bar is five minutes, like every other clock here */
create or replace function public.unrest_turn_seconds()
returns integer
language sql
immutable
as $function$ select 300 $function$;


create or replace function public.unrest_revolt_at()
returns numeric
language sql
immutable
as $function$ select 100 $function$;


/*
   Stability lives on the two occupation books (the Congress's and the
   Soviet's), and either may be missing on an old database, so both are
   read defensively.
*/
create or replace function public.occupation_stability(p_planet text)
returns numeric
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v numeric;
begin

    begin
        select max(x.stability) into v from public.cg_occupations as x where x.planet = p_planet;
        if v is not null then return v; end if;
    exception when undefined_table or undefined_column then null;
    end;

    begin
        select max(x.stability) into v from public.cs_occupations as x where x.planet = p_planet;
        if v is not null then return v; end if;
    exception when undefined_table or undefined_column then null;
    end;

    return 60;

end;
$function$;


create or replace function public.occupation_lower_stability(p_planet text, p_by numeric)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin

    if coalesce(p_by, 0) <= 0 then return; end if;

    begin
        update public.cg_occupations as o
        set stability = greatest(0, o.stability - p_by)
        where o.planet = p_planet;
    exception when undefined_table or undefined_column then null;
    end;

    begin
        update public.cs_occupations as o
        set stability = greatest(0, o.stability - p_by)
        where o.planet = p_planet;
    exception when undefined_table or undefined_column then null;
    end;

end;
$function$;


/* every world under an occupation gets a bar (a world integrated by
   treaty never does: it signed) */
create or replace function public.unrest_seed()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin

    begin
        insert into public.planet_unrest (planet, faction, unrest)
        select o.planet,
               (select c.faction
                  from public.cities as c
                  join public.planets as p on p.id = c.planet_id
                 where p.name = o.planet
                   and c.faction in ('Freedom Authority', 'Combine')
                 group by c.faction
                 limit 1),
               25
        from public.cg_occupations as o
        on conflict (planet) do nothing;
    exception when undefined_table or undefined_column then null;
    end;

    begin
        insert into public.planet_unrest (planet, faction, unrest)
        select o.planet,
               (select c.faction
                  from public.cities as c
                  join public.planets as p on p.id = c.planet_id
                 where p.name = o.planet
                   and c.faction in ('Freedom Authority', 'Combine')
                 group by c.faction
                 limit 1),
               25
        from public.cs_occupations as o
        on conflict (planet) do nothing;
    exception when undefined_table or undefined_column then null;
    end;

    /* a world already handed back is not occupied: no bar */
    delete from public.planet_unrest as u
    where not exists (select 1 from public.cities as c
                      join public.planets as p on p.id = c.planet_id
                      where p.name = u.planet
                        and c.faction = u.faction);

end;
$function$;


/*
   Unrest climbs while the occupation's grip is weak: four points a turn
   at zero stability, two at fifty, none at a hundred. What is left of it
   pulls the occupation's stability down by a twentieth of itself, so a
   world that is left to fester undermines its own administration. At a
   hundred the world rises: every city of it goes back to the
   Independents, the occupation is closed and both books hear of it.
*/
create or replace function public.unrest_tick()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    o record;
    v_stab numeric;
    v_turns integer;
    v_delta numeric;
    v_new numeric;
    v_out jsonb := '[]'::jsonb;
    v_text text;
begin

    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        return v_out;
    end if;

    if public.game_frozen() then
        return v_out;
    end if;

    if not pg_try_advisory_xact_lock(7770006) then
        return v_out;
    end if;

    perform public.unrest_seed();

    for o in select * from public.planet_unrest as u order by u.planet for update loop

        v_turns := least(12, floor(extract(epoch from (now() - o.last_turn_at))
                                  / public.unrest_turn_seconds())::integer);

        if v_turns <= 0 then continue; end if;

        v_stab := public.occupation_stability(o.planet);
        v_delta := 4 - floor(least(100, greatest(0, v_stab)) / 25);

        v_new := least(public.unrest_revolt_at(),
                       greatest(0, o.unrest + v_delta * v_turns));

        perform public.occupation_lower_stability(o.planet, floor(v_new / 25));

        if v_new >= public.unrest_revolt_at() then

            update public.cities as c
            set faction = 'Independents'
            where c.planet_id = (select p.id from public.planets as p where p.name = o.planet);

            begin
                delete from public.cg_occupations as x where x.planet = o.planet;
            exception when undefined_table then null;
            end;

            begin
                delete from public.cs_occupations as x where x.planet = o.planet;
            exception when undefined_table then null;
            end;

            delete from public.planet_unrest as u where u.planet = o.planet;

            v_text := 'REVOLTA: ' || o.planet || ' levanta-se contra a ocupação e volta à independência.';

            begin
                perform public.cg_log(v_text);
            exception when others then null;
            end;

            begin
                perform public.cs_log(v_text);
            exception when others then null;
            end;

            v_out := v_out || jsonb_build_object('planet', o.planet, 'revolted', true, 'unrest', 100);

        else

            update public.planet_unrest as u
            set unrest = v_new,
                last_turn_at = u.last_turn_at + v_turns * make_interval(secs => public.unrest_turn_seconds())
            where u.planet = o.planet;

            v_out := v_out || jsonb_build_object('planet', o.planet, 'revolted', false, 'unrest', v_new);

        end if;

    end loop;

    return v_out;

end;
$function$;


create or replace function public.unrest_state()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    /* a world that has just been occupied gets its bar the moment somebody
       looks at the screen, not five minutes later */
    perform public.unrest_seed();

    select p.faction into v_faction from public.players as p where p.id = me;

    return jsonb_build_object(
        'turn', public.unrest_turn_seconds(),
        'revolt_at', public.unrest_revolt_at(),
        'worlds', coalesce((
            select jsonb_agg(jsonb_build_object(
                       'planet', u.planet,
                       'faction', u.faction,
                       'unrest', round(u.unrest),
                       'mood', case when u.unrest >= 80 then 'REVOLT'
                                    when u.unrest >= 55 then 'RIOTING'
                                    when u.unrest >= 30 then 'RESTLESS'
                                    else 'CALM' end,
                       'revolts', u.revolts,
                       'mine', u.faction = v_faction
                   ) order by u.unrest desc, u.planet)
            from public.planet_unrest as u
        ), '[]'::jsonb)
    );

end;
$function$;


-- =========================================================
-- 4. two chairs: the faction leader and the Congress's own president
-- =========================================================

/*
   cg_state.president_player stays what it always was: the elected head
   of the Freedom Authority, its faction leader (five proposals, state
   initiatives, the ruling party's agenda). The chamber elects its own
   president underneath it — the player who runs the floor and holds the
   veto — in a separate book, kept here so the base game's own Congress
   code is not touched.
*/
create table if not exists public.cg_speaker_state (
    id integer primary key default 1 check (id = 1),
    speaker_player uuid,
    speaker_name text,
    speaker_party text,
    term_no integer not null default 0,
    term_end timestamptz,
    veto_used boolean not null default false,
    last_election_at timestamptz
);

insert into public.cg_speaker_state (id) values (1) on conflict (id) do nothing;

create table if not exists public.cg_speaker_election (
    id serial primary key,
    phase text not null default 'campaign' check (phase in ('campaign', 'voting', 'done')),
    campaign_end timestamptz not null,
    vote_end timestamptz not null,
    winner_id uuid,
    winner_name text,
    note text,
    created_at timestamptz not null default now()
);

create table if not exists public.cg_speaker_candidates (
    election_id integer not null,
    player_id uuid not null,
    name text not null default '',
    party text,
    primary key (election_id, player_id)
);

create table if not exists public.cg_speaker_votes (
    election_id integer not null,
    voter uuid not null,
    candidate uuid not null,
    primary key (election_id, voter)
);

alter table public.cg_speaker_state enable row level security;
alter table public.cg_speaker_election enable row level security;
alter table public.cg_speaker_candidates enable row level security;
alter table public.cg_speaker_votes enable row level security;


create or replace function public.cg_speaker_campaign_seconds()
returns integer language sql immutable as $function$ select 480 $function$;

create or replace function public.cg_speaker_vote_seconds()
returns integer language sql immutable as $function$ select 480 $function$;

create or replace function public.cg_speaker_term_seconds()
returns integer language sql immutable as $function$ select 1209600 $function$;  /* two weeks */


create or replace function public.cg_speaker_advance()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
    st record;
    e record;
    v_win record;
begin

    perform public.cg_speaker_seed();

    select * into st from public.cg_speaker_state as s where s.id = 1;
    select * into e from public.cg_speaker_election as x
    where x.phase <> 'done' order by x.id desc limit 1;

    if e.id is null then

        /* an empty chair, or a term that has run out */
        if (st.speaker_player is null or st.term_end is null or st.term_end <= now())
           and (st.last_election_at is null or st.last_election_at < now() - interval '2 minutes')
           and exists (select 1 from public.players as p
                       where p.faction = 'Freedom Authority'
                         and exists (select 1 from public.player_presence as pr
                                     where pr.player_id = p.id
                                       and coalesce(pr.last_seen, pr.last_active, now()) > now() - interval '150 seconds')) then

            insert into public.cg_speaker_election (phase, campaign_end, vote_end)
            values ('campaign',
                    now() + make_interval(secs => public.cg_speaker_campaign_seconds()),
                    now() + make_interval(secs => public.cg_speaker_campaign_seconds()
                                              + public.cg_speaker_vote_seconds()));

            update public.cg_speaker_state as s set last_election_at = now() where s.id = 1;

            begin
                perform public.cg_log('CONGRESSO: a eleição para Presidente do Congresso foi aberta. Declare a candidatura (8 minutos), depois todos votam (8 minutos).');
            exception when others then null;
            end;

        end if;

        return;

    end if;

    if e.phase = 'campaign' and now() >= e.campaign_end then

        if not exists (select 1 from public.cg_speaker_candidates as c where c.election_id = e.id)
           and now() < e.campaign_end + interval '5 minutes' then
            update public.cg_speaker_election as x
            set campaign_end = x.campaign_end + interval '5 minutes',
                vote_end = x.vote_end + interval '5 minutes'
            where x.id = e.id;
            begin
                perform public.cg_log('CONGRESSO: ninguém se candidatou à presidência do Congresso. A campanha foi prorrogada por 5 minutos.');
            exception when others then null;
            end;
            return;
        end if;

        update public.cg_speaker_election as x set phase = 'voting' where x.id = e.id;
        begin
            perform public.cg_log('CONGRESSO: a votação para Presidente do Congresso está aberta.');
        exception when others then null;
        end;
        return;

    end if;

    if e.phase = 'voting' and now() >= e.vote_end then

        select c.player_id, c.name, c.party, count(v.voter) as votes
        into v_win
        from public.cg_speaker_candidates as c
        left join public.cg_speaker_votes as v
               on v.candidate = c.player_id and v.election_id = e.id
        where c.election_id = e.id
        group by c.player_id, c.name, c.party
        order by count(v.voter) desc, c.name
        limit 1;

        if v_win.player_id is null then
            update public.cg_speaker_election as x
            set phase = 'done', note = 'Nenhum candidato.'
            where x.id = e.id;
            return;
        end if;

        update public.cg_speaker_state as s
        set speaker_player = v_win.player_id,
            speaker_name = v_win.name,
            speaker_party = v_win.party,
            term_no = s.term_no + 1,
            term_end = now() + make_interval(secs => public.cg_speaker_term_seconds()),
            veto_used = false
        where s.id = 1;

        update public.cg_speaker_election as x
        set phase = 'done', winner_id = v_win.player_id, winner_name = v_win.name,
            note = 'Eleito com ' || v_win.votes || ' voto(s).'
        where x.id = e.id;

        begin
            perform public.cg_log('CONGRESSO: ' || v_win.name || ' é eleito Presidente do Congresso (' || v_win.votes || ' voto(s)). Toma a cadeira e o veto da casa.');
        exception when others then null;
        end;

        return;

    end if;

end;
$function$;


/* the office starts empty on a database that has never seen this patch */
create or replace function public.cg_speaker_seed()
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
    insert into public.cg_speaker_state (id) values (1) on conflict (id) do nothing;
end;
$function$;


create or replace function public.cg_speaker_state()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    st record;
    e record;
    v_last record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;

    perform public.cg_speaker_advance();

    select * into st from public.cg_speaker_state as s where s.id = 1;
    select * into e from public.cg_speaker_election as x
    where x.phase <> 'done' order by x.id desc limit 1;
    select * into v_last from public.cg_speaker_election as x
    where x.phase = 'done' order by x.id desc limit 1;

    return jsonb_build_object(
        'now', now(),
        'mine', v_faction = 'Freedom Authority',
        'speaker', case when st.speaker_player is null then null else jsonb_build_object(
            'name', coalesce(st.speaker_name, ''),
            'party', coalesce(st.speaker_party, ''),
            'term_no', st.term_no,
            'term_end', st.term_end,
            'veto_used', st.veto_used,
            'me', st.speaker_player = me
        ) end,
        'election', case when e.id is null then null else jsonb_build_object(
            'id', e.id,
            'phase', e.phase,
            'campaign_end', e.campaign_end,
            'vote_end', e.vote_end,
            'candidates', coalesce((
                select jsonb_agg(jsonb_build_object(
                           'player_id', c.player_id,
                           'name', c.name,
                           'party', coalesce(c.party, ''),
                           'mine', c.player_id = me,
                           'votes', (select count(*) from public.cg_speaker_votes as v
                                     where v.election_id = e.id and v.candidate = c.player_id)
                       ) order by c.name)
                from public.cg_speaker_candidates as c where c.election_id = e.id
            ), '[]'::jsonb),
            'my_vote', (select v.candidate from public.cg_speaker_votes as v
                        where v.election_id = e.id and v.voter = me),
            'voted', (select count(*) from public.cg_speaker_votes as v where v.election_id = e.id)
        ) end,
        'last', case when v_last.id is null then null else jsonb_build_object(
            'winner', coalesce(v_last.winner_name, ''),
            'note', coalesce(v_last.note, '')
        ) end
    );

end;
$function$;


/* which party a delegate sits with, whatever the base game calls that book */
create or replace function public.cg_player_party(p_player uuid)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
    v text;
begin

    begin
        select m.party into v from public.cg_members as m where m.player_id = p_player limit 1;
    exception when undefined_table or undefined_column then v := null;
    end;

    return coalesce(v, '');

end;
$function$;


create or replace function public.cg_speaker_run()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    e record;
    v_name text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;
    if v_faction is distinct from 'Freedom Authority' then
        raise exception 'Only Freedom Authority players sit in the Congress';
    end if;

    perform public.cg_speaker_advance();

    select * into e from public.cg_speaker_election as x
    where x.phase = 'campaign' order by x.id desc limit 1;

    if e.id is null then raise exception 'No campaign for the Congress is open'; end if;

    if exists (select 1 from public.cg_speaker_candidates as c
               where c.election_id = e.id and c.player_id = me) then
        raise exception 'You are already a candidate';
    end if;

    select coalesce(p.username, 'Delegate') into v_name
    from public.players as p where p.id = me;

    insert into public.cg_speaker_candidates (election_id, player_id, name, party)
    values (e.id, me, coalesce(v_name, 'Delegate'), public.cg_player_party(me))
    on conflict (election_id, player_id) do nothing;

    begin
        perform public.cg_log('CANDIDATURA: ' || coalesce(v_name, 'Delegate') || ' apresenta-se a Presidente do Congresso.');
    exception when others then null;
    end;

    return jsonb_build_object('ok', true, 'election', e.id);

end;
$function$;


create or replace function public.cg_speaker_vote(p_candidate uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    v_faction text;
    e record;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    select p.faction into v_faction from public.players as p where p.id = me;
    if v_faction is distinct from 'Freedom Authority' then
        raise exception 'Only Freedom Authority players vote in the Congress';
    end if;

    perform public.cg_speaker_advance();

    select * into e from public.cg_speaker_election as x
    where x.phase = 'voting' order by x.id desc limit 1;

    if e.id is null then raise exception 'No vote for the Congress is open'; end if;

    if not exists (select 1 from public.cg_speaker_candidates as c
                   where c.election_id = e.id and c.player_id = p_candidate) then
        raise exception 'That delegate is not a candidate';
    end if;

    insert into public.cg_speaker_votes (election_id, voter, candidate)
    values (e.id, me, p_candidate)
    on conflict (election_id, voter) do update set candidate = excluded.candidate;

    return jsonb_build_object('ok', true, 'election', e.id, 'candidate', p_candidate);

end;
$function$;


/*
   The chamber's veto belongs to the chamber's president: one bill a
   term, and only while the bill is still on the floor. The base game's
   own veto stays where it is; this is the Congress's.
*/
create or replace function public.congress_speaker_veto(p_proposal integer)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    me uuid := auth.uid();
    st record;
    p record;
    v_text text;
begin

    if me is null then raise exception 'Not authenticated'; end if;

    perform public.cg_speaker_seed();

    select * into st from public.cg_speaker_state as s where s.id = 1;

    if st.speaker_player is null or st.speaker_player <> me then
        raise exception 'Only the President of the Congress may veto';
    end if;

    if st.veto_used then
        raise exception 'The veto of this term has been used';
    end if;

    select * into p from public.cg_proposals as x where x.id = p_proposal for update;
    if p.id is null or p.status not in ('introduction', 'debate') then
        raise exception 'Only a live bill can be vetoed';
    end if;

    update public.cg_proposals as x
    set status = 'rejected'
    where x.id = p_proposal;

    /* whatever else this database keeps on a bill is filled in if it is
       there: the result of a veto is nothing at all */
    if exists (select 1 from information_schema.columns as c
               where c.table_schema = 'public' and c.table_name = 'cg_proposals'
                 and c.column_name = 'result') then
        execute 'update public.cg_proposals set result = $1 where id = $2'
        using jsonb_build_object('effect', 'Vetado pelo Presidente do Congresso.', 'vetoed', true), p_proposal;
    end if;

    if exists (select 1 from information_schema.columns as c
               where c.table_schema = 'public' and c.table_name = 'cg_proposals'
                 and c.column_name = 'resolved_at') then
        execute 'update public.cg_proposals set resolved_at = now() where id = $1'
        using p_proposal;
    end if;

    update public.cg_speaker_state as s set veto_used = true where s.id = 1;

    v_text := 'VETO: o Presidente do Congresso ' || coalesce(st.speaker_name, '')
              || ' veta "' || coalesce(p.title, 'a proposta') || '".';

    begin
        perform public.cg_log(v_text);
    exception when others then null;
    end;

    return jsonb_build_object('ok', true, 'proposal', p_proposal);

end;
$function$;



-- =========================================================
-- 5. the Congress's tax level pays
-- =========================================================

/*
   The tax block below is the Congress's own tick, with one thing put
   right: the meter it counts from. It is written by this patch, so a
   database that never had the column gets it, and a meter that has
   never been started is started now — otherwise the tax level could be
   raised to two and not one credit would ever arrive.
*/
alter table public.cg_state add column if not exists last_tax_at timestamptz;
update public.cg_state set last_tax_at = now() where last_tax_at is null;
alter table public.cg_state alter column last_tax_at set default now();

create or replace function public.congress_tick()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    p record;
    st record;
    n integer;
    i integer;
    j integer;
    v_gain bigint := 0;
    v_out jsonb := '[]'::jsonb;
    v_gap interval;
begin
    if auth.uid() is null then raise exception 'Not authenticated'; end if;

    if not exists (select 1 from public.game_control as g where g.id = 1 and g.started) then
        return v_out;
    end if;

    -- maintenance: Congress does not sit
    if public.game_frozen() then
        return v_out;
    end if;

    if not pg_try_advisory_xact_lock(7770003) then
        return v_out;
    end if;

    perform public.cg_seed();

    select * into st from public.cg_state as s where s.id = 1;

    if public.cg_is_fa() then

        v_gap := now() - st.fa_online_at;

        if v_gap > interval '150 seconds' then
            perform public.cg_shift(v_gap - interval '45 seconds');
        end if;

        update public.cg_state as s set fa_online_at = now() where s.id = 1;

    elsif now() - st.fa_online_at > interval '150 seconds' then

        return v_out;      -- no Freedom Authority player is here: Congress is not in session

    end if;

    /* elections and the President's term */
    perform public.cg_run_elections();

    /* introduction -> debate */
    update public.cg_proposals as x set status = 'debate' where x.status = 'introduction' and x.debate_at <= now();

    /* the vote */
    for p in select x.id from public.cg_proposals as x where x.status in ('introduction', 'debate') and x.vote_at <= now() order by x.vote_at loop
        v_out := v_out || jsonb_build_array(public.cg_resolve(p.id));
    end loop;

    perform public.cg_process_occupations();

    select * into st from public.cg_state as s where s.id = 1;

    /* tax revenue every 15 minutes */
    /* the meter may never have been started: "now minus nothing" is nothing,
       and the whole tax block then decides no quarter hour has passed */
    n := least(20, floor(extract(epoch from (now() - coalesce(st.last_tax_at, now()))) / 900)::integer);

    if n > 0 then
        if st.tax_level > 0 then
            for i in 1..n loop
                for j in 1..st.tax_level loop
                    v_gain := v_gain + 300 + floor(random() * 201)::integer;
                end loop;
            end loop;
            update public.faction_treasury as ft set credits = ft.credits + v_gain where ft.faction = 'Freedom Authority';
            perform public.cg_log('TAXES: ' || v_gain || ' credits collected from the member worlds.');
        end if;
        update public.cg_state as s
        set last_tax_at = coalesce(s.last_tax_at, now()) + make_interval(secs => n * 900)
        where s.id = 1;
    elsif st.last_tax_at is null then
        update public.cg_state as s set last_tax_at = now() where s.id = 1;
    end if;

    /* popularity slowly recovers towards 60 */
    n := least(60, floor(extract(epoch from (now() - st.last_turn_at)) / 300)::integer);

    if n > 0 then
        update public.cg_state as s
        set popularity = case when s.popularity < 60 then least(60, s.popularity + 0.5 * n) else s.popularity end,
            last_turn_at = s.last_turn_at + make_interval(secs => n * 300)
        where s.id = 1;
    end if;

    perform public.cg_npc_proposal();

    return v_out;
end;
$function$;


-- =========================================================
-- 6. and the reset button clears all of it
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

    /* the embassies, the ceasefires and the presence list; the supply lines
       need no wiping any more, they follow the worlds themselves */
    delete from public.planet_diplomacy;
    delete from public.player_presence;

    begin
        delete from public.ceasefires;
    exception when undefined_table then null;
    end;

    begin
        delete from public.supply_lines;
    exception when undefined_table then null;
    end;

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

    /* the unrest of the occupied worlds, and the Congress's own chair */
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

    return jsonb_build_object('ok', true);

end;
$function$;


-- =========================================================
-- sanity output
-- =========================================================

select
    (select count(*) from information_schema.routines
      where routine_schema = 'public'
        and routine_name in ('orbit_battle_scan', 'repair_fleet', 'fleet_repair_quote',
                             'unrest_tick', 'unrest_state', 'cg_speaker_state',
                             'cg_speaker_run', 'cg_speaker_vote', 'congress_speaker_veto')) as new_functions,
    (select count(*) from information_schema.tables
      where table_schema = 'public'
        and table_name in ('planet_unrest', 'cg_speaker_state', 'cg_speaker_election',
                           'cg_speaker_candidates', 'cg_speaker_votes')) as new_tables,
    (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'cg_state'
        and column_name = 'last_tax_at') as tax_meter;
