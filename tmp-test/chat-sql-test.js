/* The airwaves: global, team and private chat.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/chat-sql-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PATCH = fs.readFileSync(path.join(ROOT, "sql/2026-11-53_the_airwaves.sql"), "utf8");

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

create table public.player_presence (player_id uuid primary key, last_seen timestamptz);
insert into public.player_presence values ('${B}', now()), ('${D}', now() - interval '2 hours');

create or replace function public.as_user(p uuid) returns void language sql as
$$ select set_config('gf.test_uid', p::text, false) $$;
`;

/* auth.uid() reads a setting, so one connection can be several commanders */
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
    try {
        const r = await one(db, "select public.chat_send($1, $2, $3) as r", [channel, body, to || null]);
        return { data: r.r };
    }
    catch (error) { return { error: String(error.message || error) }; }
}

async function fetch(db, channel, withWhom, after) {
    const r = await one(db, "select public.chat_fetch($1, $2, $3) as r", [channel, withWhom || null, after || 0]);
    return r.r;
}

(async function main() {

    try {

        const db = new PGlite();
        await db.exec(SCHEMA);
        await db.exec(LOGIN);
        await db.exec(PATCH);
        await db.exec(PATCH);

        console.log("\n== global");

        const said = await send(db, "global", "  Good evening, galaxy  ");

        ok("a message goes out", !!said.data && said.data.body === "Good evening, galaxy", said);
        ok("under the name of its sender", said.data && said.data.name === "Aureo", said.data && said.data.name);

        ok("nobody else reads an empty channel first", (await fetch(db, "global")).messages.length === 1);

        await login(db, B);
        ok("another commander hears it", (await fetch(db, "global")).messages[0].body === "Good evening, galaxy");

        console.log("\n== team");

        await send(db, "team", "The Party is watching");
        await login(db, A);
        const freedom = await fetch(db, "team");
        ok("the other side does not hear the team channel", freedom.messages.length === 0,
            freedom.messages.map(m => m.body));

        await login(db, C);
        const combine = await fetch(db, "team");
        ok("a comrade does", combine.messages.length === 1 && combine.messages[0].body === "The Party is watching",
            combine.messages.map(m => m.body));

        console.log("\n== private");

        await login(db, A);
        const whisper = await send(db, "private", "Meet me at Vraks", B);
        ok("a whisper goes to one commander", !!whisper.data && whisper.data.to === B, whisper);

        ok("and only to that one", (await fetch(db, "private", B)).messages.length === 1);

        await login(db, C);
        ok("a third commander sees nothing of it", (await fetch(db, "private", A)).messages.length === 0 &&
            (await fetch(db, "private", B)).messages.length === 0);

        await login(db, B);
        const heard = await fetch(db, "private", A);
        ok("the commander it was meant for reads it", heard.messages.length === 1 &&
            heard.messages[0].body === "Meet me at Vraks");

        await send(db, "private", "Vraks it is", A);
        await login(db, A);
        ok("and the answer comes back in the same thread",
            (await fetch(db, "private", B)).messages.length === 2);

        console.log("\n== what is refused");

        await login(db, A);
        ok("an empty message is refused", /Write something first/.test(String((await send(db, "global", "   ")).error)));
        ok("an unknown channel is refused", /Unknown channel/.test(String((await send(db, "rumours", "psst")).error)));
        ok("a whisper to nobody is refused", /Choose who to write to/.test(String((await send(db, "private", "hello")).error)));
        ok("a whisper to yourself is refused",
            /cannot whisper to yourself/.test(String((await send(db, "private", "hello", A)).error)));
        ok("a whisper to a stranger is refused",
            /Nobody of that name/.test(String((await send(db, "private", "hello", "99999999-9999-4999-8999-999999999999")).error)));

        const long = await send(db, "global", "x".repeat(600));
        ok("a long message is cut at 400 characters", long.data && long.data.body.length === 400,
            long.data && long.data.body.length);

        console.log("\n== the rate limit");

        /* a commander who has not spoken yet, so the count starts at zero */
        await login(db, D);

        const sent = [];
        for (let i = 0; i < 8; i++) { sent.push(await send(db, "global", "message " + i)); }

        ok("six in half a minute are allowed",
            sent.slice(0, 6).every(r => !!r.data), sent.map(r => !!r.data));
        ok("and the seventh is told to wait",
            /wait a moment/.test(String(sent[6].error)), sent[6].error);

        console.log("\n== catching up");

        const all = await fetch(db, "global");
        const last = all.messages[all.messages.length - 1].id;
        ok("nothing new is nothing", (await fetch(db, "global", null, last)).messages.length === 0);

        await login(db, B);
        await send(db, "global", "still here");
        const newer = await fetch(db, "global", null, last);
        ok("a new message arrives on its own", newer.messages.length === 1 && newer.messages[0].body === "still here");

        console.log("\n== the roster");

        await login(db, A);
        const people = (await one(db, "select public.chat_people() as r")).r.people;

        ok("everybody but me is on it", people.length === 3 &&
            people.every(p => p.id !== A), people.map(p => p.name));
        ok("with the names they play under", people.map(p => p.name).sort().join(",") === "Boris,Cato,Dana",
            people.map(p => p.name));
        ok("and who is at the table right now",
            people.find(p => p.id === B).online === true && people.find(p => p.id === D).online === false,
            people.map(p => [p.name, p.online]));

        ok("the table is closed to direct reads",
            (await one(db, "select relrowsecurity as r from pg_class where oid = 'public.chat_messages'::regclass")).r === true);

        await db.close();

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.stack || error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}());
