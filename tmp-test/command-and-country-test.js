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
     - the Congress elects its own Speaker, who holds the chamber's veto;
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
    "sql/2026-11-09_capitals_are_always_their_own.sql",
    "sql/2026-11-10_pacified_worlds_and_the_opening_quota.sql",
    "sql/2026-11-13_the_occupation_has_a_policy.sql",
    "sql/2026-11-14_the_blockade_reaches_the_capital.sql",
    "sql/2026-11-15_committees_and_ministers.sql",
    "sql/2026-11-12_the_speakers_chair.sql"
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

/* sponsor_faction_id is the real game's column: the NPC proposers write it
   and the vote scores every delegate against it */
create table public.cg_proposals (id serial primary key, title text, ptype text, status text default 'debate',
    sponsor_faction_id int, planet text, result jsonb, resolved_at timestamptz,
    introduction_at timestamptz default now(),
    debate_at timestamptz default now(), vote_at timestamptz default now() + interval '10 minutes');

create table public.cg_occupations (id serial primary key, planet text unique, stage int default 0,
    stability numeric default 55, progress int default 0, seats int default 0, seats_target int default 3,
    last_turn_at timestamptz default now());

create table public.cg_authorizations (id serial primary key, kind text, planet text, player_id uuid, used boolean default false);

create table public.cg_factions (id int primary key, key text, name text, color text, seats int default 0,
    loyalty numeric default 50, alignment_x numeric default 0, alignment_y numeric default 0,
    description text, credits numeric default 5000);
insert into public.cg_factions (id, key, name, color) values
    (1, 'militarists', 'The Militarists', '#c0272d'),
    (2, 'environmentalists', 'The Environmentalists', '#2fbf6a'),
    (3, 'technocrats', 'The Technocrats', '#4cc2ff'),
    (4, 'reformers', 'The Reformers', '#c08a2e');

create table public.cg_members (id serial primary key, name text, faction_id int references public.cg_factions (id),
    region text, area int, seat int, loyalty numeric default 60, active boolean default true,
    corruption_level int default 0, bribes_received int default 0, is_corrupted boolean default false,
    alignment_x numeric default 0, alignment_y numeric default 0, planet text, bribe_exposure numeric default 0.05);

create table public.cs_state (id int primary key, confidence numeric default 55, quota int default 1,
    relations jsonb default '{}'::jsonb, secretary_player uuid, secretary_name text, secretary_current int,
    term_no int default 0, term_end timestamptz, veto_used boolean default false,
    online_at timestamptz, last_npc_at timestamptz, last_quota_at timestamptz,
    last_debate_at timestamptz, last_election_at timestamptz);
insert into public.cs_state (id) values (1);

create table public.cs_occupations (id serial primary key, planet text unique, stage int default 0,
    stability numeric default 55, progress int default 0, last_turn_at timestamptz default now());

create table public.cs_authorizations (id serial primary key, kind text, planet text, player_id uuid, used boolean default false);

create table public.cs_currents (id int primary key, name text, loyalty int, seats int default 0, color text);
insert into public.cs_currents values
    (1, 'Vanguarda Proletária', 60),
    (2, 'Aparato do Partido', 55),
    (3, 'Comando Vermelho', 74);
create table public.cs_membership (id serial primary key, player_id uuid, current_id int);

create table public.cg_log (id serial primary key, text text);
create table public.cs_log (id serial primary key, text text);

create table public.space_battles (id uuid primary key default gen_random_uuid(), kind text, planet text,
    x numeric, y numeric, status text default 'pending');
create table public.space_battle_fleets (id serial primary key, battle_id uuid, fleet_id uuid, side text,
    player_id uuid, faction text, fleet_name text, prev_status text, squads jsonb);

/* the rest of the Soviet's books, for the reset. The directives carry the
   columns the plenum's own screen reads, as the real book does. */
create table public.cs_directives (id serial primary key, dtype text, title text, status text default 'debate',
    sponsor_current int, proposer_player uuid, planet text, fleet_id text,
    debate_at timestamptz default now(), vote_at timestamptz default now() + interval '10 minutes',
    required_votes int, result jsonb);
