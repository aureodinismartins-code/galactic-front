/* The fleet screen went missing once because selectFleet() filled the panel
   before showing it, and because a minimised panel or a phone layout could
   leave it out of sight. These are source-level guards on the three rules that
   keep it visible; they are deliberately about ordering, not looks.

   Run: node tmp-test/fleet-panel-test.js */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
    if (ok) { passed++; console.log("  ok   " + name); }
    else { failed++; console.log("  FAIL " + name + (detail !== undefined ? "  :: " + detail : "")); }
}

const galaxy = fs.readFileSync(path.join(ROOT, "galaxy.html"), "utf8");
const mobile = fs.readFileSync(path.join(ROOT, "mobile.js"), "utf8");

/* ---------------------------------------------------------
   the body of selectFleet(), up to the next top-level function
--------------------------------------------------------- */

const start = galaxy.indexOf("function selectFleet(fleet, pickedByHand) {");

check("selectFleet exists", start !== -1);

const rest = galaxy.slice(start + 10);
const nextFn = rest.search(/\nfunction [a-zA-Z]/);

/* comments talk about the calls they guard: measure the code, not the prose */
const body = (nextFn === -1 ? rest : rest.slice(0, nextFn)).replace(/\/\*[\s\S]*?\*\//g, "");

const shownAt = body.indexOf('classList.add');
const dockedAt = body.indexOf("updateDock(");

check("the panel is shown inside selectFleet", shownAt !== -1 && /classList\.add\(\s*"visible"\s*\)/.test(body));

check("and it is shown before the dock is updated",
    shownAt !== -1 && (dockedAt === -1 || shownAt < dockedAt),
    "visible at " + shownAt + ", updateDock at " + dockedAt);

check("a minimised panel is opened again when the player clicks a fleet",
    /pickedByHand === true && fleetPanel\.classList\.contains\("collapsed"\)/.test(body) &&
    body.indexOf("min-fleet-panel") !== -1);

/* the refresh loops call selectFleet() again with whatever was selected. They
   used to press the panel's own button each time, so a minimised panel opened
   by itself every few seconds: only the click on a fleet may ask for it. */
const handPicks = (galaxy.match(/selectFleet\(\s*[A-Za-z_.]+\s*,\s*true\s*\)/g) || []).length;

check("and only the player's click asks for that, never a refresh loop",
    handPicks === 1, handPicks);

check("an empty warning strip takes no room on the panel",
    /\.dock-warning:empty\s*\{[^}]*display:\s*none/.test(galaxy), galaxy.indexOf(".dock-warning:empty"));

/* ---------------------------------------------------------
   the army summary must not be able to take the dock with it
--------------------------------------------------------- */

const dockStart = galaxy.indexOf("function updateDock(canWork) {");
const dockRest = galaxy.slice(dockStart + 10);
const dockEnd = dockRest.search(/\nfunction [a-zA-Z]/);
const dockBody = (dockEnd === -1 ? dockRest : dockRest.slice(0, dockEnd)).replace(/\/\*[\s\S]*?\*\//g, "");

check("the army refresh is wrapped where the dock calls it",
    /try\s*\{\s*updateArmySoon\(\);\s*\}\s*catch/.test(dockBody),
    dockBody.slice(0, 160));

const soonStart = galaxy.indexOf("function updateArmySoon()");
const soonRest = galaxy.slice(soonStart);
const soonEnd = soonRest.indexOf("\nfunction ", 10);
const soonBody = (soonEnd === -1 ? soonRest : soonRest.slice(0, soonEnd)).replace(/\/\*[\s\S]*?\*\//g, "");

check("and it swallows a failed army read", /\.catch\(|catch\s*\(/.test(soonBody));

/* ---------------------------------------------------------
   the panel must be on screen in the phone layout
--------------------------------------------------------- */

check("phone mode pins the fleet panel to the viewport",
    /html\.gf-phone #fleet-command-panel[\s\S]{0,200}position: fixed/.test(mobile));

/* the army box belongs to that panel, not outside it */
const panelOpen = galaxy.indexOf('<div id="fleet-command-panel">');
const armyBox = galaxy.indexOf('<div id="fleet-army"></div>');
const panelClose = galaxy.indexOf('id="fleet-recruitment"');

check("the army box sits inside the fleet panel",
    panelOpen !== -1 && armyBox > panelOpen && (panelClose === -1 || armyBox < panelClose),
    "panel " + panelOpen + ", army " + armyBox + ", recruitment " + panelClose);

/* ---------------------------------------------------------
   the dock says why it cannot work, instead of going grey
--------------------------------------------------------- */

check("the dock carries a hint line under the repair button",
    galaxy.indexOf('id="fleet-dock-hint"') !== -1 &&
    galaxy.indexOf('id="fleet-dock-hint"') > galaxy.indexOf('id="repair-fleet-button"'));

const handler = galaxy.slice(galaxy.indexOf('if (repairFleetButton) {'));

check("the repair click reads the world's owner before it repairs",
    handler.indexOf("planetOwner(") !== -1 &&
    (handler.indexOf('rpc("repair_fleet"') === -1 ||
     handler.indexOf("planetOwner(") < handler.indexOf('rpc("repair_fleet"')),
    "planetOwner at " + handler.indexOf("planetOwner(") + ", rpc at " + handler.indexOf('rpc("repair_fleet"'));

check("the fleet's orbit is read as a planet, never deep space",
    /function fleetOrbitName/.test(galaxy) && /deep space/i.test(galaxy));

check("the sentence for a neutral or hostile world is translated",
    /neutral or hostile/.test(galaxy) &&
    fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8").indexOf("Não podes reparar aqui") !== -1);

/* ---------------------------------------------------------
   recruiting is a dock job too: no raising troops over a hostile world
--------------------------------------------------------- */

check("the recruiting office carries a hint line",
    galaxy.indexOf('id="fleet-recruit-hint"') !== -1 &&
    galaxy.indexOf('id="fleet-recruit-hint"') > galaxy.indexOf('id="fleet-recruitment-title"'));

const recruitHandler = galaxy.slice(galaxy.indexOf("recruitButtons.forEach(", galaxy.indexOf("RECRUIT UNITS")));

check("the recruit click asks whether the world is ours before it recruits",
    recruitHandler.indexOf("recruitHere(") !== -1 &&
    (recruitHandler.indexOf('rpc(') === -1 ||
     recruitHandler.indexOf("recruitHere(") < recruitHandler.indexOf("recruit_to_fleet")),
    "recruitHere at " + recruitHandler.indexOf("recruitHere(") + ", rpc at " + recruitHandler.indexOf("recruit_to_fleet"));

check("the office says why, under its title",
    /showRecruitHint\(selectedFleet\);/.test(galaxy) && /function showRecruitHint/.test(galaxy));

check("the sentence for recruiting over a neutral or hostile world is translated",
    /You cannot recruit here/.test(galaxy) &&
    fs.readFileSync(path.join(ROOT, "i18n.js"), "utf8").indexOf("Não podes recrutar aqui") !== -1);

/* ---------------------------------------------------------
   and both say so as a warning, not as a footnote
--------------------------------------------------------- */

check("there is a warning strip to put them in", /\.dock-warning\s*\{/.test(galaxy));

check("both notices are marked as alerts",
    /id="fleet-dock-hint" role="alert"/.test(galaxy) &&
    /id="fleet-recruit-hint" role="alert"/.test(galaxy));

check("both notices are shown as warnings",
    (galaxy.match(/"fleet-panel-row dock-warning"/g) || []).length >= 4,
    (galaxy.match(/"fleet-panel-row dock-warning"/g) || []).length);

check("and they lead with the warning mark",
    (galaxy.match(/\\u26a0 /g) || []).length >= 4,
    (galaxy.match(/\\u26a0 /g) || []).length);

console.log("\n" + passed + " passed, " + failed + " failed");

if (failed) { process.exit(1); }
