/* Run sql/2026-10-27_debate_sides.sql against a real PostgreSQL (PGlite, the
   WASM build) with a stand-in for the game's existing tables, then exercise
   the debate and the vote.

   This does not prove the file matches the real Supabase schema (the base
   stage15 tables are not in this repository); it proves the SQL is valid, the
   functions run, and passing a bill costs nothing.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/debate-sql-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const SQL = fs.readFileSync(path.join(ROOT, "sql/2026-10-27_debate_sides.sql"), "utf8");

let failures = 0;
function check(name, cond, extra) {
    if (cond) { console.log("  ok   " + name); }
    else { failures++; console.log("  FAIL " + name + (extra !== undefined ? "  [" + extra + "]" : "")); }
}

/* the tables the file expects to find, trimmed to what it actually reads */
const SCHEMA = `
create schema if not exists auth;
create schema if not exists public;
create schema if not exists extensions;

create or replace function auth.uid() returns uuid language sql stable
as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;

create table public.game_control (id int primary key, started boolean default true);
insert into public.game_control (id, started) values (1, true);

create or replace function public.game_frozen() returns boolean language sql stable
as $$ select false $$;

create table public.fleets (id serial primary key, faction text, name text);

create table public.cg_factions (
    id int primary key, key text, name text, color text, seats int default 0,
    loyalty numeric default 50, alignment_x numeric default 0, alignment_y numeric default 0,
    description text, credits numeric default 5000
);

/* the old vote took the treasury: if anything calls this, the test fails loudly */
create or replace function public.collect_faction_income() returns void language plpgsql
as $$ begin raise exception 'a bill charged the treasury'; end $$;

create table public.cg_members (
    id serial primary key, name text, faction_id int references public.cg_factions (id),
    region text, area int, seat int, loyalty numeric default 60, active boolean default true,
    corruption_level int default 0, bribes_received int default 0, is_corrupted boolean default false,
    alignment_x numeric default 0, alignment_y numeric default 0, planet text, bribe_exposure numeric default 0.05
);

create table public.cg_proposals (
    id serial primary key, ptype text, title text, status text default 'introduction',
    sponsor_faction_id int, source text default 'player', proposer text default 'tester',
    cost int default 0, planet text, fleet_id text, target text,
    yes_votes int default 0, no_votes int default 0, abstain_votes int default 0, required_votes int,
    debate_at timestamptz default now(), vote_at timestamptz default now() + interval '5 minutes',
    created_at timestamptz default now(), resolved_at timestamptz, result jsonb
);

create table public.cg_bribes (
    id serial primary key, proposal_id int references public.cg_proposals (id) on delete cascade,
    member_id int references public.cg_members (id), amount numeric, stance text, created_at timestamptz default now()
);

create table public.cg_scandals (
    id serial primary key, member_id int, member_name text, proposal_id int, scandal_type text,
    evidence_strength numeric, is_exposed boolean default false, exposed_at timestamptz, replacement_name text
);

create table public.cg_votes (
    id serial primary key, proposal_id int, member_id int, vote text, was_bribed boolean,
    likelihood numeric, created_at timestamptz default now()
);

create table public.cg_log (id serial primary key, at timestamptz default now(), text text);

create table public.cg_state (
    id int primary key, popularity numeric default 55, fa_online_at timestamptz default now(),
    tax_level int default 1, relations jsonb default '{}'::jsonb
);

create or replace function public.cg_log(p_text text) returns void language sql
as $$ insert into public.cg_log (text) values (p_text) $$;

/* the real one scores a delegate from their faction, loyalty and the bill */
create or replace function public.cg_likelihood(p_faction int, p_loyalty numeric, p_sponsor int, p_ptype text, p_popularity numeric)
returns numeric language sql immutable
as $$ select 50::numeric $$;

create or replace function public.cg_execute(p_id int) returns text language sql
as $$ select 'efeito aplicado'::text $$;

create or replace function public.cg_replace_member(p_id int) returns text language sql
as $$ select 'Delegado Novo'::text $$;
`;

