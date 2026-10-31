/* The database refuses a Knightmare squad with no works behind it.

   sql/2026-11-43 puts the rule in a trigger on fleet_recruits, so a stale
   page, a hand-written insert and a direct RPC call all meet the same wall.
   This runs the patch in PGlite, twice, and then tries every door.
*/

const fs = require("fs");
const path = require("path");
const { PGlite } = require("@electric-sql/pglite");

const PATCH = fs.readFileSync(
    path.join(__dirname, "..", "sql/2026-11-43_the_mechs_need_their_works.sql"), "utf8");

let pass = 0;
let fail = 0;

function ok(name, yes, extra) {

    if (yes) {
        pass++;
        console.log("  ok   " + name);
    } else {
        fail++;
        console.log("  FAIL " + name + (extra === undefined ? "" : "  -> " + JSON.stringify(extra)));
    }

}

async function main() {

    const db = new PGlite();

    await db.exec(`
        create table public.planets (id uuid primary key, name text not null);
        create table public.cities (id uuid primary key, planet_id uuid, faction text);
        create table public.city_buildings (city_id uuid, building_type text);
        create table public.fleets (
            id uuid primary key, origin text, status text, faction text,
            transport_fleet boolean default false, squads jsonb);
        create table public.fleet_recruits (
            id serial primary key, fleet_id uuid, squad_type text,
            ready_at timestamptz default now());
    `);

    await db.exec(PATCH);
    await db.exec(PATCH);

    ok("the patch runs, and runs again", true);

    const P1 = "11111111-1111-1111-1111-111111111111";
    const P2 = "55555555-5555-5555-5555-555555555555";
    const C1 = "22222222-2222-2222-2222-222222222222";
    const C2 = "33333333-3333-3333-3333-333333333333";
    const C3 = "66666666-6666-6666-6666-666666666666";
    const F1 = "44444444-4444-4444-4444-444444444444";
    const F2 = "77777777-7777-7777-7777-777777777777";

    await db.exec(`
        insert into public.planets (id, name) values ('${P1}', 'Ultramars'), ('${P2}', 'Veyrona');
        insert into public.cities (id, planet_id, faction) values
            ('${C1}', '${P1}', 'Combine'), ('${C2}', '${P1}', 'Combine'), ('${C3}', '${P2}', 'Independents');
        insert into public.city_buildings (city_id, building_type) values
            ('${C1}', 'knightmare_facility'), ('${C1}', 'speeder_wheel'),
            ('${C1}', 'frame'), ('${C2}', 'controls');
        insert into public.fleets (id, origin, status, faction) values
            ('${F1}', 'Ultramars', 'stationed', 'Combine'),
            ('${F2}', 'Veyrona', 'stationed', 'Independents');
    `);

    async function queue(fleet, type) {
        try {
            await db.query("insert into public.fleet_recruits (fleet_id, squad_type) values ($1, $2)", [fleet, type]);
            return null;
        } catch (error) {
            return error.message || String(error);
        }
    }

    async function works(name) {
        const row = (await db.query("select public.knightmare_works_on($1) as w", [name])).rows[0];
        return row.w;
    }

    ok("a planet with the whole chain answers yes", (await works("Ultramars")) === true);
    ok("a planet without it answers no", (await works("Veyrona")) === false);
    ok("nothing at all answers no", (await works("")) === false);

    const good = await queue(F1, "Knightmare");
    ok("the squad is queued where the works are", good === null, good);

    const bare = await queue(F2, "Knightmare");
    ok("a bare planet refuses the squad", !!bare && /Knightmare Facility/.test(bare), bare);

    ok("an ordinary rifle is never touched", (await queue(F2, "Rifle")) === null);

    const rifle = (await db.query("select id from public.fleet_recruits where squad_type = 'Rifle'")).rows[0].id;

    let renamed = null;
    try {
        await db.query("update public.fleet_recruits set squad_type = 'Knightmare' where id = $1", [rifle]);
    } catch (error) {
        renamed = error.message || String(error);
    }
    ok("a queued rifle cannot be renamed into a squad", !!renamed && /Knightmare/.test(renamed), renamed);

    let moved = null;
    try {
        await db.query("update public.fleet_recruits set fleet_id = $1 where id = $2", [F2, rifle]);
    } catch (error) {
        moved = error.message || String(error);
    }
    ok("a row cannot be pointed at another type either", moved === null || /Knightmare/.test(moved), moved);

    await db.exec(`update public.fleets set status = 'travelling' where id = '${F1}'`);
    const away = await queue(F1, "Knightmare");
    ok("a fleet under way cannot raise one", !!away && /stationed/.test(away), away);

    await db.exec(`update public.fleets set status = 'stationed' where id = '${F1}'`);
    await db.exec(`delete from public.city_buildings where city_id = '${C2}'`);
    const partial = await queue(F1, "Knightmare");
    ok("one missing building is enough to refuse", !!partial && /Knightmare Facility/.test(partial), partial);

    /* a world from before cities keyed their planet by id */
    await db.exec(`alter table public.cities alter column planet_id type text using planet_id::text`);
    await db.exec(`
        insert into public.cities (id, planet_id, faction)
        values ('99999999-9999-9999-9999-999999999999', 'Kharos', 'Combine');
        insert into public.city_buildings (city_id, building_type) values
            ('99999999-9999-9999-9999-999999999999', 'knightmare_facility'),
            ('99999999-9999-9999-9999-999999999999', 'speeder_wheel'),
            ('99999999-9999-9999-9999-999999999999', 'frame'),
            ('99999999-9999-9999-9999-999999999999', 'controls');
    `);

    ok("an old world that names its planet is still read", (await works("Kharos")) === true, await works("Kharos"));
    ok("and its chain is still not the other planet's", (await works("Veyrona")) === false);

}

main().then(function() {

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}).catch(function(error) {

    fail++;
    console.log("  FAIL the guard crashed  -> " + (error.message || error));
    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(1);

});
