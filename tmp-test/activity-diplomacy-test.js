/* Run the 2026-10-31 patch against a real PostgreSQL (PGlite, the WASM build)
   with a stand-in for the game's existing tables, and then:

     - touch a game, walk away from it, and watch the income rhythm follow the
       last hand rather than the open window (full, reduced, and two hours
       later nothing at all, never paid back);
     - read the High Commissar out of the Soviet's own source;
     - check the Independents are gone from the bills and the books;
     - send envoys to an independent world until it signs the pact, and check
       the money, the cooldown, the annexation and the trading truce;
     - hit the reset and check everything this patch added is wiped, and that
       only the host may do it.

   The stand-in is not the real Supabase schema (the base tables live outside
   this repository), but the tables this patch touches are the real ones, so
   the logic is genuinely exercised.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/activity-diplomacy-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const FILES = [
    "sql/2026-10-25_offline_income_and_freeze.sql",
    "sql/2026-10-28_combine_soviet.sql",
    "sql/2026-10-29_soviet_worlds_and_quotas.sql",
    "sql/2026-10-30_soviet_agitprop.sql",
    "sql/2026-10-31_leaders_parties_and_diplomacy.sql"
];

const ME = "11111111-1111-1111-1111-111111111111";       /* Combine */
const OTHER = "22222222-2222-2222-2222-222222222222";    /* Freedom Authority */

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra !== undefined ? "  [" + extra + "]" : "")); }
}

const SCHEMA = `
create schema if not exists auth;
create schema if not exists public;

/* Supabase's two roles, which the patches revoke from */
do $do$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $do$;

/* the signed-in commander can be switched, so both sides can be walked */
create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.me', true), '')::uuid $$;

create table public.game_control (
    id int primary key,
    started boolean default true,
    maintenance boolean default false,
    maintenance_message text,
    host_player uuid,
    last_activity timestamptz default now(),
    offline_since timestamptz,
    total_paused interval default interval '0'
);
insert into public.game_control (id, host_player) values (1, '${ME}');

create or replace function public.game_frozen() returns boolean language sql stable
as $$ select false $$;

create or replace function public.game_shift_time(p_shift interval) returns void language sql
as $$ select $$;

create table public.players (id uuid primary key, faction text, username text);
insert into public.players values
    ('${ME}', 'Combine', 'Comrade Volkov'),
    ('${OTHER}', 'Freedom Authority', 'President Hale');

create table public.planets (id serial primary key, name text unique, income int default 100);
insert into public.planets (name) values ('Ultramars'), ('Free Earth'), ('Veyrona'), ('Krieg'), ('Vraks');

create table public.planet_positions (name text primary key, x numeric, y numeric);
insert into public.planet_positions (name, x, y) values
    ('Ultramars', 10, 19), ('Free Earth', 60, 30), ('Veyrona', 30, 40), ('Krieg', 70, 85), ('Vraks', 44, 62);

create table public.cities (id serial primary key, planet_id int references public.planets (id), faction text);
insert into public.cities (planet_id, faction) values
    (1, 'Combine'), (1, 'Combine'),
    (2, 'Freedom Authority'), (2, 'Freedom Authority'),
    (3, 'Independents'), (3, 'Independents'),
    (4, 'Combine'), (4, 'Freedom Authority'),
    (5, 'Independents');

create table public.city_buildings (id serial primary key, city_id int, building_type text, last_fired_at timestamptz);

create table public.faction_treasury (faction text primary key, credits bigint default 5000, fleets_built int default 0, last_income_at timestamptz);
insert into public.faction_treasury (faction, credits, last_income_at) values
    ('Combine', 5000, null), ('Freedom Authority', 500, null);

create table public.fleets (id uuid primary key default gen_random_uuid(), player_id uuid, name text, faction text,
    origin text, status text default 'stationed', squads jsonb);

/* presence as 2026-10-25 leaves it: only the heartbeat, no touch yet */
create table public.player_presence (player_id uuid primary key, last_seen timestamptz not null default now());
insert into public.player_presence (player_id, last_seen) values ('${ME}', now()), ('${OTHER}', now());

/* the Congress's books, as the base schema keeps them */
create table public.cg_state (id int primary key, popularity numeric default 61, tax_level int default 1,
    relations jsonb default '{"Combine": -10, "Independents": 20}'::jsonb,
    president_player uuid, term_no int default 0, term_end timestamptz);
insert into public.cg_state (id, president_player, term_no, term_end)
values (1, '${OTHER}', 3, now() + interval '1 day');

create table public.cg_log (id serial primary key, text text, at timestamptz default now());

create table public.cg_authorizations (id serial primary key, kind text, player_id uuid, planet text, used boolean default false);
create table public.cg_proposals (id serial primary key, type text, status text);

create or replace function public.my_identity() returns table (username text) language sql stable
as $$ select p.username from public.players as p where p.id = auth.uid() $$;

create or replace function public.cg_log(p_text text) returns void language sql
as $$ insert into public.cg_log (text) values (p_text) $$;
`;

