/* Run sql/2026-11-26_the_tusken_world.sql and sql/2026-11-27_the_pens_and_the_transports.sql
   against a real PostgreSQL (PGlite, the WASM build) with stand-ins for the
   game's older tables, then work Tuskara as the Combine: bring a fleet into
   orbit, raise settlements one cooldown apart, grow them, watch the bands bring
   the Tusken in, buy a hull once and keep using it, and read the money.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/tusken-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");

const AUTH = "11111111-1111-4111-8111-111111111111";   // the Combine player
const FREE = "33333333-3333-4333-8333-333333333333";   // a Freedom Authority player

const PATCHES = [
    "2026-11-26_the_tusken_world.sql",
    "2026-11-27_the_pens_and_the_transports.sql",
    "2026-11-28_transport_fleets.sql",
    "2026-11-29_the_eyes_and_the_ledger.sql",
    "2026-11-30_the_cargo_fleets.sql",
    "2026-11-31_the_cargo_holds_no_troops.sql",
    "2026-11-32_the_hull_counts.sql",
    "2026-11-33_the_slave_routes.sql",
    "2026-11-34_the_reset_catches_up.sql"
];

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

function near(a, b, slack) {
    return Math.abs(Number(a) - Number(b)) <= (slack === undefined ? 2 : slack);
}

async function applyAll(db) {
    for (const file of PATCHES) {
        await db.exec(fs.readFileSync(path.join(ROOT, "sql", file), "utf8"));
    }
}

/* a fleets table and the reading of it the game has: a stationed fleet sits
   on its origin world, an active one sits wherever it was left */
const FLEETS = `
create table public.fleets (
    id uuid primary key default gen_random_uuid(),
    player_id uuid, faction text, name text, status text default 'stationed',
    origin text, destination text, departure_time timestamptz, arrival_time timestamptz,
    space_x numeric, space_y numeric, heading numeric, squads jsonb default '[]'::jsonb
);

create or replace function public.fleet_positions()
returns table (id uuid, faction text, name text, status text, origin text, x numeric, y numeric)
language sql stable security definer set search_path to ''
as $$
    select f.id, f.faction, f.name, f.status::text, f.origin,
           case when f.status::text = 'in_space' and f.space_x is not null then f.space_x else o.x end,
           case when f.status::text = 'in_space' and f.space_y is not null then f.space_y else o.y end
    from public.fleets as f
    left join public.planet_positions as o on o.name = f.origin
$$;
`;

const SCHEMA = `
create schema if not exists auth;

create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.me', true), '')::uuid $$;

create table public.players (id uuid primary key, faction text);
insert into public.players (id, faction) values
    ('${AUTH}', 'Combine'),
    ('${FREE}', 'Freedom Authority');

create table public.game_control (id int primary key, started boolean not null default true,
    maintenance boolean not null default false, host_player uuid);
insert into public.game_control (id, started, maintenance, host_player)
values (1, true, false, '${AUTH}');

create table public.faction_treasury (faction text primary key, credits numeric default 0,
    last_income_at timestamptz);
insert into public.faction_treasury (faction, credits, last_income_at) values
    ('Combine', 40000, now() - interval '5 minutes'),
    ('Freedom Authority', 40000, now() - interval '5 minutes');

create table public.planets (id text primary key, name text unique, income int default 100);
insert into public.planets (id, name, income) values
    ('Ultramars', 'Ultramars', 100),
    ('Free Earth', 'Free Earth', 100),
    ('Krieg', 'Krieg', 100),
    ('Asteron', 'Asteron', 40);

create table public.planet_positions (name text primary key, x numeric, y numeric);
insert into public.planet_positions (name, x, y) values
    ('Ultramars', 10, 19), ('Free Earth', 89, 84), ('Krieg', 70, 85), ('Asteron', 43, 21);

create table public.cities (id serial primary key, planet_id text, faction text,
    name text, garrison_level int default 3);
insert into public.cities (planet_id, faction, name) values
    ('Ultramars', 'Combine', 'Varkos'), ('Ultramars', 'Combine', 'Karsen'),
    ('Free Earth', 'Freedom Authority', 'New Lisbon'), ('Free Earth', 'Freedom Authority', 'Liberty City'),
    ('Krieg', 'Combine', 'Ardun'), ('Krieg', 'Combine', 'Vaske'),
    ('Asteron', 'Independents', 'Aster');

create table public.city_buildings (id serial primary key, city_id int, building_type text);

create table public.fleet_recruits (
    id serial primary key,
    fleet_id uuid,
    squad_type text,
    ready_at timestamptz default now()
);

${FLEETS}

create or replace function public.planet_income(p_planet text) returns bigint
language sql stable security definer set search_path to ''
as $$
    select coalesce(p.income + 100 * (
        select count(*) from public.city_buildings as cb
        join public.cities as cc on cc.id = cb.city_id
        where cc.planet_id = p.id and cb.building_type = 'civilian_factory'
    ), 0)
    from public.planets as p where p.name = p_planet
$$;

create or replace function public.capital_planet(p_faction text) returns text
language sql stable as $$
    select case p_faction when 'Combine' then 'Ultramars' when 'Freedom Authority' then 'Free Earth' end
$$;

create or replace function public.orbit_range() returns numeric language sql immutable as $$ select 3::numeric $$;
create or replace function public.supply_corridor() returns numeric language sql immutable as $$ select 2::numeric $$;

create or replace function public.point_segment_distance(px numeric, py numeric,
                                                         ax numeric, ay numeric,
                                                         bx numeric, by numeric)
returns numeric language sql immutable as $$
    select 999::numeric
$$;

create or replace function public.supply_segment_blockers(p_faction text, ax numeric, ay numeric,
                                                          bx numeric, by numeric)
returns jsonb language sql stable as $$ select '[]'::jsonb $$;
`;

async function as(db, who) {
    await db.exec("select set_config('test.me', '" + who + "', false)");
}

async function q(db, sql, params) {
    const r = await db.query(sql, params);
    return r.rows;
}

async function one(db, sql, params) {
    const rows = await q(db, sql, params);
    return rows[0];
}

async function rpc(db, sql) {
    const row = await one(db, sql);
    return row ? Object.values(row)[0] : null;
}

async function expectError(db, sql) {
    try { await db.query(sql); return null; }
    catch (e) { return String(e.message || e); }
}

/* A small install carrying a DIFFERENT shape of planets table, so the
   patch's first statement can be tried against schemas this file has
   never seen: the live one has a NOT NULL faction beside the key, and
   the row cannot be built from name and income alone. */
