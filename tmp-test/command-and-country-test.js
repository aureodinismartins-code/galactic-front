/* The six fixes of 2026-11-06, against real PostgreSQL (PGlite, the WASM
   build) with the game's own shape: a planet's key is its NAME, exactly as
   the game's screens use it ("planets.id" holds "Asteron", and cities carry
   that name in "planet_id"). That is the thing the old stand-in got wrong,
   and the thing that was breaking every diplomacy action with
   "invalid input syntax for type integer: Asteron".

   What is checked here:

     - the embassy and the dirty tricks work when the world is keyed by name;
     - a world held by the other faction needs no declaration of war;
     - two rival fleets in a neutral orbit start an orbit battle;
     - a damaged fleet can be repaired for credits, and only when it should be;
     - the Congress's tax level pays, and its meter starts itself;
     - unrest climbs on occupied worlds, eats their stability and revolts at 100;
     - a faction's own world is not an occupation: it earns no bar, and a stale
       one is thrown away instead of rising (2026-11-07);
     - the unrest clock stops once nobody has touched the game for two hours,
       so no world can rise in a game nobody is playing;
     - a chartered world the revolt threw to the Independents is handed back.
     - the Congress elects its own president, who holds the chamber's veto;
     - the reset button clears all of it.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/command-and-country-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const FILES = [
    "sql/2026-11-03_diplomacy_levels_supply_and_fog.sql",
    "sql/2026-11-04_automatic_supply_network.sql",
    "sql/2026-11-05_fog_of_war_vision.sql",
    "sql/2026-11-06_planet_keys_and_hostile_worlds.sql",
    "sql/2026-11-06_orbits_repairs_unrest_and_offices.sql",
    "sql/2026-11-07_charters_and_restless_worlds.sql",
    "sql/2026-11-09_capitals_are_always_their_own.sql"
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

/* a planet's key is its name, exactly as the game's screens use it */
create table public.planets (id text primary key, name text unique, income int default 100);
insert into public.planets (id, name, income) values
    ('Ultramars', 'Ultramars', 100),
    ('Free Earth', 'Free Earth', 100),
    ('Krieg', 'Krieg', 100),
    ('Kara', 'Kara', 50),
    ('Elya', 'Elya', 60),
    ('Veyra', 'Veyra', 50),
    ('Volst', 'Volst', 80),
    ('Asteron', 'Asteron', 90);

create table public.cities (id serial primary key, planet_id text, faction text, name text, garrison_level int default 3);
insert into public.cities (planet_id, faction, name) values
    ('Ultramars', 'Combine', 'Varkos'), ('Ultramars', 'Combine', 'Karsen'),
    ('Free Earth', 'Freedom Authority', 'New Lisbon'), ('Free Earth', 'Freedom Authority', 'Liberty City'),
    ('Krieg', 'Combine', 'Krieg Hold'), ('Kara', 'Combine', 'Kara Hold'),
    ('Elya', 'Combine', 'Elya Port'), ('Elya', 'Freedom Authority', 'Elya Ramp'),
    ('Veyra', 'Independents', 'Veyra Court'), ('Veyra', 'Independents', 'Veyra Docks'),
    ('Volst', 'Independents', 'Volst Keep'), ('Volst', 'Independents', 'Volst Mill'),
    ('Asteron', 'Independents', 'Asteron Gate');

create table public.city_buildings (id serial primary key, city_id int, building_type text);

create table public.planet_positions (name text primary key, x numeric, y numeric);
insert into public.planet_positions values
    ('Ultramars', 10, 19), ('Free Earth', 89, 84), ('Krieg', 70, 85),
    ('Kara', 20, 40), ('Elya', 80, 10), ('Veyra', 30, 30), ('Volst', 50, 50), ('Asteron', 60, 60);

create table public.faction_treasury (faction text primary key, credits numeric default 0, last_income_at timestamptz);
insert into public.faction_treasury (faction, credits, last_income_at) values
    ('Combine', 10000, now() - interval '15 minutes'),
    ('Freedom Authority', 10000, now() - interval '15 minutes'),
    ('Independents', 1000, now() - interval '15 minutes');

create table public.fleets (
    id uuid primary key default gen_random_uuid(),
    player_id uuid, faction text, name text, status text default 'stationed',
    origin text, destination text, departure_time timestamptz, arrival_time timestamptz,
    space_x numeric, space_y numeric, heading numeric, squads jsonb default '[]'::jsonb
);

create table public.planet_diplomacy (planet text not null, faction text not null,
    relation int not null default 0, envoys int not null default 0,
    last_envoy_at timestamptz, annexed_at timestamptz, primary key (planet, faction));

create table public.player_presence (player_id uuid primary key, last_seen timestamptz default now(),
    last_active timestamptz default now());
insert into public.player_presence (player_id) values ('${AUTH}'), ('${COMB}');

/* the Congress's books, as the earlier patches leave them */
create table public.cg_state (id int primary key, relations jsonb default '{}'::jsonb,
    president_player uuid, president_faction int default 1, term_no int default 0, term_end timestamptz,
    tax_level int default 0, popularity numeric default 55, last_turn_at timestamptz default now(),
    fa_online_at timestamptz default now(), last_tax_at timestamptz);
