/* The two elections held together, and the pair they leave behind.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/elections-sync-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PATCH = fs.readFileSync(path.join(ROOT, "sql/2026-11-55_the_elections_stand_together.sql"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

const A = "11111111-1111-4111-8111-111111111111";   /* Freedom Authority */
const B = "22222222-2222-4222-8222-222222222222";   /* Combine */

/* the Congress's own book, as 2026-11-06 writes it, and the President's,
   which this test only has to read */
const SCHEMA = `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
as $$ select coalesce(nullif(current_setting('gf.test_uid', true), ''), '${A}')::uuid $$;

create table public.players (id uuid primary key, username text, faction text);
insert into public.players values
    ('${A}', 'Aureo', 'Freedom Authority'),
    ('${B}', 'Boris', 'Combine');

create table public.game_control (id integer primary key, started boolean default true,
                                  started_at timestamptz default now());

create table public.cg_state (id integer primary key, president_player uuid, term_no integer default 0,
                              term_end timestamptz);

create table public.cg_speaker_state (id integer primary key, speaker_player uuid, speaker_name text,
                                      speaker_party text, term_no integer default 0, term_end timestamptz,
                                      veto_used boolean default false, last_election_at timestamptz);

create table public.cg_speaker_election (id serial primary key, phase text, campaign_end timestamptz,
                                         vote_end timestamptz, note text, winner_id uuid, winner_name text);

insert into public.game_control (id) values (1);
insert into public.cg_state (id) values (1);
insert into public.cg_speaker_state (id) values (1);

create or replace function public.cg_log(p_text text) returns void language sql as $$ select 1 $$;
create or replace function public.cg_speaker_seed() returns void language sql
as $$ insert into public.cg_speaker_state (id) values (1) on conflict (id) do nothing $$;
create or replace function public.cg_speaker_advance() returns void language sql as $$ select 1 $$;

create or replace function public.cg_speaker_state() returns jsonb language sql stable
as $$
    select jsonb_build_object(
        'speaker', case when s.speaker_player is null then null else jsonb_build_object(
            'name', coalesce(s.speaker_name, ''), 'term_no', s.term_no, 'term_end', s.term_end) end,
        'election', case when e.id is null then null else jsonb_build_object(
            'phase', e.phase, 'campaign_end', e.campaign_end, 'vote_end', e.vote_end) end
    )
    from public.cg_speaker_state as s
    left join lateral (select * from public.cg_speaker_election as x
                       where x.phase <> 'done' order by x.id desc limit 1) as e on true
    where s.id = 1
$$;
`;

async function one(db, sql, params) {
    const r = await db.query(sql, params);
    return r.rows[0] || {};
}

async function login(db, who) {
    await db.query("select set_config('gf.test_uid', $1, false)", [who]);
}

async function follow(db, campaign, vote) {
    const r = await one(db, "select public.cg_speaker_follow($1, $2) as r", [campaign || null, vote || null]);
    return r.r;
}

async function pair(db) {
    const r = await one(db, "select public.cg_elections_pair() as r");
    return r.r;
}

async function races(db) {
    const r = await db.query("select * from public.cg_speaker_election order by id");
    return r.rows;
}

(async function main() {

    try {

        const db = new PGlite();
        await db.exec(SCHEMA);
        await db.exec(PATCH);
        await db.exec(PATCH);

        await login(db, A);

        console.log("\n== the chamber follows the presidential clock");

        await follow(db, null, null);
        ok("with no presidential race on the air, no election is opened", (await races(db)).length === 0);

        const campaign = new Date(Date.now() + 8 * 60000).toISOString();
        const vote = new Date(Date.now() + 16 * 60000).toISOString();

        await follow(db, campaign, vote);
        let rows = await races(db);
        ok("a running presidential race opens the chamber's election", rows.length === 1, rows.length);
        ok("on exactly the same window, campaign",
            new Date(rows[0].campaign_end).getTime() === new Date(campaign).getTime(), rows[0] && rows[0].campaign_end);
        ok("and the same close, so both are decided together",
            new Date(rows[0].vote_end).getTime() === new Date(vote).getTime(), rows[0] && rows[0].vote_end);
        ok("in its campaign phase", rows[0].phase === "campaign", rows[0] && rows[0].phase);

        await follow(db, campaign, vote);
        ok("asking again does not open a second one", (await races(db)).length === 1);

        const later = new Date(Date.now() + 10 * 60000).toISOString();
        const laterVote = new Date(Date.now() + 20 * 60000).toISOString();

        await follow(db, later, laterVote);
        rows = await races(db);
        ok("a different presidential window moves it along", rows.length === 1 &&
            new Date(rows[0].vote_end).getTime() === new Date(laterVote).getTime(), rows[0] && rows[0].vote_end);

        console.log("\n== a chair that is already filled");

        await db.query("update public.cg_speaker_state set speaker_player = $1, speaker_name = 'Aureo', term_no = 1, term_end = now() + interval '10 days'", [A]);
        await login(db, B);
        await follow(db, later, laterVote);
        ok("nobody is unseated because a presidential race starts", (await races(db)).length === 1 && !(await pair(db)).ready);

        console.log("\n== both chairs decided");

        ok("nothing is announced while one chair is empty", (await pair(db)).ready === false);

        await db.query("update public.cg_state set president_player = $1, term_no = 1, term_end = now() + interval '14 days'", [A]);

        await login(db, A);
        let got = await pair(db);
        ok("once both are filled the pair is ready", got.ready === true, got);
        ok("with the President's name", got.president === "Aureo", got.president);
        ok("and the Speaker's", got.speaker === "Aureo", got.speaker);
        ok("a Freedom Authority member is told", got.freedom === true, got.freedom);

        const stamp = got.stamp;
        got = await pair(db);
        ok("the same war keeps the same stamp", String(got.stamp) === String(stamp), [stamp, got.stamp]);

        await login(db, B);
        got = await pair(db);
        ok("a Combine commander is not", got.freedom === false, got.freedom);
        ok("though the pair is the same one", String(got.stamp) === String(stamp));

        console.log("\n== a new war");

        await db.query("update public.cg_state set president_player = $1, term_no = 2", [B]);
        await db.query("update public.cg_speaker_state set speaker_player = $1, speaker_name = 'Boris', term_no = 2", [B]);
        await db.query("update public.game_control set started_at = now() + interval '1 hour'");

        got = await pair(db);
        ok("a fresh war writes a new pair", String(got.stamp) !== String(stamp), [stamp, got.stamp]);
        ok("with the new holders", got.president === "Boris" && got.speaker === "Boris", got);

        const count = (await one(db, "select count(*)::int as n from public.cg_election_pair")).n;
        ok("one row per war, no more", count === 2, count);

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.stack || error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

}());
