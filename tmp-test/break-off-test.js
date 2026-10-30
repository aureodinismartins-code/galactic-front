/* Breaking off: a fleet in a battle turns away, at a price.
   The patch runs twice against a real PostgreSQL (PGlite) to prove it is safe
   to re-run, and the map is read for the button that calls it.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/break-off-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PAGE = fs.readFileSync(path.join(ROOT, "galaxy.html"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");
const PATCH = fs.readFileSync(path.join(ROOT, "sql/2026-11-42_a_fleet_can_break_off.sql"), "utf8");

const ME = "11111111-1111-4111-8111-111111111111";
const ENEMY = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

const MY_FLEET = "aaaaaaaa-1111-4111-8111-111111111111";
const FOE_FLEET = "bbbbbbbb-1111-4111-8111-111111111111";
const THIN_FLEET = "cccccccc-1111-4111-8111-111111111111";

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

const SCHEMA = `
create schema if not exists auth;

create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

create table public.game_control (id int primary key, started boolean default true);
insert into public.game_control (id, started) values (1, true);

create table public.test_flags (id int primary key, frozen boolean default false);
insert into public.test_flags (id, frozen) values (1, false);

create or replace function public.game_frozen() returns boolean language sql stable
as $$ select coalesce((select frozen from public.test_flags where id = 1), false) $$;

create table public.fleets (
    id uuid primary key,
    faction text, status text default 'in_space',
    squads jsonb default '[]'::jsonb,
    player_id uuid, name text, origin text,
    space_x numeric, space_y numeric, dest_x numeric, dest_y numeric
);

create table public.space_battles (
    id uuid primary key,
    kind text, planet text, x numeric, y numeric,
    status text default 'pending'
);

create table public.space_battle_fleets (
    id serial primary key, battle_id uuid, fleet_id uuid, side text,
    player_id uuid, faction text, fleet_name text,
    prev_status text, squads jsonb
);
`;

async function one(db, sql, params) {
    const r = await db.query(sql, params);
    return r.rows[0] || {};
}

async function as(db, uid) {
    await db.query("select set_config('test.uid', $1, false)", [uid]);
}

async function main() {

    const db = new PGlite();

    await db.exec(SCHEMA);

    console.log("== the patch runs, and runs again");

    await db.exec(PATCH);
    await db.exec(PATCH);

    ok("the price of turning away is a fifth",
        Number((await one(db, "select public.space_break_off_price() as p")).p) === 0.2);

    await as(db, ME);

    const squads = JSON.stringify([
        { type: "Rifle", amount: 2, soldiers: 2000, soldiersPerDivision: 1000 },
        { type: "Sniper", amount: 1, soldiers: 400, soldiersPerDivision: 400 }
    ]);

    await db.query(
        "insert into public.fleets (id, faction, status, squads, player_id, name, origin, space_x, space_y) values ($1, 'Freedom Authority', 'engaged', $2::jsonb, $3, 'Spearhead', 'Krieg', 50, 50)",
        [MY_FLEET, squads, ME]
    );

    await db.query(
        "insert into public.fleets (id, faction, status, squads, player_id, name, origin, space_x, space_y) values ($1, 'Combine', 'engaged', $2::jsonb, $3, 'Ragged Banner', 'Ash', 50, 50)",
        [FOE_FLEET, squads, ENEMY]
    );

    const B = "dddddddd-1111-4111-8111-111111111111";

    await db.query("insert into public.space_battles (id, kind, x, y, status) values ($1, 'space', 50, 50, 'pending')", [B]);
    await db.query(
        "insert into public.space_battle_fleets (battle_id, fleet_id, side, player_id, faction, fleet_name, prev_status, squads) values ($1, $2, 'A', $3, 'Freedom Authority', 'Spearhead', 'in_space', $4::jsonb), ($1, $5, 'D', $6, 'Combine', 'Ragged Banner', 'in_space', $4::jsonb)",
        [B, MY_FLEET, ME, squads, FOE_FLEET, ENEMY]
    );

    console.log("\n== a fleet turns away");

    const out = (await one(db, "select public.space_break_off($1::uuid) as out", [B])).out;

    ok("the withdrawal goes through", out && out.ok === true, out);
    ok("it costs a fifth of the men", out && Number(out.lost) === 480 && Number(out.left) === 1920, out);

    const mine = await one(db, "select status::text as status, squads, space_x, space_y, dest_x from public.fleets where id = $1", [MY_FLEET]);

    ok("the fleet is free again", mine.status === "in_space", mine.status);
    ok("its squads are a fifth lighter",
        Number(mine.squads[0].soldiers) === 1600 && Number(mine.squads[0].amount) === 2 &&
        Number(mine.squads[1].soldiers) === 320 && Number(mine.squads[1].amount) === 1, mine.squads);
    ok("its route is cleared", mine.dest_x === null, mine.dest_x);

    const away = Math.hypot((Number(mine.space_x) - 50) * 1.78, Number(mine.space_y) - 50);

    ok("and it stands clear of the battle", away > 14, { x: mine.space_x, y: mine.space_y, away });

    const left = await one(db, "select count(*)::int as n from public.space_battle_fleets where battle_id = $1", [B]);

    ok("it is out of the battle", left.n === 0, left);

    const foe = await one(db, "select status::text as status from public.fleets where id = $1", [FOE_FLEET]);

    ok("the fleet that stayed is released too", foe.status === "in_space", foe.status);

    const battle = await one(db, "select status::text as status from public.space_battles where id = $1", [B]);

    ok("and the battle is closed", !battle.status || battle.status !== "pending", battle);

    console.log("\n== what it refuses");

    const again = (await one(db, "select public.space_break_off($1::uuid) as out", [B])).out;

    ok("a battle that is over cannot be broken off again", again && again.ok === false, again);

    const B2 = "eeeeeeee-1111-4111-8111-111111111111";

    await db.query("insert into public.space_battles (id, kind, x, y, status) values ($1, 'space', 20, 20, 'pending')", [B2]);
    await db.query(
        "insert into public.space_battle_fleets (battle_id, fleet_id, side, player_id, faction, fleet_name, prev_status, squads) values ($1, $2, 'A', $3, 'Freedom Authority', 'Spearhead', 'in_space', $4::jsonb)",
        [B2, MY_FLEET, ME, squads]
    );

    await as(db, OTHER);

    const stranger = (await one(db, "select public.space_break_off($1::uuid) as out", [B2])).out;

    ok("a stranger cannot pull a fleet out of a battle", stranger && stranger.ok === false && stranger.code === "not_in_battle", stranger);

    await as(db, ME);
    await db.query("update public.test_flags set frozen = true where id = 1");

    const frozen = (await one(db, "select public.space_break_off($1::uuid) as out", [B2])).out;

    ok("a frozen game keeps the fleets where they are", frozen && frozen.code === "frozen", frozen);

    await db.query("update public.test_flags set frozen = false where id = 1");

    const nothing = (await one(db, "select public.space_break_off(null::uuid) as out")).out;

    ok("no battle, no withdrawal", nothing && nothing.code === "no_battle", nothing);

    console.log("\n== the last men stay");

    const B3 = "ffffffff-1111-4111-8111-111111111111";

    await db.query(
        "insert into public.fleets (id, faction, status, squads, player_id, name, space_x, space_y) values ($1, 'Freedom Authority', 'engaged', $2::jsonb, $3, 'Splinter', 20, 20)",
        [THIN_FLEET, JSON.stringify([{ type: "Knightmare", amount: 1, soldiers: 2, soldiersPerDivision: 3 }]), ME]
    );

    await db.query("insert into public.space_battles (id, kind, x, y, status) values ($1, 'space', 20, 20, 'pending')", [B3]);
    await db.query(
        "insert into public.space_battle_fleets (battle_id, fleet_id, side, player_id, faction, fleet_name, prev_status, squads) values ($1, $2, 'A', $3, 'Freedom Authority', 'Splinter', 'in_space', $4::jsonb)",
        [B3, THIN_FLEET, ME, JSON.stringify([{ type: "Knightmare", amount: 1, soldiers: 2, soldiersPerDivision: 3 }])]
    );

    const thin = (await one(db, "select public.space_break_off($1::uuid) as out", [B3])).out;

    ok("a wrecked squad is not wiped out by leaving", thin && thin.ok === true && Number(thin.left) === 1, thin);

    const thinFleet = await one(db, "select squads from public.fleets where id = $1", [THIN_FLEET]);

    ok("it keeps its last man", Number(thinFleet.squads[0].soldiers) === 1, thinFleet.squads);

    await db.close();

    console.log("\n== the map offers the way out");

    ok("the battle card carries a withdraw button",
        /class="battle-withdraw"/.test(PAGE) && /T\("WITHDRAW"\)/.test(PAGE));
    ok("it asks before it spends the men",
        /Break off from this battle\? Every squad leaves a fifth/.test(PAGE) && /window\.confirm/.test(PAGE));
    ok("it calls the patch", /rpc\("space_break_off", \{ p_battle: b\.id \}\)/.test(PAGE));
    ok("it says what it cost", /announceBreakOff/.test(PAGE) && /soldiers left behind\./.test(PAGE));
    ok("a failure says why, in the player language",
        /not_in_battle/.test(PAGE) && /already_over/.test(PAGE) && /frozen/.test(PAGE));
    ok("the lock message points at the ring",
        /press its ring on the map to break off/.test(PAGE));
    ok("the button does not enter the battle instead",
        /button:not\(\.battle-withdraw\)/.test(PAGE));
    ok("the words are in Portuguese",
        /"WITHDRAW": "RETIRAR"/.test(I18N) && /"BREAKING OFF": "RETIRANDO"/.test(I18N) &&
        /"The fleet broke off\.": "A frota se retirou\."/.test(I18N));

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

}

main().catch(function(e) {
    console.log("\nCRASH: " + String(e && e.stack ? e.stack : e).split("\n").slice(0, 8).join("\n"));
    process.exit(1);
});