function mini(planetsSql, cityKey) {
    return `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.me', true), '')::uuid $$;

create table public.players (id uuid primary key, faction text);
insert into public.players (id, faction) values
    ('${AUTH}', 'Combine'), ('${FREE}', 'Freedom Authority');

create table public.game_control (id int primary key, started boolean not null default true,
    maintenance boolean not null default false, host_player uuid);
insert into public.game_control (id, started, maintenance, host_player)
values (1, true, false, '${AUTH}');

create table public.faction_treasury (faction text primary key, credits numeric default 0,
    last_income_at timestamptz);
insert into public.faction_treasury (faction, credits) values ('Combine', 5000), ('Freedom Authority', 5000);

${planetsSql}

create table public.planet_positions (name text primary key, x numeric, y numeric);
insert into public.planet_positions (name, x, y) values
    ('Ultramars', 10, 19), ('Free Earth', 89, 84);

create table public.cities (id serial primary key, planet_id ${cityKey}, faction text,
    name text, garrison_level int default 3);
insert into public.cities (planet_id, faction, name)
select p.id,
       case when p.name = 'Ultramars' then 'Combine' else 'Freedom Authority' end,
       'City of ' || p.name
from public.planets as p
where p.name in ('Ultramars', 'Free Earth');

${FLEETS}

create or replace function public.planet_income(p_planet text) returns bigint
language sql stable security definer set search_path to ''
as $$ select coalesce((select p.income from public.planets as p where p.name = p_planet), 0)::bigint $$;

create or replace function public.capital_planet(p_faction text) returns text
language sql stable as $$
    select case p_faction when 'Combine' then 'Ultramars' when 'Freedom Authority' then 'Free Earth' end
$$;

create or replace function public.orbit_range() returns numeric language sql immutable as $$ select 3::numeric $$;
create or replace function public.supply_corridor() returns numeric language sql immutable as $$ select 2::numeric $$;

create or replace function public.point_segment_distance(px numeric, py numeric,
                                                         ax numeric, ay numeric,
                                                         bx numeric, by numeric)
returns numeric language sql immutable as $$ select 999::numeric $$;

create or replace function public.supply_segment_blockers(p_faction text, ax numeric, ay numeric,
                                                          bx numeric, by numeric)
returns jsonb language sql stable as $$ select '[]'::jsonb $$;
`;
}

