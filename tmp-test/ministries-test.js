/* The ministries belong to the chamber (2026-11-20): each one is held by the
   most loyal member of the governing party, the holder acts on his own once a
   term, the effect is scaled by his loyalty and his party's standing, and an
   election lifts the winner's party while it pulls the others down.

   The game's base tables live outside this repository, so they are stood in
   for here; the chamber's own books are the real ones the patch creates.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/ministries-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const ME = "11111111-1111-1111-1111-111111111111";
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

    const db = new PGlite();

    await db.exec(`
        create schema if not exists auth;

        create or replace function auth.uid()
        returns uuid language sql stable
        as $$ select '${ME}'::uuid $$;

        create table public.game_control (id int primary key, host_player uuid);
        insert into public.game_control values (1, '${ME}');

        create table public.players (id uuid primary key, username text, faction text);
        insert into public.players values
            ('${ME}', 'Hale', 'Freedom Authority'),
            ('${OTHER}', 'Volkov', 'Combine');

        create table public.cg_state (
            id int primary key, popularity numeric default 60, president_player uuid,
            term_no integer default 1, term_end timestamptz
        );
        insert into public.cg_state (id) values (1);

        create table public.cg_speaker_state (
            id int primary key, speaker_player uuid, speaker_name text, speaker_party text,
            term_no integer default 0, term_end timestamptz, veto_used boolean default false
        );
        insert into public.cg_speaker_state (id) values (1);

        create table public.cg_factions (
            id int primary key, key text, name text, color text,
            loyalty numeric default 55, description text
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
            id serial primary key, planet text unique, stage int default 0, stability int default 55,
            progress int default 0
        );

        create table public.cg_authorizations (
            id serial primary key, kind text, player_id uuid, planet text,
            used boolean default false, used_at timestamptz
        );

        create table public.faction_treasury (
            faction text primary key, credits bigint default 5000
        );
        insert into public.faction_treasury (faction, credits) values
            ('Freedom Authority', 5000), ('Combine', 5000);

        create or replace function public.cg_log(p_text text)
        returns void language sql security definer set search_path to ''
        as $$ select null::void $$;

        create or replace function public.cs_log(p_text text)
        returns void language sql security definer set search_path to ''
        as $$ select null::void $$;

        create or replace function public.cg_player_party(p_player uuid)
        returns text language sql stable security definer set search_path to ''
        as $$ select m.party from public.cg_members as m where m.player_id = p_player limit 1 $$;

        /* ---- the Soviet's own books, as the Combine patches leave them ---- */

        create table public.cs_currents (
            id integer primary key, key text, name text, color text,
            seats integer default 0, loyalty numeric default 55
        );
        insert into public.cs_currents (id, key, name, color, seats, loyalty) values
            (1, 'proletarian', 'Vanguarda Proletária', '#c0272d', 42, 60),
            (2, 'apparatus', 'Aparato do Partido', '#c08a2e', 33, 50);

        create table public.cs_state (
            id integer primary key, confidence numeric default 55, secretary_player uuid,
            secretary_name text, secretary_current integer, term_no integer default 1,
            term_end timestamptz, veto_used boolean default false
        );
        insert into public.cs_state (id) values (1);

        create table public.cs_commissars (
            id serial primary key, name text, current_id integer references public.cs_currents (id),
            oblast text, seat integer, loyalty numeric default 55,
            active boolean default true, is_disgraced boolean default false
        );

        create table public.cs_membership (
            player_id uuid primary key, current_id integer references public.cs_currents (id)
        );

        create table public.cs_directives (
            id serial primary key, title text, dtype text, status text default 'debate',
            sponsor_current integer, vote_at timestamptz default now()
        );

        create table public.cs_occupations (
            planet text primary key, stage integer default 0, stability integer default 40,
            progress integer default 0
        );

        create table public.cs_authorizations (
            id serial primary key, kind text, player_id uuid, planet text,
            used boolean default false, used_at timestamptz
        );
    `);

    /* the chamber's own books, from the real patch */
    await db.exec(slice(patch,
        "create table if not exists public.cg_committees",
        "create or replace function public.cg_party_seats"));

    await db.exec(slice(patch,
        "create or replace function public.cg_party_seats",
        "create or replace function public.cs_commit"));

    await db.exec(slice(patch,
        "create or replace function public.cs_commit",
        "create or replace function public.cg_government"));

    await db.exec(next);

    console.log("\nthe chamber seats its own ministries");

    /* the Militarists hold four seats, the Reformers two: the governing party
       is the Militarists, and its most loyal delegate is Duarte */
    await db.exec("insert into public.cg_members (name, faction_id, region, area, seat, loyalty, party, player_id) values " +
        "('Hale', 1, 'West', 1, 1, 60, 'militarists', '" + ME + "'), " +
        "('Ana', 1, 'West', 1, 2, 72, 'militarists', null), " +
        "('Beto', 1, 'Rim', 2, 3, 90, 'militarists', null), " +
        "('Célia', 1, 'Rim', 2, 4, 66, 'militarists', null), " +
        "('Duarte', 2, 'Core', 3, 5, 95, 'reformers', null), " +
        "('Eva', 2, 'Core', 3, 6, 58, 'reformers', null)");

    await db.exec("insert into public.cg_occupations (planet, stage, stability) values ('Krieg', 1, 40)");
    await db.exec("update public.cg_state set term_no = 1, popularity = 60 where id = 1");

    const credits0 = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);

    let gov = (await call(db, "select public.cg_government() as g"))[0].g;

    check("three ministries come back", (gov.ministers || []).length === 3,
        JSON.stringify((gov.ministers || []).map(m => m.post)));

    check("each is held by a delegate, never by a player",
        (gov.ministers || []).every(m => !!m.holder && m.mine === false),
        JSON.stringify((gov.ministers || []).map(m => [m.post, m.holder])));

    check("the governing party hands them out", (gov.ministers || []).every(m => Number(m.party) === 1),
        JSON.stringify((gov.ministers || []).map(m => m.party)));

    check("and the most loyal delegate of it holds each one",
        (gov.ministers || []).every(m => m.holder === "Beto"),
        JSON.stringify((gov.ministers || []).map(m => [m.holder, m.loyalty])));

    check("the party is named and coloured on the card",
        (gov.ministers || []).every(m => m.party_name === "The Militarists" && !!m.party_color));

    console.log("\nand they act on their own, once a term");

    check("all three acted without anybody pressing anything",
        (gov.ministers || []).every(m => m.acted === true),
        JSON.stringify((gov.ministers || []).map(m => m.acted)));

    const kinds = (gov.ministers || []).map(m => m.effect && m.effect.kind).sort().join(",");
    check("a fleet, a levy and a relief", kinds === "fleet,levy,relief", kinds);

    const authorisations = Number((await call(db,
        "select count(*)::int as n from public.cg_authorizations where kind = 'fleet'"))[0].n);
    check("the war ministry put a fleet on the book with no bill", authorisations === 1, authorisations);

    const levy = (gov.ministers || []).find(m => m.post === "treasury").effect;
    const credits1 = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);

    /* Beto's loyalty is 90 and his party governs, so the factor is
       (0.5 + 0.90) * 1.10 = 1.54 and the levy is 462 to 770 */
    check("a loyal holder of the governing party levies half as much again",
        Number(levy.credits) >= 462 && Number(levy.credits) <= 770, JSON.stringify(levy));
    check("and never the full base range, because the factor scales it",
        Number(levy.credits) > 500, JSON.stringify(levy));
    check("and the treasury actually received it", credits1 === credits0 + Number(levy.credits),
        credits0 + " -> " + credits1);

    const popularity = Number((await call(db, "select popularity from public.cg_state where id = 1"))[0].popularity);
    check("the people were told, and are angrier", popularity === 57, popularity);

    const relief = (gov.ministers || []).find(m => m.post === "interior").effect;
    check("relief went to the least settled world we administer",
        relief.planet === "Krieg" && Number(relief.stability) > 40, JSON.stringify(relief));

    console.log("\na second look in the same term changes nothing");

    const again = (await call(db, "select public.cg_government() as g"))[0].g;
    const credits2 = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);
    const auth2 = Number((await call(db, "select count(*)::int as n from public.cg_authorizations where kind = 'fleet'"))[0].n);

    check("no second levy", credits2 === credits1, credits1 + " -> " + credits2);
    check("no second fleet", auth2 === 1, auth2);
    check("and the card still shows what was done",
        (again.ministers || []).every(m => m.effect && m.effect.kind));

    console.log("\na new term: they act again, scaled by loyalty and party");

    await db.exec("update public.cg_state set term_no = 2 where id = 1");
    const third = (await call(db, "select public.cg_government() as g"))[0].g;
    const auth3 = Number((await call(db, "select count(*)::int as n from public.cg_authorizations where kind = 'fleet'"))[0].n);

    check("the new term has its own fleet", auth3 === 2, auth3);

    const levy3 = (third.ministers || []).find(m => m.post === "treasury").effect;
    check("a levy again", levy3 && levy3.kind === "levy", JSON.stringify(levy3));

    /* what the treasury holds after this term's levy: the term that follows
       must add nothing to it */
    const credits3 = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);

    const faith = (third.ministers || []).find(m => m.post === "war");
    check("the loyalty and the party are on the card, for the player to read the odds",
        Number(faith.loyalty) === 90 && Number(faith.party_loyalty) === 55,
        JSON.stringify([faith.loyalty, faith.party_loyalty]));

    console.log("\na party in disgrace is not served");

    await db.exec("update public.cg_state set term_no = 3 where id = 1");
    await db.exec("update public.cg_factions set loyalty = 10 where id = 1");

    const sullen = (await call(db, "select public.cg_government() as g"))[0].g;
    check("nothing at all is done this term",
        (sullen.ministers || []).every(m => m.effect && m.effect.kind === "idle" && m.effect.reason === "party"),
        JSON.stringify((sullen.ministers || []).map(m => m.effect)));

    const credits4 = Number((await call(db, "select credits from public.faction_treasury where faction = 'Freedom Authority'"))[0].credits);
    check("and no credits are taken quietly anyway", credits4 === credits3, credits3 + " -> " + credits4);

    console.log("\nenvy: an election lifts the winner's party and pulls the others down");

    await db.exec("update public.cg_factions set loyalty = 55 where id in (1, 2)");
    await db.exec("update public.cg_state set president_player = '" + ME + "', term_no = 4 where id = 1");

    const loy = await call(db, "select id, loyalty from public.cg_factions order by id");
    check("the President's party rose by 8", Number(loy[0].loyalty) === 63, JSON.stringify(loy));
    check("the other fell by 4", Number(loy[1].loyalty) === 51, JSON.stringify(loy));

    await db.exec("update public.cg_speaker_state set speaker_player = '" + ME + "', speaker_party = 'militarists', term_no = 1 where id = 1");
    const loy2 = await call(db, "select id, loyalty from public.cg_factions order by id");
    check("the Speaker's election envies the same way", Number(loy2[0].loyalty) === 71 && Number(loy2[1].loyalty) === 47,
        JSON.stringify(loy2));

    /* a card without a player is not an election */
    await db.exec("update public.cg_state set president_player = null, term_no = 5 where id = 1");
    const loy3 = await call(db, "select id, loyalty from public.cg_factions order by id");
    check("clearing the office is not an election", Number(loy3[0].loyalty) === 71, JSON.stringify(loy3));

    console.log("\nthe Combine's three, which are not the Congress's three");

    const posts = (await call(db, "select public.cs_minister_posts() as p"))[0].p;
    check("security, grain and labour", JSON.stringify(posts) === JSON.stringify(["security", "grain", "labour"]),
        JSON.stringify(posts));

    const names = await call(db, "select public.cs_minister_name('security') as a, public.cs_minister_name('grain') as b, public.cs_minister_name('labour') as c");
    check("each has its own commissariat", /Segurança/.test(names[0].a) && /Grão/.test(names[0].b) && /Trabalho/.test(names[0].c),
        JSON.stringify(names[0]));

    await db.exec("insert into public.cs_commissars (name, current_id, oblast, seat, loyalty) values " +
        "('Orlov', 1, 'Krieg', 1, 88), ('Zoya', 1, 'Krieg', 2, 70), ('Mikhail', 2, 'Vraks', 3, 95)");
    await db.exec("insert into public.cs_occupations (planet, stage, stability) values ('Vraks', 1, 30)");
    await db.exec("insert into public.cs_membership (player_id, current_id) values ('" + OTHER + "', 1)");
    await db.exec("update public.cs_state set term_no = 1, confidence = 55, secretary_player = null, secretary_current = null where id = 1");

    const csCredits0 = Number((await call(db, "select credits from public.faction_treasury where faction = 'Combine'"))[0].credits);

    const cgov = (await call(db, "select public.cs_government() as g"))[0].g;

    check("three commissariats", (cgov.ministers || []).length === 3,
        JSON.stringify((cgov.ministers || []).map(m => m.post)));
    check("held by commissars, not by players",
        (cgov.ministers || []).every(m => !!m.holder && m.mine === false));
    check("the biggest current hands them out", (cgov.ministers || []).every(m => Number(m.party) === 1),
        JSON.stringify((cgov.ministers || []).map(m => m.party)));
    check("its most loyal commissar holds each one", (cgov.ministers || []).every(m => m.holder === "Orlov"),
        JSON.stringify((cgov.ministers || []).map(m => [m.holder, m.loyalty])));
    check("the old Congress posts are gone from the Soviet's book",
        !(cgov.ministers || []).some(m => ["war", "treasury", "interior"].includes(m.post)));

    const csKinds = (cgov.ministers || []).map(m => m.effect && m.effect.kind).sort().join(",");
    check("a fleet, a levy and a relief, exactly as the Congress's", csKinds === "fleet,levy,relief", csKinds);

    const csCredits1 = Number((await call(db, "select credits from public.faction_treasury where faction = 'Combine'"))[0].credits);
    check("the grain commissariat sold the harvest into the treasury", csCredits1 > csCredits0, csCredits0 + " -> " + csCredits1);

    const conf = Number((await call(db, "select confidence from public.cs_state where id = 1"))[0].confidence);
    check("and the people were told", conf === 52, conf);

    const labour = (cgov.ministers || []).find(m => m.post === "labour").effect;
    check("labour sent relief where it was needed", labour.planet === "Vraks", JSON.stringify(labour));

    console.log("\nand the Combine envies too");

    await db.exec("update public.cs_currents set loyalty = 55 where id in (1, 2)");
    await db.exec("update public.cs_state set secretary_player = '" + OTHER + "', secretary_current = 1, term_no = 2 where id = 1");
    const cur = await call(db, "select id, loyalty from public.cs_currents order by id");
    check("the High Commissar's current rose by 8", Number(cur[0].loyalty) === 63, JSON.stringify(cur));
    check("the other fell by 4", Number(cur[1].loyalty) === 51, JSON.stringify(cur));

    console.log("\n" + passed + " passed, " + failed + " failed");

    if (failed) { process.exit(1); }

})();
