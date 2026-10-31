/* Run 2026-11-57 against a real PostgreSQL (PGlite, the WASM build) with
   stand-ins for the game's tables, and check the rule the map now promises:

     - arming rebels or stirring a coup only answers on a world the OTHER
       faction commands: an independent world, your own world and a capital
       are all refused, each with its own words;
     - the trouble lands on that world's own bar (planet_unrest), not on a
       fuse that waits for somebody to take the world;
     - it is capped at the revolt mark, never over it;
     - the cooldown is still the strike's own, and it is per world;
     - the treasury pays once per attempt;
     - planetary_state() lists every world one of the two factions holds,
       with its bar, its owner, and whether it is the other side's, and it
       leaves the independent worlds to the embassy book.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/unrest-strikes-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PATCH = fs.readFileSync(
    path.join(ROOT, "sql/2026-11-57_the_tinder_burns_where_it_is_planted.sql"), "utf8");

const AUTH = "11111111-1111-1111-1111-111111111111";    /* Freedom Authority */
const COMB = "22222222-2222-2222-2222-222222222222";    /* Combine */
const NOBODY = "33333333-3333-3333-3333-333333333333";  /* nobody's faction */

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra !== undefined ? "  [" + extra + "]" : "")); }
}

const SCHEMA = `
create schema if not exists auth;
create schema if not exists public;

create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.me', true), '')::uuid $$;

create table public.players (id uuid primary key, faction text, username text);
insert into public.players values
    ('${AUTH}', 'Freedom Authority', 'President Hale'),
    ('${COMB}', 'Combine', 'Comrade Volkov'),
    ('${NOBODY}', 'Independents', 'Nobody');

create table public.planets (id serial primary key, name text unique);
insert into public.planets (name) values ('Kars'), ('Surtis'), ('Ossun'), ('Vhal'), ('Ultramars');

create table public.cities (id serial primary key, planet_id int, name text, faction text);
insert into public.cities (planet_id, name, faction) values
    ((select id from public.planets where name = 'Kars'), 'Kars I', 'Independents'),
    ((select id from public.planets where name = 'Surtis'), 'Surtis I', 'Combine'),
    ((select id from public.planets where name = 'Ossun'), 'Ossun I', 'Combine'),
    ((select id from public.planets where name = 'Vhal'), 'Vhal I', 'Combine'),
    ((select id from public.planets where name = 'Ultramars'), 'Ultramars I', 'Freedom Authority');

create table public.faction_treasury (faction text primary key, credits numeric default 0);
insert into public.faction_treasury values ('Freedom Authority', 5000), ('Combine', 5000);

create table public.planet_unrest (
    planet text primary key,
    faction text not null,
    unrest numeric not null default 25 check (unrest between 0 and 100),
    revolts integer not null default 0,
    last_turn_at timestamptz not null default now(),
    last_revolt_at timestamptz,
    last_band_at timestamptz,
    last_calm_at timestamptz,
    last_fight_at timestamptz
);
insert into public.planet_unrest (planet, faction, unrest) values
    ('Surtis', 'Combine', 40),
    ('Ossun', 'Combine', 90),
    ('Ultramars', 'Freedom Authority', 20);

create table public.planet_tinder (
    planet text primary key,
    unrest numeric not null default 0,
    last_armed_at timestamptz,
    last_coup_at timestamptz,
    applied_at timestamptz,
    created_at timestamptz not null default now()
);

create table public.planet_rebels (planet text, soldiers numeric);
insert into public.planet_rebels values ('Surtis', 1500), ('Surtis', 1500);

create or replace function public.rebel_price() returns integer language sql as $$ select 800 $$;
create or replace function public.coup_price() returns integer language sql as $$ select 1500 $$;
create or replace function public.rebel_wait() returns integer language sql as $$ select 600 $$;
create or replace function public.coup_wait() returns integer language sql as $$ select 1200 $$;
create or replace function public.unrest_revolt_at() returns numeric language sql as $$ select 100 $$;
create or replace function public.unrest_turn_seconds() returns integer language sql as $$ select 300 $$;
create or replace function public.rebel_pass_at() returns integer language sql as $$ select 60 $$;
create or replace function public.is_capital_world(p text) returns boolean language sql as $$ select p = 'Vhal' $$;
create or replace function public.planet_garrison(p_faction text, p_planet text) returns jsonb
language sql as $$ select jsonb_build_object('soldiers', 1200, 'fleets', 1) $$;
create or replace function public.planet_garrison_missing(p_faction text, p_planet text) returns boolean
language sql as $$ select false $$;
create or replace function public.occupation_stability(p text) returns numeric language sql as $$ select 50 $$;
create or replace function public.planet_policy_delta(p text) returns integer language sql as $$ select 0 $$;
create or replace function public.faction_tax_level(p text) returns integer language sql as $$ select 1 $$;

create or replace function public.cg_log(p text) returns void language plpgsql as $$ begin end $$;
create or replace function public.cs_log(p text) returns void language plpgsql as $$ begin end $$;
`;

async function call(db, sql) {
    const r = await db.query(sql);
    return r.rows;
}

async function as(db, who) {
    await db.exec("select set_config('test.me', '" + who + "', false)");
}

async function expectError(db, sql) {
    try { await db.query(sql); return null; }
    catch (e) { return String((e && e.message) || e); }
}

