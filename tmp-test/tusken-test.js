/* Run sql/2026-11-26_the_tusken_world.sql against a real PostgreSQL (PGlite,
   the WASM build) with stand-ins for the game's older tables, then work
   Tuskara as the Combine: found colonies, grow them, watch the bands bring
   the Tusken in, buy transports, land the loads and read the money.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/tusken-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");

const AUTH = "11111111-1111-4111-8111-111111111111";   // the Combine player
const COMB = "22222222-2222-4222-8222-222222222222";   // a second Combine player
const FREE = "33333333-3333-4333-8333-333333333333";   // a Freedom Authority player

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

function near(a, b, slack) {
    return Math.abs(Number(a) - Number(b)) <= (slack === undefined ? 2 : slack);
}

const SCHEMA = `
create schema if not exists auth;

create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.me', true), '')::uuid $$;

create table public.players (id uuid primary key, faction text);
insert into public.players (id, faction) values
    ('${AUTH}', 'Combine'),
    ('${COMB}', 'Combine'),
    ('${FREE}', 'Freedom Authority');

create table public.game_control (id int primary key, started boolean not null default true,
    maintenance boolean not null default false, host_player uuid);
insert into public.game_control (id, started, maintenance, host_player)
values (1, true, false, '${AUTH}');

create table public.faction_treasury (faction text primary key, credits numeric default 0,
    last_income_at timestamptz);
insert into public.faction_treasury (faction, credits, last_income_at) values
    ('Combine', 20000, now() - interval '5 minutes'),
    ('Freedom Authority', 20000, now() - interval '5 minutes');

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
        await db.exec(fs.readFileSync(path.join(ROOT, "sql", "2026-11-26_the_tusken_world.sql"), "utf8"));

        console.log("\n== the world itself");

        const world = await one(db, "select * from public.planets where name = 'Tuskara'");
        ok("Tuskara is on the map as a planet", !!world);

        const pos = await one(db, "select x, y from public.planet_positions where name = 'Tuskara'");
        ok("Tuskara has a place on the map", pos && Number(pos.x) === 44 && Number(pos.y) === 92, pos);

        /* the spot is far from both capitals: on this map each hop is about
           nine points, so anything past 27 from a capital is three worlds */
        const gaps = await q(db, `
            select c.name as capital,
                   sqrt(power(t.x - c.x, 2) + power(t.y - c.y, 2)) as gap
            from public.planet_positions as c
            cross join public.planet_positions as t
            where t.name = 'Tuskara' and c.name in ('Ultramars', 'Free Earth')`);
        ok("Tuskara is at least three worlds from either capital",
            gaps.length === 2 && gaps.every(function(g) { return Number(g.gap) >= 27; }),
            gaps.map(function(g) { return g.capital + " " + Number(g.gap).toFixed(1); }));

        console.log("\n== the screen before anything is built");

        await as(db, AUTH);

        let state = await rpc(db, "select public.tusken_world() as s");
        ok("an empty world reads", state && state.planet === "Tuskara", state);
        ok("no colonies yet", state.my_colonies === 0);
        ok("no Tusken captured yet", Number(state.pool) === 0);
        ok("the first colony costs 500", state.prices.colony === 500, state.prices);
        ok("a transport takes 2500", Number(state.prices.capacity) === 2500);
        ok("10,000 Tusken make a credit", Number(state.prices.per_credit) === 10000);
        ok("Krieg is offered as a destination", state.destinations.some(function(d) { return d.planet === "Krieg"; }));
        ok("Asteron is not (we do not hold it)", !state.destinations.some(function(d) { return d.planet === "Asteron"; }));
        ok("the homeworld is not offered to itself", !state.destinations.some(function(d) { return d.planet === "Tuskara"; }));
        ok("a level-one colony holds 1500", Number(await rpc(db, "select public.tusken_capacity(1,1) as v")) === 1500);
        ok("a level-one colony takes 500 an hour", Number(await rpc(db, "select public.tusken_yield_per_hour(1,1) as v")) === 500);

        console.log("\n== founding");

        const credits = async function() {
            const row = await one(db, "select credits from public.faction_treasury where faction = 'Combine'");
            return Number(row.credits);
        };

        const before = await credits();
        let made = await rpc(db, "select public.tusken_found_colony() as s");
        ok("the first colony is founded", made && made.ok === true, made);
        ok("it took 500 credits", (await credits()) === before - 500);
        ok("it is named", made.name === "Red Hollow", made.name);

        state = await rpc(db, "select public.tusken_world() as s");
        ok("the screen shows one colony", state.colonies.length === 1);
        ok("it is mine", state.colonies[0].mine === true);
        ok("the next colony costs 750", state.prices.colony === 750, state.prices.colony);

        await rpc(db, "select public.tusken_found_colony() as s");
        await rpc(db, "select public.tusken_found_colony() as s");
        let err = await expectError(db, "select public.tusken_found_colony()");
        ok("a fourth colony is refused", err && /another colony/.test(err), err);

        const colonies = await q(db, "select id, name from public.tusken_colonies order by id");
        ok("three colonies now stand", colonies.length === 3);

        console.log("\n== the bands bring the Tusken in");

        await db.query("update public.tusken_colonies set slaves = 0, last_yield_at = now() - interval '1 hour' where id = $1", [colonies[0].id]);
        let tick = await rpc(db, "select public.tusken_tick() as s");
        ok("the tick ran", tick && tick.ok === true, tick);

        let stock = await one(db, "select slaves from public.tusken_colonies where id = $1", [colonies[0].id]);
        ok("an hour of catching is about 500", near(stock.slaves, 500), stock.slaves);

        await db.query("update public.tusken_colonies set slaves = 0, last_yield_at = now() - interval '10 hours' where id = $1", [colonies[0].id]);
        await rpc(db, "select public.tusken_tick() as s");
        stock = await one(db, "select slaves from public.tusken_colonies where id = $1", [colonies[0].id]);
        ok("the pens stop a colony at its cap", Number(stock.slaves) === 1500, stock.slaves);

        console.log("\n== growing a colony");

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

        /* the other side's colony is not ours to grow */
        await as(db, FREE);
        await rpc(db, "select public.tusken_found_colony() as s");
        const theirs = await one(db, "select id from public.tusken_colonies where faction = 'Freedom Authority'");
        await as(db, AUTH);
        err = await expectError(db, "select public.tusken_upgrade(" + theirs.id + ", 'catch')");
        ok("another faction's colony is refused", err && /answers to/.test(err), err);

        console.log("\n== buying a transport and landing it");

        await db.query("update public.tusken_colonies set slaves = 1500 where id = $1", [colonies[0].id]);
        cash = await credits();
        let ship = await rpc(db, "select public.tusken_ship('Tuskara', 'Krieg', 1000) as s");
        ok("the ship left", ship && ship.ok === true && ship.amount === 1000, ship);
        ok("it cost 350", (await credits()) === cash - 350);
        ok("the pens were emptied by the load", Number((await one(db, "select slaves from public.tusken_colonies where id = $1", [colonies[0].id])).slaves) === 500);
        ok("a load is in transit", Number((await one(db, "select count(*) as n from public.tusken_convoys")).n) === 1);
        ok("the road takes time", ship.seconds >= 60, ship.seconds);

        await as(db, AUTH);
        state = await rpc(db, "select public.tusken_world() as s");
        ok("the convoy is on the screen", state.convoys.length === 1, state.convoys);

        /* land it */
        await db.query("update public.tusken_convoys set arrival_at = now() - interval '1 second'");
        await rpc(db, "select public.tusken_tick() as s");
        const landed = await one(db, "select amount from public.tusken_workforce where planet = 'Krieg' and faction = 'Combine'");
        ok("the load is at work on Krieg", landed && Number(landed.amount) === 1000, landed);
        ok("the convoy is gone", Number((await one(db, "select count(*) as n from public.tusken_convoys")).n) === 0);

        console.log("\n== the money the slaves make");

        ok("1,000 Tusken pay nothing yet", Number(await rpc(db, "select public.tusken_income_bonus('Krieg', 'Combine') as v")) === 0);
        ok("the homeworld never pays", Number(await rpc(db, "select public.tusken_income_bonus('Tuskara', 'Combine') as v")) === 0);

        await db.query("update public.tusken_workforce set amount = 25000 where planet = 'Krieg' and faction = 'Combine'");
        ok("25,000 Tusken pay 2", Number(await rpc(db, "select public.tusken_income_bonus('Krieg', 'Combine') as v")) === 2);

        state = await rpc(db, "select public.tusken_world() as s");
        ok("the screen reads the money", state.workforce.length === 1 && Number(state.workforce[0].bonus) === 2, state.workforce);

        const net = await rpc(db, "select public.supply_network('Combine') as s");
        const krieg = net.worlds.filter(function(w) { return w.planet === "Krieg"; })[0];
        ok("Krieg is in the network", !!krieg, net.worlds);
        ok("Krieg pays its base plus the slaves", krieg && Number(krieg.income) === 102, krieg);
        ok("the network reports the slaves", krieg && Number(krieg.slaves) === 25000, krieg);
        ok("the network splits out the slave income", krieg && Number(krieg.slave_income) === 2, krieg);

        /* moving them off Krieg takes the income with them */
        await rpc(db, "select public.tusken_ship('Krieg', 'Ultramars', 2500) as s");
        await db.query("update public.tusken_convoys set arrival_at = now() - interval '1 second'");
        await rpc(db, "select public.tusken_tick() as s");

        ok("Krieg has 22,500 left", Number((await one(db, "select amount from public.tusken_workforce where planet = 'Krieg' and faction = 'Combine'")).amount) === 22500);
        ok("Ultramars got the load", Number((await one(db, "select amount from public.tusken_workforce where planet = 'Ultramars' and faction = 'Combine'")).amount) === 2500);
        await db.query("update public.tusken_workforce set amount = 5000 where planet = 'Krieg' and faction = 'Combine'");
        ok("5,000 Tusken pay nothing: the income left with them", Number(await rpc(db, "select public.tusken_income_bonus('Krieg', 'Combine') as v")) === 0);

        console.log("\n== what a ship will not do");

        err = await expectError(db, "select public.tusken_ship('Tuskara', 'Asteron', 500)");
        ok("a world we do not hold is refused", err && /you hold whole/.test(err), err);
        err = await expectError(db, "select public.tusken_ship('Tuskara', 'Tuskara', 500)");
        ok("the homeworld is not a destination", err && /already there|hold whole/.test(err), err);
        await db.query("update public.tusken_colonies set slaves = 0");
        err = await expectError(db, "select public.tusken_ship('Tuskara', 'Krieg', 500)");
        ok("an empty pen cannot ship", err && /no Tusken/.test(err), err);

        await db.query("update public.tusken_colonies set slaves = 5000 where id = $1", [colonies[0].id]);
        ship = await rpc(db, "select public.tusken_ship('Tuskara', 'Krieg', 9000) as s");
        ok("a bigger load is clamped to one ship", Number(ship.amount) === 2500, ship);

        console.log("\n== a frozen world");

        await db.query("update public.game_control set started = false");
        await db.query("update public.tusken_colonies set slaves = 0, last_yield_at = now() - interval '3 hours'");
        tick = await rpc(db, "select public.tusken_tick() as s");
        ok("a frozen world catches nothing", tick && tick.frozen === true, tick);
        ok("and the pens stay empty", Number((await one(db, "select coalesce(sum(slaves),0) as n from public.tusken_colonies")).n) === 0);
        await db.query("update public.game_control set started = true");

        console.log("\n== the host's reset");

        await as(db, FREE);
        err = await expectError(db, "select public.tusken_world_reset()");
        ok("only the host may wipe Tuskara", err && /Only the host/.test(err), err);

        await as(db, AUTH);
        await rpc(db, "select public.tusken_world_reset() as s");
        ok("the colonies are gone", Number((await one(db, "select count(*) as n from public.tusken_colonies")).n) === 0);
        ok("the workforce is gone", Number((await one(db, "select count(*) as n from public.tusken_workforce")).n) === 0);
        ok("the convoys are gone", Number((await one(db, "select count(*) as n from public.tusken_convoys")).n) === 0);
        ok("the world itself stays on the map", !!(await one(db, "select 1 as x from public.planets where name = 'Tuskara'")));

        await db.close();

        /* ------------------------------------------------------------------
           A database that keys planets by a NUMBER (the live install does):
           the row cannot be inserted by name alone and needs the next id.
        ------------------------------------------------------------------ */

        console.log("\n== an install that keys planets by a number");

        const serial = new PGlite();
        const PATCH = fs.readFileSync(path.join(ROOT, "sql", "2026-11-26_the_tusken_world.sql"), "utf8");

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

            create or replace function public.planet_income(p_planet text) returns bigint
            language sql stable security definer set search_path to ''
            as $$ select coalesce((select p.income from public.planets as p where p.name = p_planet), 0)::bigint $$;
        `);

        await serial.exec(PATCH);

        const row = await one(serial, "select id, name, income from public.planets where name = 'Tuskara'");
        ok("the world is inserted on a numbered install", !!row, row);
        ok("it got the next free id", row && Number(row.id) === 3, row);
        ok("and its own income", row && Number(row.income) === 60, row);
        ok("its place on the map is written", !!(await one(serial, "select 1 as x from public.planet_positions where name = 'Tuskara'")));

        /* this shape has no sequence at all, so the setval guard does nothing */
        const seq = await one(serial, "select pg_get_serial_sequence('public.planets', 'id') as s");
        ok("a hand-keyed table has no sequence to move", seq.s === null, seq);

        /* running it again must not add a second Tuskara */
        await serial.exec(PATCH);
        ok("a second run adds nothing", Number((await one(serial, "select count(*) as n from public.planets where name = 'Tuskara'")).n) === 1);

        await as(serial, AUTH);
        const founded = await rpc(serial, "select public.tusken_found_colony() as s");
        ok("the colonies still work on a numbered install", founded && founded.ok === true, founded);

        const screen = await rpc(serial, "select public.tusken_world() as s");
        ok("and the screen reads", screen && screen.colonies.length === 1, screen && screen.colonies);

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
            await alt.exec(PATCH);
            await alt.exec(PATCH);              /* a second run must not double it */

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
                /* a serial column has its own default, but the patch keys it
                   by hand: the sequence must agree with what was written */
                const next = await one(alt,
                    "select nextval(pg_get_serial_sequence('public.planets', 'id')) as n");
                ok("the sequence was moved past the new row", Number(next.n) === 2, next);
            }

            await as(alt, AUTH);
            const col = await rpc(alt, "select public.tusken_found_colony() as s");
            ok("and the colonies work there too", col && col.ok === true, col);

            await alt.close();
        }

    } catch (e) {

        fail++;
        console.log("\nCRASH: " + String(e && e.stack ? e.stack : e).split("\n").slice(0, 6).join("\n"));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

})();
