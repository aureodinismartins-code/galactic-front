/* Run sql/2026-11-35_the_tax_and_the_tinderbox.sql against a real PostgreSQL
   (PGlite, the WASM build) with stand-ins for the tables it leans on, then:

     - pass a relief bill and watch the treasury pay for it, once;
     - file a Diplomatic Mission and a Fraternal Pact: neither survives;
     - name a slaving fleet for the breaker's yard: the bill is dropped;
     - lower the tax in both halls, and refuse to go below the floor;
     - raise the tax and watch the unrest of every held world climb with it;
     - sweep a bar off an independent world and off a capital;
     - arm rebels in a world that is not turning: refused;
     - arm them in one that is: unrest planted, no relations moved;
     - stir a coup: more unrest, and the embassy door shuts;
     - plant trouble, take the world, and find the bar already part-way up;
     - reset the game and find no tinder left.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/tax-and-tinder-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PATCH = "sql/2026-11-35_the_tax_and_the_tinderbox.sql";

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

create table public.faction_treasury (faction text primary key, credits numeric default 0);
insert into public.faction_treasury (faction, credits) values
    ('Freedom Authority', 10000), ('Combine', 10000);

create table public.cg_state (id int primary key, tax_level int default 0, popularity numeric default 50,
    last_tax_at timestamptz, president_player uuid, term_no int default 0, term_end timestamptz);
insert into public.cg_state (id) values (1);

create table public.cs_state (id int primary key, quota int default 1, confidence numeric default 55,
    last_quota_at timestamptz, relations jsonb default '{}'::jsonb, secretary_player uuid,
    secretary_name text, secretary_current int, term_no int default 0, term_end timestamptz,
    veto_used boolean default false, online_at timestamptz, last_npc_at timestamptz,
    last_debate_at timestamptz, last_election_at timestamptz);
insert into public.cs_state (id) values (1);

create table public.cg_proposals (id serial primary key, ptype text, status text,
    planet_id text, fleet_id uuid, title text, sponsor text);
create table public.cs_directives (id serial primary key, dtype text, status text, fleet_id text, title text);

create table public.fleets (id uuid primary key default gen_random_uuid(), faction text,
    name text, transport_fleet boolean default false);
insert into public.fleets (faction, name, transport_fleet) values
    ('Combine', 'Warship', false), ('Combine', 'Coffin Ships', true),
    ('Freedom Authority', 'Hammer', false);

create table public.cg_log (id serial primary key, text text);
create table public.cs_log (id serial primary key, text text);
create or replace function public.cg_log(p_text text) returns void
language sql security definer set search_path to '' as $$ insert into public.cg_log (text) values (p_text) $$;
create or replace function public.cs_log(p_text text) returns void
language sql security definer set search_path to '' as $$ insert into public.cs_log (text) values (p_text) $$;

create table public.planets (id text primary key, name text unique);
insert into public.planets values ('Ultramars', 'Ultramars'), ('Free Earth', 'Free Earth'),
    ('Krieg', 'Krieg'), ('Veyra', 'Veyra');

create table public.cities (id serial primary key, planet_id text, faction text);
insert into public.cities (planet_id, faction) values
    ('Ultramars', 'Combine'), ('Ultramars', 'Combine'),
    ('Free Earth', 'Freedom Authority'), ('Free Earth', 'Freedom Authority'),
    ('Krieg', 'Combine'), ('Krieg', 'Combine'),
    ('Veyra', 'Independents'), ('Veyra', 'Independents');

create table public.planet_diplomacy (planet text not null, faction text not null,
    relation int not null default 0, envoys int not null default 0, last_envoy_at timestamptz,
    locked_until timestamptz, last_armed_at timestamptz, last_coup_at timestamptz,
    annexed_at timestamptz, primary key (planet, faction));

create table public.planet_unrest (planet text primary key, faction text, unrest numeric default 25,
    revolts int default 0, last_turn_at timestamptz default now());
create table public.planet_policy (planet text primary key, policy text);

/* ---- the helpers 11-06, 11-07 and 11-13 give the clock ---- */

