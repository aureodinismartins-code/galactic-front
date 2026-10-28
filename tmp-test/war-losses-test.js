/* Run the 2026-11-01 patch against a real PostgreSQL (PGlite, the WASM build)
   with a stand-in for war_factions, and check that:

     - the broken reading is kept as get_war_losses_legacy, not thrown away;
     - the new get_war_losses reports the table's own figures and nothing
       below zero, for every party of the planet;
     - a party already holding a negative loss comes back as zero;
     - the guard stops a negative loss or rate from being written again;
     - only signed-in players may call the reading;
     - running the patch twice is harmless.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/war-losses-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const FILE = "sql/2026-11-01_war_losses_never_negative.sql";

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

/* war_factions, as the game keeps it: positive counters, one row per party */
create table public.war_factions (
    planet text not null,
    id text not null,
    name text not null,
    color text,
    losses bigint not null default 0,
    loss_rate numeric not null default 0,
    loss_at timestamptz,
    primary key (planet, id)
);

/* the last tick was days ago, which is what turned the old reading negative */
insert into public.war_factions (planet, id, name, losses, loss_rate, loss_at) values
    ('Krieg', 'free_republic',      'Free Krieg Republic',       14405,    3.18, now() - interval '7 days'),
    ('Krieg', 'liberation_army',    'Liberation Army of Krieg',   8290,    2.24, now() - interval '7 days'),
    ('Krieg', 'heretics',           'Heretics',                   9484,    5.83, now() - interval '7 days'),
    ('Krieg', 'national_government','Krieg National Government', 13503,    5.04, now() - interval '7 days'),
    ('Krieg', 'mutants',            'Mutants',                   13756,    3.73, now() - interval '7 days'),
    ('Krieg', 'broken',             'A party the tick mangled',   -900,   -1.5,  now() - interval '7 days'),
    ('Vraks', 'vraks_loyalists',    'Vraks Loyalists',            2200,    1.10, now() - interval '7 days'),
    ('Ultramars', 'loyalists',      'Ultramars Loyalists',        100,     0.50, now() - interval '7 days');

/* the broken reading, which fell by the rate for every second that passed */
create or replace function public.get_war_losses(p_planet text)
returns table (faction_id text, current_losses bigint, loss_rate numeric, server_now timestamptz)
language sql
security definer
set search_path to ''
as $function$
    select w.id,
           w.losses - round(w.loss_rate * extract(epoch from (now() - coalesce(w.loss_at, now()))))::bigint,
           w.loss_rate,
           now()
    from public.war_factions as w
    where w.planet = p_planet
$function$;
`;

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

async function run() {

    const db = new PGlite();
    await db.exec(SCHEMA);

    console.log("the reading before the patch is negative");
    const before = (await db.query(
        "select current_losses from public.get_war_losses('Krieg') where faction_id = 'free_republic'")).rows[0];
    check("it really is the bug the player saw", Number(before.current_losses) < 0, before.current_losses);

    console.log("\nthe patch runs");
    const sql = fs.readFileSync(path.join(ROOT, FILE), "utf8");
    await db.exec(sql);

    console.log("\nthe old reading is kept, under another name");
    const legacy = (await db.query(
        "select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
        "where n.nspname = 'public' and p.proname = 'get_war_losses_legacy'")).rows[0];
    check("get_war_losses_legacy exists", legacy.n === 1, legacy.n);
    const legacyArgs = (await db.query(
        "select pg_get_function_arguments(p.oid) as a from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
        "where n.nspname = 'public' and p.proname = 'get_war_losses_legacy'")).rows[0];
    check("and it still takes the planet", /p_planet text/.test(legacyArgs.a), legacyArgs.a);

    console.log("\nthe new reading");
    const krieg = (await db.query(
        "select faction_id, current_losses, loss_rate, server_now from public.get_war_losses('Krieg') order by faction_id")).rows;
    check("every party of the planet is there", krieg.length === 6, krieg.length);
    const free = krieg.find(r => r.faction_id === "free_republic");
    check("the stored losses are reported as they are", Number(free.current_losses) === 14405, free.current_losses);
    check("the rate comes through", Number(free.loss_rate) === 3.18, free.loss_rate);
    check("with the server's clock", free.server_now instanceof Date || !!Date.parse(free.server_now), free.server_now);
    check("no party is reported below zero", krieg.every(r => Number(r.current_losses) >= 0),
        krieg.map(r => r.current_losses).join(","));
    check("a party the tick had mangled reads zero", Number(krieg.find(r => r.faction_id === "broken").current_losses) === 0,
        krieg.find(r => r.faction_id === "broken").current_losses);
    check("and its rate is zero rather than negative", Number(krieg.find(r => r.faction_id === "broken").loss_rate) === 0,
        krieg.find(r => r.faction_id === "broken").loss_rate);
    const vraks = (await db.query("select count(*)::int as n from public.get_war_losses('Vraks')")).rows[0];
    check("Vraks reads its own parties", vraks.n === 1, vraks.n);
    const nowhere = (await db.query("select count(*)::int as n from public.get_war_losses('Nowhere')")).rows[0];
    check("an unknown planet is simply empty", nowhere.n === 0, nowhere.n);

    console.log("\nthe stored columns were cleaned as well");
    const cleaned = (await db.query(
        "select losses, loss_rate from public.war_factions where planet = 'Krieg' and id = 'broken'")).rows[0];
    check("the negative loss was brought back to zero", Number(cleaned.losses) === 0, cleaned.losses);
    check("and so was the negative rate", Number(cleaned.loss_rate) === 0, cleaned.loss_rate);
    check("the healthy parties were left alone",
        Number((await db.query("select losses from public.war_factions where id = 'heretics'")).rows[0].losses) === 9484);

    console.log("\nthe guard");
    await db.exec("update public.war_factions set losses = -50, loss_rate = -2 where id = 'mutants'");
    const guarded = (await db.query("select losses, loss_rate from public.war_factions where id = 'mutants'")).rows[0];
    check("a negative write is refused at the table", Number(guarded.losses) === 0 && Number(guarded.loss_rate) === 0,
        guarded.losses + " / " + guarded.loss_rate);
    await db.exec("update public.war_factions set losses = 500, loss_rate = 2.5 where id = 'mutants'");
    check("a normal write still goes through",
        Number((await db.query("select losses from public.war_factions where id = 'mutants'")).rows[0].losses) === 500);
    check("the reading follows it", Number((await db.query(
        "select current_losses from public.get_war_losses('Krieg') where faction_id = 'mutants'")).rows[0].current_losses) === 500);

    console.log("\nwho may read it");
    const acl = (await db.query(
        "select has_function_privilege('authenticated', 'public.get_war_losses(text)', 'execute') as auth_ok, " +
        "has_function_privilege('anon', 'public.get_war_losses(text)', 'execute') as anon_ok")).rows[0];
    check("signed-in players may", acl.auth_ok === true);
    check("the wider public may not", acl.anon_ok === false, acl.anon_ok);

    console.log("\nrunning it again is harmless");
    await db.exec(sql);
    const again = (await db.query(
        "select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace " +
        "where n.nspname = 'public' and p.proname in ('get_war_losses', 'get_war_losses_legacy')")).rows[0];
    check("still one reading and one legacy copy", again.n === 2, again.n);
    check("the figure is unchanged", Number((await db.query(
        "select current_losses from public.get_war_losses('Krieg') where faction_id = 'free_republic'")).rows[0].current_losses) === 14405);
}
