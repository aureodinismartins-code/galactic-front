/* Run the Soviet's SQL against a real PostgreSQL (PGlite, the WASM build)
   with a stand-in for the game's existing tables, then use the Soviet:
   submit a directive, watch the plenum, pass it, claim what it authorises,
   and check the teeth, the cadre privileges, the election, the fleet quota,
   the occupied worlds and the rule that keeps the Party off an absent
   commander's fleet.

   The stand-in is not the real Supabase schema (the base tables live outside
   this repository), but the Soviet's own tables are the real ones this file
   creates, so the logic is genuinely exercised.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/soviet-sql-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const FILES = [
    "sql/2026-10-28_combine_soviet.sql",
    "sql/2026-10-29_soviet_worlds_and_quotas.sql",
    "sql/2026-10-30_soviet_agitprop.sql"
];

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra !== undefined ? "  [" + extra + "]" : "")); }
}

const SCHEMA = `
create schema if not exists auth;
create schema if not exists public;
create schema if not exists extensions;

create or replace function auth.uid() returns uuid language sql stable
as $$ select '${ME}'::uuid $$;

create table public.game_control (id int primary key, started boolean default true, maintenance boolean default false, started_at timestamptz default now());
insert into public.game_control (id) values (1);

create or replace function public.game_frozen() returns boolean language sql stable
as $$ select false $$;

create or replace function public.collect_faction_income() returns void language sql
as $$ select $$;

create table public.players (id uuid primary key, faction text, username text);
insert into public.players values ('${ME}', 'Combine', 'Comrade Volkov'), ('${OTHER}', 'Combine', 'Comrade Orlova');

create or replace function public.my_identity() returns table (username text) language sql stable
as $$ select p.username from public.players as p where p.id = auth.uid() $$;

create table public.planets (id serial primary key, name text unique, income int default 100);
insert into public.planets (name) values ('Veyrona'), ('Krieg'), ('Ultramars'), ('Liberty City');

create table public.planet_positions (name text primary key, x numeric, y numeric);
insert into public.planet_positions (name, x, y) values
    ('Veyrona', 30, 40), ('Krieg', 70, 85), ('Ultramars', 10, 19), ('Liberty City', 60, 30);

create table public.cities (id serial primary key, planet_id int references public.planets (id), faction text);
insert into public.cities (planet_id, faction) values
    (1, 'Independents'), (2, 'Combine'), (2, 'Combine'), (3, 'Freedom Authority'), (4, 'Combine'), (4, 'Freedom Authority');

create table public.faction_treasury (faction text primary key, credits bigint default 5000, fleets_built int default 0, last_income_at timestamptz);
insert into public.faction_treasury (faction, credits) values ('Combine', 5000), ('Freedom Authority', 500);

create table public.fleets (
    id uuid primary key default gen_random_uuid(), player_id uuid, name text, faction text, origin text,
    destination text, status text default 'stationed', departure_time timestamptz, arrival_time timestamptz, squads jsonb
);
insert into public.fleets (player_id, name, faction, status, origin, squads) values
    ('${ME}', 'Frota Um', 'Combine', 'stationed', 'Krieg', '[{"type":"rifle"},{"type":"rifle"},{"type":"mg"}]'::jsonb),
    ('${ME}', 'Frota Dois', 'Combine', 'stationed', 'Krieg', '[]'::jsonb),
    ('${ME}', 'Frota Três', 'Combine', 'stationed', 'Liberty City', '[]'::jsonb),
    ('${ME}', 'Frota Quatro', 'Combine', 'stationed', 'Ultramars', '[]'::jsonb);

create table public.cg_authorizations (id serial primary key, kind text, player_id uuid, used boolean default false, used_at timestamptz);

/* presence, as 2026-10-25_offline_income_and_freeze.sql leaves it: the
   second commander logged off ten minutes ago */
create table public.player_presence (player_id uuid primary key, last_seen timestamptz not null default now());
insert into public.player_presence (player_id, last_seen) values
    ('${ME}', now()), ('${OTHER}', now() - interval '10 minutes');