create or replace function public.game_frozen() returns boolean
language sql stable as $$ select false $$;
create or replace function public.income_mode() returns text
language sql stable as $$ select 'open' $$;
create or replace function public.unrest_turn_seconds() returns integer
language sql immutable as $$ select 300 $$;
create or replace function public.unrest_revolt_at() returns numeric
language sql immutable as $$ select 100 $$;
create or replace function public.unrest_seed() returns void
language plpgsql as $$ begin end $$;
create or replace function public.unrest_sweep_policies() returns void
language plpgsql as $$ begin end $$;
create or replace function public.occupation_stability(p_planet text) returns numeric
language sql stable as $$ select 50 $$;
create or replace function public.planet_policy_of(p_planet text) returns text
language sql stable as $$ select 'none' $$;
create or replace function public.planet_policy_delta(p_planet text) returns numeric
language sql stable as $$ select 0 $$;
create or replace function public.planet_garrison(p_faction text, p_planet text) returns boolean
language sql stable as $$ select true $$;
create or replace function public.planet_garrison_missing(p_faction text, p_planet text) returns boolean
language sql stable as $$ select false $$;
create or replace function public.occupation_lower_stability(p_planet text, p_by numeric) returns void
language plpgsql as $$ begin end $$;
create or replace function public.is_capital_world(p_planet text) returns boolean
language sql immutable as $$ select p_planet in ('Ultramars', 'Free Earth') $$;
create or replace function public.planet_home_faction(p_planet text) returns text
language sql stable as $$ select null $$;

create or replace function public.planet_unrest_holder(p_planet text) returns text
language sql stable as $$
    select c.faction from public.cities as c
    where c.planet_id = p_planet and c.faction in ('Freedom Authority', 'Combine')
    group by c.faction order by count(*) desc limit 1
$$;

/* ---- the embassy rules 11-03 gives the tab ---- */

create or replace function public.envoy_price() returns integer language sql immutable as $$ select 500 $$;
create or replace function public.envoy_wait() returns integer language sql immutable as $$ select 300 $$;
create or replace function public.rebel_price() returns integer language sql immutable as $$ select 800 $$;
create or replace function public.rebel_wait() returns integer language sql immutable as $$ select 600 $$;
create or replace function public.coup_price() returns integer language sql immutable as $$ select 1500 $$;
create or replace function public.coup_wait() returns integer language sql immutable as $$ select 1200 $$;
create or replace function public.coup_lock() returns integer language sql immutable as $$ select 1800 $$;
create or replace function public.diplo_level(p_relation int) returns text language sql immutable
as $$ select case when p_relation >= 100 then 'integrated' when p_relation >= 75 then 'satellite'
                  when p_relation >= 50 then 'allied' when p_relation >= 25 then 'friendly'
                  else 'neutral' end $$;
create or replace function public.diplo_tint(p_relation int) returns numeric language sql immutable
as $$ select round(least(1, greatest(0, p_relation) / 100.0), 2) $$;
create or replace function public.diplo_next(p_relation int) returns int language sql immutable
as $$ select case when p_relation >= 100 then 100 when p_relation >= 75 then 100
                  when p_relation >= 50 then 75 when p_relation >= 25 then 50 else 25 end $$;
