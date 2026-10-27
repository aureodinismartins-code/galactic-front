/* Run the 2026-11-03 patch against a real PostgreSQL (PGlite, the WASM build)
   with a stand-in for the game's existing tables, and then:

     - walk a world up the four stages (friendly, allied, satellite,
       integrated) and check the tint and the next step;
     - arm the rebels both ways, and overthrow a government both ways,
       including the blowback that hands the world to the other faction and
       shuts its door to your envoys;
     - open supply lines, pay them, and cut them three ways: an enemy in
       orbit of the world, in orbit of the capital, and across the corridor;
     - check the treasury only receives what the lines carry;
     - check the fog: worlds watch wide, fleets watch narrow, and a fleet
       in battle is always read out;
     - check the reset clears the lines and the embassies.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/diplomacy-supply-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const FILES = [
    "sql/2026-11-03_diplomacy_levels_supply_and_fog.sql",
    "sql/2026-11-04_automatic_supply_network.sql",
    "sql/2026-11-05_fog_of_war_vision.sql",
    "sql/2026-11-08_pacts_do_not_outlive_their_world.sql"
];

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

do $do$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $do$;

create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.me', true), '')::uuid $$;

create table public.game_control (id int primary key, host_player uuid, started boolean default true,
    maintenance boolean default false, offline_since timestamptz);
insert into public.game_control (id, host_player) values (1, '${AUTH}');

create table public.players (id uuid primary key, faction text, username text);
insert into public.players values
    ('${AUTH}', 'Freedom Authority', 'President Hale'),
    ('${COMB}', 'Combine', 'Comrade Volkov'),
    ('${NOBODY}', 'Independents', 'Nobody');

create table public.faction_treasury (faction text primary key, credits numeric default 0, last_income_at timestamptz);
insert into public.faction_treasury (faction, credits, last_income_at) values
    ('Combine', 10000, now() - interval '15 minutes'),
    ('Freedom Authority', 10000, now() - interval '15 minutes'),
    ('Independents', 1000, now() - interval '15 minutes');

create table public.planets (id serial primary key, name text unique, income int default 100);
insert into public.planets (name, income) values
    ('Ultramars', 100),        /* the Combine's capital */
    ('Free Earth', 100),       /* the Authority's capital */
    ('Krieg', 100),            /* held whole by the Combine */
    ('Kara', 50),              /* held whole by the Combine, no line yet */
    ('Elya', 60),              /* contested: an Authority city on it */
    ('Veyra', 50),             /* independent */
    ('Volst', 80);             /* independent */

create table public.planet_positions (name text primary key, x numeric, y numeric);
insert into public.planet_positions values
    ('Ultramars', 10, 19), ('Free Earth', 89, 84), ('Krieg', 70, 85),
    ('Kara', 20, 40), ('Elya', 80, 10), ('Veyra', 30, 30), ('Volst', 50, 50);

create table public.cities (id serial primary key, planet_id int, faction text);
insert into public.cities (planet_id, faction) values
    (1, 'Combine'), (1, 'Combine'), (1, 'Combine'),
    (2, 'Freedom Authority'), (2, 'Freedom Authority'), (2, 'Freedom Authority'),
    (3, 'Combine'), (3, 'Combine'),
    (4, 'Combine'), (4, 'Combine'),
    (5, 'Combine'), (5, 'Freedom Authority'),
    (6, 'Independents'), (6, 'Independents'),
    (7, 'Independents'), (7, 'Independents'), (7, 'Independents');

create table public.city_buildings (id serial primary key, city_id int, building_type text);

create table public.fleets (
    id uuid primary key default gen_random_uuid(),
    player_id uuid, faction text, name text, status text default 'stationed',
    origin text, destination text, departure_time timestamptz, arrival_time timestamptz,
    space_x numeric, space_y numeric, heading numeric, squads jsonb default '[]'::jsonb
);

