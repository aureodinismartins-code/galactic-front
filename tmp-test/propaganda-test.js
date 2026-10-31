/* The propaganda offices answer again.

   Pressing CAMPAIGN came back with "record \"m\" is not assigned yet": the
   function walked its delegates in a record called m while the same function
   aliased cg_members as m three times above, and PostgreSQL read the alias as
   a field of the record that was never assigned.

   The first half of this file proves the fault against a real PostgreSQL, the
   second half proves the fix.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/propaganda-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const OLD = fs.readFileSync(path.join(ROOT, "sql/2026-10-27_congress_propaganda.sql"), "utf8");
const PATCH = fs.readFileSync(path.join(ROOT, "sql/2026-11-52_the_propaganda_offices_answer.sql"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

function sliceFunction(text, name) {
    const start = text.indexOf("create or replace function public." + name + "(");
    const end = text.indexOf("$function$;", start) + "$function$;".length;
    return text.slice(start, end);
}

const SCHEMA = `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;

create table public.game_control (id int primary key, started boolean, maintenance boolean);
insert into public.game_control values (1, true, false);
create or replace function public.game_frozen() returns boolean language sql stable as $$ select false $$;

create table public.faction_treasury (faction text primary key, credits bigint not null default 0);
insert into public.faction_treasury (faction, credits) values ('Freedom Authority', 20000);

create table public.cg_factions (id int primary key, name text, color text, loyalty int default 55);
insert into public.cg_factions (id, name, color) values
    (1, 'The Old Guard', '#c0392b'), (2, 'The Greens', '#27ae60'),
    (3, 'Progressives', '#e67e22'), (4, 'Independents', '#95a5a6');

create table public.cg_members (
    id serial primary key, name text, faction_id int, active boolean default true, loyalty int default 60);
insert into public.cg_members (name, faction_id, loyalty) values
    ('A', 1, 60), ('B', 1, 62), ('C', 2, 40), ('D', 2, 45), ('E', 3, 64), ('F', 4, 30);

create table public.cg_propaganda (
    faction_id integer primary key, last_at timestamptz, runs integer not null default 0,
    spent bigint not null default 0);

create or replace function public.cg_is_fa() returns boolean language sql stable as $$ select true $$;
create or replace function public.cg_log(p_text text) returns void language sql as $$ select $$;
`;

async function one(db, sql, params) {
    const r = await db.query(sql, params);
    return r.rows[0] || {};
}

async function campaign(db, faction, credits) {
    try {
        const r = await one(db, "select public.congress_propaganda($1, $2) as r", [faction, credits]);
        return { data: r.r };
    }
    catch (error) { return { error: String(error.message || error) }; }
}

(async function main() {

    try {

        const db = new PGlite();
        await db.exec(SCHEMA);

        console.log("\n== the fault, against the database the page really talks to");

        await db.exec(sliceFunction(OLD, "congress_propaganda"));

        const broken = await campaign(db, 1, 1000);

        ok("the campaign fails with the same words the page showed",
            /record "m" is not assigned yet/.test(String(broken.error)), broken.error);
        ok("and nothing was spent for it",
            Number((await one(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits) === 20000);

        console.log("\n== the fix");

        await db.exec(PATCH);
        await db.exec(PATCH);

        const run = await campaign(db, 1, 1000);

        ok("the campaign goes through", !!run.data, run);

        if (run.data) {
            ok("it takes the money", run.data.spent === 1000, run.data.spent);
            ok("it lifts the faction's own delegates", run.data.heat === 5, run.data.heat);
            ok("it reports the seats it holds", typeof run.data.seats === "number" && run.data.seats >= 2, run.data.seats);
            ok("and the credits it leaves behind", run.data.credits === 19000, run.data.credits);
        }

        ok("the treasury was really debited",
            Number((await one(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits) === 19000);
        ok("the campaign is on the record",
            (await one(db, "select runs, spent from public.cg_propaganda where faction_id = 1")).runs === 1);
        ok("the delegates of that faction are stirred",
            Number((await one(db, "select max(loyalty) as l from public.cg_members where faction_id = 1")).l) >= 65,
            (await one(db, "select max(loyalty) as l from public.cg_members where faction_id = 1")).l);

        console.log("\n== the rules around it still hold");

        ok("the same faction cannot be bought twice in ten minutes",
            /wait \d+ more seconds/.test(String((await campaign(db, 1, 1000)).error)),
            (await campaign(db, 1, 1000)).error);

        ok("another faction may be", !!(await campaign(db, 2, 2500)).data);

        await db.exec("update public.faction_treasury set credits = 100 where faction = 'Freedom Authority'");
        ok("a treasury that cannot pay is refused",
            /not possible/.test(String((await campaign(db, 3, 5000)).error)),
            (await campaign(db, 3, 5000)).error);

        ok("an unknown faction is refused",
            /Unknown faction/.test(String((await campaign(db, 9, 1000)).error)));

        await db.close();

        console.log("\n== the file itself");

        ok("no record called m is left", !/\bm record;/.test(PATCH));
        ok("the delegates are walked in v_member",
            /for v_member in/.test(PATCH) && /v_member\.id/.test(PATCH) && /v_member\.loyalty/.test(PATCH));

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.stack || error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}());
