/* Two hostile fleets flying at each other must fight on the way.

   The scan was asking space_positions(), which only knows fleets carrying a
   stored point (space_x/space_y): a fleet under way has none, so travelling
   fleets were never in the list and no radius could have caught them. The
   patch places a fleet on its route by the clock instead.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/fleets-meet-on-the-way-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const SCAN = fs.readFileSync(path.join(ROOT, "sql/2026-11-41_fleets_find_each_other_sooner.sql"), "utf8");
const PATCH = fs.readFileSync(path.join(ROOT, "sql/2026-11-44_fleets_meet_on_the_way.sql"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

const SCHEMA = `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;

create table public.game_control (id int primary key, started boolean default true);
insert into public.game_control (id, started) values (1, true);

create or replace function public.game_frozen() returns boolean language sql stable as $$ select false $$;
create or replace function public.space_fleet_power(p_squads jsonb) returns numeric language sql immutable as $$ select 1 $$;

create table public.planet_positions (name text primary key, x numeric, y numeric);
insert into public.planet_positions (name, x, y) values
    ('Krieg', 10, 50), ('Kara', 90, 50), ('Vraks', 50, 5);

create table public.fleets (
    id uuid primary key default gen_random_uuid(),
    faction text, status text default 'in_space', squads jsonb default '[]'::jsonb,
    player_id uuid, name text,
    origin text, destination text,
    from_x numeric, from_y numeric, dest_x numeric, dest_y numeric,
    space_x numeric, space_y numeric,
    departure_time timestamptz, arrival_time timestamptz
);

create table public.space_battles (
    id uuid primary key default gen_random_uuid(),
    kind text, planet text, x numeric, y numeric, status text default 'pending'
);

create table public.space_battle_fleets (
    id serial primary key, battle_id uuid, fleet_id uuid, side text,
    player_id uuid, faction text, fleet_name text, prev_status text, squads jsonb
);
`;

async function one(db, sql) {
    const r = await db.query(sql);
    return r.rows[0] || {};
}

async function clear(db) {
    await db.exec("delete from public.space_battle_fleets; delete from public.space_battles; delete from public.fleets;");
}

async function battles(db) {
    const row = await one(db, "select public.space_battle_scan() as r");
    return Array.isArray(row.r) ? row.r.length : 0;
}

(async function main() {

    const db = new PGlite();

    try {

        await db.exec(SCHEMA);
        await db.exec(SCAN);          /* the radius and the scan it replaced */
        await db.exec(PATCH);
        await db.exec(PATCH);         /* running it twice must be harmless */

        ok("the patch runs twice without a word", true);

        console.log("\n== two fleets flying at each other");

        await clear(db);
        await db.exec(`
            insert into public.fleets (faction, status, squads, name, origin, destination, departure_time, arrival_time)
            values
                ('Combine', 'travelling', '[]'::jsonb, 'Red', 'Krieg', 'Kara',
                 now() - interval '50 seconds', now() + interval '50 seconds'),
                ('Freedom Authority', 'travelling', '[]'::jsonb, 'Blue', 'Kara', 'Krieg',
                 now() - interval '50 seconds', now() + interval '50 seconds');
        `);

        const half = await one(db, "select x, y from public.space_fleet_points() where x is not null limit 1");

        ok("a fleet halfway is drawn halfway on its route",
            Math.abs(Number(half.x) - 50) <= 1.5 && Math.abs(Number(half.y) - 50) <= 1.5, half);

        ok("they meet on the way and fight", (await battles(db)) === 1);
        ok("both are marked engaged",
            Number((await one(db, "select count(*)::int as n from public.fleets where status = 'engaged'")).n) === 2);

        console.log("\n== a fleet passing a fleet at rest");

        await clear(db);
        await db.exec(`
            insert into public.fleets (faction, status, squads, name, origin, destination, departure_time, arrival_time)
            values ('Combine', 'travelling', '[]'::jsonb, 'Red', 'Krieg', 'Kara',
                    now() - interval '50 seconds', now() + interval '50 seconds');
            insert into public.fleets (faction, status, squads, name, space_x, space_y)
            values ('Freedom Authority', 'in_space', '[]'::jsonb, 'Blue', 50, 52);
        `);

        ok("a fleet in their path is caught too", (await battles(db)) === 1);

        console.log("\n== and the ones that must not fight");

        await clear(db);
        await db.exec(`
            insert into public.fleets (faction, status, squads, name, origin, destination, departure_time, arrival_time)
            values ('Combine', 'travelling', '[]'::jsonb, 'Red', 'Krieg', 'Kara',
                    now() - interval '50 seconds', now() + interval '50 seconds');
            insert into public.fleets (faction, status, squads, name, space_x, space_y)
            values ('Freedom Authority', 'in_space', '[]'::jsonb, 'Blue', 80, 50);
        `);

        ok("thirty units apart is still not a fight", (await battles(db)) === 0);

        await clear(db);
        await db.exec(`
            insert into public.fleets (faction, status, squads, name, origin, destination, departure_time, arrival_time)
            values
                ('Combine', 'travelling', '[]'::jsonb, 'Red', 'Krieg', 'Kara',
                 now() - interval '50 seconds', now() + interval '50 seconds'),
                ('Freedom Authority', 'travelling', '[]'::jsonb, 'Blue', 'Kara', 'Krieg',
                 now() + interval '50 seconds', now() + interval '150 seconds');
        `);

        ok("a fleet that has not left yet is still at its own world", (await battles(db)) === 0);

        console.log("\n== the rest of the map still works");

        await clear(db);
        await db.exec(`
            insert into public.fleets (faction, status, squads, name, space_x, space_y)
            values
                ('Combine', 'in_space', '[]'::jsonb, 'Red', 40, 40),
                ('Freedom Authority', 'in_space', '[]'::jsonb, 'Blue', 45, 40);
        `);

        ok("two fleets parked near each other still fight", (await battles(db)) === 1);

        await clear(db);
        await db.exec(`
            insert into public.fleets (faction, status, squads, name, origin, destination,
                                       from_x, from_y, departure_time, arrival_time)
            values ('Combine', 'travelling', '[]'::jsonb, 'Red', 'Deep space', 'Krieg', 30, 20,
                    now() - interval '50 seconds', now() + interval '50 seconds');
        `);

        const deep = await one(db, "select x, y from public.space_fleet_points() where x is not null limit 1");

        ok("a fleet that left deep space is measured from where it left",
            Math.abs(Number(deep.x) - 20) <= 1.5 && Math.abs(Number(deep.y) - 35) <= 1.5, deep);

        await clear(db);
        await db.exec(`
            insert into public.fleets (faction, status, squads, name, origin, destination)
            values ('Combine', 'travelling', '[]'::jsonb, 'Red', 'Krieg', 'Kara');
        `);

        const undated = await one(db, "select x from public.space_fleet_points() where x is not null limit 1");

        ok("a trip with no clock is put at its destination rather than dropped",
            Math.abs(Number(undated.x) - 90) <= 0.5, undated);

        console.log("\n== and the old source is no longer asked");

        const body = fs.readFileSync(path.join(ROOT, "sql/2026-11-44_fleets_meet_on_the_way.sql"), "utf8");

        ok("the scan reads the new points",
            /from public\.space_fleet_points\(\) as pa_/.test(body) &&
            !/from public\.space_positions\(\)/.test(body));
        ok("the radius is untouched", /space_engage_radius\(\)/.test(body));

        await db.close();

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}());
