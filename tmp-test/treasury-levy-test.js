/* The treasury committee takes less, and pays more for it.

   Once a term the committee could levy 300-500 credits for three points of
   popularity (three of confidence in the Soviet): a free fleet every term at
   a price nobody would refuse. The levy is now 120-200 before the loyalty
   factor and the price is eight points, on both sides.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/treasury-levy-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PATCH = fs.readFileSync(path.join(ROOT, "sql/2026-11-51_the_treasury_takes_less.sql"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

const SCHEMA = `
create table public.faction_treasury (faction text primary key, credits bigint not null default 0);
insert into public.faction_treasury (faction, credits) values ('Freedom Authority', 0), ('Combine', 0);

create table public.cg_state (id int primary key, term_no int default 0, popularity int default 50);
insert into public.cg_state (id, term_no, popularity) values (1, 5, 50);

create table public.cg_ministers (
    post text primary key, member_id int, party_id int, last_effect jsonb,
    last_effect_term int, last_power_term int, last_power_at timestamptz);
insert into public.cg_ministers (post, member_id, party_id) values ('treasury', 1, 1);

create table public.cg_members (id int primary key, loyalty numeric);
insert into public.cg_members (id, loyalty) values (1, 80);

create table public.cg_factions (id int primary key, loyalty numeric);
insert into public.cg_factions (id, loyalty) values (1, 80);

create table public.cg_authorizations (id serial primary key, kind text, player_id uuid, used boolean default false);
create table public.cg_occupations (planet text primary key, stability int default 50);

create table public.cs_state (id int primary key, term_no int default 0, confidence int default 50, quota int default 0, secretary_player uuid);
insert into public.cs_state (id, term_no, confidence) values (1, 5, 50);

create table public.cs_ministers (
    post text primary key, member_id int, current_id int, last_effect jsonb,
    last_effect_term int, last_power_term int, last_power_at timestamptz);
insert into public.cs_ministers (post, member_id, current_id) values ('grain', 1, 1);

create table public.cs_commissars (id int primary key, loyalty numeric, current_id int, active boolean default true);
insert into public.cs_commissars (id, loyalty, current_id) values (1, 80, 1);

create table public.cs_currents (id int primary key, loyalty numeric, name text);
insert into public.cs_currents (id, loyalty, name) values (1, 80, 'Aparato do Partido');

create table public.cs_authorizations (id serial primary key, kind text, player_id uuid, used boolean default false);
create table public.cs_occupations (planet text primary key, stability int default 50);

create or replace function public.minister_posts() returns text[] language sql immutable
as $$ select array['treasury'] $$;
create or replace function public.cs_minister_posts() returns text[] language sql immutable
as $$ select array['grain'] $$;
create or replace function public.cg_seat_ministers() returns void language sql as $$ select $$;
create or replace function public.cs_seat_ministers() returns void language sql as $$ select $$;
create or replace function public.cg_governing_party() returns integer language sql as $$ select 1 $$;
create or replace function public.cs_governing_current() returns integer language sql as $$ select 1 $$;
`;

async function one(db, sql) {
    const r = await db.query(sql);
    return r.rows[0] || {};
}

(async function main() {

    try {

        const db = new PGlite();
        await db.exec(SCHEMA);
        await db.exec(PATCH);
        await db.exec(PATCH);

        console.log("\n== the Authority's committee");

        await db.exec("select public.cg_ministries_convene()");

        let credits = Number((await one(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits);
        let pop = (await one(db, "select popularity from public.cg_state where id = 1")).popularity;
        let effect = (await one(db, "select last_effect from public.cg_ministers where post = 'treasury'")).last_effect;

        ok("it still pays once a term", credits > 0, credits);
        ok("but a levy is no longer a fleet", credits <= 330, credits);
        ok("at loyalty 80 the levy sits where the new rule puts it", credits >= 130 && credits <= 290, credits);
        ok("the people are told, and it costs eight points", pop === 42, pop);
        ok("the report says the same", effect && effect.kind === "levy" && effect.popularity === -8 && effect.credits === credits, effect);

        const first = credits;
        await db.exec("select public.cg_ministries_convene()");

        ok("a second convening in the same term pays nothing",
            Number((await one(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits) === first);

        await db.exec("update public.cg_state set term_no = 6");
        await db.exec("select public.cg_ministries_convene()");

        const after = Number((await one(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits);

        ok("a new term brings the levy back", after > first, { first, after });
        ok("and it is the same size, not the old one", after - first <= 330, after - first);

        console.log("\n== the Soviet's grain committee");

        await db.exec("select public.cs_ministries_convene()");

        const combCredits = Number((await one(db, "select credits from public.faction_treasury where faction = 'Combine'")).credits);
        const conf = (await one(db, "select confidence from public.cs_state where id = 1")).confidence;
        const csEffect = (await one(db, "select last_effect from public.cs_ministers where post = 'grain'")).last_effect;

        ok("the grain levy is the same size as the Authority's",
            combCredits > 0 && combCredits <= 330, combCredits);
        ok("the Party pays eight points of confidence", conf === 42, conf);
        ok("and its report names the same numbers",
            csEffect && csEffect.kind === "levy" && csEffect.confidence === -8, csEffect);

        await db.close();

        console.log("\n== the file itself");

        ok("no 300-500 levy is left in either function",
            !/300 \+ random\(\) \* 200/.test(PATCH) && (PATCH.match(/120 \+ random\(\) \* 80/g) || []).length === 2,
            (PATCH.match(/120 \+ random\(\) \* 80/g) || []).length);
        ok("both committees charge eight points",
            (PATCH.match(/greatest\(0, s\.popularity - 8\)/g) || []).length === 1 &&
            (PATCH.match(/greatest\(0, s\.confidence - 8\)/g) || []).length === 1);

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.stack || error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}());
