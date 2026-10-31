/* The Authority opens the war able to build a fleet.

   The Combine has always begun with three fleet quotas handed to itself by
   the Soviet (game_opening_quotas). The Authority began with nothing: its
   first fleet waited on a Congress with no President seated and on a
   treasury that could barely pay the opening bill.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/opening-fleet-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const ROLLS = fs.readFileSync(path.join(ROOT, "sql/2026-11-48_the_rolls_close_up.sql"), "utf8");
const OPENING = fs.readFileSync(path.join(ROOT, "sql/2026-11-49_the_authority_opens_with_a_fleet.sql"), "utf8");
const CONTROL = fs.readFileSync(path.join(ROOT, "gamecontrol.js"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

const ME = "11111111-1111-4111-8111-111111111111";

function schema(faction) {
    return `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
as $$ select '${ME}'::uuid $$;

create table public.players (id uuid primary key, faction text);
insert into public.players (id, faction) values ('${ME}', '${faction}');

create table public.game_control (id int primary key, host_player uuid, started boolean, maintenance boolean);
insert into public.game_control (id, host_player, started, maintenance) values (1, '${ME}', true, false);

create table public.faction_treasury (
    faction text primary key, credits bigint not null default 0, fleets_built integer not null default 0);

create table public.fleets (
    id uuid primary key default gen_random_uuid(),
    player_id uuid, name text, faction text, origin text, destination text,
    status text default 'ready', departure_time timestamptz, arrival_time timestamptz,
    squads jsonb default '[]'::jsonb, transport_fleet boolean not null default false);

create table public.cg_authorizations (
    id serial primary key, kind text, planet text, player_id uuid,
    used boolean not null default false, used_at timestamptz);

create table public.cs_authorizations (
    id serial primary key, kind text, planet text, player_id uuid,
    used boolean not null default false, used_at timestamptz);

create or replace function public.collect_faction_income() returns void language sql as $$ select $$;
create or replace function public.cs_fleet_floor() returns integer language sql immutable as $$ select 3 $$;
create or replace function public.cs_log(p_text text) returns void language sql as $$ select $$;
create or replace function public.cg_log(p_text text) returns void language sql as $$ select $$;
`;
}

async function one(db, sql) {
    const r = await db.query(sql);
    return r.rows[0] || {};
}

async function fresh(faction) {
    const db = new PGlite();
    await db.exec(schema(faction));
    await db.exec("insert into public.faction_treasury (faction, credits, fleets_built) values " +
        "('Freedom Authority', 500, 0), ('Combine', 500, 0)");
    await db.exec(ROLLS);
    await db.exec(OPENING);
    await db.exec(OPENING);
    return db;
}

const opening = db => one(db, "select public.game_opening_quotas() as r").then(x => x.r);
const fleets = (db, faction) => one(db,
    `select count(*)::int as n from public.fleets where faction = '${faction}'`).then(x => x.n);
const cgOpen = db => one(db,
    "select count(*)::int as n from public.cg_authorizations where kind = 'fleet' and not used").then(x => x.n);
const csOpen = db => one(db,
    "select count(*)::int as n from public.cs_authorizations where kind = 'fleet' and not used").then(x => x.n);

(async function main() {

    try {

        console.log("\n== the Authority opens with a fleet");

        const db = await fresh("Freedom Authority");

        let r = await opening(db);
        ok("one authorisation is granted", r.authority === 1 && await cgOpen(db) === 1, r);

        r = await opening(db);
        ok("calling it again grants nothing more", r.authority === 0 && await cgOpen(db) === 1, r);

        const before = (await one(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits;

        await db.exec("select public.create_fleet('The First', 'Freedom Authority', 'Free Earth', '[]'::jsonb)");

        ok("the fleet is built without a vote", await fleets(db, "Freedom Authority") === 1);
        ok("the authorisation is spent", await cgOpen(db) === 0);
        ok("and the yard price is the bill's, not the treasury's",
            String((await one(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits) === String(before),
            before);

        r = await opening(db);
        ok("a war already under way gets no second opening fleet", r.authority === 0 && await cgOpen(db) === 0, r);

        /* the host resets: fleets and authorisations go, the opening returns */
        await db.exec("delete from public.fleets");
        await db.exec("delete from public.cg_authorizations");

        r = await opening(db);
        ok("after a reset the Authority opens with a fleet again", r.authority === 1 && await cgOpen(db) === 1, r);

        await db.close();

        console.log("\n== the Combine is left as it was");

        const comb = await fresh("Combine");

        r = await opening(comb);
        ok("the Soviet still hands itself three quotas", await csOpen(comb) === 3 && r.granted === 3, r);
        ok("and the Authority's opening does not touch the Combine's book",
            await cgOpen(comb) === 1 && await fleets(comb, "Combine") === 0,
            { cg: await cgOpen(comb) });

        r = await opening(comb);
        ok("no quotas and no authorisations on a second call",
            r.granted === 0 && await csOpen(comb) === 3 && await cgOpen(comb) === 1, r);

        await comb.close();

        console.log("\n== a database that has never heard of the Soviet");

        const bare = new PGlite();
        await bare.exec(schema("Freedom Authority"));
        await bare.exec("insert into public.faction_treasury (faction, credits) values ('Combine', 500)");
        await bare.exec(ROLLS);
        await bare.exec(OPENING);
        await bare.exec("drop table public.cs_authorizations");

        const bareAnswer = await one(bare, "select public.game_opening_quotas() as r").then(x => x.r);

        ok("a database without the Soviet's book is skipped, not crashed",
            !!bareAnswer && bareAnswer.granted === 0 && bareAnswer.floor === 3, bareAnswer);
        ok("and the Authority still opens with its fleet",
            !!bareAnswer && bareAnswer.authority === 1 && await cgOpen(bare) === 1, bareAnswer);

        await bare.close();

        console.log("\n== the game has to be running");

        const off = await fresh("Freedom Authority");
        await off.exec("update public.game_control set started = false");

        let refused = null;
        try { await one(off, "select public.game_opening_quotas() as r"); }
        catch (error) { refused = String(error.message || error); }

        ok("an unstarted war grants nothing", /has not started/.test(String(refused)), refused);

        await off.close();

        console.log("\n== the pages call it where they already did");

        ok("starting the war hands out the openings",
            /rpc\("game_start"\)[\s\S]{0,600}rpc\("game_opening_quotas"\)/.test(CONTROL));
        ok("and so does the reset",
            /rpc\("game_reset"\)[\s\S]{0,3000}rpc\("game_opening_quotas"\)/.test(CONTROL));

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.stack || error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}());