(async function main() {
    try { return await run(); }
    catch (e) {
        console.log("\nCRASH: " + String(e && e.message ? e.message : e).slice(0, 900));
        if (e && e.detail) { console.log("detail: " + e.detail); }
        if (e && e.where) { console.log("where: " + e.where); }
        process.exit(1);
    }
})();

async function run() {

    const db = new PGlite();
    const as = async who => { await db.exec(`set test.me to '${who}'`); };
    const one = async (sql, params) => (await db.query(sql, params)).rows[0];
    const num = async sql => Number((await one(sql)).n);

    console.log("a stand-in for the game's tables");
    await db.exec(SCHEMA);
    await as(ME);

    console.log("the migrations run");
    let ran = true;
    for (const file of FILES) {
        try { await db.exec(fs.readFileSync(path.join(ROOT, file), "utf8")); }
        catch (e) { ran = false; console.log("  " + file + ": " + String(e.message || e).slice(0, 1200)); }
    }
    check("every patch runs without error", ran);
    if (!ran) { process.exit(1); }

    check("presence now carries the touch",
        await num(`select count(*)::int as n from information_schema.columns
                   where table_name = 'player_presence' and column_name = 'last_active'`) === 1);
    check("and the diplomacy table exists",
        await num(`select count(*)::int as n from information_schema.columns
                   where table_name = 'planet_diplomacy' and column_name = 'relation'`) === 1);

    check("the Combine's book of relations loses the old bloc",
        !(("" + JSON.stringify((await one("select relations from public.cs_state")).relations)).includes("Independents")));
    check("and so does the Congress's",
        !(("" + JSON.stringify((await one("select relations from public.cg_state")).relations)).includes("Independents")));

    /* ------------------------------------------------------------------
       1. the economy follows the last touch, not the open window
    ------------------------------------------------------------------ */

    console.log("presence is a touch, not an open tab");

    /* the whole table at one rhythm: seenAgo is what the open tabs keep doing,
       activeAgo is when somebody last actually touched the game */
    const world = async (seenAgo, activeAgo) => {
        await db.exec(`update public.player_presence
                       set last_seen = now() - interval '${seenAgo} minutes',
                           last_active = ${activeAgo === null ? "null" : `now() - interval '${activeAgo} minutes'`}`);
    };
    const touch = async ago => world(0, ago);

    /* the tab is open (the heartbeat keeps ticking) but nobody has touched it */
    await world(0, 20);
    check("a window left open for twenty minutes is nobody online",
        Number((await one("select public.players_online() as n")).n) === 0);
    check("and the economy says so", (await one("select public.income_mode() as m")).m === "reduced");

    await world(0, 2);
    check("two minutes after a touch both players are online",
        Number((await one("select public.players_online() as n")).n) === 2);
    check("and the economy is back to full", (await one("select public.income_mode() as m")).m === "full");
    check("the last touch is the freshest of the two readings",
        Number((await one("select extract(epoch from (now() - public.last_touch())) as n")).n) > 60 &&
        Number((await one("select extract(epoch from (now() - public.last_touch())) as n")).n) < 180,
        (await one("select public.last_touch() as t")).t);

    await world(0, 200);
    check("three hours of nobody touching closes the coffers",
        (await one("select public.income_mode() as m")).m === "closed");

    console.log("what the income pays, and when");

    const income = async (credit, after) => {
        await db.exec(`update public.faction_treasury
                       set credits = ${credit}, last_income_at = now() - interval '${after} minutes'
                       where faction = 'Combine'`);
        await db.query("select public.collect_faction_income()");
        return (await one("select credits from public.faction_treasury where faction = 'Combine'")).credits;
    };

    await touch(6);
    let paid = await income(0, 12);
    check("twelve minutes of clock with a hand on it six minutes ago pays two full ticks",
        Number(paid) === 200, paid);

    await touch(90);
    paid = await income(0, 40);
    check("with the last touch an hour and a half ago the same forty minutes pay half",
        Number(paid) === 200, paid);

    /* the anti-idle case: tabs still open and heartbeating, nobody playing */
    await touch(180);
    paid = await income(0, 40);
    check("three hours without a touch pay nothing at all", Number(paid) === 0, paid);
    check("and the shut window is not carried over",
        Number((await one("select extract(epoch from (now() - last_income_at)) as n from public.faction_treasury where faction = 'Combine'")).n) < 5,
        (await one("select last_income_at from public.faction_treasury where faction = 'Combine'")).last_income_at);

    /* half an hour later the clock is inside the shut window: still nothing */
    await touch(210);
    paid = await income(0, 30);
    check("an open window three and a half hours on still pays nothing", Number(paid) === 0, paid);

    /* somebody touches the game again: the normal rhythm resumes from there */
    await touch(0);
    paid = await income(0, 12);
    check("a player coming back resumes the full rhythm", Number(paid) === 200, paid);

    console.log("the trading truce between the two main factions");

    check("with no warm words there is no truce",
        (await one("select public.truce_active() as t")).t === false);
    await db.exec(`update public.cg_state set relations = '{"Combine": 60}'::jsonb where id = 1`);
    await db.exec(`update public.cs_state set relations = '{"Freedom Authority": 60}'::jsonb where id = 1`);
    check("a mutual fifty or better is a truce",
        (await one("select public.truce_active() as t")).t === true);
    const reading = (await one("select public.relations_reading() as r")).r;
    check("both sides' readings are reported, with the dividend",
        Number(reading.authority) === 60 && Number(reading.combine) === 60 && Number(reading.dividend) === 10,
        JSON.stringify(reading));

    await touch(6);
    paid = await income(0, 12);
    check("a truce pays both books ten percent more", Number(paid) === 220, paid);

    await db.exec(`update public.cg_state set relations = '{"Combine": -10}'::jsonb where id = 1`);
    await db.exec(`update public.cs_state set relations = '{"Freedom Authority": -20}'::jsonb where id = 1`);

    console.log("the heartbeat carries the touch, and the reading");

    await world(0, 30);
    let hb = (await one("select public.game_heartbeat(true) as h")).h;
    check("a touched heartbeat moves the touch",
        Number((await one(`select extract(epoch from (now() - last_active)) as n from public.player_presence where player_id = '${ME}'`)).n) < 5);
    check("and the answer says the economy is full again", hb.income === "full", hb.income);
    await world(0, 30);
    hb = (await one("select public.game_heartbeat(false) as h")).h;
    check("an untouched heartbeat leaves the touch where it was",
        Number((await one(`select extract(epoch from (now() - last_active)) as n from public.player_presence where player_id = '${ME}'`)).n) > 1500,
        (await one(`select last_active from public.player_presence where player_id = '${ME}'`)).last_active);
    check("and the answer says the economy is reduced", hb.income === "reduced", hb.income);
    check("the answer still says who is online",
        typeof hb.online === "number" && hb.active === false, JSON.stringify(hb));

    console.log("the fleet-dismantling rule reads the same clock");

    await world(0, 2);
    check("a commander at the game is online", (await one(`select public.cs_player_online('${ME}') as t`)).t === true);
    await db.exec(`update public.player_presence set last_active = now() - interval '20 minutes'
                   where player_id = '${ME}'`);
    check("a commander who has not touched it for twenty minutes is not",
        (await one(`select public.cs_player_online('${ME}') as t`)).t === false);
    await world(0, 2);

    /* ------------------------------------------------------------------
       2. the High Commissar
    ------------------------------------------------------------------ */

    console.log("the Soviet's elected head is the High Commissar");

    const src = async name => (await one(`select prosrc from pg_proc where proname = '${name}'`)).prosrc;
    const vetoSrc = await src("cs_veto");
    check("the veto refuses anyone but the High Commissar",
        /Only the High Commissar may veto/.test(vetoSrc) && !/General Secretary/.test(vetoSrc));
    check("and its log line is the High Commissar's",
        /Alto Comissário/.test(vetoSrc));
    check("the election seats a High Commissar", /Alto Comissário/.test(await src("cs_election_tick")) &&
        !/Secretário-Geral/.test(await src("cs_election_tick")));
    check("and so does the candidacy", /Alto Comissário/.test(await src("cs_run")));

    let veto = "";
    try { await db.query("select public.cs_veto(999999)"); }
    catch (e) { veto = String(e.message || e); }
    check("the veto is refused to anyone but the High Commissar",
        /Only the High Commissar may veto/.test(veto), veto.slice(0, 120));

    /* ------------------------------------------------------------------
       3. the Independents are not a faction any more
    ------------------------------------------------------------------ */

    console.log("the Independents leave the bills and the books");

    check("no directive of the Party's own ever targets them",
        !/Independents/.test(await src("cs_npc_directive")));
    check("and neither does the Congress's", !/Independents/.test(await src("cg_npc_proposal")));
    check("a diplomatic mission names the other main faction",
        /Freedom Authority/.test(await src("cs_submit")) && /Freedom Authority/.test(await src("cs_execute")));

    /* ------------------------------------------------------------------
       4. diplomacy with the independent worlds
    ------------------------------------------------------------------ */

    console.log("envoys to an independent world");

    await as(ME);
    await db.exec("update public.cs_state set secretary_player = null, veto_used = false where id = 1");
    await db.exec("update public.faction_treasury set credits = 5000 where faction = 'Combine'");

    let dip = (await one("select public.diplomacy_state() as d")).d;
    check("the screen lists the independent worlds, not the held ones",
        dip.planets.length === 2 && dip.planets.map(p => p.planet).join() === "Veyrona,Vraks",
        JSON.stringify(dip.planets.map(p => p.planet)));
    check("and the price and the wait are on it",
        Number(dip.cost) === 500 && Number(dip.wait) === 300, dip.cost + "/" + dip.wait);
    check("an untouched world is at zero with you, and on nobody's side",
        Number(dip.planets[0].relation) === 0 && Number(dip.planets[0].envoys) === 0 &&
        Number(dip.planets[0].theirs) === 0, JSON.stringify(dip.planets[0]));
    check("the screen knows which side it is written for",
        dip.me === "Combine" && dip.other === "Freedom Authority", dip.me + "/" + dip.other);

    let sent = (await one("select public.send_envoy('Veyrona') as r")).r;
    check("an embassy costs five hundred credits and buys ten points",
        Number(sent.relation) === 10 && Number(sent.cost) === 500 && sent.annexed === false, JSON.stringify(sent));
    check("the money left the treasury",
        Number((await one("select credits from public.faction_treasury where faction = 'Combine'")).credits) === 4500);
    check("the world is logged in the Soviet's news",
        /EMBAIXADA: Veyrona/.test((await one("select text from public.cs_log order by id desc limit 1")).text),
        (await one("select text from public.cs_log order by id desc limit 1")).text);

    let refused = "";
    try { await db.query("select public.send_envoy('Veyrona')"); }
    catch (e) { refused = String(e.message || e); }
    check("the court will not see you twice in five minutes", /will see you again in/.test(refused), refused.slice(0, 140));

    refused = "";
    try { await db.query("select public.send_envoy('Ultramars')"); }
    catch (e) { refused = String(e.message || e); }
    check("a world you already hold gets no embassy", /not an independent world/.test(refused), refused.slice(0, 140));

    refused = "";
    try { await db.query("select public.send_envoy('Nowhere')"); }
    catch (e) { refused = String(e.message || e); }
    check("and there is no embassy on a world that does not exist",
        /no world called/.test(refused), refused.slice(0, 140));

    await db.exec("update public.planet_diplomacy set last_envoy_at = now() - interval '6 minutes' where planet = 'Veyrona'");
    sent = (await one("select public.send_envoy('Veyrona') as r")).r;
    check("six minutes later the next envoys land", Number(sent.relation) === 20, JSON.stringify(sent));

    console.log("a world brought all the way in signs the pact");

    await db.exec("update public.planet_diplomacy set relation = 90, last_envoy_at = now() - interval '6 minutes' where planet = 'Veyrona'");
    sent = (await one("select public.send_envoy('Veyrona') as r")).r;
    check("the hundredth point is the pact, not just a number",
        Number(sent.relation) === 100 && sent.annexed === true, JSON.stringify(sent));
    check("the world's cities change flag",
        Number((await one(`select count(*)::int as n from public.cities as c
                           join public.planets as p on p.id = c.planet_id
                           where p.name = 'Veyrona' and c.faction = 'Combine'`)).n) === 2);
    check("and it stops being a partner",
        Number((await one("select count(*)::int as n from public.planet_diplomacy where annexed_at is not null")).n) === 1);
    dip = (await one("select public.diplomacy_state() as d")).d;
    check("it is off the diplomacy list",
        dip.planets.length === 1 && dip.planets[0].planet === "Vraks", JSON.stringify(dip.planets.map(p => p.planet)));

    refused = "";
    try { await db.query("select public.send_envoy('Veyrona')"); }
    catch (e) { refused = String(e.message || e); }
    check("and the embassy is closed", /already signed the pact|not an independent world/.test(refused), refused.slice(0, 140));

    console.log("the Freedom Authority keeps its own embassies");

    await as(OTHER);
    await db.exec("update public.faction_treasury set credits = 100 where faction = 'Freedom Authority'");
    refused = "";
    try { await db.query("select public.send_envoy('Vraks')"); }
    catch (e) { refused = String(e.message || e); }
    check("with less than the price the embassy does not sail", /costs 500 credits/.test(refused), refused.slice(0, 140));

    await db.exec("update public.faction_treasury set credits = 900 where faction = 'Freedom Authority'");
    sent = (await one("select public.send_envoy('Vraks') as r")).r;
    check("the Authority's envoy is paid from the Authority's books",
        Number(sent.relation) === 10 &&
        Number((await one("select credits from public.faction_treasury where faction = 'Freedom Authority'")).credits) === 400,
        JSON.stringify(sent));
    check("and it is written in the Congress's news",
        /EMBAIXADA: Vraks/.test((await one("select text from public.cg_log order by id desc limit 1")).text),
        (await one("select text from public.cg_log order by id desc limit 1")).text);

    /* ------------------------------------------------------------------
       5. the reset button clears all of it
    ------------------------------------------------------------------ */

    console.log("the reset clears what this patch added");

    await db.exec(`update public.cs_state set secretary_player = '${ME}', secretary_name = 'Comrade Volkov',
                   secretary_current = 1, term_no = 4, term_end = now() + interval '2 days', veto_used = true where id = 1`);
    await db.exec("insert into public.cs_membership (player_id, current_id, name) values ('" + ME + "', 1, 'Comrade Volkov')");
    await db.exec("insert into public.cs_directives (dtype, title, sponsor_current, proposer_name) values ('fleet_construction', 'Uma frota', 1, 'Comrade Volkov')");
    await db.exec("insert into public.cs_authorizations (kind, player_id) values ('fleet', '" + ME + "')");
    await db.exec("insert into public.cs_occupations (planet, stage, stability) values ('Ultramars', 2, 44)");
    await db.exec(`insert into public.planet_diplomacy (planet, faction, relation) values ('Veyrona', 'Combine', 30)
                   on conflict (planet, faction) do update set relation = 30`);

    await as(ME);
    let extras = (await one("select public.game_reset_extras() as r")).r;
    check("the host may reset", extras && extras.ok === true, JSON.stringify(extras));
    const count = async (sql) => Number((await one(sql)).n);
    check("the directives are gone", await count("select count(*)::int as n from public.cs_directives") === 0);
    check("the authorisations are gone", await count("select count(*)::int as n from public.cs_authorizations") === 0);
    check("the party roll is gone", await count("select count(*)::int as n from public.cs_membership") === 0);
    check("the occupations are gone", await count("select count(*)::int as n from public.cs_occupations") === 0);
    check("the embassies are gone", await count("select count(*)::int as n from public.planet_diplomacy") === 0);
    check("the presence list is gone", await count("select count(*)::int as n from public.player_presence") === 0);
    const after = await one("select * from public.cs_state where id = 1");
    check("the Soviet has no High Commissar, no term and its opening confidence",
        after.secretary_player === null && Number(after.term_no) === 0 && Number(after.confidence) === 55 &&
        after.veto_used === false && !after.relations.Independents, JSON.stringify(after).slice(0, 200));
    const cg = await one("select * from public.cg_state where id = 1");
    check("the Congress has no President and no term",
        cg.president_player === null && Number(cg.term_no) === 0 && cg.term_end === null, JSON.stringify(cg));

    await as(OTHER);
    let blocked = "";
    try { await db.query("select public.game_reset_extras()"); }
    catch (e) { blocked = String(e.message || e); }
    check("and nobody but the host may do it", /Only the host/.test(blocked), blocked.slice(0, 140));

    console.log("");
    if (failures) { console.log(failures + " check(s) failed"); process.exit(1); }
    console.log("all checks passed");
    process.exit(0);
}
