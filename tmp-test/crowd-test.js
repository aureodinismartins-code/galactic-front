/* Run sql/2026-11-37_the_crowd_has_to_be_faced.sql against a real PostgreSQL
   (PGlite) with stand-ins for the tables it leans on, then:

     - pay to calm a world: 600 credits, unrest -20, once per five minutes;
     - refuse when the treasury cannot pay, when the world is not ours, and
       when it is a capital;
     - fight the rebels only once they are up (unrest 55);
     - beat them down: unrest -25 and one soldier in twenty dead;
     - refuse to fight twice in a row, and refuse with no fleet in orbit;
     - read back what the halls are told: the prices and both clocks.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/crowd-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PATCH = "sql/2026-11-37_the_crowd_has_to_be_faced.sql";

const HOST = "11111111-1111-4111-8111-111111111111";   /* the host, Freedom Authority */
const COMB = "22222222-2222-4222-8222-222222222222";   /* a Combine commander */

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

async function as(db, who) {
    await db.exec("select set_config('test.me', '" + who + "', false)");
}

async function rpc(db, sql) {
    const r = await db.query(sql);
    return r.rows[0] ? r.rows[0].r : null;
}

async function one(db, sql, args) {
    const r = await db.query(sql, args);
    return r.rows[0] || null;
}

async function expectError(db, sql) {
    try { await db.query(sql); return null; }
    catch (e) { return String(e.message || e); }
}

const SCHEMA = `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.me', true), '')::uuid $$;

create table public.players (id uuid primary key, faction text);
insert into public.players values
    ('${HOST}', 'Freedom Authority'),
    ('${COMB}', 'Combine');

create table public.game_control (id int primary key, host_player uuid, started boolean default true);
insert into public.game_control (id, host_player) values (1, '${HOST}');

create or replace function public.game_frozen() returns boolean
language sql stable as $$ select false $$;

create table public.faction_treasury (faction text primary key, credits numeric default 0);
insert into public.faction_treasury (faction, credits) values
    ('Freedom Authority', 10000), ('Combine', 10000);

create table public.planets (id text primary key, name text unique);
insert into public.planets values ('Ultramars', 'Ultramars'), ('Krieg', 'Krieg'),
    ('Veyra', 'Veyra');

create table public.cities (id serial primary key, planet_id text, faction text);
insert into public.cities (planet_id, faction) values
    ('Ultramars', 'Freedom Authority'), ('Ultramars', 'Freedom Authority'),
    ('Krieg', 'Combine'), ('Krieg', 'Combine'),
    ('Veyra', 'Independents'), ('Veyra', 'Independents');

create table public.planet_unrest (planet text primary key, faction text,
    unrest numeric default 25, revolts int default 0, last_turn_at timestamptz default now());

create table public.planet_tinder (planet text primary key, unrest numeric not null default 0,
    applied_at timestamptz, created_at timestamptz not null default now());

create table public.fleets (id uuid primary key default gen_random_uuid(), faction text,
    origin text, status text default 'stationed', name text, squads jsonb default '[]'::jsonb);

create table public.cg_log (id serial primary key, text text);
create table public.cs_log (id serial primary key, text text);
create or replace function public.cg_log(p_text text) returns void
language sql security definer set search_path to '' as $$ insert into public.cg_log (text) values (p_text) $$;
create or replace function public.cs_log(p_text text) returns void
language sql security definer set search_path to '' as $$ insert into public.cs_log (text) values (p_text) $$;

create or replace function public.fleet_squad_size(p_type text) returns numeric
language sql immutable as $$ select 1000 $$;

create or replace function public.planet_unrest_holder(p_planet text) returns text
language sql stable as $$
    select c.faction from public.cities as c
    where c.planet_id = p_planet and c.faction in ('Freedom Authority', 'Combine')
    group by c.faction order by count(*) desc limit 1
$$;

create or replace function public.is_capital_world(p_planet text) returns boolean
language sql immutable as $$ select p_planet in ('Ultramars', 'Free Earth') $$;

create or replace function public.planet_garrison(p_faction text, p_planet text) returns jsonb
language sql stable as $$
    select jsonb_build_object(
        'fleets', count(*),
        'soldiers', coalesce(sum((
            select coalesce(sum(coalesce(nullif(e ->> 'soldiers', '')::numeric,
                                        public.fleet_squad_size(e ->> 'type')
                                            * greatest(0, coalesce((e ->> 'amount')::numeric, 0)))), 0)
            from jsonb_array_elements(coalesce(f.squads, '[]'::jsonb)) as e)), 0))
    from public.fleets as f
    where f.origin = p_planet and f.faction = p_faction and f.status::text = 'stationed'
$$;

create or replace function public.planet_garrison_missing(p_faction text, p_planet text) returns boolean
language sql stable as $$
    select coalesce((public.planet_garrison(p_faction, p_planet) ->> 'fleets')::integer, 0) <= 0
$$;

create or replace function public.occupation_stability(p_planet text) returns numeric
language sql stable as $$ select 50 $$;
create or replace function public.planet_policy_of(p_planet text) returns text
language sql stable as $$ select 'none' $$;
create or replace function public.planet_policy_delta(p_planet text) returns numeric
language sql stable as $$ select 0 $$;
create or replace function public.faction_tax_level(p_faction text) returns integer
language sql stable as $$ select 1 $$;
create or replace function public.unrest_seed() returns void language plpgsql as $$ begin end $$;
create or replace function public.unrest_sweep_policies() returns void language plpgsql as $$ begin end $$;
create or replace function public.unrest_turn_seconds() returns integer language sql immutable as $$ select 300 $$;
create or replace function public.unrest_revolt_at() returns numeric language sql immutable as $$ select 100 $$;
`;