/* as 2026-10-31 leaves the embassies */
create table public.planet_diplomacy (planet text not null, faction text not null,
    relation int not null default 0, envoys int not null default 0,
    last_envoy_at timestamptz, annexed_at timestamptz, primary key (planet, faction));

create table public.player_presence (player_id uuid primary key, last_seen timestamptz default now(),
    last_active timestamptz default now());
insert into public.player_presence (player_id) values ('${AUTH}'), ('${COMB}');

create table public.cg_state (id int primary key, relations jsonb default '{}'::jsonb,
    president_player uuid, term_no int default 0, term_end timestamptz);
insert into public.cg_state (id) values (1);

create table public.cs_state (id int primary key, confidence numeric default 55, quota int default 1,
    relations jsonb default '{}'::jsonb, secretary_player uuid, secretary_name text, secretary_current int,
    term_no int default 0, term_end timestamptz, veto_used boolean default false,
    online_at timestamptz, last_npc_at timestamptz, last_quota_at timestamptz,
    last_debate_at timestamptz, last_election_at timestamptz);
insert into public.cs_state (id) values (1);

create table public.cs_currents (id int primary key, name text, loyalty int);
insert into public.cs_currents values (1, 'Vanguarda Proletária', 60), (2, 'Aparato do Partido', 55), (3, 'Comando Vermelho', 50);
create table public.cs_commissars (id serial primary key, current_id int, loyalty int default 55,
    is_disgraced boolean default false, active boolean default true);
create table public.cg_log (id serial primary key, text text);
create table public.cs_log (id serial primary key, text text);
create table public.cs_directives (id serial primary key);
create table public.cs_votes (id serial primary key);
create table public.cs_debate_sides (id serial primary key);
create table public.cs_debate_standing (id serial primary key);
create table public.cs_privileges (id serial primary key);
create table public.cs_candidates (id serial primary key);
create table public.cs_election_votes (id serial primary key);
create table public.cs_election (id serial primary key);
create table public.cs_authorizations (id serial primary key);
create table public.cs_membership (id serial primary key);
create table public.cs_occupations (id serial primary key);
create table public.cs_agitprop (id serial primary key);

create or replace function public.cg_log(p_text text) returns void language sql security definer set search_path to ''
as $$ insert into public.cg_log (text) values (p_text) $$;
create or replace function public.cs_log(p_text text) returns void language sql security definer set search_path to ''
as $$ insert into public.cs_log (text) values (p_text) $$;

/* the embassy rules this patch leans on, as 2026-10-31 writes them */
create or replace function public.envoy_price() returns integer language sql immutable as $$ select 500 $$;
create or replace function public.envoy_wait() returns integer language sql immutable as $$ select 300 $$;

create or replace function public.last_touch() returns timestamptz language sql stable security definer
set search_path to '' as $$
    select max(coalesce(p.last_active, p.last_seen)) from public.player_presence as p
$$;

create or replace function public.truce_active() returns boolean language sql stable security definer
set search_path to '' as $$ select false $$;