(async function main() {

    const db = new PGlite();
    await db.waitReady;
    await db.exec(SCHEMA);
    await db.exec(PATCH);

    console.log("the patch is in");
    const bar = async planet =>
        Number((await call(db, "select unrest from public.planet_unrest where planet = '" + planet + "'"))[0].unrest);
    const credits = async f =>
        Number((await call(db, "select credits from public.faction_treasury where faction = '" + f + "'"))[0].credits);

    await as(db, AUTH);

    console.log("\nonly a world the other faction commands");
    const independent = await expectError(db, "select public.arm_rebels('Kars')");
    check("an independent world has no government to rise", /answers to nobody/.test(String(independent)), independent);

    const own = await expectError(db, "select public.arm_rebels('Ultramars')");
    check("your own world refuses the rifles", /You command Ultramars yourself/.test(String(own)), own);

    const capital = await expectError(db, "select public.overthrow_government('Vhal')");
    check("a capital carries no bar, so no coup", /carries no bar of unrest/.test(String(capital)), capital);

    const nobody = await (async () => { await as(db, NOBODY); const e = await expectError(db, "select public.arm_rebels('Surtis')"); await as(db, AUTH); return e; })();
    check("an independent player strikes nowhere", /Only the Freedom Authority and the Combine/.test(String(nobody)), nobody);

    console.log("\nthe rifles land on the bar of the enemy's world");
    const before = await bar("Surtis");
    const arm = (await call(db, "select public.arm_rebels('Surtis') as r"))[0].r;
    const armed = await bar("Surtis");
    check("the bar takes fifteen", armed === before + 15, before + " -> " + armed);
    check("and the answer says where it landed", Number(arm.unrest) === armed && arm.owner === "Combine",
        JSON.stringify(arm));
    check("the treasury paid 800 once", (await credits("Freedom Authority")) === 4200,
        await credits("Freedom Authority"));
    check("the bar is still the Combine's, to answer for", await (async () =>
        (await call(db, "select faction from public.planet_unrest where planet = 'Surtis'"))[0].faction)() === "Combine");
    check("nothing waits in a fuse any more", (await call(db,
        "select coalesce(unrest, 0)::int as u from public.planet_tinder where planet = 'Surtis'"))[0].u === 0);

    console.log("\nand the strike keeps its own clock");
    const again = await expectError(db, "select public.arm_rebels('Surtis')");
    check("it cannot be tried twice in a row", /already been tried/.test(String(again)), again);
    check("the treasury paid only once", (await credits("Freedom Authority")) === 4200);
    check("but the coup is its own attempt", (await expectError(db, "select public.overthrow_government('Surtis')")) === null);

    const afterCoup = await bar("Surtis");
    check("the coup adds thirty five", afterCoup === armed + 35, armed + " -> " + afterCoup);

    console.log("\nthe bar is capped at the revolt mark");
    const ossun = (await call(db, "select public.overthrow_government('Ossun') as r"))[0].r;
    check("ninety plus thirty five lands on a hundred", Number(ossun.unrest) === 100, JSON.stringify(ossun));
    check("the row itself is capped", (await bar("Ossun")) === 100, await bar("Ossun"));
    const coupOssun = await expectError(db, "select public.overthrow_government('Ossun')");
    check("a second coup on the same world still has its clock", /already been tried/.test(String(coupOssun)), coupOssun);

    console.log("\nevery world one of the two factions holds");
    const view = (await call(db, "select public.planetary_state() as s"))[0].s;
    const names = view.planets.map(p => p.planet).sort().join(",");
    check("the independent world is left to the embassy book", !/Kars/.test(names), names);
    check("the four commanded worlds are read", names === "Ossun,Surtis,Ultramars,Vhal", names);

    const surtis = view.planets.find(p => p.planet === "Surtis");
    check("with its bar", surtis.unrest === 90 && surtis.cap === 100, JSON.stringify(surtis));
    check("its owner and what that means", surtis.owner === "Combine" && surtis.theirs === true && surtis.mine === false,
        JSON.stringify(surtis));
    check("its men in the streets", surtis.bands === 2 && Number(surtis.men) === 3000, surtis.bands + "/" + surtis.men);
    check("and the garrison facing them", Number(surtis.soldiers) === 1200, surtis.soldiers);
    check("the arm clock is still running", Number(surtis.armed) > 0, surtis.armed);

    const ultra = view.planets.find(p => p.planet === "Ultramars");
    check("our own world is marked ours", ultra.mine === true && ultra.theirs === false, JSON.stringify(ultra));
    check("a capital is marked", view.planets.find(p => p.planet === "Vhal").capital === true);
    check("the prices come with the reading",
        Number(view.prices.rebel) === 800 && Number(view.prices.coup) === 1500, JSON.stringify(view.prices));
    check("the revolt mark too", Number(view.cap) === 100);

    console.log("\nthe Combine strikes the other way");
    await as(db, COMB);
    const beforeMine = await bar("Ultramars");
    const theirArm = (await call(db, "select public.arm_rebels('Ultramars') as r"))[0].r;
    check("the Authority's world can be stirred by the Combine",
        Number(theirArm.unrest) === beforeMine + 15 && theirArm.owner === "Freedom Authority", JSON.stringify(theirArm));

    await db.close();

    console.log(failures === 0 ? "\nall checks passed" : "\n" + failures + " check(s) failed");
    process.exit(failures === 0 ? 0 : 1);

})().catch(e => {
    console.log("\nCRASH: " + String((e && e.message) || e).slice(0, 900));
    process.exit(1);
});
