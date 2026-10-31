/* The attack gate asks the database, and the database looks first.

   Patch 2026-11-46 assumed cities.planet_id and planets.id by name, and a SQL
   function that names a missing column is never created - which leaves the old
   congress_can_attack standing behind it. This drives 2026-11-47 against three
   shapes of the cities table: keyed by the planet's name, keyed by the planet's
   id, and keyed by a column called `planet`.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/attack-gate-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PAGE = fs.readFileSync(path.join(ROOT, "planet.html"), "utf8");
const GATE = fs.readFileSync(path.join(ROOT, "sql/2026-11-47_the_gate_asks_the_database.sql"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

console.log("\n== the page asks one question");

const asked = PAGE.indexOf('rpc("can_attack_planet"');

ok("the page asks the database", asked !== -1);
ok("before the old fallback questions",
    asked < PAGE.indexOf('rpc("congress_can_attack"') && asked < PAGE.indexOf('rpc("cs_can_attack"'));
ok("a refusal is acted on, with its own reason",
    /gate\.data\.reason === "ceasefire"/.test(PAGE) && /gate\.data\.reason === "campaign"/.test(PAGE));
ok("a database without the function still checks the cities",
    /const rivalHeld = planetCities\.some/.test(PAGE));
ok("and the ceasefire sentence is unchanged",
    /A ceasefire stands between the two authorities/.test(PAGE));

const UID = "11111111-1111-4111-8111-111111111111";
const P_COMBINE = "aaaaaaaa-1111-4111-8111-111111111111";

function schema(cityColumn, cityValue) {
    return `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
as $$ select '${UID}'::uuid $$;

create table public.players (id uuid primary key, faction text);
insert into public.players (id, faction) values ('${UID}', 'Freedom Authority');

create table public.planets (id uuid primary key, name text not null unique);
insert into public.planets (id, name) values
    ('${P_COMBINE}', 'Ultramars'),
    ('aaaaaaaa-2222-4111-8111-111111111111', 'Veyrona');

create table public.cities (id serial primary key, ${cityColumn} text, faction text);
insert into public.cities (${cityColumn}, faction) values
    ('${cityValue}', 'Combine'),
    ('Veyrona', 'Independents');

create table public.ceasefires (id serial primary key, status text, ends_at timestamptz);
create or replace function public.ceasefire_active() returns boolean language sql stable
as $$ select exists (select 1 from public.ceasefires where status = 'active' and ends_at > now()) $$;
create or replace function public.ceasefire_stands() returns boolean language sql stable
as $$ select public.ceasefire_active() $$;

create or replace function public.congress_can_attack(p_planet text) returns boolean
language sql stable as $$ select false $$;
create or replace function public.cs_can_attack(p_planet text) returns boolean
language sql stable as $$ select false $$;
`;
}

async function one(db, sql) {
    const r = await db.query(sql);
    return r.rows[0] || {};
}

async function fresh(cityColumn, cityValue) {
    const db = new PGlite();
    await db.exec(schema(cityColumn, cityValue));
    await db.exec(GATE);
    await db.exec(GATE);
    return db;
}

(async function main() {

    try {

        console.log("\n== cities that key their planet by name");

        let db = await fresh("planet_id", "Ultramars");
        let answer = (await one(db, "select public.can_attack_planet('Ultramars') as a")).a;

        ok("the war is open, no bill needed",
            answer && answer.ok === true && answer.reason === "war", answer);
        ok("a world nobody holds still goes to Congress",
            (await one(db, "select public.can_attack_planet('Veyrona') as a")).a.ok === false);
        ok("and the reason says which question refused",
            (await one(db, "select public.can_attack_planet('Veyrona') as a")).a.reason === "declaration");

        await db.exec("insert into public.ceasefires (status, ends_at) values ('active', now() + interval '10 minutes')");

        answer = (await one(db, "select public.can_attack_planet('Ultramars') as a")).a;
        ok("a ceasefire closes the war", answer && answer.ok === false && answer.reason === "ceasefire", answer);

        await db.close();

        console.log("\n== cities that key their planet by id");

        db = await fresh("planet_id", P_COMBINE);

        answer = (await one(db, "select public.can_attack_planet('Ultramars') as a")).a;
        ok("the id is followed to the world's name", answer && answer.ok === true, answer);

        await db.close();

        console.log("\n== cities that call it something else");

        db = await fresh("planet", "Ultramars");

        answer = (await one(db, "select public.can_attack_planet('Ultramars') as a")).a;
        ok("a column called planet is found", answer && answer.ok === true, answer);

        const debug = (await one(db, "select public.attack_gate_debug('Ultramars') as d")).d;
        ok("the diagnostic names the column it used",
            debug && /planet/.test(debug.city_columns || ""), debug && debug.city_columns);
        ok("and reports the answer", debug && debug.answer && debug.answer.ok === true, debug && debug.answer);

        await db.close();

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}());