(async function main() {

    const db = new PGlite();

    try {

        await db.exec(SCHEMA);
        await applyAll(db);

        console.log("\n== the world itself");

        const world = await one(db, "select * from public.planets where name = 'Tuskara'");
        ok("Tuskara is on the map as a planet", !!world);

        const pos = await one(db, "select x, y from public.planet_positions where name = 'Tuskara'");
        ok("Tuskara has a place on the map", pos && Number(pos.x) === 44 && Number(pos.y) === 92, pos);

        const gaps = await q(db, `
            select c.name as capital,
                   sqrt(power(t.x - c.x, 2) + power(t.y - c.y, 2)) as gap
            from public.planet_positions as c
            cross join public.planet_positions as t
            where t.name = 'Tuskara' and c.name in ('Ultramars', 'Free Earth')`);
        ok("Tuskara is at least three worlds from either capital",
            gaps.length === 2 && gaps.every(function(g) { return Number(g.gap) >= 27; }),
            gaps.map(function(g) { return g.capital + " " + Number(g.gap).toFixed(1); }));

        console.log("\n== the numbers");

        ok("1,000 Tusken make a credit",
            Number(await rpc(db, "select public.tusken_slaves_per_credit() as v")) === 1000);
        ok("a faction may raise eight settlements",
            Number(await rpc(db, "select public.tusken_max_colonies() as v")) === 8);
        ok("the bands need five minutes between two of them",
            Number(await rpc(db, "select public.tusken_colony_cooldown() as v")) === 300);
        ok("the planet has sixteen places for them",
            Number(await rpc(db, "select public.tusken_spot_count() as v")) === 16);

        const places = await q(db, "select public.tusken_spot_x(i) as x, public.tusken_spot_y(i) as y from generate_series(1, 16) as s(i)");
        ok("every place is on the globe",
            places.every(function(p) { return Number(p.x) > 0 && Number(p.x) < 100 &&
                                              Number(p.y) > 0 && Number(p.y) < 100; }), places);
        ok("no two places are the same",
            new Set(places.map(function(p) { return p.x + "," + p.y; })).size === 16);
        ok("every place has its own name",
            new Set(await Promise.all(Array.from({ length: 16 }, function(_, i) {
                return rpc(db, "select public.tusken_colony_name(" + (i + 1) + ") as v");
            }))).size === 16);

        console.log("\n== the screen before anything is built");

        await as(db, AUTH);

        let state = await rpc(db, "select public.tusken_world() as s");
        ok("an empty world reads", state && state.planet === "Tuskara", state);
        ok("no settlements yet", state.my_colonies === 0);
        ok("no Tusken captured yet", Number(state.pool) === 0);
        ok("the first settlement costs 500", state.prices.colony === 500, state.prices);
        ok("a hull takes 1000", Number(state.prices.capacity) === 1000);
        ok("the screen knows the new rate", Number(state.prices.per_credit) === 1000, state.prices);
        ok("the screen knows the cooldown", Number(state.prices.cooldown) === 300, state.prices);
        ok("no fleet is in orbit yet", state.orbit.here === false, state.orbit);
        ok("and none is named", state.orbit.fleet === null, state.orbit);
        ok("no transports are owned", state.ships.length === 0, state.ships);
        ok("nothing is in port", Number(state.idle_ships) === 0);
        ok("Krieg is offered as a destination", state.destinations.some(function(d) { return d.planet === "Krieg"; }));
        ok("Asteron is not (we do not hold it)", !state.destinations.some(function(d) { return d.planet === "Asteron"; }));
        ok("the homeworld is not offered to itself", !state.destinations.some(function(d) { return d.planet === "Tuskara"; }));
        ok("a level-one settlement holds 1500", Number(await rpc(db, "select public.tusken_capacity(1,1) as v")) === 1500);
        ok("a level-one settlement takes 500 an hour", Number(await rpc(db, "select public.tusken_yield_per_hour(1,1) as v")) === 500);

        console.log("\n== settling needs a fleet in orbit");

        const credits = async function() {
            const row = await one(db, "select credits from public.faction_treasury where faction = 'Combine'");
            return Number(row.credits);
        };

        let err = await expectError(db, "select public.tusken_found_colony()");
        ok("without a fleet the bands stay in the desert",
            err && /in orbit of Tuskara/.test(err), err);
        ok("and nothing was paid for", (await credits()) === 40000, await credits());

        /* a fleet travelling through is not a fleet in orbit */
        await db.exec(`
            insert into public.fleets (player_id, faction, name, status, origin, destination)
            values ('${AUTH}', 'Combine', 'Wandering Spear', 'travelling', 'Krieg', 'Tuskara')`);
        err = await expectError(db, "select public.tusken_found_colony()");
        ok("a fleet on the road does not count", err && /in orbit of Tuskara/.test(err), err);
        await db.exec("delete from public.fleets");

        await db.exec(`
            insert into public.fleets (player_id, faction, name, status, origin, transport_fleet)
            values ('${AUTH}', 'Combine', 'Spear of Ultramar', 'stationed', 'Tuskara', true)`);

        state = await rpc(db, "select public.tusken_world() as s");
        ok("the fleet overhead is read", state.orbit.here === true, state.orbit);
        ok("and named", state.orbit.fleet === "Spear of Ultramar", state.orbit.fleet);

        console.log("\n== founding");

        const before = await credits();
        let made = await rpc(db, "select public.tusken_found_colony() as s");
        ok("the first settlement is founded", made && made.ok === true, made);
        ok("it took 500 credits", (await credits()) === before - 500);
        ok("it is named", made.name === "Red Hollow", made.name);
        ok("it has a place of its own", Number(made.spot) === 1 && Number(made.x) === 22 && Number(made.y) === 24, made);
        ok("the fleet that held the orbit is reported", made.fleet === "Spear of Ultramar", made.fleet);

        state = await rpc(db, "select public.tusken_world() as s");
        ok("the screen shows one settlement", state.colonies.length === 1);
        ok("it is mine", state.colonies[0].mine === true);
        ok("it carries its place", Number(state.colonies[0].x) === 22 && Number(state.colonies[0].y) === 24, state.colonies[0]);
        ok("the next one costs 750", state.prices.colony === 750, state.prices.colony);
        ok("the cooldown is running", Number(state.cooldown) > 200, state.cooldown);

        err = await expectError(db, "select public.tusken_found_colony()");
        ok("a second settlement has to wait", err && /bands are still moving/.test(err), err);

        const settle = async function() {
            await db.exec("update public.tusken_colonies set founded_at = now() - interval '10 minutes'");
            return rpc(db, "select public.tusken_found_colony() as s");
        };

        await settle();
        await settle();
        state = await rpc(db, "select public.tusken_world() as s");
        ok("three settlements stand", state.colonies.length === 3, state.colonies.length);
        ok("each on its own place",
            new Set(state.colonies.map(function(c) { return c.x + "," + c.y; })).size === 3,
            state.colonies.map(function(c) { return c.x + "," + c.y; }));

        while (state.my_colonies < 8) {
            const got = await settle();
            if (!got || got.ok !== true) { break; }
            state = await rpc(db, "select public.tusken_world() as s");
        }

        ok("eight settlements can stand", state.my_colonies === 8, state.my_colonies);
        ok("the dust has no more places for us", state.my_colonies === state.max_colonies);
        err = await expectError(db, "select public.tusken_found_colony()");
        ok("a ninth is refused", err && /another settlement/.test(err), err);

        const colonies = await q(db, "select id, name, spot from public.tusken_colonies order by id");
        ok("every settlement took a different place",
            new Set(colonies.map(function(c) { return Number(c.spot); })).size === 8,
            colonies.map(function(c) { return c.spot; }));
        ok("all of them are inside the sixteen places",
            colonies.every(function(c) { return Number(c.spot) >= 1 && Number(c.spot) <= 16; }));

        console.log("\n== the bands bring the Tusken in");

        await db.query("update public.tusken_colonies set slaves = 0, last_yield_at = now() - interval '1 hour' where id = $1", [colonies[0].id]);
        let tick = await rpc(db, "select public.tusken_tick() as s");
        ok("the tick ran", tick && tick.ok === true, tick);

        let stock = await one(db, "select slaves from public.tusken_colonies where id = $1", [colonies[0].id]);
        ok("an hour of catching is about 500", near(stock.slaves, 500), stock.slaves);

        await db.query("update public.tusken_colonies set slaves = 0, last_yield_at = now() - interval '10 hours' where id = $1", [colonies[0].id]);
        await rpc(db, "select public.tusken_tick() as s");
        stock = await one(db, "select slaves from public.tusken_colonies where id = $1", [colonies[0].id]);
        ok("the pens stop a settlement at its cap", Number(stock.slaves) === 1500, stock.slaves);

        console.log("\n== growing a settlement");

        let c1 = await one(db, "select * from public.tusken_colonies where id = $1", [colonies[0].id]);
        let cash = await credits();
        await rpc(db, "select public.tusken_upgrade(" + c1.id + ", 'size') as s");
        c1 = await one(db, "select * from public.tusken_colonies where id = $1", [colonies[0].id]);
        ok("size went up", Number(c1.size) === 2);
        ok("the work was paid for", (await credits()) === cash - 400);
        ok("bigger pens", Number(await rpc(db, "select public.tusken_capacity(2,1) as v")) === 3000);

        await rpc(db, "select public.tusken_upgrade(" + c1.id + ", 'catch') as s");
        await rpc(db, "select public.tusken_upgrade(" + c1.id + ", 'hold') as s");
        c1 = await one(db, "select * from public.tusken_colonies where id = $1", [colonies[0].id]);
        ok("the catching grew", Number(c1.catch_level) === 2);
        ok("the holding grew", Number(c1.hold_level) === 2);
        ok("the bands now take 2000 an hour", Number(await rpc(db, "select public.tusken_yield_per_hour(2,2) as v")) === 2000);

        await db.query("update public.tusken_colonies set size = 5 where id = $1", [colonies[0].id]);
        err = await expectError(db, "select public.tusken_upgrade(" + c1.id + ", 'size')");
        ok("a finished track cannot be bought again", err && /already finished/.test(err), err);

        /* the other side needs an orbit of its own, and its settlement must not
           be ours to grow */
        await as(db, FREE);
        await db.exec(`
            insert into public.fleets (player_id, faction, name, status, origin)
            values ('${FREE}', 'Freedom Authority', 'Lantern of Earth', 'stationed', 'Tuskara')`);
        await rpc(db, "select public.tusken_found_colony() as s");
        const theirs = await one(db, "select id from public.tusken_colonies where faction = 'Freedom Authority'");
        ok("the other side settles in the first free place", !!theirs);
        await as(db, AUTH);
        err = await expectError(db, "select public.tusken_upgrade(" + theirs.id + ", 'catch')");
        ok("another faction's settlement is refused", err && /answers to/.test(err), err);

        console.log("\n== a hull joins a fleet");

        await db.query("update public.tusken_colonies set slaves = 1500 where id = $1", [colonies[0].id]);

        const spear = (await one(db, "select id from public.fleets where name = 'Spear of Ultramar'")).id;
        const lantern = (await one(db, "select id from public.fleets where name = 'Lantern of Earth'")).id;

        err = await expectError(db, "select public.tusken_ship(null, 'Tuskara', 'Krieg', 1000)");
        ok("a load needs a fleet named", err && /Choose the fleet/.test(err), err);

        err = await expectError(db, "select public.tusken_buy_ship(null)");
        ok("a hull cannot be bought without naming a fleet", err && /Choose the transport fleet/.test(err), err);

        err = await expectError(db, "select public.tusken_buy_ship('" + lantern + "')");
        ok("a hull is not bought for the enemy", err && /not yours/.test(err), err);

        cash = await credits();
        const bought = await rpc(db, "select public.tusken_buy_ship('" + spear + "') as s");
        ok("a transport is bought", bought && bought.ok === true, bought);
        ok("it cost 350", (await credits()) === cash - 350);
        ok("it is named in order", bought.name === "Transport 1", bought.name);
        ok("it joins the fleet that was named", bought.fleet === "Spear of Ultramar", bought.fleet);
        ok("the fleet's lift is the hull's capacity", Number(bought.lift) === 1000, bought.lift);

        state = await rpc(db, "select public.tusken_world() as s");
        ok("the hull is on the screen", state.ships.length === 1 && state.ships[0].at_sea === false, state.ships);
        ok("under the fleet it sails with", state.ships[0].fleet === "Spear of Ultramar", state.ships[0]);
        ok("the fleet reads with its lift",
            Number(state.fleets.filter(function(f) { return f.id === spear; })[0].lift) === 1000, state.fleets);
        ok("it is in port", Number(state.idle_ships) === 1);

        /* ---- a hull left on a warship by an older save comes home ---- */
        await db.exec(`
            insert into public.fleets (player_id, faction, name, status, origin)
            values ('${AUTH}', 'Combine', 'Old Barge', 'stationed', 'Tuskara')`);

        const oldBarge = (await one(db, "select id from public.fleets where name = 'Old Barge'")).id;

        await db.query("update public.tusken_ships set fleet_id = $1 where id = $2", [oldBarge, bought.id]);
        await db.exec(fs.readFileSync(path.join(ROOT, "sql", "2026-11-30_the_cargo_fleets.sql"), "utf8"));

        const moved = await one(db, "select fleet_id, capacity from public.tusken_ships where id = $1", [bought.id]);

        ok("a hull on a warship is moved to a transport fleet", moved.fleet_id === spear, moved.fleet_id);
        ok("and every hull is the small one", Number(moved.capacity) === 1000, moved.capacity);

        /* a fleet with no hulls cannot carry anything */
        await db.exec(`
            insert into public.fleets (player_id, faction, name, status, origin)
            values ('${AUTH}', 'Combine', 'Empty Barge', 'stationed', 'Tuskara')`);
        const barge = (await one(db, "select id from public.fleets where name = 'Empty Barge'")).id;
        err = await expectError(db, "select public.tusken_ship('" + barge + "', 'Tuskara', 'Krieg', 500)");
        ok("a fleet without transports carries nothing", err && /carries no transports/.test(err), err);

        err = await expectError(db, "select public.tusken_buy_ship('" + barge + "')");
        ok("a hull is not sold for a battle fleet", err && /transport fleet/.test(err), err);

        cash = await credits();
        let ship = await rpc(db, "select public.tusken_ship('" + spear + "', 'Tuskara', 'Krieg', 1000) as s");
        ok("the load leaves", ship && ship.ok === true && Number(ship.amount) === 1000, ship);
        ok("the trip costs nothing", (await credits()) === cash, await credits());
        ok("it sails the fleet that owns the hulls", ship.fleet === "Spear of Ultramar", ship.fleet);
        ok("the fleet is put to sea",
            (await one(db, "select status from public.fleets where id = $1", [spear])).status === "travelling");
        ok("the pens were emptied by the load",
            Number((await one(db, "select slaves from public.tusken_colonies where id = $1", [colonies[0].id])).slaves) === 500);
        ok("a load is in transit",
            Number((await one(db, "select count(*) as n from public.tusken_convoys where status = 'sailing'")).n) === 1);
        ok("the road takes time", ship.seconds >= 60, ship.seconds);

        state = await rpc(db, "select public.tusken_world() as s");
        ok("the convoy is on the screen", state.convoys.length === 1, state.convoys);
        ok("the convoy names its fleet", state.convoys[0].fleet === "Spear of Ultramar", state.convoys[0]);
        ok("the convoy says how many hulls", Number(state.convoys[0].ships) === 1, state.convoys[0]);
        ok("the hull reads as at sea", state.ships[0].at_sea === true && state.ships[0].to === "Krieg", state.ships[0]);
        ok("nothing is in port", Number(state.idle_ships) === 0);

        err = await expectError(db, "select public.tusken_ship('" + spear + "', 'Tuskara', 'Krieg', 500)");
        ok("a fleet at sea cannot take a second load", err && /not in port/.test(err), err);

        /* the fleet makes port, and the load lands */
        await db.query("update public.tusken_convoys set arrival_at = now() - interval '1 second' where status = 'sailing'");
        await rpc(db, "select public.tusken_tick() as s");
        const landed = await one(db, "select amount from public.tusken_workforce where planet = 'Krieg' and faction = 'Combine'");
        ok("the load is at work on Krieg", landed && Number(landed.amount) === 1000, landed);
        ok("the fleet makes port where it sailed",
            (await one(db, "select origin from public.fleets where id = $1", [spear])).origin === "Krieg",
            await one(db, "select status, origin from public.fleets where id = $1", [spear]));
        ok("the crossing is on the record, landed",
            (await one(db, "select status from public.tusken_convoys order by id desc limit 1")).status === "landed");

        state = await rpc(db, "select public.tusken_world() as s");
        ok("the hull is back in port", state.ships[0].at_sea === false, state.ships[0]);
        ok("and still the only one", state.ships.length === 1);
        ok("nothing was bought for the second trip", Number(await rpc(db, "select count(*) as n from public.tusken_ships")) === 1);

        /* the same hulls take the next load, once the fleet is back overhead */
        await db.query("update public.fleets set status = 'stationed', origin = 'Tuskara', destination = null where id = $1", [spear]);
        cash = await credits();
        await db.query("update public.tusken_colonies set slaves = 800 where id = $1", [colonies[0].id]);
        ship = await rpc(db, "select public.tusken_ship('" + spear + "', 'Tuskara', 'Krieg', 800) as s");
        ok("the next load goes on the same hulls", ship && ship.ok === true && ship.fleet === "Spear of Ultramar", ship);
        ok("and is free too", (await credits()) === cash);
        await db.query("update public.tusken_convoys set arrival_at = now() - interval '1 second' where status = 'sailing'");
        await rpc(db, "select public.tusken_tick() as s");

        console.log("\n== the money the slaves make");

        ok("1,800 Tusken pay 1", Number(await rpc(db, "select public.tusken_income_bonus('Krieg', 'Combine') as v")) === 1,
            await rpc(db, "select public.tusken_income_bonus('Krieg', 'Combine') as v"));
        ok("the homeworld never pays", Number(await rpc(db, "select public.tusken_income_bonus('Tuskara', 'Combine') as v")) === 0);

        await db.query("update public.tusken_workforce set amount = 25000 where planet = 'Krieg' and faction = 'Combine'");
        ok("25,000 Tusken pay 25", Number(await rpc(db, "select public.tusken_income_bonus('Krieg', 'Combine') as v")) === 25);

        state = await rpc(db, "select public.tusken_world() as s");
        ok("the screen reads the money", state.workforce.length === 1 && Number(state.workforce[0].bonus) === 25, state.workforce);

        const net = await rpc(db, "select public.supply_network('Combine') as s");
        const krieg = net.worlds.filter(function(w) { return w.planet === "Krieg"; })[0];
        ok("Krieg is in the network", !!krieg, net.worlds);
        ok("Krieg pays its base plus the slaves", krieg && Number(krieg.income) === 125, krieg);
        ok("the network reports the slaves", krieg && Number(krieg.slaves) === 25000, krieg);
        ok("the network splits out the slave income", krieg && Number(krieg.slave_income) === 25, krieg);

        /* moving them off Krieg takes the income with them */
        await rpc(db, "select public.tusken_ship('" + spear + "', 'Krieg', 'Ultramars', 2000) as s");
        await db.query("update public.tusken_convoys set arrival_at = now() - interval '1 second' where status = 'sailing'");
        await rpc(db, "select public.tusken_tick() as s");

        ok("Krieg has 24,000 left", Number((await one(db, "select amount from public.tusken_workforce where planet = 'Krieg' and faction = 'Combine'")).amount) === 24000);
        ok("Ultramars got the load", Number((await one(db, "select amount from public.tusken_workforce where planet = 'Ultramars' and faction = 'Combine'")).amount) === 1000);
        await db.query("update public.tusken_workforce set amount = 500 where planet = 'Krieg' and faction = 'Combine'");
        ok("500 Tusken pay nothing", Number(await rpc(db, "select public.tusken_income_bonus('Krieg', 'Combine') as v")) === 0);

        console.log("\n== what a fleet will not do");

        await db.query("update public.fleets set status = 'stationed', origin = 'Tuskara', destination = null where id = $1", [spear]);

        err = await expectError(db, "select public.tusken_ship('" + spear + "', 'Tuskara', 'Asteron', 500)");
        ok("a world we do not hold is refused", err && /you hold whole/.test(err), err);
        err = await expectError(db, "select public.tusken_ship('" + spear + "', 'Tuskara', 'Tuskara', 500)");
        ok("the homeworld is not a destination", err && /already there|hold whole/.test(err), err);
        await db.query("update public.tusken_colonies set slaves = 0");
        err = await expectError(db, "select public.tusken_ship('" + spear + "', 'Tuskara', 'Krieg', 500)");
        ok("an empty pen cannot ship", err && /no Tusken/.test(err), err);

        /* an enemy warship over the world the load is leaving: nothing sails */
        await db.query("update public.tusken_colonies set slaves = 1000");
        await db.exec(`
            insert into public.fleets (player_id, faction, name, status, origin, squads)
            values ('${FREE}', 'Freedom Authority', 'Sword of Earth', 'stationed', 'Tuskara',
                    '[{"type":"Rifle","amount":3,"soldiers":3000}]'::jsonb)`);
        err = await expectError(db, "select public.tusken_ship('" + spear + "', 'Tuskara', 'Krieg', 500)");
        ok("a blockade stops the load sailing", err && /holds the orbit/.test(err), err);
        await db.query("update public.fleets set origin = 'Ultramars' where name = 'Sword of Earth'");

        await db.query("update public.tusken_colonies set slaves = 5000 where id = $1", [colonies[0].id]);
        ship = await rpc(db, "select public.tusken_ship('" + spear + "', 'Tuskara', 'Krieg', 9000) as s");
        ok("a bigger load is clamped to the fleet's lift", Number(ship.amount) === 1000, ship);
        await db.query("update public.tusken_convoys set arrival_at = now() - interval '1 second' where status = 'sailing'");
        await rpc(db, "select public.tusken_tick() as s");

        /* a second hull on the same fleet: one fleet, more lift */
        cash = await credits();
        await rpc(db, "select public.tusken_buy_ship('" + spear + "') as s");
        ok("the second hull cost 350", (await credits()) === cash - 350);
        state = await rpc(db, "select public.tusken_world() as s");
        ok("two hulls are owned", state.ships.length === 2, state.ships);
        ok("the second is named in order", state.ships[1].name === "Transport 2", state.ships[1].name);
        ok("both sail with the same fleet",
            state.ships.every(function(x) { return x.fleet === "Spear of Ultramar"; }), state.ships);
        ok("and the fleet's lift doubled",
            Number(state.fleets.filter(function(f) { return f.id === spear; })[0].lift) === 2000, state.fleets);

        const hulls = await q(db, "select fleet_id, hulls from public.tusken_hull_counts()");

        ok("the map can ask how many hulls a fleet carries",
            Number((hulls.filter(function(r) { return r.fleet_id === spear; })[0] || {}).hulls) === 2, hulls);
        ok("and a fleet with no hulls is not in the answer",
            !hulls.some(function(r) { return r.fleet_id === barge; }), hulls);

        console.log("\n== the interception");

        /* the slaving fleet has no soldiers aboard, and a warship waits at the capital */
        await db.query("update public.tusken_workforce set amount = 3000 where planet = 'Krieg' and faction = 'Combine'");

        const capture = await rpc(db, "select public.tusken_ship('" + spear + "', 'Krieg', 'Ultramars', 2000) as s");
        ok("the load sails for the capital", capture && capture.ok === true, capture);
        ok("a fleet with no soldiers has no escort", Number(capture.escort) === 0, capture.escort);

        await db.query("update public.tusken_convoys set arrival_at = now() - interval '1 second' where status = 'sailing'");
        const held = await rpc(db, "select public.tusken_tick() as s");
        ok("the tick reports the capture", Number(held.captured) === 1, held);

        const record = await one(db, "select status, outcome from public.tusken_convoys order by id desc limit 1");
        ok("the crossing is marked taken", record.status === "captured", record);
        ok("and names the warship that took it", /Sword of Earth/.test(record.outcome || ""), record);

        const taken = await one(db, "select faction, origin from public.fleets where id = $1", [spear]);
        ok("the fleet changes hands", taken.faction === "Freedom Authority", taken);
        ok("its hulls go with it",
            Number((await one(db, "select count(*) as n from public.tusken_ships where fleet_id = $1", [spear])).n) === 2);
        ok("and they leave our rolls",
            Number((await one(db, "select count(*) as n from public.tusken_ships where faction = 'Combine'")).n) === 0);
        ok("the Tusken work for the captor",
            Number((await one(db, "select amount from public.tusken_workforce where planet = 'Ultramars' and faction = 'Freedom Authority'")).amount) === 2000);
        ok("and the captor is paid for them",
            Number(await rpc(db, "select public.tusken_income_bonus('Ultramars', 'Freedom Authority') as v")) === 2);

        /* ---- a slaving fleet is not a warship ---- */
        await db.exec(`
            insert into public.fleets (player_id, faction, name, status, origin, squads)
            values ('${AUTH}', 'Combine', 'Hammer of Mars', 'stationed', 'Tuskara',
                    '[{"type":"Rifle","amount":5,"soldiers":5000}]'::jsonb)`);
        const hammer = (await one(db, "select id from public.fleets where name = 'Hammer of Mars'")).id;

        err = await expectError(db, "select public.tusken_buy_ship('" + hammer + "')");
        ok("a hull does not join a military fleet", err && /transport fleet/.test(err), err);
        ok("and the warship gets no lift of its own",
            Number(await rpc(db, "select public.tusken_fleet_lift('" + hammer + "') as v")) === 0);

        const cargo = await rpc(db, "select public.tusken_new_fleet('Cargo Test') as s");

        err = await expectError(db,
            "update public.fleets set squads = '[{\"type\":\"Rifle\",\"amount\":1,\"soldiers\":1000}]'::jsonb where id = '" + cargo.id + "'");
        ok("no soldier is raised into a slaving fleet", err && /carries Tusken, not soldiers/.test(err), err);
        ok("and its squads stay empty",
            Number((await one(db, "select jsonb_array_length(squads) as n from public.fleets where id = $1", [cargo.id])).n) === 0);

        state = await rpc(db, "select public.tusken_world() as s");
        ok("the screen marks the cargo fleet",
            state.fleets.filter(function(f) { return f.id === cargo.id; })[0].transport === true, state.fleets);
        ok("and a warship is not marked so",
            state.fleets.filter(function(f) { return f.id === hammer; })[0].transport === false, state.fleets);

        console.log("\n== a frozen world");

        await db.query("update public.game_control set started = false");
        await db.query("update public.tusken_colonies set slaves = 0, last_yield_at = now() - interval '3 hours'");
        tick = await rpc(db, "select public.tusken_tick() as s");
        ok("a frozen world catches nothing", tick && tick.frozen === true, tick);
        ok("and the pens stay empty", Number((await one(db, "select coalesce(sum(slaves),0) as n from public.tusken_colonies")).n) === 0);
        await db.query("update public.game_control set started = true");

        console.log("\n== what a rival's settlement shows");

        state = await rpc(db, "select public.tusken_world() as s");

        const rival = state.colonies.filter(function(c) { return Number(c.id) === Number(theirs.id); })[0];

        ok("a rival settlement is on the dust as a marker", !!rival, state.colonies);
        ok("but it is not known", rival && rival.known === false, rival);
        ok("no name is sent", rival && rival.name === undefined, rival);
        ok("no owner is sent", rival && rival.faction === undefined, rival);
        ok("no pens are sent", rival && rival.slaves === undefined, rival);
        ok("its place on the globe is still sent, so the marker can stand",
            rival && Number(rival.x) > 0 && Number(rival.y) > 0, rival);

        const own = state.colonies.filter(function(c) { return c.mine === true; })[0];
        ok("our own settlement is known without a spy", own && own.known === true, own && own.known);
        ok("and keeps its numbers", own && own.name === "Red Hollow" && Number(own.slaves) >= 0, own && own.name);
        ok("the spy has a price on the screen", Number(state.spy.price) === 250, state.spy);
        ok("and a clock", Number(state.spy.seconds) === 1800, state.spy);

        console.log("\n== sending a spy");

        err = await expectError(db, "select public.tusken_spy(" + colonies[0].id + ")");
        ok("we do not spy on our own", err && /no spy is needed/.test(err), err);

        err = await expectError(db, "select public.tusken_spy(999999)");
        ok("a settlement that does not exist is refused", err && /no such settlement/i.test(err), err);

        cash = await credits();
        const spy = await rpc(db, "select public.tusken_spy(" + theirs.id + ") as s");

        ok("a spy is sent into a rival's camp", spy && spy.ok === true, spy);
        ok("the spy cost 250", (await credits()) === cash - 250, await credits());
        ok("he comes back with the numbers",
            spy && spy.slaves !== undefined && spy.name !== undefined && Number(spy.size) >= 1, spy);

        state = await rpc(db, "select public.tusken_world() as s");

        const seen = state.colonies.filter(function(c) { return Number(c.id) === Number(theirs.id); })[0];

        ok("the settlement is known now", seen && seen.known === true && seen.spied === true, seen);
        ok("with its name", seen && seen.name === spy.name, seen && seen.name);
        ok("and its pens", seen && Number(seen.slaves) === Number(spy.slaves), seen && seen.slaves);
        ok("the spy's clock runs on the screen", seen && Number(seen.spied_left) > 1700, seen && seen.spied_left);

        err = await expectError(db, "select public.tusken_spy(" + theirs.id + ")");
        ok("a second spy is refused while the first is inside", err && /still inside/.test(err), err);

        await db.query("update public.tusken_intel set spied_until = now() - interval '1 minute'");
        state = await rpc(db, "select public.tusken_world() as s");

        const dark = state.colonies.filter(function(c) { return Number(c.id) === Number(theirs.id); })[0];

        ok("when the spy comes out the camp goes dark again", dark && dark.known === false, dark);
        ok("and its name is gone from the answer", dark && dark.name === undefined, dark);

        console.log("\n== a fleet of transports, and no congress");

        ok("a transport fleet costs 300",
            Number(await rpc(db, "select public.tusken_transport_fleet_price() as v")) === 300);
        ok("a faction may keep four",
            Number(await rpc(db, "select public.tusken_transport_fleet_max() as v")) === 4);
        ok("this install has no congress table at all",
            (await one(db, "select to_regclass('public.cs_authorizations') as t")).t === null &&
            (await one(db, "select to_regclass('public.cg_authorizations') as t")).t === null);

        await as(db, AUTH);

        cash = await credits();
        const coffins = await rpc(db, "select public.tusken_new_fleet('Coffin Ships') as s");

        ok("a transport fleet is raised without a bill", coffins && coffins.ok === true, coffins);
        ok("it cost 300", (await credits()) === cash - 300, await credits());
        ok("it is named", coffins.name === "Coffin Ships", coffins.name);

        const coffinRow = await one(db, "select * from public.fleets where id = $1", [coffins.id]);

        ok("it is flagged a transport fleet", coffinRow.transport_fleet === true, coffinRow.transport_fleet);
        ok("it flies no soldiers", Array.isArray(coffinRow.squads) && coffinRow.squads.length === 0, coffinRow.squads);
        ok("it stands at Tuskara", coffinRow.origin === "Tuskara" && coffinRow.status === "stationed", coffinRow);
        ok("and it belongs to us", coffinRow.faction === "Combine", coffinRow.faction);

        state = await rpc(db, "select public.tusken_world() as s");
        ok("the screen counts transport fleets", Number(state.transport_fleets.used) === 2, state.transport_fleets);
        ok("and shows the limit", Number(state.transport_fleets.max) === 4);

        await rpc(db, "select public.tusken_buy_ship('" + coffins.id + "') as s");
        ok("a hull joins the new fleet",
            Number(await rpc(db, "select public.tusken_fleet_lift('" + coffins.id + "') as v")) === 1000);

        await rpc(db, "select public.tusken_new_fleet('Coffin Ships') as s");
        const twinned = await one(db, "select name from public.fleets where transport_fleet and id <> $1 order by name", [coffins.id]);
        ok("a second fleet with the same name gets its own", twinned && twinned.name !== "Coffin Ships", twinned);

        await rpc(db, "select public.tusken_new_fleet(null) as s");

        err = await expectError(db, "select public.tusken_new_fleet('A Fifth')");
        ok("a fifth transport fleet is refused", err && /at most 4/.test(err), err);

        console.log("\n== a slave fleet made before the rule");

        /* an older save: an ordinary fleet, troops aboard, a hull in its hold and
           a squad already paid for and queued */
        await db.exec(`
            insert into public.fleets (player_id, faction, name, status, origin, squads)
            values ('${AUTH}', 'Combine', 'Old Slaver', 'stationed', 'Tuskara',
                    '[{"type":"MG","amount":1,"soldiers":750},
                      {"type":"Assault","amount":1,"soldiers":1000}]'::jsonb)`);

        const oldSlaver = (await one(db, "select id from public.fleets where name = 'Old Slaver'")).id;

        await db.query("insert into public.tusken_ships (faction, player_id, name, capacity, fleet_id) values ('Combine', $1, 'Old Hull', 2500, $2)", [AUTH, oldSlaver]);
        await db.query("insert into public.fleet_recruits (fleet_id, squad_type, ready_at) values ($1, 'Assault', now() + interval '1 minute')", [oldSlaver]);

        await db.exec(fs.readFileSync(path.join(ROOT, "sql", "2026-11-31_the_cargo_holds_no_troops.sql"), "utf8"));

        const slaver = await one(db, "select transport_fleet, jsonb_array_length(squads) as n from public.fleets where id = $1", [oldSlaver]);

        ok("a fleet holding a hull is made a cargo fleet", slaver.transport_fleet === true, slaver);
        ok("its MGs and assaults are disbanded", Number(slaver.n) === 0, slaver);
        ok("its hull is the small one",
            Number((await one(db, "select capacity from public.tusken_ships where fleet_id = $1", [oldSlaver])).capacity) === 1000);
        ok("the squad it was training is dropped",
            Number((await one(db, "select count(*) as n from public.fleet_recruits where fleet_id = $1", [oldSlaver])).n) === 0);

        err = await expectError(db,
            "insert into public.fleet_recruits (fleet_id, squad_type, ready_at) values ('" + oldSlaver + "', 'MG', now() + interval '1 minute')");
        ok("and no new squad can be queued into it", err && /carries Tusken, not soldiers/.test(err), err);

        await db.query("insert into public.fleet_recruits (fleet_id, squad_type, ready_at) values ($1, 'MG', now() + interval '1 minute')", [hammer]);
        ok("a warship still raises its own",
            Number((await one(db, "select count(*) as n from public.fleet_recruits where fleet_id = $1", [hammer])).n) === 1);

        console.log("\n== the ledger of the Tusken");

        await db.query("update public.tusken_workforce set amount = 3000 where planet = 'Krieg' and faction = 'Combine'");

        const ledger = await rpc(db, "select public.tusken_ledger() as s");

        ok("the ledger reads for the faction", ledger && ledger.me === "Combine", ledger);
        ok("the pens on Tuskara are counted", Number(ledger.pens) === Number((
            await one(db, "select coalesce(sum(slaves),0) as n from public.tusken_colonies where faction = 'Combine'")
        ).n), ledger.pens);
        ok("the Tusken at work are counted", Number(ledger.at_work) === Number((
            await one(db, "select coalesce(sum(amount),0) as n from public.tusken_workforce where faction = 'Combine'")
        ).n), ledger.at_work);
        ok("the total is the two together", Number(ledger.total) === Number(ledger.pens) + Number(ledger.at_work), ledger.total);
        ok("the worlds are listed", ledger.worlds.some(function(w) { return w.planet === "Krieg"; }), ledger.worlds);

        const kriegRow = ledger.worlds.filter(function(w) { return w.planet === "Krieg"; })[0];

        ok("Krieg's row carries its count", kriegRow && Number(kriegRow.amount) === 3000, kriegRow);
        ok("and what those 3,000 pay", kriegRow && Number(kriegRow.bonus) === 3, kriegRow);
        ok("a world we do not hold is marked so",
            ledger.worlds.some(function(w) { return w.held === false; }) === false, ledger.worlds);

        console.log("\n== the lanes of the slave trade");

        const lanes = await rpc(db, "select public.tusken_trade_routes() as s");

        ok("the map reads its own lanes", lanes && lanes.me === "Combine", lanes);

        const kriegLane = (lanes.routes || []).filter(function(r) {
            return r.from === "Tuskara" && r.to === "Krieg";
        })[0];

        ok("the crossing just sailed is a lane", !!kriegLane, lanes.routes);
        ok("with its crossings counted", kriegLane && Number(kriegLane.trips) >= 2, kriegLane && kriegLane.trips);
        ok("and the Tusken it carried", kriegLane && Number(kriegLane.slaves) >= 1000, kriegLane && kriegLane.slaves);
        ok("both ends are placed for the drawing",
            kriegLane && Number(kriegLane.x1) > 0 && Number(kriegLane.x2) > 0, kriegLane);
        ok("the busiest is marked", kriegLane && kriegLane.major === true, kriegLane && kriegLane.major);
        ok("and carries the full weight", kriegLane && Number(kriegLane.weight) === 1,
            kriegLane && kriegLane.weight);
        ok("no more than eight lanes are sent", (lanes.routes || []).length <= 8, lanes.routes);

        /* the other side's book never carries our lane */
        await as(db, FREE);
        const theirLanes = await rpc(db, "select public.tusken_trade_routes() as s");
        ok("the other faction is told its own name",
            theirLanes && theirLanes.me === "Freedom Authority", theirLanes && theirLanes.me);
        ok("and never our lane",
            (theirLanes.routes || []).every(function(r) {
                return !(r.from === "Tuskara" && r.to === "Krieg");
            }), theirLanes.routes);
        await as(db, AUTH);

        console.log("\n== the host's reset");

        await as(db, FREE);
        err = await expectError(db, "select public.tusken_world_reset()");
        ok("only the host may wipe Tuskara", err && /Only the host/.test(err), err);

        await as(db, AUTH);
        await rpc(db, "select public.tusken_world_reset() as s");
        ok("the settlements are gone", Number((await one(db, "select count(*) as n from public.tusken_colonies")).n) === 0);
        ok("the workforce is gone", Number((await one(db, "select count(*) as n from public.tusken_workforce")).n) === 0);
        ok("the convoys are gone", Number((await one(db, "select count(*) as n from public.tusken_convoys")).n) === 0);
        ok("the hulls are gone", Number((await one(db, "select count(*) as n from public.tusken_ships")).n) === 0);
        ok("the spies are gone", Number((await one(db, "select count(*) as n from public.tusken_intel")).n) === 0);
        ok("the transport fleets are gone",
            Number((await one(db, "select count(*) as n from public.fleets where transport_fleet")).n) === 0);
        ok("the lanes of the trade are gone",
            Number((await one(db, "select count(*) as n from public.tusken_routes")).n) === 0);
        ok("the world itself stays on the map", !!(await one(db, "select 1 as x from public.planets where name = 'Tuskara'")));

        await db.close();

        /* ------------------------------------------------------------------
           A database that keys planets by a NUMBER (the live install does):
           the row cannot be inserted by name alone and needs the next id.
        ------------------------------------------------------------------ */

        console.log("\n== an install that keys planets by a number");

        const serial = new PGlite();

        await serial.exec(`
            create schema if not exists auth;
            create or replace function auth.uid() returns uuid language sql stable
            as $$ select nullif(current_setting('test.me', true), '')::uuid $$;

            create table public.players (id uuid primary key, faction text);
            insert into public.players (id, faction) values
                ('${AUTH}', 'Combine'), ('${FREE}', 'Freedom Authority');

            create table public.faction_treasury (faction text primary key, credits numeric default 0,
                last_income_at timestamptz);
            insert into public.faction_treasury (faction, credits) values ('Combine', 5000), ('Freedom Authority', 5000);

            /* the live shape that broke the first patch: a NOT NULL id with no default */
            create table public.planets (id integer primary key, name text unique,
                kind text, region text, income integer default 100);
            insert into public.planets (id, name, income) values (1, 'Ultramars', 100), (2, 'Free Earth', 100);

            create table public.planet_positions (name text primary key, x numeric, y numeric);
            insert into public.planet_positions (name, x, y) values
                ('Ultramars', 10, 19), ('Free Earth', 89, 84);

            create table public.cities (id serial primary key, planet_id integer, faction text);
            insert into public.cities (planet_id, faction) values (1, 'Combine'), (2, 'Freedom Authority');

            ${FLEETS}

            create or replace function public.planet_income(p_planet text) returns bigint
            language sql stable security definer set search_path to ''
            as $$ select coalesce((select p.income from public.planets as p where p.name = p_planet), 0)::bigint $$;
        `);

        await applyAll(serial);

        const row = await one(serial, "select id, name, income from public.planets where name = 'Tuskara'");
        ok("the world is inserted on a numbered install", !!row, row);
        ok("it got the next free id", row && Number(row.id) === 3, row);
        ok("and its own income", row && Number(row.income) === 60, row);
        ok("its place on the map is written", !!(await one(serial, "select 1 as x from public.planet_positions where name = 'Tuskara'")));

        const seq = await one(serial, "select pg_get_serial_sequence('public.planets', 'id') as s");
        ok("a hand-keyed table has no sequence to move", seq.s === null, seq);

        await applyAll(serial);
        ok("a second run adds nothing",
            Number((await one(serial, "select count(*) as n from public.planets where name = 'Tuskara'")).n) === 1);

        await as(serial, AUTH);
        await serial.exec(`
            insert into public.fleets (player_id, faction, name, status, origin)
            values ('${AUTH}', 'Combine', 'Hammer of Mars', 'stationed', 'Tuskara')`);
        const founded = await rpc(serial, "select public.tusken_found_colony() as s");
        ok("the settlements still work on a numbered install", founded && founded.ok === true, founded);

        const screen = await rpc(serial, "select public.tusken_world() as s");
        ok("and the screen reads", screen && screen.colonies.length === 1, screen && screen.colonies);
        ok("with the fleet in orbit", screen && screen.orbit.here === true, screen && screen.orbit);

        await serial.close();

        /* ------------------------------------------------------------------
           The shape the live install really has: a text id, a NOT NULL
           faction, and a NOT NULL column nobody told this patch about.
        ------------------------------------------------------------------ */

        const SHAPES = [
            {
                title: "an install that already has neutral worlds",
                planets: `
                    create table public.planets (
                        id text primary key,
                        name text unique not null,
                        faction text not null,
                        codename text not null,
                        income integer not null default 100);
                    insert into public.planets (id, name, faction, codename, income) values
                        ('Ultramars', 'Ultramars', 'Combine', 'cinder', 100),
                        ('Free Earth', 'Free Earth', 'Freedom Authority', 'garden', 100),
                        ('Veyra', 'Veyra', 'Neutral', 'dust', 50);`,
                cityKey: "text",
                wantId: "Tuskara",
                wantFaction: "Neutral"
            },
            {
                title: "an install where every world is held",
                planets: `
                    create table public.planets (
                        id text primary key,
                        name text unique not null,
                        faction text not null,
                        codename text not null,
                        income integer not null default 100);
                    insert into public.planets (id, name, faction, codename, income) values
                        ('Ultramars', 'Ultramars', 'Combine', 'cinder', 100),
                        ('Free Earth', 'Free Earth', 'Freedom Authority', 'garden', 100);`,
                cityKey: "text",
                wantId: "Tuskara",
                wantFaction: "Independents"
            },
            {
                title: "an empty table with a sequence",
                planets: `
                    create table public.planets (
                        id serial primary key,
                        name text unique not null,
                        faction text not null,
                        income integer not null default 100);`,
                cityKey: "integer",
                wantId: 1,
                wantFaction: "Independents"
            }
        ];

        for (const shape of SHAPES) {

            console.log("\n== " + shape.title);

            const alt = new PGlite();
            await alt.exec(mini(shape.planets, shape.cityKey));
            await applyAll(alt);
            await applyAll(alt);              /* a second run must not double it */

            const world = await one(alt, "select * from public.planets where name = 'Tuskara'");
            ok("the world is inserted", !!world, world);
            ok("it got its key", !!world && (typeof shape.wantId === "number"
                ? Number(world.id) === shape.wantId
                : world.id === shape.wantId), world && world.id);
            ok("its faction is this install's own neutral word",
                !!world && world.faction === shape.wantFaction, world && world.faction);
            ok("and its income is 60", !!world && Number(world.income) === 60, world && world.income);
            if (shape.cityKey === "text") {
                ok("the column nobody told us about is filled",
                    !!world && world.codename !== null && world.codename !== undefined, world && world.codename);
            }
            ok("a second run adds nothing",
                Number((await one(alt, "select count(*) as n from public.planets where name = 'Tuskara'")).n) === 1);

            if (shape.cityKey === "integer") {
                const next = await one(alt,
                    "select nextval(pg_get_serial_sequence('public.planets', 'id')) as n");
                ok("the sequence was moved past the new row", Number(next.n) === 2, next);
            }

            await as(alt, AUTH);
            await alt.exec(`
                insert into public.fleets (player_id, faction, name, status, origin)
                values ('${AUTH}', 'Combine', 'Spear of Ultramar', 'stationed', 'Tuskara')`);
            const col = await rpc(alt, "select public.tusken_found_colony() as s");
            ok("and the settlements work there too", col && col.ok === true, col);

            await alt.close();
        }

    } catch (e) {

        fail++;
        console.log("\nCRASH: " + String(e && e.stack ? e.stack : e).split("\n").slice(0, 6).join("\n"));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

})();
