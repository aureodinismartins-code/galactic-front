/* Fleets that meet in space: the scan now catches them twice as far apart,
   the travel clock measures space the way the map is drawn, and a redirected
   fleet no longer snaps back to the planet it left. The SQL runs against a
   real PostgreSQL (PGlite) with stand-ins for the space tables; the two map
   functions are cut out of galaxy.html.

   Run: NODE_PATH=/tmp/pgtest/node_modules node tmp-test/fleets-engage-test.js */

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const ROOT = path.join(__dirname, "..");
const PAGE = fs.readFileSync(path.join(ROOT, "galaxy.html"), "utf8");
const CONTROL = fs.readFileSync(path.join(ROOT, "gamecontrol.js"), "utf8");
const PATCH = fs.readFileSync(path.join(ROOT, "sql/2026-11-41_fleets_find_each_other_sooner.sql"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, cond, extra) {
    if (cond) { pass++; console.log("  ok   " + name); }
    else { fail++; console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra))); }
}

function grab(source, name) {
    const start = source.indexOf("function " + name + "(");
    if (start < 0) { return ""; }
    let depth = 0;
    for (let i = source.indexOf("{", start); i < source.length; i++) {
        if (source[i] === "{") { depth++; }
        else if (source[i] === "}") { depth--; if (!depth) { return source.slice(start, i + 1); } }
    }
    return "";
}

const SCHEMA = `
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable
as $$ select '11111111-1111-4111-8111-111111111111'::uuid $$;

create table public.game_control (id int primary key, started boolean default true);
insert into public.game_control (id, started) values (1, true);

create or replace function public.game_frozen() returns boolean language sql stable as $$ select false $$;

create table public.fleets (
    id uuid primary key default gen_random_uuid(),
    faction text, status text default 'in_space', squads jsonb default '[]'::jsonb,
    player_id uuid, name text,
    space_x numeric, space_y numeric, dest_x numeric, dest_y numeric
);

create or replace function public.space_positions()
returns table (fleet_id uuid, x numeric, y numeric)
language sql stable
as $$ select f.id, f.space_x, f.space_y from public.fleets as f where f.space_x is not null $$;

create or replace function public.space_fleet_power(p_squads jsonb)
returns numeric language sql immutable as $$ select 1 $$;

create table public.space_battles (
    id uuid primary key default gen_random_uuid(),
    kind text, planet text, x numeric, y numeric, status text default 'pending'
);

create table public.space_battle_fleets (
    id serial primary key, battle_id uuid, fleet_id uuid, side text,
    player_id uuid, faction text, fleet_name text, prev_status text, squads jsonb
);
`;

async function one(db, sql) {
    const r = await db.query(sql);
    return r.rows[0] || {};
}

