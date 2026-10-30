/* Run sql/2026-11-38_the_rebels_have_an_army.sql against a real PostgreSQL
   (PGlite) with stand-ins for the tables it leans on, then:

     - a world at 60 puts a band of 1,500 men in the streets;
     - a world at 59 does not;
     - nothing rises while nobody is playing;
     - ten minutes later another band joins them, and never more than four;
     - a world under arms cannot be calmed for money;
     - the troops break a band: the band loses men, the garrison loses blood;
     - when the last band breaks the bar falls 15;
     - a band never outlives its bar, so a reset takes it with it.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/rebel-army-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PATCH = "sql/2026-11-38_the_rebels_have_an_army.sql";
const PATCH_WOODS = "sql/2026-11-40_the_woods_decide.sql";

const HOST = "11111111-1111-4111-8111-111111111111";
const COMB = "22222222-2222-4222-8222-222222222222";

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
create or replace function public.income_mode() returns text
language sql stable as $$ select 'open' $$;

create table public.player_presence (player_id uuid primary key, last_seen timestamptz not null default now());
insert into public.player_presence (player_id, last_seen) values ('${COMB}', now());

create table public.faction_treasury (faction text primary key, credits numeric default 0);
insert into public.faction_treasury (faction, credits) values
    ('Freedom Authority', 10000), ('Combine', 10000);

create table public.planets (id text primary key, name text unique);
insert into public.planets values ('Ultramars', 'Ultramars'), ('Krieg', 'Krieg'), ('Kara', 'Kara');

create table public.cities (id serial primary key, planet_id text, faction text);
insert into public.cities (planet_id, faction) values
    ('Ultramars', 'Freedom Authority'), ('Ultramars', 'Freedom Authority'),
    ('Krieg', 'Combine'), ('Krieg', 'Combine'),
    ('Kara', 'Combine'), ('Kara', 'Combine');

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
create or replace function public.unrest_sweep_policies() returns void language plpgsql as $$ begin end $$;
create or replace function public.unrest_turn_seconds() returns integer language sql immutable as $$ select 300 $$;
create or replace function public.unrest_revolt_at() returns numeric language sql immutable as $$ select 100 $$;
create or replace function public.tinder_apply() returns void language plpgsql as $$ begin end $$;

`;

(async function main() {

    try {

        const db = new PGlite();
        await db.exec(SCHEMA);
        await db.exec(fs.readFileSync(path.join(ROOT, "sql/2026-11-37_the_crowd_has_to_be_faced.sql"), "utf8"));
        await db.exec(fs.readFileSync(path.join(ROOT, PATCH), "utf8"));
        await db.exec(fs.readFileSync(path.join(ROOT, PATCH_WOODS), "utf8"));
        await db.exec(fs.readFileSync(path.join(ROOT, PATCH_WOODS), "utf8"));

        await as(db, COMB);

        /* ---------- the rising ---------- */

        console.log("\n== the rising");

        await db.exec("insert into public.planet_unrest (planet, faction, unrest) values ('Krieg', 'Combine', 62)");
        await db.exec("insert into public.planet_unrest (planet, faction, unrest) values ('Kara', 'Combine', 59)");

        const raised = await rpc(db, "select public.rebel_raise() as r");

        ok("a world at 62 raises a band", Array.isArray(raised) && raised.length === 1 && raised[0].planet === "Krieg", raised);
        ok("of 1,500 men",
            Number((await one(db, "select soldiers from public.planet_rebels where planet = 'Krieg'")).soldiers) === 1500);
        ok("and a world at 59 raises none",
            Number((await one(db, "select count(*)::int as n from public.planet_rebels where planet = 'Kara'")).n) === 0);
        ok("the halls are told", Number((await one(db, "select count(*)::int as n from public.cs_log where text like 'LEVANTE%'")).n) === 1);

        const immediate = await rpc(db, "select public.rebel_raise() as r");

        ok("a second band does not appear the same minute", Array.isArray(immediate) && immediate.length === 0, immediate);

        await db.exec("update public.planet_unrest set last_band_at = now() - interval '11 minutes' where planet = 'Krieg'");

        const second = await rpc(db, "select public.rebel_raise() as r");

        ok("ten minutes later another joins them",
            Array.isArray(second) && second.length === 1 && second[0].bands === 2, second);
        ok("so the world carries 3,000 men",
            Number((await one(db, "select sum(soldiers) from public.planet_rebels where planet = 'Krieg'")).sum) === 3000);

        /* ---------- while nobody is playing ---------- */

        console.log("\n== while nobody is playing");

        await db.exec("update public.player_presence set last_seen = now() - interval '10 minutes'");
        await db.exec("update public.planet_unrest set last_band_at = now() - interval '11 minutes' where planet = 'Krieg'");

        const asleep = await rpc(db, "select public.rebel_raise() as r");

        ok("no band rises with the halls empty", Array.isArray(asleep) && asleep.length === 0, asleep);
        ok("and the world keeps the two it had",
            Number((await one(db, "select count(*)::int as n from public.planet_rebels where planet = 'Krieg'")).n) === 2);

        await db.exec("update public.player_presence set last_seen = now()");

        /* ---------- the cap ---------- */

        console.log("\n== never more than four");

        for (let i = 0; i < 4; i++) {
            await db.exec("update public.planet_unrest set last_band_at = now() - interval '11 minutes' where planet = 'Krieg'");
            await rpc(db, "select public.rebel_raise() as r");
        }

        ok("the world stops at four bands",
            Number((await one(db, "select count(*)::int as n from public.planet_rebels where planet = 'Krieg'")).n) === 4);

        /* ---------- the money is shut out ---------- */

        console.log("\n== an armed world cannot be bought");

        const errCalm = await expectError(db, "select public.unrest_calm('Krieg')");

        ok("the ringleaders are under arms, not for sale", /are under arms/.test(String(errCalm)), errCalm);
        ok("and the treasury has not been touched",
            Number((await one(db, "select credits from public.faction_treasury where faction = 'Combine'")).credits) === 10000);

        /* ---------- the troops ---------- */

        console.log("\n== the troops go in");

        await db.exec("insert into public.fleets (faction, origin, status, name, squads) values " +
            "('Combine', 'Krieg', 'stationed', 'Second Fleet', '[{\"type\":\"Infantry\",\"amount\":2,\"soldiers\":2000,\"soldiersPerDivision\":1000}]'::jsonb)");

        const fight = await rpc(db, "select public.unrest_fight('Krieg') as r");

        ok("six thousand men take a thousand dead", fight && Number(fight.killed) === 1000, fight);
        ok("the oldest band is hurt but not broken", fight && Number(fight.broken) === 0, fight);
        ok("four bands are still up", fight && Number(fight.bands) === 4, fight);
        ok("the fleet pays a quarter of the men in the streets",
            fight && Number(fight.lost) === 1500, fight);
        ok("and the bar has not moved while men remain", fight && Number(fight.delta) === 0, fight);

        const squads = (await one(db, "select squads from public.fleets where name = 'Second Fleet'")).squads;

        ok("the squads carry the dead",
            squads.reduce(function (a, e) { return a + Number(e.soldiers || 0); }, 0) === 500, squads);

        /* ---------- the last band ---------- */

        console.log("\n== the last band");

        await db.exec("delete from public.planet_rebels where planet = 'Krieg' and id not in (select min(id) from public.planet_rebels where planet = 'Krieg')");
        await db.exec("update public.planet_rebels set soldiers = 200 where planet = 'Krieg'");
        await db.exec("update public.planet_unrest set last_fight_at = now() - interval '10 minutes' where planet = 'Krieg'");
        await db.exec("update public.planet_unrest set unrest = 62 where planet = 'Krieg'");

        const last = await rpc(db, "select public.unrest_fight('Krieg') as r");

        ok("the last band breaks", last && Number(last.bands) === 0 && Number(last.broken) === 1, last);
        ok("and the world breathes: the bar falls fifteen",
            last && Number(last.delta) === -15 && Number(last.unrest) === 47, last);
        ok("no band is left", Number((await one(db, "select count(*)::int as n from public.planet_rebels where planet = 'Krieg'")).n) === 0);

        const errFight = await expectError(db, "select public.unrest_fight('Krieg')");

        ok("with no band left there is nothing to fight", /No rebel band has risen/.test(String(errFight)), errFight);

        const calmNow = await rpc(db, "select public.unrest_calm('Krieg') as r");

        ok("and now the ringleaders can be paid", calmNow && Number(calmNow.unrest) === 27, calmNow);

        /* ---------- a band never outlives its bar ---------- */

        console.log("\n== a band never outlives its bar");

        await db.exec("update public.planet_unrest set unrest = 62 where planet = 'Krieg'");
        await db.exec("update public.planet_unrest set last_band_at = null where planet = 'Krieg'");
        await rpc(db, "select public.rebel_raise() as r");

        ok("a band is back in the streets",
            Number((await one(db, "select count(*)::int as n from public.planet_rebels where planet = 'Krieg'")).n) === 1);

        await db.exec("delete from public.planet_unrest where planet = 'Krieg'");

        ok("sweeping the bar takes its bands with it",
            Number((await one(db, "select count(*)::int as n from public.planet_rebels where planet = 'Krieg'")).n) === 0);

        /* ---------- what the halls are told ---------- */

        console.log("\n== what the halls are told");

        await db.exec("insert into public.planet_unrest (planet, faction, unrest) values ('Kara', 'Combine', 70) " +
            "on conflict (planet) do update set unrest = 70, last_band_at = null");
        await db.exec("update public.planet_unrest set last_band_at = null where planet = 'Kara'");

        const st = await rpc(db, "select public.unrest_state() as r");
        const kara = ((st || {}).worlds || []).find(function (w) { return w.planet === "Kara"; }) || {};

        ok("the bar reads 60 as the point of rising", Number((st || {}).rebel_at) === 60, st && st.rebel_at);
        ok("the world is told how many bands it has",
            Number(kara.bands) === 1 && Number(kara.band_men) === 1500, { bands: kara.bands, men: kara.band_men });
        ok("and that it is under arms", kara.calm && kara.calm.armed === true, kara.calm);
        ok("the state raises them itself", Number(kara.fight && kara.fight.bands) >= 1, kara.fight);
        ok("and says whether anyone is playing", (st || {}).online === true, st && st.online);

        /* ---------- the woods decide, and the camps take recruits ---------- */

        console.log("\n== a band recruits itself out of the garrison");

        await db.exec("delete from public.planet_rebels");
        await db.exec("delete from public.fleets");
        await db.exec("delete from public.planet_unrest");
        await db.exec("insert into public.planet_unrest (planet, faction, unrest) values ('Krieg', 'Combine', 70)");
        await db.exec("insert into public.fleets (faction, origin, status, squads) values " +
                      "('Combine', 'Krieg', 'stationed', '[{\"type\":\"Rifle\",\"amount\":10}]'::jsonb)");

        ok("the share a band takes is five per cent",
            Number((await one(db, "select public.rebel_recruit_share() as n")).n) === 0.05);

        await rpc(db, "select public.rebel_raise() as r");

        const garrisonLeft = Number((await one(db,
            "select (public.planet_garrison('Combine', 'Krieg') ->> 'soldiers')::numeric as n")).n);
        const bandMen = Number((await one(db,
            "select soldiers from public.planet_rebels where planet = 'Krieg'")).soldiers);

        ok("the band has taken men out of the garrison", garrisonLeft < 10000, garrisonLeft);
        ok("and put them in its own ranks", Math.round(bandMen) === 1500 + Math.round(10000 - garrisonLeft),
            bandMen + " vs " + (1500 + Math.round(10000 - garrisonLeft)));

        console.log("\n== winning in the woods breaks a band");

        const won = await rpc(db, "select public.rebel_assault_result('Krieg', true) as r");

        ok("one band is broken", won && Number(won.broken) === 1, won);
        ok("and none are left", won && Number(won.bands) === 0, won);
        ok("the bar falls with the last band", won && Number(won.delta) === -15, won);
        ok("and the woods cost blood even in victory", won && Number(won.lost) > 0, won);

        const noBand = await expectError(db, "select public.rebel_assault_result('Krieg', true)");

        ok("with no militia left there is nothing to fight", !!noBand, noBand);

        console.log("\n== losing in the woods breaks nothing");

        await db.exec("update public.planet_unrest set unrest = 70, last_band_at = null where planet = 'Krieg'");
        await db.exec("insert into public.fleets (faction, origin, status, squads) values " +
                      "('Combine', 'Krieg', 'stationed', '[{\"type\":\"Rifle\",\"amount\":10}]'::jsonb)");

        await rpc(db, "select public.rebel_raise() as r");
        await db.exec("update public.planet_unrest set last_band_at = now() - interval '11 minutes' where planet = 'Krieg'");
        await rpc(db, "select public.rebel_raise() as r");

        const twoBands = Number((await one(db,
            "select count(*)::int as n from public.planet_rebels where planet = 'Krieg'")).n);

        ok("two bands stand in the woods", twoBands === 2, twoBands);

        const lost = await rpc(db, "select public.rebel_assault_result('Krieg', false) as r");
        const stillThere = Number((await one(db,
            "select count(*)::int as n from public.planet_rebels where planet = 'Krieg'")).n);

        ok("a loss breaks no band", lost && Number(lost.broken) === 0 && stillThere === 2, lost);
        ok("but the troops pay for it", lost && Number(lost.lost) > 0, lost);
        ok("and the bar does not fall", lost && Number(lost.delta) === 0, lost);

        console.log("\n== without troops in orbit there is no fight");

        await db.exec("delete from public.fleets");

        const noFleet = await expectError(db, "select public.rebel_assault_result('Krieg', true)");

        ok("the woods cannot be entered", !!noFleet && /No troops of ours stand in orbit/.test(noFleet), noFleet);

        await db.close();

    } catch (e) {

        fail++;
        console.log("\nCRASH: " + String((e && e.stack) || e).split("\n").slice(0, 8).join("\n"));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

})();
