/* Run sql/2026-11-16_fleets_and_armies.sql against a real PostgreSQL (PGlite,
   the WASM build), with 2026-11-06's own dock underneath it, and read the army.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/fleet-army-test.js */

const fs = require("fs");
const { PGlite } = require("@electric-sql/pglite");

const AUTH = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";
const COMB = "33333333-3333-3333-3333-333333333333";

const A1 = "aaaaaaaa-0000-0000-0000-000000000001";
const A2 = "aaaaaaaa-0000-0000-0000-000000000002";
const A3 = "aaaaaaaa-0000-0000-0000-000000000003";
const B1 = "bbbbbbbb-0000-0000-0000-000000000001";
const C1 = "cccccccc-0000-0000-0000-000000000001";
const A4 = "aaaaaaaa-0000-0000-0000-000000000004";
const A5 = "aaaaaaaa-0000-0000-0000-000000000005";

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
    if (ok) {
        passed++;
        console.log("  ok   " + name);
    } else {
        failed++;
        console.log("  FAIL " + name + (detail !== undefined ? "  :: " + detail : ""));
    }
}

async function call(db, sql) {
    const r = await db.query(sql);
    return r.rows;
}

async function as(db, who) {
    await db.exec("select set_config('test.me', '" + who + "', false)");
}

async function expectError(db, sql) {
    try {
        await db.query(sql);
        return "";
    } catch (e) {
        return String((e && e.message) || e);
    }
}

const squads = (list) => "'" + JSON.stringify(list) + "'::jsonb";

