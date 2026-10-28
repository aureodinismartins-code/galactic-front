/* The live failure: the database holds the earlier committee functions, so the
   Congress tab answers "column f.seats does not exist". This builds that state
   from the real patch files (every helper the tab needs, but not the fixed
   chairs), then applies the rescue patch and reads the tab.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/chair-repair-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const AUTH = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

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

async function expectError(db, sql) {
    try { await db.query(sql); return ""; }
    catch (e) { return String((e && e.message) || e); }
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
    const repair = fs.readFileSync(path.join(ROOT, "sql", "2026-11-19_the_committee_chairs_repaired.sql"), "utf8");

    const db = new PGlite();

    await db.exec(`
        create schema if not exists auth;

        /* as the patch's own session: the player is the seated one */
        create or replace function auth.uid()
        returns uuid language sql stable
        as $$ select '${AUTH}'::uuid $$;

        create table public.players (id uuid primary key, username text, faction text);
        insert into public.players values
            ('${AUTH}', 'Hale', 'Freedom Authority'),
            ('${OTHER}', 'Vega', 'Freedom Authority');

        create table public.cg_state (
            id int primary key,
            president_player uuid,
            term_no int default 0
        );
        insert into public.cg_state (id, president_player, term_no) values (1, '${AUTH}', 3);

        /* the party book as the live game has it: no seat column at all */
        create table public.cg_factions (
            id int primary key, key text, name text, color text,
            loyalty numeric default 50, description text
        );
        insert into public.cg_factions (id, key, name, color) values
            (1, 'militarists', 'The Militarists', '#c0272d'),
            (2, 'reformers', 'The Reformers', '#c08a2e');

        create table public.cg_members (
            id serial primary key, name text, faction_id int references public.cg_factions (id),
            region text, area int, seat int, loyalty numeric default 60, active boolean default true,
            player_id uuid, party text
        );

        create table public.cg_proposals (
            id serial primary key, title text, ptype text, status text default 'debate',
            sponsor_faction_id int, planet text, vote_at timestamptz default now()
        );

        create table public.cg_occupations (
            id serial primary key, planet text unique, stage int default 0, stability numeric default 55
        );

        /* the committee tables reference the Soviet's currents as well: the two
           chambers' books are created together in the patch */
        create table public.cs_currents (
            id int primary key, key text, name text, color text,
            seats int default 0, loyalty numeric default 55
        );

        create table public.cg_ministers (
            post text primary key, player_id uuid, name text,
            last_power_term int, last_power_at timestamptz
        );

        /* what the base game gives the chamber */
        create or replace function public.cg_log(p_text text)
        returns void language sql security definer set search_path to ''
        as $$ select null::void $$;

        create or replace function public.cg_player_party(p_player uuid)
        returns text language sql stable security definer set search_path to ''
        as $$ select m.party from public.cg_members as m where m.player_id = p_player limit 1 $$;
    `);

    /* every helper the tab uses, taken from the real patch — but NOT the chairs:
       this is the half-applied database the player is looking at */
    await db.exec(slice(patch,
        "create table if not exists public.cg_committees",
        "create or replace function public.cg_party_seats"));

    await db.exec(slice(patch,
        "create or replace function public.committee_wait_seconds",
        "create or replace function public.cg_committee_report"));

    await db.exec(slice(patch,
        "create or replace function public.minister_posts",
        "create or replace function public.cg_appoint_minister"));

    console.log("\nthe database as it is now: the earlier chair");

    /* the old functions read a column that does not exist */
    await db.exec(`
        create or replace function public.cg_commit()
        returns void language plpgsql security definer set search_path to ''
        as $$ declare v integer; begin
             select f.id into v from public.cg_factions as f
             where coalesce(f.seats, 0) > 0 order by f.seats desc limit 1;
           end $$;
    `);

    const broken = await expectError(db, "select public.cg_commit()");
    check("the old chair cannot be seated", /f\.seats|seats does not exist/i.test(broken), broken);

    console.log("\nthe five delegates that decide it");

    await db.exec("insert into public.cg_members (name, faction_id, region, area, seat, loyalty, active, party, player_id) values " +
        "('Hale', 1, 'West', 1, 1, 70, true, 'militarists', '" + AUTH + "'), " +
        "('Ana', 1, 'West', 1, 2, 60, true, 'militarists', null), " +
        "('Beto', 1, 'Rim', 2, 3, 60, true, 'militarists', null), " +
        "('Célia', 1, 'Rim', 2, 4, 60, true, 'militarists', null), " +
        "('Duarte', 2, 'Core', 3, 5, 60, true, 'reformers', null)");

    console.log("\nthe repair patch, applied as the player would paste it");

    await db.exec(repair);

    const seats = (await call(db, "select public.cg_party_seats(1) as n"))[0].n;
    check("seats are counted from the delegates", Number(seats) === 4, seats);

    const gov = (await call(db, "select public.cg_government() as g"))[0].g;

    check("the tab can be built at all", !!gov && Array.isArray(gov.committees), JSON.stringify(gov && gov.committees));
    check("three committees are seated", (gov.committees || []).length === 3,
        JSON.stringify((gov.committees || []).map(c => c.kind)));
    check("all chaired by the party with the most delegates",
        (gov.committees || []).every(c => Number(c.chair) === 1),
        JSON.stringify((gov.committees || []).map(c => c.chair)));
    check("the chair's seats are the delegate count",
        (gov.committees || []).every(c => Number(c.chair_seats) === 4),
        JSON.stringify((gov.committees || []).map(c => c.chair_seats)));
    check("the player sits in the chairing party",
        (gov.committees || []).every(c => c.mine === true),
        JSON.stringify((gov.committees || []).map(c => c.mine)));
    check("the chairing party is named", (gov.committees || [])[0].chair_name === "The Militarists",
        (gov.committees || [])[0].chair_name);
    check("and the ministries are on the same screen", Array.isArray(gov.ministers) && gov.ministers.length === 3,
        JSON.stringify(gov.ministers && gov.ministers.length));
    check("each ministry is named, not just keyed",
        (gov.ministers || []).every(m => /Minist/.test(String(m.name))),
        JSON.stringify((gov.ministers || []).map(m => m.name)));
    /* this rescue file restores the 2026-11-15 reading, which predates the
       chamber-staffed ministries: what matters here is that nothing comes back
       as a null flag, whatever 2026-11-20 later makes of the posts */
    check("no ministry comes back with a null in it",
        (gov.ministers || []).every(m => typeof m.mine === "boolean" && m.wait === 0),
        JSON.stringify(gov.ministers));

    console.log("\nand it stays fixed");

    await db.exec(repair);

    const again = (await call(db, "select public.cg_government() as g"))[0].g;
    check("running it twice changes nothing", (again.committees || []).length === 3 &&
        (again.committees || []).every(c => Number(c.chair) === 1));

    /* the header quotes the error message on purpose; what must never appear
       is the old column in a statement */
    const statements = repair.split("\n")
        .filter(line => !/^\s*--/.test(line))
        .join("\n");
    check("the repair patch never reads the old column", !/f\.seats/.test(statements));

    console.log("\n" + passed + " passed, " + failed + " failed");

    if (failed) { process.exit(1); }

})();