(async function main() {

    const db = new PGlite();

    console.log("a stand-in for the game's tables");
    await db.exec(SCHEMA);
    await db.exec(`
        insert into public.cg_factions (id, key, name) values
            (1, 'old_guard', 'The Old Guard'), (2, 'greens', 'The Greens'),
            (3, 'progressives', 'Progressives'), (4, 'independents', 'Independents');
        insert into public.cg_state (id) values (1);
        insert into public.fleets (faction, name) select 'Combine', 'x' from generate_series(1, 20);
        /* 176 delegates: 40 / 36 / 50 / 50 */
        insert into public.cg_members (name, faction_id, region, area, seat)
        select 'Delegate ' || g, f, 'Região ' || (g % 4), g % 12, g
        from generate_series(1, 176) as g,
             lateral (select case when g <= 40 then 1 when g <= 76 then 2 when g <= 126 then 3 else 4 end as f) as x;
    `);
    const members = await db.query("select count(*)::int as n from public.cg_members where active");
    check("176 delegates are seated", members.rows[0].n === 176, members.rows[0].n);

    console.log("the migration runs");
    let ran = true;
    try { await db.exec(SQL); }
    catch (e) { ran = false; console.log("  " + String(e.message || e).slice(0, 900)); }
    check("2026-10-27_debate_sides.sql runs without error", ran);

    if (!ran) { process.exit(1); }

    const tables = await db.query(`
        select table_name from information_schema.tables
        where table_schema = 'public' and table_name like 'cg_debate%' order by table_name`);
    check("the three debate tables exist", tables.rows.length === 3, tables.rows.map(r => r.table_name).join(","));

    console.log("a bill cannot carry a price");
    const inserted = await db.query(`
        insert into public.cg_proposals (ptype, title, sponsor_faction_id, cost, required_votes)
        values ('fleet_construction', 'Autorizar a construção de uma nova frota', 3, 2000, 118)
        returning id, cost`);
    check("a bill written with 2000 comes back with cost 0", Number(inserted.rows[0].cost) === 0, inserted.rows[0].cost);
    const firstId = inserted.rows[0].id;

    const updated = await db.query(`update public.cg_proposals set cost = 1500 where id = ${firstId} returning cost`);
    check("and a later update cannot put a price back", Number(updated.rows[0].cost) === 0, updated.rows[0].cost);

    console.log("the debate seeds a side for every delegate");
    const firstView = await db.query("select public.cg_debate_tick()");
    check("cg_debate_tick runs", firstView !== null);

    let view = (await db.query("select public.cg_debate_view() as v")).rows[0].v;
    check("cg_debate_view returns the live bill", view.proposals.length === 1, JSON.stringify(view).slice(0, 200));
    const seeded = view.proposals[0];
    check("every delegate took a side", seeded.yes + seeded.no + seeded.undecided === 176,
        seeded.yes + seeded.no + seeded.undecided);
    check("the Authority owns no fleet, so the bill is unanimous",
        seeded.yes === 176 && seeded.no === 0 && seeded.undecided === 0,
        JSON.stringify({ yes: seeded.yes, no: seeded.no, und: seeded.undecided }));
    check("the chamber is painted per faction",
        Object.keys(seeded.factions).length === 4, Object.keys(seeded.factions).join(","));

    /* the throttle: a second call inside 15 seconds does nothing */
    const sidesBefore = JSON.stringify(seeded.sides);
    await db.query("select public.cg_debate_tick()");
    view = (await db.query("select public.cg_debate_view() as v")).rows[0].v;
    check("a second tick within 15 seconds changes nothing",
        JSON.stringify(view.proposals[0].sides) === sidesBefore);

    console.log("the opening fleet bill never drifts");
    for (let i = 0; i < 5; i++) {
        await db.query("update public.cg_debate_state set last_at = now() - interval '1 minute' where id = 1");
        await db.query("select public.cg_debate_tick()");
    }
    view = (await db.query("select public.cg_debate_view() as v")).rows[0].v;
    check("still unanimous after five movements",
        view.proposals[0].yes === 176, JSON.stringify(view.proposals[0]).slice(0, 160));

    const beforeTreasury = (await db.query("select sum(credits)::numeric as c from public.cg_factions")).rows[0];
    const beforePopularity = (await db.query("select popularity::numeric as p from public.cg_state where id = 1")).rows[0].p;
    const resolved = (await db.query(`select public.cg_resolve(${firstId}) as r`)).rows[0].r;
    check("the first fleet bill passes", resolved.status === "passed", JSON.stringify(resolved));

    const afterTreasury = (await db.query("select sum(credits)::numeric as c from public.cg_factions")).rows[0].c;
    check("passing a bill costs the treasury nothing", Number(afterTreasury) === Number(beforeTreasury.c),
        beforeTreasury.c + " -> " + afterTreasury);
    const afterPopularity = (await db.query("select popularity::numeric as p from public.cg_state where id = 1")).rows[0].p;
    check("the vote only moves the Authority's standing", Number(afterPopularity) > Number(beforePopularity),
        beforePopularity + " -> " + afterPopularity);
    const afterRow = (await db.query(`select cost, status, result from public.cg_proposals where id = ${firstId}`)).rows[0];
    check("the bill stays free after the vote", Number(afterRow.cost) === 0, afterRow.cost);
    check("the vote is recorded, not the forecast", afterRow.status === "passed" && Number(resolved.yes) === 176, JSON.stringify(resolved));
    const sidesLeft = await db.query("select count(*)::int as n from public.cg_debate_sides");
    check("the sides are cleared once the bill is decided", sidesLeft.rows[0].n === 0, sidesLeft.rows[0].n);

    console.log("a chamber with fleets moves on its own");
    await db.exec(`
        insert into public.fleets (faction, name) select 'Freedom Authority', 'Frota ' || g from generate_series(1, 5) as g;
        insert into public.cg_proposals (ptype, title, sponsor_faction_id, cost, required_votes)
        values ('fleet_construction', 'Segunda frota', 3, 2000, 118);
    `);
    const secondId = (await db.query("select id from public.cg_proposals where title = 'Segunda frota'")).rows[0].id;

    /* the tick is throttled to one movement every 15 seconds: wind the clock
       back between calls, as the screen does over a real debate */
    async function tick() {
        await db.query("update public.cg_debate_state set last_at = now() - interval '1 minute' where id = 1");
        await db.query("select public.cg_debate_tick()");
        return (await db.query("select public.cg_debate_view() as v")).rows[0].v;
    }

    view = await tick();
    const live = view.proposals.find(p => p.id === secondId);
    check("the bill starts split, not unanimous",
        live.yes + live.no + live.undecided === 176 && live.no + live.undecided > 0,
        JSON.stringify({ yes: live.yes, no: live.no, und: live.undecided }));

    const sidesSeeded = JSON.stringify(live.sides);
    let moved = false;
    for (let i = 0; i < 6 && !moved; i++) {
        const now = await tick();
        if (JSON.stringify(now.proposals.find(p => p.id === secondId).sides) !== sidesSeeded) { moved = true; }
    }
    check("delegates change sides as the debate goes on", moved);

    const changed = await db.query("select count(*)::int as n from public.cg_debate_sides where changes > 0");
    check("and the record of the change is kept", changed.rows[0].n > 0, changed.rows[0].n);

    const flippedBothWays = await db.query(`
        select count(*) filter (where s.side = 'yes')::int as yes,
               count(*) filter (where s.side = 'no')::int as no
        from public.cg_debate_sides as s where s.proposal_id = ${secondId}`);
    check("both sides are represented", flippedBothWays.rows[0].yes > 0 && flippedBothWays.rows[0].no > 0,
        JSON.stringify(flippedBothWays.rows[0]));

    console.log("crossing the line is news, once");
    await db.query(`update public.cg_debate_sides set side = 'no' where proposal_id = ${secondId}`);
    await tick();
    const lostLogs = await db.query("select count(*)::int as n from public.cg_log where text like 'DEBATE%'");
    await db.query(`update public.cg_debate_sides set side = 'yes' where proposal_id = ${secondId}`);
    await tick();
    const wonLogs = await db.query("select text from public.cg_log where text like 'DEBATE%'");
    check("a bill that comes back is written down", wonLogs.rows.length > lostLogs.rows[0].n,
        wonLogs.rows.map(r => r.text.slice(0, 60)).join(" | "));
    check("in Portuguese, with the tally",
        wonLogs.rows.some(r => /^DEBATE: a câmara volta-se a favor de ".+": [0-9]+ de [0-9]+ votos prometidos\.$/.test(r.text)),
        wonLogs.rows.map(r => r.text.slice(0, 80)).join(" | "));
    await tick();
    const afterQuiet = await db.query("select count(*)::int as n from public.cg_log where text like 'DEBATE%'");
    check("and only once", afterQuiet.rows[0].n === wonLogs.rows.length, afterQuiet.rows[0].n);

    /* a bribe still beats the debate */
    const voter = (await db.query("select member_id from public.cg_debate_sides where side = 'no' limit 1")).rows[0];
    await db.query(`insert into public.cg_bribes (proposal_id, member_id, amount, stance) values (${secondId}, ${voter.member_id}, 100000, 'yes')`);
    const bribed = (await db.query(`select public.cg_resolve(${secondId}) as r`)).rows[0].r;
    const voted = (await db.query(`select vote, was_bribed from public.cg_votes where proposal_id = ${secondId} and member_id = ${voter.member_id}`)).rows[0];
    check("a bought delegate votes as bought", voted.was_bribed === true && voted.vote === "yes", JSON.stringify(voted));
    check("the bill is decided either way", ["passed", "rejected"].includes(bribed.status), JSON.stringify(bribed));
    check("no bill can end in NO FUNDS any more", bribed.status !== "failed_funds");

    const logs = await db.query("select text from public.cg_log order by id");
    check("the verdict is logged", logs.rows.some(r => /^(PASSED|REJECTED): /.test(r.text)),
        logs.rows.map(r => r.text.slice(0, 40)).join(" | "));

    console.log("\n" + (failures ? failures + " check(s) failed" : "all checks passed"));
    await db.close();
    process.exit(failures ? 1 : 0);

})();