(async function main() {

    const db = new PGlite();

    await db.exec(`
        create schema if not exists auth;

        create or replace function auth.uid()
        returns uuid language sql stable
        as $$ select nullif(current_setting('test.me', true), '')::uuid $$;

        create table public.players (id uuid primary key, username text, faction text);
        insert into public.players values
            ('${AUTH}', 'Hale', 'Freedom Authority'),
            ('${OTHER}', 'Vega', 'Freedom Authority'),
            ('${COMB}', 'Volkov', 'Combine');

        create table public.faction_treasury (faction text primary key, credits numeric not null default 0);
        insert into public.faction_treasury values
            ('Freedom Authority', 5000),
            ('Combine', 5000);

        create table public.fleets (
            id uuid primary key,
            player_id uuid,
            name text,
            faction text,
            origin text,
            destination text,
            status text default 'stationed',
            departure_time timestamptz,
            arrival_time timestamptz,
            squads jsonb default '[]'::jsonb
        );

        create table public.cg_log (id serial primary key, text text, at timestamptz default now());
        create table public.cs_log (id serial primary key, text text, at timestamptz default now());

        create or replace function public.cg_log(p_text text)
        returns void language sql security definer set search_path to ''
        as $$ insert into public.cg_log (text) values (p_text) $$;

        create or replace function public.cs_log(p_text text)
        returns void language sql security definer set search_path to ''
        as $$ insert into public.cs_log (text) values (p_text) $$;
    `);

    /* 2026-11-06's dock, taken from the file itself so the army is repaired by
       exactly the rule the single-fleet button uses */
    const orbits = fs.readFileSync("sql/2026-11-06_orbits_repairs_unrest_and_offices.sql", "utf8");
    const dock = orbits.slice(orbits.indexOf("-- 2. the dock"), orbits.indexOf("-- 3. unrest"));
    await db.exec(dock);

    await db.exec(fs.readFileSync("sql/2026-11-16_fleets_and_armies.sql", "utf8"));

    console.log("\nthe squads the army is read from");

    await db.exec("insert into public.fleets (id, player_id, name, faction, origin, status, squads) values " +
        "('" + A1 + "', '" + AUTH + "', 'Spear of Terra', 'Freedom Authority', 'Free Earth', 'stationed', " +
        squads([{ type: "Rifle", amount: 1, soldiers: 500 }, { type: "MG", amount: 1, soldiers: 750 }]) + "), " +
        "('" + A2 + "', '" + AUTH + "', 'Long Road', 'Freedom Authority', 'Free Earth', 'traveling', " +
        squads([{ type: "Tank", amount: 1, soldiers: 100 }]) + "), " +
        "('" + A3 + "', '" + AUTH + "', 'Quiet Watch', 'Freedom Authority', 'Free Earth', 'stationed', " +
        squads([{ type: "Sniper", amount: 1, soldiers: 400 }]) + "), " +
        "('" + B1 + "', '" + OTHER + "', 'Vega Second', 'Freedom Authority', 'Asteron', 'stationed', " +
        squads([{ type: "Rifle", amount: 1, soldiers: 100 }]) + "), " +
        "('" + C1 + "', '" + COMB + "', 'Krasny Klinok', 'Combine', 'Volst', 'stationed', " +
        squads([{ type: "Rifle", amount: 1, soldiers: 100 }]) + ")");

    await as(db, AUTH);

    const one = (await call(db, "select public.fleet_readiness(x.squads) as r from public.fleets as x where x.id = '" + A1 + "'"))[0].r;
    check("a fleet at seven tenths is under strength",
        one.grade === "under" && Number(one.missing) === 500 && Number(one.full) === 1750,
        JSON.stringify(one));

    const fit = (await call(db, "select public.fleet_readiness(x.squads) as r from public.fleets as x where x.id = '" + A3 + "'"))[0].r;
    check("a fleet at its establishment is fit", fit.grade === "fit", JSON.stringify(fit));

    console.log("\nthe army, read as one thing");

    let board = (await call(db, "select public.fleet_army_board() as b"))[0].b;

    check("every fleet of the faction is on the board", (board.fleets || []).length === 4,
        JSON.stringify((board.fleets || []).map(f => f.name)));
    check("and the other faction's is not", !(board.fleets || []).some(f => f.name === "Krasny Klinok"));
    check("the totals add the whole faction up",
        Number(board.totals.fleets) === 4 && Number(board.totals.full) === 3350 &&
        Number(board.totals.left) === 1850 && Number(board.totals.missing) === 1500,
        JSON.stringify(board.totals));
    check("three fleets are under strength", Number(board.totals.under) === 3, JSON.stringify(board.totals));
    check("and only the two in orbit are priced for the dock", Number(board.totals.price) === 56,
        JSON.stringify(board.totals));

    const spear = (board.fleets || []).find(f => f.name === "Spear of Terra");
    check("a fleet lists its divisions", (spear.divisions || []).length === 2 &&
        Number(spear.divisions.find(d => d.type === "Rifle").left) === 500 &&
        Number(spear.divisions.find(d => d.type === "MG").left) === 750,
        JSON.stringify(spear.divisions));
    check("and what the dock would charge for it", Number(spear.price) === 20 && spear.stationed === true,
        JSON.stringify({ price: spear.price, stationed: spear.stationed }));

    /* the fleet is priced, but a fleet under way is not in the total the army
       can pay for: the dock only takes what is in orbit */
    const road = (board.fleets || []).find(f => f.name === "Long Road");
    check("a fleet under way is priced but not counted in the order",
        road.stationed === false && Number(road.price) === 10, JSON.stringify({ stationed: road.stationed, price: road.price }));

    console.log("\nthe whole army to the dock at once");

    const order = (await call(db, "select public.repair_army() as r"))[0].r;
    check("one order repairs every fleet in orbit that needs it",
        Number(order.fleets) === 1 && Number(order.repaired) === 500 && Number(order.paid) === 20,
        JSON.stringify(order));
    check("and the treasury paid for it",
        Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits) === 4980,
        order.credits);

    const after = (await call(db, "select public.fleet_readiness(x.squads) as a, " +
        "(select public.fleet_readiness(y.squads) from public.fleets as y where y.id = '" + A2 + "') as b, " +
        "(select public.fleet_readiness(z.squads) from public.fleets as z where z.id = '" + B1 + "') as c " +
        "from public.fleets as x where x.id = '" + A1 + "'"))[0];
    check("the fleet in orbit is whole again", Number(after.a.missing) === 0, JSON.stringify(after.a));
    check("the fleet under way was left alone", Number(after.b.missing) === 100, JSON.stringify(after.b));
    check("and another player's fleet was not touched", Number(after.c.missing) === 900,
        JSON.stringify(after.c));

    const nothing = await expectError(db, "select public.repair_army()");
    check("an army that needs nothing is told so", /Nothing in orbit needs the dock/.test(nothing), nothing);

    console.log("\nall of it or none of it");

    await db.exec("update public.faction_treasury set credits = 20 where faction = 'Freedom Authority'");
    await db.exec("insert into public.fleets (id, player_id, name, faction, origin, status, squads) values " +
        "('" + A4 + "', '" + AUTH + "', 'Second Spear', 'Freedom Authority', 'Free Earth', 'stationed', " +
        squads([{ type: "Rifle", amount: 1, soldiers: 500 }]) + "), " +
        "('" + A5 + "', '" + AUTH + "', 'Third Spear', 'Freedom Authority', 'Free Earth', 'stationed', " +
        squads([{ type: "Rifle", amount: 1, soldiers: 500 }]) + ")");

    const short = await expectError(db, "select public.repair_army()");
    check("a treasury that cannot pay the whole army refuses", /dock wants/.test(short), short);

    const both = (await call(db, "select (select public.fleet_damage_reading(x.squads) ->> 'missing' from public.fleets as x where x.id = '" + A4 + "')::numeric as a, " +
        "(select public.fleet_damage_reading(y.squads) ->> 'missing' from public.fleets as y where y.id = '" + A5 + "')::numeric as b, " +
        "(select credits from public.faction_treasury where faction = 'Freedom Authority') as credits"))[0];
    check("and nothing is repaired and nothing is charged",
        Number(both.a) === 500 && Number(both.b) === 500 && Number(both.credits) === 20,
        JSON.stringify(both));

    console.log("\nthe other side has the same board");

    await as(db, COMB);
    board = (await call(db, "select public.fleet_army_board() as b"))[0].b;
    check("the Combine sees only its own fleet",
        (board.fleets || []).length === 1 && board.fleets[0].name === "Krasny Klinok",
        JSON.stringify((board.fleets || []).map(f => f.name)));
    check("and its own reading of it", board.fleets[0].grade === "skeleton",
        JSON.stringify(board.fleets[0].grade));

    const corder = (await call(db, "select public.repair_army() as r"))[0].r;
    check("the Soviet's army goes to the dock by the same rule",
        Number(corder.fleets) === 1 && Number(corder.repaired) === 900 && Number(corder.paid) === 36,
        JSON.stringify(corder));
    check("and it is the Combine's log that hears of it",
        Number((await call(db, "select count(*)::int as n from public.cs_log where text like 'ESTALEIRO:%'"))[0].n) === 1);

    await as(db, "");
    const denied = await expectError(db, "select public.repair_army()");
    check("an unauthenticated caller is refused", /Not authenticated/.test(denied), denied);
    await as(db, AUTH);

    console.log("\n" + passed + " passed, " + failed + " failed");
    if (failed) { process.exit(1); }

})();