create or replace function public.relations_reading() returns jsonb language sql stable
as $$ select '{}'::jsonb $$;
`;

(async function main() {

    try {

        const db = new PGlite();
        await db.exec(SCHEMA);
        await db.exec(fs.readFileSync(path.join(ROOT, PATCH), "utf8"));
        await db.exec(fs.readFileSync(path.join(ROOT, "sql/2026-11-36_the_bar_says_what_feeds_it.sql"), "utf8"));

        await as(db, HOST);

        /* ---------- the relief is paid ---------- */

        console.log("\n== a relief bill that passes is paid for");

        const before = Number((await one(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits);

        await db.exec("insert into public.cg_proposals (ptype, status, title) values ('resource_allocation', 'passed', 'Relief')");

        const afterPass = Number((await one(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits);

        ok("the treasury pays 400", before - afterPass === 400, before + " -> " + afterPass);
        ok("and the books say so",
            (await one(db, "select count(*)::int as n from public.cg_log where text like 'RELIEF%'")).n === 1);

        await db.exec("insert into public.cg_proposals (ptype, status, title) values ('resource_allocation', 'debate', 'Relief 2')");
        await db.exec("update public.cg_proposals set status = 'passed' where title = 'Relief 2'");

        const afterSecond = Number((await one(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits);

        ok("a bill that passes later is paid for then", before - afterSecond === 800, before + " -> " + afterSecond);

        await db.exec("update public.cg_proposals set status = 'passed' where title = 'Relief 2'");

        ok("and it is never paid for twice",
            Number((await one(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits) === afterSecond);

        const beforeFail = Number((await one(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits);

        await db.exec("insert into public.cg_proposals (ptype, status, title) values ('resource_allocation', 'rejected', 'Relief 3')");

        ok("a bill that fails costs nothing",
            Number((await one(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits) === beforeFail);

        /* ---------- the wartime bills are dropped ---------- */

        console.log("\n== no envoys between two sides at war");

        const bills = Number((await one(db, "select count(*)::int as n from public.cg_proposals")).n);

        await db.exec("insert into public.cg_proposals (ptype, status, title) values ('diplomacy', 'introduction', 'Diplomatic Mission to the Combine')");
        await db.exec("insert into public.cs_directives (dtype, status, title) values ('diplomacy', 'introduction', 'Fraternal Pact')");

        ok("a Diplomatic Mission is dropped", Number((await one(db, "select count(*)::int as n from public.cg_proposals")).n) === bills);
        ok("a Fraternal Pact is dropped", Number((await one(db, "select count(*)::int as n from public.cs_directives")).n) === 0);

        /* ---------- a slaving fleet is not dismantled ---------- */

        console.log("\n== a slaving fleet is not a warship");

        const coffin = (await one(db, "select id from public.fleets where name = 'Coffin Ships'")).id;
        const warship = (await one(db, "select id from public.fleets where name = 'Warship'")).id;

        await db.exec("delete from public.cg_proposals where ptype = 'fleet_revocation'");
        await db.query("insert into public.cg_proposals (ptype, status, fleet_id) values ('fleet_revocation', 'introduction', $1)", [coffin]);

        ok("a bill to dismantle a transport fleet is dropped",
            Number((await one(db, "select count(*)::int as n from public.cg_proposals where ptype = 'fleet_revocation'")).n) === 0);

        await db.query("insert into public.cg_proposals (ptype, status, fleet_id) values ('fleet_revocation', 'introduction', $1)", [warship]);

        ok("a bill to dismantle a warship stands",
            Number((await one(db, "select count(*)::int as n from public.cg_proposals where ptype = 'fleet_revocation'")).n) === 1);

        /* ---------- the tax comes down ---------- */

        console.log("\n== the tax comes down");

        await db.exec("update public.cg_state set tax_level = 2, popularity = 50 where id = 1");

        const cut = await rpc(db, "select public.cg_tax_cut() as r");

        ok("the tax falls a level", cut && Number(cut.tax_level) === 1, cut);
        ok("and the people are grateful", cut && Number(cut.popularity) === 55, cut && cut.popularity);

        await rpc(db, "select public.cg_tax_cut() as r");

        ok("it can come all the way down", Number((await one(db, "select tax_level from public.cg_state where id = 1")).tax_level) === 0);

        const errFloor = await expectError(db, "select public.cg_tax_cut()");

        ok("and no further", /already at nothing/.test(String(errFloor)), errFloor);

        await db.exec("update public.cs_state set quota = 2, confidence = 55 where id = 1");
        await as(db, COMB);

        const quota = await rpc(db, "select public.cs_quota_cut() as r");

        ok("the plan falls a level too", quota && Number(quota.quota) === 1, quota);
        ok("the plenum is pleased", quota && Number(quota.confidence) === 60, quota && quota.confidence);

        const errPlan = await expectError(db, "select public.cs_quota_cut()");

        ok("and the plan has a floor", /already at its lowest/.test(String(errPlan)), errPlan);

        /* ---------- the tax feeds the unrest ---------- */

        console.log("\n== the top tax level is felt on every held world");

        await db.exec("delete from public.planet_unrest");
        await db.exec("insert into public.planet_unrest (planet, faction, unrest, last_turn_at) " +
                      "values ('Krieg', 'Combine', 40, now() - interval '10 minutes')");
        await db.exec("update public.cs_state set quota = 2 where id = 1");

        const taxed = await rpc(db, "select public.unrest_tick() as r");

        const krieg = (taxed || []).find(function (x) { return x.planet === "Krieg"; });

        ok("the world is read by the clock", !!krieg, taxed);
        ok("the top level adds two points a turn", krieg && Number(krieg.delta) === 4, krieg && krieg.delta);
        ok("and the tax itself is reported", krieg && Number(krieg.tax) === 2, krieg && krieg.tax);

        /* the bar now says which part is which */
        const fed = (await rpc(db, "select public.unrest_state() as r") || {}).worlds || [];
        const fedKrieg = fed.find(function (w) { return w.planet === "Krieg"; }) || {};
        const feed = function (k) {
            const f = (fedKrieg.feeds || []).find(function (x) { return x.key === k; });
            return f ? Number(f.value) : null;
        };

        ok("the bar hands back the parts that feed it",
            ["occupation", "relief", "policy", "fleet", "tax", "planted"].every(function (k) { return feed(k) !== null; }),
            fedKrieg.feeds);
        ok("the occupation alone is worth four", feed("occupation") === 4, feed("occupation"));
        ok("the relief holds it down", feed("relief") === -2, feed("relief"));
        ok("the tax is the part that grew at the top level", feed("tax") === 2, feed("tax"));
        ok("nothing was planted in this world", feed("planted") === 0, feed("planted"));
        ok("and the parts add up to the delta the world runs at",
            feed("occupation") + feed("relief") + feed("policy") + feed("fleet") + feed("tax") === Number(fedKrieg.delta),
            { delta: fedKrieg.delta, feeds: fedKrieg.feeds });

        await db.exec("update public.cs_state set quota = 1 where id = 1");
        await db.exec("update public.planet_unrest set unrest = 40, last_turn_at = now() - interval '10 minutes' where planet = 'Krieg'");

        const untaxed = await rpc(db, "select public.unrest_tick() as r");
        const calm = (untaxed || []).find(function (x) { return x.planet === "Krieg"; });

        ok("the ordinary level adds nothing", calm && Number(calm.delta) === 2, calm && calm.delta);

        console.log("\n== no bar on an independent world, none on a capital");

        await db.exec("delete from public.planet_unrest");
        await db.exec("insert into public.planet_unrest (planet, faction, unrest, last_turn_at) values " +
                      "('Veyra', 'Combine', 40, now()), ('Ultramars', 'Combine', 40, now()), " +
                      "('Krieg', 'Combine', 40, now() - interval '10 minutes')");

        await rpc(db, "select public.unrest_tick() as r");

        ok("the independent world carries no bar",
            Number((await one(db, "select count(*)::int as n from public.planet_unrest where planet = 'Veyra'")).n) === 0);
        ok("the capital carries no bar",
            Number((await one(db, "select count(*)::int as n from public.planet_unrest where planet = 'Ultramars'")).n) === 0);
        ok("the occupied world keeps its own",
            Number((await one(db, "select count(*)::int as n from public.planet_unrest where planet = 'Krieg'")).n) === 1);

        /* ---------- sabotage ---------- */

        console.log("\n== sabotage answers to a world that is turning");

        await db.exec("delete from public.planet_diplomacy");
        await db.exec("delete from public.planet_tinder");
        await db.exec("insert into public.planet_diplomacy (planet, faction, relation) values " +
                      "('Veyra', 'Combine', 10), ('Veyra', 'Freedom Authority', 10)");
        await db.exec("update public.faction_treasury set credits = 10000 where faction = 'Combine'");
        await as(db, COMB);

        const errNotTurning = await expectError(db, "select public.arm_rebels('Veyra') as r");

        ok("a world nobody is winning will not take rifles", /has not begun to turn/.test(String(errNotTurning)), errNotTurning);

        await db.exec("insert into public.planet_diplomacy (planet, faction, relation) values ('Veyra', 'Freedom Authority', 40) " +
                      "on conflict (planet, faction) do update set relation = 40");

        const armed = await rpc(db, "select public.arm_rebels('Veyra') as r");

        ok("a world turning to the other side will", armed && Number(armed.tinder) === 15, armed);
        ok("the rifles cost 800", armed && Number(armed.cost) === 800 && Number(armed.credits) === 9200, armed);
        ok("and the relations bar is not moved",
            Number((await one(db, "select relation from public.planet_diplomacy where planet = 'Veyra' and faction = 'Combine'")).relation) === 10,
            "the reading stayed put");

        const errAgain = await expectError(db, "select public.arm_rebels('Veyra') as r");

        ok("it cannot be tried again straight away", /already been tried/.test(String(errAgain)), errAgain);

        ok("nothing is left as a pact", Number((await one(db, "select annexed_at from public.planet_diplomacy where planet = 'Veyra' and faction = 'Combine'")).annexed_at) === 0 ||
            (await one(db, "select annexed_at from public.planet_diplomacy where planet = 'Veyra' and faction = 'Combine'")).annexed_at === null);

        console.log("\n== a coup shuts the door and lights a bigger fire");

        const coup = await rpc(db, "select public.overthrow_government('Veyra') as r");

        ok("the coup plants more unrest", coup && Number(coup.tinder) === 50, coup);
        ok("and it costs 1,500", coup && Number(coup.cost) === 1500, coup);
        ok("the embassy doors are shut",
            Number((await one(db, "select count(*)::int as n from public.planet_diplomacy where planet = 'Veyra' and locked_until > now()")).n) === 2);

        /* ---------- the tinder lands on the bar ---------- */

        console.log("\n== the trouble is waiting when the world is taken");

        await db.exec("delete from public.planet_unrest where planet = 'Krieg'");
        await db.exec("insert into public.planet_unrest (planet, faction, unrest) values ('Krieg', 'Combine', 25)");
        await db.exec("insert into public.planet_tinder (planet, unrest) values ('Krieg', 20) on conflict (planet) do update set unrest = 20, applied_at = null");

        await db.exec("select public.tinder_apply()");

        ok("the bar opens part way up",
            Number((await one(db, "select unrest from public.planet_unrest where planet = 'Krieg'")).unrest) === 45);
        ok("and the trouble is spent",
            (await one(db, "select applied_at from public.planet_tinder where planet = 'Krieg'")).applied_at !== null);

        const fedAfter = ((await rpc(db, "select public.unrest_state() as r") || {}).worlds || [])
            .find(function (w) { return w.planet === "Krieg"; }) || {};
        const plantedFeed = (fedAfter.feeds || []).find(function (x) { return x.key === "planted"; });

        ok("and the bar says the trouble was planted in it",
            plantedFeed && Number(plantedFeed.value) === 20, fedAfter.feeds);

        /* ---------- the reset ---------- */

        console.log("\n== the host's reset");

        await as(db, HOST);
        await rpc(db, "select public.game_reset_extras() as r");

        ok("the tinder is cleared", Number((await one(db, "select count(*)::int as n from public.planet_tinder")).n) === 0);
        ok("and the tax is back to the start", Number((await one(db, "select tax_level from public.cg_state where id = 1")).tax_level) === 0);

        await as(db, COMB);
        const errReset = await expectError(db, "select public.game_reset_extras()");

        ok("only the host may reset", /Only the host/.test(String(errReset)), errReset);

        await db.close();

    } catch (e) {

        fail++;
        console.log("\nCRASH: " + String((e && e.stack) || e).split("\n").slice(0, 8).join("\n"));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

})();