create table public.cs_votes (id serial primary key);
create table public.cs_debate_sides (id serial primary key);
create table public.cs_debate_standing (id serial primary key);
create table public.cs_privileges (id serial primary key);
create table public.cs_candidates (id serial primary key);
create table public.cs_election_votes (id serial primary key);
create table public.cs_election (id serial primary key);
create table public.cs_commissars (id serial primary key, name text, current_id int, oblast text,
    seat int, loyalty int default 55, alignment_x numeric default 0, alignment_y numeric default 0,
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

    /* running an older patch again does not undo the newer ones in a real
       install — the SQL editor runs them in order — so the patches that
       replaced what 11-07 wrote are put back here, in that order */
    await apply(db, "sql/2026-11-13_the_occupation_has_a_policy.sql");
    await apply(db, "sql/2026-11-14_the_blockade_reaches_the_capital.sql");

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
       5e. a pacified world sends its people (2026-11-10)
       --------------------------------------------------------- */

    console.log("\nand a pacified world sends its people");

    /* the Combine opens a war with three fleet quotas of its own */
    await db.exec("delete from public.cs_authorizations");
    await db.exec("update public.fleets set faction = 'Independents' where faction = 'Combine'");
    await as(db, COMB);

    let seed = (await call(db, "select public.game_opening_quotas() as r"))[0].r;
    check("the Combine opens the war with three fleet quotas",
        Number(seed.granted) === 3 && Number(seed.floor) === 3, JSON.stringify(seed));

    seed = (await call(db, "select public.game_opening_quotas() as r"))[0].r;
    check("and calling it again changes nothing", Number(seed.granted) === 0 &&
        Number((await call(db, "select count(*)::int as n from public.cs_authorizations " +
            "where kind = 'fleet' and not used"))[0].n) === 3, JSON.stringify(seed));

    /* three fleets of its own meet the floor, so nothing is handed out */
    await db.exec("insert into public.fleets (faction, name, status) values " +
        "('Combine','One','stationed'), ('Combine','Two','stationed'), ('Combine','Three','stationed')");
    await db.exec("delete from public.cs_authorizations");
    seed = (await call(db, "select public.game_opening_quotas() as r"))[0].r;
    check("three fleets in service meet it on their own", Number(seed.granted) === 0, JSON.stringify(seed));

    /* two fleets and the floor hands over exactly the third */
    await db.exec("update public.fleets set faction = 'Independents' where name = 'Three'");
    seed = (await call(db, "select public.game_opening_quotas() as r"))[0].r;
    check("two fleets leave room for one more", Number(seed.granted) === 1, JSON.stringify(seed));

    /* a world held whole, one turn short of incorporation */
    await db.exec("update public.fleets set faction = 'Independents' where name in ('One','Two')");
    await db.exec("delete from public.cs_occupations");
    await db.exec("delete from public.cs_commissars");
    await db.exec("update public.cities set faction = 'Combine' where planet_id = 'Krieg'");
    await db.exec("insert into public.cs_occupations (planet, stage, stability, progress, last_turn_at) " +
        "values ('Krieg', 2, 50, 4, now() - interval '10 minutes')");
    /* it is the stage change that seats the commissar, whichever tick made it;
       the Soviet's own suite drives the real advance (cs_process_occupations) */
    await db.exec("update public.cs_occupations set stage = 3 where planet = 'Krieg'");

    const seated = await call(db, "select m.name, m.oblast, m.seat, m.current_id, m.active " +
        "from public.cs_commissars as m");
    check("an incorporated world seats one more commissar",
        seated.length === 1 && seated[0].active === true, JSON.stringify(seated));
    check("and the commissar is from that world", seated[0] && seated[0].oblast === "Krieg",
        JSON.stringify(seated[0]));
    check("in a current of the three",
        seated[0] && [1, 2, 3].indexOf(Number(seated[0].current_id)) !== -1, JSON.stringify(seated[0]));
    check("and the plenum hears of it",
        Number((await call(db, "select count(*)::int as n from public.cs_log " +
            "where text like 'COMISSÁRIO: Krieg%'"))[0].n) === 1);

    /* the same world changing again is not a second pacification */
    await db.exec("update public.cs_occupations set stability = 20 where planet = 'Krieg'");
    check("and a later change to that world seats nobody else",
        Number((await call(db, "select count(*)::int as n from public.cs_commissars"))[0].n) === 1);

    /* and a world integrated into the Authority seats two delegates */
    const before = Number((await call(db, "select count(*)::int as n from public.cg_members"))[0].n);
    await db.exec("insert into public.cg_occupations (planet, stage, stability, progress) " +
        "values ('Kara', 2, 60, 0) on conflict (planet) do update set stage = 2, stability = 60, progress = 0");
    await db.exec("update public.cg_occupations set stage = 3 where planet = 'Kara'");

    const delegates = await call(db, "select m.faction_id, m.active, m.planet, m.seat " +
        "from public.cg_members as m order by m.id");
    check("an integrated world seats two more delegates",
        delegates.length === before + 2, delegates.length + " of " + before);
    check("each of them in a party of the four",
        delegates.every(m => [1, 2, 3, 4].indexOf(Number(m.faction_id)) !== -1), JSON.stringify(delegates));
    check("and they count in the chamber",
        delegates.filter(m => m.active === true).length === before + 2, JSON.stringify(delegates));
    check("with the world they came from on their seat",
        delegates.every(m => m.planet === "Kara"), JSON.stringify(delegates));
    check("and the Congress is told",
        Number((await call(db, "select count(*)::int as n from public.cg_log " +
            "where text like 'CONGRESSO: Kara%'"))[0].n) === 1);

    await db.exec("update public.cg_occupations set stability = 40 where planet = 'Kara'");
    check("and a later change to that world seats nobody else",
        Number((await call(db, "select count(*)::int as n from public.cg_members"))[0].n) === before + 2);

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
    check("and not by anybody else", /Only the Speaker of the Congress/.test(String(notSpeaker)), notSpeaker);


    console.log("\nthe chamber's chair is the Speaker, and the log says so");
    await as(db, AUTH);
    const lines = (await call(db, "select text from public.cg_log order by id")).map(r => r.text);
    check("the chair is written as the Speaker", lines.some(t => /Orador do Congresso/.test(t)), lines.slice(-2).join(" | "));
    check("and never as the President of the Congress", !lines.some(t => /Presidente do Congresso/.test(t)),
        lines.filter(t => /Presidente do Congresso/.test(t)).join(" | "));
    check("the veto belongs to the Speaker", lines.some(t => /^VETO: o Orador do Congresso/.test(t)), lines.slice(-1).join(" | "));

    const resultCol = Number((await call(db, "select count(*)::int as n from information_schema.columns " +
        "where table_schema = 'public' and table_name = 'cg_proposals' and column_name = 'result'"))[0].n);
    if (resultCol === 1) {
        const raw = JSON.stringify((await call(db, "select result from public.cg_proposals where id = " + billId))[0].result);
        check("and a bill it kills records the Speaker", /Orador do Congresso/.test(raw), raw);
    }

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

    /* ---------------------------------------------------------
       8. how the occupation is administered, and the blockade
       --------------------------------------------------------- */

    console.log("\nthe occupation is administered, not just occupied");
    await as(db, AUTH);

    /* two worlds the Authority holds whole, and nothing else in the sky */
    await db.exec("update public.fleets set faction = 'Independents'");
    await db.exec("update public.cities set faction = 'Independents' " +
        "where planet_id in ('Kara','Elya','Volst','Asteron','Veyra','Ultramars')");
    await db.exec("update public.cities set faction = 'Freedom Authority' where planet_id in ('Free Earth','Krieg')");
    await db.exec("insert into public.cg_occupations (planet, stage, stability, progress) values ('Krieg', 1, 80, 0) " +
        "on conflict (planet) do update set stage = 1, stability = 80, progress = 0");
    await db.exec("delete from public.planet_unrest");
    await db.exec("insert into public.planet_unrest (planet, faction, unrest, last_turn_at) " +
        "values ('Krieg','Freedom Authority', 40, now() - interval '5 minutes')");

    check("a world nobody has decided about is under civil rule",
        (await call(db, "select public.planet_policy_of('Krieg') as p"))[0].p === "civil");
    check("and it pays what it always paid",
        Number((await call(db, "select public.planet_policy_income('Freedom Authority','Krieg') as n"))[0].n) === 100);

    const reps = (await call(db, "select public.occupation_set_policy('Krieg','reprisals') as r"))[0].r;
    check("any player of the holding faction may decide how a world is run",
        reps && reps.policy === "reprisals", JSON.stringify(reps));
    check("reprisals pay half again its income",
        Number(reps.paid) === 150 && Number(reps.income) === 100, JSON.stringify(reps));
    check("and its people are the angrier for it", Number(reps.delta) === 2, JSON.stringify(reps));
    check("the world's own book is told",
        Number((await call(db, "select count(*)::int as n from public.cg_log " +
            "where text like 'ADMINISTRAÇÃO: Krieg%'"))[0].n) === 1);

    const amnest = (await call(db, "select public.occupation_set_policy('Krieg','amnesty') as r"))[0].r;
    check("amnesty pays half the income instead", Number(amnest.paid) === 50, JSON.stringify(amnest));
    check("and lets the world settle", Number(amnest.delta) === -2, JSON.stringify(amnest));

    let bad = await expectError(db, "select public.occupation_set_policy('Volst','reprisals')");
    check("a world we hold no city of cannot be administered", /hold no city/.test(String(bad)), bad);

    await db.exec("update public.cities set faction = 'Freedom Authority' where planet_id = 'Elya' and name = 'Elya Ramp'");
    bad = await expectError(db, "select public.occupation_set_policy('Elya','reprisals')");
    check("and a world somebody else still holds has to be taken first", /not held whole/.test(String(bad)), bad);

    bad = await expectError(db, "select public.occupation_set_policy('Krieg','bribes')");
    check("only the three policies exist", /civil rule, reprisals or amnesty/.test(String(bad)), bad);

    console.log("\na world with no garrison slips");
    let gar = (await call(db, "select public.planet_garrison('Freedom Authority','Krieg') as g"))[0].g;
    check("no fleet in orbit is no garrison", Number(gar.fleets) === 0, JSON.stringify(gar));

    await db.exec("insert into public.fleets (player_id, faction, name, status, origin, squads) values " +
        "('" + AUTH + "', 'Freedom Authority', 'Home Watch', 'stationed', 'Krieg', " +
        "'[{\"type\":\"Rifle\",\"amount\":1}]'::jsonb)");
    gar = (await call(db, "select public.planet_garrison('Freedom Authority','Krieg') as g"))[0].g;
    check("a fleet stationed there with troops aboard is one",
        Number(gar.fleets) === 1 && Number(gar.soldiers) === 1000, JSON.stringify(gar));

    /* stability 80 is three points off the climb; a garrison is none */
    async function kriegTurn(policy) {
        if (policy) { await call(db, "select public.occupation_set_policy('Krieg','" + policy + "')"); }
        await db.exec("update public.planet_unrest set unrest = 40, last_turn_at = now() - interval '5 minutes' " +
            "where planet = 'Krieg'");
        const out = (await call(db, "select public.unrest_tick() as r"))[0].r;
        return out.find(x => x.planet === "Krieg");
    }

    /* what is installed, not what was written */
    const tickRow = (await call(db, "select count(*)::int as n, max(pg_get_functiondef(p.oid)) as s " +
        "from pg_proc as p where p.proname = 'unrest_tick'"))[0];
    check("the installed unrest_tick answers to the policy",
        /planet_policy_delta/.test(String(tickRow.s)),
        tickRow.n + " rows :: " + String(tickRow.s).slice(0, 700));

    let tick = await kriegTurn("civil");
    check("a garrisoned world under civil rule climbs one point a turn",
        tick && Number(tick.delta) === 1 && Number(tick.unrest) === 41, JSON.stringify(tick));

    tick = await kriegTurn("reprisals");
    check("reprisals make it climb three", tick && Number(tick.delta) === 3, JSON.stringify(tick));

    tick = await kriegTurn("amnesty");
    check("amnesty lets the world settle",
        tick && Number(tick.delta) === -1 && Number(tick.unrest) === 39, JSON.stringify(tick));

    await db.exec("delete from public.fleets where name = 'Home Watch'");
    tick = await kriegTurn("civil");
    check("a garrison called away is two points a turn worse",
        tick && Number(tick.delta) === 3, JSON.stringify(tick));
    check("and the screen says the world is not held", tick && tick.garrison === false, JSON.stringify(tick));

    console.log("\nthe blockade reaches the capital");

    /* nothing left in the sky from the sections above: an "Independents"
       fleet is still a stranger in the orbit it sits in, and it would
       block the very hop this section is about */
    await db.exec("delete from public.fleets");
    await db.exec("delete from public.planet_policy");

    let net = (await call(db, "select public.supply_network('Freedom Authority') as n"))[0].n;
    check("the net carries both worlds the Authority holds whole",
        Number(net.total) === 200 && Number(net.cut) === 0, JSON.stringify({ total: net.total, cut: net.cut }));
    check("and its capital is not blockaded",
        net.capital_blocked === false && net.capital === "Free Earth",
        JSON.stringify({ capital: net.capital, blocked: net.capital_blocked }));

    await db.exec("insert into public.fleets (player_id, faction, name, status, origin, squads) values " +
        "('" + COMB + "', 'Combine', 'Blockaders', 'stationed', 'Free Earth', " +
        "'[{\"type\":\"Rifle\",\"amount\":1}]'::jsonb)");
    net = (await call(db, "select public.supply_network('Freedom Authority') as n"))[0].n;
    check("an enemy fleet over the capital closes the capital",
        net.capital_blocked === true, JSON.stringify(net.capital_blocked));
    check("and the whole net behind it",
        Number(net.total) === 0 && Number(net.cut) === 2, JSON.stringify({ total: net.total, cut: net.cut }));
    check("while what the worlds could have carried is still reported",
        Number(net.potential) === 200, net.potential);

    const sup = (await call(db, "select public.supply_state() as s"))[0].s;
    check("and the map's own reading says what the blockade costs",
        Number(sup.lost) === 200 && sup.capital_blocked === true, JSON.stringify({ lost: sup.lost }));

    await db.exec("delete from public.fleets where name = 'Blockaders'");
    await call(db, "select public.occupation_set_policy('Krieg','reprisals')");
    net = (await call(db, "select public.supply_network('Freedom Authority') as n"))[0].n;
    const kriegWord = net.worlds.find(w => w.planet === "Krieg");
    check("a world under reprisals carries half again into the net",
        kriegWord && Number(kriegWord.income) === 150 && Number(kriegWord.potential) === 100,
        JSON.stringify(kriegWord));
    check("and the net's total follows the policy", Number(net.total) === 250, net.total);
    check("the screens' own reading lists it",
        (await call(db, "select public.occupation_policy_state() as s"))[0].s.worlds
            .some(w => w.planet === "Krieg" && w.policy === "reprisals"));

    /* a world that is no longer ours keeps no policy, and the reset clears
       whatever is left */
    await db.exec("update public.cities set faction = 'Independents' where planet_id = 'Krieg'");
    await call(db, "select public.unrest_state()");
    check("a world we no longer hold keeps no policy",
        Number((await call(db, "select count(*)::int as n from public.planet_policy where planet = 'Krieg'"))[0].n) === 0);

    await call(db, "select public.occupation_set_policy('Free Earth','reprisals')");
    check("a policy is on the books",
        Number((await call(db, "select count(*)::int as n from public.planet_policy"))[0].n) === 1);
    const cleared = (await call(db, "select public.occupation_policy_reset() as n"))[0].n;
    check("and the host's reset clears it", Number(cleared) === 1 &&
        Number((await call(db, "select count(*)::int as n from public.planet_policy"))[0].n) === 0, cleared);

    await as(db, COMB);
    const notHost = await expectError(db, "select public.occupation_policy_reset()");
    check("and only the host may clear it", /Only the host/.test(String(notHost)), notHost);
    await as(db, AUTH);

    /* ---------------------------------------------------------
       9. the committees, and the ministers
       --------------------------------------------------------- */

    console.log("\nthe committees are chaired by the biggest party");
    await db.exec("delete from public.cg_committees");
    await db.exec("delete from public.cg_ministers");
    await db.exec("update public.cg_factions set seats = 40 where id = 1");
    await db.exec("update public.cg_factions set seats = 30 where id = 2");
    await db.exec("update public.cg_factions set seats = 20 where id = 3");
    await db.exec("update public.cg_factions set seats = 10 where id = 4");

    /* the seat the player holds, and the party the base game names for them */
    await db.exec("alter table public.cg_members add column if not exists player_id uuid");
    await db.exec("alter table public.cg_members add column if not exists party text");
    await db.exec("update public.cg_members set active = false");
    await db.exec("insert into public.cg_members (name, faction_id, region, area, seat, loyalty, active, planet, party, player_id) " +
        "values ('President Hale', 1, 'West', 1, 1, 70, true, 'Free Earth', 'militarists', '" + AUTH + "')");

    let gov = (await call(db, "select public.cg_government() as g"))[0].g;
    check("three committees are seated", gov.committees.length === 3,
        JSON.stringify(gov.committees.map(c => c.kind)));
    check("each chaired by the party with the most seats",
        gov.committees.every(c => Number(c.chair) === 1), JSON.stringify(gov.committees.map(c => c.chair)));
    check("and a player can see they sit in it", gov.committees.every(c => c.mine === true),
        JSON.stringify(gov.committees.map(c => c.mine)));

    await db.exec("insert into public.cg_proposals (title, ptype, status, sponsor_faction_id, vote_at) " +
        "values ('Authorize New Fleet Construction', 'fleet_construction', 'debate', 1, now() + interval '10 minutes')");
    const bill = Number((await call(db, "select id from public.cg_proposals order by id desc limit 1"))[0].id);

    gov = (await call(db, "select public.cg_government() as g"))[0].g;
    check("the committee lists the bill it schedules",
        gov.committees.find(c => c.kind === "fleets").bills.some(b => Number(b.id) === bill));

    const rep = (await call(db, "select public.cg_committee_report(" + bill + ") as r"))[0].r;
    check("the chair reports it straight to the vote", rep && rep.reported === true, JSON.stringify(rep));
    const moved = (await call(db, "select status, vote_at <= now() as due from public.cg_proposals where id = " + bill))[0];
    check("and the vote is due at once", moved.status === "debate" && moved.due === true, JSON.stringify(moved));
    check("the chamber's record hears of it",
        Number((await call(db, "select count(*)::int as n from public.cg_log where text like 'COMISSÃO:%'"))[0].n) === 1);

    const twiceRep = await expectError(db, "select public.cg_committee_report(" + bill + ")");
    check("a committee reports once a term", /already reported this term/.test(String(twiceRep)), twiceRep);

    /* a party that does not chair the committee cannot use it */
    await db.exec("update public.cg_members set faction_id = 2, party = 'environmentalists' where player_id = '" + AUTH + "'");
    const notChair = await expectError(db, "select public.cg_committee_report(" + bill + ")");
    check("and a party that does not chair it cannot", /Only the party that chairs/.test(String(notChair)), notChair);
    await db.exec("update public.cg_members set faction_id = 1, party = 'militarists' where player_id = '" + AUTH + "'");

    console.log("\nthe President names the ministers, and each ministry can act");
    await db.exec("update public.cg_state set president_player = '" + AUTH + "', term_no = 3, popularity = 60 where id = 1");

    const app = (await call(db, "select public.cg_appoint_minister('treasury', '" + AUTH + "') as r"))[0].r;
    check("the President names a minister", app && app.name === "President Hale", JSON.stringify(app));

    await as(db, COMB);
    const notPresident = await expectError(db, "select public.cg_appoint_minister('war', '" + AUTH + "')");
    check("and only the President may", /Only the President/.test(String(notPresident)), notPresident);
    await as(db, AUTH);

    const wrongSide = await expectError(db, "select public.cg_appoint_minister('war', '" + COMB + "')");
    check("nor may a minister be taken from the other side", /does not serve/.test(String(wrongSide)), wrongSide);

    const levyBefore = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);
    const levy = (await call(db, "select public.cg_minister_action('treasury') as r"))[0].r;
    const levyAfter = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);
    check("the treasury takes an extraordinary levy",
        Number(levy.credits) >= 300 && levyAfter === levyBefore + Number(levy.credits), JSON.stringify(levy));
    check("and the people are told who took it",
        Number((await call(db, "select popularity from public.cg_state where id = 1"))[0].popularity) === 57);

    await db.exec("delete from public.cg_authorizations where kind = 'war'");
    await call(db, "select public.cg_appoint_minister('war', '" + AUTH + "')");
    await call(db, "select public.cg_appoint_minister('interior', '" + AUTH + "')");

    const far = await expectError(db, "select public.cg_minister_action('interior', 'Volst')");
    check("a world we do not administer gets no relief", /not under the Congress/.test(String(far)), far);

    const war = (await call(db, "select public.cg_minister_action('war', 'Veyra') as r"))[0].r;
    check("the war ministry authorises a campaign with no bill", war && war.authorised === true, JSON.stringify(war));
    check("on the book the fleets already read",
        Number((await call(db, "select count(*)::int as n from public.cg_authorizations " +
            "where kind = 'war' and planet = 'Veyra' and not used"))[0].n) === 1);

    const oncePerTerm = await expectError(db, "select public.cg_minister_action('war', 'Asteron')");
    check("a ministry acts once a term", /already acted this term/.test(String(oncePerTerm)), oncePerTerm);

    await db.exec("insert into public.cg_occupations (planet, stage, stability, progress) values ('Krieg', 1, 40, 0) " +
        "on conflict (planet) do update set stage = 1, stability = 40, progress = 0");
    await call(db, "select public.cg_appoint_minister('interior', '" + AUTH + "')");
    const relief = (await call(db, "select public.cg_minister_action('interior', 'Krieg') as r"))[0].r;
    check("the interior sends relief without a proposal",
        relief && Number(relief.stability) === 50, JSON.stringify(relief));

    const fired = (await call(db, "select public.cg_dismiss_minister('interior') as r"))[0].r;
    check("the President may dismiss one", fired && fired.dismissed === "President Hale", JSON.stringify(fired));

    console.log("\nand the Soviet has the same two");
    await as(db, COMB);
    await db.exec("update public.cs_currents set seats = 42 where id = 1");
    await db.exec("delete from public.cs_membership");
    await db.exec("insert into public.cs_membership (player_id, current_id) values ('" + COMB + "', 1)");
    await db.exec("update public.cs_state set secretary_player = '" + COMB + "', term_no = 2, confidence = 60 where id = 1");

    const cgov = (await call(db, "select public.cs_government() as g"))[0].g;
    check("three committees in the plenum too", cgov.committees.length === 3, cgov.committees.length);
    check("chaired by the biggest current",
        cgov.committees.every(c => Number(c.chair) === 1 && c.mine === true),
        JSON.stringify(cgov.committees.map(c => [c.chair, c.mine])));

    await db.exec("insert into public.cs_directives (dtype, title, status, sponsor_current, vote_at) " +
        "values ('production_quota', 'Plano Quinquenal', 'debate', 1, now() + interval '10 minutes')");
    const directive = Number((await call(db, "select id from public.cs_directives order by id desc limit 1"))[0].id);
    const crep = (await call(db, "select public.cs_committee_report(" + directive + ") as r"))[0].r;
    check("the current in the chair reports a directive to the vote",
        crep && crep.reported === true, JSON.stringify(crep));

    const capp = (await call(db, "select public.cs_appoint_minister('war', '" + COMB + "') as r"))[0].r;
    check("the High Commissar names a commissar of a ministry",
        capp && capp.name === "Comrade Volkov", JSON.stringify(capp));

    await db.exec("delete from public.cs_authorizations where kind = 'war'");
    const cwar = (await call(db, "select public.cs_minister_action('war', 'Asteron') as r"))[0].r;
    check("and its war ministry authorises a campaign",
        cwar && cwar.authorised === true &&
        Number((await call(db, "select count(*)::int as n from public.cs_authorizations " +
            "where kind = 'war' and planet = 'Asteron'"))[0].n) === 1, JSON.stringify(cwar));

    await as(db, AUTH);
    const wiped = (await call(db, "select public.committees_and_ministers_reset() as n"))[0].n;
    check("the host's reset clears both chambers' committees and ministries",
        Number((await call(db, "select count(*)::int as n from public.cg_ministers"))[0].n) === 0 &&
        Number((await call(db, "select count(*)::int as n from public.cs_ministers"))[0].n) === 0 &&
        Number((await call(db, "select count(*)::int as n from public.cg_committees"))[0].n) === 0, wiped);
}