(async function main() {

    try {

        const db = new PGlite();
        await db.exec(SCHEMA);
        await db.exec(fs.readFileSync(path.join(ROOT, PATCH), "utf8"));

        await db.exec("insert into public.planet_unrest (planet, faction, unrest) values ('Krieg', 'Combine', 62)");
        await db.exec("insert into public.fleets (faction, origin, status, name, squads) values " +
            "('Combine', 'Krieg', 'stationed', 'Second Fleet', '[{\"type\":\"Infantry\",\"amount\":2,\"soldiers\":2000,\"soldiersPerDivision\":1000}]'::jsonb)");

        await as(db, COMB);

        /* ---------- what the halls are told ---------- */

        console.log("\n== what the halls are told");

        const st = await rpc(db, "select public.unrest_state() as r");
        const krieg = ((st || {}).worlds || []).find(function (w) { return w.planet === "Krieg"; }) || {};

        ok("the price of calm is 600", Number((st || {}).calm_price) === 600, st && st.calm_price);
        ok("the rebels rise at 55", Number((st || {}).rebel_at) === 55, st && st.rebel_at);
        ok("the world is rioting at 62", krieg.mood === "RIOTING", krieg.mood);
        ok("the rebels are up there", krieg.fight && krieg.fight.rebels === true, krieg.fight);
        ok("and a fleet of ours is in orbit", krieg.fight && krieg.fight.garrison === true, krieg.fight);
        ok("neither answer is on a cooldown yet",
            krieg.calm && Number(krieg.calm.ready_in) === 0 && Number(krieg.fight.ready_in) === 0,
            { calm: krieg.calm, fight: krieg.fight });

        /* ---------- the money ---------- */

        console.log("\n== paying them off");

        const calm = await rpc(db, "select public.unrest_calm('Krieg') as r");

        ok("the bar comes down twenty", calm && Number(calm.unrest) === 42, calm);
        ok("the treasury pays 600", calm && Number(calm.cost) === 600 && Number(calm.credits) === 9400, calm);
        ok("and the books say who was paid",
            Number((await one(db, "select count(*)::int as n from public.cs_log where text like 'CALMA%'")).n) === 1);

        const afterCalm = ((await rpc(db, "select public.unrest_state() as r") || {}).worlds || [])
            .find(function (w) { return w.planet === "Krieg"; }) || {};

        ok("the hall is told the ringleaders are on a cooldown",
            Number(afterCalm.calm && afterCalm.calm.ready_in) > 0 &&
            Number(afterCalm.calm.ready_in) <= 300, afterCalm.calm);

        const errAgain = await expectError(db, "select public.unrest_calm('Krieg')");

        ok("and they will not take money twice in a row", /will not take money again yet/.test(String(errAgain)), errAgain);

        /* ---------- the troops ---------- */

        console.log("\n== fighting the rebels");

        const errEarly = await expectError(db, "select public.unrest_fight('Krieg')");

        ok("no rebels have risen at 42", /No rebels have risen/.test(String(errEarly)), errEarly);

        await db.exec("update public.planet_unrest set unrest = 62 where planet = 'Krieg'");

        const fight = await rpc(db, "select public.unrest_fight('Krieg') as r");

        ok("the rebels are beaten down: the bar falls twenty-five",
            fight && Number(fight.unrest) === 37 && Number(fight.delta) === -25, fight);
        ok("one soldier in twenty is dead", fight && Number(fight.lost) === 100, fight);
        ok("and the garrison is smaller for it", fight && Number(fight.troops) === 1900, fight);

        const squads = (await one(db, "select squads from public.fleets where name = 'Second Fleet'")).squads;
        const soldiers = squads.reduce(function (a, e) { return a + Number(e.soldiers || 0); }, 0);

        ok("the fleet's squads carry the losses", soldiers === 1900, squads);
        ok("and the fight is free", fight && Number(fight.cost) === 0, fight);
        ok("the log names the dead",
            Number((await one(db, "select count(*)::int as n from public.cs_log where text like 'ORDEM%'")).n) === 1);

        /* the bar is below 55 again, so the truth is that the rebels are gone;
           to hear the cooldown the world has to still be rioting */
        await db.exec("update public.planet_unrest set unrest = 65 where planet = 'Krieg'");

        const errTwice = await expectError(db, "select public.unrest_fight('Krieg')");

        ok("the troops need time to regroup", /regrouping/.test(String(errTwice)), errTwice);

        await db.exec("update public.planet_unrest set last_fight_at = now() - interval '10 minutes' where planet = 'Krieg'");
        await db.exec("update public.planet_unrest set unrest = 70 where planet = 'Krieg'");
        await db.exec("delete from public.fleets");

        const errNoTroops = await expectError(db, "select public.unrest_fight('Krieg')");

        ok("with no fleet in orbit there is nobody to send", /No troops of ours stand in orbit/.test(String(errNoTroops)), errNoTroops);

        /* ---------- who may answer ---------- */

        console.log("\n== who may answer");

        await as(db, HOST);

        const errNotOurs = await expectError(db, "select public.unrest_calm('Krieg')");

        ok("a world somebody else holds is not ours to police", /not ours to police/.test(String(errNotOurs)), errNotOurs);

        await db.exec("insert into public.planet_unrest (planet, faction, unrest) values ('Ultramars', 'Freedom Authority', 40)");

        const errCapital = await expectError(db, "select public.unrest_calm('Ultramars')");

        ok("a capital settles its own affairs", /is a capital/.test(String(errCapital)), errCapital);

        const errNoBar = await expectError(db, "select public.unrest_fight('Veyra')");

        ok("an independent world has no bar to answer", /is not a world we hold/.test(String(errNoBar)), errNoBar);

        await as(db, COMB);
        await db.exec("update public.faction_treasury set credits = 100 where faction = 'Combine'");
        await db.exec("update public.planet_unrest set last_calm_at = null, unrest = 62 where planet = 'Krieg'");

        const errBroke = await expectError(db, "select public.unrest_calm('Krieg')");

        ok("an empty treasury cannot buy calm", /cannot pay 600 credits/.test(String(errBroke)), errBroke);

        await db.close();

    } catch (e) {

        fail++;
        console.log("\nCRASH: " + String((e && e.stack) || e).split("\n").slice(0, 8).join("\n"));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

})();
