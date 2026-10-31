/* The Knightmare needs its works, and the Combine's plan is a tax level.

   The fleet panel has always told the player, in the button's own tooltip,
   that a Knightmare squad needs a complete facility on the planet — Facility,
   Speeder Wheel, Frame and Controls — and nothing ever checked it, so a fleet
   over a world with no works could order squads anyway. And the Combine's
   government page called its tax a quota, while the Freedom Authority shows a
   tax level.

   This lifts the new gate out of galaxy.html and drives it against a fake
   database, then reads the labels the player actually sees.
*/

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GALAXY = fs.readFileSync(path.join(ROOT, "galaxy.html"), "utf8");
const COMBINE = fs.readFileSync(path.join(ROOT, "combine.html"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");

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

console.log("\n== the permission the button promises");

ok("the chain is the four buildings",
    /const KNIGHTMARE_CHAIN = \["knightmare_facility", "speeder_wheel", "frame", "controls"\];/.test(GALAXY));
ok("the planet's own cities are read",
    /\.from\("cities"\)[\s\S]{0,120}?\.eq\("planet_id", orbit\)/.test(GALAXY));
ok("their buildings are read",
    /\.from\("city_buildings"\)[\s\S]{0,160}?\.in\("city_id", ids\)/.test(GALAXY));
ok("every building in the chain is required",
    /KNIGHTMARE_CHAIN\.every\(/.test(GALAXY));

const guard = GALAXY.indexOf('type === "Knightmare" &&');
const hire = GALAXY.indexOf("await knightmareHere(selectedFleet)");
const rpc = GALAXY.indexOf('"recruit_to_fleet"');

ok("the panel asks before it orders anything",
    guard !== -1 && hire !== -1 && hire < rpc, { guard: guard, hire: hire, rpc: rpc });
ok("the refusal says what is missing",
    /The Knightmare line is not built here/.test(GALAXY));

async function main() {

console.log("\n== the gate, driven against a fake database");

const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>",
    { url: "https://e.test/galaxy", runScripts: "outside-only" });

const w = dom.window;

/* a supabase query builder is a thenable, so the gate can await it */
function client(tables) {

    return {
        from: function(table) {

            let rows = (tables[table] || []).slice();

            const q = {
                select: function() { return q; },
                eq: function(col, value) {
                    rows = rows.filter(function(r) { return r[col] === value; });
                    return q;
                },
                in: function(col, values) {
                    rows = rows.filter(function(r) { return values.indexOf(r[col]) !== -1; });
                    return q;
                },
                then: function(res, rej) {
                    return Promise.resolve({ data: rows, error: null }).then(res, rej);
                }
            };

            return q;

        }
    };

}

const from = GALAXY.indexOf("const KNIGHTMARE_CHAIN");
const to = GALAXY.indexOf("/* and the sentence under the recruiting office");

ok("the gate can be lifted out of the page whole",
    from !== -1 && to > from && /async function knightmareHere/.test(GALAXY.slice(from, to)));

w.eval(GALAXY.slice(from, to) + "\nwindow.knightmareHere = knightmareHere;");

const ULTRAMARS = [
    { id: "c1", planet_id: "Ultramars" },
    { id: "c2", planet_id: "Ultramars" }
];

const FULL = [
    { city_id: "c1", building_type: "knightmare_facility" },
    { city_id: "c1", building_type: "speeder_wheel" },
    { city_id: "c1", building_type: "frame" },
    { city_id: "c2", building_type: "controls" }
];

async function ask(tables, planet) {

    w.supabaseClient = client(tables);
    w.fleetOrbitName = function() { return planet; };

    return await w.knightmareHere({ id: "f1", status: "stationed", planet: planet });

}

ok("a planet with the whole chain may raise a squad",
    (await ask({ cities: ULTRAMARS, city_buildings: FULL }, "Ultramars")) === true);
ok("the works may be spread over the planet's cities",
    (await ask({ cities: ULTRAMARS, city_buildings: FULL }, "Ultramars")) === true);
ok("one missing building is enough to refuse",
    (await ask({ cities: ULTRAMARS, city_buildings: FULL.slice(0, 3) }, "Ultramars")) === false);
ok("works on a different planet do not count",
    (await ask({
        cities: ULTRAMARS.concat([{ id: "c9", planet_id: "Veyrona" }]),
        city_buildings: FULL.concat([{ city_id: "c9", building_type: "controls" }])
    }, "Veyrona")) === false);
ok("a planet with no cities has nothing built",
    (await ask({ cities: [], city_buildings: [] }, "Ultramars")) === false);
ok("a fleet in deep space cannot raise one",
    (await ask({ cities: ULTRAMARS, city_buildings: FULL }, null)) === false);

console.log("\n== the Combine's tax level");

ok("the top bar calls it a tax level",
    /<div class="stat">TAX LEVEL<br><b id="st-quota">/.test(COMBINE));
ok("no stat still says quota",
    !/<div class="stat">QUOTA/.test(COMBINE));
ok("the number is still the plan's own level",
    /"st-quota"\)\.textContent = ov\.state\.tax_level \+ " \/ 2"/.test(COMBINE));
ok("lowering it still calls cs_quota_cut",
    /cs_quota_cut/.test(COMBINE));
ok("the button says what it lowers",
    /title="Lower the tax level by one level"/.test(COMBINE));
ok("the standing card reads as a tax level",
    /esc\(T\("TAX LEVEL"\)\) \+ ' ' \+ st\.tax_level/.test(COMBINE));
ok("the production-plan wording is gone from the page",
    COMBINE.indexOf('T("PRODUCTION PLAN")') === -1);

console.log("\n== in Portuguese");

ok("the tax level has a Portuguese name",
    /"TAX LEVEL": "NÍVEL DE IMPOSTOS"/.test(I18N));
ok("lowering it is translated",
    /"The tax level is one level lower\.":\s*"[^"]+"/.test(I18N));
ok("the refusal is translated",
    I18N.indexOf('"The Knightmare line is not built here') !== -1 &&
    /A linha Knightmare não está construída aqui/.test(I18N));

}

main().then(function() {

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}).catch(function(error) {

    fail++;
    console.log("  FAIL the gate crashed  -> " + error.message);
    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(1);

});
