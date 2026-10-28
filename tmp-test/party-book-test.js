/* The live failure: 2026-11-20 reads cg_factions.loyalty, the Congress's party
   book never had that column, and the committees tab answered "column
   f.loyalty does not exist". This builds that database, proves it fails, then
   applies 2026-11-22 and builds the tab.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/party-book-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const ME = "11111111-1111-1111-1111-111111111111";

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
    if (ok) { passed++; console.log("  ok   " + name); }
    else { failed++; console.log("  FAIL " + name + (detail !== undefined ? "  :: " + detail : "")); }
}

async function call(db, sql) {
    const r = await db.query(sql);
    return r.rows;
}

function slice(src, from, to) {
    const a = src.indexOf(from);
    if (a === -1) { throw new Error("start not found: " + from); }
    const b = src.indexOf(to, a);
    if (b === -1) { throw new Error("end not found: " + to); }
    return src.slice(a, b);
}

(async function main() {

    const patch = fs.readFileSync(path.join(ROOT, "sql", "2026-11-15_committees_and_ministers.sql"), "utf8");
    const next = fs.readFileSync(path.join(ROOT, "sql", "2026-11-20_the_ministries_belong_to_the_chamber.sql"), "utf8");
    const book = fs.readFileSync(path.join(ROOT, "sql", "2026-11-22_the_party_book_has_a_loyalty.sql"), "utf8");

    const db = new PGlite();

    await db.exec(`
        create schema if not exists auth;

        create or replace function auth.uid()
        returns uuid language sql stable
        as $$ select '${ME}'::uuid $$;

        create table public.game_control (id int primary key, host_player uuid);
        insert into public.game_control values (1, '${ME}');

        create table public.players (id uuid primary key, username text, faction text);
        insert into public.players values ('${ME}', 'Hale', 'Freedom Authority');

        create table public.cg_state (
            id int primary key, popularity numeric default 60, president_player uuid,
            term_no integer default 1, term_end timestamptz
        );
        insert into public.cg_state (id, president_player) values (1, '${ME}');

        /* the party book exactly as the live game has it: no loyalty at all */
        create table public.cg_factions (
            id int primary key, key text, name text, color text, description text
        );
        insert into public.cg_factions (id, key, name, color) values
            (1, 'militarists', 'The Militarists', '#c0272d'),
            (2, 'reformers', 'The Reformers', '#c08a2e');

        create table public.cg_members (
            id serial primary key, name text, faction_id int references public.cg_factions (id),
            region text, area int, seat int, loyalty numeric default 60,
            active boolean default true, player_id uuid, party text
        );

        create table public.cg_proposals (
            id serial primary key, title text, ptype text, status text default 'debate',
            sponsor_faction_id int, planet text, vote_at timestamptz default now()
        );

        create table public.cg_occupations (
            id serial primary key, planet text unique, stage int default 0,
            stability int default 55, progress int default 0
        );

        create table public.cg_authorizations (
            id serial primary key, kind text, player_id uuid, planet text,
            used boolean default false, used_at timestamptz
        );

        create table public.faction_treasury (faction text primary key, credits bigint default 5000);
        insert into public.faction_treasury values ('Freedom Authority', 5000);

        create table public.cs_currents (
            id integer primary key, key text, name text, color text,
            seats integer default 0, loyalty numeric default 55
        );

        /* the Soviet's books, because the slices below also create its
           helpers and those read them */
        create table public.cs_state (
            id integer primary key, confidence numeric default 55, secretary_player uuid,
            secretary_name text, secretary_current integer, term_no integer default 1,
            term_end timestamptz, veto_used boolean default false
        );
        insert into public.cs_state (id) values (1);

        create table public.cs_commissars (
            id serial primary key, name text, current_id integer, oblast text, seat integer,
            loyalty numeric default 55, active boolean default true,
            is_disgraced boolean default false
        );

        create table public.cs_membership (player_id uuid primary key, current_id integer);

        create table public.cs_directives (
            id serial primary key, title text, dtype text, status text default 'debate',
            sponsor_current integer, vote_at timestamptz default now()
        );

        create table public.cs_occupations (
            planet text primary key, stage integer default 0, stability integer default 40,
            progress integer default 0, last_turn_at timestamptz
        );

        create table public.cs_authorizations (
            id serial primary key, kind text, player_id uuid, planet text,
            used boolean default false, used_at timestamptz
        );

        /* the two ministry tables, as 2026-11-15 creates them */
        create table public.cg_ministers (
            post text primary key, player_id uuid, name text, party_id integer,
            appointed_at timestamptz not null default now(), term_no integer,
            last_power_term integer, last_power_at timestamptz
        );

        create table public.cs_ministers (
            post text primary key, player_id uuid, name text, current_id integer,
            appointed_at timestamptz not null default now(), term_no integer,
            last_power_term integer, last_power_at timestamptz
        );

        create or replace function public.cg_log(p_text text)
        returns void language sql security definer set search_path to ''
        as $$ select null::void $$;

        create or replace function public.cg_player_party(p_player uuid)
        returns text language sql stable security definer set search_path to ''
        as $$ select m.party from public.cg_members as m where m.player_id = p_player limit 1 $$;
    `);

    await db.exec(slice(patch,
        "create table if not exists public.cg_committees",
        "create or replace function public.cg_party_seats"));

    await db.exec(slice(patch,
        "create or replace function public.cg_party_seats",
        "create or replace function public.cs_commit"));

    /* the committee timer sits before the ministry tables and after cs_commit:
       it needs its own cut */
    await db.exec(slice(patch,
        "create or replace function public.committee_wait_seconds",
        "create or replace function public.cg_committee_report"));

    /* everything the tab calls, cut in one go: the ministry tables (already
       here, so IF NOT EXISTS skips them), the committee timers, the names and
       the appoint calls — stopping before cg_government, which 2026-11-20
       replaces */
    await db.exec(slice(patch,
        "create table if not exists public.cg_ministers",
        "create or replace function public.cg_government"));

    await db.exec(next);

    /* the picker's list of delegates is added by 2026-11-21, which wraps the
       reading rather than replacing it */
    await db.exec(fs.readFileSync(path.join(ROOT, "sql",
        "2026-11-21_capitals_are_never_occupied_and_the_commander_picks.sql"), "utf8"));

    await db.exec("insert into public.cg_members (name, faction_id, region, area, seat, loyalty, party, player_id) values " +
        "('Hale', 1, 'West', 1, 1, 60, 'militarists', '" + ME + "'), " +
        "('Ana', 1, 'West', 1, 2, 72, 'militarists', null), " +
        "('Beto', 1, 'Rim', 2, 3, 90, 'militarists', null), " +
        "('Eva', 2, 'Core', 3, 4, 58, 'reformers', null)");

    console.log("\nthe failure as it happened");

    let err = "";
    try { await db.query("select public.cg_government()"); }
    catch (e) { err = String(e.message); }

    check("the tab dies on the party book's missing column", /loyalty does not exist/i.test(err), err);

    console.log("\n2026-11-22 adds it");

    await db.exec(book);

    const cols = (await call(db, "select column_name from information_schema.columns " +
        "where table_schema = 'public' and table_name = 'cg_factions' and column_name = 'loyalty'"))[0];
    check("the party book has a loyalty now", !!cols, JSON.stringify(cols));

    const loy = await call(db, "select id, loyalty from public.cg_factions order by id");
    check("every party starts at 55, the figure the ministries assume",
        loy.every(r => Number(r.loyalty) === 55), JSON.stringify(loy));

    const gov = (await call(db, "select public.cg_government() as g"))[0].g;

    check("the tab can be built at all", !!gov && Array.isArray(gov.committees), JSON.stringify(gov && gov.committees));
    check("the party's standing reaches the card", (gov.ministers || []).every(m => Number(m.party_loyalty) === 55),
        JSON.stringify((gov.ministers || []).map(m => m.party_loyalty)));
    check("the ministries are seated", (gov.ministers || []).every(m => !!m.holder),
        JSON.stringify((gov.ministers || []).map(m => m.holder)));
    check("by the governing party's most loyal delegate", (gov.ministers || []).every(m => m.holder === "Beto"),
        JSON.stringify((gov.ministers || []).map(m => m.holder)));
    check("and the chamber is listed for the President to pick from", (gov.delegates || []).length === 4,
        JSON.stringify((gov.delegates || []).map(d => d.name)));

    console.log("\nrunning it again changes nothing");

    await db.exec(book);
    const again = (await call(db, "select public.cg_government() as g"))[0].g;
    check("still three ministries, still seated", (again.ministers || []).length === 3 &&
        (again.ministers || []).every(m => !!m.holder));

    console.log("\nand the screen names the right file");

    const congress = fs.readFileSync(path.join(ROOT, "congress.html"), "utf8");
    const combine = fs.readFileSync(path.join(ROOT, "combine.html"), "utf8");

    check("the Congress tab sends a missing column to 2026-11-22",
        /loyalty does not exist/.test(congress) &&
        /2026-11-22_the_party_book_has_a_loyalty\.sql/.test(congress));
    check("and so does the Combine's",
        /loyalty does not exist/.test(combine) &&
        /2026-11-22_the_party_book_has_a_loyalty\.sql/.test(combine));

    console.log("\n" + passed + " passed, " + failed + " failed");

    if (failed) { process.exit(1); }

})();
