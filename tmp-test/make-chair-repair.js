/* The rescue patch is not written by hand: it is cut out of 2026-11-15, so the
   two can never say different things. Run this, then commit the output.

   Run: node tmp-test/make-chair-repair.js */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "sql", "2026-11-15_committees_and_ministers.sql");
const OUT = path.join(ROOT, "sql", "2026-11-19_the_committee_chairs_repaired.sql");

const src = fs.readFileSync(SRC, "utf8");

function between(from, to) {
    const a = src.indexOf(from);
    if (a === -1) { throw new Error("start not found: " + from); }
    const b = src.indexOf(to, a);
    if (b === -1) { throw new Error("end not found: " + to); }
    return src.slice(a, b).trim() + "\n";
}

const chairs = between(
    "create or replace function public.cg_party_seats",
    "create or replace function public.cs_commit"
);

const government = between(
    "create or replace function public.cg_government",
    "create or replace function public.cs_government"
);

/* the book the committees sit in: without it cg_commit steps aside and the
   tab would go quiet instead of showing three empty committees */
const tables = `-- ---------------------------------------------------------
-- the table the three committees sit in
-- ---------------------------------------------------------

create table if not exists public.cg_committees (
    kind text primary key,
    chair_id integer references public.cg_factions (id),
    last_report_term integer,
    last_report_at timestamptz
);

alter table public.cg_committees enable row level security;


`;

/* the ministry posts themselves: the tab lists a vacant chair, it does not
   hide the ministry until somebody is named to it */
const ministries = `-- ---------------------------------------------------------
-- the three ministries exist before anybody holds them
-- ---------------------------------------------------------

create table if not exists public.cg_ministers (
    post text primary key,
    player_id uuid,
    name text,
    party_id integer,
    appointed_at timestamptz not null default now(),
    term_no integer,
    last_power_term integer,
    last_power_at timestamptz
);

alter table public.cg_ministers enable row level security;

insert into public.cg_ministers (post) values ('war'), ('treasury'), ('interior')
on conflict (post) do nothing;


`;

const header = `-- =========================================================
-- GALACTIC FRONT — the committee chairs, repaired in place
--
-- Run this ONLY if the COMMITTEES tab in the Congress still
-- says "column f.seats does not exist" after
-- 2026-11-15_committees_and_ministers.sql has been run. That
-- message means the earlier version of these same functions is
-- what the database holds — usually because a long file was
-- pasted and only part of it applied.
--
-- This installs the three functions the tab needs and nothing
-- else, cut word for word out of 2026-11-15:
--
--   cg_party_seats()   counts a party's seats from its delegates
--   cg_commit()        seats the three committees on that count
--   cg_government()    the Congress's committees-and-ministers screen
--
-- It is short enough to paste whole, safe to run any number of
-- times, and changes no data. Reload the page afterwards.
--
-- Check it took with:
--   select proname, prosrc like '%cg_party_seats%' as fixed
--   from pg_proc where proname in ('cg_commit', 'cg_government');
--
-- Both rows must read true.
-- =========================================================


`;

if (chairs.includes("f.seats") || government.includes("f.seats")) {
    throw new Error("the slice still reads f.seats — 2026-11-15 is not the fixed one");
}

const body = header + tables + ministries + chairs + "\n\n" + government;

fs.writeFileSync(OUT, body);

console.log("written " + path.basename(OUT) +
    " (" + body.split("\n").length + " lines)");