(async function main() {

    try {

        console.log("\n== the scan catches fleets sooner");

        const db = new PGlite();
        await db.exec(SCHEMA);
        await db.exec(PATCH);
        await db.exec(PATCH);          /* running it twice must be harmless */

        ok("the radius comes from one function",
            Number((await one(db, "select public.space_engage_radius() as n")).n) === 14,
            (await one(db, "select public.space_engage_radius() as n")).n);

        await db.exec("insert into public.fleets (faction, status, space_x, space_y) values " +
                      "('Combine', 'in_space', 30, 40), ('Freedom Authority', 'in_space', 36, 40)");

        const near = await one(db, "select public.space_battle_scan() as r");
        const nearBattles = Array.isArray(near.r) ? near.r.length : 0;

        ok("two fleets six units apart now fight", nearBattles === 1, near.r);
        ok("and both are marked engaged",
            Number((await one(db, "select count(*)::int as n from public.fleets where status = 'engaged'")).n) === 2);

        await db.exec("delete from public.space_battle_fleets");
        await db.exec("delete from public.space_battles");
        await db.exec("update public.fleets set status = 'in_space'");
        await db.exec("update public.fleets set space_x = 70 where faction = 'Freedom Authority'");

        const far = await one(db, "select public.space_battle_scan() as r");

        ok("but forty units apart is not a fight", Array.isArray(far.r) && far.r.length === 0, far.r);

        await db.close();

        console.log("\n== the travel clock measures the map as it is drawn");

        const body = [
            "const SPACE_X_SCALE = 1.78;",
            "const world = { Krieg: [10, 10], Kara: [20, 10] };",
            "function getPlanetPosition(name) { return world[name] || [0, 0]; }",
            "function sameInstant() { return false; }",
            grab(PAGE, "calculateTravelSeconds"),
            grab(PAGE, "getTripStart"),
            "return { travel: calculateTravelSeconds, start: getTripStart };"
        ].join("\n");

        const api = new Function(body)();

        ok("the map's width counts for 1.78", /const SPACE_X_SCALE = 1\.78;/.test(PAGE));
        ok("ten units across is 107 seconds", api.travel("Krieg", "Kara") === 107, api.travel("Krieg", "Kara"));
        ok("and a free trip is still a minute", api.travel("Krieg", "Krieg") === 60, api.travel("Krieg", "Krieg"));

        console.log("\n== a redirected fleet keeps the point it left");

        const moved = api.start({
            origin: "Krieg", from_x: 44, from_y: 55,
            from_dep: "2026-01-01T00:00:00Z", departure_time: "2026-01-01T00:30:00Z"
        });

        ok("the stored point wins over the old planet", moved[0] === 44 && moved[1] === 55, moved);

        const fromPlanet = api.start({ origin: "Krieg" });

        ok("with no stored point it starts where the planet is", fromPlanet[0] === 10 && fromPlanet[1] === 10, fromPlanet);

        const half = api.start({ origin: "Krieg", from_x: 44, from_y: null });

        ok("and half a point is no point", half[0] === 10 && half[1] === 10, half);

        console.log("\n== the map shows the fight");

        ok("an engaged fleet is a bigger, slower mark",
            /engagedPulse 2\.4s/.test(PAGE) && /\.fleet-marker\.engaged \{ width: 34px/.test(PAGE));
        ok("two fleets in one fight are fanned out", /battleSlots\[key\]/.test(PAGE));
        ok("the map draws a ring where the battle is",
            /\.battle-marker \{/.test(PAGE) && /async function drawBattles\(/.test(PAGE) && /await drawBattles\(\);/.test(PAGE));
        ok("and pressing it opens that battle", /space\.html\?battle=" \+ encodeURIComponent\(b\.id\)/.test(PAGE));
        ok("the battle page lets you click near a hull, not on it",
            /s\.radius \+ 30 \/ cam\.z/.test(fs.readFileSync(path.join(ROOT, "space.html"), "utf8")));
        ok("and picks the nearest enemy for an attack",
            /sort\(\(a, b\) => Math\.hypot\(a\.x - w\.x, a\.y - w\.y\)/.test(fs.readFileSync(path.join(ROOT, "space.html"), "utf8")));

        ok("the ring reads out our hull and squads",
            /\.battle-card \{/.test(PAGE) && /fleetStrength\(mine\.squads\)/.test(PAGE) &&
            /function myFleetInBattle\(/.test(PAGE) && /battle-stat/.test(PAGE));
        ok("and the card carries the way into the battle",
            /battle-card button/.test(PAGE) && /<button type="button">' \+ T\("GO TO BATTLE"\)/.test(PAGE));
        ok("the card does not pass its presses to the map",
            /cardEl\.addEventListener\("click", function\(event\) \{ event\.stopPropagation\(\); \}\)/.test(PAGE));
        ok("a fight at the map edge opens its card inwards", /battle-flip/.test(PAGE));
        ok("the card is written in Portuguese too",
            /"GO TO BATTLE": "IR PARA O COMBATE"/.test(fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8")) &&
            /"SQUADS": "ESQUADRÕES"/.test(fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8")));

        ok("the banner is on every screen but the menu",
            /window\.GC_NO_BANNER/.test(CONTROL) && /here === "index\.html"/.test(CONTROL));

    } catch (e) {

        fail++;
        console.log("\nCRASH: " + String(e && e.stack ? e.stack : e).split("\n").slice(0, 6).join("\n"));

    }

    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);

})();
