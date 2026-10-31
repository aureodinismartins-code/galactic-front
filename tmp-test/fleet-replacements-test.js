/* A fleet that loses every unit leaves its place behind.

   2026-11-48: the Combine's ceiling counted the fleets in service, so losing
   one lowered the ceiling too; and the Authority still had to take a fresh
   "Authorize New Fleet Construction" bill to Congress to replace a fleet it
   had just lost. A lost warship now leaves a replacement waiting for both.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/fleet-replacements-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PATCH = fs.readFileSync(path.join(ROOT, "sql/2026-11-48_the_rolls_close_up.sql"), "utf8");
const CONTROL = fs.readFileSync(path.join(ROOT, "gamecontrol.js"), "utf8");
const PLANET = fs.readFileSync(path.join(ROOT, "planet.html"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function schema(faction) {
    return `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
as $$ select '${ME}'::uuid $$;

create table public.players (id uuid primary key, faction text);
insert into public.players (id, faction) values
    ('${ME}', '${faction}'),
    ('${OTHER}', '${faction}');

create table public.game_control (id int primary key, host_player uuid);
insert into public.game_control (id, host_player) values (1, '${ME}');

create table public.faction_treasury (
    faction text primary key, credits bigint not null default 0, fleets_built integer not null default 0);

create table public.fleets (
    id uuid primary key default gen_random_uuid(),
    player_id uuid, name text, faction text, origin text, destination text,
    status text default 'ready', departure_time timestamptz, arrival_time timestamptz,
    squads jsonb default '[]'::jsonb, transport_fleet boolean not null default false);

create table public.cs_authorizations (
    id serial primary key, kind text, player_id uuid, used boolean not null default false, used_at timestamptz);
create table public.cg_authorizations (
    id serial primary key, kind text, player_id uuid, used boolean not null default false, used_at timestamptz);

create or replace function public.collect_faction_income() returns void language sql as $$ select $$;
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
        "('Freedom Authority', 5000, 0), ('Combine', 5000, 0)");
    await db.exec(PATCH);
    await db.exec(PATCH);
    return db;
}

async function build(db, name) {
    return one(db, `select public.create_fleet('${name}', (select faction from public.players where id = '${ME}'), 'Krieg', '[]'::jsonb) as id`);
}

async function attempt(db, name) {
    try { await build(db, name); return null; }
    catch (error) { return String(error.message || error); }
}

async function fleet(db, name, faction, squads, extra) {
    await db.exec(`insert into public.fleets (name, faction, status, squads, transport_fleet)
        values ('${name}', '${faction}', 'ready', '${JSON.stringify(squads)}'::jsonb, ${extra ? "true" : "false"})`);
}

(async function main() {

    try {

        console.log("\n== the Authority replaces a fleet it lost, without a bill");

        let db = await fresh("Freedom Authority");

        ok("with no bill and nothing lost, Congress is asked",
            /Congress has not authorized/.test(String(await attempt(db, "First"))));

        await fleet(db, "The Lost", "Freedom Authority", [{ type: "Rifle", amount: 5 }]);
        await db.exec("delete from public.fleets where name = 'The Lost'");

        ok("a lost fleet is counted", Number((await one(db,
            "select fleet_losses from public.faction_treasury where faction = 'Freedom Authority'")).fleet_losses) === 1);

        const made = await build(db, "The Replacement");

        ok("and the next fleet needs no bill", !!made.id, made);
        ok("the place is spent, not kept",
            Number((await one(db,
                "select fleet_losses from public.faction_treasury where faction = 'Freedom Authority'")).fleet_losses) === 0);
        ok("a second fleet still goes to the chamber",
            /Congress has not authorized/.test(String(await attempt(db, "Second"))));

        await db.close();

        console.log("\n== a bill that has not been spent still comes first");

        db = await fresh("Freedom Authority");
        await db.exec("insert into public.cg_authorizations (kind) values ('fleet')");

        await build(db, "Voted");

        ok("the authorisation is used",
            (await one(db, "select used from public.cg_authorizations order by id limit 1")).used === true);

        await db.close();

        console.log("\n== the Combine: a lost fleet gives the quota back");

        db = await fresh("Combine");

        ok("with no quota and nothing lost, the Soviet is asked",
            /Supreme Soviet has not authorised/.test(String(await attempt(db, "First"))));

        let quota = (await one(db, "select public.cs_fleet_quota() as q")).q;
        ok("the ceiling says what the Soviet permits", quota.max === 0 && quota.losses === 0, quota);

        await fleet(db, "Vanguard", "Combine", [{ type: "Rifle", amount: 5 }]);

        quota = (await one(db, "select public.cs_fleet_quota() as q")).q;
        ok("a fleet in service holds its place", quota.fleets === 1 && quota.max === 1, quota);

        await db.exec("delete from public.fleets where name = 'Vanguard'");

        quota = (await one(db, "select public.cs_fleet_quota() as q")).q;
        ok("the ceiling does not fall with the fleet", quota.max === 1, quota);
        ok("and the place shows as a replacement", quota.losses === 1 && quota.can_build === true, quota);

        await build(db, "Vanguard II");

        ok("the fleet is rebuilt with no directive",
            Number((await one(db, "select count(*) as n from public.fleets")).n) === 1);
        ok("and the replacement is spent",
            (await one(db, "select public.cs_fleet_quota() as q")).q.losses === 0);

        await db.close();

        console.log("\n== a fleet that loses its last squad counts too");

        db = await fresh("Combine");
        await fleet(db, "Hollow", "Combine", [{ type: "Rifle", amount: 5 }]);
        await db.exec("update public.fleets set squads = '[]'::jsonb where name = 'Hollow'");

        ok("an empty hull is a loss",
            (await one(db, "select public.cs_fleet_quota() as q")).q.losses === 1);
        ok("and it does not hold a place while it waits to be struck off",
            (await one(db, "select public.cs_fleet_quota() as q")).q.fleets === 0);

        await db.exec("update public.fleets set squads = '[]'::jsonb where name = 'Hollow'");

        ok("emptying it twice is still one loss",
            (await one(db, "select public.cs_fleet_quota() as q")).q.losses === 1);

        await db.close();

        console.log("\n== not every fleet is a command");

        db = await fresh("Combine");
        await fleet(db, "Cargo", "Combine", [], true);
        await fleet(db, "On the slipway", "Combine", [{ type: "Rifle", amount: 2 }]);

        await db.exec("update public.fleets set squads = '[]'::jsonb where name = 'On the slipway'");
        await db.exec("delete from public.fleets where name = 'On the slipway'");

        const counted = Number((await one(db,
            "select fleet_losses from public.faction_treasury where faction = 'Combine'")).fleet_losses);

        ok("a cargo bottom and a wreck that never emptied are not losses", counted === 1, counted);

        await db.close();

        console.log("\n== the host's reset empties the book of replacements");

        db = await fresh("Combine");
        await fleet(db, "Gone", "Combine", [{ type: "Rifle", amount: 3 }]);
        await db.exec("delete from public.fleets where name = 'Gone'");

        ok("one replacement is waiting", (await one(db,
            "select fleet_losses from public.faction_treasury where faction = 'Combine'")).fleet_losses === 1);

        await db.exec("select public.fleet_replacements_reset()");

        ok("the reset clears it", (await one(db,
            "select fleet_losses from public.faction_treasury where faction = 'Combine'")).fleet_losses === 0);

        await db.exec("update public.game_control set host_player = null");

        let refused = null;
        try { await db.exec("select public.fleet_replacements_reset()"); }
        catch (error) { refused = String(error.message || error); }

        ok("and only the host may call it", /Only the host/.test(String(refused)), refused);

        await db.close();

        console.log("\n== the pages");

        ok("the reset asks the database to empty the book", /rpc\("fleet_replacements_reset"\)/.test(CONTROL));
        ok("the fleet menu shows the places waiting", /q\.losses > 0/.test(PLANET) && /REPLACEMENTS/.test(PLANET));

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.stack || error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}());
