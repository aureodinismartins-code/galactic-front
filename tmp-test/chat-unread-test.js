/* What arrived while the panel was shut.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/chat-unread-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PATCH = fs.readFileSync(path.join(ROOT, "sql/2026-11-53_the_airwaves.sql"), "utf8");
const UNREAD = fs.readFileSync(path.join(ROOT, "sql/2026-11-54_the_airwaves_unread.sql"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

const A = "11111111-1111-4111-8111-111111111111";   /* Freedom */
const B = "22222222-2222-4222-8222-222222222222";   /* Combine */
const C = "33333333-3333-4333-8333-333333333333";   /* Combine */
const D = "44444444-4444-4444-8444-444444444444";   /* Freedom */

const SCHEMA = `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
as $$ select '${A}'::uuid $$;

create table public.players (id uuid primary key, username text, faction text);
insert into public.players (id, username, faction) values
    ('${A}', 'Aureo', 'Freedom Authority'),
    ('${B}', 'Boris', 'Combine'),
    ('${C}', 'Cato', 'Combine'),
    ('${D}', 'Dana', 'Freedom Authority');
`;

const LOGIN = `
create or replace function auth.uid() returns uuid language sql stable
as $$ select coalesce(nullif(current_setting('gf.test_uid', true), ''), '${A}')::uuid $$;
`;

async function one(db, sql, params) {
    const r = await db.query(sql, params);
    return r.rows[0] || {};
}

async function login(db, who) {
    await db.query("select set_config('gf.test_uid', $1, false)", [who]);
}

async function send(db, channel, body, to) {
    const r = await one(db, "select public.chat_send($1, $2, $3) as r", [channel, body, to || null]);
    return r.r;
}

async function unread(db, seen) {
    const r = await one(db, "select public.chat_unread($1::jsonb) as r", [JSON.stringify(seen || {})]);
    return r.r || {};
}

(async function main() {

    try {

        const db = new PGlite();
        await db.exec(SCHEMA);
        await db.exec(LOGIN);
        await db.exec(PATCH);
        await db.exec(UNREAD);
        await db.exec(UNREAD);

        console.log("\n== global");

        await login(db, A);
        ok("an empty war has nothing to report", (await unread(db, {})).total === 0);

        await send(db, "global", "Good evening, galaxy");
        ok("your own words are never news", (await unread(db, {})).total === 0);

        await login(db, B);
        const said = await send(db, "global", "Evening, Aureo");

        await login(db, A);
        let u = await unread(db, {});
        ok("somebody else's message is one new", u.global === 1 && u.total === 1, u);
        ok("and the newest id is offered to mark it read", Number(u.latest.global) === Number(said.id), u.latest);

        u = await unread(db, { global: said.id });
        ok("once it has been drawn the count goes", u.total === 0, u);
        ok("and the mark keeps its place", Number(u.latest.global) >= Number(said.id), u.latest);

        u = await unread(db, { global: "lots" });
        ok("a mark that is not a number counts as nothing read", u.global === 1, u);

        console.log("\n== team");

        await login(db, B);
        const team = await send(db, "team", "The Party is watching");

        await login(db, A);
        u = await unread(db, {});
        ok("another side's team traffic is not yours to read", u.team === 0, u);

        await login(db, B);
        ok("your own words on the team channel are never news",
            (await unread(db, {})).team === 0);

        await login(db, C);
        u = await unread(db, {});
        ok("your own side's traffic is", u.team === 1, u);
        u = await unread(db, { team: team.id });
        ok("and clears when it has been drawn", u.team === 0, u);

        console.log("\n== private");

        await login(db, B);
        const whisper = await send(db, "private", "Meet me at Vraks", A);

        await login(db, A);
        u = await unread(db, {});
        ok("a whisper is one new", u.private === 1, u);
        ok("filed under the commander who sent it",
            Number(u.latest.private[B]) === Number(whisper.id), u.latest.private);

        u = await unread(db, { private: { [B]: whisper.id } });
        ok("and clears when that thread has been drawn", u.private === 0, u);

        ok("a thread with nothing new is still known",
            Number((await unread(db, {})).latest.private[B]) === Number(whisper.id));

        await login(db, C);
        u = await unread(db, {});
        ok("nobody else's whisper reaches a third commander", u.private === 0, u);

        console.log("\n== everything together");

        await login(db, A);
        const second = await send(db, "global", "Anything else?");
        u = await unread(db, { global: said.id, private: { [B]: whisper.id } });
        ok("the total adds the channels up", u.total === 0 && u.global === 0, u);

        await login(db, B);
        const third = await send(db, "global", "Not a word");
        await login(db, A);
        u = await unread(db, { global: said.id, private: { [B]: whisper.id } });
        ok("one more message on the air is one more new", u.total === 1, u);

        await login(db, D);
        ok("a commander who has said nothing sees the same traffic",
            (await unread(db, {})).global >= 1);

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.stack || error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

}());