`;

(async function main() {
  try {
    return await run();
  }
  catch (e) {
    console.log("\nCRASH: " + String(e && e.message ? e.message : e).slice(0, 900));
    if (e && e.detail) { console.log("detail: " + e.detail); }
    if (e && e.where) { console.log("where: " + e.where); }
    process.exit(1);
  }
})();

async function run() {

    const db = new PGlite();

    console.log("a stand-in for the game's tables");
    await db.exec(SCHEMA);

    console.log("the migrations run");
    let ran = true;
    for (const file of FILES) {
        try { await db.exec(fs.readFileSync(path.join(ROOT, file), "utf8")); }
        catch (e) { ran = false; console.log("  " + file + ": " + String(e.message || e).slice(0, 1200)); }
    }
    check("the Soviet's SQL runs without error", ran);
    if (!ran) { process.exit(1); }

    const seats = (await db.query("select current_id, count(*)::int as n from public.cs_commissars group by 1 order by 1")).rows;
    check("three currents of the Party", seats.length === 3, JSON.stringify(seats));
    check("42 / 33 / 25 commissars", seats.map(r => r.n).join("/") === "42/33/25", seats.map(r => r.n).join("/"));

    const names = (await db.query("select name from public.cs_currents order by id")).rows.map(r => r.name);
    check("they have names of the Party", names.join(" / ") === "Vanguarda Proletária / Aparato do Partido / Comando Vermelho",
        names.join(" / "));

    const counts = (await db.query("select count(*)::int as n from public.cs_commissars where active")).rows[0];
    check("100 commissars are seated", counts.n === 100, counts.n);

    const bars = (await db.query("select public.cs_majority() as m, public.cs_qualified() as t")).rows[0];
    check("a majority is 51 and the heavier bar is 60", Number(bars.m) === 51 && Number(bars.t) === 60,
        bars.m + " / " + bars.t);

    await db.exec("begin");
    await db.exec("delete from public.fleets");
    const boost = (await db.query(
        "select public.cs_boost('fleet_construction', 1, null) as empty, public.cs_boost('diplomacy', 1, null) as plain")).rows[0];
    await db.exec("rollback");
    check("a Party with no fleet is kinder to a quota", Number(boost.empty) > Number(boost.plain) && Number(boost.plain) === 0,
        JSON.stringify(boost));
    check("and the ruling current is heard more often",
        Number((await db.query("select public.cs_boost('diplomacy', 2, 2) as b")).rows[0].b) === 10);

    console.log("the screen's overview");
    let ov = (await db.query("select public.cs_overview() as o")).rows[0].o;
    check("cs_overview returns the chamber", ov.currents.length === 3 && ov.commissars.length === 100,
        Object.keys(ov).join(","));
    check("the treasury is the Combine's", Number(ov.credits) === 5000, ov.credits);
    check("no directives yet", ov.directives.length === 0, ov.directives.length);
    check("the planets are listed with their owner",
        ov.targets.length === 4 && ov.targets.find(t => t.planet === "Krieg").owners === "Combine",
        JSON.stringify(ov.targets));

    console.log("the quota for the fleets");
    check("the overview carries the ceiling the Soviet grants",
        ov.fleets && Number(ov.fleets.total) === 4 && Number(ov.fleets.quotas) === 0 && Number(ov.fleets.max) === 4,
        JSON.stringify(ov.fleets));
    let quota = (await db.query("select public.cs_fleet_quota() as q")).rows[0].q;
    check("the fleet menu reads the same figures",
        quota.combine === true && Number(quota.fleets) === 4 && Number(quota.max) === 4 && quota.can_build === false,
        JSON.stringify(quota));
    check("with the price of the next fleet", Number(quota.next_price) === 500, quota.next_price);

    console.log("the occupied worlds");
    check("the worlds the Combine holds are listed", ov.worlds.length === 2, JSON.stringify(ov.worlds));
    const kriegWorld = ov.worlds.find(w => w.planet === "Krieg");
    check("a world held whole says so",
        kriegWorld && kriegWorld.whole === true && Number(kriegWorld.held) === 2 && Number(kriegWorld.total) === 2 &&
        kriegWorld.others === "", JSON.stringify(kriegWorld));
    const libertyWorld = ov.worlds.find(w => w.planet === "Liberty City");
    check("a contested world names the other holder",
        libertyWorld && libertyWorld.whole === false && Number(libertyWorld.held) === 1 && Number(libertyWorld.total) === 2 &&
        libertyWorld.others === "Freedom Authority", JSON.stringify(libertyWorld));
    check("a world the Combine does not hold is not there", !ov.worlds.find(w => w.planet === "Veyrona"),
        ov.worlds.map(w => w.planet).join(","));
    check("the world says what it produces", Number(kriegWorld.income) === 100, kriegWorld.income);
    check("the overview brings the map's coordinates for the minimap",
        ov.planets.length === 4 && Number(ov.planets.find(p => p.name === "Krieg").x) === 70 &&
        Number(ov.planets.find(p => p.name === "Krieg").y) === 85 &&
        ov.planets.find(p => p.name === "Krieg").owner === "Combine", JSON.stringify(ov.planets));
    const kriegMap = ov.planets.find(p => p.name === "Krieg");
    check("the map lists the fleets of ours standing there",
        kriegMap.fleets.length === 2 && kriegMap.fleets.map(f => f.name).join("/") === "Frota Dois/Frota Um" &&
        Number(kriegMap.fleets.find(f => f.name === "Frota Um").squads) === 3, JSON.stringify(kriegMap.fleets));
    check("and none where we have none", ov.planets.find(p => p.name === "Veyrona").fleets.length === 0,
        JSON.stringify(ov.planets.find(p => p.name === "Veyrona").fleets));

    console.log("the teeth: no authorisation, no fleet");
    let blocked = false;
    try { await db.query(`select public.create_fleet('Sem cota', 'Combine', 'Krieg', '[]'::jsonb)`); }
    catch (e) { blocked = /authorised a new fleet/.test(String(e.message || e)); }
    check("a Combine fleet without a directive is refused", blocked);

    console.log("a directive goes before the Soviet");
    let submitted = true, id = null;
    try {
        id = (await db.query("select public.cs_submit('fleet_construction', null, null, null, 'red_command') as id")).rows[0].id;
    } catch (e) { submitted = false; console.log("  " + String(e.message || e).slice(0, 400)); }
    check("cs_submit accepts a player's directive", submitted && id !== null, id);

    const row = (await db.query(`select * from public.cs_directives where id = ${id}`)).rows[0];
    check("it is titled and sponsored by the current asked for", /Cota de nova frota/.test(row.title) && Number(row.sponsor_current) === 3,
        row.title + " / " + row.sponsor_current);
    check("it is free — there is no price column at all",
        !("cost" in row), Object.keys(row).join(","));
    check("it starts as an introduction with a 3 minute clock",
        row.status === "introduction" && new Date(row.debate_at) - new Date(row.created_at) > 170000,
        row.status);

    const log = (await db.query("select text from public.cs_log order by id")).rows;
    check("the log says who brought it", log.some(l => /^DIRETIVA: Comrade Volkov leva/.test(l.text)),
        log.map(l => l.text.slice(0, 40)).join(" | "));

    console.log("the plenum sits for the Combine only");
    await db.query("update public.cs_state set online_at = null where id = 1");
    await db.exec(`create or replace function auth.uid() returns uuid language sql stable
        as $$ select '${OTHER}'::uuid $$`);
    await db.query("update public.players set faction = 'Freedom Authority' where id = '" + OTHER + "'");
    await db.query("select public.cs_tick()");
    check("an outsider does not keep the Soviet in session",
        (await db.query("select online_at from public.cs_state where id = 1")).rows[0].online_at === null,
        (await db.query("select online_at from public.cs_state where id = 1")).rows[0].online_at);
    await db.query("update public.players set faction = 'Combine' where id = '" + OTHER + "'");
    await db.exec(`create or replace function auth.uid() returns uuid language sql stable
        as $$ select '${ME}'::uuid $$`);

    console.log("the plenum");
    await db.query("select public.cs_tick()");
    await db.query("select public.cs_debate_tick()");
    let view = (await db.query("select public.cs_debate_view() as v")).rows[0].v;
    const mine = () => view.proposals.find(p => p.id === id);
    check("every commissar took a side on the directive", mine() &&
        mine().yes + mine().no + mine().undecided === 100,
        view.proposals.map(p => p.id + ":" + [p.yes, p.no, p.undecided].join("/")).join(" "));
    check("the sides are grouped by current", Object.keys(mine().factions).length === 3,
        Object.keys(mine().factions).join(","));

    const first = JSON.stringify(mine().sides);
    await db.query("select public.cs_debate_tick()");
    view = (await db.query("select public.cs_debate_view() as v")).rows[0].v;
    check("a second tick inside 15 seconds does nothing", JSON.stringify(mine().sides) === first);

    async function tick() {
        await db.query("update public.cs_state set last_debate_at = now() - interval '1 minute' where id = 1");
        await db.query("select public.cs_debate_tick()");
        return (await db.query("select public.cs_debate_view() as v")).rows[0].v;
    }

    let moved = false;
    for (let i = 0; i < 6 && !moved; i++) {
        const now = await tick();
        const p = now.proposals.find(x => x.id === id);
        if (JSON.stringify(p.sides) !== first) { moved = true; }
    }
    check("commissars change sides as the plenum goes on", moved);

    console.log("the vote decides, and the directive does its work");
    await db.query(`update public.cs_debate_sides set side = 'yes' where directive_id = ${id}`);
    const resolved = (await db.query(`select public.cs_resolve(${id}) as r`)).rows[0].r;
    check("a directive with the votes passes", resolved.status === "passed", JSON.stringify(resolved));
    check("three fifths were needed", Number(resolved.required) === 60, resolved.required);

    ov = (await db.query("select public.cs_overview() as o")).rows[0].o;
    check("a passed quota directive authorises exactly one fleet", Number(ov.authorizations.fleet) === 1,
        JSON.stringify(ov.authorizations));
    check("the treasury paid nothing for the directive", Number(ov.credits) === 5000, ov.credits);
    check("and the ceiling the screen shows rises with it",
        Number(ov.fleets.max) === 5 && Number(ov.fleets.quotas) === 1, JSON.stringify(ov.fleets));

    const res = (await db.query(`select result from public.cs_directives where id = ${id}`)).rows[0].result;
    check("the result explains what it authorised", /nova frota foi autorizada/.test(res.effect), res.effect);
    check("the sides are cleared for that directive",
        (await db.query(`select count(*)::int as n from public.cs_debate_sides where directive_id = ${id}`)).rows[0].n === 0);

    const before = (await db.query("select credits, fleets_built from public.faction_treasury where faction = 'Combine'")).rows[0];
    const built = (await db.query(`select public.create_fleet('Com cota', 'Combine', 'Krieg', '[]'::jsonb) as id`)).rows[0].id;
    check("with one, the fleet is built", built !== null, built);
    const after = (await db.query("select credits, fleets_built from public.faction_treasury where faction = 'Combine'")).rows[0];
    check("and the fleet is paid for as before",
        Number(before.credits) - Number(after.credits) === 500 * (1 + Number(before.fleets_built)) &&
        Number(after.fleets_built) === Number(before.fleets_built) + 1,
        before.credits + " -> " + after.credits + " (built " + before.fleets_built + " -> " + after.fleets_built + ")");
    check("the authorisation is spent", (await db.query("select count(*)::int as n from public.cs_authorizations where kind = 'fleet' and not used")).rows[0].n === 0);

    ov = (await db.query("select public.cs_overview() as o")).rows[0].o;
    check("a fleet built fills the ceiling instead of raising it",
        Number(ov.fleets.total) === 5 && Number(ov.fleets.max) === 5, JSON.stringify(ov.fleets));
    quota = (await db.query("select public.cs_fleet_quota() as q")).rows[0].q;
    check("and the fleet menu allows no further fleet", quota.can_build === false, JSON.stringify(quota));

    await db.query(`insert into public.cs_authorizations (kind, player_id) values ('fleet', '${OTHER}')`);
    quota = (await db.query("select public.cs_fleet_quota() as q")).rows[0].q;
    check("another commander's quota still raises the ceiling the header shows",
        Number(quota.max) === 6 && Number(quota.quotas) === 1 && Number(quota.mine) === 0, JSON.stringify(quota));
    check("but it is not mine to spend", quota.can_build === false, JSON.stringify(quota));
    await db.query(`delete from public.cs_authorizations where kind = 'fleet' and player_id = '${OTHER}'`);

    console.log("the teeth: no campaign, no attack");
    check("attacking Veyrona is refused before the directive", (await db.query("select public.cs_can_attack('Veyrona') as ok")).rows[0].ok === false);

    /* a random directive of this run may already have opened a campaign for
       that world, and the Soviet refuses a second one: the floor is cleared
       of stale campaigns first, the way a plenum would */
    await db.query("update public.cs_directives set status = 'rejected' " +
        "where dtype = 'military_campaign' and status in ('introduction', 'debate')");

    const war = (await db.query("select public.cs_submit('military_campaign', 'Veyrona') as id")).rows[0].id;
    await db.query("update public.cs_state set last_debate_at = null where id = 1");
    await db.query("select public.cs_debate_tick()");
    await db.query(`update public.cs_debate_sides set side = 'yes' where directive_id = ${war}`);
    const warRes = (await db.query(`select public.cs_resolve(${war}) as r`)).rows[0].r;
    check("the campaign passes", warRes.status === "passed", JSON.stringify(warRes));
    check("and then the planet can be attacked", (await db.query("select public.cs_can_attack('Veyrona') as ok")).rows[0].ok === true);
    check("another planet still cannot", (await db.query("select public.cs_can_attack('Ultramars') as ok")).rows[0].ok === false);

    let refused = false;
    try { await db.query("select public.cs_submit('military_campaign', 'Veyrona')"); }
    catch (e) { refused = /already authorised/.test(String(e.message || e)); }
    check("a campaign against an authorised planet is refused", refused);

    console.log("cadre privileges");
    /* a stand-in treasury big enough for one extravagant grant */
    await db.query("update public.faction_treasury set credits = 200000 where faction = 'Combine'");
    const priv = (await db.query(`select public.cs_submit('diplomacy', null, null, 'Independents') as id`)).rows[0].id;
    await db.query("select public.cs_debate_tick()");
    await db.query(`update public.cs_directives set status = 'debate' where id = ${priv}`);
    const commissar = (await db.query("select id from public.cs_commissars order by id limit 1")).rows[0].id;
    const cashBefore = (await db.query("select credits from public.faction_treasury where faction = 'Combine'")).rows[0].credits;
    const granted = (await db.query(`select public.cs_privilege(${priv}, ${commissar}, 100000, 'yes') as r`)).rows[0].r;
    const cashAfter = (await db.query("select credits from public.faction_treasury where faction = 'Combine'")).rows[0].credits;
    check("privileges are paid from the Combine treasury", Number(cashBefore) - Number(cashAfter) === 100000,
        cashBefore + " -> " + cashAfter);
    check("and they stack on the commissar", Number(granted.total) === 100000, JSON.stringify(granted));

    let stanceRefused = false;
    try { await db.query(`select public.cs_privilege(${priv}, ${commissar}, 500, 'no')`); }
    catch (e) { stanceRefused = /other side/.test(String(e.message || e)); }
    check("the other side cannot be bought afterwards", stanceRefused);

    await db.query(`update public.cs_debate_sides set side = 'no' where directive_id = ${priv}`);
    await db.query(`select public.cs_resolve(${priv})`);
    const bought = (await db.query(`select vote, was_privileged from public.cs_votes where directive_id = ${priv} and commissar_id = ${commissar}`)).rows[0];
    check("a privileged commissar votes as told", bought.was_privileged === true && bought.vote === "yes", JSON.stringify(bought));

    console.log("agitprop");
    await db.query("update public.faction_treasury set credits = 200000 where faction = 'Combine'");
    await db.query("update public.cs_commissars set loyalty = 40 where current_id = 1 and active");
    await db.query("update public.cs_commissars set loyalty = 20 where current_id = 2 and active");

    const agBefore = (await db.query("select credits from public.faction_treasury where faction = 'Combine'")).rows[0].credits;
    const agAvgBefore = (await db.query("select round(avg(loyalty))::int as n from public.cs_commissars where current_id = 1 and active")).rows[0].n;
    const agSeatsBefore = (await db.query("select count(*)::int as n from public.cs_commissars where current_id = 1 and active")).rows[0].n;
    const campaign = (await db.query("select public.cs_agitprop(1, 10000) as r")).rows[0].r;
    const agAfter = (await db.query("select credits from public.faction_treasury where faction = 'Combine'")).rows[0].credits;
    const agAvgAfter = (await db.query("select round(avg(loyalty))::int as n from public.cs_commissars where current_id = 1 and active")).rows[0].n;
    const agSeatsAfter = (await db.query("select count(*)::int as n from public.cs_commissars where current_id = 1 and active")).rows[0].n;

    check("a campaign is paid from the Combine treasury", Number(agBefore) - Number(agAfter) === 10000,
        agBefore + " -> " + agAfter);
    check("and lifts that current's discipline", Number(agAvgAfter) - Number(agAvgBefore) >= 20,
        agAvgBefore + " -> " + agAvgAfter);
    check("the least disciplined commissars come over", agSeatsAfter > agSeatsBefore && Number(campaign.flipped) > 0,
        agSeatsBefore + " -> " + agSeatsAfter + " (" + campaign.turned + ")");
    check("and the campaign says so", /custou 10000/.test(
        (await db.query("select text from public.cs_log order by id desc limit 1")).rows[0].text));

    let agCooldown = false;
    try { await db.query("select public.cs_agitprop(1, 1000)"); }
    catch (e) { agCooldown = /wait/.test(String(e.message || e)); }
    check("the same current cannot be campaigned for again at once", agCooldown);

    const agState = (await db.query("select public.cs_agitprop_state() as s")).rows[0].s;
    check("the screen reads the campaign clock",
        Number(agState.cooldown) === 600 && Number(agState.currents["1"].runs) === 1 &&
        Number(agState.currents["1"].spent) === 10000, JSON.stringify(agState.currents));
    check("and the treasury it can spend", Number(agState.credits) === Number(agAfter), agState.credits);

    let wrongCurrent = false;
    try { await db.query("select public.cs_agitprop(99, 1000)"); }
    catch (e) { wrongCurrent = /Unknown current/.test(String(e.message || e)); }
    check("an unknown current is refused", wrongCurrent);

    console.log("the General Secretary");
    await db.query("select public.cs_join_current('red_command')");
    check("a player joins a current",
        (await db.query(`select current_id from public.cs_membership where player_id = '${ME}'`)).rows[0].current_id === 3);

    let electionOpen = false;
    for (let i = 0; i < 3 && !electionOpen; i++) {
        await db.query("update public.cs_state set last_election_at = now() - interval '10 minutes' where id = 1");
        await db.query("select public.cs_tick()");
        electionOpen = (await db.query("select count(*)::int as n from public.cs_election where phase <> 'done'")).rows[0].n > 0;
    }
    check("a campaign opens when the office is empty", electionOpen);

    let ranFor = true;
    try { await db.query("select public.cs_run()"); } catch (e) { ranFor = false; console.log("  " + e.message); }
    check("a candidate can stand", ranFor);

    await db.query("select public.cs_election_tick()");
    const phase = (await db.query("select phase from public.cs_election order by id desc limit 1")).rows[0].phase;
    check("the campaign is running", phase === "campaign" || phase === "voting", phase);

    /* the vote: force the clock past the campaign, then vote */
    await db.query("update public.cs_election set campaign_end = now() - interval '1 second' where phase = 'campaign'");
    await db.query("select public.cs_election_tick()");
    const voting = (await db.query("select phase from public.cs_election order by id desc limit 1")).rows[0].phase;
    check("campaign becomes voting", voting === "voting", voting);

    await db.query(`select public.cs_election_vote('${ME}')`);
    await db.query("update public.cs_election set vote_end = now() - interval '1 second' where phase = 'voting'");
    await db.query("select public.cs_election_tick()");

    const st = (await db.query("select secretary_player, secretary_name, secretary_current, term_no, term_end from public.cs_state where id = 1")).rows[0];
    check("the winner becomes General Secretary", st.secretary_player === ME, JSON.stringify(st));
    check("with a party and a term", Number(st.secretary_current) === 3 && Number(st.term_no) === 1 &&
        new Date(st.term_end) - Date.now() > 13 * 86400000, JSON.stringify(st));

    console.log("powers of the General Secretary");
    const big = (await db.query("select public.cs_submit('knightmare_construction', null, null, null, 'red_command') as id")).rows[0].id;
    check("a Secretary can put a directive before the Soviet", big !== null, big);
    const live = (await db.query(`select public.cs_veto(${big})`)).rows[0];
    const vetoed = (await db.query(`select status, result from public.cs_directives where id = ${big}`)).rows[0];
    check("and veto it, once per term", vetoed.status === "rejected" && /vetou/.test(vetoed.result.effect), JSON.stringify(vetoed));
    check("the veto is recorded on the state", (await db.query("select veto_used from public.cs_state where id = 1")).rows[0].veto_used === true);
    let again = false;
    try { await db.query(`select public.cs_veto(${war})`); } catch (e) { again = /used/.test(String(e.message || e)); }
    check("a second veto is refused", again);

    console.log("the production quota pays");
    const beforeQuota = (await db.query("select credits from public.faction_treasury where faction = 'Combine'")).rows[0].credits;
    await db.query("update public.cs_state set last_quota_at = now() - interval '31 minutes' where id = 1");
    await db.query("update public.cs_state set quota = 2 where id = 1");
    await db.query("select public.cs_tick()");
    const afterQuota = (await db.query("select credits from public.faction_treasury where faction = 'Combine'")).rows[0].credits;
    check("two quota levels pay two ticks each", Number(afterQuota) - Number(beforeQuota) >= 2 * 2 * 300,
        beforeQuota + " -> " + afterQuota);

    const planLog = (await db.query("select count(*)::int as n from public.cs_log where text like 'PLANO:%'")).rows[0].n;
    check("and the Soviet log says so", planLog > 0);

    console.log("the screen still reads");
    ov = (await db.query("select public.cs_overview() as o")).rows[0].o;
    check("overview carries the Secretary", ov.president && ov.president.name === "Comrade Volkov", JSON.stringify(ov.president));
    check("overview carries the directives", ov.directives.length >= 4, ov.directives.length);
    check("overview carries the election result", !!ov.last_election && !!ov.last_election.winner, JSON.stringify(ov.last_election));

    const hist = (await db.query(`select public.cs_commissar_history(${commissar}) as h`)).rows[0].h;
    check("a commissar's record can be read", hist && typeof hist.yes === "number" && Array.isArray(hist.votes), JSON.stringify(hist).slice(0, 120));

    console.log("the Party keeps off an absent commander's fleet");
    await db.query("insert into public.fleets (player_id, name, faction, status) values ($1, 'Frota Ausente', 'Combine', 'stationed')", [OTHER]);
    check("an absent commander is known to be away",
        (await db.query(`select public.cs_player_online('${OTHER}') as on`)).rows[0].on === false);
    check("and the commander at the front is not",
        (await db.query(`select public.cs_player_online('${ME}') as on`)).rows[0].on === true);

    const awayFleet = (await db.query("select id::text as id from public.fleets where name = 'Frota Ausente'")).rows[0].id;
    const named = new Set();
    for (let i = 0; i < 40; i++) {
        await db.query("delete from public.cs_privileges");
        await db.query("delete from public.cs_votes");
        await db.query("delete from public.cs_debate_sides");
        await db.query("delete from public.cs_debate_standing");
        await db.query("delete from public.cs_directives");
        await db.query("update public.cs_state set last_npc_at = null where id = 1");
        await db.query("select public.cs_npc_directive()");
        for (const r of (await db.query("select fleet_id from public.cs_directives where dtype = 'fleet_revocation'")).rows) {
            named.add(r.fleet_id);
        }
    }
    check("the Party does bring dismantlings before the Soviet", named.size > 0, named.size);
    check("but never names the absent commander's fleet", !named.has(awayFleet), [...named].join(","));

    let stolen = false;
    try { await db.query(`select public.cs_submit('fleet_revocation', null, '${awayFleet}')`); }
    catch (e) { stolen = /your fleets/.test(String(e.message || e)); }
    check("a player cannot put somebody else's fleet up for dismantling", stolen);

    const myFleet = (await db.query(`select id::text as id, name from public.fleets where player_id = '${ME}' order by name limit 1`)).rows[0];
    const own = (await db.query(`select public.cs_submit('fleet_revocation', null, '${myFleet.id}') as id`)).rows[0].id;
    const ownTitle = (await db.query(`select title from public.cs_directives where id = ${own}`)).rows[0].title;
    check("their own fleet can be, and the directive names it",
        ownTitle.indexOf(myFleet.name) !== -1, ownTitle);

    console.log("the administration of a taken world");
    await db.query("delete from public.cs_privileges");
    await db.query("delete from public.cs_votes");
    await db.query("delete from public.cs_debate_sides");
    await db.query("delete from public.cs_directives");
    await db.query("select public.cs_seed_occupations()");

    let occ = (await db.query("select * from public.cs_occupations order by planet")).rows;
    check("a world held whole enters the administration",
        occ.length === 1 && occ[0].planet === "Krieg" && Number(occ[0].stage) === 0 && Number(occ[0].stability) === 30,
        JSON.stringify(occ));
    check("a contested world does not", !occ.some(o => o.planet === "Liberty City"), occ.map(o => o.planet).join(","));

    async function turn(planet) {
        await db.query("update public.cs_occupations set last_turn_at = now() - interval '6 minutes' where planet = $1", [planet]);
        await db.query("select public.cs_process_occupations()");
        return (await db.query("select * from public.cs_occupations where planet = $1", [planet])).rows[0];
    }

    let occNow = null;
    for (let i = 0; i < 5; i++) { occNow = await turn("Krieg"); }
    check("five turns take it to military administration",
        Number(occNow.stage) === 1 && Number(occNow.progress) === 0, JSON.stringify(occNow));

    occNow = await turn("Krieg");
    check("military administration needs more stability than it has",
        Number(occNow.stage) === 1 && Number(occNow.progress) === 0, JSON.stringify(occNow));

    let occRefused = false;
    try { await db.query("select public.cs_submit('consolidation', 'Veyrona')"); }
    catch (e) { occRefused = /Unknown directive/.test(String(e.message || e)); }
    check("consolidation is no longer a directive at all", occRefused);

    let reliefRefused = false;
    try { await db.query("select public.cs_relief('Veyrona')"); }
    catch (e) { reliefRefused = /not under Combine administration/.test(String(e.message || e)); }
    check("relief cannot go to a world we do not administer", reliefRefused);

    const rel = (await db.query("select public.cs_relief('Krieg') as r")).rows[0].r;
    check("relief is sent straight away, with no directive",
        Number(rel.stability) === 40 && Number(rel.threshold) === 40, JSON.stringify(rel));
    check("and it creates no directive",
        Number((await db.query("select count(*)::int as n from public.cs_directives where dtype = 'consolidation'")).rows[0].n) === 0);

    let reliefAgain = false;
    try { await db.query("select public.cs_relief('Krieg')"); }
    catch (e) { reliefAgain = /once every five minutes/.test(String(e.message || e)); }
    check("a second relief waits five minutes", reliefAgain);

    await db.query("update public.cs_occupations set last_relief_at = now() - interval '6 minutes' where planet = 'Krieg'");
    const relAgain = (await db.query("select public.cs_relief('Krieg') as r")).rows[0].r;
    check("after five minutes it can be sent again", Number(relAgain.stability) === 50, JSON.stringify(relAgain));

    for (let i = 0; i < 5; i++) { occNow = await turn("Krieg"); }
    check("then the world is collectivised", Number(occNow.stage) === 2, JSON.stringify(occNow));

    /* the Party handles relief itself, the way a delegate would, with no vote */
    await db.query("update public.cs_occupations set stability = 45, last_relief_at = null where planet = 'Krieg'");
    let partyStability = 45;
    for (let i = 0; i < 40 && partyStability === 45; i++) {
        await db.query("delete from public.cs_directives");
        await db.query("update public.cs_state set last_npc_at = null where id = 1");
        await db.query("select public.cs_npc_directive()");
        partyStability = Number((await db.query("select stability from public.cs_occupations where planet = 'Krieg'")).rows[0].stability);
    }
    check("the Party sends a stalled world its relief, with no directive", partyStability === 55, partyStability);
    await db.query("delete from public.cs_directives");

    /* a world lost in part: the administration waits */
    await db.query("update public.cs_occupations set stability = 100, progress = 3 where planet = 'Krieg'");
    await db.query("insert into public.cities (planet_id, faction) select id, 'Freedom Authority' from public.planets where name = 'Krieg'");
    occNow = await turn("Krieg");
    check("a contested world stops advancing",
        Number(occNow.stage) === 2 && Number(occNow.progress) === 3, JSON.stringify(occNow));
    await db.query("delete from public.cities where planet_id = (select id from public.planets where name = 'Krieg') and faction = 'Freedom Authority'");

    const confBefore = Number((await db.query("select confidence from public.cs_state where id = 1")).rows[0].confidence);
    for (let i = 0; i < 2; i++) { occNow = await turn("Krieg"); }
    check("an incorporated world is the end of the road",
        Number(occNow.stage) === 3 && occNow.integrated_at !== null, JSON.stringify(occNow));
    check("and the Party gains confidence from it",
        Number((await db.query("select confidence from public.cs_state where id = 1")).rows[0].confidence) === Math.min(100, confBefore + 1),
        confBefore + " -> " + (await db.query("select confidence from public.cs_state where id = 1")).rows[0].confidence);

    occNow = await turn("Krieg");
    check("nothing moves past incorporation", Number(occNow.stage) === 3 && Number(occNow.progress) === 0,
        JSON.stringify(occNow));

    ov = (await db.query("select public.cs_overview() as o")).rows[0].o;
    const kriegOv = ov.worlds.find(w => w.planet === "Krieg");
    check("the screen reads the stage, stability and progress",
        Number(kriegOv.stage) === 3 && Number(kriegOv.stability) === 100 && kriegOv.integrated === true,
        JSON.stringify(kriegOv));
    check("a contested world carries no stage", ov.worlds.find(w => w.planet === "Liberty City").stage === null,
        JSON.stringify(ov.worlds.find(w => w.planet === "Liberty City")));
    check("and the screen reads the stage's own threshold and the relief clock",
        Number(kriegOv.threshold) === 100 && typeof kriegOv.relief_wait === "number",
        kriegOv.threshold + " / " + kriegOv.relief_wait);

    console.log("\n" + (failures ? failures + " check(s) failed" : "all checks passed"));
    await db.close();
    process.exit(failures ? 1 : 0);

}
