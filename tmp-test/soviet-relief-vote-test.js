/* The Soviet votes on relief now.

   The Combine used to steady a world with a button: cs_relief added +10
   stability straight away, once every five minutes, and the Party did the
   same on its own. Congress never worked that way — the Authority's relief
   was a bill. Relief is now a directive for the Combine too, and the button
   only files it.

   Run: NODE_PATH=/tmp/tools/node_modules node tmp-test/soviet-relief-vote-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PATCH = fs.readFileSync(path.join(ROOT, "sql/2026-11-50_the_soviet_votes_on_relief.sql"), "utf8");
const COMBINE = fs.readFileSync(path.join(ROOT, "combine.html"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

const ME = "11111111-1111-4111-8111-111111111111";
const OUTSIDER = "33333333-3333-4333-8333-333333333333";

const SCHEMA = `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
as $$ select '${ME}'::uuid $$;

create table public.players (id uuid primary key, faction text);
insert into public.players (id, faction) values
    ('${ME}', 'Combine'),
    ('${OUTSIDER}', 'Independents');

create table public.game_control (id int primary key, started boolean);
insert into public.game_control (id, started) values (1, true);

create table public.cs_state (
    id int primary key, quota int default 0, confidence int default 50,
    secretary_player uuid, secretary_current int, last_npc_at timestamptz);
insert into public.cs_state (id) values (1);

create table public.cs_currents (id int primary key, key text, name text, priorities text[]);
insert into public.cs_currents (id, key, name, priorities) values
    (1, 'apparatus', 'Aparato do Partido', array['consolidation']),
    (2, 'army', 'Exército Vermelho', array['fleet_construction']),
    (3, 'militia', 'Milícia', array['military_campaign']);

create table public.cs_membership (player_id uuid primary key, current_id int);
insert into public.cs_membership (player_id, current_id) values ('${ME}', 1);

create table public.cs_directives (
    id serial primary key, dtype text, title text, sponsor_current int, source text,
    proposer_name text, proposer_player uuid, planet text, fleet_id text, target_faction text,
    status text default 'introduction', debate_at timestamptz default now() + interval '3 minutes',
    vote_at timestamptz default now() + interval '8 minutes',
    yes_votes int default 0, no_votes int default 0, abstain_votes int default 0,
    required_votes int default 1, result text, created_at timestamptz default now());

create table public.cs_occupations (
    planet text primary key, stage int default 0, stability int default 30,
    progress int default 0, last_turn_at timestamptz, last_relief_at timestamptz);

insert into public.cs_occupations (planet, stage, stability) values
    ('Krieg', 0, 40),
    ('Vraks', 1, 10),
    ('Done', 3, 100);

create table public.cs_authorizations (id serial primary key, kind text, planet text, player_id uuid);
create table public.fleets (id uuid primary key default gen_random_uuid(), name text, faction text, player_id uuid, status text default 'ready');
create table public.planets (id int primary key, name text);
insert into public.planets (id, name) values (1, 'Krieg'), (2, 'Vraks'), (3, 'Done');
create table public.cities (id serial primary key, planet_id int, faction text);
insert into public.cities (planet_id, faction) values (1, 'Combine'), (2, 'Combine'), (2, 'Freedom Authority');

create or replace function public.cs_log(p_text text) returns void language sql as $$ select $$;
create or replace function public.cs_player_name(p_player uuid) returns text language sql as $$ select 'Comrade' $$;
create or replace function public.cs_player_online(p_player uuid) returns boolean language sql as $$ select true $$;
create or replace function public.cs_occupation_threshold(p_stage int) returns integer language sql immutable
as $$ select case when coalesce(p_stage,0) <= 0 then 30 when p_stage = 1 then 40 when p_stage = 2 then 50 else 100 end $$;
`;

async function one(db, sql, params) {
    const r = await db.query(sql, params);
    return r.rows[0] || {};
}

async function submit(db, type, planet) {
    try {
        const r = await one(db, "select public.cs_submit($1, $2, null, null, null) as id", [type, planet]);
        return { id: r.id };
    }
    catch (error) { return { error: String(error.message || error) }; }
}

(async function main() {

    try {

        const db = new PGlite();
        await db.exec(SCHEMA);
        await db.exec(PATCH);
        await db.exec(PATCH);

        console.log("\n== the button that sent it straight is closed");

        let straight = null;
        try { await db.exec("select public.cs_relief('Krieg')"); }
        catch (error) { straight = String(error.message || error); }

        ok("cs_relief refuses and names the directive",
            !!straight && /Relief is a directive now/.test(straight) && /Ajuda económica a Krieg/.test(straight), straight);
        ok("and it changed nothing",
            (await one(db, "select stability from public.cs_occupations where planet = 'Krieg'")).stability === 40);

        console.log("\n== relief goes before the Soviet");

        const filed = await submit(db, "consolidation", "Krieg");

        ok("a commander may file it", !!filed.id, filed);

        const d = await one(db, "select * from public.cs_directives where id = $1", [filed.id]);

        ok("it is titled in the Soviet's own words", d.title === "Ajuda económica a Krieg", d.title);
        ok("it is in the plenum, not applied", d.status === "introduction");
        ok("it is signed by a current", d.sponsor_current === 1, d.sponsor_current);
        ok("the world still has the stability it had", 
            (await one(db, "select stability from public.cs_occupations where planet = 'Krieg'")).stability === 40);

        ok("a second relief for the same world waits its turn",
            /already before the Soviet/.test(String((await submit(db, "consolidation", "Krieg")).error)),
            (await submit(db, "consolidation", "Krieg")).error);

        ok("another world may be helped at the same time", !!(await submit(db, "consolidation", "Vraks")).id);

        ok("a world that is not under administration is refused",
            /not under Combine administration/.test(String((await submit(db, "consolidation", "Done")).error)));
        ok("a world that is already incorporated is refused the same way",
            /not under Combine administration/.test(String((await submit(db, "consolidation", "Nowhere")).error)));
        ok("a directive with no world named is refused",
            /Choose the world that needs relief/.test(String((await submit(db, "consolidation", null)).error)));
        ok("and the type had to be known at all",
            /Unknown directive/.test(String((await submit(db, "bribes", "Krieg")).error)));

        console.log("\n== only the Combine sits in the Soviet");

        await db.exec(`create or replace function auth.uid() returns uuid language sql stable as $$ select '${OUTSIDER}'::uuid $$`);
        ok("somebody else is sent away",
            /Only Combine players sit in the Supreme Soviet/.test(String((await submit(db, "consolidation", "Krieg")).error)));
        await db.exec(`create or replace function auth.uid() returns uuid language sql stable as $$ select '${ME}'::uuid $$`);

        console.log("\n== the Party files relief instead of sending it");

        /* a stalled world, and the Party left alone with the plenum */
        await db.exec("update public.cs_occupations set stability = 10 where planet = 'Vraks'");
        await db.exec("delete from public.cs_directives");

        let filedByParty = false;
        let steadied = false;

        for (let attempt = 0; attempt < 200 && !filedByParty; attempt++) {

            await db.exec("update public.cs_state set last_npc_at = now() - interval '10 minutes'");
            await db.exec("delete from public.cs_directives");
            await db.exec("select public.cs_npc_directive()");

            const relief = await one(db,
                "select count(*)::int as n from public.cs_directives where dtype = 'consolidation' and source = 'npc'");

            filedByParty = relief.n > 0;

            if ((await one(db, "select stability from public.cs_occupations where planet = 'Vraks'")).stability !== 10) {
                steadied = true;
                break;
            }
        }

        ok("the Party puts relief to the vote", filedByParty);
        ok("and never steadies a world on its own", !steadied);
        ok("the world is still waiting",
            (await one(db, "select stability from public.cs_occupations where planet = 'Vraks'")).stability === 10);
        ok("the Party's new function updates no stability at all",
            !/update public\.cs_occupations/i.test(PATCH.slice(PATCH.indexOf("create or replace function public.cs_npc_directive"))));

        await db.close();

        console.log("\n== the Combine's screen files a directive");

        ok("the relief button no longer calls cs_relief", !/rpc\("cs_relief"/.test(COMBINE));
        ok("it files a consolidation directive",
            /rpc\("cs_submit", \{ p_type: "consolidation", p_planet: planet \}\)/.test(COMBINE));
        ok("and the panel says it waits on a vote",
            /PUT RELIEF TO THE SOVIET/.test(COMBINE) && /relief is a directive the Soviet votes on/.test(COMBINE));

        console.log("\n== in Portuguese");

        const words = [
            ["PUT RELIEF TO THE SOVIET (+10 if it passes)", "LEVAR AJUDA AO SOVIETE (+10 se for aprovada)"],
            ["Relief for", "Ajuda para"],
            ["is before the Supreme Soviet: it takes effect if the vote passes.",
                "está perante o Soviete Supremo: produz efeito se a votação passar."]
        ];

        for (const [en, pt] of words) {
            ok('"' + en + '" is translated', I18N.indexOf('"' + en + '":') !== -1 && I18N.indexOf(pt) !== -1);
        }

    } catch (error) {

        fail++;
        console.log("  FAIL the run crashed  -> " + (error.stack || error.message || error));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}());