insert into public.cg_state (id) values (1);

create table public.cg_proposals (id serial primary key, title text, ptype text, status text default 'debate',
    planet text, result jsonb, resolved_at timestamptz, introduction_at timestamptz default now(),
    debate_at timestamptz default now(), vote_at timestamptz default now() + interval '10 minutes');

create table public.cg_occupations (id serial primary key, planet text unique, stage int default 0,
    stability numeric default 55, progress int default 0, seats int default 0, seats_target int default 3,
    last_turn_at timestamptz default now());

create table public.cg_authorizations (id serial primary key, kind text, planet text, player_id uuid, used boolean default false);

create table public.cs_state (id int primary key, confidence numeric default 55, quota int default 1,
    relations jsonb default '{}'::jsonb, secretary_player uuid, secretary_name text, secretary_current int,
    term_no int default 0, term_end timestamptz, veto_used boolean default false,
    online_at timestamptz, last_npc_at timestamptz, last_quota_at timestamptz,
    last_debate_at timestamptz, last_election_at timestamptz);
insert into public.cs_state (id) values (1);

create table public.cs_occupations (id serial primary key, planet text unique, stage int default 0,
    stability numeric default 55, progress int default 0, last_turn_at timestamptz default now());

create table public.cs_authorizations (id serial primary key, kind text, planet text, player_id uuid, used boolean default false);

create table public.cs_currents (id int primary key, name text, loyalty int);
insert into public.cs_currents values (1, 'Vanguarda Proletária', 60);
create table public.cs_membership (id serial primary key, player_id uuid, current_id int);

create table public.cg_log (id serial primary key, text text);
create table public.cs_log (id serial primary key, text text);

create table public.space_battles (id uuid primary key default gen_random_uuid(), kind text, planet text,
    x numeric, y numeric, status text default 'pending');
create table public.space_battle_fleets (id serial primary key, battle_id uuid, fleet_id uuid, side text,
    player_id uuid, faction text, fleet_name text, prev_status text, squads jsonb);

/* the rest of the Soviet's books, for the reset */
create table public.cs_directives (id serial primary key);
create table public.cs_votes (id serial primary key);
create table public.cs_debate_sides (id serial primary key);
create table public.cs_debate_standing (id serial primary key);
create table public.cs_privileges (id serial primary key);
create table public.cs_candidates (id serial primary key);
create table public.cs_election_votes (id serial primary key);
create table public.cs_election (id serial primary key);
create table public.cs_commissars (id serial primary key, current_id int, loyalty int default 55,
    is_disgraced boolean default false, active boolean default true);
create table public.cs_agitprop (id serial primary key);
create table public.ceasefires (id serial primary key);

create or replace function public.cg_log(p_text text) returns void language sql security definer set search_path to ''
as $$ insert into public.cg_log (text) values (p_text) $$;
create or replace function public.cs_log(p_text text) returns void language sql security definer set search_path to ''
as $$ insert into public.cs_log (text) values (p_text) $$;

create or replace function public.envoy_price() returns integer language sql immutable as $$ select 500 $$;
create or replace function public.envoy_wait() returns integer language sql immutable as $$ select 300 $$;

create or replace function public.last_touch() returns timestamptz language sql stable security definer
set search_path to '' as $$
    select max(coalesce(p.last_active, p.last_seen)) from public.player_presence as p
$$;

/* the economy's reading of how long the game has gone untouched, as
   2026-10-31 defines it: this is the reading that stops the unrest clock */
create or replace function public.income_mode() returns text language sql stable security definer
set search_path to '' as $$
    select case when public.last_touch() is null then 'full'
                when now() > public.last_touch() + interval '2 hours' then 'closed'
                when now() > public.last_touch() + interval '10 minutes' then 'reduced'
                else 'full' end
$$;

create or replace function public.game_frozen() returns boolean language sql stable security definer
set search_path to '' as $$ select false $$;

create or replace function public.truce_active() returns boolean language sql stable security definer
set search_path to '' as $$ select false $$;

create or replace function public.relations_reading() returns jsonb language sql stable security definer
set search_path to '' as $$ select jsonb_build_object('authority', 0, 'combine', 0, 'truce', false) $$;

/* what the base game's Congress tick calls, stubbed */
create or replace function public.cg_seed() returns void language sql as $$ select 1 $$;
create or replace function public.cg_is_fa() returns boolean language sql as $$ select true $$;
create or replace function public.cg_shift(p interval) returns void language sql as $$ select 1 $$;
create or replace function public.cg_run_elections() returns void language sql as $$ select 1 $$;
create or replace function public.cg_resolve(p integer) returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function public.cg_process_occupations() returns void language sql as $$ select 1 $$;
create or replace function public.cg_npc_proposal() returns void language sql as $$ select 1 $$;

/* the base game's check of the Congress, kept as the patch renames it */
create or replace function public.congress_can_attack(p_planet text)
returns boolean language plpgsql stable security definer set search_path to '' as $f$
begin
    return exists (select 1 from public.cg_authorizations as a
                   where a.kind = 'war' and a.planet = p_planet and not a.used);
