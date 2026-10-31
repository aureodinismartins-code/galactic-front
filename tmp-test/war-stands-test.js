/* The war stands until a ceasefire, on the page and in the database.

   Both authorities are at war from the start, so an enemy-held world is enemy
   ground and needs no fresh declaration; the attack gate used to ask Congress
   for one anyway. The gate now skips the chamber for a rival-held world and
   asks about a ceasefire instead, and the two server functions agree.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/war-stands-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PAGE = fs.readFileSync(path.join(ROOT, "planet.html"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");
const PATCH = fs.readFileSync(path.join(ROOT, "sql/2026-11-46_the_war_stands_until_a_ceasefire.sql"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

console.log("\n== the page asks the war, not the chamber");

const rival = PAGE.indexOf("const rivalHeld = planetCities.some");
const peace = PAGE.indexOf('rpc("ceasefire_active")');
const congress = PAGE.indexOf('rpc("congress_can_attack"');
const soviet = PAGE.indexOf('rpc("cs_can_attack"');

ok("a rival-held world is recognised from the cities", rival !== -1);
ok("and a ceasefire is asked about", peace !== -1 && rival < peace);
ok("before Congress is asked anything", peace < congress);
ok("and before the Soviet is asked anything", peace < soviet);

ok("the ceasefire stops the attack, with its own words",
    /A ceasefire stands between the two authorities/.test(PAGE));
ok("a world nobody holds still goes to Congress", congress !== -1);
ok("and to the Soviet", soviet !== -1);
ok("the old wording is still there for those worlds",
    /Congress has not declared war on /.test(PAGE) && /has not authorised a campaign against/.test(PAGE));

ok("the ceasefire sentence is in Portuguese",
    I18N.indexOf("A ceasefire stands between the two authorities") !== -1 &&
    /Um cessar-fogo está em vigor/.test(I18N));

const SCHEMA = `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;

create table public.players (id uuid primary key, faction text);
insert into public.players (id, faction)
values ('11111111-1111-4111-8111-111111111111', 'Combine');

create table public.planets (id uuid primary key, name text not null unique);
insert into public.planets (id, name) values
    ('aaaaaaaa-1111-4111-8111-111111111111', 'Ultramars'),
    ('aaaaaaaa-2222-4111-8111-111111111111', 'Meridia'),
    ('aaaaaaaa-3333-4111-8111-111111111111', 'Veyrona'),
    ('aaaaaaaa-4444-4111-8111-111111111111', 'Kharos');

/* the live database keys cities by the planet's name */
create table public.cities (id serial primary key, planet_id text, faction text);
insert into public.cities (planet_id, faction) values
    ('Ultramars', 'Combine'),
    ('Meridia', 'Freedom Authority'),
    ('Veyrona', 'Independents'),
    ('aaaaaaaa-4444-4111-8111-111111111111', 'Combine');

create table public.ceasefires (id serial primary key, status text, ends_at timestamptz);
create or replace function public.ceasefire_active() returns boolean language sql stable
as $$ select exists (select 1 from public.ceasefires where status = 'active' and ends_at > now()) $$;

create or replace function public.congress_can_attack_base(p_planet text) returns boolean
language sql stable as $$ select false $$;

create table public.cs_authorizations (id serial primary key, kind text, planet text, used boolean default false);
`;

async function one(db, sql) {
    const r = await db.query(sql);
    return r.rows[0] || {};
}

(async function main() {

    const db = new PGlite();

    try {

        await db.exec(SCHEMA);
        await db.exec(PATCH);
        await db.exec(PATCH);

        ok("the patch runs twice without a word", true);

        console.log("\n== no ceasefire: the war is open");

        ok("Congress is not asked about a Combine world",
            (await one(db, "select public.congress_can_attack('Ultramars') as v")).v === true);
        ok("the Soviet is not asked about a Freedom world",
            (await one(db, "select public.cs_can_attack('Meridia') as v")).v === true);
        ok("a world keyed by id is read too",
            (await one(db, "select public.planet_held_by('Kharos', 'Combine') as v")).v === true);
        ok("nobody holds a world that has no such cities",
            (await one(db, "select public.planet_held_by('Veyrona', 'Combine') as v")).v === false);

        console.log("\n== and a ceasefire closes it");

        await db.exec("insert into public.ceasefires (status, ends_at) values ('active', now() + interval '20 minutes')");

        ok("Congress refuses while the peace stands",
            (await one(db, "select public.congress_can_attack('Ultramars') as v")).v === false);
        ok("and so does the Soviet",
            (await one(db, "select public.cs_can_attack('Meridia') as v")).v === false);

        await db.exec("update public.ceasefires set ends_at = now() - interval '1 minute'");

        ok("once it lapses the war is open again",
            (await one(db, "select public.congress_can_attack('Ultramars') as v")).v === true);

        console.log("\n== a world nobody holds is still the chamber's");

        ok("Congress still wants its declaration",
            (await one(db, "select public.congress_can_attack('Veyrona') as v")).v === false);
        ok("the Soviet still wants its campaign",
            (await one(db, "select public.cs_can_attack('Veyrona') as v")).v === false);

        await db.exec("insert into public.cs_authorizations (kind, planet, used) values ('war', 'Veyrona', false)");

        ok("and an authorised campaign opens it",
            (await one(db, "select public.cs_can_attack('Veyrona') as v")).v === true);

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}());
