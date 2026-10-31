/* Hostile fleets in the same orbit fight, whoever holds the world.

   The orbit scan used to look only at worlds that are nobody's, so two
   hostile fleets could sit in a capital's orbit for ever without a shot.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/orbit-battle-owned-world-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PATCH = fs.readFileSync(path.join(ROOT, "sql/2026-11-45_orbit_fights_over_held_worlds.sql"), "utf8");

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

create table public.planets (id uuid primary key default gen_random_uuid(), name text not null unique);
insert into public.planets (id, name) values
    ('aaaaaaaa-1111-4111-8111-111111111111', 'Ultramars'),
    ('aaaaaaaa-2222-4111-8111-111111111111', 'Meridia'),
    ('aaaaaaaa-3333-4111-8111-111111111111', 'Veyrona');

create table public.cities (id uuid primary key default gen_random_uuid(), planet_id uuid, faction text);
insert into public.cities (planet_id, faction) values
    ('aaaaaaaa-1111-4111-8111-111111111111', 'Combine'),
    ('aaaaaaaa-2222-4111-8111-111111111111', 'Freedom Authority'),
    ('aaaaaaaa-3333-4111-8111-111111111111', 'Independents');

create table public.planet_positions (name text primary key, x numeric, y numeric);
insert into public.planet_positions (name, x, y) values
    ('Ultramars', 20, 40), ('Meridia', 60, 30), ('Veyrona', 80, 70);

create table public.fleets (
    id uuid primary key default gen_random_uuid(),
    faction text, status text default 'stationed', squads jsonb default '[]'::jsonb,
    player_id uuid, name text, origin text,
    space_x numeric, space_y numeric
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

const SQUADS = `'[{"type":"Rifle","amount":4,"soldiers":4000,"soldiersPerDivision":1000}]'::jsonb`;

async function one(db, sql) {
    const r = await db.query(sql);
    return r.rows[0] || {};
}

async function clear(db) {
    await db.exec("delete from public.space_battle_fleets; delete from public.space_battles; delete from public.fleets;");
}

async function scan(db) {
    const row = await one(db, "select public.orbit_battle_scan() as r");
    return Array.isArray(row.r) ? row.r : [];
}

(async function main() {

    const db = new PGlite();

    try {

        await db.exec(SCHEMA);
        await db.exec(PATCH);
        await db.exec(PATCH);

        ok("the patch runs twice without a word", true);

        console.log("\n== a world somebody holds");

        await clear(db);
        await db.exec(`
            insert into public.fleets (faction, status, squads, name, origin) values
                ('Combine', 'stationed', ${SQUADS}, 'Home Guard', 'Ultramars'),
                ('Freedom Authority', 'stationed', ${SQUADS}, 'Test', 'Ultramars');
        `);

        const held = await scan(db);

        ok("two hostile fleets in a capital's orbit fight",
            held.length === 1 && held[0].planet === "Ultramars", held);
        ok("both are engaged",
            Number((await one(db, "select count(*)::int as n from public.fleets where status = 'engaged'")).n) === 2);
        ok("and cleared from any parked spot",
            Number((await one(db, "select count(*)::int as n from public.fleets where space_x is not null")).n) === 0);

        console.log("\n== a world of the intruder's own side");

        await clear(db);
        await db.exec(`
            insert into public.fleets (faction, status, squads, name, origin) values
                ('Freedom Authority', 'stationed', ${SQUADS}, 'Garrison', 'Meridia'),
                ('Combine', 'stationed', ${SQUADS}, 'Raider', 'Meridia');
        `);

        ok("a raid on a held world's orbit fights too", (await scan(db)).length === 1);

        console.log("\n== and what must still be quiet");

        await clear(db);
        await db.exec(`
            insert into public.fleets (faction, status, squads, name, origin) values
                ('Freedom Authority', 'stationed', ${SQUADS}, 'One', 'Veyrona'),
                ('Freedom Authority', 'stationed', ${SQUADS}, 'Two', 'Veyrona');
        `);

        ok("two fleets of one side never fight", (await scan(db)).length === 0);

        await clear(db);
        await db.exec(`
            insert into public.fleets (faction, status, squads, name, origin) values
                ('Freedom Authority', 'stationed', ${SQUADS}, 'Empty', 'Veyrona'),
                ('Combine', 'stationed', '[]'::jsonb, 'No troops', 'Veyrona');
        `);

        ok("a fleet with no squads is not a fight", (await scan(db)).length === 0);

        await clear(db);
        await db.exec(`
            insert into public.fleets (faction, status, squads, name, origin) values
                ('Freedom Authority', 'travelling', ${SQUADS}, 'Passing', 'Veyrona'),
                ('Combine', 'stationed', ${SQUADS}, 'Parked', 'Veyrona');
        `);

        ok("a travelling fleet is the deep-space scan's business", (await scan(db)).length === 0);

        await clear(db);
        await db.exec(`
            insert into public.fleets (faction, status, squads, name, origin) values
                ('Freedom Authority', 'stationed', ${SQUADS}, 'A', 'Veyrona'),
                ('Combine', 'stationed', ${SQUADS}, 'B', 'Veyrona');
            insert into public.space_battles (kind, planet, x, y, status)
            values ('orbit', 'Veyrona', 80, 70, 'pending');
        `);

        ok("one live battle per orbit is still the rule", (await scan(db)).length === 0);

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}());
