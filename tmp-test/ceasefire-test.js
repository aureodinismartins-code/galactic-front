/* Run the 2026-11-02 patch against a real PostgreSQL (PGlite, the WASM build)
   with a stand-in for the game's existing tables, and then:

     - offer a ceasefire, watch it lapse, offer it again, have the other side
       refuse it, then sign it;
     - check the war is really frozen for the duration (assault, weapons,
       heavy, reinforcements refused, fortifying and talking still allowed)
       and that it thaws by itself when the clock runs out;
     - check a ceasefire can never be longer than an hour, and that both
       sides must be at the table;
     - check the reset wipes the book;
     - check the wrapper handles a base function that returns a table or
       nothing at all, not just text.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/ceasefire-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const FILE = "sql/2026-11-02_temporary_ceasefire.sql";

const AUTH = "11111111-1111-1111-1111-111111111111";    /* Freedom Authority */
const COMB = "22222222-2222-2222-2222-222222222222";    /* Combine */
const HOST = AUTH;

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra !== undefined ? "  [" + extra + "]" : "")); }
}

function schema(warDecision) {
    return `
create schema if not exists auth;
create schema if not exists public;

do $do$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $do$;

create or replace function auth.uid() returns uuid language sql stable
as $$ select nullif(current_setting('test.me', true), '')::uuid $$;

create table public.game_control (id int primary key, host_player uuid, started boolean default true);
insert into public.game_control (id, host_player) values (1, '${HOST}');

create table public.players (id uuid primary key, faction text, username text);
insert into public.players values
    ('${AUTH}', 'Freedom Authority', 'President Hale'),
    ('${COMB}', 'Combine', 'Comrade Volkov');

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

create or replace function public.cg_log(p_text text) returns void language sql security definer set search_path to ''
as $$ insert into public.cg_log (text) values (p_text) $$;

create or replace function public.cs_log(p_text text) returns void language sql security definer set search_path to ''
as $$ insert into public.cs_log (text) values (p_text) $$;
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
create table public.planet_diplomacy (planet text, faction text, relation int default 0);
create table public.player_presence (player_id uuid primary key, last_seen timestamptz default now());

/* the game's own war decision, whatever shape it has in the real database */
create table public.war_decision_log (id serial primary key, planet text, faction text, kind text, target text, made_at timestamptz default now());
${warDecision}
`;
}

const WAR_TEXT = `
create or replace function public.war_decision(p_planet text, p_faction text, p_kind text, p_target text default null)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
begin
    insert into public.war_decision_log (planet, faction, kind, target)
    values (p_planet, p_faction, p_kind, p_target);
    return 'Decision accepted: ' || p_kind || ' at ' || p_planet;
end;
$function$;
grant execute on function public.war_decision(text, text, text, text) to authenticated;
`;

const WAR_TABLE = `
create or replace function public.war_decision(p_planet text, p_faction text, p_kind text, p_target text default null)
returns table (accepted boolean, note text)
language plpgsql
security definer
set search_path to ''
as $function$
begin
    insert into public.war_decision_log (planet, faction, kind, target)
    values (p_planet, p_faction, p_kind, p_target);
    return query select true, 'Decision accepted: ' || p_kind;
end;
$function$;
grant execute on function public.war_decision(text, text, text, text) to authenticated;
`;