end;
$f$;
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
        if (e && e.where) { console.log("where: " + e.where); }
        process.exit(1);
    }
    console.log(failures === 0 ? "\nall checks passed" : "\n" + failures + " check(s) failed");
    process.exit(failures === 0 ? 0 : 1);
})();

/* one patch, applied the way the SQL editor applies it: part by part, so a
   failure can say which part it was */
async function apply(db, file) {
    const sql = fs.readFileSync(path.join(ROOT, file), "utf8");
    const parts = sql.split(/\n(?=-- -{5,})/);
    for (let i = 0; i < parts.length; i++) {
        try {
            await db.exec(parts[i]);
        }
        catch (e) {
            console.log("  " + file + " failed in part " + i + ": " +
                parts[i].split("\n").find(l => l.trim() && !l.startsWith("--")) + " — " + e.message);
            throw e;
        }
    }
}

async function build() {
    const db = new PGlite();
    await db.exec(SCHEMA);

    for (const file of FILES) { await apply(db, file); }

    return db;
}

async function run() {

    console.log("the patches run");
    const db = await build();

    const made = await call(db, "select count(*)::int as n from information_schema.routines " +
        "where routine_schema = 'public' and routine_name in ('orbit_battle_scan', 'repair_fleet', " +
        "'unrest_tick', 'cg_speaker_state', 'congress_speaker_veto')");
    check("the new functions exist", Number(made[0].n) === 5, made[0].n);

    /* ---------------------------------------------------------
       1. diplomacy, keyed by name
       --------------------------------------------------------- */

    console.log("\nthe embassy works when a world is keyed by its name");
    await as(db, AUTH);
    const envoy = (await call(db, "select public.send_envoy('Asteron') as r"))[0].r;
    check("an envoy gets through instead of an integer error", envoy && envoy.planet === "Asteron", JSON.stringify(envoy));
    check("and it moves the reading by ten", Number(envoy.relation) === 10, envoy.relation);
    check("the treasury paid for it",
        Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits) === 9500);

    const again = await expectError(db, "select public.send_envoy('Asteron')");
    check("the court still makes you wait", /will see you again/.test(String(again)), again);

    console.log("\nand a world can sign the pact, keyed by name");
    await db.exec("insert into public.planet_diplomacy (planet, faction, relation, last_envoy_at) " +
        "values ('Veyra', 'Freedom Authority', 90, now() - interval '10 minutes') " +
        "on conflict (planet, faction) do update set relation = 90, last_envoy_at = now() - interval '10 minutes'");
    const seal = (await call(db, "select public.send_envoy('Veyra') as r"))[0].r;
    check("the tenth envoy seals it", seal && seal.annexed === true && Number(seal.relation) === 100, JSON.stringify(seal));
    const flag = await call(db, "select c.faction from public.cities as c join public.planets as p on p.id = c.planet_id where p.name = 'Veyra'");
    check("every city of it changes flag", flag.length === 2 && flag.every(f => f.faction === "Freedom Authority"),
        JSON.stringify(flag));

    await as(db, COMB);
    check("and the Combine may fall on it at once, with no campaign",
        (await call(db, "select public.cs_can_attack('Veyra') as b"))[0].b === true);

    await as(db, COMB);
    await db.exec("insert into public.planet_diplomacy (planet, faction, relation) values ('Asteron', 'Combine', 15)");
    const armed = (await call(db, "select public.arm_rebels('Asteron') as r"))[0].r;
    check("the rifles reach the rebels", armed && armed.action === "arm_rebels", JSON.stringify(armed));

    console.log("\na world of the other faction needs no declaration");
    check("the Congress may attack a Combine world",
        (await call(db, "select public.congress_can_attack('Krieg') as b"))[0].b === true);
    check("but an independent world still needs its declaration",
        (await call(db, "select public.congress_can_attack('Asteron') as b"))[0].b === false);
    await db.exec("insert into public.cg_authorizations (kind, planet) values ('war', 'Asteron')");
    check("and the declaration works as before",
        (await call(db, "select public.congress_can_attack('Asteron') as b"))[0].b === true);

    await as(db, COMB);
    check("the Soviet may campaign against an Authority world without a directive",
        (await call(db, "select public.cs_can_attack('Elya') as b"))[0].b === true);
    check("but not against an independent one",
        (await call(db, "select public.cs_can_attack('Volst') as b"))[0].b === false);

    /* ---------------------------------------------------------
       2. a battle in a neutral orbit
       --------------------------------------------------------- */

    console.log("\ntwo rival fleets in a neutral orbit fight");
    await db.exec("insert into public.fleets (id, player_id, faction, name, status, origin, squads) values " +
        "('aaaaaaaa-0000-0000-0000-000000000001', '" + AUTH + "', 'Freedom Authority', 'Hale 1st', 'stationed', 'Volst', " +
        "'[{\"type\":\"Rifle\",\"amount\":2}]'::jsonb), " +
        "('bbbbbbbb-0000-0000-0000-000000000002', '" + COMB + "', 'Combine', 'Volkov 1st', 'stationed', 'Volst', " +
        "'[{\"type\":\"Rifle\",\"amount\":2}]'::jsonb)");

    await as(db, AUTH);
    const scan = (await call(db, "select public.orbit_battle_scan() as r"))[0].r;
    check("the scan reports the orbit", Array.isArray(scan) && scan.length === 1 && scan[0].planet === "Volst",
        JSON.stringify(scan));

    const battle = await call(db, "select b.kind, b.planet, b.status from public.space_battles as b");
    check("an orbit battle was written", battle.length === 1 && battle[0].kind === "orbit" &&
        battle[0].planet === "Volst" && battle[0].status === "pending", JSON.stringify(battle));

    const sides = await call(db, "select f.side, f.faction from public.space_battle_fleets as f order by f.side");
    check("with both fleets in it", sides.length === 2 && sides[0].side === "A" && sides[1].side === "D",
        JSON.stringify(sides));

    const engaged = await call(db, "select count(*)::int as n from public.fleets where status = 'engaged'");
    check("and both fleets now engaged", Number(engaged[0].n) === 2, engaged[0].n);

    const twice = (await call(db, "select public.orbit_battle_scan() as r"))[0].r;
    check("a second scan does not open a second battle", Array.isArray(twice) && twice.length === 0, JSON.stringify(twice));

    console.log("\nbut not everywhere");
    await db.exec("update public.space_battles set status = 'finished'");
    await db.exec("update public.fleets set status = 'stationed', origin = 'Asteron' where id = 'aaaaaaaa-0000-0000-0000-000000000001'");
    const alone = (await call(db, "select public.orbit_battle_scan() as r"))[0].r;
    check("one fleet in an orbit is not a battle", Array.isArray(alone) && alone.length === 0, JSON.stringify(alone));

    await db.exec("update public.fleets set origin = 'Krieg', status = 'stationed' where id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002')");
    const held = (await call(db, "select public.orbit_battle_scan() as r"))[0].r;
    check("nor is a world somebody already holds", Array.isArray(held) && held.length === 0, JSON.stringify(held));

    /* the base game's own routine, when the database has it */
    console.log("\nand the base game's own orbit routine is used when it exists");
    await db.exec("update public.fleets set origin = 'Volst', status = 'stationed' where id in ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002')");
    await db.exec("update public.space_battles set status = 'finished'");
    await db.exec("create function public.space_battle_start_orbit(p_attacker uuid, p_planet text) returns uuid " +
        "language sql as $$ select 'cccccccc-0000-0000-0000-000000000003'::uuid $$");
    const viaBase = (await call(db, "select public.orbit_battle_scan() as r"))[0].r;
    check("the scan hands the work to it", Array.isArray(viaBase) && viaBase.length === 1 &&
        viaBase[0].id === "cccccccc-0000-0000-0000-000000000003", JSON.stringify(viaBase));
    check("and writes no battle of its own",
        Number((await call(db, "select count(*)::int as n from public.space_battles where status = 'pending'"))[0].n) === 0);

    /* ---------------------------------------------------------
       3. the dock
       --------------------------------------------------------- */

    console.log("\na damaged fleet can be repaired");
    await db.exec("update public.fleets set status = 'stationed', origin = 'Krieg', squads = " +
        "'[{\"type\":\"Rifle\",\"amount\":2,\"soldiers\":1200,\"soldiersPerDivision\":1000},{\"type\":\"MG\",\"amount\":1,\"soldiers\":200,\"soldiersPerDivision\":750}]'::jsonb " +
        "where id = 'aaaaaaaa-0000-0000-0000-000000000001'");
    await as(db, AUTH);

    const quote = (await call(db, "select public.fleet_repair_quote('aaaaaaaa-0000-0000-0000-000000000001') as q"))[0].q;
    check("the dock reads the fleet's full strength", Number(quote.full) === 2750, quote.full);
    check("and what is left of it", Number(quote.left) === 1400, quote.left);
    check("the missing soldiers are the rest", Number(quote.missing) === 1350, quote.missing);
    check("the price is 40 credits the thousand", Number(quote.price) === 54, quote.price);
    check("the dock will take the work", quote.can === true, JSON.stringify(quote));

    const beforeRepair = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);
    const fixed = (await call(db, "select public.repair_fleet('aaaaaaaa-0000-0000-0000-000000000001') as r"))[0].r;
    const afterRepair = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);
    check("the dock was paid", beforeRepair - afterRepair === 54, beforeRepair + " -> " + afterRepair);
    check("the fleet is whole again", Number(fixed.left) === 2750 && Number(fixed.fraction) === 1,
        JSON.stringify(fixed));

    const squads = (await call(db, "select squads from public.fleets where id = 'aaaaaaaa-0000-0000-0000-000000000001'"))[0].squads;
    check("every squad is back at its establishment",
        squads.every(e => Number(e.soldiers) === Number(e.amount) * Number(e.soldiersPerDivision)) &&
        squads[1].soldiersPerDivision === 750, JSON.stringify(squads));

    const nowhere = await expectError(db, "select public.repair_fleet('aaaaaaaa-0000-0000-0000-000000000001')");
    check("a whole fleet is refused", /already at full strength/.test(String(nowhere)), nowhere);

    await db.exec("update public.fleets set squads = '[{\"type\":\"Rifle\",\"amount\":2,\"soldiers\":1000}]'::jsonb where id = 'aaaaaaaa-0000-0000-0000-000000000001'");
    await as(db, COMB);
    const notMine = await expectError(db, "select public.repair_fleet('aaaaaaaa-0000-0000-0000-000000000001')");
    check("and nobody repairs another fleet", /do not command/.test(String(notMine)), notMine);

    await db.exec("update public.fleets set status = 'travelling' where id = 'aaaaaaaa-0000-0000-0000-000000000001'");
    await as(db, AUTH);
    const moving = await expectError(db, "select public.repair_fleet('aaaaaaaa-0000-0000-0000-000000000001')");
    check("nor a fleet that is under way", /stationed in orbit/.test(String(moving)), moving);

    await db.exec("update public.fleets set status = 'stationed' where id = 'aaaaaaaa-0000-0000-0000-000000000001'");
    await db.exec("update public.faction_treasury set credits = 0 where faction = 'Freedom Authority'");
    const broke = await expectError(db, "select public.repair_fleet('aaaaaaaa-0000-0000-0000-000000000001')");
    check("nor without the credits", /dock wants/.test(String(broke)), broke);
    await db.exec("update public.faction_treasury set credits = 10000 where faction = 'Freedom Authority'");

    const board = (await call(db, "select public.fleet_repair_board() as b"))[0].b;
    check("the map's board lists the damaged fleets", Array.isArray(board) && board.length === 1 &&
        Number(board[0].missing) === 1000, JSON.stringify(board));

    /* ---------------------------------------------------------
       4. the Congress's tax
       --------------------------------------------------------- */

    console.log("\nthe tax level pays");
    await db.exec("update public.cg_state set tax_level = 2, last_tax_at = now() - interval '30 minutes' where id = 1");
    await as(db, AUTH);
    const creditsBefore = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);
    await call(db, "select public.congress_tick()");
    const creditsAfter = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);
    const gained = creditsAfter - creditsBefore;
    check("two quarter hours at two levels paid", gained >= 1200 && gained <= 2000, gained);
    const meter = (await call(db, "select last_tax_at from public.cg_state where id = 1"))[0].last_tax_at;
    check("and the meter moved on", meter !== null && meter !== undefined, meter);
    const drift = await call(db, "select extract(epoch from (now() - last_tax_at))::int as s from public.cg_state where id = 1");
    check("by the two quarter hours it paid for", Math.abs(Number(drift[0].s)) <= 3, drift[0].s);

    const nothing = await call(db, "select count(*)::int as n from public.cg_log where text like 'TAXES%'");
    check("the collection is written into the book", Number(nothing[0].n) >= 1, nothing[0].n);

    await db.exec("update public.cg_state set tax_level = 0, last_tax_at = now() - interval '15 minutes' where id = 1");
    const zeroBefore = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);
    await call(db, "select public.congress_tick()");
    const zeroAfter = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);
    check("a tax level of zero pays nothing", zeroAfter === zeroBefore, zeroAfter - zeroBefore);

    console.log("\nand a meter that was never started starts itself");
    await db.exec("update public.cg_state set tax_level = 2, last_tax_at = null where id = 1");
    const nullBefore = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);
    await call(db, "select public.congress_tick()");
    const nullAfter = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);
    const started = (await call(db, "select last_tax_at from public.cg_state where id = 1"))[0].last_tax_at;
    check("no back pay for a clock that never ran", nullAfter === nullBefore, nullAfter - nullBefore);
    check("but the meter is running now", started !== null && started !== undefined, started);

    /* ---------------------------------------------------------
       5. unrest
       --------------------------------------------------------- */

    console.log("\nunrest on the worlds that were taken");
    await db.exec("insert into public.cg_occupations (planet, stage, stability) values ('Asteron', 1, 55)");
    await db.exec("insert into public.cities (planet_id, faction, name) values ('Asteron', 'Freedom Authority', 'New Ardent')");
    await db.exec("delete from public.cities where planet_id = 'Asteron' and faction = 'Independents'");
    await as(db, AUTH);

    const seeded = (await call(db, "select public.unrest_state() as s"))[0].s;
    check("the occupied world has a bar", seeded.worlds.length === 1 && seeded.worlds[0].planet === "Asteron",
        JSON.stringify(seeded));
    check("it starts at 25 and restless", Number(seeded.worlds[0].unrest) === 25 && seeded.worlds[0].mood === "CALM",
        seeded.worlds[0].unrest + "/" + seeded.worlds[0].mood);
    check("and the turn is five minutes", Number(seeded.turn) === 300 && Number(seeded.revolt_at) === 100,
        seeded.turn + "/" + seeded.revolt_at);

    await db.exec("update public.planet_unrest set last_turn_at = now() - interval '20 minutes' where planet = 'Asteron'");
    const ticked = (await call(db, "select public.unrest_tick() as r"))[0].r;
    const afterTick = (await call(db, "select public.unrest_state() as s"))[0].s;
    check("four turns of five minutes move the bar", Array.isArray(ticked) && Number(afterTick.worlds[0].unrest) > 25,
        JSON.stringify(afterTick.worlds[0]));
    check("the bar is marked restless once it is up", afterTick.worlds[0].mood === "RESTLESS" ||
        afterTick.worlds[0].mood === "RIOTING" || afterTick.worlds[0].mood === "REVOLT", afterTick.worlds[0].mood);
    const stab = (await call(db, "select stability from public.cg_occupations where planet = 'Asteron'"))[0].stability;
    check("and it eats the occupation's stability", Number(stab) < 55, stab);

    console.log("\nand at a hundred the world rises");
    await db.exec("update public.planet_unrest set unrest = 96, last_turn_at = now() - interval '10 minutes' where planet = 'Asteron'");
    const revolt = (await call(db, "select public.unrest_tick() as r"))[0].r;
    check("the tick reports the revolt", Array.isArray(revolt) && revolt.some(x => x.revolted === true),
        JSON.stringify(revolt));
    const flags = await call(db, "select c.faction from public.cities as c join public.planets as p on p.id = c.planet_id where p.name = 'Asteron'");
    check("every city of it is independent again", flags.length > 0 && flags.every(f => f.faction === "Independents"),
        JSON.stringify(flags));
    check("the occupation is closed",
        Number((await call(db, "select count(*)::int as n from public.cg_occupations where planet = 'Asteron'"))[0].n) === 0);
    check("the bar is gone with it",
        Number((await call(db, "select count(*)::int as n from public.planet_unrest where planet = 'Asteron'"))[0].n) === 0);
    const heard = (await call(db, "select count(*)::int as n from public.cs_log where text like 'REVOLTA%'"))[0].n;
    check("both books heard of it", Number(heard) === 1, heard);

    /* ---------------------------------------------------------
       5b. a faction's own world is not an occupation (2026-11-07)
       --------------------------------------------------------- */

    console.log("\nthe capital is nobody's occupation");
    await db.exec("insert into public.cs_occupations (planet, stage, stability) values ('Ultramars', 0, 30)");
    await db.exec("update public.cities set faction = 'Combine' where planet_id = 'Ultramars'");
    await as(db, AUTH);

    const capital = (await call(db, "select public.unrest_state() as s"))[0].s;
    check("the Combine's own capital earns no bar, administration or not",
        capital.worlds.filter(w => w.planet === "Ultramars").length === 0, JSON.stringify(capital.worlds));

    /* the bar the bug gave it, at the ninety-six it reached */
    await db.exec("insert into public.planet_unrest (planet, faction, unrest, last_turn_at) " +
        "values ('Ultramars', 'Combine', 96, now() - interval '10 minutes')");
    const staleTick = (await call(db, "select public.unrest_tick() as r"))[0].r;
    check("a stale bar on it is thrown away instead of rising",
        Array.isArray(staleTick) && staleTick.length === 0 &&
        Number((await call(db, "select count(*)::int as n from public.planet_unrest where planet = 'Ultramars'"))[0].n) === 0,
        JSON.stringify(staleTick));
    const capitalFlags = await call(db, "select c.faction from public.cities as c " +
        "join public.planets as p on p.id = c.planet_id where p.name = 'Ultramars'");
    check("its cities stay the Combine's",
        capitalFlags.length > 0 && capitalFlags.every(f => f.faction === "Combine"),
        JSON.stringify(capitalFlags));

    console.log("\nand nothing moves while nobody has touched the game");
    await db.exec("insert into public.planet_unrest (planet, faction, unrest, last_turn_at) " +
        "values ('Kara', 'Combine', 60, now() - interval '20 minutes')");
    await db.exec("update public.player_presence set last_active = now() - interval '3 hours', " +
        "last_seen = now() - interval '3 hours'");
    await as(db, AUTH);
    check("the economy reads the game as closed",
        (await call(db, "select public.income_mode() as m"))[0].m === "closed");

    const stopped = (await call(db, "select public.unrest_tick() as r"))[0].r;
    check("the unrest clock stops with it", Array.isArray(stopped) && stopped.length === 0,
        JSON.stringify(stopped));
    check("the bar has not moved",
        Number((await call(db, "select unrest from public.planet_unrest where planet = 'Kara'"))[0].unrest) === 60);

    await db.exec("update public.player_presence set last_active = now(), last_seen = now()");
    const running = (await call(db, "select public.unrest_tick() as r"))[0].r;
    check("somebody comes back and it climbs again",
        Array.isArray(running) && running.some(x => x.planet === "Kara") &&
        Number((await call(db, "select unrest from public.planet_unrest where planet = 'Kara'"))[0].unrest) > 60,
        JSON.stringify(running));

    console.log("\na chartered world the revolt threw to the Independents comes home");
    await db.exec("update public.cities set faction = 'Independents' where planet_id = 'Ultramars'");
    await db.exec("insert into public.planet_unrest (planet, faction, unrest) values ('Ultramars', 'Combine', 40) " +
        "on conflict (planet) do nothing");
    await apply(db, "sql/2026-11-07_charters_and_restless_worlds.sql");

    const home = await call(db, "select c.faction from public.cities as c " +
        "join public.planets as p on p.id = c.planet_id where p.name = 'Ultramars'");
    check("the capital is the Combine's again",
        home.length > 0 && home.every(f => f.faction === "Combine"), JSON.stringify(home));
    check("and the bar that should never have existed is gone",
        Number((await call(db, "select count(*)::int as n from public.planet_unrest where planet = 'Ultramars'"))[0].n) === 0);
    check("the repair says so in the books",
        Number((await call(db, "select count(*)::int as n from public.cg_log where text like 'RESTAURO%'"))[0].n) === 1);

    /* ---------------------------------------------------------
       5c. the braces: the game cannot reset itself again
       --------------------------------------------------------- */

    console.log("\nand the galaxy can never be emptied again");

    /* a capital is protected even with the charters table wiped: the two
       home worlds are written into the code as well */
    await db.exec("delete from public.planet_charters");
    await db.exec("update public.cities set faction = 'Combine' where planet_id = 'Ultramars'");
    await db.exec("insert into public.planet_unrest (planet, faction, unrest, last_turn_at) " +
        "values ('Ultramars', 'Combine', 99, now() - interval '30 minutes') " +
        "on conflict (planet) do update set unrest = 99, last_turn_at = now() - interval '30 minutes'");
    await as(db, AUTH);
    const heldTick = (await call(db, "select public.unrest_tick() as r"))[0].r;
    const capitalAfter = await call(db, "select c.faction from public.cities as c " +
        "join public.planets as p on p.id = c.planet_id where p.name = 'Ultramars'");
    check("a capital stays its faction's even with the charters table empty",
        capitalAfter.length > 0 && capitalAfter.every(f => f.faction === "Combine"),
        JSON.stringify({ flags: capitalAfter, tick: heldTick }));

    /* two worlds of the same faction at the very edge: one rises, not both */
    await db.exec("delete from public.planet_unrest");
    await db.exec("update public.cities set faction = 'Combine' where planet_id in ('Kara', 'Krieg')");
    await db.exec("insert into public.planet_unrest (planet, faction, unrest, last_turn_at) values " +
        "('Kara', 'Combine', 99, now() - interval '30 minutes'), " +
        "('Krieg', 'Combine', 99, now() - interval '30 minutes')");
    await call(db, "select public.unrest_tick()");

    const flagOf = async (planet) => (await call(db, "select c.faction from public.cities as c " +
        "join public.planets as p on p.id = c.planet_id where p.name = '" + planet + "'"))[0].faction;
    const kara1 = await flagOf("Kara");
    const krieg1 = await flagOf("Krieg");
    check("only one world rises in a tick", [kara1, krieg1].filter(f => f === "Independents").length === 1,
        kara1 + "/" + krieg1);

    const left = await call(db, "select u.planet, u.unrest from public.planet_unrest as u order by u.planet");
    check("the other holds one short of rising rather than following it",
        left.length === 1 && Number(left[0].unrest) === 99, JSON.stringify(left));

    /* strip the Combine down to that one world — Elya has a Combine city of
       its own, so every other world is handed back first */
    const survivor = left[0].planet;
    await db.exec("update public.cities set faction = 'Independents' " +
        "where faction = 'Combine' and planet_id is distinct from '" + survivor + "'");
    await db.exec("update public.planet_unrest set last_turn_at = now() - interval '30 minutes'");
    await call(db, "select public.unrest_tick()");
    const lastFlag = await flagOf(left[0].planet);
    check("a faction's last world never rises", lastFlag === "Combine", lastFlag);

    /* give the faction another world and the guard lets go */
    await db.exec("update public.cities set faction = 'Combine' where planet_id = 'Ultramars'");
    await db.exec("update public.planet_unrest set last_turn_at = now() - interval '30 minutes'");
    await call(db, "select public.unrest_tick()");
    const freeFlag = await flagOf(left[0].planet);
    check("with another world to its name, it may rise after all", freeFlag === "Independents", freeFlag);

    /* ---------------------------------------------------------
       5d. a capital is always cored by its faction (2026-11-09)
       --------------------------------------------------------- */

    console.log("\nand a capital always belongs to its own faction");

    /* make a mess of the Combine's capital: independent cities, an occupation,
       a pact and a bar of the other side's */
    await db.exec("update public.cities set faction = 'Independents' where planet_id = 'Ultramars'");
    await db.exec("insert into public.cs_occupations (planet, stage, stability) values ('Ultramars', 0, 30) " +
        "on conflict (planet) do nothing");
    await db.exec("insert into public.planet_diplomacy (planet, faction, relation, annexed_at) " +
        "values ('Ultramars', 'Freedom Authority', 60, now()) on conflict (planet, faction) do nothing");
    await db.exec("insert into public.planet_unrest (planet, faction, unrest) values ('Ultramars', 'Freedom Authority', 40) " +
        "on conflict (planet) do update set faction = 'Freedom Authority', unrest = 40");

    const cored = (await call(db, "select public.charters_core_capitals() as n"))[0].n;
    check("both capitals are cored", Number(cored) === 2, cored);

    const coredFlags = await call(db, "select c.faction from public.cities as c " +
        "join public.planets as p on p.id = c.planet_id where p.name = 'Ultramars'");
    check("the capital's cities are its faction's again",
        coredFlags.length > 0 && coredFlags.every(f => f.faction === "Combine"), JSON.stringify(coredFlags));
    check("and nothing else is left on it: no occupation, no pact, no bar",
        Number((await call(db, "select count(*)::int as n from public.cs_occupations where planet = 'Ultramars'"))[0].n) === 0 &&
        Number((await call(db, "select count(*)::int as n from public.planet_diplomacy where planet = 'Ultramars'"))[0].n) === 0 &&
        Number((await call(db, "select count(*)::int as n from public.planet_unrest where planet = 'Ultramars'"))[0].n) === 0);
    check("and the game reads both capitals as cored",
        (await call(db, "select public.charters_are_cored() as ok"))[0].ok === true);

    /* ---------------------------------------------------------
       6. the Congress's own president
       --------------------------------------------------------- */

    console.log("\nthe Congress elects its own president");
    await as(db, AUTH);
    let speaker = (await call(db, "select public.cg_speaker_state() as s"))[0].s;
    check("the chair starts empty", speaker.speaker === null, JSON.stringify(speaker.speaker));
    check("a campaign opens by itself", speaker.election !== null && speaker.election.phase === "campaign",
        JSON.stringify(speaker.election));

    await call(db, "select public.cg_speaker_run()");
    speaker = (await call(db, "select public.cg_speaker_state() as s"))[0].s;
    check("an Authority player can stand", speaker.election.candidates.length === 1 &&
        speaker.election.candidates[0].name === "President Hale", JSON.stringify(speaker.election.candidates));

    await db.exec("update public.cg_speaker_election set campaign_end = now() - interval '1 second'");
    speaker = (await call(db, "select public.cg_speaker_state() as s"))[0].s;
    check("the campaign closes into a vote", speaker.election.phase === "voting", speaker.election.phase);

    await call(db, "select public.cg_speaker_vote('" + AUTH + "')");
    await db.exec("update public.cg_speaker_election set vote_end = now() - interval '1 second'");
    speaker = (await call(db, "select public.cg_speaker_state() as s"))[0].s;
    check("the vote is counted", speaker.speaker !== null && speaker.speaker.name === "President Hale",
        JSON.stringify(speaker.speaker));
    check("the president knows it is them", speaker.speaker.me === true, speaker.speaker.me);
    check("for a two week term", speaker.speaker.term_end !== null && speaker.speaker.term_no === 1,
        speaker.speaker.term_end);
    check("and the election is closed", speaker.election === null && speaker.last.winner === "President Hale",
        JSON.stringify(speaker.last));

    console.log("\nand the chamber's veto is theirs");
    await db.exec("insert into public.cg_proposals (title, ptype, status) values ('Fleet Construction', 'fleet_construction', 'debate')");
    const billId = Number((await call(db, "select id from public.cg_proposals order by id limit 1"))[0].id);
    const veto = (await call(db, "select public.congress_speaker_veto(" + billId + ") as r"))[0].r;
    check("the president may veto a live bill", veto && veto.ok === true, JSON.stringify(veto));
    const killed = (await call(db, "select status from public.cg_proposals where id = " + billId))[0].status;
    check("the bill is rejected", killed === "rejected", killed);
    const once = await expectError(db, "select public.congress_speaker_veto(" + billId + ")");
    check("but only once a term", /veto of this term has been used/.test(String(once)), once);

    await as(db, COMB);
    const notSpeaker = await expectError(db, "select public.congress_speaker_veto(1)");
    check("and not by anybody else", /Only the President of the Congress/.test(String(notSpeaker)), notSpeaker);

    /* ---------------------------------------------------------
       7. the reset button
       --------------------------------------------------------- */

    console.log("\nthe reset button clears all of it");
    await db.exec("insert into public.planet_unrest (planet, faction, unrest) values ('Kara', 'Combine', 40) " +
        "on conflict (planet) do nothing");
    await db.exec("insert into public.cs_occupations (planet, stage, stability) values ('Kara', 0, 50)");
    await as(db, AUTH);
    await call(db, "select public.game_reset_extras()");

    check("the unrest bars are gone",
        Number((await call(db, "select count(*)::int as n from public.planet_unrest"))[0].n) === 0);
    check("the Congress's chair is empty",
        (await call(db, "select speaker_player from public.cg_speaker_state where id = 1"))[0].speaker_player === null);
    check("the election book is wiped",
        Number((await call(db, "select count(*)::int as n from public.cg_speaker_election"))[0].n) === 0 &&
        Number((await call(db, "select count(*)::int as n from public.cg_speaker_votes"))[0].n) === 0);
    check("and the tax meter starts again",
        (await call(db, "select last_tax_at from public.cg_state where id = 1"))[0].last_tax_at !== null);
}
