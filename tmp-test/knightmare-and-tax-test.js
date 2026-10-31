/* The Knightmare needs its works, and the Combine's plan is a tax level.

   The panel used to guess the facility chain itself, from city tables that
   key planets by id, and guessed wrong; the rule now lives in the database
   (knightmare_works_on, sql/2026-11-43) where an insert, a stale page and a
   direct RPC call all meet it. This drives the panel's half against a fake
   client and reads the labels the player actually sees.
*/

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const GALAXY = fs.readFileSync(path.join(ROOT, "galaxy.html"), "utf8");
const COMBINE = fs.readFileSync(path.join(ROOT, "combine.html"), "utf8");
const I18N = fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8");
const PATCH = fs.readFileSync(path.join(ROOT, "sql/2026-11-43_the_mechs_need_their_works.sql"), "utf8");

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

console.log("\n== the panel asks the database");

ok("the panel calls the one function that knows",
    /\.rpc\("knightmare_works_on", \{ p_planet: orbit \}\)/.test(GALAXY));
ok("it keeps no list of buildings of its own", GALAXY.indexOf("KNIGHTMARE_CHAIN") === -1);
ok("a fleet with no planet is refused without asking",
    /if \(!orbit\) \{ return false; \}/.test(GALAXY));
ok("a missing function does not stop play",
    /if \(error\) \{ return true; \}/.test(GALAXY));

const guard = GALAXY.indexOf('type === "Knightmare" &&');
const hire = GALAXY.indexOf("await knightmareHere(selectedFleet)");
const rpc = GALAXY.indexOf('"recruit_to_fleet"');

ok("the panel asks before it orders anything",
    guard !== -1 && hire !== -1 && hire < rpc, { guard: guard, hire: hire, rpc: rpc });
ok("the refusal says what is missing",
    /The Knightmare line is not built here/.test(GALAXY));

console.log("\n== the patch behind it");

ok("the patch ships the question the panel asks",
    /create or replace function public\.knightmare_works_on\(p_planet text\)/.test(PATCH));
ok("and the same four works",
    /knightmare_facility[\s\S]{0,80}speeder_wheel[\s\S]{0,80}frame[\s\S]{0,80}controls/.test(PATCH));
ok("a trigger sits on the queue",
    /create trigger knightmare_needs_its_works/.test(PATCH));
ok("it catches inserts and renames",
    /before insert or update of fleet_id, squad_type on public\.fleet_recruits/.test(PATCH));
ok("it demands a docked fleet",
    /has to be stationed/.test(PATCH));

async function main() {

    console.log("\n== the gate, driven against a fake client");

    const { JSDOM } = require("jsdom");

    const dom = new JSDOM("<!doctype html><html><body></body></html>",
        { url: "https://e.test/galaxy", runScripts: "outside-only" });

    const w = dom.window;

    const from = GALAXY.indexOf("async function knightmareHere");
    const to = GALAXY.indexOf("/* and the sentence under the recruiting office");

    ok("the gate can be lifted out of the page whole",
        from !== -1 && to > from && /knightmare_works_on/.test(GALAXY.slice(from, to)));

    w.eval(GALAXY.slice(from, to) + "\nwindow.knightmareHere = knightmareHere;");

    let asked = null;

    function client(answer) {

        return {
            rpc: function(name, params) {
                asked = { name: name, params: params };
                return Promise.resolve(answer);
            }
        };

    }

    async function ask(answer, planet) {

        w.supabaseClient = client(answer);
        w.fleetOrbitName = function() { return planet; };

        asked = null;

        return await w.knightmareHere({ id: "f1", status: "stationed", planet: planet });

    }

    ok("the whole chain allows the squad",
        (await ask({ data: true, error: null }, "Ultramars")) === true);
    ok("it asks about the fleet's own planet",
        asked && asked.name === "knightmare_works_on" && asked.params.p_planet === "Ultramars", asked);
    ok("an incomplete chain refuses it",
        (await ask({ data: false, error: null }, "Ultramars")) === false);
    ok("a database that cannot answer does not brick recruiting",
        (await ask({ data: null, error: { message: "function not found" } }, "Ultramars")) === true);

    const deep = await ask({ data: true, error: null }, "");

    ok("a fleet in deep space cannot raise one", deep === false && asked === null, { deep: deep, asked: asked });

    console.log("\n== the Combine's tax level");

    ok("the top bar calls it a tax level",
        /<div class="stat">TAX LEVEL<br><b id="st-quota">/.test(COMBINE));
    ok("no stat still says quota",
        !/<div class="stat">QUOTA/.test(COMBINE));
    ok("the number is still the plan's own level",
        /"st-quota"\)\.textContent = ov\.state\.tax_level \+ " \/ 2"/.test(COMBINE));
    ok("lowering it still calls cs_quota_cut", /cs_quota_cut/.test(COMBINE));
    ok("the button says what it lowers",
        /title="Lower the tax level by one level"/.test(COMBINE));
    ok("the standing card reads as a tax level",
        /esc\(T\("TAX LEVEL"\)\) \+ ' ' \+ st\.tax_level/.test(COMBINE));
    ok("the production-plan wording is gone from the page",
        COMBINE.indexOf('T("PRODUCTION PLAN")') === -1);

    console.log("\n== in Portuguese");

    ok("the tax level has a Portuguese name", /"TAX LEVEL": "NÍVEL DE IMPOSTOS"/.test(I18N));
    ok("lowering it is translated", /"The tax level is one level lower\.":\s*"[^"]+"/.test(I18N));
    ok("the refusal is translated",
        I18N.indexOf('"The Knightmare line is not built here') !== -1 &&
        /A linha Knightmare não está construída aqui/.test(I18N));

}

main().then(function() {

    console.log("\n" + pass + " passed, " + fail + " failed");

    process.exit(fail ? 1 : 0);

}).catch(function(error) {

    fail++;
    console.log("  FAIL the checks crashed  -> " + (error.message || error));
    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(1);

});