const WAR_VOID = `
create or replace function public.war_decision(p_planet text, p_faction text, p_kind text, p_target text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
    insert into public.war_decision_log (planet, faction, kind, target)
    values (p_planet, p_faction, p_kind, p_target);
end;
$function$;
grant execute on function public.war_decision(text, text, text, text) to authenticated;
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
        process.exit(1);
    }
    console.log(failures === 0 ? "\nall checks passed" : "\n" + failures + " check(s) failed");
    process.exit(failures === 0 ? 0 : 1);
})();

async function build(warDecision) {
    const db = new PGlite();
    await db.exec(schema(warDecision));
    const sql = fs.readFileSync(path.join(ROOT, FILE), "utf8");
    const parts = sql.split(/\n(?=-- -{5,})/);
    for (const part of parts) {
        try {
            await db.exec(part);
        }
        catch (e) {
            console.log("  patch failed in: " + part.split("\n").find(l => l.trim() && !l.startsWith("--")));
            throw e;
        }
    }
    return db;
}

async function run() {

    /* ---------- the main story, with the game's own text-returning war decision ---------- */

    console.log("the patch runs");
    const db = await build(WAR_TEXT);

    const wrapped = await call(db, "select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
        "where n.nspname = 'public' and p.proname in ('war_decision', 'war_decision_base')");
    check("both the wrapper and the original exist", wrapped[0].n === 2, wrapped[0].n);

    const sig = await call(db, "select pg_get_function_arguments(p.oid) as a, pg_get_function_result(p.oid) as r " +
        "from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'war_decision'");
    check("the wrapper keeps the signature", /p_planet text/.test(sig[0].a) && /p_kind text/.test(sig[0].a), sig[0].a);
    check("and the return type", sig[0].r === "text", sig[0].r);

    console.log("\nthe first offer: the Freedom Authority asks for half an hour");
    await as(db, AUTH);
    let st = (await call(db, "select public.ceasefire_offer(30) as s"))[0].s;
    check("the offer is on the table", st.offer && Number(st.offer.minutes) === 30, JSON.stringify(st.offer));
    check("it is ours", st.offer.mine === true);
    check("the other side has ten minutes to answer", Number(st.offer.seconds) > 580 && Number(st.offer.seconds) <= 600,
        st.offer.seconds);
    check("nothing is frozen yet", Number(st.waiting) === 0 && st.active === null, st.waiting);

    console.log("\nthe offer lapses if nobody answers");
    await db.exec("update public.ceasefires set offered_at = now() - interval '11 minutes'");
    st = (await call(db, "select public.ceasefire_state() as s"))[0].s;
    check("ten minutes of silence takes it off the table", st.offer === null, JSON.stringify(st.offer));
    const lapsed = await call(db, "select status from public.ceasefires order by id desc limit 1");
    check("and the book says so", lapsed[0].status === "expired", lapsed[0].status);

    console.log("\nthe Combine offers, the Authority refuses");
    await as(db, COMB);
    st = (await call(db, "select public.ceasefire_offer(15) as s"))[0].s;
    const offerId = st.offer.id;
    check("the Combine's offer is on the table", st.offer && st.offer.offered_side === "Combine", JSON.stringify(st.offer));

    await as(db, AUTH);
    st = (await call(db, "select public.ceasefire_answer(" + offerId + ", false) as s"))[0].s;
    check("a refusal leaves nobody frozen", st.active === null && Number(st.waiting) === 0);
    check("and the offer is gone", st.offer === null);
    const refused = await call(db, "select status, answered_name from public.ceasefires where id = " + offerId);
    check("the book records who refused", refused[0].status === "refused" && refused[0].answered_name === "President Hale",
        JSON.stringify(refused[0]));

    console.log("\nonly the other side may answer, and only within the rules");
    await as(db, AUTH);
    const own = (await call(db, "select public.ceasefire_offer(20) as s"))[0].s;
    const errSelf = await expectError(db, "select public.ceasefire_answer(" + own.offer.id + ", true)");
    check("you cannot sign your own offer", /other side must answer/.test(String(errSelf)), errSelf);

    const errLong = await expectError(db, "select public.ceasefire_offer(61)");
    check("an hour is the ceiling — never a peace", /never suspended for good/.test(String(errLong)), errLong);
    const errShort = await expectError(db, "select public.ceasefire_offer(4)");
    check("and a quarter of an hour is not offered either", /never suspended for good/.test(String(errShort)), errShort);

    console.log("\nthe Combine signs for twenty minutes");
    await as(db, COMB);
    st = (await call(db, "select public.ceasefire_answer(" + own.offer.id + ", true) as s"))[0].s;
    check("the ceasefire is running", st.active !== null && Number(st.active.minutes) === 20, JSON.stringify(st.active));
    check("with the clock the Authority asked for",
        Number(st.active.seconds) > 1180 && Number(st.active.seconds) <= 1200, st.active.seconds);
    check("signed by the Combine", st.active.signed_by === "Comrade Volkov", st.active.signed_by);
    check("and the offer is no longer on the table", st.offer === null);

    console.log("\nthe war really stops");
    const before = await call(db, "select count(*)::int as n from public.war_decision_log");
    for (const kind of ["assault", "weapons", "heavy", "reinforce"]) {
        const e = await expectError(db, "select public.war_decision('Krieg', 'heretics', '" + kind + "', null)");
        check("' " + kind + "' is refused", /front is frozen/.test(String(e)), e);
    }
    const afterBlocked = await call(db, "select count(*)::int as n from public.war_decision_log");
    check("nothing was written to the game while frozen", Number(afterBlocked[0].n) === Number(before[0].n),
        before[0].n + " -> " + afterBlocked[0].n);

    const fortify = await call(db, "select public.war_decision('Krieg', 'heretics', 'fortify', 'oros') as r");
    check("fortifying is defensive and still allowed", /Decision accepted/.test(String(fortify[0].r)), fortify[0].r);
    const talk = await call(db, "select public.war_decision('Krieg', 'heretics', 'chat', null) as r");
    check("and so is talking", /Decision accepted/.test(String(talk[0].r)), talk[0].r);

    console.log("\nno second ceasefire while one runs");
    await as(db, AUTH);
    const errBusy = await expectError(db, "select public.ceasefire_offer(60)");
    check("the table is closed until it ends", /already in force/.test(String(errBusy)), errBusy);

    console.log("\nthe war resumes by itself");
    await db.exec("update public.ceasefires set ends_at = now() - interval '1 second' where status = 'active'");
    check("the clock is what ends it", Number((await call(db, "select public.ceasefire_seconds_left() as s"))[0].s) === 0);
    check("and the guard no longer holds", (await call(db, "select public.ceasefire_active() as a"))[0].a === false);
    const e2 = await expectError(db, "select public.war_decision('Krieg', 'heretics', 'assault', null)");
    check("an assault goes through again", e2 === null, e2);

    await as(db, AUTH);
    st = (await call(db, "select public.ceasefire_state() as s"))[0].s;
    check("the tab finds the book tidy", st.active === null && st.offer === null);
    const expired = await call(db, "select count(*)::int as n from public.ceasefires where status = 'expired'");
    check("the finished ceasefire is marked expired", Number(expired[0].n) === 2, expired[0].n);
    check("a short history is kept for the tab", Array.isArray(st.last) && st.last.length >= 3, JSON.stringify(st.last).slice(0, 120));

    console.log("\nonly the two main factions sit at this table");
    await db.exec("insert into public.players values ('33333333-3333-3333-3333-333333333333', 'Independents', 'Nobody')");
    await as(db, "33333333-3333-3333-3333-333333333333");
    const errNobody = await expectError(db, "select public.ceasefire_offer(30)");
    check("an independent world has no seat", /sit at this table/.test(String(errNobody)), errNobody);

    console.log("\nthe reset wipes the book");
    await as(db, COMB);
    const errHost = await expectError(db, "select public.game_reset_extras()");
    check("only the host resets", /Only the host/.test(String(errHost)), errHost);

    await as(db, AUTH);
    await call(db, "select public.game_reset_extras()");
    check("the ceasefires are gone", Number((await call(db, "select count(*)::int as n from public.ceasefires"))[0].n) === 0);
    check("and nothing is frozen", (await call(db, "select public.ceasefire_active() as a"))[0].a === false);

    console.log("\nthe reset is the only thing that takes a ceasefire away early");
    await as(db, AUTH);
    await call(db, "select public.ceasefire_offer(10)");
    const id = (await call(db, "select id from public.ceasefires order by id desc limit 1"))[0].id;
    await as(db, COMB);
    await call(db, "select public.ceasefire_answer(" + id + ", true)");
    check("a ten minute ceasefire runs", (await call(db, "select public.ceasefire_active() as a"))[0].a === true);
    const errSign = await expectError(db, "select public.ceasefire_extend(1)");
    check("there is no extension key to turn it permanent", errSign !== null, errSign);

    console.log("\nwho may use any of this");
    const acl = await call(db, "select has_function_privilege('authenticated', 'public.ceasefire_offer(integer)', 'execute') as auth_ok, " +
        "has_function_privilege('authenticated', 'public.war_decision(text,text,text,text)', 'execute') as war_ok");
    check("signed-in players may offer", acl[0].auth_ok === true);
    check("and may still call the war decisions", acl[0].war_ok === true);

    console.log("\nrunning the patch again is harmless");
    await db.exec(fs.readFileSync(path.join(ROOT, FILE), "utf8"));
    const again = await call(db, "select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
        "where n.nspname = 'public' and p.proname = 'war_decision_base'");
    check("one original, one wrapper", again[0].n === 1, again[0].n);
    check("the ceasefire in force survived the re-run",
        (await call(db, "select public.ceasefire_active() as a"))[0].a === true);

    /* ---------- the wrapper must not care what the base returns ---------- */

    console.log("\na base function that returns a table");
    const db2 = await build(WAR_TABLE);
    await as(db2, AUTH);
    await call(db2, "select public.ceasefire_offer(10)");
    const id2 = (await call(db2, "select id from public.ceasefires order by id desc limit 1"))[0].id;
    await as(db2, COMB);
    await call(db2, "select public.ceasefire_answer(" + id2 + ", true)");
    const blocked2 = await expectError(db2, "select * from public.war_decision('Krieg', 'heretics', 'assault', null)");
    check("it is frozen just the same", /front is frozen/.test(String(blocked2)), blocked2);
    await db2.exec("update public.ceasefires set ends_at = now() - interval '1 second'");
    const rows2 = await call(db2, "select * from public.war_decision('Krieg', 'heretics', 'assault', null)");
    check("and the table comes back when it thaws", rows2.length === 1 && rows2[0].accepted === true,
        JSON.stringify(rows2));

    console.log("\na base function that returns nothing");
    const db3 = await build(WAR_VOID);
    await as(db3, AUTH);
    await call(db3, "select public.ceasefire_offer(10)");
    const id3 = (await call(db3, "select id from public.ceasefires order by id desc limit 1"))[0].id;
    await as(db3, COMB);
    await call(db3, "select public.ceasefire_answer(" + id3 + ", true)");
    const blocked3 = await expectError(db3, "select public.war_decision('Krieg', 'heretics', 'assault', null)");
    check("it is frozen just the same", /front is frozen/.test(String(blocked3)), blocked3);
    await db3.exec("update public.ceasefires set ends_at = now() - interval '1 second'");
    const voidCall = await expectError(db3, "select public.war_decision('Krieg', 'heretics', 'fortify', null)");
    check("and calls go through when it thaws", voidCall === null, voidCall);
    check("the base really ran", Number((await call(db3, "select count(*)::int as n from public.war_decision_log"))[0].n) === 1);

    console.log("\na database with no war_decision at all");
    const db4 = new PGlite();
    await db4.exec(schema("/* none */"));
    await db4.exec(fs.readFileSync(path.join(ROOT, FILE), "utf8"));
    await as(db4, AUTH);
    const st4 = (await call(db4, "select public.ceasefire_offer(20) as s"))[0].s;
    check("the ceasefire still works, only the freeze is missing", st4.offer !== null, JSON.stringify(st4.offer));
}
