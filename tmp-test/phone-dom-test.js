/* Phone mode's layout is CSS, which a source test cannot see, but its
   galaxy helpers are real code: the dock, the world list, the tap-to-send
   path and the switch. This runs mobile.js against a small DOM that has
   the same ids and classes the galaxy page has, and presses the buttons.

   Run: NODE_PATH=/tmp/gfnode/node_modules node tmp-test/phone-dom-test.js */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(ROOT, "mobile.js"), "utf8");

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
    if (ok) { passed++; console.log("  ok   " + name); }
    else { failed++; console.log("  FAIL " + name + (detail !== undefined ? "  :: " + detail : "")); }
}

const HTML = `<!DOCTYPE html>
<html><head><title>galaxy</title></head><body>
<button class="main-menu-button" id="main-menu-button">MAIN MENU</button>
<div class="map-header"><h1>GALACTIC MAP</h1><p>Click a planet.</p></div>
<div class="galaxy-map" id="galaxy-map">
  <div class="fleet-layer" id="fleet-layer"></div>
  <div class="planet-layer" id="planet-layer">
    <div class="planet combine planet-1" data-name="Ultramars" data-owner="Combine"><span>Ultramars</span></div>
    <div class="planet freedom planet-2" data-name="Free Earth" data-owner="Freedom Authority"><span>Free Earth</span></div>
    <div class="planet independent planet-3" data-name="Veyrona" data-owner="Independents"><span>Veyrona</span></div>
  </div>
</div>
<div id="fleet-status-display"></div>
<div id="fleet-command-panel">
  <button id="close-fleet-panel" type="button">x</button>
  <h2 id="fleet-panel-name">Fleet</h2>
</div>
<div id="toast"></div>
</body></html>`;

const dom = new JSDOM(HTML, {
    url: "https://gf.test/galaxy.html?phone=1",
    runScripts: "outside-only",
    pretendToBeVisual: true
});

const { window } = dom;

window.localStorage.setItem("playerFaction", "Combine");

window.eval(source);

if (!window.document.getElementById("gf-phone-dock")) {
    window.document.dispatchEvent(new window.Event("DOMContentLoaded"));
}

const doc = window.document;
const root = doc.documentElement;
const $ = id => doc.getElementById(id);

/* ---------------------------------------------------------
   the switch
--------------------------------------------------------- */

check("phone mode is on from the URL", root.classList.contains("gf-phone"));
check("its rules were injected", !!$("gf-phone-style"));
check("the floating switch stays reachable in phone mode",
    $("gf-phone-button") && $("gf-phone-button").style.display !== "none");

check("the dock is there", !!$("gf-phone-dock"));
check("with worlds, send and the switch",
    $("gf-phone-dock").querySelectorAll("button").length === 3);
check("the switch says what it will do",
    $("gf-phone-dock").querySelector('[data-gf="mode"]').textContent === "DESKTOP MODE",
    $("gf-phone-dock").querySelector('[data-gf="mode"]').textContent);

/* ---------------------------------------------------------
   the world list
--------------------------------------------------------- */

$("gf-phone-dock").querySelector('[data-gf="worlds"]').click();

check("the world list opens", $("gf-worlds") && $("gf-worlds").classList.contains("open"));

const rows = Array.from(doc.querySelectorAll(".gf-world-row"));

check("every world is listed", rows.length === 3, rows.length);
check("yours is marked", rows.some(r => r.classList.contains("mine") && r.dataset.world === "Ultramars"));
check("the worlds are grouped by owner", doc.querySelectorAll(".gf-world-group").length === 3);

const search = $("gf-worlds-search");
search.value = "vey";
search.dispatchEvent(new window.Event("input", { bubbles: true }));

check("the search filters", doc.querySelectorAll(".gf-world-row").length === 1,
    doc.querySelectorAll(".gf-world-row").length);

search.value = "zzz";
search.dispatchEvent(new window.Event("input", { bubbles: true }));

check("an empty search says so", /NO WORLD MATCHES/.test($("gf-worlds-list").textContent));

search.value = "";
search.dispatchEvent(new window.Event("input", { bubbles: true }));

/* a world row opens the planet it names */
let opened = null;

for (const planet of doc.querySelectorAll(".planet")) {
    planet.addEventListener("click", function () { opened = planet.dataset.name; });
}

Array.from(doc.querySelectorAll(".gf-world-row"))
    .find(r => r.dataset.world === "Free Earth")
    .click();

check("a row opens that world", opened === "Free Earth", opened);
check("and closes the list", !$("gf-worlds").classList.contains("open"));

/* ---------------------------------------------------------
   sending a fleet without a right button
--------------------------------------------------------- */

const send = $("gf-phone-dock").querySelector('[data-gf="send"]');

check("sending is refused until a fleet is selected", send.disabled);

$("fleet-command-panel").classList.add("visible");

check("an open panel with no fleet in it does not arm sending", send.disabled);