create or replace function public.relations_reading() returns jsonb language sql stable security definer
set search_path to '' as $$ select jsonb_build_object('authority', 0, 'combine', 0, 'truce', false) $$;
`;

async function as(db, who) {
    await db.exec("select set_config('test.me', '" + who + "', false)");
}

async function call(db, sql) {
    const r = await db.query(sql);
    return r.rows;
}

async function expectError(db, sql) {
    try { await db.query(sql); return null; }
    catch (e) { return String(e.message || e); }
}

(async function main() {
    try { await run(); }
    catch (e) {
        console.log("\nCRASH: " + String(e && e.message ? e.message : e).slice(0, 900));
        if (e && e.detail) { console.log("detail: " + e.detail); }
        if (e && e.where) { console.log("where: " + e.where); }
        process.exit(1);
    }
    console.log(failures === 0 ? "\nall checks passed" : "\n" + failures + " check(s) failed");
    process.exit(failures === 0 ? 0 : 1);
})();

async function build() {
    const db = new PGlite();
    await db.exec(SCHEMA);

    for (const file of FILES) {
        const sql = fs.readFileSync(path.join(ROOT, file), "utf8");
        const parts = sql.split(/\n(?=-- -{5,})/);
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            try {
                await db.exec(part);
            }
            catch (e) {
                console.log("  " + file + " failed in part " + i + ": " +
                    part.split("\n").find(l => l.trim() && !l.startsWith("--")) + " — " + e.message);
                throw e;
            }
        }
    }

    return db;
}

async function run() {

    console.log("the patch runs");
    const db = await build();

    const made = await call(db, "select count(*)::int as n from information_schema.routines " +
        "where routine_schema = 'public' and routine_name in ('diplo_strike', 'arm_rebels', " +
        "'overthrow_government', 'supply_state', 'supply_network', 'visible_enemy_fleets')");
    check("the new functions exist", made[0].n === 6, made[0].n);

    /* ---------- the stages ---------- */

    console.log("\nthe four stages");
    const stages = (await call(db, "select r, public.diplo_level(r) as lvl, public.diplo_tint(r) as tint, " +
        "public.diplo_next(r) as nxt from unnest(array[0, 24, 25, 49, 50, 74, 75, 99, 100]) as r"));
    const got = stages.map(s => s.lvl + "/" + Number(s.tint)).join(" ");
    check("every reading has its stage",
        got === "neutral/0 neutral/0 friendly/0.25 friendly/0.25 allied/0.5 allied/0.5 satellite/0.75 satellite/0.75 integrated/1",
        got);
    check("the tint deepens with the stage", Number(stages[0].tint) < Number(stages[2].tint) &&
        Number(stages[2].tint) < Number(stages[4].tint) && Number(stages[4].tint) < Number(stages[6].tint) &&
        Number(stages[6].tint) < Number(stages[8].tint), got);
    check("neutral points at 25, friendly at 50, allied at 75, satellite at 100",
        stages[0].nxt === 25 && stages[2].nxt === 50 && stages[4].nxt === 75 && stages[6].nxt === 100,
        stages.map(s => s.nxt).join(","));

    console.log("\nan independent world leans to whoever courts it");
    await db.exec("insert into public.planet_diplomacy (planet, faction, relation, envoys) values " +
        "('Veyra', 'Combine', 55, 3), ('Veyra', 'Freedom Authority', 20, 1)");
    await as(db, COMB);
    let dip = (await call(db, "select public.diplomacy_state() as s"))[0].s;
    let veyra = dip.planets.find(p => p.planet === "Veyra");
    check("the Combine reads it as allied", veyra.level === "allied" && Number(veyra.tint) === 0.5, JSON.stringify(veyra));
    check("and it leans our way on the map", veyra.patron === "me" && Number(veyra.leaned) === 0.5, veyra.patron);
    check("the other side's standing is shown too", veyra.theirs === 20 && veyra.theirs_level === "neutral",
        veyra.theirs + "/" + veyra.theirs_level);
    check("the prices of the dirty tricks come with it",
        Number(dip.prices.rebel) === 800 && Number(dip.prices.coup) === 1500, JSON.stringify(dip.prices));

    /* ---------- arming the rebels ---------- */

    console.log("\narming the rebels");
    const before = Number((await call(db, "select credits from public.faction_treasury where faction = 'Combine'"))[0].credits);
    const arm = (await call(db, "select public.arm_rebels('Veyra') as r"))[0].r;
    const after = Number((await call(db, "select credits from public.faction_treasury where faction = 'Combine'"))[0].credits);
    check("it costs 800 of the treasury", before - after === 800, before + " -> " + after);
    check("the odds are advertised", Number(arm.odds) > 0 && Number(arm.odds) <= 90, arm.odds);
    check("the result is one of the two branches",
        (arm.success === true && arm.relation === 70 && arm.theirs === 0) ||
        (arm.success === false && arm.relation === 45 && arm.theirs === 35),
        JSON.stringify({ ok: arm.success, mine: arm.relation, theirs: arm.theirs }));
    const rowMine = (await call(db, "select relation from public.planet_diplomacy where planet = 'Veyra' and faction = 'Combine'"))[0].relation;
    const rowTheirs = (await call(db, "select relation from public.planet_diplomacy where planet = 'Veyra' and faction = 'Freedom Authority'"))[0].relation;
    check("both books were written", rowMine === arm.relation && rowTheirs === arm.theirs,
        rowMine + "/" + rowTheirs + " vs " + arm.relation + "/" + arm.theirs);
    check("winner or loser, the stage follows the reading", arm.level === (arm.relation >= 75 ? "satellite" : arm.relation >= 50 ? "allied" : arm.relation >= 25 ? "friendly" : "neutral"), arm.level);

    const errAgain = await expectError(db, "select public.arm_rebels('Veyra')");
    check("it cannot be tried again straight away", /already been tried/.test(String(errAgain)), errAgain);

    console.log("\nthe other side can arm its own rebels in the same world");
    await db.exec("update public.planet_diplomacy set relation = 30 where planet = 'Veyra' and faction = 'Freedom Authority'");
    await as(db, AUTH);
    const theirsArm = (await call(db, "select public.arm_rebels('Veyra') as r"))[0].r;
    check("the Authority needs friends first and has them", theirsArm !== null && theirsArm.action === "arm_rebels",
        JSON.stringify(theirsArm));
    check("its own cooldown is its own", /already been tried/.test(String(await expectError(db, "select public.arm_rebels('Veyra')"))));

    console.log("\nnothing is free with no friends at all");
    await as(db, COMB);
    const errCold = await expectError(db, "select public.arm_rebels('Volst')");
    check("arming rebels needs a reading of 10", /You need friends in Volst/.test(String(errCold)), errCold);
    const errCoup = await expectError(db, "select public.overthrow_government('Volst')");
    check("a coup needs friends inside, 40", /needs friends inside/.test(String(errCoup)), errCoup);

    console.log("\nonly the two main factions work the worlds");
    await as(db, NOBODY);
    const errNobody = await expectError(db, "select public.arm_rebels('Veyra')");
    check("an independent has no embassy at all", /Only the Freedom Authority and the Combine/.test(String(errNobody)), errNobody);

    /* ---------- the coup, both ways ---------- */

    console.log("\noverthrowing a government: both outcomes are honest");
    let successes = 0, blowbacks = 0, consistent = true;

    for (let i = 0; i < 30; i++) {

        await db.exec("delete from public.planet_diplomacy where planet = 'Volst'");
        await db.exec("update public.cities as c set faction = 'Independents' " +
            "where c.planet_id = (select p.id from public.planets as p where p.name = 'Volst')");
        await db.exec("update public.faction_treasury set credits = 10000 where faction = 'Combine'");
        await db.exec("insert into public.planet_diplomacy (planet, faction, relation) values " +
            "('Volst', 'Combine', 45), ('Volst', 'Freedom Authority', 10)");
        await as(db, COMB);

        const r = (await call(db, "select public.overthrow_government('Volst') as r"))[0].r;

        if (r.success) {
            successes++;
            if (r.relation !== 100 || r.theirs !== 0 || r.annexed !== true) {
                consistent = false;
                console.log("    a successful coup looked like " + JSON.stringify(r));
            }
            const flipped = await call(db, "select count(*)::int as n from public.cities as c " +
                "join public.planets as p on p.id = c.planet_id where p.name = 'Volst' and c.faction = 'Combine'");
            const total = await call(db, "select count(*)::int as n from public.cities as c " +
                "join public.planets as p on p.id = c.planet_id where p.name = 'Volst'");
            if (Number(flipped[0].n) !== Number(total[0].n)) { consistent = false; console.log("    the cities did not change flag"); }
            const gone = await call(db, "select count(*)::int as n from public.planet_diplomacy where planet = 'Volst' and annexed_at is not null");
            if (Number(gone[0].n) !== 1) { consistent = false; console.log("    the pact was not sealed"); }
            const dipNow = (await call(db, "select public.diplomacy_state() as s"))[0].s;
            if (dipNow.planets.some(p => p.planet === "Volst")) { consistent = false; console.log("    an integrated world was still listed"); }
        }
        else {
            blowbacks++;
            if (r.relation !== 0 || r.theirs !== 45 || r.annexed !== false || r.locked === null) {
                consistent = false;
                console.log("    a blowback looked like " + JSON.stringify(r));
            }
        }
    }

    check("a coup either takes the world or blows up in your face", consistent);
    check("both branches really happen", successes > 0 && blowbacks > 0, successes + " won / " + blowbacks + " lost");

    console.log("\na crushed coup hands the world to the other faction");
    await db.exec("delete from public.planet_diplomacy where planet = 'Veyra'");
    await db.exec("insert into public.planet_diplomacy (planet, faction, relation) values " +
        "('Veyra', 'Combine', 50), ('Veyra', 'Freedom Authority', 50)");

    let failed = null;
    for (let i = 0; i < 40 && !failed; i++) {
        await db.exec("update public.cities as c set faction = 'Independents' " +
            "where c.planet_id = (select p.id from public.planets as p where p.name = 'Veyra')");
        await db.exec("update public.planet_diplomacy set last_coup_at = null, relation = 50, locked_until = null " +
            "where planet = 'Veyra' and faction = 'Combine'");
        await db.exec("update public.planet_diplomacy set relation = 50 where planet = 'Veyra' and faction = 'Freedom Authority'");
        await as(db, COMB);
        const r = (await call(db, "select public.overthrow_government('Veyra') as r"))[0].r;
        if (!r.success) { failed = r; }
    }

    check("a failed coup was rolled", failed !== null, "no failure in 40 tries");

    if (failed) {
        check("the world swings to the other side", failed.relation === 0 && failed.theirs === 85,
            failed.relation + "/" + failed.theirs);
        check("and it is now their world", failed.theirs_level === "satellite", failed.theirs_level);

        const dipTheirs = (await call(db, "select public.diplomacy_state() as s"))[0].s;
        const v = dipTheirs.planets.find(p => p.planet === "Veyra");
        check("the map paints it in their colour now", v && v.patron === "them" && Number(v.leaned) === 0.75,
            JSON.stringify(v && { patron: v.patron, leaned: v.leaned }));

        const errDoor = await expectError(db, "select public.send_envoy('Veyra')");
        check("the new government will not see your envoys", /will not receive you/.test(String(errDoor)), errDoor);
        const errCoupAgain = await expectError(db, "select public.overthrow_government('Veyra')");
        check("nor will it take another coup while the door is shut", /will not receive you/.test(String(errCoupAgain)), errCoupAgain);

        await as(db, AUTH);
        const theirDoor = await expectError(db, "select public.send_envoy('Veyra')");
        check("but the other faction is welcome", theirDoor === null, theirDoor);

        /* a pact does not outlive the world it was signed with: whatever
           signature Veyra carried before it changed hands is void */
        const stale = await call(db, "select count(*)::int as n from public.planet_diplomacy " +
            "where planet = 'Veyra' and annexed_at is not null");
        check("and no pact outlives its world", Number(stale[0].n) === 0, stale[0].n);
    }

    /* ---------- supply lines ---------- */

    /* the coup loops above leave Volst however the dice last left it, and the
       network below is reasoned about on the three worlds the Combine began
       with: the world those coups moved is handed back to nobody first */
    await db.exec("delete from public.planet_diplomacy where planet = 'Volst'");
    await db.exec("update public.cities as c set faction = 'Independents' " +
        "where c.planet_id = (select p.id from public.planets as p where p.name = 'Volst')");

    console.log("\nthe network builds itself: a tree toward the capital");
    await as(db, COMB);
    let sup = (await call(db, "select public.supply_state() as s"))[0].s;

    check("the capital is the Combine's own world", sup.capital === "Ultramars", sup.capital);

    const byName = {};
    for (const w of sup.worlds) { byName[w.planet] = w; }

    check("every world we hold whole is on it", Object.keys(byName).sort().join(",") === "Kara,Krieg,Ultramars",
        Object.keys(byName).sort().join(","));
    check("a contested world is not", !byName.Elya);
    check("the capital feeds nobody", byName.Ultramars.capital === true && byName.Ultramars.parent === null,
        JSON.stringify(byName.Ultramars));
    check("Kara feeds straight off the capital", byName.Kara.parent === "Ultramars", byName.Kara.parent);
    check("Krieg feeds off Kara, the nearest world closer in", byName.Krieg.parent === "Kara", byName.Krieg.parent);
    check("so the tree is two links, not two spokes", sup.links.length === 2,
        sup.links.map(l => l.from + "->" + l.to).join(" "));
    check("all of it is carrying", sup.links.every(l => l.open === true) && Number(sup.total) === 100 + 50 + 100,
        sup.total);

    console.log("\nthe treasury receives the whole net, with no line to open");
    await db.exec("update public.faction_treasury set last_income_at = now() - interval '15 minutes' where faction = 'Combine'");
    await db.exec("update public.player_presence set last_active = now(), last_seen = now()");
    const start = Number((await call(db, "select credits from public.faction_treasury where faction = 'Combine'"))[0].credits);
    await call(db, "select public.collect_faction_income()");
    const paid = Number((await call(db, "select credits from public.faction_treasury where faction = 'Combine'"))[0].credits) - start;
    check("three payments of the three worlds", paid === 3 * 250, paid);

    console.log("\nan enemy in orbit of a world cuts that world's own link");
    await db.exec("insert into public.fleets (player_id, faction, name, status, origin) values " +
        "('" + AUTH + "', 'Freedom Authority', 'Blockade', 'stationed', 'Krieg')");
    sup = (await call(db, "select public.supply_state() as s"))[0].s;
    let krieg = sup.worlds.find(w => w.planet === "Krieg");
    check("Krieg is cut", krieg.open === false && krieg.own === false, JSON.stringify(krieg));
    check("the map is told which fleet did it", krieg.blockers.length === 1 && krieg.blockers[0].why === "orbit",
        JSON.stringify(krieg.blockers));
    check("Kara is untouched", sup.worlds.find(w => w.planet === "Kara").open === true);
    check("so the net carries 150", Number(sup.total) === 150, sup.total);

    await db.exec("update public.faction_treasury set last_income_at = now() - interval '15 minutes' where faction = 'Combine'");
    await db.exec("update public.player_presence set last_active = now(), last_seen = now()");
    const cutFrom = Number((await call(db, "select credits from public.faction_treasury where faction = 'Combine'"))[0].credits);
    await call(db, "select public.collect_faction_income()");
    const cutPaid = Number((await call(db, "select credits from public.faction_treasury where faction = 'Combine'"))[0].credits) - cutFrom;
    check("and the cut world paid nothing", cutPaid === 3 * 150, cutPaid);

    console.log("\na cut upstream starves everything behind it");
    await db.exec("delete from public.fleets");
    await db.exec("insert into public.fleets (player_id, faction, name, status, space_x, space_y) values " +
        "('" + AUTH + "', 'Freedom Authority', 'Corsair', 'in_space', 15, 29.5)");
    sup = (await call(db, "select public.supply_state() as s"))[0].s;
    krieg = sup.worlds.find(w => w.planet === "Krieg");
    const kara = sup.worlds.find(w => w.planet === "Kara");
    check("the corsair sits on Kara's link", kara.own === false && kara.open === false,
        JSON.stringify(kara.blockers));
    check("Krieg's own link is clear", krieg.own === true, JSON.stringify(krieg.blockers));
    check("but Krieg is starved behind Kara", krieg.open === false);
    check("only the capital is left", Number(sup.total) === 100, sup.total);
    check("and the link that is cut says why", sup.links.find(l => l.from === "Kara").open === false &&
        sup.links.find(l => l.from === "Krieg").own === true);

    console.log("\nthe corridor is the short hop, not the old spoke to the capital");
    await db.exec("update public.fleets set space_x = 45, space_y = 62");
    sup = (await call(db, "select public.supply_state() as s"))[0].s;
    check("a fleet on the Krieg-Kara hop cuts Krieg",
        sup.worlds.find(w => w.planet === "Krieg").open === false, sup.total);
    check("but Kara is still being paid", sup.worlds.find(w => w.planet === "Kara").open === true);
    check("so the net carries 150", Number(sup.total) === 150, sup.total);

    console.log("\nmove the enemy away and everything comes back by itself");
    await db.exec("update public.fleets set space_x = 95, space_y = 5");
    sup = (await call(db, "select public.supply_state() as s"))[0].s;
    check("no lines are left to open", Number(sup.total) === 250, sup.total);

    console.log("\na fleet of our own is never a block");
    await db.exec("update public.fleets set faction = 'Combine', player_id = '" + COMB + "', space_x = 15, space_y = 29.5");
    sup = (await call(db, "select public.supply_state() as s"))[0].s;
    check("a friendly fleet on the corridor is harmless", Number(sup.total) === 250 && sup.links.every(l => l.open),
        sup.total);

    console.log("\nthe old hands-on lines are gone");
    const gone = await call(db, "select count(*)::int as n from information_schema.routines " +
        "where routine_schema = 'public' and routine_name in ('open_supply_line', 'close_supply_line')");
    check("there is nothing left to open by hand", Number(gone[0].n) === 0, gone[0].n);
    const tableLeft = await call(db, "select count(*)::int as n from information_schema.tables " +
        "where table_schema = 'public' and table_name = 'supply_lines'");
    check("and no table of lines to keep", Number(tableLeft[0].n) === 0, tableLeft[0].n);

    console.log("\na world with no place on the map still pays");
    await db.exec("insert into public.planets (name, income) values ('Nowhere', 40)");
    await db.exec("insert into public.cities (planet_id, faction) select id, 'Combine' from public.planets where name = 'Nowhere'");
    sup = (await call(db, "select public.supply_state() as s"))[0].s;
    check("it hangs off the capital rather than disappearing", Number(sup.total) === 290,
        sup.worlds.map(w => w.planet + ":" + w.open).join(" "));
    await db.exec("delete from public.cities where planet_id = (select id from public.planets where name = 'Nowhere')");
    await db.exec("delete from public.planets where name = 'Nowhere'");

    /* ---------- the fog of war ---------- */

    console.log("\nthe fog of war");
    await db.exec("delete from public.fleets");
    await db.exec("insert into public.fleets (player_id, faction, name, status, origin) values " +
        "('" + COMB + "', 'Combine', 'Our Watch', 'stationed', 'Krieg')");
    await db.exec("insert into public.fleets (player_id, faction, name, status, space_x, space_y) values " +
        "('" + AUTH + "', 'Freedom Authority', 'Near', 'in_space', 72, 87)");
    await db.exec("insert into public.fleets (player_id, faction, name, status, space_x, space_y) values " +
        "('" + AUTH + "', 'Freedom Authority', 'Far', 'in_space', 45, 10)");

    await as(db, COMB);
    let seen = (await call(db, "select public.visible_enemy_fleets() as s"))[0].s;
    const names = seen.map(f => f.name).sort().join(",");
    check("only the enemy fleet near our world is read out", names === "Near", names);
    check("it comes as a whole fleet row", seen.length === 1 && seen[0].faction === "Freedom Authority" &&
        seen[0].player_id === AUTH, JSON.stringify(seen[0]).slice(0, 120));
    check("with where it is, so the map can draw it",
        Number(seen[0].map_x) === 72 && Number(seen[0].map_y) === 87, seen[0].map_x + "/" + seen[0].map_y);
    check("our own fleets are not in the answer", !seen.some(f => f.name === "Our Watch"));

    await db.exec("update public.fleets set space_x = 73, space_y = 88 where name = 'Far'");
    seen = (await call(db, "select public.visible_enemy_fleets() as s"))[0].s;
    check("a second fleet in sensor range appears", seen.length === 2, seen.map(f => f.name).join(","));

    await as(db, AUTH);
    seen = (await call(db, "select public.visible_enemy_fleets() as s"))[0].s;
    check("the other side sees the mirror image", seen.length === 1 && seen[0].name === "Our Watch",
        seen.map(f => f.name).join(","));

    console.log("\nvision is layered");
    const ranges = (await call(db, "select public.sensor_fleet_range() as f, public.sensor_world_range() as w"))[0];
    check("a world watches further than a hull does", Number(ranges.w) > Number(ranges.f), ranges.f + "/" + ranges.w);

    await as(db, COMB);

    /* Far is nineteen units below Kara, a world the Combine holds whole */
    await db.exec("update public.fleets set space_x = 20, space_y = 59 where name = 'Far'");
    seen = (await call(db, "select public.visible_enemy_fleets() as s"))[0].s;
    check("a world of ours sees nineteen units out", seen.some(f => f.name === "Far"),
        seen.map(f => f.name).join(","));

    await db.exec("update public.fleets set space_x = 20, space_y = 61 where name = 'Far'");
    seen = (await call(db, "select public.visible_enemy_fleets() as s"))[0].s;
    check("twenty-one is past the edge of it", !seen.some(f => f.name === "Far"),
        seen.map(f => f.name).join(","));

    console.log("\nfar from everything, a fleet is fog again");
    await db.exec("update public.fleets set space_x = 45, space_y = 10 where name = 'Near'");
    seen = (await call(db, "select public.visible_enemy_fleets() as s"))[0].s;
    check("nothing watches that patch of space", !seen.some(f => f.name === "Near"),
        seen.map(f => f.name).join(","));

    console.log("\na battle is never fog");
    await db.exec("update public.fleets set space_x = 45, space_y = 10, status = 'engaged' where name = 'Near'");
    seen = (await call(db, "select public.visible_enemy_fleets() as s"))[0].s;
    check("the fleet we are fighting is always read out", seen.some(f => f.name === "Near"),
        seen.map(f => f.name).join(","));
    await db.exec("update public.fleets set status = 'in_space' where name = 'Near'");

    /* ---------- the reset ---------- */

    console.log("\nthe reset button clears the embassies");
    await as(db, COMB);
    const errHost = await expectError(db, "select public.game_reset_extras()");
    check("only the host resets", /Only the host/.test(String(errHost)), errHost);

    await as(db, AUTH);
    await call(db, "select public.game_reset_extras()");
    check("the reset still runs without a lines table",
        (await call(db, "select count(*)::int as n from information_schema.tables " +
            "where table_schema = 'public' and table_name = 'supply_lines'"))[0].n === 0);
    check("and the embassies are gone",
        Number((await call(db, "select count(*)::int as n from public.planet_diplomacy"))[0].n) === 0);

    console.log("\nrunning the patches again is harmless");
    for (const file of FILES) {
        await db.exec(fs.readFileSync(path.join(ROOT, file), "utf8"));
    }
    const still = await call(db, "select count(*)::int as n from information_schema.routines " +
        "where routine_schema = 'public' and routine_name in ('arm_rebels', 'supply_state')");
    check("the functions are still there, once each", still[0].n === 2, still[0].n);
    await as(db, COMB);
    await db.exec("delete from public.fleets");
    check("and the network still runs afterwards",
        (await call(db, "select public.supply_state() as s"))[0].s.worlds.find(w => w.planet === "Krieg").open === true);
}