const status = doc.createElement("div");
status.id = "fleet-panel-status";
status.textContent = "Status: STATIONED";
$("fleet-command-panel").appendChild(status);

setTimeout(function () {

    check("selecting a fleet arms it", !send.disabled);

    /* the sheet is minimised to see the map it is being sent across */
    $("fleet-command-panel").classList.add("collapsed");

    check("a minimised sheet still leaves the fleet in hand",
        !!(window.GF_PHONE && window.GF_PHONE.selected && window.GF_PHONE.selected()));

    $("fleet-command-panel").classList.remove("collapsed");

    send.click();

    check("the map asks for a world", $("gf-aim-banner").classList.contains("open"));
    check("and marks the worlds", root.classList.contains("gf-aim"));

    let context = null;

    $("galaxy-map").addEventListener("contextmenu", function (ev) {
        context = { x: ev.clientX, y: ev.clientY, button: ev.button };
    });

    opened = null;

    doc.querySelector('.planet[data-name="Veyrona"]').click();

    check("tapping a world sends the fleet there", !!context && context.button === 2, context);
    check("the tap does not also open the world", opened === null, opened);
    check("and the request is done", !root.classList.contains("gf-aim"));

    /* the list doubles as the map's right button while aiming */
    send.click();
    $("gf-phone-dock").querySelector('[data-gf="worlds"]').click();

    check("the list says what it will do",
        /SEND THE FLEET/.test(doc.querySelector("#gf-worlds h2").textContent),
        doc.querySelector("#gf-worlds h2").textContent);

    context = null;
    Array.from(doc.querySelectorAll(".gf-world-row")).find(r => r.dataset.world === "Free Earth").click();

    check("a row sends the fleet instead of opening the world",
        !!context && context.button === 2, context);
    check("and the aim is over", !root.classList.contains("gf-aim"));

    /* the fleet panel closing must disarm it again */
    $("fleet-command-panel").classList.remove("visible");

    setTimeout(function () {

        check("losing the fleet puts the send away", send.disabled);

        /* ---------------------------------------------------------
           the map camera
        --------------------------------------------------------- */

        const map = $("galaxy-map");

        Object.defineProperty(map, "clientWidth", { value: 390, configurable: true });
        Object.defineProperty(map, "clientHeight", { value: 700, configurable: true });

        function touch(type, points) {
            const ev = new window.Event(type, { bubbles: true, cancelable: true });
            ev.touches = points;
            ev.changedTouches = points;
            map.dispatchEvent(ev);
        }

        const finger = (id, x, y) => ({ identifier: id, clientX: x, clientY: y });

        touch("touchstart", [finger(1, 100, 200), finger(2, 200, 200)]);
        touch("touchmove", [finger(1, 50, 200), finger(2, 250, 200)]);
        touch("touchend", [finger(1, 50, 200), finger(2, 250, 200)]);

        const transform = map.style.transform || "";

        check("a pinch zooms the map", /scale\((?!1\))/.test(transform), transform);
        check("names come back when it is zoomed", root.classList.contains("gf-map-zoomed"));

        check("there is a zoom pad for players who do not pinch", !!$("gf-zoom"));
        check("and it is on in phone mode", $("gf-zoom").classList.contains("open"));

        $("gf-zoom").querySelector('[data-zoom="fit"]').click();
        $("gf-zoom").querySelector('[data-zoom="in"]').click();
        check("+ zooms from the fitted view", /scale\(1\.4/.test(map.style.transform), map.style.transform);

        $("gf-zoom").querySelector('[data-zoom="fit"]').click();
        check("fit hands the map back to the page", !map.style.transform, map.style.transform);

        /* the click a pan leaves behind must not open a world */
        opened = null;
        doc.querySelector('.planet[data-name="Ultramars"]').click();
        check("a pinch does not count as a tap", opened === null, opened);

        /* a plain tap still does */
        doc.querySelector('.planet[data-name="Ultramars"]').click();
        check("a plain tap opens the world", opened === "Ultramars", opened);
        check("and returns the map to its fitted view", !map.style.transform, map.style.transform);

        /* ---------------------------------------------------------
           back to the desk and forward again
        --------------------------------------------------------- */

        $("gf-phone-dock").querySelector('[data-gf="mode"]').click();

        check("the switch leaves phone mode", !root.classList.contains("gf-phone"));
        check("the dock goes away", $("gf-phone-dock").style.display === "none");
        check("the floating switch comes back", $("gf-phone-button").style.display !== "none");

        $("gf-phone-button").click();

        check("and it comes back", root.classList.contains("gf-phone"));
        check("with the dock", $("gf-phone-dock").style.display === "flex");
        check("with the float still there as a second way out",
            $("gf-phone-button").style.display !== "none");

        console.log("\n" + passed + " passed, " + failed + " failed");

        if (failed) { process.exit(1); }

    }, 20);

}, 20);
